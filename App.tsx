import React, { useState, useEffect, useCallback, useRef } from "react"
import { StatusBar } from "expo-status-bar"
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Dimensions,
  Keyboard,
} from "react-native"
import * as Notifications from "expo-notifications"
import Svg, { Defs, RadialGradient, Stop, Circle } from "react-native-svg"
import ConfettiCannon from "react-native-confetti-cannon"

const { width, height } = Dimensions.get("window")

// Static Blob Component - radial gradient center to transparent edge
const StaticBlob = ({
  color,
  size,
  initialX,
  initialY,
}: {
  color: string
  size: number
  initialX: number
  initialY: number
}) => {
  const gradientId = React.useMemo(
    () => `grad_${Math.random().toString(36).slice(2)}`,
    [],
  )

  return (
    <View
      style={[
        styles.blob,
        {
          width: size,
          height: size,
          position: "absolute",
          left: initialX - size / 2,
          top: initialY - size / 2,
        },
      ]}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 1000 1000`}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={1} />
            <Stop offset="60%" stopColor={color} stopOpacity={0.25} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={500} cy={500} r={500} fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  )
}

// Blob Background Component with Expo Blur
const BlobBackground = () => {
  return (
    <View style={styles.blobContainer}>
      {/* Single huge static blob */}
      <StaticBlob
        color="rgba(25, 65, 197, 0.9)"
        size={600}
        initialX={width / 2}
        initialY={0}
      />
      <StaticBlob
        color="rgba(25, 65, 197, 0.9)"
        size={600}
        initialX={width / 2}
        initialY={height}
      />
      <StaticBlob
        color="rgba(71, 10, 136, 0.9)"
        size={1000}
        initialX={0}
        initialY={0}
      />
      <StaticBlob
        color="rgba(71, 10, 136, 0.9)"
        size={1000}
        initialX={width}
        initialY={height}
      />

      {/* Expo blur overlay for production app */}
      {/* <BlurView
        intensity={80}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={styles.blurOverlay}
      /> */}
    </View>
  )
}

type PresetButtonProps = {
  label: string
  active: boolean
  onPress: () => void
}

const PresetButton = ({ label, active, onPress }: PresetButtonProps) => {
  return (
    <TouchableOpacity
      style={[styles.presetButton, active && styles.presetButtonActive]}
      onPress={onPress}
    >
      <View
        style={[
          styles.presetButtonGradient,
          active && styles.presetButtonGradientActive,
        ]}
      >
        <View
          style={[
            styles.presetButtonOuter,
            active && styles.presetButtonOuterActive,
          ]}
        >
          <View
            style={[
              styles.presetButtonMiddle,
              active && styles.presetButtonMiddleActive,
            ]}
          >
            <View
              style={[
                styles.presetButtonInner,
                active && styles.presetButtonInnerActive,
              ]}
            >
              <Text
                style={[
                  styles.presetButtonText,
                  active && styles.presetButtonTextActive,
                ]}
              >
                {label}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default function App() {
  const [isTimerActive, setIsTimerActive] = useState(false)
  const [notificationId, setNotificationId] = useState<string | null>(null)
  const [customDuration, setCustomDuration] = useState("30") // Duration in minutes as string
  const [trainingDuration, setTrainingDuration] = useState(30 * 60) // Duration in seconds
  const [showConfetti, setShowConfetti] = useState(false)
  const [isPausePrompt, setIsPausePrompt] = useState(false)

  // High-precision timing state using the architecture from the article
  const [startTime, setStartTime] = useState<number | null>(null)
  const [pausedTime, setPausedTime] = useState<number>(0) // Total time paused in milliseconds
  const [pauseStartTime, setPauseStartTime] = useState<number | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(30 * 60) // Current time remaining
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastTickRef = useRef<number | null>(null) // Reference time for the last tick

  // Derived countdown for the current 3-minute interval
  const elapsedSeconds = trainingDuration - timeRemaining
  const currentIntervalRemaining =
    timeRemaining === 0
      ? 0
      : elapsedSeconds % 180 === 0
        ? 180
        : 180 - (elapsedSeconds % 180)
  const currentIntervalIndex = Math.floor(elapsedSeconds / 180) + 1
  const intervalKindLabel = currentIntervalIndex % 2 === 1 ? "Relaxed" : "Fast"
  const intervalsLeft = Math.ceil(timeRemaining / 180)

  useEffect(() => {
    // Request notification permissions
    requestNotificationPermissions()

    // Set up notification handler
    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("Notification received:", notification)
      },
    )

    return () => subscription.remove()
  }, [])

  const sendIntervalNotification = useCallback(
    async (elapsedSeconds: number) => {
      const minutes = Math.floor(elapsedSeconds / 60)
      const totalMinutes = Math.floor(trainingDuration / 60)
      let message = ""

      if (minutes === 3) {
        message = "Great start! Keep walking!"
      } else if (minutes === 6) {
        message = "Halfway through your first interval!"
      } else if (minutes === Math.floor(totalMinutes / 2)) {
        message = `Halfway through your ${totalMinutes}-minute session!`
      } else if (minutes === totalMinutes - 3) {
        message = "Almost there! Keep pushing!"
      } else {
        message = `Keep going! ${minutes} minutes completed.`
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Interval Walking Training",
          body: message,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Send immediately
      })
    },
    [trainingDuration],
  )

  const handleTimerComplete = useCallback(async () => {
    setIsTimerActive(false)

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // Reset all timing state
    setStartTime(null)
    setPausedTime(0)
    setPauseStartTime(null)
    setTimeRemaining(trainingDuration)
    lastTickRef.current = null

    const totalMinutes = Math.floor(trainingDuration / 60)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Training Complete!",
        body: `Congratulations! You've completed your ${totalMinutes}-minute interval walking training.`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    })
    setShowConfetti(true)
  }, [trainingDuration])

  // High-precision timer tick function using setTimeout with dynamic intervals
  const tick = useCallback(() => {
    if (!isTimerActive || !startTime) return

    const now = Date.now()

    // Calculate actual elapsed time since timer started
    const totalElapsedMs = now - startTime - pausedTime
    const totalElapsedSeconds = Math.floor(totalElapsedMs / 1000)
    const newTimeRemaining = Math.max(0, trainingDuration - totalElapsedSeconds)

    // Update time remaining
    setTimeRemaining(newTimeRemaining)

    // Handle completion
    if (newTimeRemaining === 0) {
      handleTimerComplete()
      return
    }

    // Handle 3-minute interval notifications
    if (totalElapsedSeconds > 0 && totalElapsedSeconds % 180 === 0) {
      // Only send notification if we crossed a new 3-minute boundary
      const currentInterval = Math.floor(totalElapsedSeconds / 180)
      const previousElapsedSeconds = Math.floor((totalElapsedMs - 100) / 1000)
      const previousInterval = Math.floor(previousElapsedSeconds / 180)

      if (currentInterval > previousInterval) {
        sendIntervalNotification(totalElapsedSeconds)
      }
    }

    // Calculate when the next second should occur
    const nextSecond = (totalElapsedSeconds + 1) * 1000
    const targetTime = startTime + pausedTime + nextSecond

    // Store reference time before scheduling timeout
    lastTickRef.current = now

    // Schedule next tick with dynamic interval
    let delay = targetTime - now

    // If we're behind schedule, catch up by using minimum delay
    if (delay < 0) delay = 1

    // Schedule the next tick
    timeoutRef.current = setTimeout(tick, delay)
  }, [
    isTimerActive,
    startTime,
    pausedTime,
    trainingDuration,
    handleTimerComplete,
    sendIntervalNotification,
  ])

  // Timer lifecycle management
  useEffect(() => {
    if (isTimerActive && startTime && timeRemaining > 0) {
      // Start the timer
      lastTickRef.current = Date.now()
      tick()
    } else {
      // Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [isTimerActive, startTime, tick, timeRemaining])

  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync()
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please enable notifications to receive interval reminders.",
        [{ text: "OK" }],
      )
    }
  }

  const setPresetDuration = (minutes: string) => {
    setCustomDuration(minutes)
    setTrainingDuration(parseInt(minutes) * 60)
  }

  const startTimer = async () => {
    const duration = parseInt(customDuration)
    if (isNaN(duration) || duration < 5 || duration > 120) {
      Alert.alert(
        "Invalid Duration",
        "Please enter a duration between 5 and 120 minutes.",
        [{ text: "OK" }],
      )
      return
    }

    Keyboard.dismiss()

    // Initialize timer state
    const durationSeconds = duration * 60
    setTrainingDuration(durationSeconds)
    setTimeRemaining(durationSeconds)

    // Initialize high-precision timing
    const now = Date.now()
    setStartTime(now)
    setPausedTime(0)
    setPauseStartTime(null)

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // Start the timer
    setIsTimerActive(true)

    // Schedule initial notification
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Interval Walking Training Started!",
        body: `Your ${duration}-minute training session has begun. You'll be notified every 3 minutes.`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Send immediately
    })
    setNotificationId(id)
  }

  const stopTimer = () => {
    // Pause the timer
    setIsTimerActive(false)
    setIsPausePrompt(true)
    setPauseStartTime(Date.now())

    // Clear the current timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  const continueTraining = () => {
    setIsPausePrompt(false)

    // Add the time spent paused to our pausedTime accumulator
    if (pauseStartTime !== null) {
      const now = Date.now()
      const timePausedMs = now - pauseStartTime
      setPausedTime((prev) => prev + timePausedMs)
      setPauseStartTime(null)
    }

    // Resume the timer
    setIsTimerActive(true)
  }

  const endTraining = () => {
    setIsPausePrompt(false)
    setIsTimerActive(false)

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // Reset all timing state
    setStartTime(null)
    setPausedTime(0)
    setPauseStartTime(null)
    setTimeRemaining(trainingDuration)
    lastTickRef.current = null

    if (notificationId) {
      Notifications.dismissNotificationAsync(notificationId)
      setNotificationId(null)
    }
  }
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Blurred Blob Background */}
      <BlobBackground />

      <View style={styles.header}>
        <Text style={styles.title}>Interval Walking</Text>
        <Text style={styles.subtitle}>
          {isTimerActive || isPausePrompt
            ? `${Math.floor(trainingDuration / 60)}-Minute Training`
            : "Choose Duration"}
        </Text>
      </View>

      {isTimerActive || isPausePrompt ? (
        <View style={styles.timerContainer}>
          {intervalsLeft > 1 && (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.smallTimerText}>
                  {formatTime(timeRemaining)}
                </Text>
                <Text style={styles.intervalsLeftText}>
                  {intervalsLeft} left
                </Text>
              </View>
              <Text style={styles.smallTimerLabel}>Total Remaining</Text>
            </>
          )}

          <Text style={styles.timerText}>
            {formatTime(currentIntervalRemaining)}
          </Text>
          <Text style={styles.intervalKindLabel}>{intervalKindLabel}</Text>

          {isPausePrompt ? (
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity style={styles.stopButton} onPress={endTraining}>
                <View style={styles.stopButtonGradient}>
                  <View style={styles.stopButtonOuter}>
                    <View style={styles.stopButtonMiddle}>
                      <View style={styles.stopButtonInner}>
                        <Text style={styles.stopButtonText}>End</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.continueButton}
                onPress={continueTraining}
              >
                <View style={styles.continueButtonGradient}>
                  <View style={styles.continueButtonOuter}>
                    <View style={styles.continueButtonMiddle}>
                      <View style={styles.continueButtonInner}>
                        <Text style={styles.stopButtonText}>Continue</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          ) : (
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
          )}
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
            <PresetButton
              label="15m"
              active={customDuration === "15"}
              onPress={() => setPresetDuration("15")}
            />
            <PresetButton
              label="30m"
              active={customDuration === "30"}
              onPress={() => setPresetDuration("30")}
            />
            <PresetButton
              label="60m"
              active={customDuration === "60"}
              onPress={() => setPresetDuration("60")}
            />
          </View>
        </View>
      )}

      {__DEV__ && (
        <View style={styles.testConfettiContainer}>
          <TouchableOpacity
            style={styles.testConfettiButton}
            onPress={() => setShowConfetti(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.testConfettiButtonText}>Test Confetti</Text>
          </TouchableOpacity>
        </View>
      )}

      {showConfetti && (
        <View style={styles.confettiContainer} pointerEvents="none">
          <ConfettiCannon
            count={120}
            origin={{ x: 0, y: 0 }}
            fadeOut
            explosionSpeed={300}
            fallSpeed={2000}
            autoStart
            autoStartDelay={100}
            onAnimationEnd={() => setShowConfetti(false)}
          />
          <ConfettiCannon
            count={120}
            origin={{ x: width, y: 0 }}
            fadeOut
            explosionSpeed={300}
            fallSpeed={2000}
            autoStart
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 20,
    backgroundColor: "#000000",
  },
  blobContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  blurContainer: {
    flex: 1,
    backgroundColor: "transparent",
  },
  blob: {
    borderRadius: 1000,
    shadowColor: "#64a4ff",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.4,
    shadowRadius: 50,
    elevation: 20,
  },
  blurOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  confettiContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  backgroundGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  appleGradientBase: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000000",
  },
  appleGradientLayer1: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10, 132, 255, 0.015)",
  },
  appleGradientLayer2: {
    position: "absolute",
    top: "30%",
    left: 0,
    right: 0,
    bottom: "30%",
    backgroundColor: "rgba(10, 132, 255, 0.008)",
  },
  appleGradientAccent: {
    position: "absolute",
    top: "45%",
    left: "25%",
    right: "25%",
    height: "10%",
    backgroundColor: "rgba(10, 132, 255, 0.005)",
    borderRadius: 50,
  },
  header: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    alignItems: "center",
    zIndex: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: "#8e8e93",
    textAlign: "center",
    marginTop: 4,
    fontWeight: "500",
  },
  mainContent: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    width: "100%",
    zIndex: 10,
  },
  startButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    marginBottom: 32,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0a84ff",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 2,
    borderColor: "#1a9fff",
  },
  startButtonText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  presetButtonsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    width: "100%",
    gap: 12,
  },
  presetButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 2,
    borderColor: "#38383a",
  },
  presetButtonActive: {
    shadowColor: "#0a84ff",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    borderColor: "#0a84ff",
    transform: [{ scale: 1.05 }],
  },
  presetButtonText: {
    fontSize: 14,
    color: "#8e8e93",
    fontWeight: "600",
  },
  presetButtonTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  timerContainer: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    zIndex: 10,
  },
  timerText: {
    fontSize: 72,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
    letterSpacing: -1,
  },
  smallTimerText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 4,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
  },
  intervalsLeftText: {
    fontSize: 14,
    color: "#8e8e93",
    fontWeight: "500",
    marginBottom: 6,
  },
  smallTimerLabel: {
    fontSize: 14,
    color: "#8e8e93",
    marginBottom: 16,
    textAlign: "center",
    fontWeight: "500",
  },
  intervalKindLabel: {
    fontSize: 14,
    color: "#8e8e93",
    marginBottom: 48,
    textAlign: "center",
    fontWeight: "500",
  },
  stopButton: {
    backgroundColor: "#7f2320",
    width: 120,
    height: 120,
    borderRadius: 60,
    shadowColor: "#7f2320",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  stopButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  startButtonGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 80,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  startButtonOuter: {
    width: "96%",
    height: "96%",
    borderRadius: 76,
    backgroundColor: "#0a84ff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0a84ff",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  startButtonMiddle: {
    width: "90%",
    height: "90%",
    borderRadius: 72,
    backgroundColor: "#1a9fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#ffffff",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  startButtonInner: {
    width: "84%",
    height: "84%",
    borderRadius: 67,
    backgroundColor: "#2a9fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  presetButtonGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 33,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  presetButtonOuter: {
    width: "96%",
    height: "96%",
    borderRadius: 31,
    backgroundColor: "#1c1c1e",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#38383a",
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  presetButtonMiddle: {
    width: "88%",
    height: "88%",
    borderRadius: 29,
    backgroundColor: "#2a2a2e",
    justifyContent: "center",
    alignItems: "center",
  },
  presetButtonInner: {
    width: "80%",
    height: "80%",
    borderRadius: 26,
    backgroundColor: "#1c1c1e",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  presetButtonGradientActive: {
    shadowColor: "#0a84ff",
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  presetButtonOuterActive: {
    backgroundColor: "#0a84ff",
    borderColor: "#1a9fff",
  },
  presetButtonMiddleActive: {
    backgroundColor: "#1a9fff",
  },
  presetButtonInnerActive: {
    backgroundColor: "#0a84ff",
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  stopButtonGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  stopButtonOuter: {
    width: "96%",
    height: "96%",
    borderRadius: 57,
    backgroundColor: "#7f2320",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#7f2320",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.22,
    shadowRadius: 7,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#5a1815",
  },
  stopButtonMiddle: {
    width: "90%",
    height: "90%",
    borderRadius: 54,
    backgroundColor: "#a9443e",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#ffffff",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  stopButtonInner: {
    width: "84%",
    height: "84%",
    borderRadius: 50,
    backgroundColor: "#7f2320",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  continueButton: {
    backgroundColor: "#3a3a3c",
    width: 120,
    height: 120,
    borderRadius: 60,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  continueButtonGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  continueButtonOuter: {
    width: "96%",
    height: "96%",
    borderRadius: 57,
    backgroundColor: "#3a3a3c",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: "#4a4a4c",
  },
  continueButtonMiddle: {
    width: "90%",
    height: "90%",
    borderRadius: 54,
    backgroundColor: "#4a4a4c",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#ffffff",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  continueButtonInner: {
    width: "84%",
    height: "84%",
    borderRadius: 50,
    backgroundColor: "#3a3a3c",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  testConfettiContainer: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 50,
  },
  testConfettiButton: {
    backgroundColor: "#1c1c1e",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#38383a",
  },
  testConfettiButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
})
