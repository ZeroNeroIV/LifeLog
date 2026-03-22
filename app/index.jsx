import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, StatusBar, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { getAllSettings, getTodayTotal, getTodayNutritionTotals, getNutritionStreak } from '../src/db';
import { useTheme } from '../src/theme';
import BentoCard from '../src/components/BentoCard';
import { Quote, Flame, Apple, Trophy } from 'lucide-react-native';

const FALLBACK_QUOTES = [
  "The only bad workout is the one that didn't happen.",
  "Focus on the step in front of you, not the whole staircase.",
  "Small daily improvements are the key to staggering long-term results.",
  "Discipline is choosing between what you want now and what you want most.",
  "Don't stop when you're tired. Stop when you're done.",
];

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const s = getStyles(colors);

  const [profileName, setProfileName] = useState('Guest');
  const [quote, setQuote] = useState('');
  const [author, setAuthor] = useState('');
  const [fetchingQuote, setFetchingQuote] = useState(false);

  const [focusTotal, setFocusTotal] = useState(0);
  const [nutrition, setNutrition] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [nutritionGoal, setNutritionGoal] = useState(2000);
  const [streak, setStreak] = useState({ currentStreak: 0, longestStreak: 0 });

  useFocusEffect(() => {
    loadData();
  });

  const loadData = async () => {
    const settings = await getAllSettings();
    const username = settings.profile_username || 'Guest';
    setProfileName(username);
    const goal = parseInt(settings.nutrition_calorie_goal) || 2000;
    setNutritionGoal(goal);

    const focus = await getTodayTotal('focus');
    setFocusTotal(focus);

    const nutri = await getTodayNutritionTotals();
    setNutrition(nutri);

    const streakData = await getNutritionStreak(goal);
    setStreak(streakData);

    if (!quote) fetchQuote();
  };

  const fetchQuote = async () => {
    setFetchingQuote(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch('https://zenquotes.io/api/today', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error('API failed');
      const data = await res.json();

      if (data && data.length > 0) {
        setQuote(data[0].q);
        setAuthor(data[0].a);
      }
    } catch (e) {
      const random = FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
      setQuote(random);
      setAuthor('Life-Log System');
    } finally {
      setFetchingQuote(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.statusBar} />

      <View style={s.topBar}>
        <Text style={s.appTitle}>HOME</Text>
      </View>

      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={s.greeting}>Hello, {profileName} 👋</Text>
          <Text style={s.date}>Ready to crush today?</Text>
        </View>

        <BentoCard title="Daily Inspiration" icon={Quote} color={colors.primary}>
          <View style={s.quoteBox}>
            {fetchingQuote ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <>
                <Text style={[s.quoteText, { color: colors.text }]}>"{quote}"</Text>
                <Text style={[s.quoteAuthor, { color: colors.textMuted }]}>— {author}</Text>
              </>
            )}
          </View>
        </BentoCard>

        {focusTotal > 0 && (
          <BentoCard title="Today's Focus" icon={Flame} color={colors.accent1}>
            <Text style={s.focusText}>You've locked in <Text style={{ color: colors.accent1, fontWeight: '800' }}>{focusTotal} minutes</Text> of deep work today.</Text>
          </BentoCard>
        )}

        {nutrition.calories > 0 && (
          <BentoCard title="Nutrition" icon={Apple} color="#22c55e">
            <View style={s.nutritionBox}>
              <View style={s.calorieCircle}>
                <Text style={s.calorieNum}>{Math.round(nutrition.calories)}</Text>
                <Text style={s.calorieOf}>/ {nutritionGoal}</Text>
              </View>
              <View style={s.macroList}>
                <View style={s.macroItem}><View style={[s.macroDot, { backgroundColor: '#22c55e' }]} /><Text style={s.macroText}>{Math.round(nutrition.protein)}g protein</Text></View>
                <View style={s.macroItem}><View style={[s.macroDot, { backgroundColor: '#f59e0b' }]} /><Text style={s.macroText}>{Math.round(nutrition.carbs)}g carbs</Text></View>
                <View style={s.macroItem}><View style={[s.macroDot, { backgroundColor: '#ef4444' }]} /><Text style={s.macroText}>{Math.round(nutrition.fat)}g fat</Text></View>
              </View>
            </View>
          </BentoCard>
        )}

        {streak.currentStreak > 0 && (
          <BentoCard title="Nutrition Streak" icon={Trophy} color="#f59e0b">
            <View style={s.streakBox}>
              <View style={s.streakMain}>
                <Text style={s.streakNum}>{streak.currentStreak}</Text>
                <Text style={s.streakLabel}>day{streak.currentStreak !== 1 ? 's' : ''}</Text>
              </View>
              <Text style={s.streakHint}>Best: {streak.longestStreak} days</Text>
            </View>
          </BentoCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 64, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder, backgroundColor: colors.topBar },
  appTitle: { color: colors.text, fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  container: { padding: 24, paddingBottom: 100 },
  header: { marginBottom: 32, marginTop: 8 },
  greeting: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -1 },
  date: { fontSize: 14, color: colors.primary, marginTop: 6, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  quoteBox: { marginTop: 12, paddingVertical: 8, minHeight: 80, justifyContent: 'center' },
  quoteText: { fontSize: 20, fontStyle: 'italic', lineHeight: 28, fontWeight: '600', marginBottom: 12 },
  quoteAuthor: { fontSize: 14, fontWeight: '800', textAlign: 'right', textTransform: 'uppercase', letterSpacing: 1 },
  focusText: { fontSize: 16, color: colors.text, lineHeight: 24, fontWeight: '600', marginTop: 12 },
  nutritionBox: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 12 },
  calorieCircle: { alignItems: 'center' },
  calorieNum: { fontSize: 32, fontWeight: '800', color: '#22c55e' },
  calorieOf: { fontSize: 12, color: colors.textDim },
  macroList: { flex: 1, gap: 6 },
  macroItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  macroDot: { width: 8, height: 8, borderRadius: 4 },
  macroText: { fontSize: 13, color: colors.text, fontWeight: '500' },
  streakBox: { marginTop: 12, alignItems: 'center' },
  streakMain: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  streakNum: { fontSize: 48, fontWeight: '800', color: '#f59e0b' },
  streakLabel: { fontSize: 18, fontWeight: '600', color: colors.textMuted },
  streakHint: { fontSize: 12, color: colors.textDim, marginTop: 4 },
});
