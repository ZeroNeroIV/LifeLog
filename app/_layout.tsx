import { useEffect, useState, Component, ReactNode, useCallback } from 'react';
import { Tabs, useFocusEffect } from 'expo-router';
import { Home, UtensilsCrossed, Timer, Settings, Monitor } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initializeDB, getTodayLogs, getSetting } from '../src/db';
import { initNotifications, scheduleNextMoodUnlockNotification } from '../src/notifications';
import { ThemeProvider, useTheme } from '../src/theme';
import MoodCheckModal from '../src/components/MoodCheckModal';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[LifeLog] ErrorBoundary:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorBody}>{this.state.error?.message || 'Unknown error'}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function MainTabs() {
  const { colors, isDark } = useTheme();
  const [moodModalVisible, setMoodModalVisible] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Check if mood check is due
  useFocusEffect(
    useCallback(() => {
      const checkMoodDue = async () => {
        try {
          const enabled = await getSetting('mood_check_enabled');
          if (enabled !== 'true') return;

          const logs = await getTodayLogs('mood');
          const latestMood = logs[0];
          
          if (!latestMood) {
            // No mood logged today - show modal
            setMoodModalVisible(true);
            return;
          }

          const elapsed = Math.floor(Date.now() / 1000) - latestMood.timestamp;
          if (elapsed >= 3600) {
            // More than 1 hour since last mood - show modal
            setMoodModalVisible(true);
          }
        } catch (e) {
          console.error('Mood check error:', e);
        }
      };

      checkMoodDue();

      // Update time every minute to recheck
      const interval = setInterval(() => {
        setNow(Date.now());
      }, 60000);

      return () => clearInterval(interval);
    }, [])
  );

  const handleMoodLogged = useCallback(async () => {
    await scheduleNextMoodUnlockNotification();
  }, []);

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
      
      <MoodCheckModal
        visible={moodModalVisible}
        onClose={() => setMoodModalVisible(false)}
        onMoodLogged={handleMoodLogged}
      />
    </>
  );
}

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <MainTabs />
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
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
