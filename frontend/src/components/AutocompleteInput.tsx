import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Sparkles } from "lucide-react";

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onSuggestionSelect: (suggestion: string) => void;
  suggestions: string[];
  loading?: boolean;
  disabled?: boolean;
  isDarkMode?: boolean;
  placeholder?: string;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  onSubmit,
  onSuggestionSelect,
  suggestions,
  loading = false,
  disabled = false,
  isDarkMode = false,
  placeholder = "Add item...",
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Show suggestions when there are results and input is focused
  useEffect(() => {
    setShowSuggestions(suggestions.length > 0 && value.length >= 2);
  }, [suggestions, value]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        onSubmit(value);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          onSuggestionSelect(suggestions[selectedIndex]);
          setShowSuggestions(false);
        } else {
          onSubmit(value);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    onSuggestionSelect(suggestion);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder={placeholder}
            disabled={disabled}
            className={`w-full px-4 py-3 rounded-2xl border-2 text-base transition-all ${
              isDarkMode
                ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-purple-500"
                : "bg-white border-gray-300 text-gray-800 placeholder-gray-400 focus:border-purple-500"
            } focus:outline-none`}
            dir="auto"
          />

          {/* Suggestions Dropdown */}
          <AnimatePresence>
            {showSuggestions && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`absolute top-full left-0 right-0 mt-2 rounded-2xl border shadow-lg max-h-80 overflow-y-auto z-50 ${
                  isDarkMode
                    ? "bg-gray-800 border-gray-700"
                    : "bg-white border-gray-200"
                }`}
              >
                {/* Header */}
                <div
                  className={`px-4 py-2 text-xs font-medium flex items-center gap-2 border-b ${
                    isDarkMode
                      ? "text-gray-400 border-gray-700"
                      : "text-gray-500 border-gray-200"
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  Suggestions
                </div>

                {/* Suggestion Items */}
                <div className="py-1">
                  {suggestions.map((suggestion, index) => (
                    <motion.button
                      key={suggestion}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className={`w-full px-4 py-3 text-left transition-all ${
                        index === selectedIndex
                          ? isDarkMode
                            ? "bg-purple-900/50"
                            : "bg-purple-50"
                          : isDarkMode
                          ? "hover:bg-gray-700"
                          : "hover:bg-gray-50"
                      } ${
                        isDarkMode ? "text-white" : "text-gray-800"
                      } text-base`}
                      dir="auto"
                    >
                      {suggestion}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Add Button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={() => onSubmit(value)}
          disabled={disabled || !value.trim()}
          className={`px-6 py-3 rounded-2xl font-semibold flex items-center gap-2 transition-all ${
            disabled || !value.trim()
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
          } text-white`}
        >
          <Plus className="w-5 h-5" />
          Add
        </motion.button>
      </div>
    </div>
  );
};
