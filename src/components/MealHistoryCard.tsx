// src/components/MealHistoryCard.tsx - Today's Meals List
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ChevronDown, ChevronUp, Trash2, Utensils, Cookie } from 'lucide-react-native';
import { useTheme, ThemeColors } from '../theme';
import { getTodayMeals, deleteMeal, deleteFoodFromMeal, Meal } from '../db';
import * as Haptics from 'expo-haptics';

interface MealHistoryCardProps {
  onUpdate?: () => void;
  refreshKey?: number;
}

export default function MealHistoryCard({ onUpdate, refreshKey }: MealHistoryCardProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useFocusEffect(useCallback(() => { loadMeals(); }, []));
  
  useEffect(() => {
    if (refreshKey !== undefined) {
      loadMeals();
    }
  }, [refreshKey]);

  const loadMeals = async () => {
    const data = await getTodayMeals();
    setMeals(data);
  };

  const toggleExpand = (id: number) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const handleDeleteMeal = async (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await deleteMeal(id);
    loadMeals();
    onUpdate?.();
  };

  const handleDeleteFood = async (foodId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await deleteFoodFromMeal(foodId);
    loadMeals();
    onUpdate?.();
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMealCalories = (foods: Meal['foods']) => foods.reduce((sum, f) => sum + (f.calories || 0), 0);

  if (meals.length === 0) {
    return (
      <View style={s.emptyContainer}>
        <Text style={s.emptyText}>No meals logged today</Text>
        <Text style={s.emptyHint}>Use the chat to log what you ate</Text>
      </View>
    );
  }

  const renderMeal = ({ item: meal }: { item: Meal }) => {
    const isExpanded = expanded[meal.id];
    const Icon = meal.type === 'snack' ? Cookie : Utensils;
    const calories = getMealCalories(meal.foods || []);

    return (
      <View style={s.mealCard}>
        <TouchableOpacity style={s.mealHeader} onPress={() => toggleExpand(meal.id)}>
          <View style={s.mealInfo}>
            <Icon size={16} color={colors.textMuted} />
            <Text style={s.mealType}>{meal.type === 'snack' ? 'Snack' : 'Meal'}</Text>
            <Text style={s.mealTime}>{formatTime(meal.timestamp)}</Text>
          </View>
          <View style={s.mealRight}>
            <Text style={s.mealCal}>{Math.round(calories)} cal</Text>
            {isExpanded ? <ChevronUp size={18} color={colors.textDim} /> : <ChevronDown size={18} color={colors.textDim} />}
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={s.foodsList}>
            {(meal.foods || []).map((food) => (
              <View key={food.id} style={s.foodItem}>
                <View style={s.foodInfo}>
                  <Text style={s.foodName}>{food.name}</Text>
                  <Text style={s.foodMacros}>
                    {Math.round(food.calories)}cal · {Math.round(food.protein_g)}p · {Math.round(food.carbs_g)}c · {Math.round(food.fat_g)}f
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteFood(food.id!)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Trash2 size={14} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={s.deleteMealBtn} onPress={() => handleDeleteMeal(meal.id)}>
              <Trash2 size={14} color={colors.danger} />
              <Text style={s.deleteMealText}>Delete Meal</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>TODAY'S MEALS</Text>
      <FlatList
        data={meals}
        renderItem={renderMeal}
        keyExtractor={(item) => item.id.toString()}
        scrollEnabled={false}
      />
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { marginTop: 8 },
  title: { fontSize: 11, fontWeight: '700', color: colors.textDim, letterSpacing: 1, marginBottom: 8, paddingHorizontal: 12 },
  emptyContainer: { alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  emptyHint: { fontSize: 12, color: colors.textDim, marginTop: 4 },
  mealCard: { backgroundColor: colors.surface, marginHorizontal: 12, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.surfaceBorder, overflow: 'hidden' },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  mealInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mealType: { fontSize: 14, fontWeight: '600', color: colors.text, textTransform: 'capitalize' as const },
  mealTime: { fontSize: 12, color: colors.textDim },
  mealRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mealCal: { fontSize: 13, fontWeight: '600', color: colors.primary },
  foodsList: { borderTopWidth: 1, borderTopColor: colors.surfaceBorder, paddingTop: 8, paddingHorizontal: 12, paddingBottom: 12 },
  foodItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  foodInfo: { flex: 1 },
  foodName: { fontSize: 13, fontWeight: '500', color: colors.text },
  foodMacros: { fontSize: 11, color: colors.textDim, marginTop: 2 },
  deleteMealBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, paddingVertical: 8 },
  deleteMealText: { fontSize: 12, color: colors.danger },
});
