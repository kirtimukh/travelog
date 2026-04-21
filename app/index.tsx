import { Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-white px-6 pt-12">
      <Text className="text-xl font-bold text-blue-600">MapMyTrip</Text>
      <Text className="mt-4 font-mono text-sm text-neutral-800">
        Home — create or resume a journey from upcoming screens.
      </Text>
    </View>
  );
}
