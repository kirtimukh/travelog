import { useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

type AppHeaderMenuProps = {
  showHome: boolean;
  showHistory: boolean;
  ongoingJourneyId: number | null;
  hideOngoing?: boolean;
  onEndJourney?: () => void;
  endJourneyDisabled?: boolean;
  onDeleteJourney?: () => void;
  deleteJourneyDisabled?: boolean;
};

export function AppHeaderMenu({
  showHome,
  showHistory,
  ongoingJourneyId,
  hideOngoing = false,
  onEndJourney,
  endJourneyDisabled = false,
  onDeleteJourney,
  deleteJourneyDisabled = false,
}: AppHeaderMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState<boolean>(false);
  const showOngoing = ongoingJourneyId != null && !hideOngoing;

  return (
    <>
      <Pressable
        className="px-2 py-1"
        onPress={() => {
          setOpen(true);
        }}
      >
        <Text className="text-2xl font-semibold text-neutral-700">{"\u2261"}</Text>
      </Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1" onPress={() => setOpen(false)}>
          <View className="absolute right-4 top-20 w-48 rounded-md border border-neutral-200 bg-white p-2 shadow">
            {showHome ? (
              <Pressable
                className="rounded-md px-3 py-2"
                onPress={() => {
                  setOpen(false);
                  router.replace("/");
                }}
              >
                <Text className="font-medium text-neutral-900">Home</Text>
              </Pressable>
            ) : null}
            {showHistory ? (
              <Pressable
                className="rounded-md px-3 py-2"
                onPress={() => {
                  setOpen(false);
                  router.push("/journeys");
                }}
              >
                <Text className="font-medium text-neutral-900">History</Text>
              </Pressable>
            ) : null}
            {showOngoing ? (
              <Pressable
                className="rounded-md px-3 py-2"
                onPress={() => {
                  setOpen(false);
                  router.push(`/journey/${ongoingJourneyId}`);
                }}
              >
                <Text className="font-medium text-neutral-900">Ongoing</Text>
              </Pressable>
            ) : null}
            {onEndJourney != null || onDeleteJourney != null ? (
              <View className="mt-2 gap-2 border-t border-neutral-200 pt-2">
                {onEndJourney ? (
                  <Pressable
                    className={`rounded-md px-3 py-2 ${endJourneyDisabled ? "bg-neutral-100" : "bg-white"}`}
                    disabled={endJourneyDisabled}
                    onPress={() => {
                      setOpen(false);
                      onEndJourney();
                    }}
                  >
                    <Text
                      className={`font-medium ${endJourneyDisabled ? "text-neutral-400" : "text-red-700"}`}
                    >
                      End Journey
                    </Text>
                  </Pressable>
                ) : null}
                {onDeleteJourney ? (
                  <Pressable
                    className={`rounded-md px-3 py-2 ${deleteJourneyDisabled ? "bg-neutral-100" : "bg-white"}`}
                    disabled={deleteJourneyDisabled}
                    onPress={() => {
                      setOpen(false);
                      onDeleteJourney();
                    }}
                  >
                    <Text
                      className={`font-medium ${deleteJourneyDisabled ? "text-neutral-400" : "text-red-700"}`}
                    >
                      Delete journey
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
