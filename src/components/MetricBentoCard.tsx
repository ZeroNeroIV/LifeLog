import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Plus, X, LucideIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import BentoCard from './BentoCard';
import { getTodayTotal, addLog, LogType } from '../db';
import { useTheme, ThemeColors } from '../theme';

interface MetricBentoCardProps {
  title: string;
  type: LogType;
  icon: LucideIcon;
  color: string;
  unit: string;
  fav1: number;
  fav2: number;
  onUpdate?: () => void;
}

export default function MetricBentoCard({ title, type, icon, color, unit, fav1, fav2, onUpdate }: MetricBentoCardProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);
  const [total, setTotal] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const fetchTotal = async () => {
    const t = await getTodayTotal(type);
    setTotal(t);
  };

  useEffect(() => {
    fetchTotal();
  }, []);

  const handleAdd = async (value: number | string) => {
    try {
      if (!value || isNaN(Number(value))) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await addLog(type, Number(value));
      await fetchTotal();
      if (onUpdate) onUpdate();
      setModalVisible(false);
      setCustomValue('');
    } catch (e) {
      console.error('Failed to log:', e);
    }
  };

  return (
    <>
      <BentoCard title={title} subtitle={`${total} ${unit}`} icon={icon} color={color}>
        <View style={s.btnRow}>
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: color + '15', borderColor: color + '30' }]}
            onPress={() => handleAdd(fav1)}
            activeOpacity={0.7}
          >
            <Text style={[s.btnText, { color }]}>+{fav1}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: color + '15', borderColor: color + '30' }]}
            onPress={() => handleAdd(fav2)}
            activeOpacity={0.7}
          >
            <Text style={[s.btnText, { color }]}>+{fav2}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.addBtn, s.customBtn, { backgroundColor: color + '15', borderColor: color + '30' }]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.7}
          >
            <Plus size={20} color={color} />
          </TouchableOpacity>
        </View>
      </BentoCard>

      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Custom {title}</Text>
              <Pressable onPress={() => setModalVisible(false)} style={s.closeBtn}>
                <X size={20} color="#e7e5e4" />
              </Pressable>
            </View>
            
            <TextInput
              style={s.input}
              placeholder={`Amount in ${unit}`}
              placeholderTextColor="#767575"
              keyboardType="numeric"
              value={customValue}
              onChangeText={setCustomValue}
              autoFocus
            />

            <TouchableOpacity 
              style={[s.submitBtn, { backgroundColor: color }]} 
              onPress={() => handleAdd(customValue)}
              activeOpacity={0.8}
            >
              <Text style={s.submitText}>Add Log</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  btnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  addBtn: { flex: 1, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  customBtn: { flex: 0.5 },
  btnText: { fontSize: 15, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', backgroundColor: colors.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: colors.surfaceBorder },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  closeBtn: { padding: 8, backgroundColor: colors.surfaceInput, borderRadius: 12 },
  input: { backgroundColor: colors.surfaceInput, borderRadius: 16, padding: 16, fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 24, borderWidth: 1, borderColor: colors.surfaceBorder, textAlign: 'center' },
  submitBtn: { paddingVertical: 18, borderRadius: 100, alignItems: 'center' },
  submitText: { color: '#00363e', fontSize: 16, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
});
