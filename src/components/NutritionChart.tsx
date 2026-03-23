// src/components/NutritionChart.tsx - Weekly Calorie Chart
import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { getWeeklyNutritionData, getAllSettings } from '../db';
import { useTheme, ThemeColors } from '../theme';

interface ChartDataPoint {
  value: number;
  label: string;
  frontColor: string;
}

interface NutritionChartProps {
  refreshKey?: number;
}

export default function NutritionChart({ refreshKey }: NutritionChartProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);
  
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState(2000);

  useEffect(() => { fetchData(); }, [refreshKey]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [records, settings] = await Promise.all([getWeeklyNutritionData(), getAllSettings()]);
      setGoal(parseInt(settings.nutrition_calorie_goal) || 2000);
      
      const chartData: ChartDataPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        const existing = records.find(r => r.date === dateStr);
        const calories = existing ? existing.calories : 0;
        const goalVal = parseInt(settings.nutrition_calorie_goal) || 2000;
        
        chartData.push({
          value: calories,
          label: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
          frontColor: calories >= goalVal ? '#22c55e' : colors.primary,
        });
      }
      
      setData(chartData);
    } catch (e) {
      console.error('Nutrition chart error:', e);
    }
    setLoading(false);
  };

  const maxValue = Math.max(...data.map(d => d.value), goal) * 1.2;
  const avgCalories = data.length ? Math.round(data.reduce((sum, d) => sum + d.value, 0) / data.length) : 0;

  return (
    <View style={s.card}>
      <Text style={s.title}>Calories This Week</Text>
      
      {loading ? (
        <View style={s.loader}><ActivityIndicator color={colors.primary} size="small" /></View>
      ) : (
        <>
          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statValue}>{avgCalories}</Text>
              <Text style={s.statLabel}>avg/day</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statValue}>{goal}</Text>
              <Text style={s.statLabel}>goal</Text>
            </View>
          </View>

          <View style={s.chartWrapper}>
            <BarChart
              data={data}
              width={240}
              height={120}
              barWidth={24}
              spacing={14}
              initialSpacing={10}
              noOfSections={4}
              maxValue={maxValue}
              hideRules
              yAxisThickness={0}
              xAxisThickness={1}
              xAxisColor={colors.surfaceBorder}
              xAxisLabelTextStyle={s.xLabel}
              hideYAxisText
              barBorderRadius={6}
              isAnimated
              animationDuration={300}
            />
          </View>

          <View style={s.legend}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={s.legendText}>Under goal</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: '#22c55e' }]} />
              <Text style={s.legendText}>Goal met</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  card: { backgroundColor: colors.surfaceInput, borderRadius: 24, padding: 24, marginBottom: 16, borderWidth: 1, borderColor: colors.surfaceBorder, alignItems: 'center' },
  title: { alignSelf: 'flex-start', fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 16 },
  loader: { height: 140, justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', gap: 32, marginBottom: 16 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.primary },
  statLabel: { fontSize: 11, fontWeight: '600', color: colors.textDim, textTransform: 'uppercase' as const, letterSpacing: 1 },
  chartWrapper: { marginLeft: -10 },
  xLabel: { color: colors.textDim, fontSize: 11, fontWeight: '800' },
  legend: { flexDirection: 'row', gap: 20, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: colors.textMuted },
});
