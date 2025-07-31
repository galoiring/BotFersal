import React, { useState, useEffect, useCallback } from "react";
import {
  Camera,
  Scan,
  Wallet,
  RefreshCw,
  CheckCircle,
  XCircle,
  TrendingUp,
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
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

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

  // Load voucher data and detect dark mode on component mount
  useEffect(() => {
    loadVouchers();
    
    // Detect system dark mode preference
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    
    // Listen for changes in system preference
    const handleColorSchemeChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };
    
    darkModeQuery.addEventListener('change', handleColorSchemeChange);
    
    return () => {
      darkModeQuery.removeEventListener('change', handleColorSchemeChange);
    };
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
      className={`relative overflow-hidden rounded-2xl p-4 transition-all duration-300 transform ${
        count > 0
          ? isDarkMode
            ? "bg-gray-800/95 backdrop-blur-xl border border-gray-700/40 shadow-lg cursor-pointer hover:scale-[1.02] active:scale-95"
            : "bg-white/95 backdrop-blur-xl border border-white/40 shadow-lg cursor-pointer hover:scale-[1.02] active:scale-95"
          : isDarkMode
            ? "bg-gray-900/50 backdrop-blur-xl border border-gray-800/30 opacity-50"
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
        boxShadow: count > 0 ? 
          isDarkMode 
            ? '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset'
            : '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.2) inset'
          : undefined
      }}
    >
      {/* Enhanced glassmorphism */}
      <div className={`absolute inset-0 bg-gradient-to-br opacity-60 ${
        isDarkMode 
          ? 'from-white/5 via-white/2 to-transparent'
          : 'from-white/30 via-white/10 to-transparent'
      }`}></div>

      <div className='relative z-10 text-center'>
        <div className='flex items-center justify-center mb-2'>
          <Gift className='w-4 h-4 text-blue-500 mr-1' />
          <div className={`text-xl font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>₪{amount}</div>
        </div>
        <div className={`text-xs font-medium mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>שובר דיגיטלי</div>
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
              {count} זמין
            </div>
          ) : (
            "אזל"
          )}
        </div>
      </div>

      {/* Availability indicator */}
      {count > 0 && (
        <div className='absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full shadow-sm animate-pulse'></div>
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
    <div className='flex flex-col h-full'>
      {/* Error Display */}
      {error && (
        <div
          className={`p-3 rounded-2xl text-white text-center font-medium mb-3 ${
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

      {/* Compact Header */}
      <div
        className='relative overflow-hidden rounded-2xl p-4 text-white mb-4'
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
          boxShadow: "0 10px 25px -5px rgba(102, 126, 234, 0.3)",
        }}
      >
        <div className='relative z-10'>
          <div className='flex items-center justify-between mb-2'>
            <div>
              <h1 className='text-lg font-bold'>BotFersal</h1>
              <p className='text-white/90 text-sm'>שלום {user}! 👋</p>
            </div>
            <div className='bg-white/20 backdrop-blur-sm rounded-xl p-2'>
              <Wallet className='w-4 h-4 text-white' />
            </div>
          </div>
          
          <div className='bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20'>
            <div className='flex items-center justify-between'>
              <div>
                <div className='text-base font-bold'>
                  ₪{totalValue.toLocaleString()}
                </div>
                <div className='text-white/90 text-xs'>סה״כ שווי</div>
              </div>
              <div className='text-right'>
                <div className='text-base font-bold text-white/90'>
                  {Object.values(vouchers).reduce((sum, count) => sum + count, 0)}
                </div>
                <div className='text-white/70 text-xs'>שוברים</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vouchers Grid */}
      <div className='flex-1 overflow-y-auto'>
        <h2 className={`text-base font-medium mb-3 flex items-center gap-2 ${
          isDarkMode ? 'text-white' : 'text-gray-800'
        }`}>
          <Gift size={18} className='text-blue-600' />
          השוברים שלי
        </h2>
        {loading ? (
          <div className='text-center py-8'>
            <div className='w-10 h-10 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin mx-auto mb-3'></div>
            <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>טוען שוברים...</p>
          </div>
        ) : (
          <div className='grid grid-cols-2 gap-3 pb-4'>
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



  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDarkMode ? 'bg-gray-900' : ''
      }`}
      style={{
        background: isDarkMode 
          ? "linear-gradient(135deg, #1f2937 0%, #111827 100%)"
          : "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
      }}
      dir='rtl'
    >
      {/* Bottom Section with Refresh and Scan Buttons */}
      <div className='fixed bottom-0 left-0 right-0 z-40'>
        <div className='max-w-md mx-auto'>
          {/* Scan Last Time Info */}
          {lastScanTime && (
            <div className='px-6 pb-2'>
              <div className={`text-center text-xs p-2 rounded-xl ${
                isDarkMode 
                  ? 'text-gray-300 bg-gray-800/70 border border-gray-700/30' 
                  : 'text-gray-500 bg-white/70 border border-white/30'
              } backdrop-blur-sm`}>
                <TrendingUp className='w-3 h-3 inline mr-1' />
                סריקה אחרונה: {lastScanTime}
              </div>
            </div>
          )}

          {/* Background with blur */}
          <div
            className={`backdrop-blur-xl border-t shadow-2xl ${
              isDarkMode 
                ? 'bg-gray-900/95 border-gray-700/50'
                : 'bg-white/95 border-white/50'
            }`}
          >
            <div className='px-6 pt-4 pb-6'>
              {/* Refresh Button */}
              <div className='flex justify-center mb-4'>
                <button
                  onClick={() => {
                    hapticFeedback('light');
                    loadVouchers();
                  }}
                  className={`backdrop-blur-sm p-3 rounded-full shadow-lg border hover:scale-105 transition-all duration-200 ${
                    isDarkMode 
                      ? 'bg-gray-800/80 border-gray-700/50 hover:bg-gray-700/80'
                      : 'bg-white/80 border-white/50 hover:bg-white/90'
                  }`}
                >
                  <RefreshCw size={18} className={`${loading ? 'animate-spin' : ''} ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`} />
                </button>
              </div>

              {/* Scan Buttons */}
              <div className='grid grid-cols-2 gap-3'>
                <button
                  onClick={() => {
                    hapticFeedback('medium');
                    handleScan("10bis");
                  }}
                  disabled={isScanning}
                  className='bg-gradient-to-br from-orange-500 to-red-600 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all duration-300 transform shadow-lg hover:scale-[1.02] active:scale-95 disabled:opacity-50'
                >
                  <div className='bg-white/20 p-2 rounded-xl'>
                    {isScanning ? (
                      <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                    ) : (
                      <Scan size={18} />
                    )}
                  </div>
                  <div className='text-sm font-bold'>
                    {isScanning ? "סורק..." : "10bis"}
                  </div>
                </button>

                <button
                  onClick={() => {
                    hapticFeedback('medium');
                    handleScan("cibus");
                  }}
                  disabled={isScanning}
                  className='bg-gradient-to-br from-green-500 to-emerald-600 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all duration-300 transform shadow-lg hover:scale-[1.02] active:scale-95 disabled:opacity-50'
                >
                  <div className='bg-white/20 p-2 rounded-xl'>
                    {isScanning ? (
                      <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                    ) : (
                      <Camera size={18} />
                    )}
                  </div>
                  <div className='text-sm font-bold'>
                    {isScanning ? "סורק..." : "Cibus"}
                  </div>
                </button>
              </div>
            </div>
            
            {/* Home indicator */}
            <div className='flex justify-center pb-2'>
              <div className={`w-32 h-1 rounded-full ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
              }`}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className='max-w-md mx-auto h-screen flex flex-col'>
        <div className='flex-1 px-6 pt-6 pb-4 overflow-hidden'>
          <HomeView />
        </div>
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
