import React, { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassWater, Coffee, Smile } from 'lucide-react-native';
import MetricBentoCard from '../src/components/MetricBentoCard';
import BentoCard from '../src/components/BentoCard';
import DrinksBentoCard from '../src/components/DrinksBentoCard';
import MoodBentoCard from '../src/components/MoodBentoCard';
import { getAllSettings } from '../src/db';
import { useTheme } from '../src/theme';

export default function LogScreen() {
  const { colors } = useTheme();
  const s = getStyles(colors);
  const [settings, setSettings] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  const loadSettings = async () => {
    const s = await getAllSettings();
    setSettings(s);
  };

  if (!settings) return null;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      
      <View style={s.topBar}>
        <Text style={s.appTitle}>QUICK LOG</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        
        <View style={s.header}>
          <Text style={s.greeting}>What's the vibe?</Text>
          <Text style={s.date}>Select a category to log</Text>
        </View>

        <MetricBentoCard
          title="Hydration"
          type="water"
          unit="ml"
          icon={GlassWater}
          color="#7de9ff"
          fav1={settings.water_fav1_ml || '250'}
          fav2={settings.water_fav2_ml || '500'}
        />

        <DrinksBentoCard />

        <MoodBentoCard />

      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 64, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder, backgroundColor: colors.topBar },
  appTitle: { color: colors.text, fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  scroll: { padding: 24, paddingBottom: 100 },
  header: { marginBottom: 32 },
  greeting: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -1 },
  date: { fontSize: 14, color: colors.textDim, marginTop: 6, fontWeight: '800' },
  placeholderBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24, backgroundColor: colors.surfaceInput, borderRadius: 16, marginTop: 8 },
  placeholderText: { fontSize: 12, fontWeight: '800', letterSpacing: 2 }
});
