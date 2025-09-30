// TimerDisplay renders a high-precision mm:ss.SS timer label using Reanimated.
// All frequent updates happen on the UI thread to avoid React re-renders.
// This file documents every line to clarify behavior and threading model.

import React, { useEffect } from "react"
// Import base Text component; we'll wrap it with Reanimated to update without React state
import { Animated } from "react-native"
// Import Reanimated primitives used for UI-thread animations and shared state
import {
  useAnimatedProps,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated"
// Import a helper to schedule a callback back on the React Native (JS) thread from a worklet
import { scheduleOnRN } from "react-native-worklets"
import { AnimatedTextInput } from "./AnimatedTextInput"

/**
 * formatMs
 * Formats a millisecond count as mm:ss using a worklet-safe formatter.
 * @param ms - Milliseconds to format; negative values are clamped to 0.
 */
function formatMs(ms: number) {
  "worklet"
  const clamped = ms < 0 ? 0 : ms
  const totalSeconds = Math.floor(clamped / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const mm = minutes < 10 ? `0${minutes}` : `${minutes}`
  const ss = seconds < 10 ? `0${seconds}` : `${seconds}`
  return `${mm}:${ss}`
}

/**
 * Props for TimerDisplay
 * - durationMs: The total target duration for this timer run.
 * - accumulatedMs: Elapsed time accrued prior to the current running segment (e.g., across pauses).
 * - isRunning: If true, the UI-thread loop advances; if false, time is frozen at accumulatedMs.
 * - startMonoMs: Monotonic timestamp (performance.now()) captured when entering running state.
 * - onDone: Callback invoked once elapsed reaches durationMs.
 * - showRemaining: If true, display remaining time; otherwise display elapsed time.
 * - style: Optional Text style overrides.
 */
type Props = {
  durationMs: number
  accumulatedMs: number
  isRunning: boolean
  startMonoMs?: number
  onDone?: () => void
  showRemaining?: boolean
  style?: any
}

// Functional component that renders a text label updated every frame on the UI thread
export default function TimerDisplay(props: Props) {
  const {
    durationMs,
    accumulatedMs,
    isRunning,
    startMonoMs,
    onDone,
    showRemaining = true,
    style,
  } = props

  // baseElapsedSV stores the base elapsed milliseconds at the start of the current running segment.
  // While running, we add (now - startMonoSV) to this base to get live elapsed.
  const baseElapsedSV = useSharedValue(accumulatedMs)
  // startMonoSV stores the monotonic start time (performance.now()) for the current running segment.
  const startMonoSV = useSharedValue(startMonoMs ?? 0)
  // runningSV is 1 while the timer is running, 0 otherwise; used on the UI thread.
  const runningSV = useSharedValue(isRunning ? 1 : 0)
  // durationSV mirrors the total duration; referenced by UI-thread code.
  const durationSV = useSharedValue(durationMs)
  // renderElapsedSV is the UI-thread copy of the current elapsed value we want to render each frame.
  const renderElapsedSV = useSharedValue(accumulatedMs)

  // Keep duration shared value in sync when prop changes.
  useEffect(() => {
    durationSV.value = durationMs
  }, [durationMs, durationSV])

  // Sync running state and anchors when any of the relevant props change.
  useEffect(() => {
    runningSV.value = isRunning ? 1 : 0
    if (isRunning && startMonoMs != null) {
      // When (re)starting, reset the base and anchor to the provided values
      startMonoSV.value = startMonoMs
      baseElapsedSV.value = accumulatedMs
      renderElapsedSV.value = accumulatedMs
    } else {
      // When paused/stopped, keep render value equal to accumulated (frozen)
      baseElapsedSV.value = accumulatedMs
      renderElapsedSV.value = accumulatedMs
    }
  }, [
    isRunning,
    startMonoMs,
    accumulatedMs,
    runningSV,
    startMonoSV,
    baseElapsedSV,
    renderElapsedSV,
  ])

  // Frame callback runs on the UI thread every rendered frame (~60fps).
  // We compute current elapsed using the monotonic clock to avoid wall-clock drift.
  useFrameCallback(() => {
    if (!runningSV.value) return
    const nowMono = performance.now()
    const elapsed = baseElapsedSV.value + (nowMono - startMonoSV.value)
    if (elapsed >= durationSV.value) {
      // Clamp at duration and stop
      baseElapsedSV.value = durationSV.value
      renderElapsedSV.value = durationSV.value
      runningSV.value = 0
      // Invoke completion on the RN/JS thread to avoid calling JS directly from a worklet
      if (onDone) scheduleOnRN(onDone)
      return
    }
    // Continue advancing the render value for this frame
    renderElapsedSV.value = elapsed
  })

  // animatedProps maps shared values to Text's displayed string without causing a React re-render.
  const animatedProps = useAnimatedProps(() => {
    const elapsedForRender = renderElapsedSV.value
    const remaining = Math.max(0, durationSV.value - elapsedForRender)
    const label = showRemaining
      ? formatMs(remaining)
      : formatMs(elapsedForRender)
    return {
      text: label,
      defaultValue: label,
    }
  })
  return (
    <Animated.View
      style={[
        {
          // Use monospaced numeral glyphs to prevent label width from shifting as digits change
          fontVariant: ["tabular-nums"],
          fontSize: 48,
          fontWeight: "600",
          color: "#ffffff",
        },
        style,
      ]}
    >
      <AnimatedTextInput
        underlineColorAndroid="transparent"
        editable={false}
        animatedProps={animatedProps}
      />
    </Animated.View>
  )
}
