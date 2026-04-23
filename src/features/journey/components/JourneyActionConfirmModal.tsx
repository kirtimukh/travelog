import { type ReactElement, useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

const HOLD_MS = 2000;

export type JourneyActionConfirmKind = "start" | "pause" | "continue";

type Props = {
  visible: boolean;
  actionKind: JourneyActionConfirmKind;
  onCancel: () => void;
  onConfirmHoldComplete: () => void;
};

function getCopy(kind: JourneyActionConfirmKind): { title: string; message: string } {
  switch (kind) {
    case "start":
      return {
        title: "Start journey?",
        message:
          "Location will be used to map your route. Hold the button below for 3 seconds to confirm.",
      };
    case "pause":
      return {
        title: "Pause journey?",
        message: "Recording will pause until you continue. Hold for 3 seconds to confirm.",
      };
    case "continue":
      return {
        title: "Continue journey?",
        message: "Recording will resume. Hold for 3 seconds to confirm.",
      };
  }
}

export function JourneyActionConfirmModal({
  visible,
  actionKind,
  onCancel,
  onConfirmHoldComplete,
}: Props): ReactElement {
  const [holdProgress, setHoldProgress] = useState(0);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTsRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  const clearHold = useCallback(() => {
    if (holdIntervalRef.current != null) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    startTsRef.current = null;
    setHoldProgress(0);
  }, []);

  useEffect(() => {
    if (visible) {
      completedRef.current = false;
      clearHold();
    }
  }, [visible, clearHold]);

  useEffect(
    () => () => {
      if (holdIntervalRef.current != null) {
        clearInterval(holdIntervalRef.current);
      }
    },
    [],
  );

  const onHoldPressIn = useCallback(() => {
    completedRef.current = false;
    startTsRef.current = Date.now();
    if (holdIntervalRef.current != null) {
      clearInterval(holdIntervalRef.current);
    }
    holdIntervalRef.current = setInterval(() => {
      const start = startTsRef.current;
      if (start == null) {
        return;
      }
      const elapsed = Date.now() - start;
      const p = Math.min(1, elapsed / HOLD_MS);
      setHoldProgress(p);
      if (p < 1) {
        return;
      }
      if (holdIntervalRef.current != null) {
        clearInterval(holdIntervalRef.current);
        holdIntervalRef.current = null;
      }
      startTsRef.current = null;
      if (!completedRef.current) {
        completedRef.current = true;
        onConfirmHoldComplete();
      }
    }, 32);
  }, [onConfirmHoldComplete]);

  const onHoldPressOut = useCallback(() => {
    if (!completedRef.current) {
      clearHold();
    }
  }, [clearHold]);

  const copy = getCopy(actionKind);
  const holdLabel = holdProgress > 0 && holdProgress < 1
    ? `Keep holding… ${Math.round(holdProgress * 100)}%`
    : "Press and hold to confirm";

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View className="flex-1">
        <Pressable
          className="absolute inset-0"
          onPress={onCancel}
          accessibilityLabel="Close confirmation"
        />
        <View
          className="flex-1 items-center justify-center bg-black/50 px-4"
          pointerEvents="box-none"
        >
          <View className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-4 shadow">
            <Text className="text-lg font-semibold text-neutral-900">{copy.title}</Text>
            <Text className="mt-2 text-sm text-neutral-600">{copy.message}</Text>
            <View className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
              <View
                className="h-full rounded-full bg-emerald-600"
                style={{ width: `${holdProgress * 100}%` }}
              />
            </View>
            <Pressable
              className={`mt-3 rounded-md px-4 py-3 ${holdProgress > 0 && holdProgress < 1 ? "bg-emerald-700" : "bg-emerald-600"}`}
              onPressIn={onHoldPressIn}
              onPressOut={onHoldPressOut}
            >
              <Text className="text-center font-semibold text-white">{holdLabel}</Text>
            </Pressable>
            <Pressable
              className="mt-2 rounded-md border border-neutral-300 bg-white px-4 py-3"
              onPress={onCancel}
            >
              <Text className="text-center font-semibold text-neutral-800">Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
