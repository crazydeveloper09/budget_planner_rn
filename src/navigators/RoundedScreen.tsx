import { SCREEN_TOP_RADIUS } from "../helpers/colors";
import React from "react";
import { StyleSheet, View } from "react-native";

export function roundedScreenLayout({ children }: { children: React.ReactNode }) {
  return <View style={styles.surface}>{children}</View>;
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: SCREEN_TOP_RADIUS,
    borderTopRightRadius: SCREEN_TOP_RADIUS,
    overflow: "hidden",
  },
});
