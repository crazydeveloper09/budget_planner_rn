import { FontAwesome, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StyleSheet, View } from "react-native";
import { useProfile } from "../contexts/ProfileContext";
import ChatNavigator from "./Chat";
import ExpensesNavigator from "./Expense";
import GlassTabBar from "./GlassTabBar";
import ReceiptsNavigator from "./Receipts";
import UserNavigator from "./User";
import SettingsNavigator from "./Settings";

const Tab = createBottomTabNavigator();

const MainNavigator = () => {
  const { profile } = useProfile();
  const showChat = profile?.accountType === "family" || profile?.accountType === "business";
  return (
    <View style={styles.root}>
      <Tab.Navigator
        initialRouteName="Expenses"
        sceneContainerStyle={styles.scene}
        screenOptions={{
          headerShown: false,
          sceneStyle: styles.scene,
        }}
        tabBar={(props) => <GlassTabBar {...props} />}
      >
        <Tab.Screen
          name="Expenses"
          component={ExpensesNavigator}
          options={{
            tabBarLabel: "Historia",
            tabBarIcon: ({ color, size }) => (
              <FontAwesome5 name="clipboard-list" color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Receipts"
          component={ReceiptsNavigator}
          options={{
            tabBarLabel: "Paragony",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="file-image-outline" color={color} size={size} />
            ),
          }}
        />
        {showChat ? (
          <Tab.Screen
            name="Chat"
            component={ChatNavigator}
            options={{
              tabBarLabel: "Czat",
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="chat-outline" color={color} size={size} />
              ),
            }}
          />
        ) : null}
        <Tab.Screen
          name="User"
          component={UserNavigator}
          options={{
            tabBarLabel: "Profil",
            tabBarIcon: ({ color, size }) => (
              <FontAwesome name="user-circle" color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Settings Navigator"
          component={SettingsNavigator}
          options={{
            tabBarLabel: "Ustawienia",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="cog" color={color} size={size} />
            ),
          }}
        />
      </Tab.Navigator>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scene: {
    flex: 1,
    backgroundColor: "#fff",
  },
});

export default MainNavigator;
