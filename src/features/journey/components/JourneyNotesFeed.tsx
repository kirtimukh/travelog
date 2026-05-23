import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import type { AudioPlayer, AudioStatus } from "expo-audio";
import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";

import { enterPlaybackSession, registerPlayer } from "../../../audio/audioSessionManager";
import type { LocationPointRow, MediaRow, NoteRow } from "../../../db/schema";

import { waitForPlayerReady } from "../audio/waitForPlayerReady";
import { formatDurationSeconds } from "../formatDuration";
import type { JourneyPauseWindow } from "../replay";

import {
  buildFeed,
  type FeedItem,
  latLngLabelForNote,
  MEDIA_FEED_THUMBNAIL_HEIGHT,
  mediaListMetaLine,
  mediaThumbWidth,
  notePreviewText,
  shouldShowNoteBodyBelowPlayer,
} from "./JourneyNotesFeed.utils";
import { formatListTimestamp } from "../displayFormatters";

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

function MediaFeedThumbnail({ media }: { media: MediaRow }) {
  return (
    <Image
      source={{ uri: media.file }}
      style={{ height: MEDIA_FEED_THUMBNAIL_HEIGHT, width: mediaThumbWidth(media) }}
      resizeMode="contain"
    />
  );
}

function MediaFeedCaption({ media }: { media: MediaRow }) {
  const caption = media.text?.trim();
  if (!caption) {
    return (
      <View className="mt-2 flex-row items-center">
        <MediaFeedThumbnail media={media} />
      </View>
    );
  }
  return (
    <Text className="mt-2 text-sm text-neutral-900">
      <MediaFeedThumbnail media={media} />{" "}
      {caption}
    </Text>
  );
}

type FeedRenderContext = {
  editable: boolean;
  locationPoints: LocationPointRow[];
  onLongPressNote: (note: NoteRow) => void;
  onLongPressMedia: (item: MediaRow) => void;
  feedVoiceAudio: FeedVoiceAudio;
};

function renderFeedItem(item: FeedItem, ctx: FeedRenderContext): ReactElement {
  const { editable, locationPoints, onLongPressNote, onLongPressMedia, feedVoiceAudio } = ctx;

  switch (item.kind) {
    case "note":
      return editable ? (
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
      );
    case "media":
      return editable ? (
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
      );
    case "pause":
      return (
        <View
          key={`pause-${item.data.startTs}-${item.data.endTs ?? "open"}`}
          className="mt-3 rounded-md border border-neutral-200 p-3"
        >
          <Text className="text-sm text-neutral-900">
            Pause {formatListTimestamp(item.data.startTs)} -{" "}
            {item.data.endTs == null ? "ongoing" : formatListTimestamp(item.data.endTs)}
          </Text>
        </View>
      );
  }
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
  const feed = useMemo(
    () => buildFeed(notes, media, pauseWindows),
    [notes, media, pauseWindows],
  );
  const total = feed.length;

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

  const feedCtx: FeedRenderContext = {
    editable,
    locationPoints,
    onLongPressNote,
    onLongPressMedia,
    feedVoiceAudio,
  };

  return (
    <View className="mb-10 mt-6 rounded-xl border border-neutral-200 p-4">
      <Text className="text-base font-semibold text-neutral-900">Notes ({total})</Text>
      {feed.map((item) => renderFeedItem(item, feedCtx))}
    </View>
  );
}
