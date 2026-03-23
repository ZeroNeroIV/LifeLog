import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { getWeeklyData, LogType } from '../db';
import { useTheme, ThemeColors } from '../theme';

interface ChartDataPoint {
  value: number;
  label: string;
}

interface MetricsChartProps {
  title: string;
  type: LogType;
  color: string;
  unit: string;
  refreshKey?: number;
}

export default function MetricsChart({ title, type, color, unit, refreshKey }: MetricsChartProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);
  
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [type, refreshKey]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const records = await getWeeklyData(type);
      
      const chartData: ChartDataPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        const existing = records.find(r => r.date === dateStr);
        chartData.push({
          value: existing ? existing.total : 0,
          label: d.toLocaleDateString('en-US', { weekday: 'narrow' })
        });
      }
      
      setData(chartData);
    } catch (e) {
      console.error('Chart load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const calculateMax = () => {
     if (type === 'mood') return 5.5;
     const genericMax = Math.max(...data.map(d => d.value), 10);
     return genericMax * 1.2;
  };
  const maxValue = calculateMax();

  const parseVal = (v: number) => type === 'mood' ? parseFloat(String(v)).toFixed(1) : v;

  return (
    <View style={s.card}>
      <Text style={s.title}>{title}</Text>
      
      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator color={color} size="small" />
        </View>
      ) : (
        <View style={s.chartWrapper}>
          <LineChart
            data={data}
            width={240}
            height={130}
            hideRules
            yAxisThickness={1}
            yAxisColor={colors.surfaceBorder}
            yAxisTextStyle={s.yLabel}
            yAxisLabelWidth={28}
            noOfSections={4}
            xAxisThickness={1}
            xAxisColor={colors.surfaceBorder}
            color={color}
            thickness={3}
            dataPointsColor={color}
            dataPointsRadius={4}
            dataPointsColor2={color}
            curved
            initialSpacing={15}
            spacing={38}
            endSpacing={0}
            maxValue={maxValue}
            xAxisLabelsHeight={24}
            xAxisLabelTextStyle={s.xLabel}
            pointerConfig={{
              pointerStripHeight: 130,
              pointerStripColor: color,
              pointerStripWidth: 2,
              pointerColor: color,
              radius: 6,
              pointerLabelWidth: 80,
              pointerLabelHeight: 30,
              activatePointersOnLongPress: false,
              activatePointersDelay: 0,
              autoAdjustPointerLabelPosition: true,
              pointerLabelComponent: (items: Array<{ value: number }>) => {
                return (
                  <View style={[s.tooltip, { backgroundColor: colors.surface, borderColor: color }]}>
                    <Text style={[s.tooltipText, { color: colors.text }]}>{parseVal(items[0].value)} {unit}</Text>
                  </View>
                );
              },
            }}
          />
        </View>
      )}
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceInput,
    borderRadius: 24,
    padding: 24,
    paddingBottom: 24, 
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
  },
  title: {
    alignSelf: 'flex-start',
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  loader: {
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartWrapper: {
    paddingRight: 10,
    marginLeft: -20, 
  },
  xLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    includeFontPadding: false,
    paddingTop: 4,
  },
  yLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
  },
  tooltip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  tooltipText: {
    fontSize: 12,
    fontWeight: '800',
  }
});
