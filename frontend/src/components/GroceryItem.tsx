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
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -100, scale: 0.9 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
      }}
      className={`liquid-card flex items-center gap-3 p-4 ${
        isChecked ? "opacity-60" : ""
      } group`}
      style={{
        borderRadius: "20px",
      }}
    >
      {/* Checkbox with liquid glass effect */}
      <motion.button
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.05 }}
        onClick={handleToggle}
        className={`specular-highlight flex-shrink-0 w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-300 ${
          isChecked
            ? "bg-gradient-to-br from-green-400 to-emerald-500 shadow-lg shadow-green-500/30"
            : isDarkMode
            ? "glass-regular border-2 border-white/20"
            : "glass-regular border-2 border-gray-300/50"
        }`}
        style={{
          backdropFilter: isChecked ? "none" : undefined,
        }}
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
            <Check className="w-4 h-4 text-white" strokeWidth={3} />
          </motion.div>
        )}
      </motion.button>

      {/* Item name with liquid glass hover effect */}
      <div
        onClick={handleToggle}
        className="flex-1 cursor-pointer select-none relative"
      >
        <span
          className={`text-base font-medium transition-all duration-300 ${
            isChecked
              ? isDarkMode
                ? "line-through text-gray-500"
                : "line-through text-gray-400"
              : isDarkMode
              ? "text-white"
              : "text-gray-900"
          }`}
        >
          {name}
        </span>

        {/* Liquid shimmer effect on hover */}
        <motion.div
          className="absolute inset-0 -z-10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: isDarkMode
              ? "linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.1), transparent)"
              : "linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.1), transparent)",
            backgroundSize: "200% 100%",
          }}
          animate={{
            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </div>

      {/* Delete button with liquid glass */}
      <motion.button
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.1 }}
        onClick={handleDelete}
        className={`specular-highlight flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 opacity-0 group-hover:opacity-100 ${
          isDarkMode
            ? "glass-regular bg-red-500/10 hover:bg-red-500/20"
            : "glass-regular bg-red-50/80 hover:bg-red-100/80"
        }`}
        style={{
          backdropFilter: "blur(20px)",
        }}
      >
        <X className="w-4 h-4 text-red-500" strokeWidth={2.5} />
      </motion.button>
    </motion.div>
  );
};
