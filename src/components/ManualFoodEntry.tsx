// src/components/ManualFoodEntry.tsx - Manual Food Search & Entry
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Modal, Dimensions } from 'react-native';
import { Search, X, Check, AlertTriangle, Edit3 } from 'lucide-react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { useTheme, ThemeColors } from '../theme';
import { searchDrinks, DrinkResult } from '../services/nutritionApi';
import { createMeal, addFoodToMeal, MealType } from '../db';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_TRANSLATE_Y = -SCREEN_HEIGHT * 0.8;

const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

interface SearchResult {
  id: string;
  name: string;
  brand: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface ManualFoodEntryProps {
  visible: boolean;
  onClose: () => void;
  onFoodAdded?: () => void;
  onReportFood?: (name: string) => void;
}

export default function ManualFoodEntry({ visible, onClose, onFoodAdded, onReportFood }: ManualFoodEntryProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState<SearchResult | null>(null);
  const [quantity, setQuantity] = useState('100');
  const [mealType, setMealType] = useState<MealType>('meal');
  const [customMode, setCustomMode] = useState(false);
  const [customCalories, setCustomCalories] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customCarbs, setCustomCarbs] = useState('');
  const [customFat, setCustomFat] = useState('');

  const translateY = useSharedValue(0);
  const context = useSharedValue({ y: 0 });

