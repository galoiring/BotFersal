import React, { useState, useEffect, useCallback } from "react";
import {
  Camera,
  Scan,
  Wallet,
  RefreshCw,
  CheckCircle,
  XCircle,
  Home,
  Settings,
  TrendingUp,
  Zap,
  Gift,
  Star,
} from "lucide-react";
import "./App.css";

// API Configuration
const API_BASE =
  process.env.REACT_APP_API_URL || window.location.origin + "/api";

// Type definitions
interface VoucherCounts {
  [key: string]: number;
}

interface VoucherCardProps {
  amount: string;
  count: number;
  onClick: (amount: string) => void;
}

interface BarcodeDisplayProps {
  barcode: string;
  amount: string;
  onUse: () => void;
  onCancel: () => void;
}

const App: React.FC = () => {
  const [vouchers, setVouchers] = useState<VoucherCounts>({});
  const [totalValue, setTotalValue] = useState<number>(0);
  const [currentView, setCurrentView] = useState<"home" | "settings">("home");
  const [selectedVoucher, setSelectedVoucher] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [showBarcode, setShowBarcode] = useState<boolean>(false);
  const [barcodeData, setBarcodeData] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [user] = useState<string>("jewbaca1");
  const [lastScanTime, setLastScanTime] = useState<string>("");
  const [showSuccessAnimation, setShowSuccessAnimation] = useState<boolean>(false);
  const [touchFeedback, setTouchFeedback] = useState<string>("");

  // Haptic feedback (if available)
  const hapticFeedback = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if ('vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30]
      };
      navigator.vibrate(patterns[type]);
    }
  }, []);

  // Load voucher data on component mount
  useEffect(() => {
    loadVouchers();
  }, []);

  const loadVouchers = async () => {
    try {
      setLoading(true);
      console.log("Loading vouchers from API:", `${API_BASE}/vouchers/count`);

      const response = await fetch(`${API_BASE}/vouchers/count`);
      const data = await response.json();
      console.log("API Response:", data);

      if (data.success) {
        setVouchers(data.data.vouchers);
        setTotalValue(data.data.total_value);
        setError("");
        console.log("Vouchers loaded successfully:", data.data.vouchers);
      } else {
        throw new Error(data.message || "Failed to load vouchers");
      }
    } catch (err: any) {
      console.error("Error loading vouchers:", err);
      setError(`שגיאה בטעינת השוברים: ${err.message}`);

      // DON'T use fallback data - show empty state instead
      setVouchers({});
      setTotalValue(0);
    } finally {
      setLoading(false);
    }
  };

  const handleVoucherClick = async (amount: string): Promise<void> => {
    try {
      setLoading(true);
      hapticFeedback('medium');
      
      const response = await fetch(`${API_BASE}/vouchers/get`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amount,
          user: user,
        }),
      });

      const data = await response.json();

      if (data.success) {
        hapticFeedback('heavy');
        setBarcodeData(data.data.barcode);
        setSelectedVoucher(amount);
        setShowBarcode(true);
      } else {
        hapticFeedback('heavy');
        setError(data.message || `❌ אין שוברים זמינים על סך ${amount}₪`);
        setTimeout(() => setError(""), 4000);
      }
    } catch (err: any) {
      hapticFeedback('heavy');
      setError("❌ שגיאה בקבלת השובר");
      setTimeout(() => setError(""), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleVoucherUse = async (): Promise<void> => {
    if (!selectedVoucher) return;

    try {
      hapticFeedback('heavy');
      
      await fetch(`${API_BASE}/vouchers/use`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: selectedVoucher,
          user: user,
        }),
      });

      // Show success animation
      setShowSuccessAnimation(true);
      
      // Reload vouchers to get updated counts
      await loadVouchers();

      setShowBarcode(false);
      setSelectedVoucher(null);
      
      // Success message
      setError("✅ השובר סומן כמשומש בהצלחה!");
      setTimeout(() => {
        setError("");
        setShowSuccessAnimation(false);
      }, 3000);
      
    } catch (err: any) {
      hapticFeedback('heavy');
      setError("❌ שגיאה בעדכון השובר");
      setTimeout(() => setError(""), 4000);
    }
  };

  const handleVoucherCancel = (): void => {
    hapticFeedback('light');
    setShowBarcode(false);
    setSelectedVoucher(null);
  };

  const handleScan = async (type: string): Promise<void> => {
    setIsScanning(true);
    setError("");
    hapticFeedback('light');

    try {
      const endpoint = type === "10bis" ? "/scan/10bis" : "/scan/cibus";
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.data.added_count > 0) {
          hapticFeedback('heavy');
          setShowSuccessAnimation(true);
          setError(`🎉 נוספו ${data.data.added_count} שוברים חדשים!`);
          await loadVouchers(); // Reload vouchers
          setTimeout(() => setShowSuccessAnimation(false), 2000);
        } else {
          hapticFeedback('light');
          setError("ℹ️ לא נמצאו שוברים חדשים");
        }
        // Update last scan time
        setLastScanTime(new Date().toLocaleTimeString('he-IL', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }));
      } else {
        hapticFeedback('heavy');
        setError(data.message || "❌ שגיאה בסריקה");
      }
    } catch (err: any) {
      hapticFeedback('heavy');
      setError("❌ שגיאה בחיבור לשרת");
    } finally {
      setIsScanning(false);
      // Clear message after 5 seconds
      setTimeout(() => setError(""), 5000);
    }
  };

  const VoucherCard: React.FC<VoucherCardProps> = ({
    amount,
    count,
    onClick,
  }) => (
    <div
      className={`relative overflow-hidden rounded-3xl p-6 transition-all duration-300 transform ${
        count > 0
          ? "bg-white/95 backdrop-blur-xl border border-white/40 shadow-2xl cursor-pointer hover:scale-[1.02] hover:shadow-3xl active:scale-95"
          : "bg-gray-100/50 backdrop-blur-xl border border-gray-200/30 opacity-50"
      }`}
      onClick={() => {
        if (count > 0) {
          hapticFeedback('medium');
          setTouchFeedback(amount);
          setTimeout(() => setTouchFeedback(''), 200);
          onClick(amount);
        }
      }}
      style={{
        transform: touchFeedback === amount ? 'scale(0.95)' : 'scale(1)',
        boxShadow: count > 0 ? '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.3) inset' : undefined
      }}
    >
      {/* Enhanced glassmorphism with shimmer */}
      <div className='absolute inset-0 bg-gradient-to-br from-white/40 via-white/10 to-transparent opacity-80'></div>
      {count > 0 && (
        <div className='absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 animate-shimmer'></div>
      )}

      <div className='relative z-10 text-center'>
        <div className='flex items-center justify-center mb-3'>
          <Gift className='w-6 h-6 text-blue-500 mr-2' />
          <div className='text-3xl font-light text-gray-800'>₪{amount}</div>
        </div>
        <div className='text-sm font-medium text-gray-500 mb-4'>שובר דיגיטלי</div>
        <div
          className={`text-lg font-bold px-4 py-2 rounded-full transition-all duration-300 ${
            count > 0
              ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg"
              : "bg-gray-100 text-gray-400"
          }`}
        >
          {count > 0 ? (
            <div className='flex items-center justify-center gap-1'>
              <Star className='w-4 h-4' />
              {count} זמין
            </div>
          ) : (
            "אזל"
          )}
        </div>
      </div>

      {/* Availability indicator */}
      {count > 0 && (
        <div className='absolute top-3 right-3 w-3 h-3 bg-green-400 rounded-full shadow-lg animate-pulse'></div>
      )}
    </div>
  );

  const BarcodeDisplay: React.FC<BarcodeDisplayProps> = ({
    barcode,
    amount,
    onUse,
    onCancel,
  }) => (
    <div
      className='fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 z-50 animate-scale-up'
      style={{ backdropFilter: "blur(25px)" }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        className='bg-white/98 backdrop-blur-2xl rounded-3xl p-8 w-full max-w-lg border-2 border-white/50 shadow-3xl transform transition-all duration-500 animate-scale-up'
        style={{
          boxShadow: "0 50px 100px -20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.4) inset",
          background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)",
        }}
      >
        {/* Header with close button */}
        <div className='flex justify-between items-center mb-6'>
          <div className='flex items-center gap-3'>
            <div className='bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-xl'>
              <Gift className='w-6 h-6 text-white' />
            </div>
            <h3 className='text-2xl font-bold text-gray-800'>
              שובר דיגיטלי
            </h3>
          </div>
          <button
            onClick={onCancel}
            className='p-2 hover:bg-gray-100 rounded-xl transition-colors duration-200'
          >
            <XCircle className='w-6 h-6 text-gray-400' />
          </button>
        </div>

        {/* Amount Display */}
        <div className='text-center mb-8'>
          <div className='bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl p-4 mb-6'>
            <div className='text-4xl font-bold mb-2'>₪{amount}</div>
            <div className='text-blue-100 font-medium'>ערך השובר</div>
          </div>
        </div>

        {/* Enhanced Barcode Section */}
        <div className='bg-gradient-to-br from-gray-50 to-gray-100 backdrop-blur-sm rounded-3xl p-8 mb-8 border-2 border-gray-200/50 shadow-inner'>
          <div className='text-center mb-6'>
            <div className='text-sm font-bold text-gray-600 mb-2 uppercase tracking-wider'>קוד השובר</div>
            <div className='font-mono text-2xl text-gray-800 tracking-wider bg-white/70 rounded-xl p-3 border border-gray-200'>
              {barcode}
            </div>
          </div>

          {/* Enhanced Barcode Image */}
          <div className='bg-white rounded-2xl p-8 shadow-lg border-2 border-gray-100'>
            <img
              src={`${API_BASE.replace("/api", "")}/api/barcode/${barcode}`}
              alt='Barcode'
              className='w-full h-auto max-h-40 object-contain'
              style={{ minHeight: "100px" }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = "block";
              }}
            />
            <div className='hidden font-mono text-lg tracking-widest text-gray-800 text-center py-6 bg-gradient-to-r from-gray-800 to-black text-white rounded-xl'>
              ||||&nbsp;&nbsp;&nbsp;||&nbsp;&nbsp;&nbsp;||||&nbsp;&nbsp;&nbsp;||&nbsp;&nbsp;&nbsp;||||&nbsp;&nbsp;&nbsp;||&nbsp;&nbsp;&nbsp;||||&nbsp;&nbsp;&nbsp;||
            </div>
          </div>
          
          <div className='text-center mt-4 text-sm text-gray-500'>
            הצג את הברקוד לצורך תשלום
          </div>
        </div>

        {/* Enhanced Action Buttons */}
        <div className='text-center'>
          <p className='text-gray-700 mb-6 font-bold text-xl'>
            השתמשת בשובר? 🍽️
          </p>
          <div className='flex gap-4'>
            <button
              onClick={() => {
                hapticFeedback('heavy');
                onUse();
              }}
              className='flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-5 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all duration-300 transform hover:scale-[1.02] active:scale-95 shadow-2xl'
              style={{
                boxShadow: "0 20px 40px -12px rgba(34, 197, 94, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.3) inset",
              }}
            >
              <CheckCircle size={28} />
              <div>
                <div className='text-lg'>כן, השתמשתי!</div>
                <div className='text-xs opacity-90'>סמן כמשומש</div>
              </div>
            </button>
            <button
              onClick={() => {
                hapticFeedback('light');
                onCancel();
              }}
              className='flex-1 bg-white/95 backdrop-blur-xl text-gray-700 py-5 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all duration-300 transform hover:scale-[1.02] active:scale-95 border-2 border-gray-200 shadow-xl'
              style={{
                boxShadow: "0 15px 30px -10px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.5) inset",
              }}
            >
              <XCircle size={28} />
              <div>
                <div className='text-lg'>עוד לא</div>
                <div className='text-xs opacity-70'>שמור לימים אחרים</div>
              </div>
            </button>
          </div>
          
          <div className='mt-4 text-xs text-gray-500 bg-gray-50 rounded-xl p-3'>
            💡 טיפ: תוכל לשמור את השובר ולהשתמש בו מאוחר יותר
          </div>
        </div>
      </div>
    </div>
  );

  const HomeView: React.FC = () => (
    <div className='space-y-6'>
      {/* Error Display */}
      {error && (
        <div
          className={`p-4 rounded-2xl text-white text-center font-medium ${
            error.startsWith("✅")
              ? "bg-green-500/90"
              : error.startsWith("ℹ️")
              ? "bg-blue-500/90"
              : "bg-red-500/90"
          }`}
        >
          {error}
        </div>
      )}

      {/* Enhanced Header Card */}
      <div
        className='relative overflow-hidden rounded-3xl p-8 text-white animate-scale-up'
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
          boxShadow: "0 35px 70px -20px rgba(102, 126, 234, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.3) inset",
        }}
      >
        {/* Enhanced animated background elements */}
        <div className='absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-20 translate-x-20 animate-float'></div>
        <div className='absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-16 -translate-x-16 animate-float' style={{ animationDelay: '1s' }}></div>
        <div className='absolute top-1/2 left-1/2 w-24 h-24 bg-white/5 rounded-full -translate-x-12 -translate-y-12 animate-pulse'></div>

        <div className='relative z-10'>
          <div className='flex items-center justify-between mb-6'>
            <div>
              <h1 className='text-3xl font-bold mb-2 drop-shadow-lg'>BotFersal</h1>
              <p className='text-white/90 text-lg'>שלום {user}! 👋</p>
            </div>
            <div className='bg-white/20 backdrop-blur-sm rounded-2xl p-3'>
              <Wallet className='w-8 h-8 text-white drop-shadow-lg' />
            </div>
          </div>
          
          <div className='bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20'>
            <div className='flex items-center justify-between'>
              <div>
                <div className='text-4xl font-bold mb-2 drop-shadow-lg'>
                  ₪{totalValue.toLocaleString()}
                </div>
                <div className='text-white/90 font-semibold text-lg'>סה״כ שווי שוברים</div>
              </div>
              <div className='text-right'>
                <div className='text-2xl font-bold text-white/90'>
                  {Object.values(vouchers).reduce((sum, count) => sum + count, 0)}
                </div>
                <div className='text-white/70 text-sm'>סך שוברים</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Subtle shine effect */}
        <div className='absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-1000 animate-shimmer'></div>
      </div>

      {/* Enhanced Quick Actions */}
      <div className='space-y-4'>
        <div className='grid grid-cols-2 gap-4'>
          <button
            onClick={() => {
              hapticFeedback('medium');
              handleScan("10bis");
            }}
            disabled={isScanning}
            className='bg-gradient-to-br from-orange-500 to-red-600 text-white p-6 rounded-3xl font-bold flex flex-col items-center gap-3 transition-all duration-300 transform backdrop-blur-xl border border-orange-300/30 shadow-2xl hover:scale-[1.02] active:scale-95 disabled:opacity-50'
            style={{
              boxShadow: "0 25px 50px -12px rgba(255, 69, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.3) inset",
            }}
          >
            <div className='absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent opacity-60 rounded-3xl'></div>
            <div className='relative z-10 flex flex-col items-center gap-3'>
              <div className='bg-white/20 p-3 rounded-2xl backdrop-blur-sm'>
                {isScanning ? (
                  <div className='w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin'></div>
                ) : (
                  <Scan size={32} className='drop-shadow-lg' />
                )}
              </div>
              <div className='text-center'>
                <div className='text-lg font-bold mb-1'>
                  {isScanning ? "סורק..." : "10bis"}
                </div>
                <div className='text-xs opacity-90'>סריקת שוברים</div>
              </div>
            </div>
            {!isScanning && (
              <div className='absolute top-2 right-2'>
                <Zap className='w-5 h-5 text-yellow-300 animate-pulse' />
              </div>
            )}
          </button>

          <button
            onClick={() => {
              hapticFeedback('medium');
              handleScan("cibus");
            }}
            disabled={isScanning}
            className='bg-gradient-to-br from-green-500 to-emerald-600 text-white p-6 rounded-3xl font-bold flex flex-col items-center gap-3 transition-all duration-300 transform backdrop-blur-xl border border-green-300/30 shadow-2xl hover:scale-[1.02] active:scale-95 disabled:opacity-50'
            style={{
              boxShadow: "0 25px 50px -12px rgba(34, 197, 94, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.3) inset",
            }}
          >
            <div className='absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent opacity-60 rounded-3xl'></div>
            <div className='relative z-10 flex flex-col items-center gap-3'>
              <div className='bg-white/20 p-3 rounded-2xl backdrop-blur-sm'>
                {isScanning ? (
                  <div className='w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin'></div>
                ) : (
                  <Camera size={32} className='drop-shadow-lg' />
                )}
              </div>
              <div className='text-center'>
                <div className='text-lg font-bold mb-1'>
                  {isScanning ? "סורק..." : "Cibus"}
                </div>
                <div className='text-xs opacity-90'>סריקת שוברים</div>
              </div>
            </div>
            {!isScanning && (
              <div className='absolute top-2 right-2'>
                <Zap className='w-5 h-5 text-yellow-300 animate-pulse' />
              </div>
            )}
          </button>
        </div>
        
        {lastScanTime && (
          <div className='text-center text-sm text-gray-500 bg-white/50 backdrop-blur-sm rounded-2xl p-3 border border-white/30'>
            <TrendingUp className='w-4 h-4 inline mr-2' />
            סריקה אחרונה: {lastScanTime}
          </div>
        )}
      </div>

      {/* Vouchers Grid */}
      <div>
        <h2 className='text-xl font-light text-gray-800 mb-4 flex items-center gap-3'>
          <Wallet size={24} className='text-blue-600' />
          השוברים שלי
        </h2>
        {loading ? (
          <div className='text-center py-12'>
            <div className='relative mb-6'>
              {/* Enhanced loading animation */}
              <div className='w-20 h-20 border-4 border-blue-100 rounded-full animate-spin mx-auto'></div>
              <div className='absolute inset-0 w-20 h-20 border-4 border-transparent border-t-blue-500 border-r-purple-500 rounded-full animate-spin mx-auto' style={{ animation: 'spin 0.8s linear infinite reverse' }}></div>
              <div className='absolute inset-0 flex items-center justify-center'>
                <Wallet className='w-8 h-8 text-blue-500 animate-pulse' />
              </div>
            </div>
            
            <div className='space-y-2'>
              <h3 className='text-lg font-bold text-gray-700'>טוען שוברים...</h3>
              <p className='text-gray-500'>מעדכן את הנתונים שלך</p>
            </div>
            
            {/* Loading dots */}
            <div className='flex justify-center space-x-2 mt-6'>
              <div className='w-2 h-2 bg-blue-400 rounded-full animate-bounce'></div>
              <div className='w-2 h-2 bg-purple-400 rounded-full animate-bounce' style={{ animationDelay: '0.1s' }}></div>
              <div className='w-2 h-2 bg-blue-400 rounded-full animate-bounce' style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        ) : (
          <div className='grid grid-cols-2 gap-4'>
            {Object.entries(vouchers).map(([amount, count]) => (
              <VoucherCard
                key={amount}
                amount={amount}
                count={count}
                onClick={handleVoucherClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const SettingsView: React.FC = () => (
    <div className='space-y-8'>
      <h2 className='text-2xl font-light text-gray-800'>הגדרות</h2>

      <div
        className='bg-white/80 backdrop-blur-xl rounded-3xl p-8 border border-white/30 shadow-2xl space-y-6'
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)",
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.3) inset",
        }}
      >
        <div>
          <label className='block text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide'>
            משתמש
          </label>
          <input
            type='text'
            value={user}
            disabled
            className='w-full p-4 border border-gray-200/50 rounded-2xl bg-gray-50/80 backdrop-blur-sm font-medium text-gray-600'
          />
        </div>

        <div>
          <label className='block text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide'>
            API Endpoint
          </label>
          <input
            type='text'
            value={API_BASE}
            disabled
            className='w-full p-4 border border-gray-200/50 rounded-2xl bg-gray-50/80 backdrop-blur-sm font-medium text-gray-600 text-xs'
          />
        </div>

        <button
          onClick={loadVouchers}
          className='w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-xl'
          style={{
            boxShadow:
              "0 20px 40px -12px rgba(99, 102, 241, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.2) inset",
          }}
        >
          בדוק חיבור לשרת
        </button>
      </div>
    </div>
  );

  return (
    <div
      className='min-h-screen'
      style={{
        background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
      }}
      dir='rtl'
    >
      {/* Enhanced Bottom Navigation */}
      <div className='fixed bottom-0 left-0 right-0 z-40'>
        <div className='max-w-md mx-auto'>
          {/* Background blur with rounded top corners */}
          <div
            className='bg-white/95 backdrop-blur-2xl border-t-2 border-white/40 shadow-2xl rounded-t-3xl'
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.92) 100%)",
              boxShadow: "0 -10px 40px -10px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.4) inset"
            }}
          >
            <div className='flex items-center justify-around py-4 px-6'>
              <button
                onClick={() => {
                  hapticFeedback('light');
                  setCurrentView("home");
                }}
                className={`p-4 rounded-2xl transition-all duration-300 flex flex-col items-center gap-2 min-w-[70px] ${
                  currentView === "home"
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-xl scale-105"
                    : "text-gray-600 hover:bg-gray-100/80 hover:scale-105"
                }`}
                style={{
                  boxShadow: currentView === "home" ? "0 8px 25px -8px rgba(99, 102, 241, 0.4)" : undefined
                }}
              >
                <Home size={24} className={currentView === "home" ? "drop-shadow-sm" : ""} />
                <span className='text-xs font-bold'>בית</span>
                {currentView === "home" && (
                  <div className='absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse'></div>
                )}
              </button>

              <button
                onClick={() => {
                  hapticFeedback('medium');
                  loadVouchers();
                }}
                className='p-4 rounded-2xl text-gray-600 hover:bg-gradient-to-r hover:from-green-100 hover:to-blue-100 hover:text-blue-600 transition-all duration-300 flex flex-col items-center gap-2 hover:scale-105 min-w-[70px]'
              >
                <div className='relative'>
                  <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
                  {!loading && (
                    <div className='absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full animate-ping'></div>
                  )}
                </div>
                <span className='text-xs font-bold'>סריקת</span>
              </button>

              <button
                onClick={() => {
                  hapticFeedback('light');
                  setCurrentView("settings");
                }}
                className={`p-4 rounded-2xl transition-all duration-300 flex flex-col items-center gap-2 min-w-[70px] ${
                  currentView === "settings"
                    ? "bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-xl scale-105"
                    : "text-gray-600 hover:bg-gray-100/80 hover:scale-105"
                }`}
                style={{
                  boxShadow: currentView === "settings" ? "0 8px 25px -8px rgba(168, 85, 247, 0.4)" : undefined
                }}
              >
                <Settings size={24} className={currentView === "settings" ? "drop-shadow-sm" : ""} />
                <span className='text-xs font-bold'>הגדרות</span>
                {currentView === "settings" && (
                  <div className='absolute -top-1 -right-1 w-2 h-2 bg-pink-400 rounded-full animate-pulse'></div>
                )}
              </button>
            </div>
            
            {/* Home indicator line */}
            <div className='flex justify-center pb-2'>
              <div className='w-32 h-1 bg-gray-300 rounded-full'></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content with Bottom Padding for Enhanced Navbar */}
      <div className='max-w-md mx-auto p-6 pb-32'>
        {currentView === "home" && <HomeView />}
        {currentView === "settings" && <SettingsView />}
      </div>

      {/* Barcode Modal */}
      {showBarcode && selectedVoucher && (
        <BarcodeDisplay
          barcode={barcodeData}
          amount={selectedVoucher}
          onUse={handleVoucherUse}
          onCancel={handleVoucherCancel}
        />
      )}

      {/* Enhanced Loading Overlay */}
      {isScanning && (
        <div
          className='fixed inset-0 bg-black/40 backdrop-blur-2xl flex items-center justify-center z-50 animate-scale-up'
          style={{ backdropFilter: "blur(25px)" }}
        >
          <div
            className='bg-white/98 backdrop-blur-2xl rounded-3xl p-10 text-center border-2 border-white/40 shadow-3xl animate-float'
            style={{
              boxShadow: "0 50px 100px -20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.4) inset",
              background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)"
            }}
          >
            <div className='relative mb-6'>
              {/* Outer spinning ring */}
              <div className='w-20 h-20 border-4 border-blue-200 rounded-full animate-spin mx-auto'></div>
              {/* Inner spinning element */}
              <div className='absolute inset-0 w-20 h-20 border-4 border-transparent border-t-blue-600 border-r-purple-600 rounded-full animate-spin mx-auto' style={{ animation: 'spin 1s linear infinite reverse' }}></div>
              {/* Center pulse */}
              <div className='absolute inset-0 flex items-center justify-center'>
                <div className='w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-pulse'></div>
              </div>
            </div>
            
            <div className='space-y-3'>
              <h3 className='text-xl font-bold text-gray-800'>סורק שוברים...</h3>
              <p className='text-gray-600'>מחבר לשרת ומעדכן נתונים</p>
              
              {/* Progress indicators */}
              <div className='flex justify-center space-x-2 mt-4'>
                <div className='w-2 h-2 bg-blue-500 rounded-full animate-pulse' style={{ animationDelay: '0ms' }}></div>
                <div className='w-2 h-2 bg-purple-500 rounded-full animate-pulse' style={{ animationDelay: '200ms' }}></div>
                <div className='w-2 h-2 bg-blue-500 rounded-full animate-pulse' style={{ animationDelay: '400ms' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Success Animation Overlay */}
      {showSuccessAnimation && (
        <div
          className='fixed inset-0 bg-green-500/20 backdrop-blur-lg flex items-center justify-center z-50 animate-scale-up'
          style={{ backdropFilter: "blur(20px)" }}
        >
          <div
            className='bg-white/98 backdrop-blur-2xl rounded-3xl p-10 text-center border-2 border-green-200 shadow-3xl animate-scale-up'
            style={{
              boxShadow: "0 50px 100px -20px rgba(34, 197, 94, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.4) inset",
              background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 100%)"
            }}
          >
            <div className='relative mb-6'>
              {/* Success checkmark animation */}
              <div className='w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce'>
                <CheckCircle size={40} className='text-white drop-shadow-lg' />
              </div>
              
              {/* Celebration particles */}
              <div className='absolute -top-2 -left-2 w-4 h-4 bg-yellow-400 rounded-full animate-ping'></div>
              <div className='absolute -top-4 -right-1 w-3 h-3 bg-green-400 rounded-full animate-ping' style={{ animationDelay: '200ms' }}></div>
              <div className='absolute -bottom-2 -left-4 w-2 h-2 bg-blue-400 rounded-full animate-ping' style={{ animationDelay: '400ms' }}></div>
              <div className='absolute -bottom-4 -right-2 w-3 h-3 bg-purple-400 rounded-full animate-ping' style={{ animationDelay: '600ms' }}></div>
            </div>
            
            <div className='space-y-3'>
              <h3 className='text-2xl font-bold text-gray-800'>כל הכבוד! 🎉</h3>
              <p className='text-green-600 font-semibold'>הפעולה בוצעה בהצלחה</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
