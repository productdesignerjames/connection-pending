import type { ActiveTimer } from "./domain";

export function createTimer(
  phase: ActiveTimer["phase"],
  durationMs: number,
  now = Date.now(),
): ActiveTimer {
  return {
    phase,
    deadline: now + Math.max(0, durationMs),
    remainingMs: Math.max(0, durationMs),
  };
}

export function remainingTime(timer: ActiveTimer, now = Date.now()): number {
  if (timer.phase === "paused" || timer.deadline === null)
    return Math.max(0, timer.remainingMs);
  return Math.max(0, timer.deadline - now);
}

export function pauseTimer(timer: ActiveTimer, now = Date.now()): ActiveTimer {
  if (timer.phase === "paused" || timer.phase === "complete") return timer;
  return {
    phase: "paused",
    previousPhase: timer.phase,
    deadline: null,
    remainingMs: remainingTime(timer, now),
  };
}

export function resumeTimer(timer: ActiveTimer, now = Date.now()): ActiveTimer {
  if (timer.phase !== "paused" || !timer.previousPhase) return timer;
  return {
    phase: timer.previousPhase,
    deadline: now + timer.remainingMs,
    remainingMs: timer.remainingMs,
  };
}

export function timerAtDeadline(timer: ActiveTimer, now = Date.now()): boolean {
  return (
    timer.phase !== "paused" &&
    timer.phase !== "complete" &&
    remainingTime(timer, now) === 0
  );
}

export function formatClock(milliseconds: number): string {
  const totalSeconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
