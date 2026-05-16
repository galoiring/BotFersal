import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSwipeable } from "react-swipeable";
import { X, Check, Tag } from "lucide-react";

interface GroceryItemProps {
  id: string;
  name: string;
  isChecked: boolean;
  category?: string;
  onToggle: () => void;
  onDelete: () => void;
  onCategoryChange?: (itemId: string, newCategory: string) => void;
  isDarkMode?: boolean;
  hapticFeedback?: (type?: any) => void;
  categories?: { key: string; name: string }[];
}

type SwipeState = "none" | "left" | "right";

export const GroceryItem: React.FC<GroceryItemProps> = ({
  id,
  name,
  isChecked,
  category,
  onToggle,
  onDelete,
  onCategoryChange,
  isDarkMode = false,
  hapticFeedback,
  categories = [],
}) => {
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [swipeState, setSwipeState] = useState<SwipeState>("none");
  const menuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Swipe handlers
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (hapticFeedback) hapticFeedback("light");
      setSwipeState("left");
    },
    onSwipedRight: () => {
      if (hapticFeedback) hapticFeedback("light");
      setSwipeState("right");
    },
    trackMouse: false,
    trackTouch: true,
  });

  // Close swipe and category menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setSwipeState("none");
        setShowCategoryMenu(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowCategoryMenu(false);
      }
    };

    if (swipeState !== "none" || showCategoryMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside as any);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("touchstart", handleClickOutside as any);
      };
    }
  }, [swipeState, showCategoryMenu]);

  const handleToggle = () => {
    setSwipeState("none");
    if (hapticFeedback) hapticFeedback("light");
    onToggle();
  };

  const handleDelete = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (hapticFeedback) hapticFeedback("medium");
    onDelete();
  };

  const handleCategoryClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setSwipeState("none");
    setShowCategoryMenu(!showCategoryMenu);
  };

  const handleCategorySelect = (newCategory: string) => {
    if (onCategoryChange) {
      onCategoryChange(id, newCategory);
      if (hapticFeedback) hapticFeedback("light");
    }
    setShowCategoryMenu(false);
  };

  const handleMainContentClick = () => {
    if (swipeState !== "none") {
      setSwipeState("none");
    }
  };

  return (
    <motion.div
      ref={containerRef}
      layout
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -100, scale: 0.9 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
      }}
      className={`item relative overflow-hidden ${isChecked ? "opacity-60" : ""}`}
    >
      {/* Background action buttons - revealed on swipe */}
      <div className="absolute inset-0 flex items-center justify-between px-3">
        {/* Left side - Category button (shown when swiped right) */}
        {onCategoryChange && categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: swipeState === "right" ? 1 : 0 }}
            className="flex items-center"
          >
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleCategoryClick}
              className="actionBtn category"
            >
              <Tag className="w-4 h-4" strokeWidth={2.5} />
              <span>Category</span>
            </motion.button>
          </motion.div>
        )}

        {/* Right side - Delete button (shown when swiped left) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: swipeState === "left" ? 1 : 0 }}
          className="flex items-center ml-auto"
        >
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleDelete}
            className="actionBtn delete"
          >
            <X className="w-4 h-4" strokeWidth={2.5} />
            <span>Delete</span>
          </motion.button>
        </motion.div>
      </div>

      {/* Foreground - Main swipeable content */}
      <motion.div
        {...swipeHandlers}
        animate={{
          x: swipeState === "left" ? -100 : swipeState === "right" ? 100 : 0,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={handleMainContentClick}
        className="row relative z-10"
      >
        {/* Checkbox with liquid glass effect */}
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={handleToggle}
          className={`checkboxBase ${isChecked ? "checkboxOn" : "checkboxOff"}`}
        >
          {isChecked && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 15,
              }}
            >
              <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
            </motion.div>
          )}
        </motion.button>

        {/* Item name */}
        <div
          onClick={handleToggle}
          className="flex-1 cursor-pointer select-none"
        >
          <span className={`label ${isChecked ? "labelChecked" : ""}`}>
            {name}
          </span>
        </div>
      </motion.div>

      {/* Category dropdown menu - positioned absolutely */}
      {onCategoryChange && categories.length > 0 && (
        <AnimatePresence>
          {showCategoryMenu && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute left-4 bottom-full mb-2 rounded-xl3 shadow-xl overflow-hidden z-50 min-w-[180px] glass-card border border-stroke/50"
            >
              <div className="max-h-64 overflow-y-auto">
                {categories.map((cat) => (
                  <motion.button
                    key={cat.key}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleCategorySelect(cat.key)}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                      category === cat.key
                        ? "bg-accent/20 text-accent-light font-semibold"
                        : "text-text hover:bg-accent/10"
                    }`}
                  >
                    {cat.name}
                    {category === cat.key && (
                      <span className="ml-2 text-xs opacity-70">✓</span>
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
};
