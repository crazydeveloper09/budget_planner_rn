import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, StyleSheet } from "react-native";
import { useAccent } from "../contexts/ThemeContext";
import RankingsScreen from "../screens/User/Rankings";
import UserIndexScreen from "../screens/User/Index";
import { getStackScreenOptions } from "./stackOptions";

const Stack = createNativeStackNavigator();

const UserNavigator = () => {
  const { accent } = useAccent();
  return (
    <View style={styles.root}>
      <Stack.Navigator screenOptions={getStackScreenOptions(accent)}>
        <Stack.Screen
          name="User Index"
          component={UserIndexScreen}
          options={{ headerTitle: "Profil" }}
        />
        <Stack.Screen
          name="FamilyRankings"
          component={RankingsScreen}
          options={{ headerTitle: "Ranking rodziny" }}
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

export default UserNavigator;
