import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  Accessibility,
  ArrowLeft,
  Check,
  ChevronDown,
  Clock3,
  Expand,
  FastForward,
  HelpCircle,
  MessageSquareText,
  Monitor,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Smartphone,
  Shuffle,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import PairSymbol from "./components/PairSymbol";
import BusinessPeopleArt from "./components/BusinessPeopleArt";
import IntroMusicButton from "./components/IntroMusicButton";
import {
  APP_NAME,
  SIGNUP_TEAMS,
  SIGNUP_ROLES,
  DEFAULT_QUESTIONS,
  DEFAULT_TEAM,
  ORGANISER_NAME,
  MAX_MEETUP_ROUNDS,
  avatarForName,
  calculateDurationSeconds,
  countConversations,
  formatDuration,
  generateRounds,
  generateMeetupRounds,
  pairingsForAttendees,
  selectQuestions,
  validateDisplayName,
  type IcebreakerCategory,
  type IcebreakerQuestion,
  type Round,
  type SessionSettings,
  type SessionState,
  type Station,
  type StoredAppData,
  type TeamMember,
} from "./domain";
import {
  createDefaultData,
  loadStoredData,
  migrateLegacyStorage,
  saveStoredData,
} from "./storage";
import {
  createTimer,
  formatClock,
  pauseTimer,
  remainingTime,
  resumeTimer,
} from "./timer";
import {
  closeRoom,
  getPairAppearance,
  createRoom,
  addManualRoomParticipant,
  extendRoomSignup,
  joinRoom,
  PAIR_SYMBOLS,
  readHostRoom,
  readPhoneRoom,
  ROOM_SIGNUP_MS,
  MIN_ROOM_PARTICIPANTS,
  startRoom,
  syncRoom,
  type PhoneRoomView,
  type SharedRoom,
} from "./rooms";
import "./App.css";
import "./theme.css";
import "./clean-theme.css";

type Screen =
  | "welcome"
  | "room-setup"
  | "lobby"
  | "phone"
  | "setup"
  | "preview"
  | "intro"
  | "round"
  | "movement"
  | "complete"
  | "recovery";
type Panel = "session" | "questions" | "accessibility" | "legacy-session";
const categories: IcebreakerCategory[] = [
  "Light and fun",
  "Getting to know you",
  "Work and collaboration",
  "Creative challenges",
  "Future and aspirations",
  "Team improvement",
];

function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}
function defaults(): { data: StoredAppData; recovered: boolean } {
  try {
    migrateLegacyStorage(window.sessionStorage);
    return loadStoredData(window.localStorage);
  } catch {
    return { data: createDefaultData(), recovered: true };
  }
}
function nameOf(team: TeamMember[], id: string): string {
  return id === "organiser-kerry-m"
    ? ORGANISER_NAME
    : (team.find((member) => member.id === id)?.displayName ?? "Team member");
}
function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
}

