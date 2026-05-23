import { JourneyMediaEditModal } from "../components/JourneyMediaEditModal";
import { JourneyNoteEditModal } from "../components/JourneyNoteEditModal";
import type { UseMediaEditFlowResult } from "../hooks/useMediaEditFlow";
import type { UseNoteEditFlowResult } from "../hooks/useNoteEditFlow";

export type JourneyArtifactsEditorModalsProps = {
  noteEdit: UseNoteEditFlowResult;
  mediaEdit: UseMediaEditFlowResult;
  onRerecordAudio: () => void;
};

export function JourneyArtifactsEditorModals({
  noteEdit,
  mediaEdit,
  onRerecordAudio,
}: JourneyArtifactsEditorModalsProps) {
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
    </>
  );
}
