import type { LocationPointRow, MediaRow, NoteRow } from "../../../db/schema";
import type { JourneyPauseWindow } from "../replay";
import { JourneyNotesFeed } from "../components/JourneyNotesFeed";
import type { UseMediaEditFlowResult } from "../hooks/useMediaEditFlow";
import type { UseNoteEditFlowResult } from "../hooks/useNoteEditFlow";
import {
  computeJourneyArtifactsSuspendPlayback,
  type JourneyArtifactsLiveSuspendExtras,
} from "./suspendPlayback";

export type JourneyArtifactsFeedProps = {
  notes: NoteRow[];
  media: MediaRow[];
  pauseWindows: JourneyPauseWindow[];
  locationPoints: LocationPointRow[];
  editable?: boolean;
  noteEdit: UseNoteEditFlowResult;
  mediaEdit: UseMediaEditFlowResult;
  liveSuspendExtras?: JourneyArtifactsLiveSuspendExtras;
};

export function JourneyArtifactsFeed({
  notes,
  media: mediaRows,
  pauseWindows,
  locationPoints,
  editable = true,
  noteEdit,
  mediaEdit,
  liveSuspendExtras,
}: JourneyArtifactsFeedProps) {
  const suspendPlayback = computeJourneyArtifactsSuspendPlayback({
    noteEditOpen: noteEdit.target !== null,
    mediaEditOpen: mediaEdit.editModal.target !== null,
    liveExtras: liveSuspendExtras,
  });

  return (
    <JourneyNotesFeed
      notes={notes}
      media={mediaRows}
      pauseWindows={pauseWindows}
      locationPoints={locationPoints}
      editable={editable}
      suspendPlayback={suspendPlayback}
      onLongPressNote={(note) => {
        if (!editable) {
          return;
        }
        noteEdit.openFor(note);
      }}
      onLongPressMedia={(item) => {
        if (!editable) {
          return;
        }
        mediaEdit.editModal.openFor(item);
      }}
    />
  );
}
