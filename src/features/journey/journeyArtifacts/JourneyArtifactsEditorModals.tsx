import { JourneyMediaEditModal } from "../components/JourneyMediaEditModal";
import { JourneyNoteEditModal } from "../components/JourneyNoteEditModal";
import { JourneyWeatherModal } from "../components/JourneyWeatherModal";
import type { UseMediaEditFlowResult } from "../hooks/useMediaEditFlow";
import type { UseNoteEditFlowResult } from "../hooks/useNoteEditFlow";
import type { UseWeatherCaptureFlowResult } from "../hooks/useWeatherCaptureFlow";

export type JourneyArtifactsEditorModalsProps = {
  noteEdit: UseNoteEditFlowResult;
  mediaEdit: UseMediaEditFlowResult;
  weatherCapture: UseWeatherCaptureFlowResult;
  onRerecordAudio: () => void;
  weatherOnDelete?: () => void;
};

export function JourneyArtifactsEditorModals({
  noteEdit,
  mediaEdit,
  weatherCapture,
  onRerecordAudio,
  weatherOnDelete,
}: JourneyArtifactsEditorModalsProps) {
  const m = weatherCapture.modal;

  return (
    <>
      <JourneyNoteEditModal
        visible={noteEdit.target !== null}
        note={noteEdit.target}
        text={noteEdit.text}
        onChangeText={noteEdit.onChangeText}
        busy={noteEdit.busy}
        onRequestClose={noteEdit.close}
        onSave={() => {
          void noteEdit.save();
        }}
        onDelete={() => {
          void noteEdit.remove();
        }}
        onRerecordAudio={onRerecordAudio}
      />

      <JourneyMediaEditModal
        visible={mediaEdit.editModal.target !== null}
        file={mediaEdit.editModal.target?.file ?? ""}
        width={mediaEdit.editModal.target?.width ?? null}
        height={mediaEdit.editModal.target?.height ?? null}
        text={mediaEdit.editModal.text}
        onChangeText={mediaEdit.editModal.onChangeText}
        timestampEpochMs={mediaEdit.editModal.timestampEpochMs}
        onChangeTimestampEpochMs={mediaEdit.editModal.onChangeTimestampEpochMs}
        localDateTime={mediaEdit.editModal.localDateTime}
        onChangeLocalDateTime={mediaEdit.editModal.onChangeLocalDateTime}
        lat={mediaEdit.editModal.lat}
        onChangeLat={mediaEdit.editModal.onChangeLat}
        lng={mediaEdit.editModal.lng}
        onChangeLng={mediaEdit.editModal.onChangeLng}
        busy={mediaEdit.editModal.busy}
        onRequestClose={mediaEdit.editModal.close}
        onSave={() => {
          void mediaEdit.editModal.save();
        }}
        onDelete={() => {
          void mediaEdit.editModal.remove();
        }}
      />

      <JourneyWeatherModal
        visible={m.visible}
        mode={m.mode}
        busy={m.busy}
        offline={m.offline}
        error={m.error}
        quotaLabel={m.quotaLabel}
        canRequest={m.canRequest}
        weatherDisplay={m.weatherDisplay}
        dismissButtonLabel={m.dismissButtonLabel}
        onRetry={() => {
          void m.retryAvailability();
        }}
        onRequestWeather={() => {
          void m.requestWeather();
        }}
        onDismiss={m.close}
        onSave={() => {
          void m.savePreview();
        }}
        onDelete={weatherOnDelete}
      />
    </>
  );
}
