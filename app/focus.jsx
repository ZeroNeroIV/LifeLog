import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import PomodoroTimer from '../src/components/PomodoroTimer';
import { useTheme } from '../src/theme';
import ScreenLayout from '../src/components/ScreenLayout';

export default function FocusScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);
  return (
    <ScreenLayout title="FOCUS">
      <View style={s.container}>
        <PomodoroTimer />
      </View>
    </ScreenLayout>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
});
