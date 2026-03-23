import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Coffee, Egg, Apple, Sandwich, Cookie, Salad, LucideIcon } from 'lucide-react-native';
import { useTheme, ThemeColors } from '../theme';
import { createMeal, addFoodToMeal } from '../db';
import * as Haptics from 'expo-haptics';

interface QuickFood {
  id: string;
  name: string;
  icon: LucideIcon;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  color: string;
}

const QUICK_FOODS: QuickFood[] = [
  { id: 'coffee', name: 'Coffee', icon: Coffee, calories: 5, protein: 0, carbs: 0, fat: 0, color: '#8B4513' },
  { id: 'egg', name: 'Egg', icon: Egg, calories: 70, protein: 6, carbs: 0.5, fat: 5, color: '#F5DEB3' },
  { id: 'apple', name: 'Apple', icon: Apple, calories: 95, protein: 0.5, carbs: 25, fat: 0.3, color: '#DC143C' },
  { id: 'sandwich', name: 'Sandwich', icon: Sandwich, calories: 350, protein: 15, carbs: 40, fat: 12, color: '#DEB887' },
  { id: 'cookie', name: 'Cookie', icon: Cookie, calories: 150, protein: 2, carbs: 20, fat: 7, color: '#D2691E' },
  { id: 'salad', name: 'Salad', icon: Salad, calories: 120, protein: 3, carbs: 10, fat: 7, color: '#228B22' },
];

interface QuickFoodButtonsProps {
  onFoodAdded?: () => void;
}

export default function QuickFoodButtons({ onFoodAdded }: QuickFoodButtonsProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);

  const handleQuickAdd = async (food: QuickFood) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const mealType = ['cookie', 'apple'].includes(food.id) ? 'snack' : 'meal';
    const mealId = await createMeal(mealType as 'meal' | 'snack');
    
    await addFoodToMeal(mealId, {
      name: food.name,
      calories: food.calories,
      proteinG: food.protein,
      carbsG: food.carbs,
      fatG: food.fat,
      fiberG: 0,
      quantityG: 100,
      source: 'custom',
    });
    
    onFoodAdded?.();
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>QUICK ADD</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {QUICK_FOODS.map((food) => {
          const Icon = food.icon;
          return (
            <TouchableOpacity key={food.id} style={s.btn} onPress={() => handleQuickAdd(food)}>
              <View style={[s.iconBg, { backgroundColor: food.color + '20' }]}>
                <Icon size={20} color={food.color} />
              </View>
              <Text style={s.btnLabel}>{food.name}</Text>
              <Text style={s.btnCal}>{food.calories}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { paddingVertical: 8 },
  title: { fontSize: 11, fontWeight: '700', color: colors.textDim, letterSpacing: 1, marginBottom: 8, paddingHorizontal: 12 },
  scroll: { paddingHorizontal: 8, gap: 8 },
  btn: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 12, minWidth: 70, borderWidth: 1, borderColor: colors.surfaceBorder },
  iconBg: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  btnLabel: { fontSize: 12, fontWeight: '600', color: colors.text },
  btnCal: { fontSize: 10, color: colors.textDim, marginTop: 2 },
});