function App() {
  const initial = useMemo(defaults, []);
  const initialRoomCode = new URLSearchParams(window.location.search).get(
    "room",
  );
  const savedHostCode = sessionStorage.getItem("meetup.host-room");
  const savedHostSecret = sessionStorage.getItem("meetup.host-secret");
  const [data, setData] = useState(initial.data);
  const [screen, setScreen] = useState<Screen>(
    initialRoomCode
      ? "phone"
      : initial.data.session
        ? "recovery"
        : savedHostCode && savedHostSecret
          ? "lobby"
          : "welcome",
  );
  const [roomCode, setRoomCode] = useState<string | null>(
    initialRoomCode ?? savedHostCode,
  );
  const [hostSecret, setHostSecret] = useState<string | null>(savedHostSecret);
  const [room, setRoom] = useState<SharedRoom | null>(null);
  const [phoneName, setPhoneName] = useState("");
  const [phoneSurname, setPhoneSurname] = useState("");
  const [phoneTeam, setPhoneTeam] = useState("");
  const [phoneRole, setPhoneRole] = useState("");
  const [phoneParticipantId, setPhoneParticipantId] = useState(() =>
    initialRoomCode
      ? (sessionStorage.getItem(`meetup.phone.${initialRoomCode}`) ?? "")
      : "",
  );
  const [phoneView, setPhoneView] = useState<PhoneRoomView | null>(null);
  const [roomBusy, setRoomBusy] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [panel, setPanel] = useState<Panel>("session");
  const [notice, setNotice] = useState(
    initial.recovered
      ? "Saved data could not be recovered. Fresh defaults are ready."
      : "",
  );
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<Round[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [memberEdit, setMemberEdit] = useState<string | null>(null);
  const [memberDraft, setMemberDraft] = useState("");
  const [newMember, setNewMember] = useState("");
  const [pasteNames, setPasteNames] = useState("");
  const [questionDraft, setQuestionDraft] = useState("");
  const [questionCategory, setQuestionCategory] =
    useState<IcebreakerCategory>("Light and fun");
  const [questionEdit, setQuestionEdit] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [announce, setAnnounce] = useState("");
  const [dialog, setDialog] = useState<"reset" | "end" | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const lastCue = useRef("");
  const session = data.session;
  const currentRound = session?.rounds[session.currentRound];
  const attendees = pairingsForAttendees(
    data.team,
    data.attendeeIds,
    data.settings.organiserParticipates,
  );
  const duration = calculateDurationSeconds(data.settings);
  const remaining = session ? remainingTime(session.timer, now) : 0;
  const filteredMembers = data.team.filter((member) =>
    member.displayName.toLowerCase().includes(search.toLowerCase()),
  );
  const repeats = preview.reduce(
    (total, round) => total + round.repeatedPairs.length,
    0,
  );
  const phoneRemaining = phoneView
    ? phoneView.phase === "paused"
      ? Math.max(0, phoneView.remainingMs)
      : Math.max(0, (phoneView.deadline ?? 0) - now)
    : 0;
  const signupRemaining = room
    ? Math.max(0, room.signupEndsAt - now)
    : ROOM_SIGNUP_MS;
  const roomParticipants = room?.participants;
  const roomRoundPlan = useMemo(
    () => roomParticipants && roomParticipants.length >= MIN_ROOM_PARTICIPANTS
      ? generateMeetupRounds(roomParticipants, MAX_MEETUP_ROUNDS)
      : [],
    [roomParticipants],
  );

  useEffect(() => {
    let message = "";
    try {
      if (!saveStoredData(data, localStorage))
        message =
          "This browser could not save changes. Keep this tab open during the session.";
    } catch {
      message =
        "Local storage is unavailable. Changes will last for this visit only.";
    }
    if (!message) return;
    const timeout = window.setTimeout(() => setNotice(message), 0);
    return () => window.clearTimeout(timeout);
  }, [data]);
  useEffect(() => {
    const ticker = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(ticker);
  }, []);

  const pollHostRoom = useEffectEvent(async () => {
    if (!roomCode || !hostSecret) return;
    try {
      const next = await readHostRoom(roomCode, hostSecret);
      setRoom((current) => current &&
        JSON.stringify(current.participants) === JSON.stringify(next.participants)
        ? { ...next, participants: current.participants }
        : next);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Session link expired.",
      );
    }
  });

  useEffect(() => {
    if (screen !== "lobby" || !roomCode || !hostSecret) return;
    const initialPoll = window.setTimeout(() => void pollHostRoom(), 0);
    const interval = window.setInterval(() => void pollHostRoom(), 1200);
    return () => {
      window.clearTimeout(initialPoll);
      window.clearInterval(interval);
    };
  }, [screen, roomCode, hostSecret]);

  const pollPhoneRoom = useEffectEvent(async () => {
    if (!initialRoomCode || !phoneParticipantId) return;
    try {
      setPhoneView(await readPhoneRoom(initialRoomCode, phoneParticipantId));
      setError("");
    } catch (reason) {
      setPhoneView(null);
      setError(
        reason instanceof Error ? reason.message : "Session link expired.",
      );
    }
  });

  useEffect(() => {
    if (screen !== "phone" || !initialRoomCode || !phoneParticipantId) return;
    const initialPoll = window.setTimeout(() => void pollPhoneRoom(), 0);
    const interval = window.setInterval(() => void pollPhoneRoom(), 1200);
    return () => {
      window.clearTimeout(initialPoll);
      window.clearInterval(interval);
    };
  }, [screen, initialRoomCode, phoneParticipantId]);

  const syncHostRoom = useEffectEvent(async () => {
    if (!roomCode || !hostSecret || !session) return;
    try {
      const phase =
        session.timer.phase === "paused"
          ? "paused"
          : session.timer.phase === "complete"
            ? "complete"
            : session.timer.phase;
      await syncRoom(
        roomCode,
        hostSecret,
        session.currentRound,
        phase,
        session.timer.deadline,
        session.timer.remainingMs,
        session.timer.previousPhase,
      );
    } catch {
      setNotice(
        "Phone sync was interrupted. The projected session will continue.",
      );
    }
  });

  useEffect(() => {
    if (!session || !roomCode || !hostSecret || screen === "lobby") return;
    const sync = window.setTimeout(() => void syncHostRoom(), 0);
    return () => window.clearTimeout(sync);
  }, [session, roomCode, hostSecret, screen]);

  const handleTimerExpiry = useEffectEvent(() => {
    if (
      !session ||
      ["paused", "complete"].includes(session.timer.phase) ||
      session.timer.deadline === null ||
      remaining > 0
    )
      return;
    if (session.timer.phase === "intro") {
      if (!session.settings.autoAdvance) {
        setData((current) => ({
          ...current,
          session: current.session
            ? {
                ...current.session,
                timer: {
                  ...current.session.timer,
                  deadline: null,
                  remainingMs: 0,
                },
              }
            : null,
        }));
        setAnnounce(
          "Finding time is complete. Start the conversation when everyone is ready.",
        );
        return;
      }
      setData((current) => ({
        ...current,
        session: current.session
          ? {
              ...current.session,
              timer: createTimer(
                "conversation",
                current.session.settings.conversationMinutes * 60_000,
                now,
              ),
            }
          : null,
      }));
      setScreen("round");
      setAnnounce(`Round 1 of ${session.rounds.length} is starting.`);
      cue("start");
      return;
    }
    if (session.timer.phase === "conversation") {
      if (session.currentRound >= session.rounds.length - 1) {
        complete();
        return;
      }
      startMovement();
      return;
    }
    if (session.timer.phase === "movement") {
      if (session.settings.autoAdvance) {
        nextRound(session);
      } else {
        setData((current) => ({
          ...current,
          session: current.session
            ? {
                ...current.session,
                timer: {
                  ...current.session.timer,
                  deadline: null,
                  remainingMs: 0,
                },
              }
            : null,
        }));
        setAnnounce(
          "Movement time is complete. Start the next round when ready.",
        );
      }
    }
  });

  const announceTimerCue = useEffectEvent(() => {
    if (!session || session.timer.phase !== "conversation") return;
    const seconds = Math.ceil(remaining / 1000);
    const cueName =
      seconds <= 10
        ? "ten"
        : seconds <= 30
          ? "thirty"
          : seconds <= 60
            ? "minute"
            : "";
    if (cueName && lastCue.current !== `${session.currentRound}-${cueName}`) {
      lastCue.current = `${session.currentRound}-${cueName}`;
      setAnnounce(
        cueName === "minute"
          ? "One minute remaining."
          : cueName === "thirty"
            ? "Thirty seconds remaining."
            : "Ten seconds remaining.",
      );
      if (cueName === "minute" || cueName === "ten") cue(cueName);
    }
  });

  useEffect(() => {
    if (
      !session ||
      ["paused", "complete"].includes(session.timer.phase) ||
      session.timer.deadline === null ||
      remaining > 0
    )
      return;
    const timeout = window.setTimeout(handleTimerExpiry, 0);
    return () => window.clearTimeout(timeout);
  }, [now, remaining, session]);

  useEffect(() => {
    if (!session || session.timer.phase !== "conversation") return;
    announceTimerCue();
  }, [remaining, session]);

  function cue(kind: "start" | "minute" | "ten" | "move" | "complete") {
    if (!data.settings.soundEnabled || !data.settings.soundVolume) return;
    try {
      const context = audio.current ?? new AudioContext();
      audio.current = context;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "square";
      oscillator.frequency.value = {
        start: 660,
        minute: 440,
        ten: 880,
        move: 520,
        complete: 740,
      }[kind];
      gain.gain.value = Math.max(0.01, data.settings.soundVolume * 0.045);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.11);
    } catch {
      setNotice(
        "Sound is unavailable in this browser. The session will continue without it.",
      );
    }
  }
  function startMovement() {
    setData((current) => ({
      ...current,
      session: current.session
        ? {
            ...current.session,
            timer: createTimer(
              "movement",
              current.session.settings.movementSeconds * 1000,
            ),
          }
        : null,
    }));
    setScreen("movement");
    setAnnounce("Time for a new conversation round.");
    cue("move");
  }
  function nextRound(active = session) {
    if (!active) return;
    const next = Math.min(active.currentRound + 1, active.rounds.length - 1);
    setData((current) => ({
      ...current,
      session: current.session
        ? {
            ...current.session,
            currentRound: next,
            timer: createTimer(
              "conversation",
              current.session.settings.conversationMinutes * 60_000,
            ),
          }
        : null,
    }));
    setScreen("round");
    setAnnounce(
      `Round ${next + 1} of ${active.rounds.length}. Meet your new group.`,
    );
    lastCue.current = "";
    cue("start");
  }
  function complete() {
    setData((current) => ({
      ...current,
      session: current.session
        ? {
            ...current.session,
            timer: {
              ...current.session.timer,
              phase: "complete",
              deadline: null,
            },
          }
        : null,
    }));
    setScreen("complete");
    setAnnounce("Session complete. Connections made.");
    cue("complete");
  }
  function updateSetting<K extends keyof SessionSettings>(
    key: K,
    value: SessionSettings[K],
  ) {
    setData((current) => ({
      ...current,
      settings: { ...current.settings, [key]: value },
    }));
  }
  function selectAll(checked: boolean) {
    setData((current) => ({
      ...current,
      attendeeIds: checked
        ? current.team
            .filter((member) => !member.isOrganiser)
            .map((member) => member.id)
        : [],
    }));
  }
  function createPreviewRounds(
    nextOrder: string[],
    settings: SessionSettings = data.settings,
    plannedRounds?: Round[],
  ): Round[] {
    const rounds = plannedRounds ?? generateRounds(
          nextOrder,
          settings.rounds,
          settings.oddAttendanceMode,
          Math.random,
          false,
        );
    const prompts = settings.icebreakersEnabled
      ? selectQuestions(data.questions, settings.categories, settings.rounds)
      : [];
    return rounds.map((round, index) => ({
      ...round,
      question: prompts[index],
    }));
  }
  function previewSession(
    nextOrder = shuffle(attendees.map((member) => member.id)),
  ) {
    setPreview(createPreviewRounds(nextOrder));
    setData((current) =>
      current.session ? { ...current, session: null } : current,
    );
    setOrder(nextOrder);
    setRoundIndex(0);
    setScreen("preview");
    setError("");
  }
  function requestPreview() {
    if (attendees.length < 2) {
      setError("Select at least two people to create a networking session.");
      return;
    }
    if (data.settings.rounds < 1 || data.settings.rounds > 40) {
      setError("Choose between 1 and 40 conversation rounds.");
      return;
    }
    previewSession();
  }
  function startSession(
    sessionOrder: string[] = order,
    sessionRounds: Round[] = preview,
    participants?: TeamMember[],
    settings: SessionSettings = data.settings,
  ): SessionState | null {
    if (!sessionRounds.length) return null;
    const active: SessionState = {
      id: newId("session"),
      attendeeIds: sessionOrder,
      participants,
      rounds: sessionRounds,
      currentRound: 0,
      timer: createTimer("intro", settings.movementSeconds * 1000),
      startedAt: Date.now(),
      displayMode: data.displayMode,
      movementCompact: false,
      introSkipped: true,
      settings: { ...settings, introEnabled: false },
    };
    setData((current) => ({ ...current, session: active }));
    setScreen("round");
    setAnnounce(
      "Find your person. The first conversation starts after the travel countdown.",
    );
    return active;
  }
  async function startFromWelcome() {
    setRoomBusy(true);
    setError("");
    try {
      const created = await createRoom();
      setRoomCode(created.code);
      setHostSecret(created.hostSecret);
      setRoom(created.room);
      sessionStorage.setItem("meetup.host-room", created.code);
      sessionStorage.setItem("meetup.host-secret", created.hostSecret);
      setScreen("lobby");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not open a session room.",
      );
    } finally {
      setRoomBusy(false);
    }
  }
  async function submitPhoneJoin() {
    if (!initialRoomCode) return;
    if (!phoneSurname.trim()) {
      setError("Enter your surname to join.");
      return;
    }
    if (!phoneTeam || !phoneRole) {
      setError("Choose your team and role to join.");
      return;
    }
    setPhoneBusy(true);
    setError("");
    try {
      const firstName = phoneName.trim().replace(/\s+/g, " ");
      const surname = phoneSurname.trim().replace(/\s+/g, " ");
      const result = await joinRoom(
        initialRoomCode,
        `${firstName} ${surname}`,
        phoneTeam,
        phoneRole,
      );
      setPhoneParticipantId(result.participant.id);
      sessionStorage.setItem(
        `meetup.phone.${initialRoomCode}`,
        result.participant.id,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not join this session.",
      );
    } finally {
      setPhoneBusy(false);
    }
  }
  async function startRoomSession() {
    if (!room || !hostSecret) return;
    if (room.participants.length < MIN_ROOM_PARTICIPANTS) {
      setError(
        `At least ${MIN_ROOM_PARTICIPANTS} people need to join before the session can start.`,
      );
      return;
    }
    if (!roomRoundPlan.length) {
      setError(
        "No complete cross-team round is possible with these teams and roles. Add people from other teams before starting.",
      );
      return;
    }
    setError("");
    setRoomBusy(true);
    const participants: TeamMember[] = room.participants.map((participant) => {
      const avatar = avatarForName(participant.displayName);
      return {
        id: participant.id,
        displayName: participant.displayName,
        team: participant.team,
        role: participant.role,
        avatarId: `${avatar.palette}-${avatar.pattern}`,
        isActive: true,
        isOrganiser: false,
        createdAt: new Date(participant.joinedAt).toISOString(),
        updatedAt: new Date(participant.joinedAt).toISOString(),
      };
    });
    const settings = {
      ...data.settings,
      rounds: Math.min(data.settings.rounds, roomRoundPlan.length),
      oddAttendanceMode: "break" as const,
    };
    const sessionOrder = shuffle(
      participants.map((participant) => participant.id),
    );
    const sessionRounds = createPreviewRounds(
      sessionOrder,
      settings,
      roomRoundPlan.slice(0, settings.rounds),
    );
    const active = startSession(
      sessionOrder,
      sessionRounds,
      participants,
      settings,
    );
    try {
      if (active) {
        await startRoom(
          room.code,
          hostSecret,
          sessionRounds,
          active.timer.phase === "intro" ? "intro" : "conversation",
          active.timer.deadline ?? Date.now(),
        );
        setRoom((current) =>
          current
            ? {
                ...current,
                status: "live",
                phase:
                  active.timer.phase === "intro" ? "intro" : "conversation",
                rounds: sessionRounds,
                currentRound: 0,
                deadline: active.timer.deadline,
                remainingMs: active.timer.remainingMs,
              }
            : current,
        );
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not start the shared session.",
      );
      setData((current) => ({ ...current, session: null }));
      setScreen("lobby");
    } finally {
      setRoomBusy(false);
    }
  }
  async function addManualParticipant(displayName: string, team: string, role: string) {
    if (!roomCode || !hostSecret) return false;
    setRoomBusy(true);
    setError("");
    try {
      setRoom(
        await addManualRoomParticipant(
          roomCode,
          hostSecret,
          displayName,
          team,
          role,
        ),
      );
      return true;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not add this person to the room.",
      );
      return false;
    } finally {
      setRoomBusy(false);
    }
  }
  async function extendRoomSignupWindow() {
    if (!roomCode || !hostSecret) return;
    setRoomBusy(true);
    setError("");
    try {
      setRoom(await extendRoomSignup(roomCode, hostSecret));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not extend the sign-up window.",
      );
    } finally {
      setRoomBusy(false);
    }
  }
  async function closeCurrentRoom() {
    if (roomCode && hostSecret) {
      await closeRoom(roomCode, hostSecret).catch(() => undefined);
    }
    if (roomCode) sessionStorage.removeItem(`meetup.phone.${roomCode}`);
    sessionStorage.removeItem("meetup.host-room");
    sessionStorage.removeItem("meetup.host-secret");
    setRoom(null);
    setRoomCode(null);
    setHostSecret(null);
  }
  function skipIntro() {
    if (!session) return;
    setData((current) => ({
      ...current,
      session: current.session
        ? {
            ...current.session,
            introSkipped: true,
            timer: createTimer(
              "conversation",
              current.session.settings.conversationMinutes * 60_000,
            ),
          }
        : null,
    }));
    setScreen("round");
    setAnnounce("Round 1 is starting.");
    cue("start");
  }
  function pauseResume() {
    if (!session) return;
    const timer =
      session.timer.phase === "paused"
        ? resumeTimer(session.timer)
        : pauseTimer(session.timer);
    setData((current) => ({
      ...current,
      session: current.session ? { ...current.session, timer } : null,
    }));
    setAnnounce(
      timer.phase === "paused" ? "Session paused." : "Session resumed.",
    );
  }
  function restartRound() {
    if (!session) return;
    const isFinding =
      session.timer.phase === "intro" ||
      session.timer.previousPhase === "intro";
    setData((current) => ({
      ...current,
      session: current.session
        ? {
            ...current.session,
            timer: createTimer(
              isFinding ? "intro" : "conversation",
              isFinding
                ? current.session.settings.movementSeconds * 1000
                : current.session.settings.conversationMinutes * 60_000,
            ),
          }
        : null,
    }));
    setScreen("round");
    setAnnounce(`Round ${session.currentRound + 1} restarted.`);
    lastCue.current = "";
  }
  function skipRound() {
    if (!session) return;
    if (
      session.timer.phase === "intro" ||
      session.timer.previousPhase === "intro"
    ) {
      skipIntro();
      return;
    }
    if (session.currentRound >= session.rounds.length - 1) complete();
    else startMovement();
  }
  function recover(resume: boolean) {
    if (!session || !resume) {
      setData((current) => ({ ...current, session: null }));
      setScreen("room-setup");
      return;
    }
    const recovered =
      session.timer.phase === "paused"
        ? session
        : { ...session, timer: pauseTimer(session.timer) };
    setData((current) => ({ ...current, session: recovered }));
    const recoveredPhase =
      recovered.timer.phase === "paused"
        ? recovered.timer.previousPhase
        : recovered.timer.phase;
    setScreen(recoveredPhase === "movement" ? "movement" : "round");
    setAnnounce(
      "Session recovered and paused. Resume when your group is ready.",
    );
  }
  function finishSession() {
    void closeCurrentRoom();
    setData((current) => ({
      ...current,
      session: null,
      attendeeIds: current.settings.rememberAttendance
        ? current.attendeeIds
        : current.team
            .filter((member) => member.isActive)
            .map((member) => member.id),
    }));
    setScreen("room-setup");
    setNotice(
      "Session saved. Set up a new QR session when you’re ready.",
    );
  }
  function resetApp() {
    void closeCurrentRoom();
    setData(createDefaultData());
    setPreview([]);
    setScreen("setup");
    setPanel("session");
    setDialog(null);
    setError("");
    setNotice(
      "The original team list, questions and session settings have been restored.",
    );
  }
  function resetTeam() {
    if (session) {
      setError("End the active session before restoring the master team list.");
      return;
    }
    if (
      !window.confirm(
        "Restore the original 38-person team? Custom team members will be removed.",
      )
    )
      return;
    setData((current) => ({
      ...current,
      team: DEFAULT_TEAM,
      attendeeIds: DEFAULT_TEAM.map((member) => member.id),
    }));
    setNotice("The original 38-person team has been restored.");
  }
  function endActiveSession() {
    void closeCurrentRoom();
    setData((current) => ({
      ...current,
      session: null,
      attendeeIds: current.settings.rememberAttendance
        ? current.attendeeIds
        : current.team
            .filter((member) => member.isActive)
            .map((member) => member.id),
    }));
    setScreen("setup");
    setDialog(null);
  }
  function addMember(name: string) {
    const validation = validateDisplayName(name, data.team);
    if (validation) {
      setError(validation);
      return;
    }
    const stamp = new Date().toISOString();
    const displayName = name.trim().replace(/\s+/g, " ");
    const member: TeamMember = {
      id: newId("member"),
      displayName,
      avatarId: `${avatarForName(displayName).palette}-${avatarForName(displayName).pattern}`,
      isActive: true,
      isOrganiser: false,
      createdAt: stamp,
      updatedAt: stamp,
    };
    setData((current) => ({
      ...current,
      team: [...current.team, member],
      attendeeIds: [...current.attendeeIds, member.id],
    }));
    setNewMember("");
    setError("");
  }
  function saveMember(id: string) {
    const validation = validateDisplayName(memberDraft, data.team, id);
    if (validation) {
      setError(validation);
      return;
    }
    setData((current) => ({
      ...current,
      team: current.team.map((member) =>
        member.id === id
          ? {
              ...member,
              displayName: memberDraft.trim().replace(/\s+/g, " "),
              updatedAt: new Date().toISOString(),
            }
          : member,
      ),
    }));
    setMemberEdit(null);
    setError("");
  }
  function cycleAvatar(id: string) {
    setData((current) => ({
      ...current,
      team: current.team.map((member) => {
        if (member.id !== id) return member;
        const [palette = 0, pattern = 0] = member.avatarId
          .split("-")
          .map(Number);
        return {
          ...member,
          avatarId: `${(palette + 1) % 8}-${(pattern + 1) % 6}`,
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
  }
  function removeMember(member: TeamMember) {
    if (
      member.isOrganiser ||
      !window.confirm(`Remove ${member.displayName} from the team?`)
    )
      return;
    setData((current) => ({
      ...current,
      team: current.team.filter((item) => item.id !== member.id),
      attendeeIds: current.attendeeIds.filter((id) => id !== member.id),
    }));
  }
  function importNames() {
    const names = pasteNames
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean);
    const pending: TeamMember[] = [];
    for (const name of names) {
      const validation = validateDisplayName(name, [...data.team, ...pending]);
      if (validation) {
        setError(`${name}: ${validation}`);
        return;
      }
      const stamp = new Date().toISOString();
      pending.push({
        id: newId("member"),
        displayName: name.replace(/\s+/g, " "),
        avatarId: `${avatarForName(name).palette}-${avatarForName(name).pattern}`,
        isActive: true,
        isOrganiser: false,
        createdAt: stamp,
        updatedAt: stamp,
      });
    }
    setData((current) => ({
      ...current,
      team: [...current.team, ...pending],
      attendeeIds: [
        ...current.attendeeIds,
        ...pending.map((member) => member.id),
      ],
    }));
    setPasteNames("");
    setError("");
    setNotice(
      `${pending.length} team member${pending.length === 1 ? "" : "s"} added.`,
    );
  }
  function saveQuestion() {
    const prompt = questionDraft.trim();
    if (prompt.length < 8) {
      setError("Write a question of at least 8 characters.");
      return;
    }
    if (questionEdit)
      setData((current) => ({
        ...current,
        questions: current.questions.map((question) =>
          question.id === questionEdit
            ? { ...question, prompt, category: questionCategory }
            : question,
        ),
      }));
    else {
      const question: IcebreakerQuestion = {
        id: newId("question"),
        prompt,
        category: questionCategory,
        enabled: true,
        custom: true,
      };
      setData((current) => ({
        ...current,
        questions: [...current.questions, question],
      }));
    }
    setQuestionDraft("");
    setQuestionEdit(null);
    setError("");
  }
  function fullscreenToggle() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
    setFullscreen(!fullscreen);
  }
  function setDisplayMode(mode: "room" | "focus") {
    setData((current) => ({
      ...current,
      displayMode: mode,
      session: current.session
        ? { ...current.session, displayMode: mode }
        : null,
    }));
  }

  const nextRoundData = session?.rounds[(session.currentRound ?? 0) + 1];
  const summary = session
    ? {
        attendees: session.attendeeIds.length,
        rounds: session.rounds.length,
        conversations: countConversations(session.rounds),
        duration: Math.max(
          0,
          Math.round((Date.now() - (session.startedAt ?? Date.now())) / 1000),
        ),
        prompts: session.rounds.filter((round) => round.question).length,
      }
    : null;
  const joinUrl = roomCode
    ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomCode)}`
    : "";

  return (
    <div
      className={`app-shell${data.settings.highContrast ? " high-contrast" : ""}`}
    >
      <header className="topbar">
        <button
          className="brand-lockup"
          type="button"
          onClick={() => {
            if (!session) setScreen("welcome");
          }}
          aria-label={`${APP_NAME}, home`}
        >
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="brand-name">
            {APP_NAME}
            <small>A SIMPLE WAY TO NETWORK.</small>
          </span>
        </button>
        <div className="topbar-right">
          {screen === "welcome" && (
            <button
              className="dashboard-link"
              type="button"
              onClick={() => {
                setError("");
                setScreen("setup");
              }}
            >
              <Settings2 size={15} /> Dashboard
            </button>
          )}
          <span className="live-indicator">
            <i /> LOCAL SESSION
          </span>
          {session && (
            <span className="session-top-count">
              <Users size={15} /> {session.attendeeIds.length} people
            </span>
          )}
          <button
            className="icon-button"
            type="button"
            onClick={() =>
              updateSetting("soundEnabled", !data.settings.soundEnabled)
            }
            aria-label={
              data.settings.soundEnabled ? "Mute sound" : "Enable sound"
            }
            title={data.settings.soundEnabled ? "Mute sound" : "Enable sound"}
          >
            {data.settings.soundEnabled ? (
              <Volume2 size={18} />
            ) : (
              <VolumeX size={18} />
            )}
          </button>
        </div>
      </header>
      <main className="app-main">
        {notice && (
          <div className="notice" role="status">
            <Sparkles size={16} />
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss message"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {screen === "lobby" && room && (
          <RoomLobbyScreen
            room={room}
            joinUrl={joinUrl}
            signupRemaining={signupRemaining}
            busy={roomBusy}
            settings={data.settings}
            roundLimit={roomRoundPlan.length}
            onMeetCountChange={(count) => updateSetting("rounds", count)}
            onStart={() => void startRoomSession()}
            onAddParticipant={addManualParticipant}
            onExtendSignup={() => void extendRoomSignupWindow()}
            onClose={() =>
              void closeCurrentRoom().then(() => setScreen("welcome"))
            }
          />
        )}
        {screen === "lobby" && !room && (
          <section className="room-loading" role="status">
            <p className="section-kicker">TEMPORARY SESSION</p>
            <h1>{error ? "This room is unavailable" : "Opening your room…"}</h1>
            {error && (
              <button
                className="primary-button"
                type="button"
                onClick={() =>
                  void closeCurrentRoom().then(() => {
                    setError("");
                    setScreen("room-setup");
                  })
                }
              >
                Set up a new session
              </button>
            )}
          </section>
        )}
        {screen === "phone" && initialRoomCode && !phoneParticipantId && (
          <PhoneJoinScreen
            code={initialRoomCode}
            name={phoneName}
            surname={phoneSurname}
            team={phoneTeam}
            role={phoneRole}
            busy={phoneBusy}
            error={error}
            onNameChange={setPhoneName}
            onSurnameChange={setPhoneSurname}
            onTeamChange={setPhoneTeam}
            onRoleChange={setPhoneRole}
            onSubmit={() => void submitPhoneJoin()}
          />
        )}
        {screen === "phone" &&
          initialRoomCode &&
          phoneParticipantId &&
          (phoneView ? (
            <PhoneAssignmentScreen
              view={phoneView}
              remaining={phoneRemaining}
              onRejoin={() => {
                sessionStorage.removeItem(`meetup.phone.${initialRoomCode}`);
                setPhoneParticipantId("");
                setPhoneView(null);
              }}
            />
          ) : (
            <section className="phone-loading" role="status">
              <p className="section-kicker">{APP_NAME}</p>
              <h1>Rejoining your session…</h1>
            </section>
          ))}
        {screen === "welcome" && (
          <WelcomeScreen onStart={() => setScreen("room-setup")} />
        )}
        {screen === "room-setup" && (
          <RoomSetupScreen
            settings={data.settings}
            categories={categories.filter((category) =>
              data.questions.some((question) => question.category === category),
            )}
            busy={roomBusy}
            onUpdate={updateSetting}
            onCreate={() => void startFromWelcome()}
            onBack={() => {
              setError("");
              setScreen("welcome");
            }}
          />
        )}
        {screen === "setup" && (
          <>
            <button
              className="setup-home-link"
              type="button"
              onClick={() => setScreen("welcome")}
            >
              <ArrowLeft size={15} aria-hidden="true" /> TITLE SCREEN
            </button>
            <nav
              className="setup-nav"
              role="tablist"
              aria-label="Organizer setup"
            >
              <button
                role="tab"
                aria-selected={panel === "session"}
                className={panel === "session" ? "active" : ""}
                onClick={() => setPanel("session")}
              >
                <Users size={16} /> Session setup
              </button>
              <button
                role="tab"
                aria-selected={panel === "questions"}
                className={panel === "questions" ? "active" : ""}
                onClick={() => setPanel("questions")}
              >
                <MessageSquareText size={16} /> Icebreakers{" "}
                <b>{data.questions.filter((q) => q.enabled).length}</b>
              </button>
              <button
                role="tab"
                aria-selected={panel === "accessibility"}
                className={panel === "accessibility" ? "active" : ""}
                onClick={() => setPanel("accessibility")}
              >
                <Accessibility size={16} /> Sound & access
              </button>
            </nav>
            {panel === "session" && (
              <SessionDashboard
                settings={data.settings}
                duration={calculateDurationSeconds(data.settings)}
                onUpdate={updateSetting}
                onStart={() => void startFromWelcome()}
                onReset={() => setDialog("reset")}
              />
            )}
            {panel === "legacy-session" && (
              <div className="setup-layout">
                <section className="setup-panel team-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="section-kicker">YOUR PEOPLE</p>
                      <h2>Build your guest list</h2>
                      <p className="panel-subtitle">
                        Choose who is joining this session.
                      </p>
                    </div>
                    <div className="attendance-badge">
                      <strong>{attendees.length}</strong>
                      <span>ATTENDING</span>
                    </div>
                  </div>
                  <div className="team-toolbar">
                    <label className="search-box">
                      <Search size={16} />
                      <span className="sr-only">Search team members</span>
                      <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Find someone"
                      />
                    </label>
                    <div className="selection-actions">
                      <button
                        className="text-button"
                        onClick={() => selectAll(true)}
                      >
                        Select all
                      </button>
                      <i />
                      <button
                        className="text-button"
                        onClick={() => selectAll(false)}
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                  <div className="team-list" aria-label="Team members">
                    {filteredMembers.map((member) => (
                      <div
                        className={`member-row${data.attendeeIds.includes(member.id) ? " selected" : ""}`}
                        key={member.id}
                      >
                        <label className="member-choice">
                          <input
                            type="checkbox"
                            checked={data.attendeeIds.includes(member.id)}
                            onChange={() =>
                              setData((current) => ({
                                ...current,
                                attendeeIds: current.attendeeIds.includes(
                                  member.id,
                                )
                                  ? current.attendeeIds.filter(
                                      (id) => id !== member.id,
                                    )
                                  : [...current.attendeeIds, member.id],
                              }))
                            }
                            aria-label={`${data.attendeeIds.includes(member.id) ? "Remove" : "Select"} ${member.displayName}`}
                          />
                          <span className="member-name">
                            {memberEdit === member.id ? (
                              <input
                                autoFocus
                                value={memberDraft}
                                onChange={(event) =>
                                  setMemberDraft(event.target.value)
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter")
                                    saveMember(member.id);
                                  if (event.key === "Escape")
                                    setMemberEdit(null);
                                }}
                                aria-label={`Edit ${member.displayName}`}
                              />
                            ) : (
                              member.displayName
                            )}
                            {member.isOrganiser && <em>ORGANISER</em>}
                          </span>
                        </label>
                        <div className="member-actions">
                          {memberEdit === member.id ? (
                            <>
                              <button
                                onClick={() => saveMember(member.id)}
                                aria-label={`Save ${member.displayName}`}
                              >
                                <Check size={15} />
                              </button>
                              <button
                                onClick={() => setMemberEdit(null)}
                                aria-label="Cancel edit"
                              >
                                <X size={15} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => cycleAvatar(member.id)}
                                aria-label={`Change avatar for ${member.displayName}`}
                                title="Change avatar"
                              >
                                <Shuffle size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  setMemberEdit(member.id);
                                  setMemberDraft(member.displayName);
                                  setError("");
                                }}
                                aria-label={`Edit ${member.displayName}`}
                                title="Edit member"
                              >
                                <Settings2 size={15} />
                              </button>
                              <button
                                onClick={() => removeMember(member)}
                                aria-label={`Remove ${member.displayName}`}
                                title="Remove member"
                              >
                                <X size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {filteredMembers.length === 0 && (
                      <p className="empty-note">
                        No team members match “{search}”.
                      </p>
                    )}
                  </div>
                  <form
                    className="add-member-row"
                    onSubmit={(event) => {
                      event.preventDefault();
                      addMember(newMember);
                    }}
                  >
                    <label className="sr-only" htmlFor="new-member">
                      Add a team member
                    </label>
                    <input
                      id="new-member"
                      value={newMember}
                      onChange={(event) => setNewMember(event.target.value)}
                      placeholder="Add a name, e.g. Morgan T"
                    />
                    <button className="mini-add">
                      <Plus size={17} /> Add
                    </button>
                  </form>
                  <details className="bulk-import">
                    <summary>
                      Paste multiple names <span>⌄</span>
                    </summary>
                    <label className="sr-only" htmlFor="paste-names">
                      One name per line
                    </label>
                    <textarea
                      id="paste-names"
                      rows={4}
                      value={pasteNames}
                      onChange={(event) => setPasteNames(event.target.value)}
                      placeholder={"Morgan T\nTaylor K"}
                    />
                    <button
                      className="secondary-button compact"
                      onClick={importNames}
                    >
                      Add names
                    </button>
                  </details>
                  <div className="team-footer">
                    <span>{data.team.length} people in your master list</span>
                    <button className="text-button" onClick={resetTeam}>
                      Reset original team
                    </button>
                  </div>
                </section>
                <aside className="setup-rail">
                  <section className="settings-panel">
                    <div className="panel-heading compact-heading">
                      <div>
                        <p className="section-kicker">THE FORMAT</p>
                        <h2>Session settings</h2>
                      </div>
                      <Settings2 size={18} />
                    </div>
                    <div className="setting-row">
                      <label htmlFor="round-count">Conversation rounds</label>
                      <div className="stepper">
                        <button
                          onClick={() =>
                            updateSetting(
                              "rounds",
                              Math.max(1, data.settings.rounds - 1),
                            )
                          }
                          aria-label="Fewer rounds"
                        >
                          −
                        </button>
                        <input
                          id="round-count"
                          type="number"
                          min="1"
                          max="40"
                          value={data.settings.rounds}
                          onChange={(event) =>
                            updateSetting(
                              "rounds",
                              clamp(Number(event.target.value), 1, 40),
                            )
                          }
                        />
                        <button
                          onClick={() =>
                            updateSetting(
                              "rounds",
                              Math.min(40, data.settings.rounds + 1),
                            )
                          }
                          aria-label="More rounds"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="setting-row">
                      <label htmlFor="talk-time">Conversation time</label>
                      <select
                        id="talk-time"
                        value={data.settings.conversationMinutes}
                        onChange={(event) =>
                          updateSetting(
                            "conversationMinutes",
                            Number(event.target.value),
                          )
                        }
                      >
                        {Array.from({ length: 10 }, (_, i) => i + 1).map(
                          (minute) => (
                            <option value={minute} key={minute}>
                              {minute} min
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                    <div className="setting-row">
                      <label htmlFor="move-time">Transition time</label>
                      <select
                        id="move-time"
                        value={data.settings.movementSeconds}
                        onChange={(event) =>
                          updateSetting(
                            "movementSeconds",
                            Number(event.target.value),
                          )
                        }
                      >
                        {[10, 15, 20, 30, 45, 60, 90, 120].map((seconds) => (
                          <option value={seconds} key={seconds}>
                            {seconds} sec
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="setting-divider" />
                    <Toggle
                      label="Icebreaker prompts"
                      detail="One fresh prompt per round"
                      checked={data.settings.icebreakersEnabled}
                      onChange={(value) =>
                        updateSetting("icebreakersEnabled", value)
                      }
                    />
                    <Toggle
                      label="Join the session"
                      detail="Add Kerry M to the guest list"
                      checked={data.settings.organiserParticipates}
                      onChange={(value) =>
                        updateSetting("organiserParticipates", value)
                      }
                    />
                    <Toggle
                      label="Auto-advance rounds"
                      detail="Continue when movement ends"
                      checked={data.settings.autoAdvance}
                      onChange={(value) => updateSetting("autoAdvance", value)}
                    />
                    <div className="duration-summary">
                      <div>
                        <Clock3 size={18} />
                      </div>
                      <p>
                        <span>ESTIMATED SESSION</span>
                        <strong>{formatDuration(duration)}</strong>
                        <small>
                          {attendees.length} people ·{" "}
                          {Math.floor(attendees.length / 2)} conversations each
                          round ·{" "}
                          {Math.floor(attendees.length / 2) *
                            data.settings.rounds}{" "}
                          conversations
                        </small>
                      </p>
                    </div>
                    {duration > 35 * 60 && (
                      <p className="warning-line" role="status">
                        This format runs longer than 35 minutes.
                      </p>
                    )}
                    {attendees.length < 2 && (
                      <p className="warning-line" role="status">
                        Select at least two people to continue.
                      </p>
                    )}
                    <button
                      className="primary-button full-width"
                      onClick={requestPreview}
                      disabled={attendees.length < 2}
                    >
                      Preview pairings
                    </button>
                  </section>
                  <section className="host-note">
                    <Sparkles size={16} />
                    <p>
                      <strong>A note for the host</strong>
                      <span>
                        New conversation groups are generated for every round.
                      </span>
                    </p>
                  </section>
                  <div className="remember-row">
                    <Toggle
                      label="Remember attendance"
                      detail="Keep this selection next time"
                      checked={data.settings.rememberAttendance}
                      onChange={(value) =>
                        updateSetting("rememberAttendance", value)
                      }
                    />
                    <button
                      className="text-button"
                      onClick={() => setDialog("reset")}
                    >
                      Reset app data
                    </button>
                  </div>
                </aside>
              </div>
            )}
            {panel === "questions" && (
              <section className="questions-panel">
                <div className="panel-heading">
                  <div>
                    <p className="section-kicker">
                      GOOD CONVERSATIONS START SOMEWHERE
                    </p>
                    <h2>Icebreaker library</h2>
                    <p className="panel-subtitle">
                      Choose prompts that feel right for your team.
                    </p>
                  </div>
                  <span className="question-total">
                    {data.questions.filter((q) => q.enabled).length} ACTIVE
                  </span>
                </div>
                <form
                  className="question-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveQuestion();
                  }}
                >
                  <label className="sr-only" htmlFor="question-input">
                    Question or activity
                  </label>
                  <input
                    id="question-input"
                    value={questionDraft}
                    onChange={(event) => setQuestionDraft(event.target.value)}
                    placeholder="Add a conversation prompt..."
                  />
                  <label className="sr-only" htmlFor="question-category">
                    Category
                  </label>
                  <select
                    id="question-category"
                    value={questionCategory}
                    onChange={(event) =>
                      setQuestionCategory(
                        event.target.value as IcebreakerCategory,
                      )
                    }
                  >
                    {categories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                  <button className="primary-button">
                    <Plus size={16} />{" "}
                    {questionEdit ? "Save edit" : "Add prompt"}
                  </button>
                  {questionEdit && (
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => {
                        setQuestionEdit(null);
                        setQuestionDraft("");
                      }}
                      aria-label="Cancel editing"
                    >
                      <X size={17} />
                    </button>
                  )}
                </form>
                <div className="question-groups">
                  {categories.filter((category) =>
                    data.questions.some((question) => question.category === category),
                  ).map((category) => (
                    <div className="question-group" key={category}>
                      <h3>
                        {category}
                        <span>
                          {
                            data.questions.filter(
                              (q) => q.category === category && q.enabled,
                            ).length
                          }{" "}
                          active
                        </span>
                      </h3>
                      {data.questions
                        .filter((question) => question.category === category)
                        .map((question) => (
                          <div
                            className={`question-row${question.enabled ? "" : " disabled"}`}
                            key={question.id}
                          >
                            <label>
                              <input
                                type="checkbox"
                                checked={question.enabled}
                                onChange={() =>
                                  setData((current) => ({
                                    ...current,
                                    questions: current.questions.map((item) =>
                                      item.id === question.id
                                        ? { ...item, enabled: !item.enabled }
                                        : item,
                                    ),
                                  }))
                                }
                              />
                              <span>{question.prompt}</span>
                            </label>
                            <div>
                              <button
                                className="member-action-button"
                                onClick={() => {
                                  setQuestionEdit(question.id);
                                  setQuestionDraft(question.prompt);
                                  setQuestionCategory(question.category);
                                }}
                                aria-label={`Edit: ${question.prompt}`}
                              >
                                <Settings2 size={14} />
                              </button>
                              {question.custom && (
                                <button
                                  className="member-action-button"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Delete “${question.prompt}”?`,
                                      )
                                    )
                                      setData((current) => ({
                                        ...current,
                                        questions: current.questions.filter(
                                          (item) => item.id !== question.id,
                                        ),
                                      }));
                                  }}
                                  aria-label={`Delete: ${question.prompt}`}
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
                <div className="question-footer">
                  <span>
                    {data.questions.length} prompts · no repeats within a
                    session
                  </span>
                  <button
                    className="text-button"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Restore the original icebreaker question bank? Custom questions will be removed.",
                        )
                      )
                        setData((current) => ({
                          ...current,
                          questions: DEFAULT_QUESTIONS,
                        }));
                    }}
                  >
                    Restore default questions
                  </button>
                </div>
              </section>
            )}
            {panel === "accessibility" && (
              <section className="preferences-panel">
                <p className="section-kicker">MAKE IT YOURS</p>
                <h2>Sound & access</h2>
                <p className="panel-subtitle">
                  Every session works without sound or motion.
                </p>
                <div className="preferences-grid">
                  <div className="preference-block">
                    <Toggle
                      label="Sound cues"
                      detail="Short signals for round changes"
                      checked={data.settings.soundEnabled}
                      onChange={(value) => updateSetting("soundEnabled", value)}
                    />
                    <label className="range-label" htmlFor="volume">
                      Volume{" "}
                      <span>
                        {Math.round(data.settings.soundVolume * 100)}%
                      </span>
                    </label>
                    <input
                      id="volume"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={data.settings.soundVolume}
                      onChange={(event) =>
                        updateSetting("soundVolume", Number(event.target.value))
                      }
                    />
                    <button
                      className="secondary-button compact"
                      onClick={() => cue("start")}
                    >
                      Test sound
                    </button>
                  </div>
                  <div className="preference-block">
                    <Toggle
                      label="Closing animation"
                      detail="A quiet finish after the final round"
                      checked={data.settings.outroEnabled}
                      onChange={(value) => updateSetting("outroEnabled", value)}
                    />
                    <Toggle
                      label="High contrast"
                      detail="Strengthen interface contrast"
                      checked={data.settings.highContrast}
                      onChange={(value) => updateSetting("highContrast", value)}
                    />
                    <p className="accessibility-note">
                      <Accessibility size={16} /> Reduced-motion settings from
                      your device are respected.
                    </p>
                  </div>
                </div>
                <div className="display-setting">
                  <h3>Room display</h3>
                  <div className="segmented">
                    <button
                      className={data.displayMode === "room" ? "selected" : ""}
                      onClick={() => setDisplayMode("room")}
                    >
                      <Monitor size={15} /> Full room
                    </button>
                    <button
                      className={data.displayMode === "focus" ? "selected" : ""}
                      onClick={() => setDisplayMode("focus")}
                    >
                      <Expand size={15} /> Focus view
                    </button>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
        {screen === "preview" && (
          <PreviewScreen
            rounds={preview}
            members={data.team}
            order={order}
            selected={roundIndex}
            duration={duration}
            settings={data.settings}
            repeats={repeats}
            onSelect={setRoundIndex}
            onBack={() => setScreen("setup")}
            onRegenerate={() => previewSession()}
            onStart={startSession}
          />
        )}
        {screen === "recovery" && session && (
          <section className="recovery-screen">
            <div className="recovery-people" aria-hidden="true">
              <BusinessPeopleArt pairIndex={0} />
            </div>
            <div className="recovery-copy">
              <p className="section-kicker">WELCOME BACK</p>
              <h1>Your session is saved.</h1>
              <p className="recovery-summary">
                {session.attendeeIds.length} people · Round{" "}
                {session.currentRound + 1} of {session.rounds.length}
              </p>
              <p>Your timer will stay paused until you’re ready.</p>
              <div className="button-row">
                <button className="primary-button" onClick={() => recover(true)}>
                  Return to session
                </button>
                <button
                  className="secondary-button"
                  onClick={() => recover(false)}
                >
                  Start fresh
                </button>
              </div>
            </div>
          </section>
        )}
        {screen === "intro" && session && (
          <IntroScreen
            count={session.attendeeIds.length}
            remaining={remaining}
            onSkip={skipIntro}
          />
        )}
        {screen === "round" && session && currentRound && (
          <RoundScreen
            session={session}
            round={currentRound}
            members={session.participants ?? data.team}
            remaining={remaining}
            paused={session.timer.phase === "paused"}
            onDisplay={() =>
              setDisplayMode(session.displayMode === "room" ? "focus" : "room")
            }
            onFullscreen={fullscreenToggle}
            onBegin={skipIntro}
          />
        )}
        {screen === "movement" && session && (
          <MovementScreen
            session={session}
            nextRound={nextRoundData}
            members={session.participants ?? data.team}
            remaining={remaining}
            onNext={() => nextRound(session)}
          />
        )}
        {screen === "complete" && session && summary && (
          <CompletionScreen
            summary={summary}
            onAgain={() => {
              const selected = session.attendeeIds.filter(
                (id) => id !== "organiser-kerry-m",
              );
              setData((current) => ({ ...current, attendeeIds: selected }));
              setScreen("setup");
              setPanel("session");
              previewSession(selected);
            }}
            onChange={finishSession}
            onReset={() => setDialog("reset")}
          />
        )}
        {screen === "setup" && panel === "questions" && (
          <section className="session-categories">
            <div>
              <p className="section-kicker">SESSION FILTER</p>
              <h2>Use these categories</h2>
              <p>Only enabled prompts in selected categories will be used.</p>
            </div>
            <div className="category-options">
              {categories.map((category) => (
                <label key={category}>
                  <input
                    type="checkbox"
                    checked={data.settings.categories.includes(category)}
                    onChange={() =>
                      setData((current) => ({
                        ...current,
                        settings: {
                          ...current.settings,
                          categories: current.settings.categories.includes(
                            category,
                          )
                            ? current.settings.categories.filter(
                                (item) => item !== category,
                              )
                            : [...current.settings.categories, category],
                        },
                      }))
                    }
                  />
                  {category}
                </label>
              ))}
            </div>
          </section>
        )}
      </main>
      {session && ["round", "movement"].includes(screen) && (
        <SessionDock
          session={session}
          onPause={pauseResume}
          onRestart={restartRound}
          onSkip={screen === "movement" ? () => nextRound(session) : skipRound}
          onEnd={() => setDialog("end")}
          onFullscreen={fullscreenToggle}
          soundEnabled={data.settings.soundEnabled}
          onSoundToggle={() =>
            updateSetting("soundEnabled", !data.settings.soundEnabled)
          }
          onDisplay={() =>
            setDisplayMode(session.displayMode === "room" ? "focus" : "room")
          }
        />
      )}
      <footer className="app-footer">
        <span>MADE FOR PEOPLE WHO WORK TOGETHER</span>
        <span>
          {APP_NAME} <i>·</i> {new Date().getFullYear()}
        </span>
      </footer>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </div>
      {dialog && (
        <ConfirmDialog
          title={
            dialog === "reset" ? `Reset ${APP_NAME}?` : "End this session?"
          }
          body={
            dialog === "reset"
              ? "This restores the original team and questions, and clears saved session settings."
              : "The current round will end and your session summary will be lost."
          }
          confirm={dialog === "reset" ? "Reset app" : "End session"}
          onCancel={() => setDialog(null)}
          onConfirm={dialog === "reset" ? resetApp : endActiveSession}
        />
      )}
    </div>
  );
}

