import React, { useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageSquare, Plus } from 'lucide-react-native';
import { useTheme } from '../src/theme';
import ScreenLayout from '../src/components/ScreenLayout';
import ModelDownloadCard from '../src/components/ModelDownloadCard';
import NutritionChat from '../src/components/NutritionChat';
import MealHistoryCard from '../src/components/MealHistoryCard';
import ManualFoodEntry from '../src/components/ManualFoodEntry';
import QuickFoodButtons from '../src/components/QuickFoodButtons';
import FoodReportModal from '../src/components/FoodReportModal';
import { getTodayNutritionTotals, getAllSettings } from '../src/db';

export default function NutritionScreen() {
  const { colors } = useTheme();
  const s = getStyles(colors);
  const [modelReady, setModelReady] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showFoodReport, setShowFoodReport] = useState(false);
  const [reportFoodName, setReportFoodName] = useState('');
  const [todayTotals, setTodayTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  const [goals, setGoals] = useState({ calories: 2000, protein: 50, carbs: 250, fat: 65, fiber: 30 });
  const [refreshKey, setRefreshKey] = useState(0);

  useFocusEffect(() => {
    loadData();
  });

  const loadData = async () => {
    const [totals, settings] = await Promise.all([getTodayNutritionTotals(), getAllSettings()]);
    setTodayTotals(totals);
    setGoals({
      calories: parseInt(settings.nutrition_calorie_goal) || 2000,
      protein: parseInt(settings.nutrition_protein_goal) || 50,
      carbs: parseInt(settings.nutrition_carbs_goal) || 250,
      fat: parseInt(settings.nutrition_fat_goal) || 65,
      fiber: parseInt(settings.nutrition_fiber_goal) || 30,
    });
    setRefreshKey(prev => prev + 1);
  };

  const MacroBar = ({ label, value, goal, color }) => {
    const pct = Math.min((value / goal) * 100, 100);
    return (
      <View style={s.macroItem}>
        <View style={s.macroHeader}>
          <Text style={s.macroLabel}>{label}</Text>
          <Text style={s.macroValue}>{Math.round(value)}/{goal}</Text>
        </View>
        <View style={s.macroBarBg}>
          <View style={[s.macroBar, { width: `${pct}%`, backgroundColor: color }]} />
        </View>
      </View>
    );
  };

  return (
    <ScreenLayout title="NUTRITION">
      <View style={s.summaryCard}>
        <View style={s.calorieRow}>
          <Text style={s.calorieValue}>{Math.round(todayTotals.calories)}</Text>
          <Text style={s.calorieLabel}>/ {goals.calories} cal</Text>
        </View>
        <View style={s.macrosRow}>
          <MacroBar label="Protein" value={todayTotals.protein} goal={goals.protein} color="#22c55e" />
          <MacroBar label="Carbs" value={todayTotals.carbs} goal={goals.carbs} color="#f59e0b" />
          <MacroBar label="Fat" value={todayTotals.fat} goal={goals.fat} color="#ef4444" />
        </View>
      </View>

      <ScrollView style={s.content}>
        {!modelReady && <View style={s.downloadSection}><ModelDownloadCard onModelReady={setModelReady} /></View>}
        <QuickFoodButtons onFoodAdded={loadData} />
        <MealHistoryCard onUpdate={loadData} refreshKey={refreshKey} />
      </ScrollView>

      <TouchableOpacity style={s.fabChat} onPress={() => setShowChat(true)}>
        <MessageSquare size={24} color={colors.primaryText} />
      </TouchableOpacity>

      <TouchableOpacity style={s.fab} onPress={() => setShowManualEntry(true)}>
        <Plus size={24} color={colors.primaryText} />
      </TouchableOpacity>

      <ManualFoodEntry 
        visible={showManualEntry} 
        onClose={() => setShowManualEntry(false)} 
        onFoodAdded={loadData}
        onReportFood={(name) => { setReportFoodName(name); setShowFoodReport(true); }}
      />

      <FoodReportModal
        visible={showFoodReport}
        onClose={() => { setShowFoodReport(false); setReportFoodName(''); }}
        initialName={reportFoodName}
      />

      {/* Full screen AI Chat Modal */}
      <Modal visible={showChat} animationType="slide" onRequestClose={() => setShowChat(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={s.chatHeader}>
            <TouchableOpacity onPress={() => setShowChat(false)} style={s.chatBackBtn}>
              <Text style={s.chatBackText}>← Back</Text>
            </TouchableOpacity>
            <Text style={s.chatHeaderTitle}>AI Nutrition Chat</Text>
            <View style={{ width: 60 }} />
          </View>
          <NutritionChat modelReady={modelReady} onFoodLogged={loadData} />
        </SafeAreaView>
      </Modal>
    </ScreenLayout>
  );
}

const getStyles = (colors) => StyleSheet.create({
  summaryCard: { backgroundColor: colors.surface, margin: 12, marginBottom: 0, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.surfaceBorder },
  calorieRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  calorieValue: { fontSize: 36, fontWeight: '800', color: colors.primary },
  calorieLabel: { fontSize: 14, color: colors.textMuted, marginLeft: 4 },
  macrosRow: { flexDirection: 'row', gap: 12 },
  macroItem: { flex: 1 },
  macroHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  macroLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  macroValue: { fontSize: 11, color: colors.textDim },
  macroBarBg: { height: 6, backgroundColor: colors.surfaceInput, borderRadius: 3, overflow: 'hidden' },
  macroBar: { height: '100%', borderRadius: 3 },
  content: { flex: 1 },
  downloadSection: { paddingHorizontal: 12, paddingTop: 12 },
  fab: { position: 'absolute', right: 20, bottom: 100, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  fabChat: { position: 'absolute', right: 20, bottom: 170, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent2, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 60, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder, backgroundColor: colors.topBar },
  chatHeaderTitle: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: 1 },
  chatBackBtn: { padding: 8 },
  chatBackText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
});
