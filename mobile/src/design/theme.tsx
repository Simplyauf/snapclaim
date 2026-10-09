import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, Scheme, space, radius, hairline, minTarget } from './tokens';

type Theme = {
  c: Scheme;
  isDark: boolean;
  space: typeof space;
  radius: typeof radius;
  hairline: number;
  minTarget: number;
};

const ThemeContext = createContext<Theme>({
  c: light,
  isDark: false,
  space,
  radius,
  hairline,
  minTarget,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const isDark = useColorScheme() === 'dark';
  return (
    <ThemeContext.Provider
      value={{ c: isDark ? dark : light, isDark, space, radius, hairline, minTarget }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
