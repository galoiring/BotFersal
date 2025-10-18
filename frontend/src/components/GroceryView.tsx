import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ShoppingCart, Trash2 } from "lucide-react";
import { GroceryItem } from "./GroceryItem";
import { PullToRefresh } from "./PullToRefresh";

interface GroceryItemData {
  id: string;
  name: string;
  is_checked: boolean;
  added_at: string;
  category?: string;
}

interface GroceryViewProps {
  user: string;
  apiBase: string;
  isDarkMode: boolean;
  hapticFeedback: (type?: any) => void;
  onError: (message: string) => void;
}

export const GroceryView: React.FC<GroceryViewProps> = ({
  user,
  apiBase,
  isDarkMode,
  hapticFeedback,
  onError,
}) => {
  const [items, setItems] = useState<GroceryItemData[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const loadGroceryList = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBase}/grocery/list?user=${user}`);
      const data = await response.json();

      if (data.success) {
        setItems(data.data.items || []);
      } else {
        onError(data.message || "Failed to load grocery list");
      }
    } catch (err: any) {
      console.error("Error loading grocery list:", err);
      onError("Error loading grocery list");
    } finally {
      setLoading(false);
    }
  }, [apiBase, user, onError]);

  useEffect(() => {
    loadGroceryList();
  }, [loadGroceryList]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim()) return;

    try {
      setAdding(true);
      hapticFeedback("light");

      const response = await fetch(`${apiBase}/grocery/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user: user,
          name: inputValue.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        hapticFeedback("medium");
        setInputValue("");
        await loadGroceryList();
      } else {
        onError(data.message || "Failed to add item");
      }
    } catch (err: any) {
      console.error("Error adding item:", err);
      onError("Error adding item");
    } finally {
      setAdding(false);
    }
  };

  const handleToggleItem = async (itemId: string) => {
    try {
      const response = await fetch(`${apiBase}/grocery/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user: user,
          item_id: itemId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Optimistically update UI
        setItems((prevItems) =>
          prevItems.map((item) =>
            item.id === itemId
              ? { ...item, is_checked: !item.is_checked }
              : item
          )
        );
      } else {
        onError(data.message || "Failed to toggle item");
      }
    } catch (err: any) {
      console.error("Error toggling item:", err);
      onError("Error toggling item");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const response = await fetch(
        `${apiBase}/grocery/item/${itemId}?user=${user}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (data.success) {
        hapticFeedback("medium");
        // Optimistically update UI
        setItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
      } else {
        onError(data.message || "Failed to delete item");
      }
    } catch (err: any) {
      console.error("Error deleting item:", err);
      onError("Error deleting item");
    }
  };

  const handleClearChecked = async () => {
    try {
      const response = await fetch(
        `${apiBase}/grocery/clear-checked?user=${user}`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (data.success) {
        hapticFeedback("medium");
        await loadGroceryList();
      } else {
        onError(data.message || "Failed to clear checked items");
      }
    } catch (err: any) {
      console.error("Error clearing checked items:", err);
      onError("Error clearing checked items");
    }
  };

  const uncheckedItems = items.filter((item) => !item.is_checked);
  const checkedItems = items.filter((item) => item.is_checked);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className={`rounded-3xl p-6 mb-6 ${
          isDarkMode
            ? "bg-gradient-to-br from-purple-900 to-indigo-900"
            : "bg-gradient-to-br from-purple-500 to-indigo-600"
        }`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-white/20 p-3 rounded-2xl">
            <ShoppingCart className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Grocery List</h2>
        </div>

        <div className="flex items-center justify-between text-white/90">
          <div>
            <div className="text-3xl font-bold">{uncheckedItems.length}</div>
            <div className="text-sm">items to buy</div>
          </div>
          {checkedItems.length > 0 && (
            <div>
              <div className="text-2xl font-bold">{checkedItems.length}</div>
              <div className="text-sm">checked off</div>
            </div>
          )}
        </div>
      </div>

      {/* Add Item Form */}
      <form onSubmit={handleAddItem} className="mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Add item... (e.g., חלב, לחם, קוטג׳)"
            disabled={adding}
            className={`flex-1 px-4 py-3 rounded-2xl border-2 text-base transition-all ${
              isDarkMode
                ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-purple-500"
                : "bg-white border-gray-300 text-gray-800 placeholder-gray-400 focus:border-purple-500"
            } focus:outline-none`}
            dir="auto"
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={adding || !inputValue.trim()}
            className={`px-6 py-3 rounded-2xl font-semibold flex items-center gap-2 transition-all ${
              adding || !inputValue.trim()
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
            } text-white`}
          >
            <Plus className="w-5 h-5" />
            Add
          </motion.button>
        </div>
      </form>

      {/* Items List */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 border-4 border-purple-100 border-t-purple-500 rounded-full animate-spin mx-auto mb-3"></div>
            <p
              className={`text-sm ${
                isDarkMode ? "text-gray-300" : "text-gray-500"
              }`}
            >
              Loading...
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart
              className={`w-16 h-16 mx-auto mb-4 ${
                isDarkMode ? "text-gray-600" : "text-gray-300"
              }`}
            />
            <p
              className={`text-lg font-medium ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Your grocery list is empty
            </p>
            <p
              className={`text-sm ${
                isDarkMode ? "text-gray-500" : "text-gray-400"
              }`}
            >
              Add items to get started!
            </p>
          </div>
        ) : (
          <PullToRefresh onRefresh={loadGroceryList}>
            <div className="space-y-3 pb-4">
              {/* Unchecked Items */}
              <AnimatePresence>
                {uncheckedItems.map((item) => (
                  <GroceryItem
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    isChecked={item.is_checked}
                    onToggle={() => handleToggleItem(item.id)}
                    onDelete={() => handleDeleteItem(item.id)}
                    isDarkMode={isDarkMode}
                    hapticFeedback={hapticFeedback}
                  />
                ))}
              </AnimatePresence>

              {/* Checked Items Section */}
              {checkedItems.length > 0 && (
                <div className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3
                      className={`text-sm font-medium ${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Checked ({checkedItems.length})
                    </h3>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleClearChecked}
                      className={`text-xs px-3 py-1 rounded-lg flex items-center gap-1 ${
                        isDarkMode
                          ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          : "bg-red-50 text-red-600 hover:bg-red-100"
                      }`}
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear
                    </motion.button>
                  </div>

                  <AnimatePresence>
                    {checkedItems.map((item) => (
                      <GroceryItem
                        key={item.id}
                        id={item.id}
                        name={item.name}
                        isChecked={item.is_checked}
                        onToggle={() => handleToggleItem(item.id)}
                        onDelete={() => handleDeleteItem(item.id)}
                        isDarkMode={isDarkMode}
                        hapticFeedback={hapticFeedback}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </PullToRefresh>
        )}
      </div>
    </div>
  );
};
