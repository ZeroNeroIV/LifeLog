import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Channel IDs
const CHANNELS = {
  MOOD_CHECK: 'mood-check',
  TIMER: 'timer',
  GENERAL: 'default',
} as const;

// Initialize notification channels (required for Android)
export const initNotifications = async (): Promise<boolean> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('[Notifications] Permission denied');
      return false;
    }

    // Set up Android notification channels
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNELS.MOOD_CHECK, {
        name: 'Mood Reminders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#ddb7ff',
      });

      await Notifications.setNotificationChannelAsync(CHANNELS.TIMER, {
        name: 'Pomodoro Timer',
        importance: Notifications.AndroidImportance.LOW,
        sound: null,
        vibrationPattern: null,
        enableVibrate: false,
      });
    }

    // Set up notification categories for iOS interactive notifications
    await Notifications.setNotificationCategoryAsync('pomodoro-actions', [
      {
        identifier: 'PAUSE_TIMER',
        buttonTitle: 'Pause / Resume',
      },
      {
        identifier: 'STOP_TIMER',
        buttonTitle: 'Stop Timer',
        options: { isDestructive: true },
      },
    ]);

    console.log('[Notifications] Initialized successfully');
    return true;
  } catch (error) {
    console.error('[Notifications] Init error:', error);
    return false;
  }
};

// Schedule mood unlock notification
export const scheduleNextMoodUnlockNotification = async (): Promise<boolean> => {
  try {
    await Notifications.cancelScheduledNotificationAsync('mood-unlock');
    
    await Notifications.scheduleNotificationAsync({
      identifier: 'mood-unlock',
      content: {
        title: 'Tracker Unlocked 🌸',
        body: 'Your 1-hour cooldown has elapsed! Tap here to update your mood.',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        channelId: Platform.OS === 'android' ? CHANNELS.MOOD_CHECK : undefined,
        seconds: 3600,
        repeats: false,
      },
    });
    
    console.log('[Notifications] Mood unlock scheduled');
    return true;
  } catch (error) {
    console.error('[Notifications] Schedule error:', error);
    return false;
  }
};

// Force test mood notification
export const forceTestMoodCheck = async (): Promise<boolean> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Vibe Check Incoming! ✨',
        body: 'This is what your hourly notification looks like.',
        sound: true,
      },
      trigger: null,
    });
    
    console.log('[Notifications] Test notification sent');
    return true;
  } catch (error) {
    console.error('[Notifications] Test error:', error);
    return false;
  }
};

// Update pomodoro timer notification
export const updatePomodoroNotification = async (
  timeLeft: number,
  mode: string,
  activeName: string,
): Promise<boolean> => {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  const title = mode === 'work' 
    ? `🎯 Focus Session: ${activeName}` 
    : `☕ Break Time`;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: 'pomodoro-timer',
      content: {
        title,
        body: `${timeString} remaining`,
        sticky: true,
        autoDismiss: false,
        sound: false,
        categoryIdentifier: 'pomodoro-actions',
        priority: Platform.OS === 'android' ? Notifications.AndroidNotificationPriority.LOW : undefined,
      },
      trigger: null,
    });
    return true;
  } catch (err) {
    console.log('[Notifications] Update error:', (err as Error).message);
    return false;
  }
};

// Clear pomodoro timer notification
export const clearPomodoroNotification = async (): Promise<boolean> => {
  try {
    await Notifications.cancelScheduledNotificationAsync('pomodoro-timer');
    return true;
  } catch (err) {
    console.log('[Notifications] Clear error:', (err as Error).message);
    return false;
  }
};
