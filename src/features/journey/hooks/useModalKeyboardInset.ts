import { useEffect, useState } from "react";
import { Dimensions, Keyboard } from "react-native";

/** Keyboard inset for bottom sheets that sit above the keyboard on iOS. */
export function useModalKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
      const { height: kbHeight, screenY } = e.endCoordinates;
      const winH = Dimensions.get("window").height;
      const fromBottom =
        screenY > 0 && screenY < winH ? winH - screenY : kbHeight;
      setInset(Math.max(kbHeight, fromBottom));
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setInset(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return inset;
}
