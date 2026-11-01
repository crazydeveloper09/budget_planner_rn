import React, { useEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as SplashScreen from "expo-splash-screen";
import LoadingScreen from "../components/LoadingScreen";
import { useAuth } from "../contexts/AuthContext";
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
  const { isReady: authReady } = useAuth();
  const { isReady, profile } = useProfile();
  const booting = !authReady || !isReady;

  useEffect(() => {
    if (!booting) void SplashScreen.hideAsync().catch(() => undefined);
  }, [booting]);

  if (booting) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
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
};

export default RootNavigator;
