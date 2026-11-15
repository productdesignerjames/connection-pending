import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUESTIONS,
  DEFAULT_SETTINGS,
  DEFAULT_TEAM,
  SIGNUP_TEAMS,
  avatarForName,
  calculateDurationSeconds,
  canMeet,
  generateRounds,
  generateMeetupRounds,
  isValidMeetupSchedule,
  pairingsForAttendees,
  selectQuestions,
  validateDisplayName,
} from "./domain";

const stableRandom = () => 0.37;

describe("default data", () => {
  it("starts with the supplied 38 people and at least 50 questions", () => {
    expect(DEFAULT_TEAM).toHaveLength(38);
    expect(DEFAULT_QUESTIONS.length).toBeGreaterThanOrEqual(50);
    expect(new Set(DEFAULT_TEAM.map((member) => member.displayName)).size).toBe(
      38,
    );
  });

  it("uses the recommended 8 x 3 minute format", () => {
    expect(DEFAULT_SETTINGS.rounds).toBe(8);
    expect(DEFAULT_SETTINGS.conversationMinutes).toBe(3);
    expect(DEFAULT_SETTINGS.movementSeconds).toBe(30);
    expect(calculateDurationSeconds(DEFAULT_SETTINGS)).toBe(1680);
  });

  it("keeps the organiser out unless explicitly included", () => {
    const selected = DEFAULT_TEAM.slice(0, 2).map((member) => member.id);
    expect(pairingsForAttendees(DEFAULT_TEAM, selected, false)).toHaveLength(2);
    expect(
      pairingsForAttendees(DEFAULT_TEAM, selected, true).at(-1)?.displayName,
    ).toBe("Kerry M");
  });

  it("assigns stable abstract avatars from display names", () => {
    expect(avatarForName("James H")).toEqual(avatarForName("James H"));
    expect(avatarForName("James H")).not.toEqual(avatarForName("James M"));
  });
});

