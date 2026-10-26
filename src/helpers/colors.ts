import { DefaultTheme } from 'react-native-paper';
import tinycolor from 'tinycolor2';

export const DEFAULT_ACCENT = '#702963';

export const ACCENT_PALETTE = [
  { hex: '#702963', label: 'Fiolet' },
  { hex: '#AD1F64', label: 'Malina' },
  { hex: '#C44569', label: 'Róż' },
  { hex: '#E07A5F', label: 'Koral' },
  { hex: '#D4A373', label: 'Karmel' },
  { hex: '#6D4420', label: 'Cynamon' },
  { hex: '#2D6A4F', label: 'Szałwia' },
  { hex: '#225354', label: 'Mięta' },
  { hex: '#1D3557', label: 'Granat' },
  { hex: '#457B9D', label: 'Błękit' },
  { hex: '#8A2177', label: 'Śliwka' },
  { hex: '#B56576', label: 'Pudrowy' },
] as const;

export function hexToRGB(hex: string, alpha: number) {
    var r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);

    if (alpha) {
        return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
    } else {
        return "rgb(" + r + ", " + g + ", " + b + ")";
    }
}

export function themeSurfaces(accent: string) {
  return {
    selectedDay: accent,
    today: tinycolor(accent).setAlpha(0.22).toRgbString(),
    selectedDayText: '#ffffff',
    surface: tinycolor.mix(accent, '#ffffff', 90).toHexString(),
    surfaceStrong: tinycolor.mix(accent, '#ffffff', 78).toHexString(),
    border: tinycolor.mix(accent, '#ffffff', 62).toHexString(),
  };
}

export const buildTheme = (mainColor: string) => {
  const base = tinycolor(mainColor);
  const brightness = base.getBrightness();
  const isDark = brightness < 70;

  const tooLight = ["#702963", "#225354", "#19482A"];
  const tooDark = ["#AD1F64", "#8A2177", "#6D4420"];

  const secondaryContainer = isDark
    ? base.clone().lighten(tooLight.includes(mainColor) ? 40 : 50).toHexString()
    : base.clone().lighten(tooDark.includes(mainColor) ? 35 : 15).toHexString();

  const elevationLevel2 = isDark
    ? base.clone().lighten(tooLight.includes(mainColor) ? 55 : 65).toHexString()
    : base.clone().lighten(tooDark.includes(mainColor) ? 50 : 40).toHexString();
  
  return {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: mainColor,
    secondaryContainer,
    elevation: {
      ...DefaultTheme.colors.elevation,
      level2: elevationLevel2,
    },
  },
}
};
