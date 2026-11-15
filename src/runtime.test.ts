import { describe, expect, it } from "vitest";
import { DEFAULT_QUESTIONS, LEGACY_QUESTIONS } from "./domain";
import {
  createTimer,
  formatClock,
  pauseTimer,
  remainingTime,
  resumeTimer,
  timerAtDeadline,
} from "./timer";
import {
  createDefaultData,
  loadStoredData,
    migrateLegacyStorage,
  saveStoredData,
  STORAGE_KEY,
} from "./storage";

class MemoryStorage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("timestamp timer", () => {
  it("recovers remaining time from its deadline after a delayed tick", () => {
    const timer = createTimer("conversation", 60_000, 10_000);
    expect(remainingTime(timer, 25_250)).toBe(44_750);
    expect(timerAtDeadline(timer, 70_000)).toBe(true);
  });

  it("pauses and resumes using remaining time rather than interval counts", () => {
    const timer = createTimer("movement", 30_000, 100);
    const paused = pauseTimer(timer, 5_100);
    expect(paused.remainingMs).toBe(25_000);
    expect(remainingTime(paused, 100_000)).toBe(25_000);
    const resumed = resumeTimer(paused, 200_000);
    expect(resumed.deadline).toBe(225_000);
    expect(remainingTime(resumed, 205_000)).toBe(20_000);
  });

  it("formats a display clock without announcing every tick", () => {
    expect(formatClock(60_001)).toBe("01:01");
    expect(formatClock(0)).toBe("00:00");
  });
});

describe("local storage", () => {
  it("refreshes old built-in prompts while preserving edits, custom prompts, and disabled choices", () => {
    const storage = new MemoryStorage() as unknown as Storage;
    const data = createDefaultData();
    const edited = { ...LEGACY_QUESTIONS[1], prompt: "What is your favourite local cafe?" };
    const custom = { ...LEGACY_QUESTIONS[0], id: "custom-question", prompt: "What is your favourite noodle dish?", custom: true };
    data.questions = LEGACY_QUESTIONS.map((question) => ({ ...question }));
    data.questions[0].enabled = false;
    data.questions[1] = edited;
    data.questions.push(custom);
    data.settings = { ...data.settings, categories: ["Work and collaboration"], oddAttendanceMode: "trio" };
    storage.setItem(STORAGE_KEY, JSON.stringify(data));

    const loaded = loadStoredData(storage);
    expect(loaded.recovered).toBe(false);
    expect(loaded.data.questions[0]).toEqual({ ...DEFAULT_QUESTIONS[0], enabled: false });
    expect(loaded.data.questions[1]).toEqual(edited);
    expect(loaded.data.questions).toContainEqual(custom);
    expect(loaded.data.questions).toContainEqual(DEFAULT_QUESTIONS.at(-1));
    expect(loaded.data.settings.oddAttendanceMode).toBe("break");
    expect(loaded.data.settings.categories).toEqual(["Light and fun", "Getting to know you"]);
    expect(saveStoredData(loaded.data, storage)).toBe(true);
    expect(loadStoredData(storage).data).toEqual(loaded.data);
  });

  it("does not retain completed QR session participant data", () => {
    const storage = new MemoryStorage() as unknown as Storage;
    const data = createDefaultData();
    const person = { ...data.team[0], displayName: "Private Participant Name", team: "Private Team" };
    data.session = {
      id: "private-session", attendeeIds: [person.id], participants: [person], rounds: [], currentRound: 0,
      timer: { phase: "complete", deadline: null, remainingMs: 0 }, startedAt: 1_000,
      displayMode: "room", movementCompact: false, introSkipped: true, settings: { ...data.settings },
    };
    expect(saveStoredData(data, storage)).toBe(true);
    const saved = storage.getItem(STORAGE_KEY)!;
    expect(saved).not.toContain("Private Participant Name");
    expect(saved).not.toContain("Private Team");
    expect(JSON.parse(saved).session).toBeNull();
    expect(loadStoredData(storage).data.settings).toEqual(data.settings);
  });

  it("migrates legacy preferences and phone credentials without overwriting current data", () => {
    const storage = new MemoryStorage() as unknown as Storage;
    const data = createDefaultData();
    data.settings.rounds = 4;
    storage.setItem("pixel-pairs.app.v1", JSON.stringify(data));
    storage.setItem("pixel-pairs.host-room", "old-room");
    storage.setItem("meetup.host-room", "current-room");
    storage.setItem("pixel-pairs.phone.ROOM", "participant-id");
    expect(loadStoredData(storage).data.settings.rounds).toBe(4);
    migrateLegacyStorage(storage);
    expect(storage.getItem("meetup.host-room")).toBe("current-room");
    expect(storage.getItem("meetup.phone.ROOM")).toBe("participant-id");
    expect(storage.getItem("pixel-pairs.app.v1")).toBeNull();
    expect(storage.getItem("pixel-pairs.phone.ROOM")).toBeNull();
  });

  it("round-trips saved data with a versioned key", () => {
    const storage = new MemoryStorage() as unknown as Storage;
    const data = createDefaultData();
    expect(saveStoredData(data, storage)).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).toContain('"version":1');
    expect(loadStoredData(storage)).toEqual({ data, recovered: false });
  });

  it("clears malformed data and restores defaults once", () => {
    const storage = new MemoryStorage() as unknown as Storage;
    storage.setItem(STORAGE_KEY, "{not json");
    expect(loadStoredData(storage).recovered).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(loadStoredData(storage).recovered).toBe(false);
  });

  it("rejects structurally invalid data even when its JSON parses", () => {
    const storage = new MemoryStorage() as unknown as Storage;
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...createDefaultData(),
        team: [{ id: "broken", displayName: null }],
      }),
    );
    expect(loadStoredData(storage).recovered).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });
});
