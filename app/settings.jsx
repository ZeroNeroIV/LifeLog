import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, StatusBar, TouchableOpacity, ScrollView, TextInput, Alert, KeyboardAvoidingView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Droplets, Trash2, Save, AlertOctagon, Sun, Moon, User, Apple } from 'lucide-react-native';
import BentoCard from '../src/components/BentoCard';
import { forceTestMoodCheck, scheduleNextMoodUnlockNotification } from '../src/notifications';
import { getAllSettings, updateSetting, clearAllLogs } from '../src/db';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/theme';

export default function SettingsScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const s = getStyles(colors);
  
  const [settings, setSettings] = useState({ 
    water_fav1_ml: '250', water_fav2_ml: '500',
    profile_fullname: '', profile_username: '', profile_email: '',
    nutrition_calorie_goal: '2000', nutrition_protein_goal: '50',
    nutrition_carbs_goal: '250', nutrition_fat_goal: '65', nutrition_fiber_goal: '30'
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const data = await getAllSettings();
    setSettings(prevState => ({...prevState, ...data}));
  };

  const saveSettings = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateSetting('water_fav1_ml', settings.water_fav1_ml || '250');
    await updateSetting('water_fav2_ml', settings.water_fav2_ml || '500');
    await updateSetting('profile_fullname', settings.profile_fullname || '');
    await updateSetting('profile_username', settings.profile_username || '');
    await updateSetting('profile_email', settings.profile_email || '');
    await updateSetting('nutrition_calorie_goal', settings.nutrition_calorie_goal || '2000');
    await updateSetting('nutrition_protein_goal', settings.nutrition_protein_goal || '50');
    await updateSetting('nutrition_carbs_goal', settings.nutrition_carbs_goal || '250');
    await updateSetting('nutrition_fat_goal', settings.nutrition_fat_goal || '65');
    await updateSetting('nutrition_fiber_goal', settings.nutrition_fiber_goal || '30');
    Alert.alert("Saved", "Settings have been updated!");
  };

  const handleClearData = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "Clear All Data",
      "Are you sure you want to permanently delete ALL your logs? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete All", 
          style: "destructive", 
          onPress: async () => {
            await clearAllLogs();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Data Cleared", "All metric logs have been erased.");
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={s.topBar}>
        <Text style={s.appTitle}>SETTINGS</Text>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.container}>
          
          <BentoCard title="Profile" subtitle="Personal Identity" icon={User} color={colors.accent2} style={{marginBottom: 16}}>
              <View style={s.menuBox}>
                  <Text style={s.label}>Full Name</Text>
                  <TextInput 
                    style={s.input} 
                    placeholder="e.g. John Doe"
                    placeholderTextColor={colors.textDim}
                    value={settings.profile_fullname} 
                    onChangeText={(t) => setSettings({...settings, profile_fullname: t})} 
                  />

                  <Text style={s.label}>Username</Text>
                  <TextInput 
                    style={s.input} 
                    autoCapitalize="none"
                    placeholder="e.g. johndoe99"
                    placeholderTextColor={colors.textDim}
                    value={settings.profile_username} 
                    onChangeText={(t) => setSettings({...settings, profile_username: t})} 
                  />

                  <Text style={s.label}>Email Address</Text>
                  <TextInput 
                    style={s.input} 
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="e.g. john@example.com"
                    placeholderTextColor={colors.textDim}
                    value={settings.profile_email} 
                    onChangeText={(t) => setSettings({...settings, profile_email: t})} 
                  />

                  <TouchableOpacity style={s.saveBtn} onPress={saveSettings}>
                    <Save size={18} color={colors.primaryText} style={{ marginRight: 8 }} />
                    <Text style={s.saveBtnText}>Save Profile Data</Text>
                  </TouchableOpacity>
              </View>
          </BentoCard>

          <BentoCard title="Appearance" subtitle="Light & Dark" icon={isDark ? Moon : Sun} color={colors.accent1} style={{marginBottom: 16}}>
            <View style={[s.menuBox, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
              <Text style={[s.menuText, { marginBottom: 0 }]}>Dark Mode</Text>
              <Switch 
                value={isDark} 
                onValueChange={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleTheme(); }} 
                trackColor={{ true: colors.primary, false: colors.textDim }} 
                thumbColor={colors.surface}
              />
            </View>
          </BentoCard>

          <BentoCard title="Nutrition Goals" subtitle="Daily Targets" icon={Apple} color="#22c55e" style={{marginBottom: 16}}>
              <View style={s.menuBox}>
                  <View style={s.row}>
                    <View style={s.halfInput}>
                      <Text style={s.label}>Calories</Text>
                      <TextInput style={s.input} keyboardType="numeric" value={settings.nutrition_calorie_goal} onChangeText={(t) => setSettings({...settings, nutrition_calorie_goal: t})} />
                    </View>
                    <View style={s.halfInput}>
                      <Text style={s.label}>Protein (g)</Text>
                      <TextInput style={s.input} keyboardType="numeric" value={settings.nutrition_protein_goal} onChangeText={(t) => setSettings({...settings, nutrition_protein_goal: t})} />
                    </View>
                  </View>
                  <View style={s.row}>
                    <View style={s.halfInput}>
                      <Text style={s.label}>Carbs (g)</Text>
                      <TextInput style={s.input} keyboardType="numeric" value={settings.nutrition_carbs_goal} onChangeText={(t) => setSettings({...settings, nutrition_carbs_goal: t})} />
                    </View>
                    <View style={s.halfInput}>
                      <Text style={s.label}>Fat (g)</Text>
                      <TextInput style={s.input} keyboardType="numeric" value={settings.nutrition_fat_goal} onChangeText={(t) => setSettings({...settings, nutrition_fat_goal: t})} />
                    </View>
                  </View>
                  <Text style={s.label}>Fiber (g)</Text>
                  <TextInput style={s.input} keyboardType="numeric" value={settings.nutrition_fiber_goal} onChangeText={(t) => setSettings({...settings, nutrition_fiber_goal: t})} />

                  <TouchableOpacity style={s.saveBtn} onPress={saveSettings}>
                    <Save size={18} color={colors.primaryText} style={{ marginRight: 8 }} />
                    <Text style={s.saveBtnText}>Save Goals</Text>
                  </TouchableOpacity>
              </View>
          </BentoCard>

          <BentoCard title="Preferences" subtitle="Quick Logs" icon={Droplets} color={colors.primary} style={{marginBottom: 16}}>
              <View style={s.menuBox}>
                  <Text style={s.label}>Water Auto-Add 1 (mL)</Text>
                  <TextInput 
                    style={s.input} 
                    keyboardType="numeric" 
                    value={settings.water_fav1_ml} 
                    onChangeText={(t) => setSettings({...settings, water_fav1_ml: t})} 
                  />

                  <Text style={s.label}>Water Auto-Add 2 (mL)</Text>
                  <TextInput 
                    style={s.input} 
                    keyboardType="numeric" 
                    value={settings.water_fav2_ml} 
                    onChangeText={(t) => setSettings({...settings, water_fav2_ml: t})} 
                  />

                  <TouchableOpacity style={s.saveBtn} onPress={saveSettings}>
                    <Save size={18} color={colors.primaryText} style={{ marginRight: 8 }} />
                    <Text style={s.saveBtnText}>Save Preferences</Text>
                  </TouchableOpacity>
              </View>
          </BentoCard>

          <BentoCard title="Notifications" subtitle="Mocked in Expo Go" icon={Bell} color={colors.accent2} style={{marginBottom: 16}}>
              <View style={s.menuBox}>
                  <Text style={s.menuText}>Test the actionable Mood Check notification that normally runs every hour. You can test it by clicking the button below and then opening your notification drawer!</Text>
                  
                  <TouchableOpacity style={s.btnPrimary} onPress={forceTestMoodCheck}>
                    <Text style={s.btnPrimaryText}>Trigger Mood Check Now</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={s.btnSecondary} onPress={scheduleNextMoodUnlockNotification}>
                    <Text style={s.btnSecondaryText}>Force 1hr Cooldown Hook</Text>
                  </TouchableOpacity>
              </View>
          </BentoCard>

          <BentoCard title="Danger Zone" subtitle="Data Management" icon={AlertOctagon} color={colors.danger}>
              <View style={s.menuBox}>
                  <Text style={s.menuText}>Wipe your database clean forever.</Text>
                  <TouchableOpacity style={s.btnDanger} onPress={handleClearData}>
                    <Trash2 size={18} color={colors.dangerText} style={{ marginRight: 8 }} />
                    <Text style={s.btnDangerText}>Clear All Data</Text>
                  </TouchableOpacity>
              </View>
          </BentoCard>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 64, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder, backgroundColor: colors.topBar },
  appTitle: { color: colors.text, fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  container: { padding: 24, paddingBottom: 100 },
  menuBox: { marginTop: 12 },
  menuText: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 16 },
  
  label: { color: colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 },
  input: { backgroundColor: colors.surfaceInput, color: colors.text, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  
  saveBtn: { flexDirection: 'row', backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  saveBtnText: { color: colors.primaryText, fontWeight: '800', fontSize: 14 },

  btnPrimary: { backgroundColor: colors.accent2, padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  btnPrimaryText: { color: colors.accent2Text, fontWeight: '800', fontSize: 14 },
  
  btnSecondary: { backgroundColor: colors.surface, padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.surfaceBorder },
  btnSecondaryText: { color: colors.accent2, fontWeight: '700', fontSize: 14 },
  
  btnAccent: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  btnAccentText: { color: colors.primaryText, fontWeight: '800', fontSize: 14 },

  btnDanger: { flexDirection: 'row', backgroundColor: colors.danger, padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnDangerText: { color: colors.dangerText, fontWeight: '800', fontSize: 14 },
});
