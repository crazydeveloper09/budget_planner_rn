import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, StyleSheet } from "react-native";
import { useAccent } from "../contexts/ThemeContext";
import TopicsScreen from "../screens/Chat/Topics";
import ThreadScreen from "../screens/Chat/Thread";
import { getStackScreenOptions } from "./stackOptions";

const Stack = createNativeStackNavigator();

const ChatNavigator = () => {
  const { accent } = useAccent();
  return (
    <View style={styles.root}>
      <Stack.Navigator screenOptions={getStackScreenOptions(accent)}>
        <Stack.Screen
          name="ChatTopics"
          component={TopicsScreen}
          options={{ headerTitle: "Czat" }}
        />
        <Stack.Screen
          name="ChatThread"
          component={ThreadScreen}
          options={{ headerTitle: "Temat" }}
        />
      </Stack.Navigator>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default ChatNavigator;
