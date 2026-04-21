import {
  AudioModule,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";

import { copyIntoAppDocumentsWithUuid } from "./appDocuments";

export type VoiceRecorder = InstanceType<typeof AudioModule.AudioRecorder>;

/**
 * Requests mic permission, configures the audio session, and returns a prepared recorder.
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
 * Stops the recorder and copies the output into the app document directory with a UUID `.m4a` name.
 */
export async function stopRecordingAndCopyToAppDocuments(
  recorder: VoiceRecorder,
): Promise<string> {
  await recorder.stop();
  const uri = recorder.uri;
  if (uri == null || uri === "") {
    throw new Error("Recording produced no file URI");
  }
  return copyIntoAppDocumentsWithUuid(uri, ".m4a");
}