describe("generateRounds", () => {
  it("rotates all 38 attendees through 19 numbered stations without repeats for eight rounds", () => {
    const ids = DEFAULT_TEAM.map((member) => member.id);
    const rounds = generateRounds(ids, 8, "trio", stableRandom);
    expect(rounds).toHaveLength(8);
    const pairs = new Set<string>();

    for (const round of rounds) {
      expect(round.stations).toHaveLength(19);
      expect(round.stations.every((station) => station.kind === "pair")).toBe(
        true,
      );
      expect(
        new Set(round.stations.flatMap((station) => station.participantIds))
          .size,
      ).toBe(38);
      expect(round.repeatedPairs).toEqual([]);
      for (const station of round.stations) {
        const key = [...station.participantIds].sort().join("::");
        expect(pairs.has(key)).toBe(false);
        pairs.add(key);
      }
    }
  });

  it("includes everyone in an odd group-of-three round", () => {
    const attendees = ["a", "b", "c", "d", "e"];
    const rounds = generateRounds(attendees, 4, "trio", stableRandom);
    const stayingIds = rounds[0].stations.map((station) => station.stayingId);
    for (const round of rounds) {
      expect(
        round.stations.flatMap((station) => station.participantIds).sort(),
      ).toEqual([...attendees].sort());
      expect(
        round.stations.filter((station) => station.kind === "trio"),
      ).toHaveLength(1);
      expect(
        round.stations.find((station) => station.kind === "trio")
          ?.participantIds,
      ).toHaveLength(3);
      expect(round.stations.map((station) => station.stayingId)).toEqual(
        stayingIds,
      );
    }
  });

  it("rotates a single break station without omitting the participant", () => {
    const attendees = ["a", "b", "c", "d", "e"];
    const rounds = generateRounds(attendees, 5, "break", stableRandom);
    const breakIds = rounds.map(
      (round) =>
        round.stations.find((station) => station.kind === "break")
          ?.participantIds[0],
    );
    expect(new Set(breakIds.slice(0, 3)).size).toBe(3);
    expect(new Set(breakIds).size).toBe(3);
    const stayingIds = rounds[0].stations
      .filter((station) => station.kind !== "break")
      .map((station) => station.stayingId);
    for (const round of rounds) {
      expect(
        round.stations
          .filter((station) => station.kind !== "break")
          .map((station) => station.stayingId),
      ).toEqual(stayingIds);
    }
    expect(
      rounds.every(
        (round) =>
          round.stations.flatMap((station) => station.participantIds).length ===
          5,
      ),
    ).toBe(true);
  });

  it("handles two attendees and rejects insufficient or duplicate input", () => {
    const rounds = generateRounds(["a", "b"], 3, "trio", stableRandom);
    expect(rounds).toHaveLength(3);
    expect(rounds[0].repeatedPairs).toEqual([]);
    expect(rounds[1].repeatedPairs).toHaveLength(1);
    expect(generateRounds(["a"], 2, "break", stableRandom)).toEqual([]);
    expect(
      generateRounds(
        ["a", "a", "b"],
        1,
        "trio",
        stableRandom,
      )[0].stations.flatMap((station) => station.participantIds),
    ).toHaveLength(2);
  });

  it("flags repeated pairings after the moving group rotation is exhausted", () => {
    const rounds = generateRounds(
      ["a", "b", "c", "d"],
      3,
      "trio",
      stableRandom,
    );
    expect(rounds[0].repeatedPairs).toEqual([]);
    expect(rounds[1].repeatedPairs).toEqual([]);
    expect(rounds[2].repeatedPairs.length).toBeGreaterThan(0);
  });

  it("keeps staying participants at their stations while the moving side rotates", () => {
    const rounds = generateRounds(
      ["a", "b", "c", "d", "e", "f", "g", "h"],
      4,
      "trio",
      stableRandom,
    );
    const startingStays = rounds[0].stations.map(
      (station) => station.stayingId,
    );
    for (const round of rounds) {
      expect(round.stations.map((station) => station.stayingId)).toEqual(
        startingStays,
      );
    }
    for (
      let stationIndex = 0;
      stationIndex < startingStays.length;
      stationIndex += 1
    ) {
      expect(
        new Set(
          rounds.map((round) => round.stations[stationIndex].movingIds[0]),
        ).size,
      ).toBe(4);
    }
  });

  it("scales to larger groups without dropping attendees", () => {
    const attendees = Array.from(
      { length: 100 },
      (_, index) => `person-${index}`,
    );
    const rounds = generateRounds(attendees, 8, "trio", stableRandom);
    expect(rounds).toHaveLength(8);
    expect(rounds.every((round) => round.stations.length === 50)).toBe(true);
    expect(
      rounds.every(
        (round) =>
          new Set(round.stations.flatMap((station) => station.participantIds))
            .size === 100,
      ),
    ).toBe(true);
    expect(rounds.every((round) => round.repeatedPairs.length === 0)).toBe(
      true,
    );
  });
});

