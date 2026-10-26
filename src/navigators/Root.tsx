import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
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
  const { isReady: authReady } = useAuth();
  const { isReady, profile } = useProfile();
  const { accent } = useAccent();

  if (!authReady || !isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
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

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default RootNavigator;
