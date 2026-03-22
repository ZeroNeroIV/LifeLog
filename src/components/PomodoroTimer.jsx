import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, ScrollView, Platform, Pressable, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Play, Square, RefreshCcw, Coffee, Settings, X, Plus, CheckCircle2, Pencil, Trash2, BellOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';
import { addLog, getSetting, updateSetting } from '../db';
import { updatePomodoroNotification, clearPomodoroNotification } from '../notifications';
import BentoCard from './BentoCard';
import { useTheme } from '../theme';

const DEFAULT_PROFILES = [
  { id: '1', name: 'Classic (25/5)', work: 25, shortBreak: 5, longBreak: 15, cycles: 4 },
  { id: '2', name: 'Quick (20/5)', work: 20, shortBreak: 5, longBreak: 15, cycles: 3 },
];

export default function PomodoroTimer({ onSessionComplete }) {
  const { colors } = useTheme();
  const s = getStyles(colors);

  // Lazy-load audio players - only load when timer starts
  const [audioLoaded, setAudioLoaded] = useState(false);
  const workPlayer = useAudioPlayer(audioLoaded ? 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg' : null, { updateInterval: 0 });
  const breakPlayer = useAudioPlayer(audioLoaded ? 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg' : null, { updateInterval: 0 });

  const [mode, setMode] = useState('work'); 
  const [cycle, setCycle] = useState(1);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  
  const [profiles, setProfiles] = useState(DEFAULT_PROFILES);
  const [activeProfileId, setActiveProfileId] = useState('1');
  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];
  
  const [modalVisible, setModalVisible] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [editorForm, setEditorForm] = useState({ name: '', work: '25', shortBreak: '5', longBreak: '15', cycles: '4' });
  
  const timerRef = useRef(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const pStr = await getSetting('pomodoro_profiles');
    if (pStr) {
        setProfiles(JSON.parse(pStr));
    }
    const currentId = await getSetting('pomodoro_active_profile', '1');
    setActiveProfileId(currentId);
    
    if (!isActive && mode === 'work') {
        const loadedProfile = pStr ? JSON.parse(pStr).find(p => p.id === currentId) : DEFAULT_PROFILES.find(p => p.id === currentId);
        if (loadedProfile) setTimeLeft(Math.round(loadedProfile.work * 60));
    }
  };

  const saveProfiles = async (newProfiles, newActiveId = activeProfileId) => {
    setProfiles(newProfiles);
    setActiveProfileId(newActiveId);
    await updateSetting('pomodoro_profiles', JSON.stringify(newProfiles));
    await updateSetting('pomodoro_active_profile', newActiveId);
    
    if (newActiveId !== activeProfileId) {
      setIsActive(false);
      setMode('work');
      setCycle(1);
      const profile = newProfiles.find(p => p.id === newActiveId) || newProfiles[0];
      setTimeLeft(Math.round(profile.work * 60));
    }
  };

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isActive && timeLeft === 0) {
      handleComplete();
    }
    
    return () => clearInterval(timerRef.current);
  }, [isActive, timeLeft]);

  // Separate effect for notification updates (only when timer starts/stops)
  useEffect(() => {
    if (isActive) {
      // Update notification when timer starts
      updatePomodoroNotification(timeLeft, mode, activeProfile.name);
    } else {
      // Clear notification when timer stops
      clearPomodoroNotification();
    }
  }, [isActive]);

  const handleComplete = async () => {
    clearInterval(timerRef.current);
    setIsActive(false);
    clearPomodoroNotification();
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (mode === 'work') {
      workPlayer?.play();
      await addLog('focus', activeProfile.work);
      if (onSessionComplete) onSessionComplete();
      
      if (cycle >= activeProfile.cycles) {
        setMode('longBreak');
        setTimeLeft(Math.round(activeProfile.longBreak * 60));
      } else {
        setMode('shortBreak');
        setTimeLeft(Math.round(activeProfile.shortBreak * 60));
      }
    } else {
      breakPlayer?.play();
      if (mode === 'longBreak') {
         setCycle(1);
      } else {
         setCycle(cycle + 1);
      }
      setMode('work');
      setTimeLeft(Math.round(activeProfile.work * 60));
    }
  };

  const stopAudio = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    workPlayer?.pause();
    breakPlayer?.pause();
    workPlayer?.seekTo(0);
    breakPlayer?.seekTo(0);
  };

  const toggleTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Lazy-load audio on first timer start
    if (!audioLoaded) setAudioLoaded(true);
    if (!isActive) stopAudio();
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    stopAudio();
    setIsActive(false);
    setMode('work');
    setCycle(1);
    setTimeLeft(Math.round(activeProfile.work * 60));
  };

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const actionId = response.actionIdentifier;
      if (actionId === 'PAUSE_TIMER') {
        setIsActive(prev => {
          if (prev) stopAudio();
          return !prev;
        });
      } else if (actionId === 'STOP_TIMER') {
        resetTimer();
      }
    });
    return () => subscription.remove();
  }, [activeProfile]);

  const runTest = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsActive(false);
    setMode('work');
    setTimeLeft(5); 
    setIsActive(true);
  };

  const openNewEditor = () => {
    setEditorForm({ name: '', work: '25', shortBreak: '5', longBreak: '15', cycles: '4' });
    setEditingProfileId(null);
    setIsAddingNew(true);
  };

  const openEditorForProfile = (p) => {
    setEditorForm({
      name: p.name,
      work: p.work.toString(),
      shortBreak: p.shortBreak.toString(),
      longBreak: p.longBreak.toString(),
      cycles: p.cycles.toString()
    });
    setEditingProfileId(p.id);
    setIsAddingNew(true);
  };

  const deleteProfile = (id) => {
    if (profiles.length <= 1) {
      return Alert.alert('Cannot delete', 'You must have at least one profile.');
    }
    const newProfiles = profiles.filter(p => p.id !== id);
    const newActiveId = id === activeProfileId ? newProfiles[0].id : activeProfileId;
    saveProfiles(newProfiles, newActiveId);
  };

  const handleSaveEditor = () => {
    if (!editorForm.name.trim()) return;
    
    const pInfo = {
      name: editorForm.name.trim(),
      work: parseFloat(editorForm.work) || 25,
      shortBreak: parseFloat(editorForm.shortBreak) || 5,
      longBreak: parseFloat(editorForm.longBreak) || 15,
      cycles: parseInt(editorForm.cycles) || 4,
    };

    if (editingProfileId) {
      const newProfiles = profiles.map(p => p.id === editingProfileId ? { ...p, ...pInfo } : p);
      saveProfiles(newProfiles, activeProfileId);
    } else {
      const newProfile = { id: Date.now().toString(), ...pInfo };
      saveProfiles([...profiles, newProfile], newProfile.id);
    }
    
    setIsAddingNew(false);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  const color = mode === 'work' ? colors.primary : (mode === 'longBreak' ? colors.accent2 : colors.accent1);
  const icon = mode === 'work' ? Play : Coffee;
  const titleText = mode === 'work' ? 'Focus' : (mode === 'longBreak' ? 'Long Break' : 'Short Break');

  return (
    <>
      <BentoCard 
        title={titleText} 
        subtitle={`Cycle ${cycle}/${activeProfile.cycles}`} 
        icon={icon} 
        color={color} 
        style={{ flex: 1 }}
      >
        <TouchableOpacity style={s.settingsIcon} onPress={() => setModalVisible(true)}>
          <Settings size={18} color={colors.textDim} />
        </TouchableOpacity>

        <View style={s.container}>
          <Text style={[s.time, { color }]}>{timeString}</Text>
          <Text style={s.profileTag}>{activeProfile.name}</Text>
          
          <View style={s.controls}>
            <TouchableOpacity style={[s.btn, { backgroundColor: color + '20' }]} onPress={toggleTimer}>
              {isActive ? <Square color={color} size={20} /> : <Play color={color} size={20} />}
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { backgroundColor: colors.surfaceInput }]} onPress={resetTimer}>
              <RefreshCcw color={colors.textMuted} size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { backgroundColor: colors.dangerBg }]} onPress={stopAudio}>
              <BellOff color={colors.danger} size={20} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.testBtn} onPress={runTest}>
            <Text style={s.testText}>Test Audio (5s)</Text>
          </TouchableOpacity>
        </View>
      </BentoCard>

      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Focus Profiles</Text>
              <Pressable onPress={() => setModalVisible(false)} style={s.closeBtn}>
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            {isAddingNew ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={s.label}>Profile Name</Text>
                <TextInput style={s.input} value={editorForm.name} onChangeText={t => setEditorForm({...editorForm, name: t})} placeholder="e.g. Deep Work" placeholderTextColor={colors.textDim} />
                
                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Work (min)</Text>
                    <TextInput style={s.input} keyboardType="decimal-pad" value={editorForm.work} onChangeText={t => setEditorForm({...editorForm, work: t})} />
                  </View>
                  <View style={{ flex: 1 }}>
                     <Text style={s.label}>Short Break</Text>
                     <TextInput style={s.input} keyboardType="decimal-pad" value={editorForm.shortBreak} onChangeText={t => setEditorForm({...editorForm, shortBreak: t})} />
                  </View>
                </View>

                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Long Break</Text>
                    <TextInput style={s.input} keyboardType="decimal-pad" value={editorForm.longBreak} onChangeText={t => setEditorForm({...editorForm, longBreak: t})} />
                  </View>
                  <View style={{ flex: 1 }}>
                     <Text style={s.label}>Cycles</Text>
                     <TextInput style={s.input} keyboardType="numeric" value={editorForm.cycles} onChangeText={t => setEditorForm({...editorForm, cycles: t})} />
                  </View>
                </View>

                <TouchableOpacity style={s.saveBtn} onPress={handleSaveEditor}>
                   <Text style={s.saveBtnText}>{editingProfileId ? 'Update Profile' : 'Save New Profile'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setIsAddingNew(false)}>
                   <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {profiles.map(p => (
                  <TouchableOpacity 
                    key={p.id} 
                    style={[s.profileItem, activeProfileId === p.id && s.profileItemActive]}
                    onPress={() => saveProfiles(profiles, p.id)}
                  >
                    <View style={s.profileInfoBox}>
                      <Text style={[s.profileName, activeProfileId === p.id && { color: colors.primary }]}>{p.name}</Text>
                      <Text style={s.profileDesc}>{p.work}m / {p.shortBreak}m / {p.longBreak}m × {p.cycles}</Text>
                    </View>
                    
                    <View style={s.profileActions}>
                      <TouchableOpacity style={s.actionBtn} onPress={() => openEditorForProfile(p)}>
                        <Pencil size={18} color={colors.textDim} />
                      </TouchableOpacity>
                      <TouchableOpacity style={s.actionBtn} onPress={() => deleteProfile(p.id)}>
                        <Trash2 size={18} color={colors.danger} />
                      </TouchableOpacity>
                      {activeProfileId === p.id && <CheckCircle2 size={20} color={colors.primary} style={{marginLeft: 8}} />}
                    </View>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity style={s.addNewBtn} onPress={openNewEditor}>
                  <Plus size={20} color={colors.primary} />
                  <Text style={s.addNewText}>Create Custom Profile</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
            
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const getStyles = (colors) => StyleSheet.create({
  settingsIcon: { position: 'absolute', top: 20, right: 20, zIndex: 10 },
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginTop: 10 },
  time: { fontSize: 36, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -1, marginBottom: 4 },
  profileTag: { fontSize: 10, color: colors.textMuted, fontWeight: '800', textTransform: 'uppercase', marginBottom: 16, letterSpacing: 1 },
  controls: { flexDirection: 'row', gap: 12 },
  btn: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  testBtn: { marginTop: 20, backgroundColor: colors.dangerBg, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  testText: { color: colors.danger, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, maxHeight: '80%', borderTopWidth: 1, borderTopColor: colors.surfaceBorder },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  closeBtn: { padding: 8, backgroundColor: colors.surfaceInput, borderRadius: 12 },
  profileItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: colors.surfaceInput, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.surfaceBorder },
  profileItemActive: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  profileInfoBox: { flex: 1 },
  profileName: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  profileDesc: { fontSize: 12, color: colors.textDim, fontWeight: '600' },
  profileActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { padding: 6, marginLeft: 6, backgroundColor: colors.surface, borderRadius: 8 },
  addNewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed', borderRadius: 16, marginTop: 8 },
  addNewText: { marginLeft: 8, color: colors.primary, fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', gap: 12 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: colors.surfaceInput, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: 12, padding: 14, color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 16 },
  saveBtn: { backgroundColor: colors.primary, padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: colors.primaryText, fontWeight: '800', fontSize: 16 },
  cancelBtn: { padding: 18, alignItems: 'center', marginTop: 4 },
  cancelBtnText: { color: colors.textDim, fontWeight: '700', fontSize: 14 }
});