describe("team-aware meetup rounds", () => {
  it.each([1, 42, 2026])(
    "matches 36 people over eight rounds without restricted or repeat meetings (seed %i)",
    (seed) => {
      const people = Array.from({ length: 36 }, (_, index) => ({
        id: `person-${index}`,
        team: SIGNUP_TEAMS[index % SIGNUP_TEAMS.length],
        role: index === 0
          ? "Director of design"
          : index <= 4
            ? "Lead designer"
            : index % 3 === 0
              ? "Senior designer"
              : "Product designer",
      }));
      let state = seed;
      const random = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 2 ** 32;
      };
      const rounds = generateMeetupRounds(people, 8, random);
      const seen = new Set<string>();
      expect(rounds).toHaveLength(8);
      for (const round of rounds) {
        expect(round.stations).toHaveLength(18);
        expect(round.sameTeamPairs).toEqual([]);
        expect(round.repeatedPairs).toEqual([]);
        expect(round.stations.flatMap((station) => station.participantIds).sort())
          .toEqual(people.map((person) => person.id).sort());
        for (const station of round.stations) {
          expect(station.kind).toBe("pair");
          const [firstId, secondId] = station.participantIds;
          const first = people.find((person) => person.id === firstId)!;
          const second = people.find((person) => person.id === secondId)!;
          expect(first.team).not.toBe(second.team);
          expect(
            [first.role, second.role].includes("Director of design") &&
            [first.role, second.role].includes("Lead designer"),
          ).toBe(false);
          const key = [firstId, secondId].sort().join(":");
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
      }
      expect(seen.size).toBe(144);
    },
  );

  it("avoids matching balanced teams across every round", () => {
    const people = Array.from({ length: 8 }, (_, index) => ({
      id: `person-${index}`,
      team: index < 4 ? "Sales" : "Design",
    }));
    const rounds = generateMeetupRounds(people, 4, stableRandom);
    expect(rounds).toHaveLength(4);
    for (const round of rounds) {
      expect(round.sameTeamPairs).toEqual([]);
      expect(
        round.stations.flatMap((station) => station.participantIds).sort(),
      ).toEqual(people.map((person) => person.id).sort());
    }
    expect(rounds[1].repeatedPairs).toEqual([]);
  });

  it("rotates the odd-person break without creating trios", () => {
    const people = ["Sales", " sales ", "Design", "Design", "Support"].map(
      (team, index) => ({ id: `person-${index}`, team }),
    );
    const rounds = generateMeetupRounds(people, 3, stableRandom);
    const breaks = new Set<string>();
    expect(rounds[0].sameTeamPairs).toEqual([]);
    for (const round of rounds) {
      expect(round.stations.filter((station) => station.kind === "trio")).toHaveLength(0);
      expect(round.stations.filter((station) => station.kind === "pair")).toHaveLength(2);
      const resting = round.stations.filter((station) => station.kind === "break");
      expect(resting).toHaveLength(1);
      expect(breaks.has(resting[0].participantIds[0])).toBe(false);
      breaks.add(resting[0].participantIds[0]);
      expect(round.repeatedPairs).toEqual([]);
      expect(
        new Set(round.stations.flatMap((station) => station.participantIds))
          .size,
      ).toBe(5);
    }
  });

  it("refuses a full round when one team outnumbers all other teams", () => {
    const people = [
      "Sales",
      " sales ",
      "Sales",
      "Sales",
      "Design",
      "Design",
    ].map((team, index) => ({ id: `person-${index}`, team }));
    expect(generateMeetupRounds(people, 4, stableRandom)).toEqual([]);
  });

  it("caps two teams of two at two rounds instead of matching teammates", () => {
    const people = [
      { id: "a1", team: "A" },
      { id: "a2", team: "A" },
      { id: "b1", team: "B" },
      { id: "b2", team: "B" },
    ];
    const rounds = generateMeetupRounds(people, 4, stableRandom);
    expect(rounds).toHaveLength(2);
    expect(isValidMeetupSchedule(people, rounds)).toBe(true);
  });

  it("returns no rounds when director–lead restrictions prevent every pairing", () => {
    const rounds = generateMeetupRounds([
      { id: "director", team: "App", role: "Director of design" },
      { id: "lead", team: " app ", role: "Lead designer" },
    ], 2, stableRandom);
    expect(rounds).toEqual([]);
  });

  it("never pairs directors with leads", () => {
    const people = [
      { id: "director", team: "A", role: "Director of design" },
      { id: "lead", team: "B", role: "Lead designer" },
      { id: "senior", team: "C", role: "Senior designer" },
      { id: "designer", team: "D", role: "Product designer" },
      { id: "other-lead", team: "E", role: "Lead designer" },
    ];
    const seen = new Set<string>();
    for (const round of generateMeetupRounds(people, 6, stableRandom)) {
      expect(round.stations.flatMap((station) => station.participantIds).sort())
        .toEqual(people.map((person) => person.id).sort());
      for (const station of round.stations) {
        station.participantIds.forEach((id, index) => {
          for (const otherId of station.participantIds.slice(index + 1)) {
            const first = people.find((person) => person.id === id)!;
            const second = people.find((person) => person.id === otherId)!;
            expect(canMeet(first, second)).toBe(true);
            const key = [id, otherId].sort().join(":");
            expect(seen.has(key)).toBe(false);
            seen.add(key);
          }
        });
      }
    }
    expect(canMeet({ role: " design director " }, { role: " LEAD designer " })).toBe(false);
    expect(canMeet({ role: "Lead designer" }, { role: "Director of design" })).toBe(false);
    expect(canMeet({ team: " Design   system " }, { team: "design system" })).toBe(false);
    expect(canMeet({ role: "Director of design" }, { role: "Product designer" })).toBe(true);
  });

  it("stops rather than adding empty rounds after eligible connections are exhausted", () => {
    const rounds = generateMeetupRounds([
      { id: "first", team: "A" },
      { id: "second", team: "B" },
    ], 2, stableRandom);
    expect(rounds[0].stations[0].kind).toBe("pair");
    expect(rounds).toHaveLength(1);
  });

  it.each([
    { teams: ["A", "B", "C", "D"], expected: 3 },
    { teams: ["A", "B", "C", "D", "E"], expected: 5 },
    { teams: ["A", "A", "A", "B", "B"], expected: 3 },
  ])("calculates $expected complete rounds for $teams", ({ teams, expected }) => {
    const people = teams.map((team, index) => ({ id: `person-${index}`, team }));
    const rounds = generateMeetupRounds(people, 40, stableRandom);
    expect(rounds).toHaveLength(expected);
    expect(isValidMeetupSchedule(people, rounds)).toBe(true);
  });

  it("accounts for role restrictions and incompatible odd components", () => {
    const people = ["Director of design", "Lead designer", "Product designer", "Product designer"]
      .map((role, index) => ({ id: `person-${index}`, team: `team-${index}`, role }));
    expect(generateMeetupRounds(people, 40, stableRandom)).toHaveLength(2);
    const disconnected = Array.from({ length: 6 }, (_, index) => ({
      id: `person-${index}`,
      team: `team-${index}`,
      role: index < 3 ? "Director of design" : "Lead designer",
    }));
    expect(generateMeetupRounds(disconnected, 40, stableRandom)).toEqual([]);
  });

  it("plans the supported 40 rounds for 100 balanced attendees", () => {
    const people = Array.from({ length: 100 }, (_, index) => ({
      id: `person-${index}`, team: SIGNUP_TEAMS[index % SIGNUP_TEAMS.length],
    }));
    const rounds = generateMeetupRounds(people, 40, stableRandom);
    expect(rounds).toHaveLength(40);
    expect(isValidMeetupSchedule(people, rounds)).toBe(true);
  });

  it("treats missing team values as unrestricted and handles small rooms", () => {
    expect(
      generateMeetupRounds(
        [{ id: "first" }, { id: "second", team: "" }],
        2,
        stableRandom,
      )[0].sameTeamPairs,
    ).toEqual([]);
    expect(generateMeetupRounds([{ id: "first" }], 2)).toEqual([]);
  });
});

describe("question selection", () => {
  it("filters by category and does not repeat prompts", () => {
    const questions = [
      ...DEFAULT_QUESTIONS,
      {
        ...DEFAULT_QUESTIONS[0],
        id: "duplicate",
        prompt: DEFAULT_QUESTIONS[0].prompt.toUpperCase(),
      },
    ];
    const selected = selectQuestions(
      questions,
      ["Light and fun"],
      8,
      stableRandom,
    );
    expect(selected).toHaveLength(8);
    expect(
      selected.every((question) => question.category === "Light and fun"),
    ).toBe(true);
    expect(
      new Set(selected.map((question) => question.prompt.toLowerCase())).size,
    ).toBe(8);
  });
});

describe("name validation", () => {
  it("normalises whitespace and identifies duplicate display names", () => {
    expect(validateDisplayName("  James   H ", DEFAULT_TEAM)).toBe(
      "James H is already on the team.",
    );
    expect(validateDisplayName("Kerry M", DEFAULT_TEAM)).toBeNull();
    expect(validateDisplayName("James", DEFAULT_TEAM)).toContain("first name");
  });
});
