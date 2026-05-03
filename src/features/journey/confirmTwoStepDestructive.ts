import { Alert } from "react-native";

export type ConfirmTwoStepDestructiveOptions = {
  firstTitle: string;
  firstMessage: string;
  secondTitle: string;
  secondMessage: string;
  continueLabel?: string;
  finalDestructiveLabel: string;
  onFinalConfirm: () => void | Promise<void>;
};

export function confirmTwoStepDestructiveAction(
  options: ConfirmTwoStepDestructiveOptions,
): void {
  const {
    firstTitle,
    firstMessage,
    secondTitle,
    secondMessage,
    continueLabel = "Continue",
    finalDestructiveLabel,
    onFinalConfirm,
  } = options;

  Alert.alert(firstTitle, firstMessage, [
    { text: "Cancel", style: "cancel" },
    {
      text: continueLabel,
      style: "destructive",
      onPress: () => {
        Alert.alert(secondTitle, secondMessage, [
          { text: "Cancel", style: "cancel" },
          {
            text: finalDestructiveLabel,
            style: "destructive",
            onPress: () => {
              void (async () => {
                await onFinalConfirm();
              })();
            },
          },
        ]);
      },
    },
  ]);
}
