import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { Coffee, Plus, Search, X, ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import BentoCard from './BentoCard';
import { searchDrinks, DrinkResult } from '../services/nutritionApi';
import { addLog } from '../db';
import { useTheme, ThemeColors } from '../theme';

const COMMON_DRINKS = ['Espresso', 'Filter Coffee', 'Green Tea', 'Orange Juice', 'Cola Soda', 'Energy Drink'];

export default function DrinksBentoCard() {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);

  const [modalVisible, setModalVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DrinkResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDrink, setSelectedDrink] = useState<DrinkResult | null>(null);
  const [volume, setVolume] = useState('250'); 

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const delay = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchDrinks(query);
        setResults(data);
      } catch (err) {
        console.warn('Drink search failed:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 600);
    return () => clearTimeout(delay);
  }, [query]);

  const handleSelectDrink = (drink: DrinkResult) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDrink(drink);
  };

  const finalizeLog = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const multiplier = parseFloat(volume) / 100;
    
    if (selectedDrink?.water?.value) {
       await addLog('water', selectedDrink.water.value * multiplier);
    } else {
       await addLog('water', parseFloat(volume) * 0.9);
    }

    if (selectedDrink?.caffeine?.value) await addLog('caffeine', selectedDrink.caffeine.value * multiplier);
    if (selectedDrink?.vitaminC?.value) await addLog('vitamin_c', selectedDrink.vitaminC.value * multiplier);
    if (selectedDrink?.sugar?.value) await addLog('sugar', selectedDrink.sugar.value * multiplier);

    setModalVisible(false);
    resetState();
  };

  const openAppModal = (initialQuery = '') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuery(initialQuery);
    setModalVisible(true);
  };

  const resetState = () => {
    setQuery('');
    setResults([]);
    setSelectedDrink(null);
    setVolume('250');
  };

  return (
    <>
      <BentoCard 
        title="Drinks Tracker" 
        subtitle="Powered by USDA API" 
        icon={Coffee} 
        color={colors.accent1} 
        style={{ marginBottom: 16 }}
      >
        <View style={s.container}>
          <Text style={s.helperText}>Select a drink to analyze nutritional data.</Text>
          <View style={s.chipContainer}>
            {COMMON_DRINKS.map(drink => (
              <TouchableOpacity key={drink} style={s.chip} onPress={() => openAppModal(drink)}>
                <Text style={s.chipText}>{drink}</Text>
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity style={s.customChip} onPress={() => openAppModal('')}>
              <Plus size={14} color={colors.accent1} style={{ marginRight: 4 }} />
              <Text style={s.customChipText}>Search API</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BentoCard>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalContent}>
            
            <View style={s.modalHeader}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                {selectedDrink && (
                  <TouchableOpacity onPress={() => setSelectedDrink(null)} style={{marginRight: 12}}>
                     <ChevronLeft size={24} color={colors.text} />
                  </TouchableOpacity>
                )}
                <Text style={s.modalTitle}>{selectedDrink ? 'Confirm Volume' : 'Search API'}</Text>
              </View>
              <Pressable onPress={() => {setModalVisible(false); resetState();}} style={s.closeBtn}>
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            {!selectedDrink ? (
              <View style={{flex: 1}}>
                <View style={s.inputWrapper}>
                  <Search size={20} color={colors.textDim} />
                  <TextInput 
                    style={s.input} 
                    autoFocus
                    placeholder="e.g. Matcha Latte" 
                    placeholderTextColor={colors.textDim} 
                    value={query}
                    onChangeText={setQuery}
                  />
                  {loading && <ActivityIndicator color={colors.accent1} size="small" style={{marginLeft: 12}} />}
                </View>

                <FlatList 
                  data={results}
                  keyExtractor={(item, index) => item.id?.toString() || index.toString()}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 24 }}
                  keyboardShouldPersistTaps="handled" 
                  renderItem={({item}: { item: DrinkResult }) => (
                    <TouchableOpacity style={s.resultItem} onPress={() => handleSelectDrink(item)}>
                      <Text style={s.resName}>{item.name}</Text>
                      {item.brand ? <Text style={s.resBrand}>{item.brand}</Text> : null}
                      <View style={s.nutrBadges}>
                         {item.caffeine && <Text style={s.badgeText}>⚡ {item.caffeine.value}mg</Text>}
                         {item.vitaminC && <Text style={s.badgeText}>🍊 {item.vitaminC.value}mg</Text>}
                         {item.sugar && <Text style={s.badgeText}>🍬 {item.sugar.value}g</Text>}
                      </View>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={() => (
                     !loading && query.length >= 2 ? <Text style={s.emptyState}>No specific API matches found. Tap + to custom log.</Text> : null
                  )}
                />
              </View>
            ) : (
              <View style={{ paddingBottom: 24 }}>
                 <Text style={[s.selectedName, { color: colors.accent1 }]}>{selectedDrink.name}</Text>
                 <Text style={s.volumePrompt}>How much did you drink?</Text>
                 
                 <View style={s.volumeBox}>
                   <TextInput 
                     style={s.volumeInput} 
                     keyboardType="numeric" 
                     value={volume} 
                     onChangeText={setVolume} 
                     autoFocus
                     selectTextOnFocus
                   />
                   <Text style={s.volumeUnit}>mL</Text>
                 </View>

                 <View style={s.previewCard}>
                    <Text style={s.previewTitle}>Estimated Intake</Text>
                    {selectedDrink.caffeine && <Text style={s.pText}>⚡ Caffeine: {Math.round(selectedDrink.caffeine.value * (parseFloat(volume) / 100))}mg</Text>}
                    {selectedDrink.vitaminC && <Text style={s.pText}>🍊 Vitamin C: {Math.round(selectedDrink.vitaminC.value * (parseFloat(volume) / 100))}mg</Text>}
                    {selectedDrink.sugar && <Text style={s.pText}>🍬 Sugar: {Math.round(selectedDrink.sugar.value * (parseFloat(volume) / 100))}g</Text>}
                    <Text style={s.pText}>💧 Water: {selectedDrink.water ? Math.round(selectedDrink.water.value * (parseFloat(volume) / 100)) : Math.round(parseFloat(volume) * 0.9)}mL</Text>
                 </View>

                 <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.accent1 }]} onPress={finalizeLog}>
                    <Text style={s.saveBtnText}>Log Nutritional Data</Text>
                 </TouchableOpacity>
              </View>
            )}

          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { marginTop: 12 },
  helperText: { color: colors.textDim, fontSize: 13, fontWeight: '600', marginBottom: 12 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.surfaceBorder },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  customChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent1Bg, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.accent1Border, borderStyle: 'dashed' },
  customChipText: { color: colors.accent1, fontSize: 13, fontWeight: '700' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, borderTopWidth: 1, borderTopColor: colors.surfaceBorder, height: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  closeBtn: { padding: 8, backgroundColor: colors.surfaceInput, borderRadius: 12 },
  
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceInput, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: 16, paddingHorizontal: 16, marginBottom: 16, height: 56 },
  input: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '600', marginLeft: 12, paddingVertical: 0, includeFontPadding: false },
  
  resultItem: { borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder, paddingVertical: 16 },
  resName: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  resBrand: { color: colors.textDim, fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 },
  nutrBadges: { flexDirection: 'row', gap: 8 },
  badgeText: { color: colors.textMuted, fontSize: 12, backgroundColor: colors.surfaceInput, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  emptyState: { color: colors.textDim, textAlign: 'center', marginTop: 20, fontStyle: 'italic' },

  selectedName: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  volumePrompt: { color: colors.textMuted, fontSize: 14, marginBottom: 16 },
  volumeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceInput, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: 16, paddingHorizontal: 24, marginBottom: 24 },
  volumeInput: { flex: 1, color: colors.text, fontSize: 32, fontWeight: '800', paddingVertical: 16, textAlign: 'center' },
  volumeUnit: { color: colors.textDim, fontSize: 20, fontWeight: '800', marginLeft: 12 },

  previewCard: { backgroundColor: colors.surfaceInput, padding: 16, borderRadius: 16, marginBottom: 24 },
  previewTitle: { color: colors.textDim, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 },
  pText: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 4 },

  saveBtn: { padding: 18, borderRadius: 16, alignItems: 'center' },
  saveBtnText: { color: colors.primaryText, fontWeight: '800', fontSize: 16 },
});
