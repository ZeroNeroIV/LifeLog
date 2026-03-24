// src/components/MoodCheckModal.tsx - Hourly Mood Check Popup
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable } from 'react-native';
import { Smile, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { addLog, getTodayLogs, LogEntry } from '../db';
import { scheduleNextMoodUnlockNotification } from '../notifications';
import { useTheme, ThemeColors } from '../theme';

interface MoodOption {
  val: number;
  emoji: string;
  label: string;
  color: string;
}

const MOODS: MoodOption[] = [
  { val: 1, emoji: '😫', label: 'Awful', color: '#ff716c' },
  { val: 2, emoji: '🙁', label: 'Bad', color: '#ffb86c' },
  { val: 3, emoji: '😐', label: 'Okay', color: '#e7e5e4' },
  { val: 4, emoji: '😊', label: 'Good', color: '#7de9ff' },
  { val: 5, emoji: '🤩', label: 'Awesome', color: '#ddb7ff' }
];

interface MoodCheckModalProps {
  visible: boolean;
  onClose: () => void;
  onMoodLogged: () => void;
}

export default function MoodCheckModal({ visible, onClose, onMoodLogged }: MoodCheckModalProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);
  
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectMood = (val: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMood(val);
  };

  const handleSubmit = async () => {
    if (!selectedMood || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await addLog('mood', selectedMood);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      await scheduleNextMoodUnlockNotification();
      
      setSelectedMood(null);
      onMoodLogged();
      onClose();
    } catch (e) {
      console.error('Failed to log mood:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = () => {
    setSelectedMood(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <View style={s.overlay}>
        <View style={s.container}>
          <View style={s.header}>
            <View style={s.headerIcon}>
              <Smile size={28} color={colors.accent2} />
            </View>
            <Text style={s.title}>How are you feeling?</Text>
            <Text style={s.subtitle}>Take a moment to check in with yourself</Text>
            <Pressable onPress={handleDismiss} style={s.closeBtn}>
              <X size={18} color={colors.textDim} />
            </Pressable>
          </View>

          <View style={s.moodGrid}>
            {MOODS.map((mood) => {
              const isSelected = selectedMood === mood.val;
              return (
                <TouchableOpacity
                  key={mood.val}
                  style={[
                    s.moodBtn,
                    isSelected && { 
                      backgroundColor: `${mood.color}25`, 
                      borderColor: mood.color,
                      transform: [{ scale: 1.05 }]
                    }
                  ]}
                  onPress={() => handleSelectMood(mood.val)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.emoji, isSelected && { fontSize: 36 }]}>{mood.emoji}</Text>
                  <Text style={[s.moodLabel, isSelected && { color: mood.color }]}>{mood.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[
              s.submitBtn,
              selectedMood 
                ? { backgroundColor: colors.accent2 } 
                : { backgroundColor: colors.surfaceBorder }
            ]}
            disabled={!selectedMood || isSubmitting}
            onPress={handleSubmit}
            activeOpacity={0.8}
          >
            <Text style={[
              s.submitText,
              { color: selectedMood ? '#fff' : colors.textDim }
            ]}>
              {isSubmitting ? 'Saving...' : selectedMood ? 'Log My Mood' : 'Select a mood above'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.skipBtn} onPress={handleDismiss}>
            <Text style={s.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent2 + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 6,
    fontWeight: '500',
  },
  closeBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceInput,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  moodGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 24,
  },
  moodBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: colors.surfaceInput,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  moodLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  submitBtn: {
    paddingVertical: 18,
    borderRadius: 100,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  skipBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 13,
    color: colors.textDim,
    fontWeight: '600',
  },
});
