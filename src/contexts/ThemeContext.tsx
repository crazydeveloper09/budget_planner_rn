import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PaperProvider } from "react-native-paper";
import { ACCENT_PALETTE, DEFAULT_ACCENT, buildTheme, themeSurfaces } from "../helpers/colors";

const STORAGE_KEY = "accentColor";

type Surfaces = ReturnType<typeof themeSurfaces>;

type ThemeContextValue = {
  accent: string;
  surfaces: Surfaces;
  setAccent: (color: string) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accent, setAccentState] = useState(DEFAULT_ACCENT);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved && ACCENT_PALETTE.some((item) => item.hex === saved)) {
        setAccentState(saved);
      }
    });
  }, []);

  const setAccent = useCallback(async (color: string) => {
    setAccentState(color);
    await AsyncStorage.setItem(STORAGE_KEY, color);
  }, []);

  const theme = useMemo(() => buildTheme(accent), [accent]);
  const surfaces = useMemo(() => themeSurfaces(accent), [accent]);
  const value = useMemo(() => ({ accent, surfaces, setAccent }), [accent, surfaces, setAccent]);

  return (
    <ThemeContext.Provider value={value}>
      <PaperProvider theme={theme}>{children}</PaperProvider>
    </ThemeContext.Provider>
  );
};

export function useAccent() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useAccent must be used within ThemeProvider");
  }
  return context;
}
