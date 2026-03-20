import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Explicitly define how notifications should be handled when the app is actively running in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const initNotifications = async () => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    // Only ask if permissions have not already been determined
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('Failed to get notification permissions!');
      return;
    }

    // Attempt to set up a specific Android channel for mood tracking
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('mood-check', {
        name: 'Mood Reminders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#ddb7ff',
      });

      // Silent channel for constantly refreshing Live Timers without buzzing the device
      await Notifications.setNotificationChannelAsync('live-timer', {
        name: 'Live Timers',
        importance: Notifications.AndroidImportance.LOW, 
        sound: null, 
      });
    }

    // Register active actionable buttons for Live Widget
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

    console.log('[Native] Notifications Initialized successfully.');
  } catch (error) {
    console.error("Notification Init Error:", error);
  }
};

export const scheduleNextMoodUnlockNotification = async () => {
  try {
    // Dynamically overwrite any pending unlocks securely
    await Notifications.cancelScheduledNotificationAsync('mood-unlock');

    await Notifications.scheduleNotificationAsync({
      identifier: 'mood-unlock',
      content: {
        title: "Tracker Unlocked 🌸",
        body: "Your 1-hour cooldown has elapsed! Tap here to securely update your emotional state.",
        sound: true,
      },
      trigger: {
        type: 'timeInterval',
        seconds: 3600, // Exactly 60m structural delay
        repeats: false, // Disconnected from generic loop; directly mapped to user interaction physically
        channelId: Platform.OS === 'android' ? 'mood-check' : undefined
      },
    });
    console.log('[Native] Next Mood Unlock precision scheduled');
  } catch (error) {
    console.error("Scheduling Error", error);
  }
};

export const forceTestMoodCheck = async () => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Vibe Check Incoming! ✨",
        body: "This is what your hourly native push notification will look like seamlessly integrating into your lock screen.",
        sound: true,
      },
      trigger: null, // trigger immediately
    });
    console.log('[Native] Fired instant test notification');
  } catch (error) {
    console.error("Test Notification Error", error);
  }
};

export const updatePomodoroNotification = async (timeLeft, mode, activeName) => {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  const title = mode === 'work' ? `🎯 Focus Session: ${activeName}` : `☕ Break Time`;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: 'pomodoro-timer',
      content: {
        title: title,
        body: `${timeString} remaining`,
        sticky: true,
        autoDismiss: false,
        sound: false,
        categoryIdentifier: 'pomodoro-actions',
        priority: Platform.OS === 'android' ? Notifications.AndroidNotificationPriority.LOW : undefined,
      },
      trigger: null, // Fire instantly in real-time, completely skipping the OS scheduling queue
    });
  } catch (err) {}
};

export const clearPomodoroNotification = async () => {
  try {
    await Notifications.cancelScheduledNotificationAsync('pomodoro-timer');
  } catch(err) {}
};
