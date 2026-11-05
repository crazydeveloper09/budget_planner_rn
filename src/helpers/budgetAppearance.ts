import tinycolor from "tinycolor2";

// The same plum-tinted neutral used by the app's navigation, with one strong summary surface.
export function budgetAppearance(accent: string) {
  return {
    background: "#f5f2f5",
    divider: "#ded5de",
    hero: tinycolor.mix(accent, "#241d28", 70).toHexString(),
    heroMuted: "#d8cfdc",
    heroTrack: "rgba(255,255,255,0.16)",
    heroFill: tinycolor.mix(accent, "#ffffff", 65).toHexString(),
  };
}
