import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";

export const getStackScreenOptions = (accent: string): NativeStackNavigationOptions => ({
  statusBarStyle: "light",
  // Older Android versions use this color; edge-to-edge draws the header underneath.
  statusBarBackgroundColor: accent,
  headerStyle: {
    backgroundColor: accent,
  },
  headerTintColor: "white",
  headerTitleAlign: "center",
  headerShadowVisible: false,
  headerTitleStyle: {
    color: "white" as const,
    fontFamily: "MontserratSemiBold",
    fontSize: 19,
  },
  contentStyle: {
    backgroundColor: accent,
  },
});
