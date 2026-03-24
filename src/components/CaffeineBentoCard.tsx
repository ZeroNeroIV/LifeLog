// src/components/CaffeineBentoCard.tsx - Caffeine Intake Tracker with Graph
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Pressable, Dimensions } from 'react-native';
import { Coffee, Plus, X, AlertTriangle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { BarChart } from 'react-native-gifted-charts';
import { getTodayTotal, getWeeklyData, addLog, getAllSettings } from '../db';
import BentoCard from './BentoCard';
import { useTheme, ThemeColors } from '../theme';

const CAFFEINE_LIMIT = 400; // FDA recommended max

export default function CaffeineBentoCard() {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);
  
  const [total, setTotal] = useState(0);
  const [weeklyData, setWeeklyData] = useState<{ value: number; label: string }[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [fav1, setFav1] = useState(80);
  const [fav2, setFav2] = useState(160);
  const [limit, setLimit] = useState(CAFFEINE_LIMIT);

  const fetchData = useCallback(async () => {
    try {
      const [todayTotal, weekData, settings] = await Promise.all([
        getTodayTotal('caffeine'),
        getWeeklyData('caffeine'),
        getAllSettings(),
      ]);
      
      setTotal(todayTotal);
      setFav1(parseInt(settings.caffeine_fav1_mg) || 80);
      setFav2(parseInt(settings.caffeine_fav2_mg) || 160);
      
      // Build weekly chart data
      const chartData = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayData = weekData.find(r => r.date === dateStr);
        
        chartData.push({
          value: dayData?.total || 0,
          label: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
          frontColor: (dayData?.total || 0) > limit ? '#ef4444' : colors.accent1,
        });
      }
      setWeeklyData(chartData);
    } catch (e) {
      console.error('Caffeine data fetch error:', e);
    }
  }, [limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = async (value: number | string) => {
    try {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (!numValue || isNaN(numValue)) return;
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await addLog('caffeine', numValue);
      await fetchData();
      setModalVisible(false);
      setCustomValue('');
    } catch (e) {
      console.error('Failed to log caffeine:', e);
    }
  };

  const percentage = Math.min((total / limit) * 100, 100);
  const isOverLimit = total > limit;
  const cupsRemaining = Math.max(0, Math.ceil((limit - total) / 80)); // ~80mg per cup of coffee

  const meterColor = isOverLimit ? '#ef4444' : percentage > 75 ? '#f59e0b' : colors.accent1;

  return (
    <>
      <BentoCard 
        title="Caffeine" 
        subtitle={`${Math.round(total)} / ${limit}mg`}
        icon={Coffee}
        color={colors.accent1}
      >
        <View style={s.container}>
          {/* Progress Meter */}
          <View style={s.meterContainer}>
            <View style={s.meterBackground}>
              <View style={[s.meterFill, { width: `${percentage}%`, backgroundColor: meterColor }]} />
            </View>
            <View style={s.meterLabels}>
              <Text style={s.meterText}>{Math.round(total)}mg</Text>
              <Text style={s.meterLimit}>{limit}mg limit</Text>
            </View>
          </View>

          {/* Warning or Status */}
          {isOverLimit ? (
            <View style={s.warningBox}>
              <AlertTriangle size={16} color="#ef4444" />
              <Text style={s.warningText}>Over daily limit by {Math.round(total - limit)}mg</Text>
            </View>
          ) : (
            <Text style={s.statusText}>
              {cupsRemaining} cup{cupsRemaining !== 1 ? 's' : ''} of coffee remaining
            </Text>
          )}

          {/* Weekly Graph */}
          {weeklyData.some(d => d.value > 0) && (
            <View style={s.chartContainer}>
              <BarChart
                data={weeklyData}
                width={Dimensions.get('window').width - 120}
                height={80}
                barWidth={20}
                spacing={12}
                initialSpacing={8}
                noOfSections={2}
                maxValue={Math.max(...weeklyData.map(d => d.value), limit) * 1.1}
                hideRules
                yAxisThickness={0}
                xAxisThickness={1}
                xAxisColor={colors.surfaceBorder}
                xAxisLabelTextStyle={{ color: colors.textDim, fontSize: 10, fontWeight: '600' }}
                hideYAxisText
                barBorderRadius={4}
                isAnimated
                animationDuration={300}
              />
            </View>
          )}

          {/* Quick Add Buttons */}
          <View style={s.btnRow}>
            <TouchableOpacity
              style={[s.addBtn, { backgroundColor: colors.accent1 + '15', borderColor: colors.accent1 + '30' }]}
              onPress={() => handleAdd(fav1)}
              activeOpacity={0.7}
            >
              <Text style={[s.btnText, { color: colors.accent1 }]}>+{fav1}mg</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[s.addBtn, { backgroundColor: colors.accent1 + '15', borderColor: colors.accent1 + '30' }]}
              onPress={() => handleAdd(fav2)}
              activeOpacity={0.7}
            >
              <Text style={[s.btnText, { color: colors.accent1 }]}>+{fav2}mg</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.addBtn, s.customBtn, { backgroundColor: colors.accent1 + '15', borderColor: colors.accent1 + '30' }]}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.7}
            >
              <Plus size={20} color={colors.accent1} />
            </TouchableOpacity>
          </View>
        </View>
      </BentoCard>

      {/* Custom Input Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Custom Caffeine</Text>
              <Pressable onPress={() => setModalVisible(false)} style={s.closeBtn}>
                <X size={20} color={colors.text} />
              </Pressable>
            </View>
            
            <TextInput
              style={s.input}
              placeholder="Amount in mg"
              placeholderTextColor={colors.textDim}
              keyboardType="numeric"
              value={customValue}
              onChangeText={setCustomValue}
              autoFocus
            />

            <View style={s.commonAmounts}>
              <Text style={s.commonLabel}>Common drinks:</Text>
              <View style={s.commonRow}>
                <TouchableOpacity style={s.commonBtn} onPress={() => setCustomValue('80')}>
                  <Text style={s.commonText}>Espresso (80)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.commonBtn} onPress={() => setCustomValue('95')}>
                  <Text style={s.commonText}>Coffee (95)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.commonBtn} onPress={() => setCustomValue('47')}>
                  <Text style={s.commonText}>Green Tea (47)</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
              style={[s.submitBtn, { backgroundColor: colors.accent1 }]} 
              onPress={() => handleAdd(customValue)}
              activeOpacity={0.8}
            >
              <Text style={s.submitText}>Add Caffeine</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { marginTop: 12 },
  meterContainer: { marginBottom: 12 },
  meterBackground: { 
    height: 12, 
    backgroundColor: colors.surfaceInput, 
    borderRadius: 6, 
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  meterFill: { 
    height: '100%', 
    borderRadius: 5,
  },
  meterLabels: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 6,
  },
  meterText: { fontSize: 13, fontWeight: '700', color: colors.text },
  meterLimit: { fontSize: 11, color: colors.textDim },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ef444420',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  warningText: { fontSize: 12, color: '#ef4444', fontWeight: '600' },
  statusText: { fontSize: 12, color: colors.textMuted, marginBottom: 12, fontWeight: '500' },
  chartContainer: { marginBottom: 16, marginLeft: -8 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addBtn: { 
    flex: 1, 
    height: 48, 
    borderRadius: 14, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1,
  },
  customBtn: { flex: 0.5 },
  btnText: { fontSize: 14, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', backgroundColor: colors.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: colors.surfaceBorder },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  closeBtn: { padding: 8, backgroundColor: colors.surfaceInput, borderRadius: 12 },
  input: { 
    backgroundColor: colors.surfaceInput, 
    borderRadius: 16, 
    padding: 16, 
    fontSize: 24, 
    fontWeight: '700', 
    color: colors.text, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: colors.surfaceBorder, 
    textAlign: 'center' 
  },
  commonAmounts: { marginBottom: 20 },
  commonLabel: { fontSize: 12, color: colors.textDim, marginBottom: 8, fontWeight: '600' },
  commonRow: { flexDirection: 'row', gap: 8 },
  commonBtn: { 
    flex: 1, 
    backgroundColor: colors.surfaceInput, 
    paddingVertical: 10, 
    borderRadius: 10, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  commonText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  submitBtn: { paddingVertical: 16, borderRadius: 100, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
});
