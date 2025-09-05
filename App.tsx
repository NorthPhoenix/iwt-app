import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Dimensions,
  TextInput,
  Keyboard,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');


// Static Blob Component - no animation
const StaticBlob = ({ 
  color, 
  size, 
  initialX, 
  initialY
}: {
  color: string;
  size: number;
  initialX: number;
  initialY: number;
}) => {
  return (
    <View
      style={[
        styles.blob,
        {
          width: size,
          height: size,
          backgroundColor: color,
          position: 'absolute',
          left: initialX,
          top: initialY,
        },
      ]}
    />
  );
};

// Blob Background Component with Expo Blur
const BlobBackground = () => {
  return (
    <View style={styles.blobContainer}>
      {/* Single huge static blob */}
      <StaticBlob
        color="rgba(64, 156, 255, 0.9)"
        size={500}
        initialX={-150}
        initialY={-100}
      />
      
      {/* Expo blur overlay for production app */}
      <BlurView
        intensity={80}
        tint="default"
        experimentalBlurMethod="dimezisBlurView"
        style={styles.blurOverlay}
      />
    </View>
  );
};

export default function App() {
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(30 * 60); // 30 minutes in seconds
  const [notificationId, setNotificationId] = useState<string | null>(null);
  const [customDuration, setCustomDuration] = useState('30'); // Duration in minutes as string
  const [trainingDuration, setTrainingDuration] = useState(30 * 60); // Duration in seconds

  useEffect(() => {
    // Request notification permissions
    requestNotificationPermissions();

    // Set up notification handler
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isTimerActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          const newTime = prev - 1;

          // Notify every 3 minutes (180 seconds)
          if (newTime > 0 && (trainingDuration - newTime) % 180 === 0) {
            sendIntervalNotification(trainingDuration - newTime);
          }

          return newTime;
        });
      }, 1000);
    } else if (timeRemaining === 0) {
      handleTimerComplete();
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerActive, timeRemaining, trainingDuration]);

  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please enable notifications to receive interval reminders.',
        [{ text: 'OK' }]
      );
    }
  };

  const sendIntervalNotification = async (elapsedSeconds: number) => {
    const minutes = Math.floor(elapsedSeconds / 60);
    const totalMinutes = Math.floor(trainingDuration / 60);
    let message = '';

    if (minutes === 3) {
      message = 'Great start! Keep walking!';
    } else if (minutes === 6) {
      message = 'Halfway through your first interval!';
    } else if (minutes === Math.floor(totalMinutes / 2)) {
      message = `Halfway through your ${totalMinutes}-minute session!`;
    } else if (minutes === totalMinutes - 3) {
      message = 'Almost there! Keep pushing!';
    } else {
      message = `Keep going! ${minutes} minutes completed.`;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Interval Walking Training',
        body: message,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Send immediately
    });
  };

  const validateAndSetDuration = (text: string) => {
    // Handle empty input
    if (text === '') {
      setCustomDuration(text);
      return;
    }

    const numValue = parseInt(text);
    if (!isNaN(numValue) && numValue >= 5 && numValue <= 120) {
      setCustomDuration(text);
      setTrainingDuration(numValue * 60);
    } else if (!isNaN(numValue) && (numValue < 5 || numValue > 120)) {
      // Keep the invalid input but don't update training duration
      setCustomDuration(text);
    } else {
      // Reset to default for non-numeric input
      setCustomDuration('30');
      setTrainingDuration(30 * 60);
    }
  };

  const setPresetDuration = (minutes: string) => {
    setCustomDuration(minutes);
    setTrainingDuration(parseInt(minutes) * 60);
  };

  const startTimer = async () => {
    const duration = parseInt(customDuration);
    if (isNaN(duration) || duration < 5 || duration > 120) {
      Alert.alert(
        'Invalid Duration',
        'Please enter a duration between 5 and 120 minutes.',
        [{ text: 'OK' }]
      );
      return;
    }

    Keyboard.dismiss();
    setTrainingDuration(duration * 60);
    setIsTimerActive(true);
    setTimeRemaining(duration * 60);

    // Schedule initial notification
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Interval Walking Training Started!',
        body: `Your ${duration}-minute training session has begun. You'll be notified every 3 minutes.`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Send immediately
    });
    setNotificationId(id);
  };

  const stopTimer = () => {
    setIsTimerActive(false);
    setTimeRemaining(trainingDuration);
    if (notificationId) {
      Notifications.dismissNotificationAsync(notificationId);
      setNotificationId(null);
    }
  };

  const handleTimerComplete = async () => {
    setIsTimerActive(false);
    setTimeRemaining(trainingDuration);

    const totalMinutes = Math.floor(trainingDuration / 60);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Training Complete!',
        body: `Congratulations! You've completed your ${totalMinutes}-minute interval walking training.`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });

    Alert.alert(
      'Training Complete!',
      `Congratulations! You've completed your ${totalMinutes}-minute interval walking training.`,
      [{ text: 'Great!' }]
    );
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Blurred Blob Background */}
      <BlobBackground />

      <View style={styles.header}>
        <Text style={styles.title}>Interval Walking</Text>
        <Text style={styles.subtitle}>
          {isTimerActive ? `${Math.floor(trainingDuration / 60)}-Minute Training` : 'Choose Duration'}
        </Text>
      </View>

      {isTimerActive ? (
        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
          <Text style={styles.timerLabel}>Time Remaining</Text>

          <TouchableOpacity style={styles.stopButton} onPress={stopTimer}>
            <View style={styles.stopButtonGradient}>
              <View style={styles.stopButtonOuter}>
                <View style={styles.stopButtonMiddle}>
                  <View style={styles.stopButtonInner}>
                    <Text style={styles.stopButtonText}>Stop Training</Text>
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.mainContent}>
          <TouchableOpacity style={styles.startButton} onPress={startTimer}>
            <View style={styles.startButtonGradient}>
              <View style={styles.startButtonOuter}>
                <View style={styles.startButtonMiddle}>
                  <View style={styles.startButtonInner}>
                    <Text style={styles.startButtonText}>Start</Text>
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.presetButtonsContainer}>
            <TouchableOpacity
              style={[styles.presetButton, customDuration === '15' && styles.presetButtonActive]}
              onPress={() => setPresetDuration('15')}
            >
              <View style={[styles.presetButtonGradient, customDuration === '15' && styles.presetButtonGradientActive]}>
                <View style={[styles.presetButtonOuter, customDuration === '15' && styles.presetButtonOuterActive]}>
                  <View style={[styles.presetButtonMiddle, customDuration === '15' && styles.presetButtonMiddleActive]}>
                    <View style={[styles.presetButtonInner, customDuration === '15' && styles.presetButtonInnerActive]}>
                      <Text style={[styles.presetButtonText, customDuration === '15' && styles.presetButtonTextActive]}>
                        15m
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.presetButton, customDuration === '30' && styles.presetButtonActive]}
              onPress={() => setPresetDuration('30')}
            >
              <View style={[styles.presetButtonGradient, customDuration === '30' && styles.presetButtonGradientActive]}>
                <View style={[styles.presetButtonOuter, customDuration === '30' && styles.presetButtonOuterActive]}>
                  <View style={[styles.presetButtonMiddle, customDuration === '30' && styles.presetButtonMiddleActive]}>
                    <View style={[styles.presetButtonInner, customDuration === '30' && styles.presetButtonInnerActive]}>
                      <Text style={[styles.presetButtonText, customDuration === '30' && styles.presetButtonTextActive]}>
                        30m
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.presetButton, customDuration === '60' && styles.presetButtonActive]}
              onPress={() => setPresetDuration('60')}
            >
              <View style={[styles.presetButtonGradient, customDuration === '60' && styles.presetButtonGradientActive]}>
                <View style={[styles.presetButtonOuter, customDuration === '60' && styles.presetButtonOuterActive]}>
                  <View style={[styles.presetButtonMiddle, customDuration === '60' && styles.presetButtonMiddleActive]}>
                    <View style={[styles.presetButtonInner, customDuration === '60' && styles.presetButtonInnerActive]}>
                      <Text style={[styles.presetButtonText, customDuration === '60' && styles.presetButtonTextActive]}>
                        60m
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 20,
    backgroundColor: '#000000',
  },
  blobContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  blurContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  blob: {
    borderRadius: 1000,
    shadowColor: '#64a4ff',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.4,
    shadowRadius: 50,
    elevation: 20,
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  appleGradientBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  appleGradientLayer1: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 132, 255, 0.015)',
  },
  appleGradientLayer2: {
    position: 'absolute',
    top: '30%',
    left: 0,
    right: 0,
    bottom: '30%',
    backgroundColor: 'rgba(10, 132, 255, 0.008)',
  },
  appleGradientAccent: {
    position: 'absolute',
    top: '45%',
    left: '25%',
    right: '25%',
    height: '10%',
    backgroundColor: 'rgba(10, 132, 255, 0.005)',
    borderRadius: 50,
  },
  header: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#8e8e93',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
  mainContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
    zIndex: 10,
  },
  startButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    marginBottom: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0a84ff',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 2,
    borderColor: '#1a9fff',
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  presetButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    gap: 12,
  },
  presetButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2,
    borderColor: '#38383a',
  },
  presetButtonActive: {
    shadowColor: '#0a84ff',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
    borderColor: '#0a84ff',
    transform: [{ scale: 1.05 }],
  },
  presetButtonText: {
    fontSize: 14,
    color: '#8e8e93',
    fontWeight: '600',
  },
  presetButtonTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    zIndex: 10,
  },
  timerText: {
    fontSize: 72,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -1,
  },
  timerLabel: {
    fontSize: 17,
    color: '#8e8e93',
    marginBottom: 60,
    textAlign: 'center',
    fontWeight: '500',
  },
  stopButton: {
    backgroundColor: '#ff453a',
    width: 120,
    height: 120,
    borderRadius: 60,
    shadowColor: '#ff453a',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  startButtonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 80,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButtonOuter: {
    width: '96%',
    height: '96%',
    borderRadius: 76,
    backgroundColor: '#0a84ff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0a84ff',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  startButtonMiddle: {
    width: '90%',
    height: '90%',
    borderRadius: 72,
    backgroundColor: '#1a9fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ffffff',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  startButtonInner: {
    width: '84%',
    height: '84%',
    borderRadius: 67,
    backgroundColor: '#2a9fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  presetButtonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 33,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetButtonOuter: {
    width: '96%',
    height: '96%',
    borderRadius: 31,
    backgroundColor: '#1c1c1e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#38383a',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  presetButtonMiddle: {
    width: '88%',
    height: '88%',
    borderRadius: 29,
    backgroundColor: '#2a2a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetButtonInner: {
    width: '80%',
    height: '80%',
    borderRadius: 26,
    backgroundColor: '#1c1c1e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  presetButtonGradientActive: {
    shadowColor: '#0a84ff',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  presetButtonOuterActive: {
    backgroundColor: '#0a84ff',
    borderColor: '#1a9fff',
  },
  presetButtonMiddleActive: {
    backgroundColor: '#1a9fff',
  },
  presetButtonInnerActive: {
    backgroundColor: '#0a84ff',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  stopButtonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButtonOuter: {
    width: '96%',
    height: '96%',
    borderRadius: 57,
    backgroundColor: '#ff453a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff453a',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  stopButtonMiddle: {
    width: '90%',
    height: '90%',
    borderRadius: 54,
    backgroundColor: '#ff5c4a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ffffff',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  stopButtonInner: {
    width: '84%',
    height: '84%',
    borderRadius: 50,
    backgroundColor: '#ff453a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});
