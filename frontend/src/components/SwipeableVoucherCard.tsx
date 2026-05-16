import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';
import { Gift, Star, Trash2, Share2, Eye } from 'lucide-react';

interface SwipeableVoucherCardProps {
  amount: string;
  count: number;
  onClick: (amount: string) => void;
  onShare?: (amount: string) => void;
  onDelete?: (amount: string) => void;
  isDarkMode: boolean;
  hapticFeedback: (type: 'light' | 'medium' | 'heavy') => void;
}

export const SwipeableVoucherCard: React.FC<SwipeableVoucherCardProps> = ({
  amount,
  count,
  onClick,
  onShare,
  onDelete,
  isDarkMode,
  hapticFeedback,
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [touchFeedback, setTouchFeedback] = useState(false);

  const maxSwipe = 160; // Maximum swipe distance to reveal actions
  const threshold = 80; // Threshold to trigger reveal

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      if (count === 0) return; // Don't allow swipe on disabled cards

      const deltaX = -eventData.deltaX; // Negative for left swipe
      const newOffset = Math.min(maxSwipe, Math.max(0, deltaX));
      setSwipeOffset(newOffset);
    },
    onSwipedLeft: () => {
      if (count === 0) return;

      if (swipeOffset > threshold) {
        setIsRevealed(true);
        setSwipeOffset(maxSwipe);
        hapticFeedback('medium');
      } else {
        setIsRevealed(false);
        setSwipeOffset(0);
      }
    },
    onSwipedRight: () => {
      setIsRevealed(false);
      setSwipeOffset(0);
      hapticFeedback('light');
    },
    onTap: () => {
      if (isRevealed) {
        setIsRevealed(false);
        setSwipeOffset(0);
      } else if (count > 0) {
        hapticFeedback('medium');
        setTouchFeedback(true);
        setTimeout(() => setTouchFeedback(false), 200);
        onClick(amount);
      }
    },
    trackMouse: false,
    trackTouch: true,
  });

  const handleAction = (action: 'share' | 'delete' | 'view') => {
    hapticFeedback('heavy');
    setIsRevealed(false);
    setSwipeOffset(0);

    switch (action) {
      case 'share':
        onShare?.(amount);
        break;
      case 'delete':
        onDelete?.(amount);
        break;
      case 'view':
        onClick(amount);
        break;
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Action buttons background - revealed on swipe */}
      <AnimatePresence>
        {isRevealed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-l from-red-500 via-blue-500 to-green-500 rounded-2xl"
          >
            <div className="absolute right-0 top-0 h-full flex items-center gap-2 pr-4">
              {/* View action */}
              <motion.button
                initial={{ scale: 0, x: 20 }}
                animate={{ scale: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => handleAction('view')}
                className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform"
              >
                <Eye size={20} />
              </motion.button>

              {/* Share action */}
              {onShare && (
                <motion.button
                  initial={{ scale: 0, x: 20 }}
                  animate={{ scale: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  onClick={() => handleAction('share')}
                  className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform"
                >
                  <Share2 size={20} />
                </motion.button>
              )}

              {/* Delete action */}
              {onDelete && (
                <motion.button
                  initial={{ scale: 0, x: 20 }}
                  animate={{ scale: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  onClick={() => handleAction('delete')}
                  className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform"
                >
                  <Trash2 size={20} />
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main card */}
      <motion.div
        {...handlers}
        animate={{
          x: -swipeOffset,
          scale: touchFeedback ? 0.95 : 1,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
        }}
        className={`relative p-4 transition-all duration-300 ${
          count > 0
            ? isDarkMode
              ? "bg-gray-800/95 backdrop-blur-xl border border-gray-700/40 shadow-lg cursor-pointer"
              : "bg-white/95 backdrop-blur-xl border border-white/40 shadow-lg cursor-pointer"
            : isDarkMode
              ? "bg-gray-900/50 backdrop-blur-xl border border-gray-800/30 opacity-50"
              : "bg-gray-100/50 backdrop-blur-xl border border-gray-200/30 opacity-50"
        } rounded-2xl`}
        style={{
          boxShadow: count > 0 ?
            isDarkMode
              ? '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset'
              : '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.2) inset'
            : undefined
        }}
      >
        {/* Enhanced glassmorphism */}
        <div className={`absolute inset-0 bg-gradient-to-br opacity-60 rounded-2xl ${
          isDarkMode
            ? 'from-white/5 via-white/2 to-transparent'
            : 'from-white/30 via-white/10 to-transparent'
        }`}></div>

        <div className='relative z-10 text-center'>
          <div className='flex items-center justify-center mb-2'>
            <Gift className='w-4 h-4 text-blue-500 mr-1' />
            <div className={`text-xl font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>₪{amount}</div>
          </div>
          <div
            className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all duration-300 ${
              count > 0
                ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md"
                : isDarkMode
                  ? "bg-gray-800 text-gray-500"
                  : "bg-gray-100 text-gray-400"
            }`}
          >
            {count > 0 ? (
              <div className='flex items-center justify-center gap-1'>
                <Star className='w-3 h-3' />
                {count} Available
              </div>
            ) : (
              "Sold Out"
            )}
          </div>
        </div>

        {/* Availability indicator */}
        {count > 0 && (
          <div className='absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full shadow-sm animate-pulse'></div>
        )}

      </motion.div>
    </div>
  );
};