  const resetAndClose = () => {
    setQuery('');
    setResults([]);
    setSelectedFood(null);
    setQuantity('100');
    setCustomMode(false);
    setCustomCalories('');
    setCustomProtein('');
    setCustomCarbs('');
    setCustomFat('');
    onClose();
  };

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      translateY.value = Math.max(context.value.y + event.translationY, MAX_TRANSLATE_Y);
    })
    .onEnd((event) => {
      if (event.translationY > 150 || event.velocityY > 500) {
        runOnJS(resetAndClose)();
      } else {
        translateY.value = withSpring(0);
      }
    });

  const rBottomSheetStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0);
    }
  }, [visible]);

  const debouncedQuery = useDebounce(query, 400);

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      searchFoods(debouncedQuery);
    } else {
      setResults([]);
    }
  }, [debouncedQuery]);

  const searchFoods = async (q: string) => {
    setLoading(true);
    try {
      const data = await searchDrinks(q);
      setResults(data.slice(0, 15).map((item: DrinkResult) => ({
        id: item.id,
        name: item.name,
        brand: item.brand,
        calories: estimateCalories(item),
        protein: 0,
        carbs: item.sugar?.value || 0,
        fat: 0,
      })));
    } catch (e) {
      console.warn('Search failed:', e);
      setResults([]);
    }
    setLoading(false);
  };

  const estimateCalories = (item: DrinkResult) => {
    if (item.sugar?.value) return Math.round(item.sugar.value * 4);
    return 50;
  };

  const handleSelectFood = (food: SearchResult) => {
    setSelectedFood(food);
    setQuantity('100');
  };

  const handleAddFood = async () => {
    if (!selectedFood && !customMode) return;
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const qty = parseInt(quantity) || 100;
    const multiplier = qty / 100;
    
    const mealId = await createMeal(mealType);
    
    if (customMode) {
      await addFoodToMeal(mealId, {
        name: query.trim() || 'Custom Food',
        calories: parseInt(customCalories) || 0,
        proteinG: parseInt(customProtein) || 0,
        carbsG: parseInt(customCarbs) || 0,
        fatG: parseInt(customFat) || 0,
        fiberG: 0,
        quantityG: qty,
        source: 'custom',
      });
    } else if (selectedFood) {
      await addFoodToMeal(mealId, {
        name: selectedFood.name,
        fdcId: selectedFood.id,
        calories: Math.round(selectedFood.calories * multiplier),
        proteinG: Math.round(selectedFood.protein * multiplier),
        carbsG: Math.round(selectedFood.carbs * multiplier),
        fatG: Math.round(selectedFood.fat * multiplier),
        fiberG: 0,
        quantityG: qty,
        source: 'usda',
      });
    }
    
    onFoodAdded?.();
    resetAndClose();
  };

  const handleCustomEntry = () => {
    setCustomMode(true);
    setSelectedFood(null);
  };

  const handleReportFood = () => {
    onReportFood?.(query);
    resetAndClose();
  };

  const renderFoodItem = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity 
      style={[s.foodItem, selectedFood?.id === item.id && s.foodItemSelected]} 
      onPress={() => handleSelectFood(item)}
    >
      <View style={s.foodInfo}>
        <Text style={s.foodName} numberOfLines={1}>{item.name}</Text>
        {item.brand ? <Text style={s.foodBrand}>{item.brand}</Text> : null}
      </View>
      <Text style={s.foodCal}>{item.calories} cal</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={s.overlay}>
        <GestureDetector gesture={gesture}>
          <Animated.View style={[s.modal, rBottomSheetStyle]}>
            <View style={s.dragHandle}>
              <View style={s.dragIndicator} />
            </View>
            
            <View style={s.header}>
              <Text style={s.title}>Add Food</Text>
              <TouchableOpacity onPress={resetAndClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

          {!selectedFood && !customMode ? (
            <>
              <View style={s.searchBar}>
                <Search size={18} color={colors.textDim} />
                <TextInput
                  style={s.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search foods..."
                  placeholderTextColor={colors.textDim}
                  autoFocus
                />
                {loading && <ActivityIndicator size="small" color={colors.primary} />}
              </View>

              <FlatList
                data={results}
                renderItem={renderFoodItem}
                keyExtractor={(item) => item.id}
                style={s.resultsList}
                ListEmptyComponent={
                  query.length >= 2 && !loading ? (
                    <View style={s.emptyContainer}>
                      <Text style={s.emptyText}>No results found</Text>
                      <View style={s.emptyActions}>
                        <TouchableOpacity style={s.customBtn} onPress={handleCustomEntry}>
                          <Edit3 size={16} color={colors.primary} />
                          <Text style={s.customBtnText}>Add Custom</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.reportBtn} onPress={handleReportFood}>
                          <AlertTriangle size={16} color={colors.accent1} />
                          <Text style={s.reportBtnText}>Report</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null
                }
              />
            </>
          ) : customMode ? (
            <View style={s.detailView}>
              <Text style={s.selectedName}>{query.trim() || 'Custom Food'}</Text>
              
              <View style={s.macroInputs}>
                <View style={s.macroInput}>
                  <Text style={s.inputLabel}>Calories</Text>
                  <TextInput style={s.smallInput} value={customCalories} onChangeText={setCustomCalories} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textDim} />
                </View>
                <View style={s.macroInput}>
                  <Text style={s.inputLabel}>Protein (g)</Text>
                  <TextInput style={s.smallInput} value={customProtein} onChangeText={setCustomProtein} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textDim} />
                </View>
                <View style={s.macroInput}>
                  <Text style={s.inputLabel}>Carbs (g)</Text>
                  <TextInput style={s.smallInput} value={customCarbs} onChangeText={setCustomCarbs} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textDim} />
                </View>
                <View style={s.macroInput}>
                  <Text style={s.inputLabel}>Fat (g)</Text>
                  <TextInput style={s.smallInput} value={customFat} onChangeText={setCustomFat} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textDim} />
                </View>
              </View>

              <View style={s.typeRow}>
                <TouchableOpacity style={[s.typeBtn, mealType === 'meal' && s.typeBtnActive]} onPress={() => setMealType('meal')}>
                  <Text style={[s.typeBtnText, mealType === 'meal' && s.typeBtnTextActive]}>Meal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.typeBtn, mealType === 'snack' && s.typeBtnActive]} onPress={() => setMealType('snack')}>
                  <Text style={[s.typeBtnText, mealType === 'snack' && s.typeBtnTextActive]}>Snack</Text>
                </TouchableOpacity>
              </View>

              <View style={s.actions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setCustomMode(false)}>
                  <Text style={s.cancelBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.addBtn} onPress={handleAddFood}>
                  <Check size={18} color={colors.primaryText} />
                  <Text style={s.addBtnText}>Add Food</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : selectedFood && (
            <View style={s.detailView}>
              <Text style={s.selectedName}>{selectedFood.name}</Text>
              
              <View style={s.inputRow}>
                <Text style={s.inputLabel}>Quantity (g)</Text>
                <TextInput
                  style={s.quantityInput}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                  selectTextOnFocus
                />
              </View>

              <View style={s.typeRow}>
                <TouchableOpacity 
                  style={[s.typeBtn, mealType === 'meal' && s.typeBtnActive]} 
                  onPress={() => setMealType('meal')}
                >
                  <Text style={[s.typeBtnText, mealType === 'meal' && s.typeBtnTextActive]}>Meal</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[s.typeBtn, mealType === 'snack' && s.typeBtnActive]} 
                  onPress={() => setMealType('snack')}
                >
                  <Text style={[s.typeBtnText, mealType === 'snack' && s.typeBtnTextActive]}>Snack</Text>
                </TouchableOpacity>
              </View>

              <View style={s.macroPreview}>
                <Text style={s.macroText}>
                  ~{Math.round(selectedFood.calories * (parseInt(quantity) || 100) / 100)} calories
                </Text>
              </View>

              <View style={s.actions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setSelectedFood(null)}>
                  <Text style={s.cancelBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.addBtn} onPress={handleAddFood}>
                  <Check size={18} color={colors.primaryText} />
                  <Text style={s.addBtnText}>Add Food</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      </GestureDetector>
      </View>
    </Modal>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', minHeight: 400 },
  dragHandle: { alignItems: 'center', paddingVertical: 12 },
  dragIndicator: { width: 40, height: 4, backgroundColor: colors.surfaceBorder, borderRadius: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, backgroundColor: colors.surfaceInput, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  resultsList: { flex: 1, paddingHorizontal: 16 },
  foodItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, marginBottom: 8, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.surfaceBorder },
  foodItemSelected: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  foodInfo: { flex: 1, marginRight: 12 },
  foodName: { fontSize: 14, fontWeight: '500', color: colors.text },
  foodBrand: { fontSize: 12, color: colors.textDim, marginTop: 2 },
  foodCal: { fontSize: 13, fontWeight: '600', color: colors.primary },
  emptyContainer: { alignItems: 'center', marginTop: 24 },
  emptyText: { textAlign: 'center', color: colors.textDim, marginBottom: 16 },
  emptyActions: { flexDirection: 'row', gap: 12 },
  customBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primaryBg, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  customBtnText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  reportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accent1Bg, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  reportBtnText: { fontSize: 13, fontWeight: '600', color: colors.accent1 },
  detailView: { padding: 16 },
  selectedName: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 20 },
  inputRow: { marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: colors.textDim, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 1 },
  quantityInput: { backgroundColor: colors.surfaceInput, borderRadius: 12, padding: 14, fontSize: 18, fontWeight: '600', color: colors.text, textAlign: 'center' },
  macroInputs: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  macroInput: { width: '47%' },
  smallInput: { backgroundColor: colors.surfaceInput, borderRadius: 12, padding: 12, fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' },
  typeRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  typeBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.surfaceInput, alignItems: 'center' },
  typeBtnActive: { backgroundColor: colors.primaryBg },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  typeBtnTextActive: { color: colors.primary },
  macroPreview: { backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 20, alignItems: 'center' },
  macroText: { fontSize: 16, fontWeight: '600', color: colors.text },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.surfaceInput, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  addBtn: { flex: 2, flexDirection: 'row', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontSize: 14, fontWeight: '700', color: colors.primaryText },
});
