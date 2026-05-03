import { computeJourneyArtifactsSuspendPlayback } from "../suspendPlayback";

describe("computeJourneyArtifactsSuspendPlayback", () => {
  it("is true when any base editor is open", () => {
    expect(
      computeJourneyArtifactsSuspendPlayback({
        noteEditOpen: true,
        mediaEditOpen: false,
        weatherModalVisible: false,
      }),
    ).toBe(true);
    expect(
      computeJourneyArtifactsSuspendPlayback({
        noteEditOpen: false,
        mediaEditOpen: true,
        weatherModalVisible: false,
      }),
    ).toBe(true);
    expect(
      computeJourneyArtifactsSuspendPlayback({
        noteEditOpen: false,
        mediaEditOpen: false,
        weatherModalVisible: true,
      }),
    ).toBe(true);
  });

  it("is false when nothing is open and no live extras", () => {
    expect(
      computeJourneyArtifactsSuspendPlayback({
        noteEditOpen: false,
        mediaEditOpen: false,
        weatherModalVisible: false,
      }),
    ).toBe(false);
  });

  it("includes live extras when provided", () => {
    const liveExtras = {
      textNoteModalVisible: false,
      voiceNoteModalVisible: false,
      rerecordSessionActive: false,
      mediaAddModalVisible: true,
    };
    expect(
      computeJourneyArtifactsSuspendPlayback({
        noteEditOpen: false,
        mediaEditOpen: false,
        weatherModalVisible: false,
        liveExtras,
      }),
    ).toBe(true);
  });
});
