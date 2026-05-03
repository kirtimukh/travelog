export type JourneyArtifactsLiveSuspendExtras = {
  textNoteModalVisible: boolean;
  voiceNoteModalVisible: boolean;
  rerecordSessionActive: boolean;
  mediaAddModalVisible: boolean;
};

/**
 * Single rule for when the journey notes feed should suspend shared voice playback.
 */
export function computeJourneyArtifactsSuspendPlayback(args: {
  noteEditOpen: boolean;
  mediaEditOpen: boolean;
  weatherModalVisible: boolean;
  liveExtras?: JourneyArtifactsLiveSuspendExtras;
}): boolean {
  const base =
    args.noteEditOpen || args.mediaEditOpen || args.weatherModalVisible;
  const x = args.liveExtras;
  if (!x) {
    return base;
  }
  return (
    base ||
    x.textNoteModalVisible ||
    x.voiceNoteModalVisible ||
    x.rerecordSessionActive ||
    x.mediaAddModalVisible
  );
}
