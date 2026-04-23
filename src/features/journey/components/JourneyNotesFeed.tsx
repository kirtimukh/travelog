import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import type { AudioPlayer, AudioStatus } from "expo-audio";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";

import { enterPlaybackSession, registerPlayer } from "../../../audio/audioSessionManager";
import type { JourneyPauseWindow } from "../replay";

import { waitForPlayerReady } from "../audio/waitForPlayerReady";
import type { LocationPointRow, MediaRow, NoteRow } from "../../../db/schema";
import { formatDurationSeconds } from "../formatDuration";

const MEDIA_FEED_THUMBNAIL_HEIGHT = 100;


type FeedItem =
  | { kind: "note"; data: NoteRow; sortTs: number }
  | { kind: "media"; data: MediaRow; sortTs: number }
  | { kind: "pause"; data: JourneyPauseWindow; sortTs: number };

function buildFeed(
  notes: NoteRow[],
  media: MediaRow[],
  pauseWindows: JourneyPauseWindow[],
): FeedItem[] {
  const items: FeedItem[] = [
    ...notes.map((n) => ({
      kind: "note" as const,
      data: n,
      sortTs: n.timestamp,
    })),
    ...media.map((m) => ({
      kind: "media" as const,
      data: m,
      sortTs: m.timestamp ?? Number.MAX_SAFE_INTEGER,
    })),
    ...pauseWindows.map((window) => ({
      kind: "pause" as const,
      data: window,
      sortTs: window.startTs,
    })),
  ];
  items.sort((a, b) => a.sortTs - b.sortTs);
  return items;
}

function notePreviewText(note: NoteRow): string {
  const text = note.text?.trim();
  if (text) {
    return text;
  }
  const transcript = note.audio_transcript?.trim();
  if (transcript) {
    return transcript;
  }
  if (note.type === "voice") {
    return "Voice note";
  }
  return "";
}

function formatListTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatLatLngPair(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function nearestPointByTimestamp(
  points: LocationPointRow[],
  targetTs: number,
): LocationPointRow | null {
  if (points.length === 0) {
    return null;
  }
  let best = points[0]!;
  let bestAbs = Math.abs(best.timestamp - targetTs);
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    const abs = Math.abs(p.timestamp - targetTs);
    if (abs < bestAbs) {
      bestAbs = abs;
      best = p;
    }
  }
  return best;
}

function latLngLabelForNote(note: NoteRow, locationPoints: LocationPointRow[]): string {
  const p = nearestPointByTimestamp(locationPoints, note.timestamp);
  if (!p) {
    return "—";
  }
  return formatLatLngPair(p.lat, p.lng);
}

function latLngLabelForMedia(media: MediaRow, locationPoints: LocationPointRow[]): string {
  if (media.lat != null && media.lng != null) {
    return formatLatLngPair(media.lat, media.lng);
  }
  if (media.timestamp == null || locationPoints.length === 0) {
    return "—";
  }
  const p = nearestPointByTimestamp(locationPoints, media.timestamp);
  if (!p) {
    return "—";
  }
  return formatLatLngPair(p.lat, p.lng);
}

/** Hide placeholder copy when an inline player is shown for the same row. */
function shouldShowNoteBodyBelowPlayer(note: NoteRow, preview: string): boolean {
  if (!preview) {
    return false;
  }
  if (note.type === "voice" && note.audio_file && preview === "Voice note") {
    return false;
  }
  return true;
}

function mediaListMetaLine(media: MediaRow, locationPoints: LocationPointRow[]): string {
  const timePart =
    media.timestamp != null ? formatListTimestamp(media.timestamp) : "—";
  return `${timePart} · (${latLngLabelForMedia(media, locationPoints)})`;
}

function mediaThumbWidth(media: MediaRow): number {
  if (media.width != null && media.height != null && media.width > 0 && media.height > 0) {
    return MEDIA_FEED_THUMBNAIL_HEIGHT * (media.width / media.height);
  }
  return MEDIA_FEED_THUMBNAIL_HEIGHT;
}

