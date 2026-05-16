import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ShoppingCart, Trash2, ChevronDown, ChevronUp, Milk, ShoppingBag, Leaf, Apple, Beef, Package, Home, Heart } from "lucide-react";
import { GroceryItem } from "./GroceryItem";
import { PullToRefresh } from "./PullToRefresh";
import { AutocompleteInput } from "./AutocompleteInput";

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
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [localError, setLocalError] = useState("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Category collapse state
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Category configuration
  const categoryConfig = {
    dairy: { name: "Dairy & Eggs", icon: Milk, order: 1 },
    bakery: { name: "Bakery", icon: ShoppingBag, order: 2 },
    vegetables: { name: "Vegetables", icon: Leaf, order: 3 },
    fruits: { name: "Fruits", icon: Apple, order: 4 },
    meat: { name: "Meat & Protein", icon: Beef, order: 5 },
    pantry: { name: "Pantry", icon: Package, order: 6 },
    canned: { name: "Canned & Preserved", icon: Package, order: 7 },
    drinks: { name: "Drinks", icon: Package, order: 8 },
    snacks: { name: "Snacks", icon: Package, order: 9 },
    frozen: { name: "Frozen", icon: Package, order: 10 },
    household: { name: "Household", icon: Home, order: 11 },
    baby: { name: "Baby & Kids", icon: Heart, order: 12 },
    pets: { name: "Pet Food", icon: Heart, order: 13 },
    other: { name: "Other", icon: Package, order: 99 },
  };

  // Categories list for dropdown (sorted by order)
  const categoriesList = Object.entries(categoryConfig)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key, config]) => ({ key, name: config.name }));

  // Show notification (both local and parent)
  const showNotification = (message: string, duration: number = 3000) => {
    setLocalError(message);
    setTimeout(() => setLocalError(""), duration);
  };

  const loadGroceryList = useCallback(async () => {
    // Don't load if user is not set yet
    if (!user) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${apiBase}/grocery/list?user=${user}`);
      const data = await response.json();

      if (data.success) {
        setItems(data.data.items || []);
      } else {
        showNotification(data.message || "Failed to load grocery list");
      }
    } catch (err: any) {
      console.error("Error loading grocery list:", err);
      showNotification("Error loading grocery list");
    } finally {
      setLoading(false);
    }
  }, [apiBase, user]);

  useEffect(() => {
    loadGroceryList();
  }, [loadGroceryList]);

  // Fetch suggestions with debouncing
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2 || !user) {
      setSuggestions([]);
      return;
    }

    try {
      setLoadingSuggestions(true);

      const response = await fetch(`${apiBase}/grocery/suggest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user: user,
          query: query,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuggestions(data.data.suggestions || []);
      } else {
        setSuggestions([]);
      }
    } catch (err: any) {
      console.error("Error fetching suggestions:", err);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [apiBase, user]);

  // Debounced input change
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer (200ms delay for optimal UX)
    if (inputValue.length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        fetchSuggestions(inputValue);
      }, 200);
    } else {
      setSuggestions([]);
    }

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputValue, fetchSuggestions]);

  const handleAddItem = async (itemName: string) => {
    if (!itemName.trim() || !user) return;

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
          name: itemName.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        hapticFeedback("medium");

        // Show message if it's a duplicate that was unchecked
        if (data.data?.duplicate && data.data?.unchecked) {
          showNotification(`✅ ${data.message}`, 2000);
          setInputValue(""); // Clear input after showing message
          await loadGroceryList(); // Reload to show unchecked item
        } else if (!data.data?.duplicate) {
          // Only show success message for new items
          showNotification("✅ Item added!", 2000);
          setInputValue(""); // Clear input after showing message
          await loadGroceryList(); // Reload to show new item
        }
        // If duplicate and NOT unchecked, don't clear input or reload
      } else {
        // Show error/warning messages (including duplicate already in list)
        // DON'T clear input so user can see what they tried to add
        showNotification(data.message || "Failed to add item");
      }
    } catch (err: any) {
      console.error("Error adding item:", err);
      showNotification("❌ Error adding item");
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
        showNotification(data.message || "Failed to toggle item");
      }
    } catch (err: any) {
      console.error("Error toggling item:", err);
      showNotification("Error toggling item");
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
        showNotification(data.message || "Failed to delete item");
      }
    } catch (err: any) {
      console.error("Error deleting item:", err);
      showNotification("Error deleting item");
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
        showNotification(data.message || "Failed to clear checked items");
      }
    } catch (err: any) {
      console.error("Error clearing checked items:", err);
      showNotification("Error clearing checked items");
    }
  };

  const handleCleanHistory = async () => {
    if (!window.confirm("Clean autocomplete history?\n\nRemoves typos and rarely-used items from suggestions. This won't affect your current list.")) {
      return;
    }
    try {
      const response = await fetch(
        `${apiBase}/grocery/clean-history?user=${user}`,
        { method: "POST" }
      );
      const data = await response.json();
      if (data.success) {
        hapticFeedback("medium");
        const removed = data.data?.removed_count ?? 0;
        showNotification(removed > 0 ? `Cleaned ${removed} items from history` : "History was already clean");
      } else {
        showNotification(data.message || "Failed to clean history");
      }
    } catch (err: any) {
      console.error("Error cleaning history:", err);
      showNotification("Error cleaning history");
    }
  };

  const handleCategoryChange = async (itemId: string, newCategory: string) => {
    try {
      const response = await fetch(
        `${apiBase}/grocery/item/${itemId}/category?user=${user}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            category: newCategory,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        hapticFeedback("light");
        // Optimistically update UI
        setItems((prevItems) =>
          prevItems.map((item) =>
            item.id === itemId ? { ...item, category: newCategory } : item
          )
        );
      } else {
        showNotification(data.message || "Failed to update category");
      }
    } catch (err: any) {
      console.error("Error updating category:", err);
      showNotification("Error updating category");
    }
  };

  const uncheckedItems = items.filter((item) => !item.is_checked);
  const checkedItems = items.filter((item) => item.is_checked);

  // Group items by category
  const groupByCategory = (items: GroceryItemData[]) => {
    const grouped: Record<string, GroceryItemData[]> = {};

    items.forEach((item) => {
      const category = item.category || "other";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    });

    // Sort categories by order
    return Object.entries(grouped).sort(([catA], [catB]) => {
      const orderA = categoryConfig[catA as keyof typeof categoryConfig]?.order || 99;
      const orderB = categoryConfig[catB as keyof typeof categoryConfig]?.order || 99;
      return orderA - orderB;
    });
  };

  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const groupedUncheckedItems = groupByCategory(uncheckedItems);

  return (
    <div className="flex flex-col h-full relative">
      {/* Notification Display - Fixed Top Toast */}
      <AnimatePresence>
        {localError && (
          <motion.div
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed top-4 left-4 right-4 z-50"
          >
            <div
              className={`p-3 rounded-2xl text-white text-sm font-medium shadow-2xl ${
                localError.startsWith("✅")
                  ? "bg-green-500"
                  : localError.startsWith("ℹ️")
                  ? "bg-blue-500"
                  : "bg-red-500"
              }`}
            >
              {localError}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="headerCard">
        <div className="title">
          <div className="icon">
            <ShoppingCart className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Grocery List</h2>
        </div>

        <div className="meta">
          <div>
            <div className="count">{uncheckedItems.length}</div>
            <div className="label">items to buy</div>
          </div>
          {checkedItems.length > 0 && (
            <div className="chip">
              {checkedItems.length} checked off
            </div>
          )}
        </div>
      </div>

      {/* Add Item Form with Autocomplete */}
      <div className="mb-3">
        <AutocompleteInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleAddItem}
          onSuggestionSelect={(suggestion) => {
            handleAddItem(suggestion);
          }}
          suggestions={suggestions}
          loading={loadingSuggestions}
          disabled={adding}
          isDarkMode={isDarkMode}
          placeholder="Add item... (e.g., חלב, לחם, קוטג׳)"
        />
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 border-4 border-accent/20 border-t-accent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm text-text-muted">
              Loading...
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-text-muted/30" />
            <p className="text-lg font-medium text-text-muted">
              Your grocery list is empty
            </p>
            <p className="text-sm text-text-muted/70">
              Add items to get started!
            </p>
          </div>
        ) : (
          <PullToRefresh onRefresh={loadGroceryList}>
            <div className="space-y-2 pb-4">
              {/* Unchecked Items by Category */}
              {groupedUncheckedItems.map(([category, categoryItems]) => {
                const config = categoryConfig[category as keyof typeof categoryConfig] || categoryConfig.other;
                const CategoryIcon = config.icon;
                const isCollapsed = collapsedCategories.has(category);

                return (
                  <div key={category} className="section">
                    {/* Category Header */}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggleCategoryCollapse(category)}
                      className="header"
                    >
                      <div className="title">
                        <CategoryIcon className="w-4 h-4 text-accent" />
                        <span className="name">{config.name}</span>
                        <span className="count">({categoryItems.length})</span>
                      </div>
                      {isCollapsed ? (
                        <ChevronDown className="w-4 h-4 text-text-muted" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-text-muted" />
                      )}
                    </motion.button>

                    {/* Category Items */}
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="items"
                        >
                          {categoryItems.map((item) => (
                            <GroceryItem
                              key={item.id}
                              id={item.id}
                              name={item.name}
                              isChecked={item.is_checked}
                              category={item.category}
                              onToggle={() => handleToggleItem(item.id)}
                              onDelete={() => handleDeleteItem(item.id)}
                              onCategoryChange={handleCategoryChange}
                              categories={categoriesList}
                              isDarkMode={isDarkMode}
                              hapticFeedback={hapticFeedback}
                            />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* Checked Items Section */}
              {checkedItems.length > 0 && (
                <div className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-text-muted">
                      Checked ({checkedItems.length})
                    </h3>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleClearChecked}
                      className="text-xs px-3 py-1 rounded-lg flex items-center gap-1 bg-error/20 text-error hover:bg-error/30 transition-colors"
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
                        category={item.category}
                        onToggle={() => handleToggleItem(item.id)}
                        onDelete={() => handleDeleteItem(item.id)}
                        onCategoryChange={handleCategoryChange}
                        categories={categoriesList}
                        isDarkMode={isDarkMode}
                        hapticFeedback={hapticFeedback}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {items.length > 0 && (
                <div className="pt-6 pb-2 text-center">
                  <button
                    onClick={handleCleanHistory}
                    className="text-xs text-text-muted hover:text-text-primary transition-colors underline-offset-2 hover:underline"
                  >
                    Clean autocomplete history
                  </button>
                </div>
              )}
            </div>
          </PullToRefresh>
        )}
      </div>
    </div>
  );
};
