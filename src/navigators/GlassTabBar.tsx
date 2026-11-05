import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { CommonActions } from "@react-navigation/native";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAccent } from "../contexts/ThemeContext";
import { hexToRGB } from "../helpers/colors";
import tinycolor from "tinycolor2";
import { useKeyboardVisible } from "../helpers/useKeyboardVisible";

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
  const keyboardVisible = useKeyboardVisible();
  const bottomPad = Math.max(insets.bottom, 8);
  const pillTint = tinycolor.mix(accent, "#ffffff", 94).toHexString();
  if (keyboardVisible) return null;

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
            style={[styles.item, focused && { backgroundColor: hexToRGB(accent, 0.12) }]}
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
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: bottomPad }]}>
      <View style={styles.shadow}>
      <View style={[styles.pill, { backgroundColor: tinycolor(pillTint).setAlpha(0.94).toRgbString(), borderColor: hexToRGB(accent, 0.08) }]}>
        {liquid ? (
          <GlassView
            style={StyleSheet.absoluteFill}
            glassEffectStyle="regular"
            tintColor={hexToRGB(accent, 0.06)}
            isInteractive
            pointerEvents="none"
          />
        ) : Platform.OS === "ios" ? (
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={45}
            tint="light"
            pointerEvents="none"
          />
        ) : null}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tinycolor(pillTint).setAlpha(liquid ? 0.45 : 0.55).toRgbString() }]} />
        {items}
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingTop: 8,
    backgroundColor: "transparent",
  },
  shadow: { borderRadius: 34, shadowColor: "#342330", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 7, backgroundColor: "transparent" },
  pill: {
    overflow: "hidden",
    borderRadius: 34,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  row: {
    flexDirection: "row",
    minHeight: 64,
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  item: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 28,
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
