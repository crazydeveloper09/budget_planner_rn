import React, { useEffect } from "react";
import { ActivityIndicator, Image, StatusBar, StyleSheet, Text, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";

export default function LoadingScreen() {
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#702963" />
      <Image source={require("../../assets/icon.png")} style={styles.mark} resizeMode="contain" />
      <Text style={styles.title}>Budget</Text>
      <Text style={styles.subtitle}>Planner</Text>
      <ActivityIndicator size="large" color="#ffffff" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#702963",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  mark: {
    width: 168,
    height: 168,
    marginBottom: 8,
  },
  title: {
    fontFamily: "MontserratSemiBold",
    fontSize: 40,
    color: "#ffffff",
    letterSpacing: 0.4,
    lineHeight: 46,
  },
  subtitle: {
    fontFamily: "PoppinsRegular",
    fontSize: 28,
    color: "#e3c7e0",
    marginTop: -2,
    marginBottom: 28,
  },
  spinner: {
    marginTop: 8,
  },
});
