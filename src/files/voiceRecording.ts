import {
  AudioModule,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import type { AudioRecorder } from "expo-audio";

import { copyIntoAppDocumentsWithUuid } from "./appDocuments";

export type VoiceRecorder = AudioRecorder;

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
  await recorder.stop().catch(() => {});
  console.log("\ninterruptVoiceRecording:after_stop", {
    recorderId: recorder.id,
  });
  releaseVoiceRecorderSafe(recorder);
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
 * Requests microphone permission, sets audio mode for recording, prepares a high-quality
 * `expo-audio` recorder. Caller invokes `record()` on the returned instance.
 */
export async function createPreparedVoiceRecorder(): Promise<VoiceRecorder> {
  const { granted } = await requestRecordingPermissionsAsync();
  if (!granted) {
    throw new Error("Microphone permission denied");
  }
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
  });
  const recorder = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
  await recorder.prepareToRecordAsync();
  return recorder;
}

/**
 * Stops the recorder, copies output to app documents as UUID `.m4a`, switches to playback
 * audio mode (`allowsRecording: false`), and returns path + duration for DB insert.
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
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });
    return {
      fileUri,
      durationSeconds: secondsFromRecordingMillis(durationMillis),
    };
  } finally {

    releaseVoiceRecorderSafe(recorder);
  }
}
