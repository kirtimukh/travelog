/** Formats seconds as m:ss for audio timers. */
export function formatDurationSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/** Replay toolbar / voice label: under 60s use "N second(s)"; else "M:SS minutes". */
export function formatVoiceReplayDuration(durationSec: number | null): string {
  if (durationSec == null || durationSec < 0) {
    return "Voice note";
  }
  const whole = Math.floor(durationSec);
  if (whole < 60) {
    return whole === 1 ? "Voice note: 1 second" : `Voice note: ${whole} seconds`;
  }
  return `Voice note: ${formatDurationSeconds(whole)} minutes`;
}
