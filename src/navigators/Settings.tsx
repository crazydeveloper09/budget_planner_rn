import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, StyleSheet } from "react-native";
import { useAccent } from "../contexts/ThemeContext";
import SettingsIndexScreen from "../screens/Settings/Index";
import PrivacyScreen from "../screens/Settings/Privacy";
import { getStackScreenOptions } from "./stackOptions";

const Stack = createNativeStackNavigator();

const SettingsNavigator = () => {
  const { accent } = useAccent();
  return (
    <View style={styles.root}>
      <Stack.Navigator screenOptions={getStackScreenOptions(accent)}>
        <Stack.Screen
          name="Settings Index"
          component={SettingsIndexScreen}
          options={{ headerTitle: "Ustawienia" }}
        />
        <Stack.Screen
          name="Privacy"
          component={PrivacyScreen}
          options={{ headerTitle: "Polityka prywatności" }}
        />
      </Stack.Navigator>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default SettingsNavigator;
