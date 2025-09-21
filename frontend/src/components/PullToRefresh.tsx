import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, ChevronDown } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
  threshold?: number;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  disabled = false,
  threshold = 80,
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canRefresh, setCanRefresh] = useState(false);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;

    const container = containerRef.current;
    if (!container) return;

    // Only start pull-to-refresh if we're at the top of the scroll
    if (container.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || disabled || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startY.current;

    if (deltaY > 0) {
      // Prevent default scrolling while pulling down
      e.preventDefault();

      // Apply resistance curve for natural feel
      const resistance = Math.min(deltaY * 0.5, threshold * 1.5);
      setPullDistance(resistance);
      setCanRefresh(resistance >= threshold);

      // Haptic feedback when reaching threshold
      if (resistance >= threshold && !canRefresh) {
        if ('vibrate' in navigator) {
          navigator.vibrate(10);
        }
      }
    }
  }, [disabled, isRefreshing, threshold, canRefresh]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;

    isPulling.current = false;

    if (canRefresh && !isRefreshing) {
      setIsRefreshing(true);

      try {
        // Haptic feedback for refresh start
        if ('vibrate' in navigator) {
          navigator.vibrate([20, 10, 20]);
        }

        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
      } finally {
        setIsRefreshing(false);
      }
    }

    // Reset states
    setPullDistance(0);
    setCanRefresh(false);
  }, [canRefresh, isRefreshing, onRefresh]);

  const pullProgress = Math.min(pullDistance / threshold, 1);
  const refreshIconRotation = isRefreshing ? 360 : pullProgress * 180;

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <AnimatePresence>
        {(pullDistance > 0 || isRefreshing) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: Math.min(pullDistance, threshold * 1.2),
              opacity: 1
            }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute top-0 left-0 right-0 z-10 flex items-end justify-center bg-gradient-to-b from-blue-50 to-transparent"
          >
            <div className="pb-4">
              <motion.div
                animate={{ rotate: refreshIconRotation }}
                transition={{ duration: isRefreshing ? 1 : 0.3, ease: "easeOut", repeat: isRefreshing ? Infinity : 0 }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 ${
                  canRefresh || isRefreshing
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {isRefreshing ? (
                  <RotateCcw size={16} />
                ) : (
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-300 ${
                      canRefresh ? 'rotate-180' : ''
                    }`}
                  />
                )}
              </motion.div>

              {/* Progress text */}
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-center mt-2 text-gray-600 font-medium"
              >
                {isRefreshing
                  ? "🔄 Refreshing..."
                  : canRefresh
                  ? "👆 Release to refresh"
                  : "⬇️ Pull to refresh"
                }
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content with pull offset */}
      <motion.div
        animate={{
          y: pullDistance,
          scale: isRefreshing ? 0.98 : 1
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="min-h-full"
      >
        {children}
      </motion.div>
    </div>
  );
};