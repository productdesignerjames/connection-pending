import { describe, expect, it } from "vitest";
import { generateRounds, generateMeetupRounds } from "./domain";
import {
  getPairAppearance,
  getParticipantAppearance,
  handleRoomRequest,
  MemoryRoomStore,
  PAIR_SYMBOLS,
  ROOM_SIGNUP_MS,
} from "./rooms";

function request(method: string, url: string, body?: unknown): Request {
  return new Request(
    `https://pixel-pairs.test/.netlify/functions/rooms${url}`,
    {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    },
  );
}

describe("temporary shared room", () => {
  it("retains signup roles for phone and manually added participants", async () => {
    const store = new MemoryRoomStore();
    const created = await handleRoomRequest(
      request("POST", "", { action: "create" }), store, 1_000,
    );
    const { code, hostSecret } = await created.json();
    for (const action of ["join", "add-manual"]) {
      const response = await handleRoomRequest(request("POST", "", {
        action, code, hostSecret, displayName: "Alex Roberts",
        team: "App team", role: "Director of design",
      }), store, 2_000);
      expect(response.status).toBe(201);
      expect((await response.json()).participant).toMatchObject({
        team: "App team", role: "Director of design",
      });
    }
    const invalid = await handleRoomRequest(request("POST", "", {
      action: "join", code, displayName: "Sam Test", role: "Unknown role",
    }), store, 2_000);
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error).toBe("Choose a role from the list.");
  });

  it("lets the host add participants after phone signup closes", async () => {
    const store = new MemoryRoomStore();
    const created = await handleRoomRequest(
      request("POST", "", { action: "create" }),
      store,
      1_000,
    );
    const { code, hostSecret } = await created.json();
    const now = 1_000 + ROOM_SIGNUP_MS + 1;

    const denied = await handleRoomRequest(
      request("POST", "", {
        action: "add-manual",
        code,
        hostSecret: "wrong",
        displayName: "Alex Roberts",
      }),
      store,
      now,
    );
    expect(denied.status).toBe(403);

    const added = await Promise.all(
      ["Alex Roberts", "Jordan Thompson", "Sam Patel"].map((displayName) =>
        handleRoomRequest(
          request("POST", "", {
            action: "add-manual",
            code,
            hostSecret,
            displayName,
          }),
          store,
          now,
        ),
      ),
    );
    expect(added.map((response) => response.status)).toEqual([201, 201, 201]);
    const participants = await Promise.all(
      added.map(async (response) => (await response.json()).participant),
    );

    const closedPhoneJoin = await handleRoomRequest(
      request("POST", "", { action: "join", code, displayName: "Phone User" }),
      store,
      now,
    );
    expect(closedPhoneJoin.status).toBe(409);

    const started = await handleRoomRequest(
      request("POST", "", {
        action: "start",
        code,
        hostSecret,
        rounds: generateRounds(
          participants.map((participant) => participant.id),
          1,
          "trio",
        ),
        phase: "conversation",
        deadline: now + 180_000,
      }),
      store,
      now,
    );
    expect(started.status).toBe(200);

    const lateManualAdd = await handleRoomRequest(
      request("POST", "", {
        action: "add-manual",
        code,
        hostSecret,
        displayName: "Late Addition",
      }),
      store,
      now,
    );
    expect(lateManualAdd.status).toBe(409);
  });

  it("lets only the host extend signup, reopens expired signup, and refuses live extensions", async () => {
    const store = new MemoryRoomStore();
    const created = await handleRoomRequest(
      request("POST", "", { action: "create" }),
      store,
      1_000,
    );
    const { code, hostSecret, room: original } = await created.json();
    const first = await handleRoomRequest(
      request("POST", "", {
        action: "join",
        code,
        displayName: "Alex Roberts",
      }),
      store,
      2_000,
    );
    const firstId = (await first.json()).participant.id;
    const denied = await handleRoomRequest(
      request("POST", "", {
        action: "extend-signup",
        code,
        hostSecret: "wrong",
      }),
      store,
      3_000,
    );
    expect(denied.status).toBe(403);
    const extended = await handleRoomRequest(
      request("POST", "", { action: "extend-signup", code, hostSecret }),
      store,
      4_000,
    );
    expect((await extended.json()).room.signupEndsAt).toBe(
      original.signupEndsAt + 60_000,
    );
    const phone = await handleRoomRequest(
      request("GET", `?code=${code}&participant=${firstId}`),
      store,
      5_000,
    );
    expect((await phone.json()).view.deadline).toBe(
      original.signupEndsAt + 60_000,
    );
    const now = original.signupEndsAt + 90_000;
    const reopened = await handleRoomRequest(
      request("POST", "", { action: "extend-signup", code, hostSecret }),
      store,
      now,
    );
    expect((await reopened.json()).room.signupEndsAt).toBe(now + 60_000);
    const second = await handleRoomRequest(
      request("POST", "", {
        action: "join",
        code,
        displayName: "Jordan Thompson",
      }),
      store,
      now + 1_000,
    );
    expect(second.status).toBe(201);
    const secondId = (await second.json()).participant.id;
    const third = await handleRoomRequest(
      request("POST", "", { action: "join", code, displayName: "Sam Patel" }),
      store,
      now + 1_000,
    );
    const thirdId = (await third.json()).participant.id;
    const started = await handleRoomRequest(
      request("POST", "", {
        action: "start",
        code,
        hostSecret,
        rounds: generateRounds([firstId, secondId, thirdId], 1, "trio"),
        phase: "conversation",
        deadline: now + 180_000,
      }),
      store,
      now + 2_000,
    );
    expect(started.status).toBe(200);
    const live = await handleRoomRequest(
      request("POST", "", { action: "extend-signup", code, hostSecret }),
      store,
      now + 3_000,
    );
    expect(live.status).toBe(409);
  });

  it("supports QR signup, paired phone views, host sync, and expiry", async () => {
    const store = new MemoryRoomStore();
    const createdResponse = await handleRoomRequest(
      request("POST", "", { action: "create" }),
      store,
      1_000,
    );
    const { code, hostSecret } = await createdResponse.json();
    expect(createdResponse.status).toBe(200);

    const firstJoin = await handleRoomRequest(
      request("POST", "", {
        action: "join",
        code: code.toUpperCase(),
        displayName: "Morgan T",
      }),
      store,
      2_000,
    );
    const first = await firstJoin.json();
    const secondJoin = await handleRoomRequest(
      request("POST", "", { action: "join", code, displayName: "Taylor K" }),
      store,
      3_000,
    );
    const second = await secondJoin.json();

    expect(firstJoin.status).toBe(201);
    expect(secondJoin.status).toBe(201);

    const tooSmall = await handleRoomRequest(
      request("POST", "", {
        action: "start",
        code,
        hostSecret,
        rounds: generateRounds(
          [first.participant.id, second.participant.id],
          1,
          "trio",
        ),
        phase: "conversation",
        deadline: 180_000,
      }),
      store,
      4_000,
    );
    expect(tooSmall.status).toBe(409);
    expect((await tooSmall.json()).error).toContain("3 people");
    const thirdJoin = await handleRoomRequest(
      request("POST", "", { action: "join", code, displayName: "Casey Brown" }),
      store,
      4_000,
    );
    const fourthJoin = await handleRoomRequest(
      request("POST", "", { action: "join", code, displayName: "Riley Jones" }),
      store,
      4_000,
    );
    const third = await thirdJoin.json();
    const fourth = await fourthJoin.json();

    const ids = [
      first.participant.id as string,
      second.participant.id as string,
    ];
    const rounds = generateRounds(
      [ids[0], third.participant.id, ids[1], fourth.participant.id],
      2,
      "break",
      () => 0.1,
      false,
    );
    rounds[0].question = {
      id: "question-test",
      category: "Light and fun",
      prompt: "What is a small thing that made you smile recently?",
      enabled: true,
      custom: false,
    };
    const started = await handleRoomRequest(
      request("POST", "", {
        action: "start",
        code,
        hostSecret,
        rounds,
        phase: "conversation",
        deadline: 180_000,
      }),
      store,
      5_000,
    );
    expect(started.status).toBe(200);

    const firstViewResponse = await handleRoomRequest(
      request("GET", `?code=${code}&participant=${ids[0]}`),
      store,
      6_000,
    );
    const firstView = await firstViewResponse.json();
    const secondViewResponse = await handleRoomRequest(
      request("GET", `?code=${code}&participant=${ids[1]}`),
      store,
      6_000,
    );
    const secondView = await secondViewResponse.json();
    expect(firstView.view.assignment.partnerNames).toEqual(["Taylor K"]);
    expect(secondView.view.assignment.partnerNames).toEqual(["Morgan T"]);
    expect(firstView.view.question).toEqual({
      category: "Light and fun",
      prompt: "What is a small thing that made you smile recently?",
    });
    expect(firstView.view.assignment.symbol).toBe(
      secondView.view.assignment.symbol,
    );
    expect(firstView.view.deadline).toBe(180_000);
    expect(firstView.view.assignment.background).toBe(
      secondView.view.assignment.background,
    );
    expect(firstView.view.assignment.foreground).toBe(
      secondView.view.assignment.foreground,
    );

    const hostView = await handleRoomRequest(
      new Request(
        `https://pixel-pairs.test/.netlify/functions/rooms?code=${code}`,
        {
          headers: { "x-host-secret": hostSecret },
        },
      ),
      store,
      7_000,
    );
    expect((await hostView.json()).room.participants).toHaveLength(4);

    const lateJoin = await handleRoomRequest(
      request("POST", "", { action: "join", code, displayName: "Late C" }),
      store,
      1_000 + ROOM_SIGNUP_MS + 1,
    );
    expect(lateJoin.status).toBe(409);

    const expired = await handleRoomRequest(
      request("GET", `?code=${code}`),
      store,
      5_000 + 2 * 60 * 60 * 1000 + 1,
    );
    expect(expired.status).toBe(410);
    expect(await store.get(code)).toBeNull();
  });

  it("shares matching icons and colours while finding partners and moving to the next round", async () => {
    const store = new MemoryRoomStore();
    const created = await handleRoomRequest(
      request("POST", "", { action: "create" }),
      store,
      1_000,
    );
    const { code, hostSecret } = await created.json();
    for (const [index, team] of [
      " Sales ",
      "sales",
      "Design",
      "Design",
    ].entries()) {
      const joined = await handleRoomRequest(
        request("POST", "", {
          action: "join",
          code,
          displayName: `Person${index}`,
          team,
        }),
        store,
        2_000,
      );
      expect((await joined.json()).participant.team).toBe(team.trim());
    }
    const people = (await store.get(code))!.participants;
    const rounds = generateMeetupRounds(people, 2, () => 0.37);
    await handleRoomRequest(
      request("POST", "", {
        action: "start",
        code,
        hostSecret,
        rounds,
        phase: "intro",
        deadline: 32_000,
      }),
      store,
      3_000,
    );
    const participantId = rounds[0].stations[0].participantIds[0];
    const view = async () =>
      (
        await (
          await handleRoomRequest(
            request("GET", `?code=${code}&participant=${participantId}`),
            store,
            4_000,
          )
        ).json()
      ).view;
    const initial = await view();
    expect(initial.phase).toBe("intro");
    expect(initial.assignmentRound).toBe(0);
    expect(initial.assignment).toMatchObject(getPairAppearance(1));
    expect(initial.deadline).toBe(32_000);
    await handleRoomRequest(
      request("POST", "", {
        action: "sync",
        code,
        hostSecret,
        currentRound: 0,
        phase: "paused",
        previousPhase: "intro",
        deadline: null,
        remainingMs: 12_000,
      }),
      store,
      4_000,
    );
    const paused = await view();
    expect(paused.assignment).toEqual(initial.assignment);
    expect(paused.remainingMs).toBe(12_000);
    await handleRoomRequest(
      request("POST", "", {
        action: "sync",
        code,
        hostSecret,
        currentRound: 0,
        phase: "movement",
        deadline: 60_000,
      }),
      store,
      4_000,
    );
    const moving = await view();
    const station = rounds[1].stations.find((item) =>
      item.participantIds.includes(participantId),
    )!;
    expect(moving.assignmentRound).toBe(1);
    expect(moving.assignment).toMatchObject(getPairAppearance(station.number));
    expect(moving.assignment.partnerNames).toEqual(
      station.participantIds
        .filter((id) => id !== participantId)
        .map((id) => people.find((person) => person.id === id)!.displayName),
    );
    expect(new Set(PAIR_SYMBOLS).size).toBe(PAIR_SYMBOLS.length);
    expect(getPairAppearance(1).symbol).not.toBe(getPairAppearance(2).symbol);
    expect(getPairAppearance(1).background).not.toBe(
      getPairAppearance(2).background,
    );
    const invalidTeam = await handleRoomRequest(
      request("POST", "", {
        action: "join",
        code,
        displayName: "Invalid",
        team: "x".repeat(51),
      }),
      store,
      4_000,
    );
    expect(invalidTeam.status).toBe(400);
  });

  it("keeps all 38 personal identities fixed across round changes", async () => {
    const store = new MemoryRoomStore();
    const created = await handleRoomRequest(
      request("POST", "", { action: "create" }),
      store,
      1_000,
    );
    const { code, hostSecret } = await created.json();
    for (let index = 0; index < 38; index += 1) {
      const response = await handleRoomRequest(
        request("POST", "", {
          action: "join",
          code,
          displayName: `Person${index} Surname${index}`,
          team: `Team ${index % 4}`,
        }),
        store,
        2_000,
      );
      expect(response.status).toBe(201);
    }
    const people = (await store.get(code))!.participants;
    expect(new Set(people.map((person) => person.identity!.symbol)).size).toBe(
      38,
    );
    const rounds = generateMeetupRounds(people, 8, () => 0.37);
    await handleRoomRequest(
      request("POST", "", {
        action: "start",
        code,
        hostSecret,
        rounds,
        phase: "intro",
        deadline: 32_000,
      }),
      store,
      3_000,
    );
    for (let round = 0; round < 8; round += 1) {
      await handleRoomRequest(
        request("POST", "", {
          action: "sync",
          code,
          hostSecret,
          currentRound: round,
          phase: "conversation",
          deadline: 100_000,
        }),
        store,
        4_000,
      );
      for (const [index, person] of people.entries()) {
        const response = await handleRoomRequest(
          request("GET", `?code=${code}&participant=${person.id}`),
          store,
          5_000,
        );
        const { view } = await response.json();
        expect(view.identity).toEqual(getParticipantAppearance(index));
        expect(view.participant.displayName).toBe(
          `Person${index} Surname${index}`,
        );
        expect(view.assignment.partners).toHaveLength(1);
        const partner = people.find(
          (candidate) => candidate.id === view.assignment.partners[0].id,
        )!;
        expect(view.assignment.partners[0]).toMatchObject({
          displayName: partner.displayName,
          team: partner.team,
          identity: partner.identity,
        });
      }
    }
  });

  it("preserves full surnames and numbers identical full names", async () => {
    const store = new MemoryRoomStore();
    const created = await handleRoomRequest(
      request("POST", "", { action: "create" }),
      store,
      1_000,
    );
    const { code } = await created.json();
    const ids: string[] = [];
    for (const displayName of [
      "Alex",
      "alex",
      "Alex",
      "Alex Roberts",
      "Alex K",
    ]) {
      const response = await handleRoomRequest(
        request("POST", "", { action: "join", code, displayName }),
        store,
        2_000,
      );
      expect(response.status).toBe(201);
      ids.push((await response.json()).participant.id);
    }
    expect(
      (await store.get(code))?.participants.map((person) => person.displayName),
    ).toEqual(["Alex 1", "Alex 2", "Alex 3", "Alex Roberts", "Alex K"]);
    const phone = await handleRoomRequest(
      request("GET", `?code=${code}&participant=${ids[0]}`),
      store,
      3_000,
    );
    expect((await phone.json()).view.participant.displayName).toBe("Alex 1");
    const duplicateInitial = await handleRoomRequest(
      request("POST", "", {
        action: "join",
        code,
        displayName: "alex roberts",
      }),
      store,
      4_000,
    );
    expect((await duplicateInitial.json()).participant.displayName).toBe(
      "Alex Roberts 2",
    );
    expect((await store.get(code))?.participants[3].displayName).toBe(
      "Alex Roberts 1",
    );
  });
});
