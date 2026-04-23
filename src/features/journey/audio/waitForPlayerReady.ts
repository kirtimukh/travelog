import type { AudioPlayer, AudioStatus } from "expo-audio";

/**
 * Resolves when the player reports `isLoaded` or after timeout (BRD: avoid stuck BUFFERING UX).
 */
export function waitForPlayerReady(player: AudioPlayer, timeoutMs = 20000): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      clearTimeout(timer);
      subscription.remove();
      resolve();
    };

    const subscription = player.addListener("playbackStatusUpdate", (s: AudioStatus) => {
      if (s.isLoaded) {
        finish();
      }
    });

    const timer = setTimeout(finish, timeoutMs);
  });
}