function Toggle({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        {detail && <small>{detail}</small>}
      </span>
      <input
        className="switch-input"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <i className="switch-track">
        <b />
      </i>
    </label>
  );
}

function SessionDashboard({
  settings,
  duration,
  onUpdate,
  onStart,
  onReset,
}: {
  settings: SessionSettings;
  duration: number;
  onUpdate: <K extends keyof SessionSettings>(
    key: K,
    value: SessionSettings[K],
  ) => void;
  onStart: () => void;
  onReset: () => void;
}) {
  return (
    <section className="clean-session-dashboard">
      <header className="clean-page-heading">
        <div>
          <p className="section-kicker">HOST DASHBOARD</p>
          <h1>Session setup</h1>
          <p>Set the rhythm, then open a temporary QR room for your team.</p>
        </div>
        <button className="text-button" type="button" onClick={onReset}>
          Reset app
        </button>
      </header>
      <div className="dashboard-settings-grid">
        <section className="dashboard-settings-panel">
          <div className="dashboard-section-heading">
            <div>
              <p className="section-kicker">SESSION FORMAT</p>
              <h2>Conversation rhythm</h2>
            </div>
            <Clock3 size={19} />
          </div>
          <div className="dashboard-setting-row">
            <label htmlFor="dashboard-rounds">Rounds</label>
            <div className="stepper">
              <button
                type="button"
                aria-label="Fewer rounds"
                onClick={() =>
                  onUpdate("rounds", Math.max(1, settings.rounds - 1))
                }
              >
                −
              </button>
              <input
                id="dashboard-rounds"
                type="number"
                min="1"
                max="40"
                value={settings.rounds}
                onChange={(event) =>
                  onUpdate("rounds", clamp(Number(event.target.value), 1, 40))
                }
              />
              <button
                type="button"
                aria-label="More rounds"
                onClick={() =>
                  onUpdate("rounds", Math.min(40, settings.rounds + 1))
                }
              >
                +
              </button>
            </div>
          </div>
          <div className="dashboard-setting-row">
            <label htmlFor="dashboard-talk-time">Conversation time</label>
            <select
              id="dashboard-talk-time"
              value={settings.conversationMinutes}
              onChange={(event) =>
                onUpdate("conversationMinutes", Number(event.target.value))
              }
            >
              {Array.from({ length: 10 }, (_, index) => index + 1).map(
                (minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes
                  </option>
                ),
              )}
            </select>
          </div>
          <div className="dashboard-setting-row">
            <label htmlFor="dashboard-move-time">Transition time</label>
            <select
              id="dashboard-move-time"
              value={settings.movementSeconds}
              onChange={(event) =>
                onUpdate("movementSeconds", Number(event.target.value))
              }
            >
              {[10, 15, 20, 30, 45, 60, 90, 120].map((seconds) => (
                <option key={seconds} value={seconds}>
                  {seconds} seconds
                </option>
              ))}
            </select>
          </div>
        </section>
        <aside className="dashboard-summary-panel">
          <p className="section-kicker">ESTIMATED SESSION</p>
          <strong>{formatDuration(duration)}</strong>
          <span>
            {settings.rounds} rounds · {settings.conversationMinutes} minutes
            each
          </span>
          <div
            className="dashboard-round-rhythm"
            aria-label={`${settings.rounds} rounds`}
          >
            {Array.from({ length: settings.rounds }, (_, index) => (
              <i key={index} />
            ))}
          </div>
          <Toggle
            label="Icebreaker prompts"
            detail="Use one prompt per round"
            checked={settings.icebreakersEnabled}
            onChange={(value) => onUpdate("icebreakersEnabled", value)}
          />
          <Toggle
            label="Auto-advance"
            detail="Start after transition time"
            checked={settings.autoAdvance}
            onChange={(value) => onUpdate("autoAdvance", value)}
          />
          <button
            className="primary-button dashboard-start-button"
            type="button"
            onClick={onStart}
          >
            Open QR room
          </button>
        </aside>
      </div>
    </section>
  );
}

