import { usePathname, useRouter } from "expo-router";
import { Pressable, Text } from "react-native";

type HeaderBackButtonProps = {
  isHomeScreen?: boolean;
};

export function HeaderBackButton({ isHomeScreen = false }: HeaderBackButtonProps) {
  const router = useRouter();
  const pathname = usePathname();

  if (isHomeScreen) {
    return null;
  }

  return (
    <Pressable
      className="px-2 py-1"
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }
        if (pathname !== "/") {
          router.replace("/");
        }
      }}
    >
      <Text className="text-xl font-semibold text-blue-600">{"<"}</Text>
    </Pressable>
  );
}
