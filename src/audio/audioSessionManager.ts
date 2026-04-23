import { setAudioModeAsync } from "expo-audio";
import type { AudioRecorder } from "expo-audio";

// ─── Audio mode constants ────────────────────────────────────────────────────

const PLAYBACK_MODE = {
  allowsRecording: false,
  playsInSilentMode: true,
} as const;

const RECORDING_MODE = {
  allowsRecording: true,
  playsInSilentMode: true,
} as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Small delay to let the OS settle after an audio category switch. */
async function settleSession(): Promise<void> {
  await sleep(80);
}

// ─── Player registry (Point 3) ───────────────────────────────────────────────

type PausablePlayer = { pause: () => void };

const registeredPlayers = new Set<WeakRef<PausablePlayer>>();

/**
 * Registers a player so it is automatically paused before any recording
 * session starts. Returns an unregister function — call it in the component's
 * cleanup effect.
 */
export function registerPlayer(player: PausablePlayer): () => void {
  const ref = new WeakRef(player);
  registeredPlayers.add(ref);
  return () => {
    registeredPlayers.delete(ref);
  };
}

/** Pauses every live registered player. Called internally before recording. */
function pauseAllPlayers(): void {
  for (const ref of registeredPlayers) {
    const p = ref.deref();
    if (p) {
      try {
        p.pause();
      } catch {
        // Player may already be released; ignore.
      }
    } else {
      registeredPlayers.delete(ref);
    }
  }
}

// ─── Recorder session guard (Point 2) ────────────────────────────────────────

let activeRecorderRef: WeakRef<AudioRecorder> | null = null;

/**
 * Claims exclusive recorder ownership. Throws if another recorder is already
 * live. Call this immediately after creating the recorder, before `record()`.
 */
export function claimRecorderSession(recorder: AudioRecorder): void {
  const current = activeRecorderRef?.deref();
  if (current != null) {
    throw new Error(
      "audioSessionManager: a recorder is already active. Release it before starting a new one.",
    );
  }
  activeRecorderRef = new WeakRef(recorder);
}

/**
 * Releases recorder ownership. Must be called on every stop/interrupt path
 * (success, error, and discard).
 */
export function releaseRecorderSession(recorder: AudioRecorder): void {
  const current = activeRecorderRef?.deref();
  if (current === recorder || current == null) {
    activeRecorderRef = null;
  }
}

// ─── Session transitions (Points 1 & 4) ──────────────────────────────────────

/**
 * Transitions the OS audio session to playback-only mode.
 * Call after finalizing a recording, before preview playback, and on
 * component unmount if recording was interrupted.
 */
export async function enterPlaybackSession(): Promise<void> {
  await setAudioModeAsync(PLAYBACK_MODE);
}

/**
 * Transitions the OS audio session to recording mode:
 *   1. Pauses all registered players.
 *   2. Resets to playback mode first (forces AVAudioSession category re-init on iOS).
 *   3. Settles, then activates recording mode.
 *   4. Settles before the recorder is prepared.
 *
 * This is the single place that calls setAudioModeAsync with allowsRecording: true.
 */
export async function enterRecordingSession(): Promise<void> {
  pauseAllPlayers();
  await setAudioModeAsync(PLAYBACK_MODE);
  await settleSession();
  await setAudioModeAsync(RECORDING_MODE);
  await settleSession();
}
