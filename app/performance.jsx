import React, { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import MetricsChart from '../src/components/MetricsChart';
import NutritionChart from '../src/components/NutritionChart';
import { useTheme } from '../src/theme';
import ScreenLayout from '../src/components/ScreenLayout';

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
    <ScreenLayout title="PERFORMANCE">
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
    </ScreenLayout>
  );
}

const getStyles = (colors) => StyleSheet.create({
  scroll: { padding: 24 },
  header: { marginBottom: 32, marginTop: 8 },
  greeting: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -1 },
  date: { fontSize: 14, color: colors.primary, marginTop: 6, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
});
