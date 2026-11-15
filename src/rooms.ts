import type {
  IcebreakerQuestion,
  ParticipantIdentity,
  Round,
} from "./domain.js";
import { SIGNUP_ROLES, isValidMeetupSchedule } from "./domain.js";

export const ROOM_SIGNUP_MS = 3 * 60 * 1000;
export const MIN_ROOM_PARTICIPANTS = 3;
export const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
export const ROOM_ENDPOINT = "/.netlify/functions/rooms";

export const PAIR_SYMBOLS = [
  "Star",
  "Heart",
  "Sun",
  "Moon",
  "Cloud",
  "Umbrella",
  "Lightning",
  "Flame",
  "Leaf",
  "Flower",
  "Tree",
  "Mountain",
  "Waves",
  "Anchor",
  "Apple",
  "Cherry",
  "Carrot",
  "Coffee",
  "Pizza",
  "Music",
  "Headphones",
  "Camera",
  "Gift",
  "Key",
  "Bicycle",
  "Rocket",
  "Plane",
  "Crown",
  "Diamond",
  "Lightbulb",
  "Book",
  "Compass",
  "Bell",
  "Briefcase",
  "Globe",
  "Laptop",
  "Puzzle",
  "Ticket",
  "Watch",
  "Trophy",
] as const;

const PAIR_COLORS = [
  { background: "#dcefe5", foreground: "#164d39" },
  { background: "#ffe0db", foreground: "#7a2922" },
  { background: "#fff0b8", foreground: "#5c4500" },
  { background: "#dbeaff", foreground: "#214875" },
  { background: "#f8ddec", foreground: "#75264f" },
  { background: "#cceff0", foreground: "#165157" },
  { background: "#ece5f6", foreground: "#493368" },
  { background: "#e7efc8", foreground: "#3b4e1c" },
] as const;

export function getPairAppearance(stationNumber: number) {
  const index = Math.max(0, stationNumber - 1);
  return {
    symbol: PAIR_SYMBOLS[index % PAIR_SYMBOLS.length],
    ...PAIR_COLORS[index % PAIR_COLORS.length],
  };
}

export function getParticipantAppearance(index: number): ParticipantIdentity {
  return { ...getPairAppearance(index + 1), number: index + 1 };
}

export interface RoomParticipant {
  id: string;
  displayName: string;
  nameBase?: string;
  team?: string;
  role?: string;
  identity?: ParticipantIdentity;
  joinedAt: number;
}

export type SharedRoomPhase =
  "signup" | "intro" | "conversation" | "movement" | "paused" | "complete";

export interface SharedRoom {
  code: string;
  hostSecret: string;
  createdAt: number;
  signupEndsAt: number;
  expiresAt: number;
  status: "lobby" | "live" | "complete";
  phase: SharedRoomPhase;
  participants: RoomParticipant[];
  rounds: Round[];
  currentRound: number;
  deadline: number | null;
  remainingMs: number;
  previousPhase?: "intro" | "conversation" | "movement";
}

export interface PhoneRoomView {
  status: SharedRoom["status"];
  phase: SharedRoomPhase;
  signupEndsAt: number;
  participantCount: number;
  participant: RoomParticipant;
  identity: ParticipantIdentity;
  currentRound: number;
  assignmentRound: number;
  totalRounds: number;
  deadline: number | null;
  remainingMs: number;
  previousPhase?: "intro" | "conversation" | "movement";
  question?: Pick<IcebreakerQuestion, "category" | "prompt">;
  assignment: {
    symbol: string;
    background: string;
    foreground: string;
    partnerNames: string[];
    partners: {
      id: string;
      displayName: string;
      team?: string;
      identity: ParticipantIdentity;
    }[];
    break: boolean;
    activity?: string;
  } | null;
}

export interface RoomStore {
  get(code: string): Promise<SharedRoom | null>;
  set(room: SharedRoom): Promise<void>;
  delete(code: string): Promise<void>;
}

export class MemoryRoomStore implements RoomStore {
  private rooms = new Map<string, SharedRoom>();

  async get(code: string): Promise<SharedRoom | null> {
    return this.rooms.get(code) ?? null;
  }

  async set(room: SharedRoom): Promise<void> {
    this.rooms.set(room.code, room);
  }

