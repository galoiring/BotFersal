import { useCallback } from 'react';

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

interface HapticOptions {
  enabled?: boolean;
  fallback?: boolean; // Use vibration API as fallback
}

export const useHapticFeedback = (options: HapticOptions = {}) => {
  const { enabled = true, fallback = true } = options;

  const hapticFeedback = useCallback((type: HapticType = 'light') => {
    if (!enabled) return;

    // Try modern Haptic API first (iOS Safari)
    if ('haptic' in navigator || 'vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30],
        success: [10, 10, 10],
        warning: [20, 10, 20],
        error: [30, 10, 30, 10, 30],
        selection: [5],
      };

      // Modern devices with haptic engine
      if (typeof (navigator as any).vibrate === 'function') {
        try {
          navigator.vibrate(patterns[type]);
        } catch (error) {
          console.debug('Haptic feedback not available');
        }
      }
    }

    // iOS-specific haptic feedback (requires user gesture)
    if ('hapticFeedback' in window) {
      try {
        const hapticTypes = {
          light: 'impactLight',
          medium: 'impactMedium',
          heavy: 'impactHeavy',
          success: 'notificationSuccess',
          warning: 'notificationWarning',
          error: 'notificationError',
          selection: 'selectionChanged',
        };

        (window as any).hapticFeedback(hapticTypes[type]);
      } catch (error) {
        console.debug('iOS haptic feedback not available');
      }
    }

    // Android Chrome haptic feedback (future feature)
    if ('getGamepads' in navigator && fallback) {
      try {
        const gamepads = navigator.getGamepads();
        const gamepad = gamepads.find(gp => gp && (gp as any).vibrationActuator);
        if (gamepad && (gamepad as any).vibrationActuator) {
          const intensities = {
            light: { startDelay: 0, duration: 50, weakMagnitude: 0.1, strongMagnitude: 0.1 },
            medium: { startDelay: 0, duration: 100, weakMagnitude: 0.3, strongMagnitude: 0.3 },
            heavy: { startDelay: 0, duration: 150, weakMagnitude: 0.5, strongMagnitude: 0.5 },
            success: { startDelay: 0, duration: 100, weakMagnitude: 0.2, strongMagnitude: 0.4 },
            warning: { startDelay: 0, duration: 200, weakMagnitude: 0.3, strongMagnitude: 0.3 },
            error: { startDelay: 0, duration: 300, weakMagnitude: 0.5, strongMagnitude: 0.7 },
            selection: { startDelay: 0, duration: 25, weakMagnitude: 0.1, strongMagnitude: 0.1 },
          };

          (gamepad as any).vibrationActuator.playEffect('dual-rumble', intensities[type]);
        }
      } catch (error) {
        console.debug('Gamepad haptic feedback not available');
      }
    }
  }, [enabled, fallback]);

  // Enhanced haptic patterns for specific use cases
  const patterns = {
    // UI interactions
    buttonTap: () => hapticFeedback('light'),
    cardSwipe: () => hapticFeedback('medium'),
    longPress: () => hapticFeedback('heavy'),

    // State changes
    voucherGet: () => hapticFeedback('success'),
    voucherUse: () => hapticFeedback('success'),
    scanComplete: () => hapticFeedback('success'),

    // Errors and warnings
    noVouchers: () => hapticFeedback('warning'),
    scanError: () => hapticFeedback('error'),
    connectionError: () => hapticFeedback('error'),

    // Navigation
    pageSwipe: () => hapticFeedback('selection'),
    pullRefresh: () => hapticFeedback('medium'),

    // Custom sequences
    celebration: () => {
      hapticFeedback('success');
      setTimeout(() => hapticFeedback('light'), 100);
      setTimeout(() => hapticFeedback('medium'), 200);
    },

    attention: () => {
      hapticFeedback('warning');
      setTimeout(() => hapticFeedback('warning'), 500);
    },
  };

  return {
    hapticFeedback,
    patterns,
    isSupported: 'vibrate' in navigator || 'haptic' in navigator,
  };
};