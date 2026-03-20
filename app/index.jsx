import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, StatusBar, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { getAllSettings, getTodayTotal } from '../src/db';
import { useTheme } from '../src/theme';
import BentoCard from '../src/components/BentoCard';
import { Quote, Flame } from 'lucide-react-native';

const FALLBACK_QUOTES = [
  "The only bad workout is the one that didn't happen.",
  "Focus on the step in front of you, not the whole staircase.",
  "Small daily improvements are the key to staggering long-term results.",
  "Discipline is choosing between what you want now and what you want most.",
  "Don't stop when you're tired. Stop when you're done.",
];

export default function HomeScreen() {
  const { colors } = useTheme();
  const s = getStyles(colors);

  const [profileName, setProfileName] = useState('Guest');
  const [quote, setQuote] = useState('');
  const [author, setAuthor] = useState('');
  const [fetchingQuote, setFetchingQuote] = useState(false);

  const [focusTotal, setFocusTotal] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    const settings = await getAllSettings();
    const username = settings.profile_username || 'Guest';
    setProfileName(username);

    const focus = await getTodayTotal('focus');
    setFocusTotal(focus);

    // Only hit API once per mount to save network
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
      // Offline-first graceful generic fallback
      const random = FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
      setQuote(random);
      setAuthor('Life-Log System');
    } finally {
      setFetchingQuote(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

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
  focusText: { fontSize: 16, color: colors.text, lineHeight: 24, fontWeight: '600', marginTop: 12 }
});
