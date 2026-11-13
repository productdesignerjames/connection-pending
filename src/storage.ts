import {
  DEFAULT_QUESTIONS,
  DEFAULT_SETTINGS,
  DEFAULT_TEAM,
  type ActiveTimer,
  type IcebreakerCategory,
  type IcebreakerQuestion,
  type Round,
  type SessionSettings,
  type StoredAppData,
  type TeamMember,
} from "./domain";

export const STORAGE_KEY = "meetup.app.v1";

export function migrateLegacyStorage(storage: Storage): void {
  const legacyPrefix = "pixel-pairs.";
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
  for (const key of keys) {
    if (!key?.startsWith(legacyPrefix)) continue;
    const nextKey = `meetup.${key.slice(legacyPrefix.length)}`;
    const value = storage.getItem(key);
    if (value !== null && storage.getItem(nextKey) === null) storage.setItem(nextKey, value);
    storage.removeItem(key);
  }
}

export function createDefaultData(): StoredAppData {
  return {
    version: 1,
    team: DEFAULT_TEAM,
    questions: DEFAULT_QUESTIONS,
    settings: DEFAULT_SETTINGS,
    attendeeIds: DEFAULT_TEAM.map((member) => member.id),
    session: null,
    displayMode: "room",
    soundVolume: DEFAULT_SETTINGS.soundVolume,
  };
}

const categories: IcebreakerCategory[] = [
  "Light and fun",
  "Getting to know you",
  "Work and collaboration",
  "Creative challenges",
  "Future and aspirations",
  "Team improvement",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTeamMember(value: unknown): value is TeamMember {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.displayName === "string" &&
    typeof value.avatarId === "string" &&
    typeof value.isActive === "boolean" &&
    typeof value.isOrganiser === "boolean" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isQuestion(value: unknown): value is IcebreakerQuestion {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.prompt === "string" &&
    categories.includes(value.category as IcebreakerCategory) &&
    typeof value.enabled === "boolean" &&
    typeof value.custom === "boolean"
  );
}

function isSettings(value: unknown): value is SessionSettings {
  return (
    isRecord(value) &&
    Number.isInteger(value.rounds) &&
    Number(value.rounds) >= 1 &&
    Number(value.rounds) <= 40 &&
    Number.isInteger(value.conversationMinutes) &&
    Number(value.conversationMinutes) >= 1 &&
    Number(value.conversationMinutes) <= 10 &&
    Number.isInteger(value.movementSeconds) &&
    Number(value.movementSeconds) >= 10 &&
    Number(value.movementSeconds) <= 120 &&
    typeof value.icebreakersEnabled === "boolean" &&
    Array.isArray(value.categories) &&
    value.categories.every((category) =>
      categories.includes(category as IcebreakerCategory),
    ) &&
    typeof value.soundEnabled === "boolean" &&
    typeof value.soundVolume === "number" &&
    value.soundVolume >= 0 &&
    value.soundVolume <= 1 &&
    typeof value.introEnabled === "boolean" &&
    typeof value.outroEnabled === "boolean" &&
    typeof value.organiserParticipates === "boolean" &&
    (value.oddAttendanceMode === "trio" ||
      value.oddAttendanceMode === "break") &&
    typeof value.autoAdvance === "boolean" &&
    typeof value.rememberAttendance === "boolean" &&
    typeof value.highContrast === "boolean"
  );
}

function isTimer(value: unknown): value is ActiveTimer {
  return (
    isRecord(value) &&
    ["intro", "conversation", "movement", "paused", "complete"].includes(
      String(value.phase),
    ) &&
    (value.deadline === null || typeof value.deadline === "number") &&
    typeof value.remainingMs === "number" &&
    value.remainingMs >= 0
  );
}

function isRound(value: unknown): value is Round {
  return (
    isRecord(value) &&
    Number.isInteger(value.number) &&
    Array.isArray(value.stations) &&
    value.stations.every(
      (station) =>
        isRecord(station) &&
        Number.isInteger(station.number) &&
        Array.isArray(station.participantIds) &&
        station.participantIds.every((id) => typeof id === "string") &&
        typeof station.stayingId === "string" &&
        Array.isArray(station.movingIds) &&
        station.movingIds.every((id) => typeof id === "string") &&
        ["pair", "trio", "break"].includes(String(station.kind)),
    ) &&
    Array.isArray(value.repeatedPairs) &&
    value.repeatedPairs.every(
      (pair) =>
        Array.isArray(pair) && pair.every((id) => typeof id === "string"),
    ) &&
    (value.question === undefined || isQuestion(value.question))
  );
}

function isSession(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    Array.isArray(value.attendeeIds) &&
    value.attendeeIds.every((id) => typeof id === "string") &&
    (value.participants === undefined ||
      (Array.isArray(value.participants) &&
        value.participants.every(isTeamMember))) &&
    Array.isArray(value.rounds) &&
    value.rounds.length > 0 &&
    value.rounds.every(isRound) &&
    Number.isInteger(value.currentRound) &&
    Number(value.currentRound) >= 0 &&
    Number(value.currentRound) < value.rounds.length &&
    isTimer(value.timer) &&
    (typeof value.startedAt === "number" || value.startedAt === null) &&
    (value.displayMode === "room" || value.displayMode === "focus") &&
    typeof value.movementCompact === "boolean" &&
    typeof value.introSkipped === "boolean" &&
    isSettings(value.settings)
  );
}

function isStoredAppData(value: unknown): value is StoredAppData {
  return (
    isRecord(value) &&
    value.version === 1 &&
    Array.isArray(value.team) &&
    value.team.every(isTeamMember) &&
    Array.isArray(value.questions) &&
    value.questions.every(isQuestion) &&
    isSettings(value.settings) &&
    Array.isArray(value.attendeeIds) &&
    value.attendeeIds.every((id) => typeof id === "string") &&
    (value.session === null || isSession(value.session)) &&
    (value.displayMode === "room" || value.displayMode === "focus") &&
    typeof value.soundVolume === "number" &&
    value.soundVolume >= 0 &&
    value.soundVolume <= 1
  );
}

export function loadStoredData(storage: Storage): {
  data: StoredAppData;
  recovered: boolean;
} {
  try {
    migrateLegacyStorage(storage);
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { data: createDefaultData(), recovered: false };
    const parsed: unknown = JSON.parse(raw);
    if (isStoredAppData(parsed)) return { data: parsed, recovered: false };
  } catch {
    // Restore defaults below when storage is unavailable or malformed.
  }

  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // The app remains usable for this visit even when storage is unavailable.
  }
  return { data: createDefaultData(), recovered: true };
}

export function saveStoredData(data: StoredAppData, storage: Storage): boolean {
  try {
    const stored = data.session?.participants && data.session.timer.phase === "complete"
      ? { ...data, session: null }
      : data;
    storage.setItem(STORAGE_KEY, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}
