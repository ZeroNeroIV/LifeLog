import React, { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MetricsChart from '../src/components/MetricsChart';
import NutritionChart from '../src/components/NutritionChart';
import { useTheme } from '../src/theme';

export default function PerformanceScreen() {
  const { colors } = useTheme();
  const s = getStyles(colors);
  const [refreshKey, setRefreshKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      // Forcibly refresh chart data queries exactly when the tab is snapped into focus
      setRefreshKey(prev => prev + 1);
    }, [])
  );

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      
      <View style={s.topBar}>
        <Text style={s.appTitle}>PERFORMANCE</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={s.greeting}>Your Performance</Text>
          <Text style={s.date}>Activity Overview</Text>
        </View>

        <NutritionChart refreshKey={refreshKey} />

        <MetricsChart 
          title="Hydration Trends"
          type="water"
          unit="mL"
          color="#7de9ff"
          refreshKey={refreshKey}
        />
        
        <MetricsChart 
          title="Caffeine Intake"
          type="caffeine"
          unit="mg"
          color="#f9bd22"
          refreshKey={refreshKey}
        />

        <MetricsChart 
          title="Vitamin C"
          type="vitamin_c"
          unit="mg"
          color={colors.vitaminC}
          refreshKey={refreshKey}
        />

        <MetricsChart 
          title="Sugar Intake"
          type="sugar"
          unit="g"
          color={colors.sugar}
          refreshKey={refreshKey}
        />

        <MetricsChart 
          title="Emotional State (Average)"
          type="mood"
          unit="/ 5"
          color={colors.accent2}
          refreshKey={refreshKey}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 64, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder, backgroundColor: colors.topBar },
  appTitle: { color: colors.text, fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  scroll: { padding: 24, paddingBottom: 100 },
  header: { marginBottom: 32, marginTop: 8 },
  greeting: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -1 },
  date: { fontSize: 14, color: colors.primary, marginTop: 6, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
});