function RoomSetupScreen({
  settings,
  categories,
  busy,
  onUpdate,
  onCreate,
  onBack,
}: {
  settings: SessionSettings;
  categories: IcebreakerCategory[];
  busy: boolean;
  onUpdate: <K extends keyof SessionSettings>(
    key: K,
    value: SessionSettings[K],
  ) => void;
  onCreate: () => void;
  onBack: () => void;
}) {
  return (
    <section className="room-setup-screen">
      <button className="back-button character-back-button" type="button" onClick={onBack}>
        <span aria-hidden="true"><BusinessPeopleArt pointingLeft /></span>
        Back
      </button>
      <header className="room-setup-heading">
        <div>
          <p className="section-kicker">NEW SESSION</p>
          <h1>Session setup</h1>
        </div>
      </header>
      <div className="room-setup-layout">
        <section className="room-setup-fields" aria-label="Session timing">
          <h2>Timing</h2>
          <div className="room-setup-field">
            <label htmlFor="room-talk-time">Length per meeting</label>
            <div className="setup-select-control">
              <select
                id="room-talk-time"
                value={settings.conversationMinutes}
                onChange={(event) =>
                  onUpdate("conversationMinutes", Number(event.target.value))
                }
              >
                {Array.from({ length: 10 }, (_, index) => index + 1).map(
                  (minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} {minutes === 1 ? "minute" : "minutes"}
                    </option>
                  ),
                )}
              </select>
              <ChevronDown size={18} aria-hidden="true" />
            </div>
          </div>
          <div className="room-setup-field">
            <label htmlFor="room-transition-time">
              Time to find each other
            </label>
            <div className="setup-select-control">
              <select
                id="room-transition-time"
                value={settings.movementSeconds}
                onChange={(event) =>
                  onUpdate("movementSeconds", Number(event.target.value))
                }
              >
                {[10, 15, 20, 30, 45, 60, 90, 120].map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds === 30
                      ? "30 seconds (recommended)"
                      : `${seconds} seconds`}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} aria-hidden="true" />
            </div>
          </div>
        </section>
        <section className="room-setup-options" aria-label="Session options">
          <h2>Session options</h2>
          <div className="room-setup-toggles">
            <Toggle
              label="Icebreaker prompts"
              checked={settings.icebreakersEnabled}
              onChange={(value) => onUpdate("icebreakersEnabled", value)}
            />
            <Toggle
              label="Auto-advance rounds"
              checked={settings.autoAdvance}
              onChange={(value) => onUpdate("autoAdvance", value)}
            />
            <Toggle
              label="Sound cues"
              checked={settings.soundEnabled}
              onChange={(value) => onUpdate("soundEnabled", value)}
            />
          </div>
          {settings.icebreakersEnabled && (
            <fieldset className="room-theme-picker">
              <legend>Icebreaker themes</legend>
              <div className="room-theme-options">
                {categories.map((category) => {
                  const selected = settings.categories.includes(category);
                  return (
                    <label
                      key={category}
                      className={selected ? "selected" : ""}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={selected && settings.categories.length === 1}
                        onChange={() =>
                          onUpdate(
                            "categories",
                            selected
                              ? settings.categories.filter(
                                  (item) => item !== category,
                                )
                              : [...settings.categories, category],
                          )
                        }
                      />
                      <span>{category}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
        </section>
        <aside className="room-setup-summary" aria-label="Session summary">
          <h2>Your session</h2>
          <div className="room-setup-total">
            <span>LENGTH PER MEETING</span>
            <strong>{settings.conversationMinutes} min</strong>
            <small>{settings.movementSeconds} seconds finding time</small>
            <div className="setup-character-stage" aria-hidden="true">
              <BusinessPeopleArt single />
            </div>
          </div>
          <p>Round limits are calculated from teams and roles once everyone joins.</p>
          <button
            className="primary-button"
            type="button"
            onClick={onCreate}
            disabled={busy}
          >
            {busy ? "Opening room…" : "Start session"}
          </button>
          <p className="room-setup-signup">3-minute QR signup window</p>
        </aside>
      </div>
    </section>
  );
}

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <section className="game-title-screen">
      <div className="game-title-copy">
        <div className="welcome-brand">
          <p className="game-overline">A SIMPLE WAY TO NETWORK.</p>
        </div>
        <h1>{APP_NAME}</h1>
        <p className="game-subtitle">
          Bring your team together for short, timed conversations. Join by QR,
          meet a new person each round, and make more connections.
        </p>
        <div className="welcome-actions">
          <button className="game-start-button" type="button" onClick={onStart}>
            Set up session
          </button>
          <IntroMusicButton />
        </div>
      </div>
      <BusinessPeopleArt />
    </section>
  );
}

function RoomLobbyScreen({
  room,
  joinUrl,
  signupRemaining,
  busy,
  settings,
  roundLimit,
  onMeetCountChange,
  onAddParticipant,
  onExtendSignup,
  onStart,
  onClose,
}: {
  room: SharedRoom;
  joinUrl: string;
  signupRemaining: number;
  busy: boolean;
  settings: SessionSettings;
  roundLimit: number;
  onMeetCountChange: (count: number) => void;
  onAddParticipant: (displayName: string, team: string, role: string) => Promise<boolean>;
  onExtendSignup: () => void;
  onStart: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualTeam, setManualTeam] = useState("");
  const [manualRole, setManualRole] = useState("");
  const meetingCount = Math.min(settings.rounds, roundLimit);
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  return (
    <section className="room-lobby-screen">
      <header className="clean-page-heading">
        <div>
          <h1>Scan to join</h1>
          <p>Open your phone camera and scan the code to check in.</p>
        </div>
        <button className="secondary-button" type="button" onClick={onClose}>
          Cancel session
        </button>
      </header>
      <div className="room-lobby-layout">
        <section className="room-qr-panel">
          <p className="section-kicker">SCAN WITH YOUR PHONE</p>
          <div className="qr-frame">
            <QRCodeSVG
              value={joinUrl}
              size={440}
              level="M"
              includeMargin
              role="img"
              aria-label="Scan to join this session"
            />
          </div>
          <div className="room-qr-actions">
            <div className="room-code-row">
              <span>ROOM CODE</span>
              <strong>{room.code.toUpperCase()}</strong>
            </div>
            <button
              className="secondary-button copy-link-button"
              type="button"
              onClick={() => void copyLink()}
            >
              {copied && <Check size={16} />}
              {copied ? "Link copied" : "Copy join link"}
            </button>
          </div>
        </section>
        <section className="room-attendees-panel">
          <div className="room-attendees-heading">
            <div>
              <p className="section-kicker">
                CHECKED IN
                <span
                  className={`room-live-dot${signupRemaining > 0 ? " open" : ""}`}
                  aria-label={signupRemaining > 0 ? "Sign-up open" : "Sign-up closed"}
                />
              </p>
              <h2>{room.participants.length} people joined</h2>
            </div>
            <div className="signup-countdown">
              <span>SIGN-UP CLOSES IN</span>
              <strong>{formatClock(signupRemaining)}</strong>
            </div>
          </div>
          {room.participants.length ? (
            <ol className="room-attendee-list">
              {room.participants.map((participant, index) => (
                <li key={participant.id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{participant.displayName}</strong>
                  <Check size={15} aria-label="Ready" />
                </li>
              ))}
            </ol>
          ) : (
            <div className="room-empty-state">
              <div aria-hidden="true"><BusinessPeopleArt pairIndex={0} /></div>
              <p>Waiting for the first person to join.</p>
            </div>
          )}
          <div className="room-meeting-plan">
            <label htmlFor="room-round-count">Number of rounds</label>
            <div className="stepper">
              <button
                type="button"
                aria-label="Fewer rounds"
                disabled={busy || meetingCount <= 1}
                onClick={() => onMeetCountChange(meetingCount - 1)}
              >
                −
              </button>
              <input
                id="room-round-count"
                type="number"
                min="1"
                max={roundLimit || 1}
                value={meetingCount}
                disabled={busy || !roundLimit}
                aria-describedby="room-meeting-count-help"
                onChange={(event) =>
                  onMeetCountChange(
                    clamp(Number(event.target.value), 1, roundLimit || 1),
                  )
                }
              />
              <button
                type="button"
                aria-label="More rounds"
                disabled={busy || meetingCount >= roundLimit}
                onClick={() => onMeetCountChange(meetingCount + 1)}
              >
                +
              </button>
            </div>
            <small id="room-meeting-count-help">
              {roundLimit
                ? `1–${roundLimit} cross-team rounds · ${formatDuration(calculateDurationSeconds({ ...settings, rounds: meetingCount }))} estimated${room.participants.length % 2 ? " · one rotating break per round" : ""}`
                : room.participants.length < MIN_ROOM_PARTICIPANTS
                  ? `Waiting for at least ${MIN_ROOM_PARTICIPANTS} people`
                  : "No complete cross-team round is possible. Add people from other teams."}
            </small>
          </div>
          <details className="room-manual-details">
            <summary>Add someone without a phone</summary>
            <form
              className="room-manual-add"
              onSubmit={(event) => {
                event.preventDefault();
                void onAddParticipant(manualName, manualTeam, manualRole).then((added) => {
                  if (!added) return;
                  setManualName("");
                  setManualTeam("");
                  setManualRole("");
                });
              }}
            >
              <label>
                <span>FULL NAME</span>
                <input
                  type="text"
                  value={manualName}
                  onChange={(event) => setManualName(event.target.value)}
                  placeholder="Full name"
                  autoComplete="name"
                  minLength={2}
                  maxLength={80}
                  required
                  disabled={busy}
                />
              </label>
              <label>
                <span>TEAM</span>
                <select
                  value={manualTeam}
                  onChange={(event) => setManualTeam(event.target.value)}
                  required
                  disabled={busy}
                >
                  <option value="">Choose team</option>
                  {SIGNUP_TEAMS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>ROLE</span>
                <select
                  value={manualRole}
                  onChange={(event) => setManualRole(event.target.value)}
                  required
                  disabled={busy}
                >
                  <option value="">Choose role</option>
                  {SIGNUP_ROLES.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={busy || manualName.trim().length < 2 || !manualTeam || !manualRole}
              >
                Add person
              </button>
              <small>
                They can find their group in the conversation list on this screen.
              </small>
            </form>
          </details>
          <div className="room-lobby-footer">
            <button
              className="secondary-button signup-extend-button"
              type="button"
              onClick={onExtendSignup}
              disabled={busy}
            >
              <Plus size={15} /> Add 1 minute
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={
                busy || room.participants.length < MIN_ROOM_PARTICIPANTS || !roundLimit
              }
              onClick={onStart}
            >
              {busy ? "Starting…" : "Start the meet"}
            </button>
          </div>
          {room.participants.length % 2 === 1 && (
            <p className="odd-attendance-note">
              One person takes a break each round. The break rotates so it is not always the same person.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}

function PhoneJoinScreen({
  code,
  name,
  surname,
  team,
  role,
  busy,
  error,
  onNameChange,
  onSurnameChange,
  onTeamChange,
  onRoleChange,
  onSubmit,
}: {
  code: string;
  name: string;
  surname: string;
  team: string;
  role: string;
  busy: boolean;
  error: string;
  onNameChange: (value: string) => void;
  onSurnameChange: (value: string) => void;
  onTeamChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <main className="phone-page">
      <div className="phone-brand">
        {APP_NAME} <span>TEAM SESSION</span>
      </div>
      <section className="phone-join-content">
        <p className="section-kicker">ROOM {code.toUpperCase()}</p>
        <h1>Join the team.</h1>
        <p>Enter your first name and surname so people can find you.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label htmlFor="phone-name">First name</label>
          <input
            id="phone-name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="e.g. Alex"
            maxLength={40}
            autoComplete="given-name"
            required
          />
          <label htmlFor="phone-surname">Surname</label>
          <input
            id="phone-surname"
            value={surname}
            onChange={(event) => onSurnameChange(event.target.value)}
            placeholder="e.g. Roberts"
            maxLength={30}
            autoComplete="family-name"
            required
          />
          <label htmlFor="phone-team">Team</label>
          <select
            id="phone-team"
            value={team}
            onChange={(event) => onTeamChange(event.target.value)}
            required
          >
            <option value="">Choose your team</option>
            {SIGNUP_TEAMS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <label htmlFor="phone-role">Role</label>
          <select
            id="phone-role"
            value={role}
            onChange={(event) => onRoleChange(event.target.value)}
            required
          >
            <option value="">Choose your role</option>
            {SIGNUP_ROLES.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {error && (
            <p className="phone-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary-button"
            type="submit"
            disabled={busy || name.trim().length < 2 || !surname.trim() || !team || !role}
          >
            {busy ? "Joining…" : "Join session"}
          </button>
        </form>
      </section>
      <p className="phone-footnote">
        This name is only used for this temporary session.
      </p>
    </main>
  );
}

function PhoneAssignmentScreen({
  view,
  remaining,
  onRejoin,
}: {
  view: PhoneRoomView;
  remaining: number;
  onRejoin: () => void;
}) {
  if (view.status === "lobby") {
    return (
      <main className="phone-page">
        <div className="phone-brand">
          {APP_NAME} <span>TEAM SESSION</span>
        </div>
        <section className="phone-waiting">
          <p className="section-kicker">YOU ARE CHECKED IN</p>
          <h1>{view.participant.displayName}</h1>
          <div className="phone-waiting-art" aria-hidden="true">
            <BusinessPeopleArt pairIndex={view.participantCount} />
          </div>
          <h2>Waiting for the host</h2>
          <p>{view.participantCount} people are in the room.</p>
          <div className="phone-countdown">
            <span>SIGN-UP CLOSES IN</span>
            <strong>{formatClock(remaining)}</strong>
          </div>
        </section>
      </main>
    );
  }
  if (view.status === "complete" || view.phase === "complete") {
    return (
      <main className="phone-page">
        <div className="phone-brand">
          {APP_NAME} <span>SESSION COMPLETE</span>
        </div>
        <section className="phone-waiting">
          <p className="section-kicker">CONNECTIONS MADE</p>
          <h1>Thanks, {view.participant.displayName}.</h1>
          <div className="phone-celebration-art" aria-hidden="true">
            <BusinessPeopleArt />
          </div>
          <p>Your session is complete. You can close this page.</p>
        </section>
      </main>
    );
  }
  const isMovement =
    view.phase === "movement" ||
    (view.phase === "paused" && view.previousPhase === "movement");
  const assignment = view.assignment;
  const isBreak = !!assignment?.break;
  const isFinding =
    isMovement ||
    view.phase === "intro" ||
    (view.phase === "paused" && view.previousPhase === "intro");
  const isConversation =
    view.phase === "conversation" ||
    (view.phase === "paused" && view.previousPhase === "conversation");
  const countdownLabel = isFinding
    ? isBreak ? "YOUR BREAK STARTS IN" : "CONVERSATION STARTS IN"
    : isBreak
      ? view.currentRound + 1 === view.totalRounds ? "SESSION ENDS IN" : "NEXT ROUND IN"
      : "TIME LEFT";
  return (
    <main
      className="phone-page phone-live-page"
      style={{
        background: assignment?.background,
        color: assignment?.foreground,
      }}
    >
      <div className="phone-brand">
        {APP_NAME}{" "}
        <span>
          ROUND {(isMovement ? view.assignmentRound : view.currentRound) + 1} /{" "}
          {view.totalRounds}
        </span>
      </div>
      <section className="phone-assignment">
        <div className="phone-round-heading">
          <div className="phone-round-dancers" aria-hidden="true">
            {isBreak
              ? <BusinessPeopleArt single />
              : <BusinessPeopleArt pairIndex={view.assignmentRound * 2 + (isFinding ? 0 : 1)} />}
          </div>
          <p className="section-kicker">
            {isBreak ? "YOUR BREAK" : isFinding ? "FIND YOUR PERSON" : "YOUR CONVERSATION"}
          </p>
        </div>
        <div className="phone-partner">
          {!isBreak && <p className="phone-greeting">
            <strong>{view.participant.displayName.split(" ")[0]}</strong>
            <span>{isFinding ? "find" : "you are meeting"}</span>
          </p>}
          <h1>
            {assignment?.break
              ? "Take a short break"
              : assignment?.partnerNames.length
                ? assignment.partnerNames.join(" + ")
                : "Your group is getting ready"}
          </h1>
          {(isBreak || isFinding || !view.question) && (
            <p className="phone-match-instruction">
              {assignment?.break
                ? (assignment.activity ?? "Take a breather while others chat.")
                : isFinding
                  ? "Find the person named above. Your phones show the same colour."
                  : "Enjoy your conversation together."}
            </p>
          )}
        </div>
        {isConversation && view.question && !assignment?.break && (
          <div className="phone-icebreaker">
            <p className="section-kicker">
              ICEBREAKER
            </p>
            <p>{view.question.prompt}</p>
          </div>
        )}
        <div className="phone-countdown">
          <div className="phone-clock">
            <span>{countdownLabel}</span>
            <strong>{formatClock(remaining)}</strong>
            {view.phase === "paused" && <em>PAUSED</em>}
          </div>
        </div>
        <button className="phone-rejoin" type="button" onClick={onRejoin}>
          Not you? Change name
        </button>
      </section>
    </main>
  );
}

function PreviewScreen({
  rounds,
  members,
  order,
  selected,
  duration,
  settings,
  repeats,
  onSelect,
  onBack,
  onRegenerate,
  onStart,
}: {
  rounds: Round[];
  members: TeamMember[];
  order: string[];
  selected: number;
  duration: number;
  settings: SessionSettings;
  repeats: number;
  onSelect: (index: number) => void;
  onBack: () => void;
  onRegenerate: () => void;
  onStart: () => void;
}) {
  const round = rounds[selected];
  return (
    <section className="preview-screen">
      <div className="page-toolbar">
        <button className="back-button character-back-button" type="button" onClick={onBack}>
          <span aria-hidden="true"><BusinessPeopleArt pointingLeft /></span>
          Back to setup
        </button>
        <span className="preview-tag">
          <i /> PAIRINGS READY
        </span>
      </div>
      <div className="preview-heading">
        <div>
          <p className="section-kicker">YOUR SESSION, AT A GLANCE</p>
          <h1>Meet the plan.</h1>
          <p className="panel-subtitle">
            A fresh set of pairings for each round.
          </p>
        </div>
        <div className="preview-stats">
          <div>
            <strong>{order.length}</strong>
            <span>PEOPLE</span>
          </div>
          <div>
            <strong>{rounds.length}</strong>
            <span>ROUNDS</span>
          </div>
          <div>
            <strong>
              {rounds.reduce(
                (total, item) =>
                  total +
                  item.stations.filter((station) => station.kind !== "break")
                    .length,
                0,
              )}
            </strong>
            <span>CONVERSATIONS</span>
          </div>
          <div>
            <strong>{formatDuration(duration)}</strong>
            <span>EST. TIME</span>
          </div>
        </div>
      </div>
      {repeats > 0 && (
        <div className="warning-banner">
          <HelpCircle size={17} /> {repeats} repeated connections will occur.
          Reduce the rounds or regenerate.
        </div>
      )}
      <div className="preview-columns preview-single-column">
        <section className="preview-rounds">
          <div
            className="round-tabs"
            role="tablist"
            aria-label="Preview each round"
          >
            {rounds.map((item, index) => (
              <button
                role="tab"
                aria-selected={selected === index}
                className={selected === index ? "selected" : ""}
                key={item.number}
                onClick={() => onSelect(index)}
              >
                {String(item.number).padStart(2, "0")}
              </button>
            ))}
          </div>
          <div className="round-preview-heading">
            <div>
              <p className="section-kicker">
                ROUND {String(selected + 1).padStart(2, "0")}
              </p>
              <h2>This round’s conversations</h2>
            </div>
            <span>
              {
                round?.stations.filter((station) => station.kind !== "break")
                  .length
              }{" "}
              conversations
            </span>
          </div>
          <div className="preview-station-list">
            {round?.stations.map((station) => (
              <StationCard
                station={station}
                members={members}
                symbol={
                  PAIR_SYMBOLS[(station.number - 1) % PAIR_SYMBOLS.length]
                }
                key={`${round.number}-${station.number}`}
                compact
              />
            ))}
          </div>
          {round?.question && (
            <div className="preview-question">
              <MessageSquareText size={16} />
              <div>
                <span>ICEBREAKER · {round.question.category}</span>
                <p>{round.question.prompt}</p>
              </div>
            </div>
          )}
          {settings.icebreakersEnabled && !round?.question && (
            <p className="warning-line">
              No prompts in the selected categories.
            </p>
          )}
        </section>
      </div>
      <div className="preview-bottom">
        <button className="secondary-button" onClick={onRegenerate}>
          <Shuffle size={16} /> Regenerate session
        </button>
        <p>
          {settings.rounds} rounds <i>·</i> {settings.conversationMinutes} min
          conversations <i>·</i> {settings.movementSeconds} sec transition
        </p>
        <button className="primary-button" onClick={onStart}>
          Start session
        </button>
      </div>
    </section>
  );
}

function StationCard({
  station,
  members,
  symbol,
  compact = false,
}: {
  station: Station;
  members: TeamMember[];
  symbol?: string;
  compact?: boolean;
}) {
  const appearance = getPairAppearance(station.number);
  if (station.kind === "break")
    return (
      <article
        className={`station-card conversation-card break-card${compact ? " compact-station" : ""}`}
        style={{
          background: appearance.background,
          color: appearance.foreground,
        }}
      >
        {symbol && <PairSymbol symbol={symbol} />}
        <div className="station-content">
          <span className="station-kind">BREAK</span>
          <ul className="conversation-name-list">
            {station.participantIds.map((id) => (
              <li key={id}>{nameOf(members, id)}</li>
            ))}
          </ul>
          <small>{station.activity}</small>
        </div>
      </article>
    );
  return (
    <article
      className={`station-card conversation-card${station.kind === "trio" ? " trio-card" : ""}${compact ? " compact-station" : ""}`}
      style={{
        background: appearance.background,
        color: appearance.foreground,
      }}
    >
      {symbol && <PairSymbol symbol={symbol} />}
      <div className="station-content">
        <ul className="conversation-name-list">
          {station.participantIds.map((id) => (
            <li key={id}>{nameOf(members, id)}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function IntroScreen({
  count,
  remaining,
  onSkip,
}: {
  count: number;
  remaining: number;
  onSkip: () => void;
}) {
  return (
    <section className="intro-screen">
      <div className="intro-sky">
        <div className="intro-sun" />
        <div className="intro-cloud cloud-one" />
        <div className="intro-cloud cloud-two" />
        <div className="intro-city city-back">
          {Array.from({ length: 5 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        <div className="intro-city city-front">
          {Array.from({ length: 4 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        <div className="intro-tower">
          <span />
          {Array.from({ length: 20 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        <div className="intro-road" />
        <div className="intro-car car-one" />
        <div className="intro-car car-two" />
      </div>
      <div className="intro-title">
        <p>{APP_NAME}</p>
        <h1>
          A room full
          <br />
          of possibility.
        </h1>
        <span>{count} colleagues · new conversations · one stronger team</span>
      </div>
      <div className="intro-timer">STARTING IN {formatClock(remaining)}</div>
      <button className="intro-skip" onClick={onSkip}>
        Skip introduction <FastForward size={15} />
      </button>
    </section>
  );
}

function RoundScreen({
  session,
  round,
  members,
  remaining,
  paused,
  onDisplay,
  onFullscreen,
  onBegin,
}: {
  session: SessionState;
  round: Round;
  members: TeamMember[];
  remaining: number;
  paused: boolean;
  onDisplay: () => void;
  onFullscreen: () => void;
  onBegin: () => void;
}) {
  const isFinding =
    session.timer.phase === "intro" ||
    (session.timer.phase === "paused" &&
      session.timer.previousPhase === "intro");
  return (
    <section
      className={`round-screen${session.displayMode === "focus" ? " focus-mode" : ""}`}
    >
      <div className="round-topline">
        <div>
          <p className="section-kicker">NETWORKING SESSION</p>
          <h1>
            Round {round.number} <span>of {session.rounds.length}</span>
          </h1>
        </div>
        <div className="round-top-actions">
          <button className="secondary-button compact" onClick={onDisplay}>
            <Expand size={15} />{" "}
            {session.displayMode === "room" ? "Focus view" : "Full room"}
          </button>
          <button
            className="icon-button"
            onClick={onFullscreen}
            aria-label="Toggle full screen"
          >
            <Monitor size={17} />
          </button>
        </div>
      </div>
      <div className={`round-focus${isFinding ? " finding-phase" : ""}`}>
        <div className="timer-block">
          <div className="session-timer-face">
            <span>            {isFinding ? "FIND YOUR PERSON" : "CONVERSATION TIME"}</span>
            <strong className={remaining < 30_000 ? "timer-urgent" : ""}>
              {formatClock(remaining)}
            </strong>
            <small>
              {paused
                ? "PAUSED"
                : isFinding
                  ? "CONVERSATION STARTS IN"
                  : "TIME LEFT"}
            </small>
          </div>
          <div className="timer-people" aria-hidden="true">
            <BusinessPeopleArt pairIndex={(round.number - 1) * 2 + (isFinding ? 0 : 1)} />
          </div>
        </div>
        <div className="icebreaker-block">
          {isFinding ? (
            <Smartphone size={20} />
          ) : (
            <MessageSquareText size={20} />
          )}
          <div>
            <span>
              {isFinding
                ? "FIND YOUR GROUP"
                : round.question
                  ? `ICEBREAKER · ${round.question.category}`
                  : "YOUR CONVERSATION"}
            </span>
            <h2 className="round-action-heading">
              {isFinding
                ? "Find your person."
                : (round.question?.prompt ??
                  `Use these ${session.settings.conversationMinutes} minutes to get to know each other.`)}
            </h2>
            {isFinding && (
              <p className="panel-subtitle">
                Find your name below, then meet your partner.
              </p>
            )}
          </div>
        </div>
        {isFinding && (
          <button
            className="primary-button compact find-partner-action"
            type="button"
            onClick={onBegin}
            disabled={paused}
          >
            Start conversation now
          </button>
        )}
      </div>
      {(paused || !!round.sameTeamPairs?.length ||
        round.stations.some((station) => station.kind === "break")) && (
        <div className="round-status">
          {paused && (
            <div className="paused-banner" role="status">
              <Pause size={14} /> Paused
              <span>— resume when ready.</span>
            </div>
          )}
          {!!round.sameTeamPairs?.length && (
            <div className="warning-banner" role="status">
              <HelpCircle size={14} /> This saved round includes same-team pairings.
            </div>
          )}
          {round.stations.some((station) => station.kind === "break") && (
            <div className="warning-banner" role="status">
              <HelpCircle size={14} /> Break cards show who rests this round.
            </div>
          )}
        </div>
      )}
      <div className="station-grid-heading">
        <h2>Your conversations</h2>
        <span>
          {round.stations.filter((station) => station.kind !== "break").length}{" "}
          conversations
        </span>
      </div>
      <div
        className={`station-grid${session.displayMode === "focus" ? " focus-station-grid" : ""}`}
      >
        {round.stations.map((station) => (
          <StationCard
            station={station}
            members={session.participants ?? members}
            symbol={PAIR_SYMBOLS[(station.number - 1) % PAIR_SYMBOLS.length]}
            key={`${round.number}-${station.number}`}
          />
        ))}
      </div>
    </section>
  );
}

function MovementScreen({
  session,
  nextRound,
  members,
  remaining,
  onNext,
}: {
  session: SessionState;
  nextRound?: Round;
  members: TeamMember[];
  remaining: number;
  onNext: () => void;
}) {
  return (
    <section className="movement-screen simple-transition-screen">
      <div className="movement-heading">
        <div>
          <p className="section-kicker">
            ROUND {session.currentRound + 1} COMPLETE
          </p>
          <h1>Find your next person.</h1>
          <p className="movement-instruction">
            Find your name below, then meet the people in your group.
          </p>
        </div>
        <div className="movement-timer">
          <div className="session-timer-face">
            <span>ROUND STARTS IN</span>
            <strong>{formatClock(remaining)}</strong>
            <small>
              {session.timer.phase === "paused" ? "PAUSED" : "GET READY"}
            </small>
          </div>
          <div className="timer-people" aria-hidden="true">
            <BusinessPeopleArt pairIndex={(session.currentRound + 1) * 2} />
          </div>
        </div>
      </div>
      <div className="progress-track">
        <span
          style={{
            width: `${((session.currentRound + 1) / session.rounds.length) * 100}%`,
          }}
        />
      </div>
      <div className="next-conversations-heading">
        <span>
          ROUND {session.currentRound + 2} OF {session.rounds.length}
        </span>
        <button className="primary-button compact" onClick={onNext}>
          Start round now
        </button>
      </div>
      <div className="next-conversations-list">
        {nextRound?.stations.map((station) => (
          <StationCard
            station={station}
            members={session.participants ?? members}
            symbol={PAIR_SYMBOLS[(station.number - 1) % PAIR_SYMBOLS.length]}
            key={`${nextRound.number}-${station.number}`}
            compact
          />
        ))}
      </div>
    </section>
  );
}

function SessionDock({
  session,
  onPause,
  onRestart,
  onSkip,
  onEnd,
  onFullscreen,
  onDisplay,
  soundEnabled,
  onSoundToggle,
}: {
  session: SessionState;
  onPause: () => void;
  onRestart: () => void;
  onSkip: () => void;
  onEnd: () => void;
  onFullscreen: () => void;
  onDisplay: () => void;
  soundEnabled: boolean;
  onSoundToggle: () => void;
}) {
  return (
    <nav className="session-dock" aria-label="Session controls">
      <span className="dock-status">
        <i /> {session.timer.phase === "paused" ? "PAUSED" : "SESSION LIVE"}{" "}
        <small>
          ROUND {session.currentRound + 1}/{session.rounds.length}
        </small>
      </span>
      <div className="dock-controls">
        <button
          onClick={onPause}
          aria-label={
            session.timer.phase === "paused"
              ? "Resume session"
              : "Pause session"
          }
          title={session.timer.phase === "paused" ? "Resume" : "Pause"}
        >
          {session.timer.phase === "paused" ? (
            <Play size={17} />
          ) : (
            <Pause size={17} />
          )}
        </button>
        <button
          onClick={onRestart}
          aria-label="Restart round"
          title="Restart round"
        >
          <RotateCcw size={16} />
        </button>
        <button
          onClick={onSkip}
          aria-label={
            session.timer.phase === "intro" ||
            session.timer.previousPhase === "intro"
              ? "Start conversation"
              : "Skip round"
          }
          title={
            session.timer.phase === "intro" ||
            session.timer.previousPhase === "intro"
              ? "Start conversation"
              : "Skip round"
          }
        >
          <FastForward size={16} />
        </button>
        <button
          onClick={onDisplay}
          aria-label="Change display mode"
          title="Change display mode"
        >
          <Expand size={16} />
        </button>
        <button
          onClick={onFullscreen}
          aria-label="Toggle full screen"
          title="Toggle full screen"
        >
          <Monitor size={16} />
        </button>
        <button
          onClick={onSoundToggle}
          aria-label={soundEnabled ? "Mute sound" : "Enable sound"}
          title={soundEnabled ? "Mute sound" : "Enable sound"}
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <button className="dock-end" onClick={onEnd}>
          End session
        </button>
      </div>
    </nav>
  );
}

function CompletionScreen({
  summary,
  onAgain,
  onChange,
  onReset,
}: {
  summary: {
    attendees: number;
    rounds: number;
    conversations: number;
    duration: number;
    prompts: number;
  };
  onAgain: () => void;
  onChange: () => void;
  onReset: () => void;
}) {
  return (
    <section className="completion-screen">
      <BusinessPeopleArt />
      <div className="completion-copy">
        <p className="section-kicker">SESSION COMPLETE</p>
        <h1>
          Connections
          <br />
          <span>made.</span>
        </h1>
        <p>
          Thanks for making time for each other. Small conversations can make a
          big difference.
        </p>
      </div>
      <div className="summary-strip">
        {[
          [summary.attendees, "PEOPLE"],
          [summary.rounds, "ROUNDS"],
          [summary.conversations, "CONVERSATIONS"],
          [formatDuration(summary.duration), "TOGETHER"],
          [summary.prompts, "ICEBREAKERS"],
        ].map(([value, label]) => (
          <div key={String(label)}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="completion-actions">
        <button className="secondary-button" onClick={onReset}>
          Reset app
        </button>
        <button className="secondary-button" onClick={onChange}>
          Change attendance
        </button>
        <button className="primary-button" onClick={onAgain}>
          Run another session
        </button>
      </div>
    </section>
  );
}

function ConfirmDialog({
  title,
  body,
  confirm,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirm: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
        tabIndex={-1}
        ref={ref}
      >
        <div className="dialog-symbol">
          <HelpCircle size={22} />
        </div>
        <h2 id="dialog-title">{title}</h2>
        <p id="dialog-description">{body}</p>
        <div className="button-row">
          <button className="secondary-button" onClick={onCancel}>
            Keep working
          </button>
          <button className="danger-button" onClick={onConfirm}>
            {confirm}
          </button>
        </div>
      </section>
    </div>
  );
}

export default App;
