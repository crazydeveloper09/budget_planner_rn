import React, { useEffect } from "react";
import { Platform, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaProvider, useSafeAreaFrame, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as SplashScreen from "expo-splash-screen";
import LoadingScreen from "../components/LoadingScreen";
import { useAuth } from "../contexts/AuthContext";
import { useAccent } from "../contexts/ThemeContext";
import { useProfile } from "../contexts/ProfileContext";
import AuthScreen from "../screens/Auth/Index";
import OnboardingScreen from "../screens/Onboarding/Index";
import MainNavigator from "./Main";

const Stack = createNativeStackNavigator();

function OnboardingRoute() {
  const navigation = useNavigation();
  return <OnboardingScreen onLoginPress={() => navigation.navigate("Auth" as never)} />;
}

const RootNavigator = () => {
  const { accent } = useAccent();
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const { isReady: authReady } = useAuth();
  const { isReady, profile } = useProfile();
  const booting = !authReady || !isReady;

  useEffect(() => {
    if (!booting) void SplashScreen.hideAsync().catch(() => undefined);
  }, [booting]);

  if (booting) {
    return <LoadingScreen />;
  }

  const navigator = (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        statusBarStyle: "light",
        statusBarBackgroundColor: accent,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: "#fff" },
      }}
    >
      {profile ? (
        <>
          <Stack.Screen name="Main" component={MainNavigator} />
          <Stack.Screen name="Auth" component={AuthScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Onboarding" component={OnboardingRoute} />
          <Stack.Screen name="Auth" component={AuthScreen} />
        </>
      )}
    </Stack.Navigator>
  );

  if (Platform.OS !== "android") return navigator;

  return (
    <View style={[styles.root, { backgroundColor: accent }]}>
      <StatusBar barStyle="light-content" backgroundColor={accent} translucent />
      {/* Reserve real space outside native screens instead of overlaying their surfaces. */}
      <View style={{ height: insets.top, backgroundColor: accent }} />
      <SafeAreaProvider
        style={styles.root}
        initialMetrics={{
          frame: { ...frame, y: frame.y + insets.top, height: Math.max(0, frame.height - insets.top) },
          insets: { ...insets, top: 0 },
        }}
      >
        {navigator}
      </SafeAreaProvider>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default RootNavigator;

