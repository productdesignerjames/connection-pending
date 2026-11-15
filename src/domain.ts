import blossom from "edmonds-blossom";

export type OddAttendanceMode = "trio" | "break";
export type IcebreakerCategory =
  | "Light and fun"
  | "Getting to know you"
  | "Work and collaboration"
  | "Creative challenges"
  | "Future and aspirations"
  | "Team improvement";

export interface DisplayAvatar {
  palette: number;
  pattern: number;
}

export interface ParticipantIdentity {
  symbol: string;
  background: string;
  foreground: string;
  number: number;
}

export interface TeamMember {
  id: string;
  displayName: string;
  team?: string;
  role?: string;
  identity?: ParticipantIdentity;
  avatarId: string;
  isActive: boolean;
  isOrganiser: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSettings {
  rounds: number;
  conversationMinutes: number;
  movementSeconds: number;
  icebreakersEnabled: boolean;
  categories: IcebreakerCategory[];
  soundEnabled: boolean;
  soundVolume: number;
  introEnabled: boolean;
  outroEnabled: boolean;
  organiserParticipates: boolean;
  oddAttendanceMode: OddAttendanceMode;
  autoAdvance: boolean;
  rememberAttendance: boolean;
  highContrast: boolean;
}

export interface IcebreakerQuestion {
  id: string;
  prompt: string;
  category: IcebreakerCategory;
  enabled: boolean;
  custom: boolean;
}

export interface Station {
  number: number;
  participantIds: string[];
  stayingId: string;
  movingIds: string[];
  kind: "pair" | "trio" | "break";
  activity?: string;
}

export interface Round {
  number: number;
  stations: Station[];
  question?: IcebreakerQuestion;
  repeatedPairs: string[][];
  sameTeamPairs?: string[][];
}

export interface MovementInstruction {
  participantId: string;
  currentStation: number;
  nextStation: number;
  nextConnection: string;
}

export interface ActiveTimer {
  phase: "intro" | "conversation" | "movement" | "paused" | "complete";
  deadline: number | null;
  remainingMs: number;
  previousPhase?: "intro" | "conversation" | "movement";
}

export interface SessionSummary {
  attendeeCount: number;
  rounds: number;
  stations: number;
  conversations: number;
  durationSeconds: number;
  icebreakersUsed: number;
}

export interface SessionState {
  id: string;
  attendeeIds: string[];
  participants?: TeamMember[];
  rounds: Round[];
  currentRound: number;
  timer: ActiveTimer;
  startedAt: number | null;
  displayMode: "room" | "focus";
  movementCompact: boolean;
  introSkipped: boolean;
  settings: SessionSettings;
}

export interface StoredAppData {
  version: 1;
  team: TeamMember[];
  questions: IcebreakerQuestion[];
  settings: SessionSettings;
  attendeeIds: string[];
  session: SessionState | null;
  displayMode: "room" | "focus";
  soundVolume: number;
}

export const APP_NAME = "Speed Meets";
export const SIGNUP_TEAMS = [
  "AI talk team",
  "Design system team",
  "Web purchase team",
  "Web inLife team",
  "App team",
  "Hive",
  "Solver team",
  "UX research and Service design",
] as const;
export const SIGNUP_ROLES = [
  "Product designer",
  "Lead designer",
  "Senior designer",
  "Director of design",
] as const;
export const ORGANISER_NAME = "Kerry M";

const timestamp = "2026-01-01T00:00:00.000Z";

const rosterNames = [
  "Antony M",
  "Alexander M",
  "Richard E",
  "Ryan K",
  "Helen P",
  "James M",
  "Justin L",
  "Mark M",
  "James H",
  "Bergen L",
  "Onkardeep S",
  "Mo B",
  "Joao F",
  "Zoey W",
  "James S",
  "Esteban O",
  "Basia T",
  "Marcelina S",
  "Shiera B",
  "Owen H",
  "Harry R",
  "Zoe R",
  "Jesse S",
  "Nick P",
  "Andy F",
  "Katie S",
  "Terhi H",
  "Alessandra B",
  "Anastasija K",
  "Jp B",
  "Anastasia M",
  "Carolynn S",
  "Bradley C",
  "H L",
  "Gem W",
  "David C",
  "Demi O",
  "Scottie R",
];

export function avatarForName(name: string): DisplayAvatar {
  let hash = 2166136261;
  for (const character of name) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return { palette: (hash >>> 0) % 8, pattern: (hash >>> 8) % 6 };
}

export const DEFAULT_TEAM: TeamMember[] = rosterNames.map(
  (displayName, index) => ({
    id: `member-${index + 1}`,
    displayName,
    avatarId: `${avatarForName(displayName).palette}-${avatarForName(displayName).pattern}`,
    isActive: true,
    isOrganiser: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  }),
);

export const DEFAULT_SETTINGS: SessionSettings = {
  rounds: 8,
  conversationMinutes: 3,
  movementSeconds: 30,
  icebreakersEnabled: true,
  categories: [
    "Light and fun",
    "Getting to know you",
  ],
  soundEnabled: true,
  soundVolume: 0.45,
  introEnabled: false,
  outroEnabled: true,
  organiserParticipates: false,
  oddAttendanceMode: "break",
  autoAdvance: true,
  rememberAttendance: true,
  highContrast: false,
};

const questionRows: [IcebreakerCategory, string][] = [
  ["Light and fun", "What is one small thing that always improves your day?"],
  [
    "Getting to know you",
    "What is the best piece of advice you have received?",
  ],
  ["Future and aspirations", "What skill would you like to learn next?"],
  ["Light and fun", "What is your ideal three-day weekend?"],
  ["Light and fun", "Which fictional office would you most like to work in?"],
  ["Team improvement", "What is one thing the team should do more often?"],
  ["Getting to know you", "What is something people may not know about you?"],
  [
    "Creative challenges",
    "Describe your current project using only three words.",
  ],
  [
    "Work and collaboration",
    "If you could instantly improve one workplace tool, what would it be?",
  ],
  ["Creative challenges", "Find one thing you both have in common."],
  [
    "Creative challenges",
    "Invent the worst possible name for a productivity app.",
  ],
  [
    "Creative challenges",
    "Choose one office object that would help you survive on a desert island.",
  ],
  [
    "Work and collaboration",
    "What is the most useful shortcut or trick you have learnt recently?",
  ],
  ["Work and collaboration", "What type of work gives you the most energy?"],
  ["Work and collaboration", "What would make collaboration easier for you?"],
  [
    "Work and collaboration",
    "What would you like to understand better about another team?",
  ],
  ["Light and fun", "If the team had a theme song, what should it be?"],
  ["Creative challenges", "Design a new office holiday in 30 seconds."],
  ["Team improvement", "What small change would improve the working week?"],
  [
    "Getting to know you",
    "What achievement from the past year are you most pleased with?",
  ],
  ["Getting to know you", "What place would you happily visit again?"],
  ["Light and fun", "What is a food combination you unexpectedly enjoy?"],
  [
    "Future and aspirations",
    "What would you like to make more time for this year?",
  ],
  ["Work and collaboration", "What helps you do your best work?"],
  ["Team improvement", "What is one team tradition worth starting?"],
  ["Getting to know you", "What was your first ever job?"],
  ["Light and fun", "What is a tiny hill you are willing to die on?"],
  ["Creative challenges", "Pitch a completely unnecessary office invention."],
  [
    "Future and aspirations",
    "What would you try if you knew you could not fail?",
  ],
  [
    "Work and collaboration",
    "What is a skill you rely on more than people realise?",
  ],
  ["Team improvement", "What is one thing we could simplify as a team?"],
  ["Getting to know you", "What is something you are curious about lately?"],
  ["Light and fun", "What would your personal mascot be?"],
  ["Creative challenges", "Create a two-word slogan for the team."],
  ["Future and aspirations", "What would a great next year look like for you?"],
  [
    "Work and collaboration",
    "What is the best way for someone to ask you for help?",
  ],
  [
    "Team improvement",
    "What is a recent moment when the team worked well together?",
  ],
  [
    "Getting to know you",
    "What hobby would you pick up with one extra hour each week?",
  ],
  ["Light and fun", "What is your favourite way to spend a rainy afternoon?"],
  ["Creative challenges", "If our team were a small shop, what would it sell?"],
  [
    "Future and aspirations",
    "What is one thing you hope to be better at in five years?",
  ],
  ["Work and collaboration", "What makes a meeting feel worthwhile to you?"],
  ["Team improvement", "What is one small win the team should celebrate more?"],
  [
    "Getting to know you",
    "What is a book, podcast or show you have enjoyed recently?",
  ],
  ["Light and fun", "Which everyday object deserves a better design?"],
  ["Creative challenges", "Name a new team superpower and what it would do."],
  ["Future and aspirations", "What is a place you would like to explore?"],
  ["Work and collaboration", "What is something another colleague taught you?"],
  [
    "Team improvement",
    "What would make it easier to share ideas across the team?",
  ],
  ["Getting to know you", "What is a project you are proud to have finished?"],
  ["Creative challenges", "Invent a friendly robot to improve the office."],
];

export const LEGACY_QUESTIONS: IcebreakerQuestion[] = questionRows.map(
  ([category, prompt], index) => ({
    id: `question-${index + 1}`,
    prompt,
    category,
    enabled: true,
    custom: false,
  }),
);

const funQuestionPrompts = [
  "What is your favourite sandwich?",
  "What is your favourite colour?",
  "Where would you go on your dream holiday?",
  "What is your favourite film?",
  "What song always puts you in a good mood?",
  "What is your favourite pizza topping?",
  "What is your favourite ice cream flavour?",
  "Tea, coffee, or something else?",
  "What is your favourite breakfast?",
  "What is your favourite TV show?",
  "Beach, city, or countryside holiday?",
  "What is your favourite snack?",
  "What film could you watch again and again?",
  "What is your go-to karaoke song?",
  "What is your favourite animal?",
  "What is your favourite season?",
  "What is your favourite biscuit?",
  "What is your favourite takeaway?",
  "What is your favourite board game?",
  "What is your favourite thing to put on toast?",
  "What is your favourite way to spend a Sunday?",
  "What is your favourite dessert?",
  "What is your favourite place for a day out?",
  "What is your favourite smell?",
  "What is your favourite fruit?",
  "What is your favourite chocolate bar?",
  "What is your favourite type of music?",
  "What is your favourite cartoon?",
  "What is your favourite soup?",
  "What is your favourite holiday activity?",
  "Cats, dogs, or another animal?",
  "Sweet popcorn or salty popcorn?",
  "What is your favourite pasta dish?",
  "What is your favourite book?",
  "What is your favourite video game?",
  "What is your favourite thing to cook?",
  "What is your favourite park or outdoor spot?",
  "What is your favourite cheese?",
  "What is your favourite sandwich filling combination?",
  "What is your favourite rainy-day activity?",
  "What is your favourite hot drink?",
  "What is your favourite cold drink?",
  "What is your favourite musical instrument to listen to?",
  "What is your favourite comedy?",
  "What is your favourite cake?",
  "What is your favourite thing about summer?",
  "What is your favourite thing about winter?",
  "What is your favourite fictional character?",
  "What is your favourite kind of potato?",
  "What is your favourite thing to order at a cafe?",
  "What is your favourite flower or plant?",
  "What song would you put on a road-trip playlist?",
  "What is your favourite thing to do on holiday?",
  "What is your favourite place to go for a walk?",
  "What is your favourite animated film?",
  "What is your favourite party food?",
  "What is your favourite fairground ride?",
  "What is your favourite way to eat eggs?",
  "What is your favourite museum or attraction?",
  "What is your favourite sound?",
];

export const DEFAULT_QUESTIONS: IcebreakerQuestion[] = funQuestionPrompts.map(
  (prompt, index) => ({
    id: `question-${index + 1}`,
    prompt,
    category: index % 2 === 0 ? "Light and fun" : "Getting to know you",
    enabled: true,
    custom: false,
  }),
);

export function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function validateDisplayName(
  name: string,
  team: TeamMember[],
  excludeId?: string,
): string | null {
  const normalised = normaliseName(name);
  if (!normalised) return "Enter a first name and surname initial.";
  if (normalised.length > 32) return "Names must be 32 characters or fewer.";
  if (normalised.split(" ").length < 2)
    return "Enter a first name and surname initial.";
  const duplicate = team.find(
    (member) =>
      member.id !== excludeId &&
      member.displayName.localeCompare(normalised, undefined, {
        sensitivity: "accent",
      }) === 0,
  );
  return duplicate ? `${duplicate.displayName} is already on the team.` : null;
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function selectQuestions(
  questions: IcebreakerQuestion[],
  selectedCategories: IcebreakerCategory[],
  count: number,
  random: () => number = Math.random,
): IcebreakerQuestion[] {
  const eligible = new Map<string, IcebreakerQuestion>();
  for (const question of questions) {
    const key = question.prompt.trim().toLowerCase();
    if (
      question.enabled &&
      selectedCategories.includes(question.category) &&
      !eligible.has(key)
    ) {
      eligible.set(key, question);
    }
  }
  return shuffled([...eligible.values()], random).slice(0, Math.max(0, count));
}

function pairKey(first: string, second: string): string {
  return [first, second].sort().join("::");
}

export function generateRounds(
  attendeeIds: string[],
  requestedRounds: number,
  oddMode: OddAttendanceMode,
  random: () => number = Math.random,
  randomize = true,
): Round[] {
  const uniqueParticipants = [...new Set(attendeeIds)];
  const participants = randomize
    ? shuffled(uniqueParticipants, random)
    : uniqueParticipants;
  if (participants.length < 2 || requestedRounds < 1) return [];

  const odd = participants.length % 2 === 1;
  const stationCount = Math.floor(participants.length / 2);
  const staying = participants.slice(0, stationCount);
  const moving = participants.slice(stationCount);
  const history = new Set<string>();
  const rounds: Round[] = [];

  for (let roundIndex = 0; roundIndex < requestedRounds; roundIndex += 1) {
    const rotatedMoving = moving.map(
      (_, index) => moving[(index + roundIndex) % moving.length],
    );
    const activeMoving = odd
      ? rotatedMoving.slice(0, stationCount)
      : rotatedMoving;
    const extraMover = odd ? rotatedMoving[stationCount] : undefined;
    const stations: Station[] = staying.map((stayingId, stationIndex) => {
      const movingId = activeMoving[stationIndex];
      return {
        number: stationIndex + 1,
        participantIds: [stayingId, movingId],
        stayingId,
        movingIds: [movingId],
        kind: "pair",
      };
    });

    if (extraMover && oddMode === "trio") {
      let selectedIndex = 0;
      let lowestRepeatCount = Number.POSITIVE_INFINITY;
      for (
        let stationIndex = 0;
        stationIndex < stations.length;
        stationIndex += 1
      ) {
        const station = stations[stationIndex];
        const repeatCount = station.participantIds.reduce(
          (count, id) => count + Number(history.has(pairKey(extraMover, id))),
          0,
        );
        if (repeatCount < lowestRepeatCount) {
          lowestRepeatCount = repeatCount;
          selectedIndex = stationIndex;
        }
      }
      const trioStation = stations[selectedIndex];
      trioStation.participantIds.push(extraMover);
      trioStation.movingIds.push(extraMover);
      trioStation.kind = "trio";
    } else if (extraMover) {
      stations.push({
        number: stations.length + 1,
        participantIds: [extraMover],
        stayingId: extraMover,
        movingIds: [],
        kind: "break",
        activity:
          "Take a breather or jot down one idea from the conversation rounds.",
      });
    }

    const repeatedPairs: string[][] = [];
    for (const station of stations) {
      for (let first = 0; first < station.participantIds.length; first += 1) {
        for (
          let second = first + 1;
          second < station.participantIds.length;
          second += 1
        ) {
          const firstId = station.participantIds[first];
          const secondId = station.participantIds[second];
          const key = pairKey(firstId, secondId);
          if (history.has(key)) repeatedPairs.push([firstId, secondId]);
          history.add(key);
        }
      }
    }
    rounds.push({ number: roundIndex + 1, stations, repeatedPairs });
  }

  return rounds;
}

export function canMeet(
  first: { team?: string; role?: string },
  second: { team?: string; role?: string },
): boolean {
  const normalize = (value?: string) =>
    value?.trim().replace(/\s+/g, " ").toLocaleLowerCase() ?? "";
  const firstTeam = normalize(first.team);
  if (firstTeam && firstTeam === normalize(second.team)) return false;
  const firstRole = normalize(first.role);
  const secondRole = normalize(second.role);
  const isDirector = (role: string) =>
    role === "director of design" || role === "design director";
  return !(
    (isDirector(firstRole) && /\blead\b/.test(secondRole)) ||
    (isDirector(secondRole) && /\blead\b/.test(firstRole))
  );
}

export const MAX_MEETUP_ROUNDS = 40;
type MeetupAttendee = { id: string; team?: string; role?: string };

export function generateMeetupRounds(
  attendees: MeetupAttendee[],
  requestedRounds: number,
  random: () => number = Math.random,
): Round[] {
  const people = [...new Map(attendees.map((person) => [person.id, person])).values()];
  if (people.length < 2 || !Number.isInteger(requestedRounds) || requestedRounds < 1)
    return [];
  const odd = people.length % 2;
  const degrees = people.map((first) =>
    people.filter((second) => first.id !== second.id && canMeet(first, second)).length,
  );
  // Odd rooms need an extra round to accommodate each person's rotating break.
  const limit = Math.min(
    requestedRounds,
    MAX_MEETUP_ROUNDS,
    people.length - 1 + odd,
    Math.min(...degrees) + odd,
    Math.floor(degrees.reduce((sum, degree) => sum + degree, 0) / 2 /
      Math.floor(people.length / 2)),
  );
  if (!limit) return [];
  const makeRound = (groups: string[][], number: number): Round => ({
    number,
    stations: groups.map((participantIds, index) => ({
      number: index + 1,
      participantIds,
      stayingId: participantIds[0],
      movingIds: participantIds.slice(1),
      kind: participantIds.length === 1 ? "break" : "pair",
      ...(participantIds.length === 1 ? {
        activity: "Your turn for a short break. Enjoy a breather while others chat.",
      } : {}),
    })),
    repeatedPairs: [],
    sameTeamPairs: [],
  });
  if (degrees.every((degree) => degree === people.length - 1)) {
    const rotation = shuffled(people.map((_, index) => index), random);
    if (odd) rotation.push(people.length);
    return Array.from({ length: limit }, (_, index) => {
      const groups = Array.from({ length: rotation.length / 2 }, (_, pair) =>
        [rotation[pair], rotation[rotation.length - 1 - pair]]
          .filter((person) => person < people.length)
          .map((person) => people[person].id),
      );
      const last = rotation.pop()!;
      rotation.splice(1, 0, last);
      return makeRound(groups, index + 1);
    });
  }
  let best: Round[] = [];
  for (let attempt = 0; attempt < 12 && best.length < limit; attempt += 1) {
    let seed = (Math.floor(random() * 2 ** 32) + Math.imul(attempt + 1, 2654435761)) >>> 0;
    const weight = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return 1 + seed % 1000;
    };
    const history = new Set<string>();
    const rested = new Set<string>();
    const rounds: Round[] = [];
    for (let index = 0; index < limit; index += 1) {
      const edges: number[][] = [];
      people.forEach((first, firstIndex) => {
        people.slice(firstIndex + 1).forEach((second, offset) => {
          if (canMeet(first, second) && !history.has(pairKey(first.id, second.id)))
            edges.push([firstIndex, firstIndex + offset + 1, weight()]);
        });
        if (odd && !rested.has(first.id))
          edges.push([firstIndex, people.length, weight()]);
      });
      if (!edges.length) break;
      // The extra vertex represents the single rotating break in an odd room.
      const mates = blossom(edges, true);
      if (Array.from({ length: people.length + odd }, (_, person) => person)
        .some((person) => !(mates[person] >= 0))) break;
      const groups: string[][] = [];
      people.forEach((person, personIndex) => {
        const mate = mates[personIndex];
        if (mate < personIndex) return;
        if (mate === people.length) {
          groups.push([person.id]);
          rested.add(person.id);
        } else {
          groups.push([person.id, people[mate].id]);
          history.add(pairKey(person.id, people[mate].id));
        }
      });
      rounds.push(makeRound(groups, index + 1));
    }
    if (rounds.length > best.length) best = rounds;
  }
  return best;
}

export function isValidMeetupSchedule(
  attendees: MeetupAttendee[],
  submitted: unknown,
): submitted is Round[] {
  const people = new Map(attendees.map((person) => [person.id, person]));
  if (!Array.isArray(submitted) || !submitted.length ||
    submitted.length > MAX_MEETUP_ROUNDS ||
    submitted.length > people.size - 1 + people.size % 2) return false;
  const record = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;
  const history = new Set<string>();
  const rested = new Set<string>();
  for (const [index, round] of submitted.entries()) {
    if (!record(round) || round.number !== index + 1 ||
      !Array.isArray(round.stations) || !Array.isArray(round.repeatedPairs) ||
      round.repeatedPairs.length ||
      (round.sameTeamPairs !== undefined &&
        (!Array.isArray(round.sameTeamPairs) || round.sameTeamPairs.length))) return false;
    if (round.question !== undefined) {
      const question = round.question;
      if (!record(question) || typeof question.id !== "string" ||
        typeof question.prompt !== "string" || typeof question.enabled !== "boolean" ||
        typeof question.custom !== "boolean" ||
        ![...DEFAULT_QUESTIONS, ...LEGACY_QUESTIONS].some(
          (known) => known.category === question.category,
        )) return false;
    }
    const included = new Set<string>();
    let breaks = 0;
    for (const [stationIndex, station] of round.stations.entries()) {
      if (!record(station) || station.number !== stationIndex + 1 ||
        !Array.isArray(station.participantIds) ||
        !Array.isArray(station.movingIds) ||
        (station.activity !== undefined && typeof station.activity !== "string")) return false;
      const ids: unknown[] = station.participantIds;
      if ((station.kind !== "pair" || ids.length !== 2) &&
        (station.kind !== "break" || ids.length !== 1)) return false;
      for (const id of ids) {
        if (typeof id !== "string" || !people.has(id) || included.has(id)) return false;
        included.add(id);
      }
      if (station.stayingId !== ids[0] ||
        station.movingIds.length !== ids.length - 1 ||
        station.movingIds.some((id, movingIndex) => id !== ids[movingIndex + 1]))
        return false;
      const firstId = station.stayingId;
      if (typeof firstId !== "string") return false;
      const first = people.get(firstId)!;
      if (station.kind === "break") {
        if (rested.has(firstId)) return false;
        rested.add(firstId);
        breaks += 1;
      } else {
        const secondId = ids[1];
        if (typeof secondId !== "string") return false;
        const second = people.get(secondId)!;
        const key = pairKey(firstId, secondId);
        if (!canMeet(first, second) || history.has(key)) return false;
        history.add(key);
      }
    }
    if (included.size !== people.size || breaks !== people.size % 2) return false;
  }
  return true;
}

export function countConversations(rounds: Round[]): number {
  return rounds.reduce(
    (count, round) =>
      count +
      round.stations.filter((station) => station.kind !== "break").length,
    0,
  );
}

export function calculateDurationSeconds(
  settings: Pick<
    SessionSettings,
    "rounds" | "conversationMinutes" | "movementSeconds"
  >,
): number {
  const conversations =
    Math.max(0, settings.rounds) *
    Math.max(0, settings.conversationMinutes) *
    60;
  const movement =
    Math.max(0, settings.rounds) * Math.max(0, settings.movementSeconds);
  return conversations + movement;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${remainder}m` : `${minutes} min`;
}

export function pairingsForAttendees(
  team: TeamMember[],
  selectedIds: string[],
  organiserParticipates: boolean,
): TeamMember[] {
  const selected = team.filter(
    (member) => selectedIds.includes(member.id) && !member.isOrganiser,
  );
  if (!organiserParticipates) return selected;
  const organiser: TeamMember = {
    id: "organiser-kerry-m",
    displayName: ORGANISER_NAME,
    avatarId: `${avatarForName(ORGANISER_NAME).palette}-${avatarForName(ORGANISER_NAME).pattern}`,
    isActive: true,
    isOrganiser: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return [...selected, organiser];
}
