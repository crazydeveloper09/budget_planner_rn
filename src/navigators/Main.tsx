import { FontAwesome, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { CommonActions } from "@react-navigation/native";
import { BottomNavigation } from "react-native-paper";
import { StatusBar, StyleSheet, View } from "react-native";
import ExpensesNavigator from "./Expense";
import UserNavigator from "./User";
import SettingsNavigator from "./Settings";

const Tab = createBottomTabNavigator();

StatusBar.setBarStyle("light-content");

const MainNavigator = () => {
  return (
    <View style={styles.root}>
      <Tab.Navigator
        initialRouteName="Expenses"
        sceneContainerStyle={styles.scene}
        screenOptions={{
          headerShown: false,
          sceneStyle: styles.scene,
        }}
        tabBar={({ navigation, state, descriptors, insets }) => (
          <BottomNavigation.Bar
            navigationState={state}
            safeAreaInsets={insets}
            shifting={false}
            onTabPress={({ route, preventDefault }) => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });

              if (event.defaultPrevented) {
                preventDefault();
              } else {
                navigation.dispatch({
                  ...CommonActions.navigate(route.name, route.params),
                  target: state.key,
                });
              }
            }}
            renderIcon={({ route, focused, color }) =>
              descriptors[route.key].options.tabBarIcon?.({
                focused,
                color,
                size: 24,
              }) ?? null
            }
            getLabelText={({ route }) => {
              const { options } = descriptors[route.key];
              const label = options.tabBarLabel ?? options.title ?? route.name;
              return typeof label === "string" ? label : undefined;
            }}
          />
        )}
      >
        <Tab.Screen
          name="Expenses"
          component={ExpensesNavigator}
          options={{
            tabBarLabel: "Podsumowanie",
            tabBarIcon: ({ color, size }) => (
              <FontAwesome5 name="clipboard-list" color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="User"
          component={UserNavigator}
          options={{
            tabBarLabel: "Moje informacje",
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
