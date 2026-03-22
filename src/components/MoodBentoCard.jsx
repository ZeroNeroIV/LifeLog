import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Smile, Lock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { addLog, getTodayLogs } from '../db';
import { scheduleNextMoodUnlockNotification } from '../notifications';
import BentoCard from './BentoCard';
import { useTheme } from '../theme';

const MOODS = [
  { val: 1, emoji: '😫', label: 'Awful', color: '#ff716c' },
  { val: 2, emoji: '🙁', label: 'Bad', color: '#ffb86c' },
  { val: 3, emoji: '😐', label: 'Okay', color: '#e7e5e4' },
  { val: 4, emoji: '😊', label: 'Good', color: '#7de9ff' },
  { val: 5, emoji: '🤩', label: 'Awesome', color: '#ddb7ff' }
];

export default function MoodBentoCard() {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);
  
  const [todaysLogs, setTodaysLogs] = useState([]);
  const [selectedMood, setSelectedMood] = useState(null);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    loadMoods();
    let interval;
    if (latestMood && now - latestMood.timestamp < 3600) {
      interval = setInterval(() => {
        setNow(Math.floor(Date.now() / 1000));
      }, 10000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [latestMood?.timestamp]);

  const loadMoods = async () => {
    const logs = await getTodayLogs('mood');
    setTodaysLogs(logs);
  };

  const handleSelectMood = (val) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMood(val);
  };

  const handleSubmitMood = async () => {
    if (!selectedMood) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await addLog('mood', selectedMood);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Natively schedule the specific unlock notification 1 hour from this exact moment!
    await scheduleNextMoodUnlockNotification();

    setSelectedMood(null);
    loadMoods();
  };

  const latestMood = todaysLogs.length > 0 ? todaysLogs[0] : null;

  // Calculate strict chronological boundary
  let isLocked = false;
  let minutesLeft = 0;
  if (latestMood) {
    const elapsed = now - latestMood.timestamp;
    if (elapsed < 3600) {
      isLocked = true;
      minutesLeft = Math.ceil((3600 - elapsed) / 60);
    }
  }

  return (
    <BentoCard 
      title="Mood Tracker" 
      subtitle={isLocked ? `Unlocks natively in ${minutesLeft}m` : (latestMood ? 'Ready to log again!' : 'How are you feeling right now?')} 
      icon={Smile} 
      color={colors.accent2}
    >
      <View style={s.container}>
        {isLocked ? (
          <View style={s.lockedBox}>
             <Lock color={colors.textDim} size={32} style={{ marginBottom: 12 }} />
             <Text style={s.lockedTitle}>Tracker Secured</Text>
             <Text style={s.lockedDesc}>You've already captured your state inside this hour. A native push notification will seamlessly notify you when the next slot opens.</Text>
          </View>
        ) : (
          <>
            <View style={s.emojiRow}>
              {MOODS.map((m) => {
                 const isSelected = selectedMood === m.val;
                 return (
                   <TouchableOpacity 
                     key={m.val} 
                     style={[
                       s.emojiBtn, 
                       isSelected && { backgroundColor: `${m.color}20`, borderColor: m.color, borderWidth: 2 }
                     ]} 
                     onPress={() => handleSelectMood(m.val)}
                   >
                     <Text style={[s.emojiIcon, isSelected && { fontSize: 28 }]}>{m.emoji}</Text>
                     {isSelected && <Text style={[s.emojiLabel, { color: m.color }]}>{m.label}</Text>}
                   </TouchableOpacity>
                 );
              })}
            </View>
            <TouchableOpacity 
               style={[s.submitBtn, selectedMood ? { backgroundColor: colors.accent2 } : { backgroundColor: colors.surfaceBorder }]}
               disabled={!selectedMood}
               onPress={handleSubmitMood}
            >
               <Text style={[s.submitText, { color: selectedMood ? colors.background : colors.textMuted }]}>
                  {selectedMood ? 'Lock in Mood' : 'Select a Vibe First'}
               </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </BentoCard>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { marginTop: 16 },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  emojiBtn: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 14, 
    flex: 1, 
    marginHorizontal: 4, 
    borderRadius: 16, 
    backgroundColor: colors.surfaceInput,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  emojiIcon: { fontSize: 24 },
  emojiLabel: { fontSize: 10, fontWeight: '800', marginTop: 4, textTransform: 'uppercase' },
  submitBtn: { paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  lockedBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 16, backgroundColor: colors.surfaceInput, borderRadius: 16, borderWidth: 1, borderColor: colors.surfaceBorder, borderStyle: 'dashed' },
  lockedTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' },
  lockedDesc: { fontSize: 13, color: colors.textDim, textAlign: 'center', lineHeight: 20, fontWeight: '600', paddingHorizontal: 12 }
});
