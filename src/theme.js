import React, { createContext, useContext, useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { getSetting, updateSetting } from './db';

export const THEMES = {
  dark: {
    background: '#0e0e0e',
    surface: '#1f2020',
    surfaceBorder: '#262626',
    surfaceInput: '#131313',
    text: '#e7e5e4',
    textMuted: '#a1a1aa',
    textDim: '#767575',
    tabBar: 'rgba(31, 32, 32, 0.95)',
    topBar: 'rgba(14,14,14,0.8)',
    primary: '#7de9ff',
    primaryBg: '#7de9ff20',
    primaryText: '#00363e',
    accent1: '#f9bd22',
    accent1Bg: '#f9bd2215',
    accent1Border: '#f9bd2240',
    accent2: '#ddb7ff',
    accent2Bg: '#ddb7ff40',
    accent2Text: '#2b0051',
    danger: '#ff716c',
    dangerBg: '#ff716c20',
    dangerText: '#4a0002'
  },
  light: {
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceBorder: '#e2e8f0',
    surfaceInput: '#f1f5f9',
    text: '#0f172a',
    textMuted: '#64748b',
    textDim: '#94a3b8',
    tabBar: 'rgba(255, 255, 255, 0.95)',
    topBar: 'rgba(248, 250, 252, 0.8)',
    primary: '#0284c7',
    primaryBg: '#e0f2fe',
    primaryText: '#082f49',
    accent1: '#d97706',
    accent1Bg: '#fef3c7',
    accent1Border: '#fcd34d',
    accent2: '#7e22ce',
    accent2Bg: '#f3e8ff',
    accent2Text: '#3b0764',
    danger: '#e11d48',
    dangerBg: '#ffe4e6',
    dangerText: '#881337'
  }
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [themeMode, setThemeMode] = useState('dark');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    getSetting('app_theme', 'dark').then(t => {
      setThemeMode(t);
      setIsReady(true);
    });
  }, []);

  const toggleTheme = async () => {
    const newTheme = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(newTheme);
    await updateSetting('app_theme', newTheme);
  };

  const colors = THEMES[themeMode] || THEMES.dark;

  if (!isReady) {
    return (
      <View style={loadingStyles.container}>
        <View style={[loadingStyles.dot, { backgroundColor: '#7de9ff' }]} />
      </View>
    );
  }

  return (
    <ThemeContext.Provider value={{ colors, isDark: themeMode === 'dark', toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e0e0e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export const useTheme = () => useContext(ThemeContext);
