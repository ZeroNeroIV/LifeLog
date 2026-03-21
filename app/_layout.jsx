import { useEffect, useState } from 'react';
import { Stack, Tabs } from 'expo-router';
import { Home, UtensilsCrossed, Activity, Timer, Settings, Monitor } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet } from 'react-native';
import { initializeDB, addLog } from '../src/db';
import { initNotifications } from '../src/notifications';
import { ThemeProvider, useTheme } from '../src/theme';

function MainTabs() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopWidth: 5,
            borderTopColor: colors.surfaceBorder,
            position: 'absolute',
            elevation: 1,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textDim,
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Home', tabBarIcon: ({ color }) => <Home color={color} size={24} /> }}
        />
        <Tabs.Screen
          name="performance"
          options={{ title: 'Performance', tabBarIcon: ({ color }) => <Monitor color={color} size={24} /> }}
        />
        <Tabs.Screen
          name="log"
          options={{ title: 'Nutrition', tabBarIcon: ({ color }) => <UtensilsCrossed color={color} size={24} /> }}
        />
        <Tabs.Screen
          name="focus"
          options={{ title: 'Focus', tabBarIcon: ({ color }) => <Timer color={color} size={24} /> }}
        />
        <Tabs.Screen
          name="settings"
          options={{ title: 'Settings', tabBarIcon: ({ color }) => <Settings color={color} size={24} /> }}
        />
      </Tabs>
      <StatusBar style={isDark ? "light" : "dark"} />
    </>
  );
}

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([initializeDB(), initNotifications()])
      .then(() => setDbReady(true))
      .catch((err) => {
        console.error('[LifeLog] Init failed:', err);
        setError(err.message);
      });
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>⚠️ DB Init Error</Text>
        <Text style={styles.errorBody}>{error}</Text>
      </View>
    );
  }

  if (!dbReady) {
    return (
      <View style={styles.center}>
        <Text style={styles.loading}>Booting Life-Log…</Text>
      </View>
    );
  }

  return (
    <ThemeProvider>
      <MainTabs />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loading: {
    color: '#475569',
    fontSize: 16,
    letterSpacing: 1,
  },
  errorTitle: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  errorBody: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