function MediaFeedCaption({ media }: { media: MediaRow }) {
  const caption = media.text?.trim();
  if (!caption) {
    return (
      <View className="mt-2 flex-row items-center">
        <Image
          source={{ uri: media.file }}
          style={{ height: MEDIA_FEED_THUMBNAIL_HEIGHT, width: mediaThumbWidth(media) }}
          resizeMode="contain"
        />
      </View>
    );
  }
  return (
    <Text className="mt-2 text-sm text-neutral-900">
      <Image
        source={{ uri: media.file }}
        style={{ height: MEDIA_FEED_THUMBNAIL_HEIGHT, width: mediaThumbWidth(media) }}
        resizeMode="contain"
      />{" "}
      {caption}
    </Text>
  );
}

type FeedVoiceAudio = {
  player: AudioPlayer;
  status: AudioStatus;
  activeVoiceUri: string | null;
  setActiveVoiceUri: (uri: string | null) => void;
};

/**
 * One shared native player for the feed (voice_note_brd.md §4.3.1).
 * Inactive rows show current as 0:00 (not the last active row's position).
 */
function VoiceNoteFeedRowPlayer({
  note,
  busy,
  playLabel,
  pauseLabel,
  player,
  status,
  activeVoiceUri,
  setActiveVoiceUri,
}: {
  note: NoteRow;
  busy: boolean;
  playLabel: string;
  pauseLabel: string;
} & FeedVoiceAudio) {
  const uri = note.audio_file!;
  const isThisTrack = activeVoiceUri === uri;
  const isPlayingThis = isThisTrack && status.playing;

  const togglePlayback = useCallback(async () => {
    if (busy) {
      return;
    }

    const wasThisTrack = activeVoiceUri === uri;

    if (wasThisTrack && status.playing) {
      player.pause();
      return;
    }

    if (!wasThisTrack) {
      player.pause();
      player.replace(uri);
      setActiveVoiceUri(uri);
      await waitForPlayerReady(player);
      await player.seekTo(0);
    } else {
      const nearEnd =
        status.didJustFinish ||
        (status.duration > 0 && status.currentTime >= status.duration - 0.05);
      if (nearEnd) {
        await player.seekTo(0);
      }
    }

    await enterPlaybackSession();
    player.play();
  }, [
    activeVoiceUri,
    busy,
    player,
    setActiveVoiceUri,
    status.currentTime,
    status.didJustFinish,
    status.duration,
    status.playing,
    uri,
  ]);

  const storedTotal = note.audio_duration != null && note.audio_duration > 0;
  const totalLabel = isThisTrack
    ? status.duration > 0
      ? formatDurationSeconds(status.duration)
      : storedTotal
        ? formatDurationSeconds(note.audio_duration!)
        : "—:—"
    : storedTotal
      ? formatDurationSeconds(note.audio_duration!)
      : "—:—";

  const currentLabel = isThisTrack ? formatDurationSeconds(status.currentTime) : "0:00";

  return (
    <View className="mt-3">
      <Text className="text-center text-sm tabular-nums text-neutral-700">
        {currentLabel} / {totalLabel}
      </Text>
      <Pressable
        className={`mt-2 rounded-md px-3 py-2 ${busy ? "bg-neutral-300" : "bg-neutral-700"}`}
        disabled={busy}
        onPress={() => {
          void togglePlayback();
        }}
      >
        <Text className="text-center font-semibold text-white">
          {isPlayingThis ? pauseLabel : playLabel}
        </Text>
      </Pressable>
    </View>
  );
}

function NoteFeedRowBody({
  note,
  locationPoints,
  feedVoiceAudio,
}: {
  note: NoteRow;
  locationPoints: LocationPointRow[];
  feedVoiceAudio: FeedVoiceAudio;
}) {
  const preview = notePreviewText(note);
  const showVoicePlayer = note.type === "voice" && note.audio_file;
  return (
    <>
      <Text className="text-xs text-neutral-500">
        {formatListTimestamp(note.timestamp)} · ({latLngLabelForNote(note, locationPoints)})
      </Text>
      {showVoicePlayer ? (
        <VoiceNoteFeedRowPlayer
          note={note}
          busy={false}
          playLabel="Play"
          pauseLabel="Pause"
          {...feedVoiceAudio}
        />
      ) : null}
      {shouldShowNoteBodyBelowPlayer(note, preview) ? (
        <Text className="mt-1 text-sm text-neutral-900">{preview}</Text>
      ) : null}
    </>
  );
}

