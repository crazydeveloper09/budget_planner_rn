import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, StyleSheet } from "react-native";
import { useAccent } from "../contexts/ThemeContext";
import ExpensesIndexScreen from "../screens/Expenses/Index";
import { getStackScreenOptions } from "./stackOptions";

const Stack = createNativeStackNavigator();

const ExpensesNavigator = () => {
  const { accent } = useAccent();
  return (
    <View style={styles.root}>
      <Stack.Navigator screenOptions={getStackScreenOptions(accent)}>
        <Stack.Screen
          name="Expenses Index"
          component={ExpensesIndexScreen}
          options={{ headerTitle: "Podsumowanie" }}
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

export default ExpensesNavigator;
