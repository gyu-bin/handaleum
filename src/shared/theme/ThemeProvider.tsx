import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';

import { getDarkModeEnabled, setDarkModeEnabled } from '@/lib/storage';
import { theme as lightTheme, type Theme } from '@/shared/constants/theme';

/** Shell-only dark tokens — map + paper surfaces stay on the light palette. */
const DARK_SHELL_COLORS: Partial<Theme['colors']> = {
  background: '#1C1F24',
  canvas: '#16191D',
  hairline: '#2A3038',
  border: '#343A42',
  line: '#2A3038',
  overlay: 'rgba(22,25,29,0.88)',
  overlayDark: 'rgba(0,0,0,0.55)',
  shellInk: '#E8EAED',
  shellInkSoft: '#A8B0BA',
  shellSubtle: '#727A86',
  splashMark: '#D0D6DC',
  shellChip: '#2A3038',
};

export function resolveTheme(scheme: ColorSchemeName | null | undefined): Theme {
  if (scheme !== 'dark') {
    return lightTheme as Theme;
  }
  return {
    ...lightTheme,
    colors: {
      ...lightTheme.colors,
      ...DARK_SHELL_COLORS,
    },
  } as Theme;
}

let darkCache: boolean | undefined;
const darkListeners = new Set<() => void>();

function getDarkSnapshot(): boolean {
  if (darkCache === undefined) {
    darkCache = getDarkModeEnabled();
  }
  return darkCache;
}

function subscribeDark(listener: () => void): () => void {
  darkListeners.add(listener);
  return () => {
    darkListeners.delete(listener);
  };
}

function emitDark(next: boolean) {
  darkCache = next;
  Appearance.setColorScheme(next ? 'dark' : 'light');
  darkListeners.forEach((listener) => listener());
}

Appearance.setColorScheme(getDarkModeEnabled() ? 'dark' : 'light');

const ThemeContext = createContext<Theme>(lightTheme as Theme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const dark = useSyncExternalStore(subscribeDark, getDarkSnapshot, getDarkSnapshot);
  const value = useMemo(
    () => resolveTheme(dark ? 'dark' : 'light'),
    [dark],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** App-controlled dark mode (settings), not the system appearance. */
export function useDarkMode(): {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
} {
  const enabled = useSyncExternalStore(
    subscribeDark,
    getDarkSnapshot,
    getDarkSnapshot,
  );
  const setEnabled = useCallback((next: boolean) => {
    setDarkModeEnabled(next);
    emitDark(next);
  }, []);
  return { enabled, setEnabled };
}
