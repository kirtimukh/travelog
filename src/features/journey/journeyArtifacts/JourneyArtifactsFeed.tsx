import type { LocationPointRow, MediaRow, NoteRow, WeatherRow } from "../../../db/schema";
import type { JourneyPauseWindow } from "../replay";
import { JourneyNotesFeed } from "../components/JourneyNotesFeed";
import type { UseMediaEditFlowResult } from "../hooks/useMediaEditFlow";
import type { UseNoteEditFlowResult } from "../hooks/useNoteEditFlow";
import type { UseWeatherCaptureFlowResult } from "../hooks/useWeatherCaptureFlow";
import {
  computeJourneyArtifactsSuspendPlayback,
  type JourneyArtifactsLiveSuspendExtras,
} from "./suspendPlayback";

export type JourneyArtifactsFeedProps = {
  notes: NoteRow[];
  media: MediaRow[];
  weather: WeatherRow[];
  pauseWindows: JourneyPauseWindow[];
  locationPoints: LocationPointRow[];
  editable?: boolean;
  noteEdit: UseNoteEditFlowResult;
  mediaEdit: UseMediaEditFlowResult;
  weatherCapture: UseWeatherCaptureFlowResult;
  liveSuspendExtras?: JourneyArtifactsLiveSuspendExtras;
};

export function JourneyArtifactsFeed({
  notes,
  media: mediaRows,
  weather: weatherRows,
  pauseWindows,
  locationPoints,
  editable = true,
  noteEdit,
  mediaEdit,
  weatherCapture,
  liveSuspendExtras,
}: JourneyArtifactsFeedProps) {
  const suspendPlayback = computeJourneyArtifactsSuspendPlayback({
    noteEditOpen: noteEdit.target !== null,
    mediaEditOpen: mediaEdit.editModal.target !== null,
    weatherModalVisible: weatherCapture.modal.visible,
    liveExtras: liveSuspendExtras,
  });

  return (
    <JourneyNotesFeed
      notes={notes}
      media={mediaRows}
      weather={weatherRows}
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
      onLongPressWeather={(row) => {
        weatherCapture.modal.openForWeather(row);
      }}
    />
  );
}
