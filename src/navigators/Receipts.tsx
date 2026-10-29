import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, StyleSheet } from "react-native";
import { useAccent } from "../contexts/ThemeContext";
import ReceiptsIndexScreen from "../screens/Receipts/Index";
import { getStackScreenOptions } from "./stackOptions";

const Stack = createNativeStackNavigator();

const ReceiptsNavigator = () => {
  const { accent } = useAccent();
  return (
    <View style={styles.root}>
      <Stack.Navigator screenOptions={getStackScreenOptions(accent)}>
        <Stack.Screen
          name="Receipts Index"
          component={ReceiptsIndexScreen}
          options={{ headerTitle: "Paragony" }}
        />
      </Stack.Navigator>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default ReceiptsNavigator;
