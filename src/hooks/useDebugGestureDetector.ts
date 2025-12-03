// src/hooks/useDebugGestureDetector.ts
// Detects the debug mode activation pattern: up, up, down, down, left, left, right, right

import { useRef, useMemo, useCallback } from "react";
import { PanResponder, GestureResponderEvent, PanResponderGestureState } from "react-native";

type SwipeDirection = "up" | "down" | "left" | "right";

const DEBUG_PATTERN: SwipeDirection[] = [
  "up",
  "down",
  "left",
  "right",
];

const SWIPE_THRESHOLD = 50; // minimum distance to consider it a swipe
const GESTURE_TIMEOUT_MS = 5000; // reset pattern after 5 seconds of inactivity

export function useDebugGestureDetector(onPatternDetected: () => void) {
  const patternIndexRef = useRef<number>(0);
  const lastGestureTimeRef = useRef<number>(Date.now());

  const detectSwipeDirection = useCallback((
    gestureState: PanResponderGestureState
  ): SwipeDirection | null => {
    const { dx, dy } = gestureState;

    // Check if it's a significant swipe
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) {
      return null; // Not a significant swipe
    }

    // Determine if horizontal or vertical swipe
    if (absDx > absDy) {
      // Horizontal swipe
      return dx > 0 ? "right" : "left";
    } else {
      // Vertical swipe
      return dy > 0 ? "down" : "up";
    }
  }, []);

  const handleSwipe = useCallback((direction: SwipeDirection) => {
    const now = Date.now();

    // Reset pattern if too much time has passed since last gesture
    if (now - lastGestureTimeRef.current > GESTURE_TIMEOUT_MS) {
      patternIndexRef.current = 0;
    }

    lastGestureTimeRef.current = now;

    const expectedDirection = DEBUG_PATTERN[patternIndexRef.current];

    if (direction === expectedDirection) {
      patternIndexRef.current++;

      // Check if pattern is complete
      if (patternIndexRef.current >= DEBUG_PATTERN.length) {
        patternIndexRef.current = 0;
        onPatternDetected();
      }
    } else {
      // Wrong direction - check if it matches the start of the pattern
      if (direction === DEBUG_PATTERN[0]) {
        patternIndexRef.current = 1;
      } else {
        patternIndexRef.current = 0;
      }
    }
  }, [onPatternDetected]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (
          _event: GestureResponderEvent,
          gestureState: PanResponderGestureState
        ) => {
          // Only capture the gesture if it's a significant swipe
          // This allows normal touches (taps, scrolls) to pass through
          const { dx, dy } = gestureState;
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);
          return absDx >= SWIPE_THRESHOLD || absDy >= SWIPE_THRESHOLD;
        },
        onPanResponderRelease: (
          _event: GestureResponderEvent,
          gestureState: PanResponderGestureState
        ) => {
          const direction = detectSwipeDirection(gestureState);
          if (direction) {
            handleSwipe(direction);
          }
        },
      }),
    [detectSwipeDirection, handleSwipe]
  );

  return panResponder;
}
