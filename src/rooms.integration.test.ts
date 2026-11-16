import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import {
  DEFAULT_QUESTIONS,
  DEFAULT_SETTINGS,
  generateMeetupRounds,
  selectQuestions,
  SIGNUP_TEAMS,
} from "./domain";
import type { PhoneRoomView, RoomParticipant, SharedRoom } from "./rooms";

describe("connected room clients over HTTP", () => {
  let server: ViteDevServer;
  let origin: string;

  beforeAll(async () => {
    server = await createServer({
      server: { host: "127.0.0.1", port: 0, strictPort: true, open: false },
      clearScreen: false,
    });
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string")
      throw new Error("The integration server did not bind to a TCP port.");
    origin = `http://127.0.0.1:${address.port}/.netlify/functions/rooms`;
  }, 30_000);

  afterAll(async () => {
    await server?.close();
  });

  it.each([23, 27, 36, 37, 100])("keeps %i clients aligned through eight rounds with icebreakers, pause/resume, and completion", async (participantCount) => {
    let inFlight = 0;
    let peakInFlight = 0;
    let requests = 0;
    async function request<T>(url: string, init?: RequestInit): Promise<T> {
      inFlight += 1;
      peakInFlight = Math.max(peakInFlight, inFlight);
      requests += 1;
      try {
        const response = await fetch(url, {
          ...init,
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok)
          throw new Error(`Room HTTP ${response.status}: ${await response.text()}`);
        return await response.json();
      } finally {
        inFlight -= 1;
      }
    }
    const post = <T>(body: Record<string, unknown>) =>
      request<T>(origin, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

    const { code, hostSecret } = await post<{
      code: string;
      hostSecret: string;
    }>({ action: "create" });

    try {
      const joined = await Promise.all(
        Array.from({ length: participantCount }, (_, index) =>
          post<{ participant: RoomParticipant }>({
            action: "join",
            code,
            displayName: `Person ${index + 1}`,
            team: SIGNUP_TEAMS[index % SIGNUP_TEAMS.length],
            role: index === 0
              ? "Director of design"
              : index <= 4
                ? "Lead designer"
                : index % 3 === 0
                  ? "UX researcher"
                  : "Product designer",
          }),
        ),
      );
      const participants = joined.map(({ participant }) => participant);
      expect(new Set(participants.map(({ id }) => id)).size).toBe(participantCount);
      const { room } = await request<{ room: SharedRoom }>(
        `${origin}?code=${code}`,
        { headers: { "x-host-secret": hostSecret } },
      );
      expect(room.participants).toHaveLength(participantCount);
      expect(room.participants).toEqual(expect.arrayContaining(participants));

      let seed = 42;
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 2 ** 32;
      };
      const prompts = selectQuestions(
        DEFAULT_QUESTIONS, DEFAULT_SETTINGS.categories, 8, random,
      );
      const rounds = generateMeetupRounds(participants, 8, random).map(
        (round, index) => ({ ...round, question: prompts[index] }),
      );
      const readClients = () =>
        Promise.all(participants.map(({ id }) =>
          request<{ view: PhoneRoomView }>(
            `${origin}?code=${code}&participant=${id}`,
          ).then(({ view }) => view),
        ));
      function expectAssignments(
        views: PhoneRoomView[],
        roundIndex: number,
        phase: PhoneRoomView["phase"],
        deadline: number | null,
      ) {
        expect(views).toHaveLength(participantCount);
        views.forEach((view, index) => {
          expect(view.participant.id).toBe(participants[index].id);
          expect(view.participant.role).toBe(participants[index].role);
          expect(view.phase).toBe(phase);
          expect(view.deadline).toBe(deadline);
          expect(view.assignmentRound).toBe(roundIndex);
          expect(view.question).toEqual({
            category: rounds[roundIndex].question.category,
            prompt: rounds[roundIndex].question.prompt,
          });
          const station = rounds[roundIndex].stations.find(({ participantIds }) =>
            participantIds.includes(view.participant.id),
          );
          expect(station).toBeDefined();
          expect(view.assignment?.partners.map(({ id }) => id).sort()).toEqual(
            station!.participantIds.filter((id) => id !== view.participant.id).sort(),
          );
          expect(view.assignment?.partnerNames).toEqual(
            station!.participantIds
              .filter((id) => id !== view.participant.id)
              .map((id) => participants.find((person) => person.id === id)!.displayName),
          );
        });
      }
      const sync = (
        currentRound: number,
        phase: PhoneRoomView["phase"],
        deadline: number | null,
        remainingMs = 0,
        previousPhase?: string,
      ) => post({
        action: "sync", code, hostSecret, currentRound, phase,
        deadline, remainingMs, previousPhase,
      });

      let deadline = Date.now() + 30_000;
      await post({
        action: "start", code, hostSecret, rounds, phase: "intro", deadline,
      });
      expectAssignments(await readClients(), 0, "intro", deadline);

      const history = participants.map(() => new Set<string>());
      const peopleOnBreak = new Set<string>();
      for (let roundIndex = 0; roundIndex < 8; roundIndex += 1) {
        deadline = Date.now() + 180_000;
        await sync(roundIndex, "conversation", deadline);
        const views = await readClients();
        expectAssignments(views, roundIndex, "conversation", deadline);
        expect(rounds[roundIndex].stations).toHaveLength(Math.ceil(participantCount / 2));
        expect(rounds[roundIndex].stations.filter(({ kind }) => kind === "trio"))
          .toHaveLength(0);
        const breakViews = views.filter((view) => view.assignment?.break);
        expect(breakViews).toHaveLength(participantCount % 2);
        for (const view of breakViews) {
          expect(peopleOnBreak.has(view.participant.id)).toBe(false);
          peopleOnBreak.add(view.participant.id);
          expect(view.assignment?.partners).toEqual([]);
          expect(view.assignment?.activity).toContain("Your turn for a short break.");
        }
        views.forEach((view, index) => {
          expect(view.assignment?.partners).toHaveLength(view.assignment?.break ? 0 : 1);
          for (const partner of view.assignment!.partners) {
            expect(partner.team).not.toBe(view.participant.team);
            expect(history[index].has(partner.id)).toBe(false);
            const other = participants.find(({ id }) => id === partner.id)!;
            expect(
              [view.participant.role, other.role].includes("Director of design") &&
              [view.participant.role, other.role].includes("Lead designer"),
            ).toBe(false);
            history[index].add(partner.id);
          }
        });
        if (roundIndex === 0) {
          await sync(0, "paused", null, 175_000, "conversation");
          const paused = await readClients();
          expectAssignments(paused, 0, "paused", null);
          expect(paused.every((view) =>
            view.remainingMs === 175_000 && view.previousPhase === "conversation",
          )).toBe(true);
          deadline = Date.now() + 175_000;
          await sync(0, "conversation", deadline);
          expectAssignments(await readClients(), 0, "conversation", deadline);
        }
        if (roundIndex < 7) {
          deadline = Date.now() + 30_000;
          await sync(roundIndex, "movement", deadline);
          expectAssignments(await readClients(), roundIndex + 1, "movement", deadline);
        }
      }
      expect(history.every((partners) =>
        partners.size >= 8 - (participantCount % 2) && partners.size <= 8,
      )).toBe(true);
      expect(history.reduce((total, partners) => total + partners.size, 0))
        .toBe(8 * (participantCount - (participantCount % 2)));
      expect(peopleOnBreak.size).toBe(8 * (participantCount % 2));
      expect(new Set(prompts.map(({ prompt }) => prompt)).size).toBe(8);
      await sync(7, "complete", null);
      const completed = await readClients();
      expect(completed.every((view) =>
        view.status === "complete" && view.phase === "complete",
      )).toBe(true);
      expect(peakInFlight).toBe(participantCount);
      console.info(`${requests} successful HTTP requests; ${participantCount} concurrent clients; 8 rounds.`);
    } finally {
      await post({ action: "close", code, hostSecret });
    }
  }, 30_000);
});
