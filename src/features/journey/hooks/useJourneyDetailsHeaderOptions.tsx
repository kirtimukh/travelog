import { useEffect, type ReactElement } from "react";
import { Text, View } from "react-native";

import { AppHeaderMenu } from "../../../components/AppHeaderMenu";
import { HeaderBackButton } from "../../../components/HeaderBackButton";
import type { JourneyRow } from "../../../db/schema";

type HeaderNavigation = {
  setOptions: (options: {
    headerTitle?: () => ReactElement;
    headerLeft?: () => ReactElement;
    headerRight?: () => ReactElement;
  }) => void;
};

type Params = {
  navigation: HeaderNavigation;
  journey: JourneyRow | null;
  journeyId: number;
  ongoingJourneyId: number | null;
  requestDeleteJourney: () => void;
  deleteJourneyBusy: boolean;
  noteOrMediaBusy: boolean;
};

export function useJourneyDetailsHeaderOptions({
  navigation,
  journey,
  journeyId,
  ongoingJourneyId,
  requestDeleteJourney,
  deleteJourneyBusy,
  noteOrMediaBusy,
}: Params): void {
  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View className="max-w-[72%] flex-row items-center gap-2">
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            className="shrink text-base font-semibold text-neutral-900"
          >
            {journey?.name ?? "Journey"}
          </Text>
          <View className="rounded-full bg-emerald-100 px-2 py-0.5">
            <Text className="text-xs font-semibold uppercase text-emerald-800">Complete</Text>
          </View>
        </View>
      ),
      headerLeft: () => <HeaderBackButton />,
      headerRight: () => (
        <AppHeaderMenu
          showHome
          showHistory
          ongoingJourneyId={ongoingJourneyId}
          hideOngoing={ongoingJourneyId === journeyId}
          onDeleteJourney={requestDeleteJourney}
          deleteJourneyDisabled={noteOrMediaBusy || deleteJourneyBusy}
        />
      ),
    });
  }, [
    deleteJourneyBusy,
    journey,
    journeyId,
    navigation,
    noteOrMediaBusy,
    ongoingJourneyId,
    requestDeleteJourney,
  ]);
}
