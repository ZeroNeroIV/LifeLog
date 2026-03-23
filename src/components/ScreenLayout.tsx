// ─────────────────────────────────────────────────────────────────────────────
// src/components/ScreenLayout.tsx  –  Global Screen Layout Wrapper
// ─────────────────────────────────────────────────────────────────────────────

import React, { ReactNode, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../theme';

const TAB_BAR_HEIGHT = 60;

interface ScreenLayoutProps {
  title?: string;
  children: ReactNode;
  showTopBar?: boolean;
}

export default function ScreenLayout({ title, children, showTopBar = true }: ScreenLayoutProps) {
  const { colors, isDark } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.statusBar} />
      
      {showTopBar && (
        <View style={s.topBar}>
          <Text style={s.title}>{title}</Text>
        </View>
      )}
      
      <View style={s.content}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  topBar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
    backgroundColor: colors.topBar,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.text,
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
    paddingBottom: TAB_BAR_HEIGHT + 10,
  },
});