type Props = {
  notes: NoteRow[];
  media: MediaRow[];
  pauseWindows?: JourneyPauseWindow[];
  locationPoints?: LocationPointRow[];
  editable?: boolean;
  onLongPressNote: (note: NoteRow) => void;
  onLongPressMedia: (item: MediaRow) => void;
  /** When true, pauses the shared list player (modals / re-record overlay own audio). */
  suspendPlayback?: boolean;
};

/**
 * Chronological notes/media feed with one shared voice player.
 * Legacy voice rows may have `audio_duration` null (migration strategy A); total uses stored value or live duration when active. Lazy DB backfill deferred (voice_note_brd.md §3.3). Validate on device (BRD §6 D).
 */
export function JourneyNotesFeed({
  notes,
  media,
  pauseWindows = [],
  locationPoints = [],
  editable = true,
  onLongPressNote,
  onLongPressMedia,
  suspendPlayback = false,
}: Props) {
  const feed = buildFeed(notes, media, pauseWindows);
  const total = notes.length + media.length + pauseWindows.length;

  const feedPlayer = useAudioPlayer(null);
  const feedStatus = useAudioPlayerStatus(feedPlayer);
  const [activeVoiceUri, setActiveVoiceUri] = useState<string | null>(null);

  useEffect(() => {
    return registerPlayer(feedPlayer);
  }, [feedPlayer]);

  useEffect(() => {
    if (suspendPlayback) {
      feedPlayer.pause();
    }
  }, [suspendPlayback, feedPlayer]);

  const feedVoiceAudio: FeedVoiceAudio = {
    player: feedPlayer,
    status: feedStatus,
    activeVoiceUri,
    setActiveVoiceUri,
  };

  return (
    <View className="mb-10 mt-6 rounded-xl border border-neutral-200 p-4">
      <Text className="text-base font-semibold text-neutral-900">Notes ({total})</Text>
      {feed.map((item) =>
        item.kind === "note" ? (
          editable ? (
            <Pressable
              key={`note-${item.data.id}`}
              className="mt-3 rounded-md border border-neutral-200 p-3 active:bg-neutral-50"
              onLongPress={() => {
                onLongPressNote(item.data);
              }}
              delayLongPress={350}
            >
              <NoteFeedRowBody
                note={item.data}
                locationPoints={locationPoints}
                feedVoiceAudio={feedVoiceAudio}
              />
            </Pressable>
          ) : (
            <View
              key={`note-${item.data.id}`}
              className="mt-3 rounded-md border border-neutral-200 p-3"
            >
              <NoteFeedRowBody
                note={item.data}
                locationPoints={locationPoints}
                feedVoiceAudio={feedVoiceAudio}
              />
            </View>
          )
        ) : item.kind === "media" ? (
          editable ? (
            <Pressable
              key={`media-${item.data.id}`}
              className="mt-3 overflow-hidden rounded-md border border-neutral-200 active:bg-neutral-50"
              onLongPress={() => {
                onLongPressMedia(item.data);
              }}
              delayLongPress={350}
            >
              <View className="border-b border-neutral-200 bg-neutral-50 px-3 py-2">
                <Text className="text-xs text-neutral-500">
                  {mediaListMetaLine(item.data, locationPoints)}
                </Text>
              </View>
              <View className="px-3 pb-3">
                <MediaFeedCaption media={item.data} />
              </View>
            </Pressable>
          ) : (
            <View
              key={`media-${item.data.id}`}
              className="mt-3 overflow-hidden rounded-md border border-neutral-200"
            >
              <View className="border-b border-neutral-200 bg-neutral-50 px-3 py-2">
                <Text className="text-xs text-neutral-500">
                  {mediaListMetaLine(item.data, locationPoints)}
                </Text>
              </View>
              <View className="px-3 pb-3">
                <MediaFeedCaption media={item.data} />
              </View>
            </View>
          )
        ) : (
          <View
            key={`pause-${item.data.startTs}-${item.data.endTs ?? "open"}`}
            className="mt-3 rounded-md border border-neutral-200 p-3"
          >
            <Text className="text-sm text-neutral-900">
              Pause {formatListTimestamp(item.data.startTs)} -{" "}
              {item.data.endTs == null ? "ongoing" : formatListTimestamp(item.data.endTs)}
            </Text>
          </View>
        ),
      )}
    </View>
  );
}
