import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, StyleSheet } from "react-native";
import { useAccent } from "../contexts/ThemeContext";
import GoalDetailsScreen from "../screens/User/GoalDetails";
import DailyBudgetScreen from "../screens/User/DailyBudget";
import WalletHistoryScreen from "../screens/User/WalletHistory";
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
          name="GoalDetails"
          component={GoalDetailsScreen}
          options={{ headerTitle: "Plan osiągnięcia celu" }}
        />
        <Stack.Screen
          name="DailyBudget"
          component={DailyBudgetScreen}
          options={{ headerTitle: "Cel i oszczędności" }}
        />
        <Stack.Screen
          name="WalletHistory"
          component={WalletHistoryScreen}
          options={{ headerTitle: "Historia portfela" }}
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
