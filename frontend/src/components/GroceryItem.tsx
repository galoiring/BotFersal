import React from "react";
import { motion } from "framer-motion";
import { X, Check } from "lucide-react";

interface GroceryItemProps {
  id: string;
  name: string;
  isChecked: boolean;
  onToggle: () => void;
  onDelete: () => void;
  isDarkMode?: boolean;
  hapticFeedback?: (type?: any) => void;
}

export const GroceryItem: React.FC<GroceryItemProps> = ({
  id,
  name,
  isChecked,
  onToggle,
  onDelete,
  isDarkMode = false,
  hapticFeedback,
}) => {
  const handleToggle = () => {
    if (hapticFeedback) hapticFeedback("light");
    onToggle();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hapticFeedback) hapticFeedback("medium");
    onDelete();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={`flex items-center gap-3 p-4 rounded-2xl transition-all ${
        isDarkMode
          ? "bg-gray-800 border-gray-700"
          : "bg-white border-gray-200"
      } border shadow-sm`}
    >
      {/* Checkbox */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={handleToggle}
        className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
          isChecked
            ? "bg-green-500 border-green-500"
            : isDarkMode
            ? "border-gray-600 bg-gray-700"
            : "border-gray-300 bg-white"
        }`}
      >
        {isChecked && <Check className="w-4 h-4 text-white" />}
      </motion.button>

      {/* Item name */}
      <div
        onClick={handleToggle}
        className="flex-1 cursor-pointer select-none"
      >
        <span
          className={`text-base ${
            isChecked
              ? isDarkMode
                ? "line-through text-gray-500"
                : "line-through text-gray-400"
              : isDarkMode
              ? "text-white"
              : "text-gray-800"
          }`}
        >
          {name}
        </span>
      </div>

      {/* Delete button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={handleDelete}
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
          isDarkMode
            ? "bg-red-500/20 hover:bg-red-500/30"
            : "bg-red-50 hover:bg-red-100"
        }`}
      >
        <X className="w-4 h-4 text-red-500" />
      </motion.button>
    </motion.div>
  );
};
