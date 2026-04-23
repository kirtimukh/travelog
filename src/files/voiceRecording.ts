import { AudioModule, AudioQuality, IOSOutputFormat, RecordingPresets, requestRecordingPermissionsAsync } from "expo-audio";
import type { AudioRecorder } from "expo-audio";

import {
  claimRecorderSession,
  enterPlaybackSession,
  enterRecordingSession,
  releaseRecorderSession,
} from "../audio/audioSessionManager";
import { copyIntoAppDocumentsWithUuid } from "./appDocuments";

export type VoiceRecorder = AudioRecorder;

/**
 * Voice-optimised recording preset: mono 16 kHz, 32 kbps AAC.
 * Produces smaller files than the stereo 44.1 kHz HIGH_QUALITY preset while
 * retaining sufficient clarity for spoken voice notes.
 */
export const VOICE_NOTE_RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  ios: {
    ...(RecordingPresets.HIGH_QUALITY.ios ?? {}),
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16 as const,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
} as const;

/** Detaches native recorder; safe if already released. */
export function releaseVoiceRecorderSafe(recorder: VoiceRecorder): void {
  try {
    recorder.release();
  } catch {
    // Already released or native object invalid
    console.error("releaseVoiceRecorderSafe:error", {
      recorderId: recorder.id,
    });
  }
}

/** Stops capture then releases native resources (discard / interrupt paths). */
export async function interruptVoiceRecording(recorder: VoiceRecorder): Promise<void> {
  try {
    await recorder.stop().catch(() => {});
    console.log("\ninterruptVoiceRecording:after_stop", {
      recorderId: recorder.id,
    });
  } finally {
    releaseVoiceRecorderSafe(recorder);
    releaseRecorderSession(recorder);
    await enterPlaybackSession();
  }
}


export function voiceRecRecorderSnapshot(recorder: VoiceRecorder): Record<string, unknown> {
  const s = recorder.getStatus();
  console.log("\nvoiceRecRecorderSnapshot", {
    recorderId: recorder.id,
    canRecord: s.canRecord,
    isRecording: s.isRecording,
    durationMillis: s.durationMillis,
    mediaServicesDidReset: s.mediaServicesDidReset,
    url: s.url ?? null,
  });
  return {
    recorderId: recorder.id,
    canRecord: s.canRecord,
    isRecording: s.isRecording,
    durationMillis: s.durationMillis,
    mediaServicesDidReset: s.mediaServicesDidReset,
    url: s.url ?? null,
  };
}

export type VoiceRecordingFinalizeResult = {
  fileUri: string;
  /** Whole seconds for DB (`audio_duration`); see `secondsFromRecordingMillis`. */
  durationSeconds: number;
};

/**
 * Converts recorder-reported milliseconds to persisted whole seconds (voice_note_brd.md §5).
 * Clips shorter than ~500ms round to 1s minimum.
 */
export function secondsFromRecordingMillis(durationMillis: number): number {
  return Math.max(1, Math.round(durationMillis / 1000));
}

/**
 * Requests microphone permission, transitions the audio session to recording
 * mode via audioSessionManager (which also pauses all active players), then
 * prepares a voice-optimised mono 16 kHz recorder. Caller invokes `record()`
 * on the returned instance.
 */
export async function createPreparedVoiceRecorder(): Promise<VoiceRecorder> {
  const { granted } = await requestRecordingPermissionsAsync();
  if (!granted) {
    throw new Error("Microphone permission denied");
  }
  await enterRecordingSession();
  const recorder = new AudioModule.AudioRecorder(VOICE_NOTE_RECORDING_OPTIONS);
  claimRecorderSession(recorder);
  await recorder.prepareToRecordAsync();
  return recorder;
}

/**
 * Stops the recorder, copies output to app documents as UUID `.m4a`, switches
 * to playback mode via audioSessionManager, and returns path + duration for DB
 * insert.
 */
export async function stopRecordingAndCopyToAppDocuments(
  recorder: VoiceRecorder,
): Promise<VoiceRecordingFinalizeResult> {
  try {
    const durationMillis = recorder.getStatus().durationMillis;
    await recorder.stop();
    const uri = recorder.uri;
    if (uri == null || uri === "") {
      throw new Error("Recording produced no file URI");
    }
    const fileUri = await copyIntoAppDocumentsWithUuid(uri, ".m4a");
    await enterPlaybackSession();
    return {
      fileUri,
      durationSeconds: secondsFromRecordingMillis(durationMillis),
    };
  } finally {
    releaseRecorderSession(recorder);
    releaseVoiceRecorderSafe(recorder);
  }
}