  async delete(code: string): Promise<void> {
    this.rooms.delete(code);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function getValidRoom(
  code: string,
  store: RoomStore,
  now: number,
): Promise<SharedRoom | Response> {
  if (!/^[a-z0-9]{6,12}$/i.test(code))
    return json({ error: "Room not found." }, 404);
  const room = await store.get(code);
  if (!room || room.expiresAt <= now) {
    if (room) await store.delete(code);
    return json({ error: "This session link has expired." }, 410);
  }
  return room;
}

function phoneView(
  room: SharedRoom,
  participant: RoomParticipant,
): PhoneRoomView {
  const isMovement =
    room.phase === "movement" ||
    (room.phase === "paused" && room.previousPhase === "movement");
  const displayRound = isMovement
    ? Math.min(room.currentRound + 1, room.rounds.length - 1)
    : room.currentRound;
  const round = room.rounds[displayRound];
  const station = round?.stations.find((item) =>
    item.participantIds.includes(participant.id),
  );
  const partners = (station?.participantIds ?? [])
    .filter((id) => id !== participant.id)
    .map((id) => room.participants.find((person) => person.id === id))
    .filter((person): person is RoomParticipant => !!person);
  return {
    status: room.status,
    phase: room.phase,
    signupEndsAt: room.signupEndsAt,
    participantCount: room.participants.length,
    participant,
    identity:
      participant.identity ??
      getParticipantAppearance(room.participants.indexOf(participant)),
    currentRound: room.currentRound,
    assignmentRound: displayRound,
    totalRounds: room.rounds.length,
    deadline: room.deadline,
    remainingMs: room.remainingMs,
    previousPhase: room.previousPhase,
    question: round?.question
      ? {
          category: round.question.category,
          prompt: round.question.prompt,
        }
      : undefined,
    assignment: station
      ? {
          ...getPairAppearance(station.number),
          partnerNames: partners.map((person) => person.displayName),
          partners: partners.map((person) => ({
            id: person.id,
            displayName: person.displayName,
            team: person.team,
            identity:
              person.identity ??
              getParticipantAppearance(room.participants.indexOf(person)),
          })),
          break: station.kind === "break",
          activity: station.activity,
        }
      : null,
  };
}

export async function handleRoomRequest(
  request: Request,
  store: RoomStore,
  now = Date.now(),
): Promise<Response> {
  const url = new URL(request.url);
  const body =
    request.method === "POST"
      ? ((await request.json().catch(() => null)) as Record<
          string,
          unknown
        > | null)
      : null;
  const action = typeof body?.action === "string" ? body.action : "get";

  if (request.method === "POST" && action === "create") {
    const code = crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 8)
      .toLowerCase();
    const hostSecret = crypto.randomUUID().replace(/-/g, "");
    const room: SharedRoom = {
      code,
      hostSecret,
      createdAt: now,
      signupEndsAt: now + ROOM_SIGNUP_MS,
      expiresAt: now + ROOM_TTL_MS,
      status: "lobby",
      phase: "signup",
      participants: [],
      rounds: [],
      currentRound: 0,
      deadline: now + ROOM_SIGNUP_MS,
      remainingMs: ROOM_SIGNUP_MS,
    };
    await store.set(room);
    return json({ code, hostSecret, room });
  }

  const code = (
    typeof body?.code === "string"
      ? body.code
      : (url.searchParams.get("code") ?? "")
  ).toLowerCase();
  const roomResult = await getValidRoom(code, store, now);
  if (roomResult instanceof Response) return roomResult;
  const room = roomResult;

  const registerParticipant = (displayName: string, team: string, role: string) => {
    const participant: RoomParticipant = {
      id: crypto.randomUUID().replace(/-/g, ""),
      displayName,
      nameBase: displayName,
      team: team || undefined,
      role: role || undefined,
      identity: getParticipantAppearance(room.participants.length),
      joinedAt: now,
    };
    room.participants.push(participant);
    const matchingNames = room.participants.filter(
      (person) =>
        (person.nameBase ?? person.displayName).toLocaleLowerCase() ===
        displayName.toLocaleLowerCase(),
    );
    if (matchingNames.length > 1) {
      const base = matchingNames[0].nameBase ?? matchingNames[0].displayName;
      matchingNames.forEach((person, index) => {
        person.nameBase = base;
        person.displayName = `${base} ${index + 1}`;
      });
    }
    return participant;
  };

  if (request.method === "POST" && action === "extend-signup") {
    if (body?.hostSecret !== room.hostSecret)
      return json({ error: "Only the organizer can extend sign-up." }, 403);
    if (room.status !== "lobby")
      return json(
        { error: "Sign-up cannot be extended after the session starts." },
        409,
      );
    room.signupEndsAt = Math.max(now, room.signupEndsAt) + 60_000;
    room.deadline = room.signupEndsAt;
    room.remainingMs = room.signupEndsAt - now;
    room.expiresAt = Math.max(room.expiresAt, room.signupEndsAt + ROOM_TTL_MS);
    await store.set(room);
    return json({ room });
  }

  if (request.method === "POST" && action === "add-manual") {
    if (body?.hostSecret !== room.hostSecret)
      return json({ error: "Only the organizer can add someone manually." }, 403);
    if (room.status !== "lobby")
      return json({ error: "People can only be added before the session starts." }, 409);
    const displayName =
      typeof body.displayName === "string"
        ? body.displayName.trim().replace(/\s+/g, " ")
        : "";
    if (displayName.length < 2 || displayName.length > 80)
      return json({ error: "Enter a name (up to 80 characters)." }, 400);
    const team =
      typeof body.team === "string" ? body.team.trim().replace(/\s+/g, " ") : "";
    if (team.length > 50)
      return json({ error: "Keep the team name under 50 characters." }, 400);
    const role = typeof body.role === "string" ? body.role.trim() : "";
    if (role && !SIGNUP_ROLES.some((option) => option === role))
      return json({ error: "Choose a role from the list." }, 400);
    const participant = registerParticipant(displayName, team, role);
    await store.set(room);
    return json({ participant, room }, 201);
  }

  if (request.method === "POST" && action === "join") {
    const enteredName =
      typeof body?.displayName === "string"
        ? body.displayName.trim().replace(/\s+/g, " ")
        : "";
    if (enteredName.length < 2 || enteredName.length > 80)
      return json({ error: "Enter your name (up to 80 characters)." }, 400);
    const team =
      typeof body?.team === "string"
        ? body.team.trim().replace(/\s+/g, " ")
        : "";
    if (team.length > 50)
      return json({ error: "Keep your team name under 50 characters." }, 400);
    const role = typeof body?.role === "string" ? body.role.trim() : "";
    if (role && !SIGNUP_ROLES.some((option) => option === role))
      return json({ error: "Choose a role from the list." }, 400);
    if (room.status !== "lobby" || room.signupEndsAt <= now)
      return json({ error: "Sign-up is closed for this session." }, 409);
    const participant = registerParticipant(enteredName, team, role);
    await store.set(room);
    return json(
      {
        participant,
        room: { code: room.code, signupEndsAt: room.signupEndsAt },
      },
      201,
    );
  }

  if (request.method === "GET") {
    const hostSecret = request.headers.get("x-host-secret");
    if (hostSecret && hostSecret === room.hostSecret) return json({ room });
    const participantId = url.searchParams.get("participant") ?? "";
    const participant = room.participants.find(
      (person) => person.id === participantId,
    );
    if (!participant)
      return json({ error: "Join this session to continue." }, 401);
    return json({ view: phoneView(room, participant) });
  }

  if (request.method === "POST" && action === "start") {
    if (body?.hostSecret !== room.hostSecret)
      return json({ error: "Only the organizer can start this session." }, 403);
    if (room.status !== "lobby")
      return json({ error: "This session has already started." }, 409);
    if (room.participants.length < MIN_ROOM_PARTICIPANTS)
      return json(
        {
          error: `At least ${MIN_ROOM_PARTICIPANTS} people must join before starting.`,
        },
        409,
      );
    const rounds: unknown = body.rounds;
    if (!isValidMeetupSchedule(room.participants, rounds))
      return json({
        error: "Choose valid cross-team rounds: no repeated or director–lead pairings, everyone included, and only one rotating break for odd attendance.",
      }, 400);
    room.rounds = rounds;
    room.status = "live";
    room.phase = body.phase === "intro" ? "intro" : "conversation";
    room.currentRound = 0;
    room.deadline = typeof body.deadline === "number" ? body.deadline : now;
    room.remainingMs = Math.max(0, room.deadline - now);
    room.previousPhase = undefined;
    room.expiresAt = now + ROOM_TTL_MS;
    await store.set(room);
    return json({ room });
  }

  if (request.method === "POST" && action === "sync") {
    if (body?.hostSecret !== room.hostSecret)
      return json(
        { error: "Only the organizer can update this session." },
        403,
      );
    const roundIndex = Number(body.currentRound);
    const phase = body.phase;
    if (
      !Number.isInteger(roundIndex) ||
      roundIndex < 0 ||
      roundIndex >= room.rounds.length
    )
      return json({ error: "Invalid round." }, 400);
    if (
      !["intro", "conversation", "movement", "paused", "complete"].includes(
        String(phase),
      )
    )
      return json({ error: "Invalid session phase." }, 400);
    room.currentRound = roundIndex;
    room.phase = phase as SharedRoomPhase;
    room.status = phase === "complete" ? "complete" : "live";
    room.deadline = typeof body.deadline === "number" ? body.deadline : null;
    room.remainingMs =
      typeof body.remainingMs === "number" ? Math.max(0, body.remainingMs) : 0;
    room.previousPhase = ["intro", "conversation", "movement"].includes(
      String(body.previousPhase),
    )
      ? (body.previousPhase as "intro" | "conversation" | "movement")
      : undefined;
    room.expiresAt = now + ROOM_TTL_MS;
    await store.set(room);
    return json({ ok: true });
  }

  if (request.method === "POST" && action === "close") {
    if (body?.hostSecret !== room.hostSecret)
      return json({ error: "Only the organizer can end this session." }, 403);
    await store.delete(room.code);
    return json({ ok: true });
  }

  return json({ error: "Unsupported room request." }, 405);
}

async function requestRoom<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch(ROOM_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(result.error ?? "Could not reach this session.");
  return result;
}

export async function createRoom(): Promise<{
  code: string;
  hostSecret: string;
  room: SharedRoom;
}> {
  return requestRoom({ action: "create" });
}

export async function extendRoomSignup(
  code: string,
  hostSecret: string,
): Promise<SharedRoom> {
  const result = await requestRoom<{ room: SharedRoom }>({
    action: "extend-signup",
    code,
    hostSecret,
  });
  return result.room;
}

export async function joinRoom(
  code: string,
  displayName: string,
  team = "",
  role = "",
): Promise<{ participant: RoomParticipant }> {
  return requestRoom({ action: "join", code, displayName, team, role });
}

export async function addManualRoomParticipant(
  code: string,
  hostSecret: string,
  displayName: string,
  team = "",
  role = "",
): Promise<SharedRoom> {
  const result = await requestRoom<{ room: SharedRoom }>({
    action: "add-manual",
    code,
    hostSecret,
    displayName,
    team,
    role,
  });
  return result.room;
}

export async function readHostRoom(
  code: string,
  hostSecret: string,
): Promise<SharedRoom> {
  const response = await fetch(
    `${ROOM_ENDPOINT}?code=${encodeURIComponent(code)}`,
    {
      headers: { "x-host-secret": hostSecret },
      cache: "no-store",
    },
  );
  const result = (await response.json()) as {
    room?: SharedRoom;
    error?: string;
  };
  if (!response.ok || !result.room)
    throw new Error(result.error ?? "Session is unavailable.");
  return result.room;
}

export async function readPhoneRoom(
  code: string,
  participantId: string,
): Promise<PhoneRoomView> {
  const params = new URLSearchParams({ code, participant: participantId });
  const response = await fetch(`${ROOM_ENDPOINT}?${params}`, {
    cache: "no-store",
  });
  const result = (await response.json()) as {
    view?: PhoneRoomView;
    error?: string;
  };
  if (!response.ok || !result.view)
    throw new Error(result.error ?? "Session is unavailable.");
  return result.view;
}

export async function startRoom(
  code: string,
  hostSecret: string,
  rounds: Round[],
  phase: "intro" | "conversation",
  deadline: number,
): Promise<void> {
  await requestRoom({
    action: "start",
    code,
    hostSecret,
    rounds,
    phase,
    deadline,
  });
}

export async function syncRoom(
  code: string,
  hostSecret: string,
  currentRound: number,
  phase: "intro" | "conversation" | "movement" | "paused" | "complete",
  deadline: number | null,
  remainingMs: number,
  previousPhase?: "intro" | "conversation" | "movement",
): Promise<void> {
  await requestRoom({
    action: "sync",
    code,
    hostSecret,
    currentRound,
    phase,
    deadline,
    remainingMs,
    previousPhase,
  });
}

export async function closeRoom(
  code: string,
  hostSecret: string,
): Promise<void> {
  await requestRoom({ action: "close", code, hostSecret });
}
