import React from 'react';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Timer } from 'lucide-react-native';
import PomodoroTimer from '../src/components/PomodoroTimer';
import { useTheme } from '../src/theme';

export default function FocusScreen() {
  const { colors } = useTheme();
  const s = getStyles(colors);
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      
      <View style={s.topBar}>
        <Text style={s.appTitle}>FOCUS</Text>
      </View>
      <View style={s.container}>
        <PomodoroTimer />
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 64, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder, backgroundColor: colors.topBar },
  appTitle: { color: colors.text, fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  scroll: { padding: 24, paddingBottom: 100 },
  header: { marginBottom: 32 },
  greeting: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -1 },
  date: { fontSize: 14, color: colors.textDim, marginTop: 6, fontWeight: '800' },
});
