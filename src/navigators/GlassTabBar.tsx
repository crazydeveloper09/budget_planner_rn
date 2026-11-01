import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { CommonActions } from "@react-navigation/native";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAccent } from "../contexts/ThemeContext";
import { hexToRGB } from "../helpers/colors";

function useLiquidGlass() {
  if (Platform.OS !== "ios") return false;
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
}

export default function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { accent } = useAccent();
  const liquid = useLiquidGlass();
  const bottomPad = Math.max(insets.bottom, 8);

  const items = (
    <View style={styles.row}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const raw = options.tabBarLabel ?? options.title ?? route.name;
        const label = typeof raw === "string" ? raw : route.name;
        const color = focused ? accent : "#6b5f6a";
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (event.defaultPrevented) return;
              navigation.dispatch({
                ...CommonActions.navigate(route.name, route.params),
                target: state.key,
              });
            }}
            style={styles.item}
          >
            {options.tabBarIcon?.({ focused, color, size: 22 }) ?? null}
            <Text numberOfLines={1} style={[styles.label, { color }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPad }]}>
      <View style={styles.pill}>
        {liquid ? (
          <GlassView
            style={StyleSheet.absoluteFill}
            glassEffectStyle="regular"
            tintColor={hexToRGB(accent, 0.18)}
            isInteractive
            pointerEvents="none"
          />
        ) : (
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={64}
            tint="light"
            pointerEvents="none"
          />
        )}
        {items}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingTop: 6,
    backgroundColor: "transparent",
  },
  pill: {
    overflow: "hidden",
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  row: {
    flexDirection: "row",
    minHeight: 58,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  label: {
    fontFamily: "MontserratSemiBold",
    fontSize: 10,
    letterSpacing: 0.1,
  },
});
