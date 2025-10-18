import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useSwipeable } from "react-swipeable";
import {
  Camera,
  Scan,
  Wallet,
  CheckCircle,
  XCircle,
  TrendingUp,
  Gift,
  ShoppingCart,
  // Star,
} from "lucide-react";
import { SwipeableVoucherCard } from "./components/SwipeableVoucherCard";
import { PullToRefresh } from "./components/PullToRefresh";
import { ShareButton } from "./components/ShareButton";
import { GroceryView } from "./components/GroceryView";
import { useHapticFeedback } from "./hooks/useHapticFeedback";
import { GoogleAuth, useGoogleAuth } from "./auth/GoogleAuth";
import "./App.css";
import "./LiquidGlass.css";

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

// User mapping for API compatibility - RESTRICTED ACCESS
const mapGoogleUserToAPIUser = (email: string): string | null => {
  // Only these emails are allowed access
  const emailMap: { [key: string]: string } = {
    'gal.oiring@gmail.com': 'jewbaca1',
    'rinatmamo94@gmail.com': 'rinat_user',
  };

  // Return null if email is not authorized
  return emailMap[email] || null;
};

// Check if user is authorized
const isAuthorizedUser = (email: string): boolean => {
  const allowedEmails = ['gal.oiring@gmail.com', 'rinatmamo94@gmail.com'];
  return allowedEmails.includes(email);
};

const App: React.FC = () => {
  const [vouchers, setVouchers] = useState<VoucherCounts>({});
  const [totalValue, setTotalValue] = useState<number>(0);
  const [selectedVoucher, setSelectedVoucher] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [showBarcode, setShowBarcode] = useState<boolean>(false);
  const [barcodeData, setBarcodeData] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [user, setUser] = useState<string>("");
  const [lastScanTime, setLastScanTime] = useState<string>("");
  const [showSuccessAnimation, setShowSuccessAnimation] = useState<boolean>(false);
  // const [touchFeedback, setTouchFeedback] = useState<string>("");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'vouchers' | 'grocery'>('vouchers');

  // Google Authentication
  const { user: googleUser, isAuthenticated, isLoading: authLoading, signIn, signOut } = useGoogleAuth();

  // Enhanced haptic feedback
  const { hapticFeedback, patterns } = useHapticFeedback();

  // Handle Google Sign-In Success
  const handleGoogleSignIn = useCallback((googleUserData: any) => {
    // Check if user is authorized
    if (!isAuthorizedUser(googleUserData.email)) {
      setError(`❌ Access denied. Only authorized users can access this app.`);
      patterns.attention();
      setTimeout(() => setError(''), 5000);
      return;
    }

    const apiUser = mapGoogleUserToAPIUser(googleUserData.email);
    if (apiUser) {
      setUser(apiUser);
      signIn(googleUserData);
      patterns.celebration();
      console.log(`Authenticated as: ${googleUserData.name} (${apiUser})`);
    } else {
      setError(`❌ Your email is not authorized for this application.`);
      patterns.attention();
      setTimeout(() => setError(''), 5000);
    }
  }, [signIn, patterns]);

  // Handle Google Sign-In Error
  const handleGoogleSignInError = useCallback((error: string) => {
    console.error('Google Sign-In Error:', error);
    setError(`❌ Authentication failed: ${error}`);
    patterns.attention();
    setTimeout(() => setError(''), 5000);
  }, [patterns]);

  // Handle Sign Out
  const handleSignOut = useCallback(() => {
    signOut();
    setUser('');
    patterns.buttonTap();
  }, [signOut, patterns]);

  // Load voucher data and detect dark mode on component mount
  useEffect(() => {
    // Detect system dark mode preference
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    
    // Listen for changes in system preference
    const handleColorSchemeChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };
    
    darkModeQuery.addEventListener('change', handleColorSchemeChange);
    
    // Set user when Google auth is ready - check authorization
    if (isAuthenticated && googleUser) {
      if (!isAuthorizedUser(googleUser.email)) {
        // Sign out unauthorized user
        signOut();
        setError(`❌ Access denied. Your account is not authorized.`);
        patterns.attention();
        setTimeout(() => setError(''), 5000);
        return;
      }

      const apiUser = mapGoogleUserToAPIUser(googleUser.email);
      if (apiUser) {
        setUser(apiUser);
      }
    }
    
    return () => {
      darkModeQuery.removeEventListener('change', handleColorSchemeChange);
    };
  }, [isAuthenticated, googleUser, signOut, patterns]);
  
  // Load vouchers when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      loadVouchers();
    }
  }, [isAuthenticated, user]);

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
        patterns.voucherGet();
        setBarcodeData(data.data.barcode);
        setSelectedVoucher(amount);
        setShowBarcode(true);
      } else {
        patterns.noVouchers();
        setError(data.message || `❌ No vouchers available for ${amount}₪`);
        setTimeout(() => setError(""), 4000);
      }
    } catch (err: any) {
      patterns.connectionError();
      setError("❌ Error getting voucher");
      setTimeout(() => setError(""), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleVoucherUse = async (): Promise<void> => {
    if (!selectedVoucher) return;

    try {
      patterns.voucherUse();
      
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
      setError("✅ Voucher marked as used successfully!");
      setTimeout(() => {
        setError("");
        setShowSuccessAnimation(false);
      }, 3000);
      
    } catch (err: any) {
      patterns.connectionError();
      setError("❌ Error updating voucher");
      setTimeout(() => setError(""), 4000);
    }
  };

  const handleVoucherCancel = (): void => {
    patterns.buttonTap();
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
          patterns.scanComplete();
          setShowSuccessAnimation(true);
          
          // Show detailed info about new vouchers
          const voucherDetails = data.data.vouchers || {};
          const detailsText = Object.entries(voucherDetails)
            .filter(([_, count]) => (count as number) > 0)
            .map(([amount, count]) => `${count}x ${amount}₪`)
            .join(', ');
          
          setError(`🎉 Added ${data.data.added_count} new vouchers!${detailsText ? `\n${detailsText}` : ''}`);  
          await loadVouchers(); // Reload vouchers
          setTimeout(() => setShowSuccessAnimation(false), 2000);
        } else {
          patterns.buttonTap();
          setError("ℹ️ No new vouchers found");
        }
        // Update last scan time
        setLastScanTime(new Date().toLocaleTimeString('he-IL', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }));
      } else {
        patterns.scanError();
        setError(data.message || "❌ Scanning error");
      }
    } catch (err: any) {
      patterns.connectionError();
      setError("❌ Server connection error");
    } finally {
      setIsScanning(false);
      // Clear message after 5 seconds
      setTimeout(() => setError(""), 5000);
    }
  };

  const handleShare = (amount: string) => {
    // Share voucher info
    console.log('Sharing voucher:', amount);
  };

  const VoucherCard: React.FC<VoucherCardProps> = ({
    amount,
    count,
    onClick,
  }) => (
    <SwipeableVoucherCard
      amount={amount}
      count={count}
      onClick={onClick}
      onShare={handleShare}
      isDarkMode={isDarkMode}
      hapticFeedback={hapticFeedback}
    />
  );

  const BarcodeDisplay: React.FC<BarcodeDisplayProps> = ({
    barcode,
    amount,
    onUse,
    onCancel,
  }) => {
    const [swipeOffset, setSwipeOffset] = useState(0);

    const swipeHandlers = useSwipeable({
      onSwiping: (eventData) => {
        if (eventData.dir === 'Right') {
          const offset = Math.min(300, Math.max(0, eventData.deltaX));
          setSwipeOffset(offset);
        }
      },
      onSwipedRight: (eventData) => {
        if (eventData.deltaX > 150) {
          patterns.pageSwipe();
          onCancel();
        } else {
          setSwipeOffset(0);
        }
      },
      trackMouse: false,
      trackTouch: true,
    });

    return (
    <motion.div
      {...swipeHandlers}
      initial={{ x: 0 }}
      animate={{ x: swipeOffset }}
      exit={{ x: '100%' }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className='fixed inset-0 bg-gray-100 flex flex-col z-50'
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      {/* Swipe indicator overlay */}
      {swipeOffset > 0 && (
        <motion.div
          className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: Math.min(1, swipeOffset / 100) }}
        >
          <div className="bg-black/20 rounded-full p-3 backdrop-blur-sm">
            <XCircle className="w-6 h-6 text-white" />
          </div>
        </motion.div>
      )}

      {/* Status bar area - iOS style */}
      <div className='h-12 bg-green-500 w-full'></div>

      <div className='flex-1 bg-gray-100 flex flex-col'>
        {/* Header with X button */}
        <div className='flex items-center justify-between p-4 bg-white border-b border-gray-200'>
          <div className='flex items-center gap-3'>
            <div className='bg-blue-500 p-2 rounded-lg'>
              <Gift className='w-6 h-6 text-white' />
            </div>
            <h3 className='text-xl font-semibold text-gray-900'>
              Voucher
            </h3>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              patterns.buttonTap();
              onCancel();
            }}
            className='w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors'
          >
            <XCircle className='w-6 h-6 text-gray-600' />
          </motion.button>
        </div>

        {/* Content */}
        <div className='flex-1 p-6'>

          {/* Amount Display */}
          <div className='text-center mb-8'>
            <div className='bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-3xl p-6'>
              <div className='text-5xl font-bold mb-2'>₪{amount}</div>
              <div className='text-blue-100 text-lg'>Voucher Value</div>
            </div>
          </div>

          {/* Large Barcode Display */}
          <div className='bg-white rounded-3xl p-8 mb-8 shadow-sm'>
            <div className='bg-white p-6'>
              <img
                src={`${API_BASE.replace("/api", "")}/api/barcode/${barcode}`}
                alt='Barcode'
                className='w-full h-auto object-contain mx-auto'
                style={{ minHeight: "120px", maxHeight: "200px" }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = "block";
                }}
              />
              <div className='hidden font-mono text-xl tracking-widest text-black text-center py-8 bg-white'>
                ||||&nbsp;&nbsp;&nbsp;||&nbsp;&nbsp;&nbsp;||||&nbsp;&nbsp;&nbsp;||&nbsp;&nbsp;&nbsp;||||&nbsp;&nbsp;&nbsp;||&nbsp;&nbsp;&nbsp;||||&nbsp;&nbsp;&nbsp;||
              </div>
              
              {/* Barcode number */}
              <div className='text-center mt-4 text-sm font-mono text-gray-700'>
                {barcode}
              </div>
            </div>
            
            <div className='text-center mt-4'>
              <div className='flex items-center justify-center gap-2 text-gray-600'>
                <div className='w-6 h-6 bg-gray-200 rounded flex items-center justify-center'>
                  🛒
                </div>
                <span className='font-medium'>Show barcode for payment</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className='text-center'>
            <p className='text-gray-700 mb-6 text-lg font-medium'>
              Did you use the voucher? 🍽️
            </p>
            <div className='flex gap-4'>
              <button
                onClick={() => {
                  patterns.voucherUse();
                  onUse();
                }}
                className='flex-1 bg-green-500 text-white py-6 px-6 rounded-2xl font-semibold flex flex-col items-center justify-center gap-2 transition-all duration-200 active:scale-95'
              >
                <CheckCircle size={24} />
                <div>
                  <div className='text-lg'>Yes, I used it!</div>
                  <div className='text-sm opacity-90'>Mark as used</div>
                </div>
              </button>
              <button
                onClick={() => {
                  patterns.buttonTap();
                  onCancel();
                }}
                className='flex-1 bg-white text-gray-700 py-6 px-6 rounded-2xl font-semibold flex flex-col items-center justify-center gap-2 transition-all duration-200 active:scale-95 border border-gray-300'
              >
                <XCircle size={24} />
                <div>
                  <div className='text-lg'>Not yet</div>
                  <div className='text-sm opacity-70'>Save for later</div>
                </div>
              </button>
            </div>
            
            <div className='mt-6 text-sm text-gray-500 bg-yellow-50 rounded-xl p-4 border border-yellow-200'>
              💡 Tip: You can save the voucher and use it later
            </div>
          </div>
        </div>
      </div>
    </motion.div>
    );
  };

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

      {/* Header Card */}
      <div
        className='relative overflow-hidden rounded-3xl p-6 text-white mb-6'
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          boxShadow: "0 8px 32px -8px rgba(102, 126, 234, 0.3)",
        }}
      >
        <div className='flex items-center justify-between mb-6'>
          <div>
            <p className='text-white/80 text-sm'>Hello, {googleUser?.name?.split(' ')[0] || (user === 'jewbaca1' ? 'Gal' : 'Rinat')}</p>
          </div>
          <div className='cursor-pointer' onClick={handleSignOut}>
            {googleUser?.picture ? (
              <img src={googleUser.picture} alt="Profile" className='w-8 h-8 rounded-full border-2 border-white/20' />
            ) : (
              <div className='w-8 h-8 bg-white/20 rounded-full flex items-center justify-center'>
                <Wallet className='w-4 h-4 text-white' />
              </div>
            )}
          </div>
        </div>

        <div className='flex items-end justify-between'>
          <div>
            <div className='text-3xl font-bold mb-1'>
              ₪{totalValue.toLocaleString()}
            </div>
            <div className='text-white/80 text-sm'>Total Value</div>
          </div>
          <div className='text-right'>
            <div className='text-2xl font-bold'>
              {Object.values(vouchers).reduce((sum, count) => sum + count, 0)}
            </div>
            <div className='text-white/80 text-sm'>vouchers available</div>
          </div>
        </div>
      </div>

      {/* Vouchers Grid */}
      <div className='flex-1 overflow-hidden'>
        <h2 className={`text-base font-medium mb-3 flex items-center gap-2 ${
          isDarkMode ? 'text-white' : 'text-gray-800'
        }`}>
          <Gift size={18} className='text-blue-600' />
          My Vouchers
        </h2>
        {loading ? (
          <div className='text-center py-8'>
            <div className='w-10 h-10 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin mx-auto mb-3'></div>
            <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>Loading vouchers...</p>
          </div>
        ) : (
          <PullToRefresh onRefresh={loadVouchers}>
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
          </PullToRefresh>
        )}
      </div>
    </div>
  );



  // Google Sign-In Screen
  const SignInScreen: React.FC = () => (
    <div className='flex items-center justify-center min-h-screen p-6'>
      <div
        className={`max-w-sm w-full rounded-3xl p-8 backdrop-blur-xl border shadow-2xl ${
          isDarkMode
            ? 'bg-gray-800/95 border-gray-700/50'
            : 'bg-white/95 border-white/50'
        }`}
      >
        {/* Logo/Header */}
        <div className='text-center mb-8'>
          <div className='bg-gradient-to-r from-blue-500 to-purple-600 p-4 rounded-2xl w-16 h-16 mx-auto mb-4 flex items-center justify-center'>
            <Wallet className='w-8 h-8 text-white' />
          </div>
          <h1 className={`text-2xl font-bold mb-2 ${
            isDarkMode ? 'text-white' : 'text-gray-800'
          }`}>BotFersal</h1>
          <p className={`text-sm ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>Sign in to access your vouchers</p>
          <p className={`text-xs mt-2 ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            🔒 Authorized emails only:
            <br />gal.oiring@gmail.com
            <br />rinatmamo94@gmail.com
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className='p-3 rounded-2xl text-white text-center font-medium mb-4 bg-red-500/90'>
            {error}
          </div>
        )}

        {/* Google Sign-In */}
        <div className='space-y-4'>
          <GoogleAuth
            onSuccess={handleGoogleSignIn}
            onError={handleGoogleSignInError}
          />
        </div>

        {/* Info */}
        <div className='mt-6 text-center'>
          <p className={`text-xs ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            🔒 Secure sign-in with Google
          </p>
          <p className={`text-xs mt-1 ${
            isDarkMode ? 'text-gray-500' : 'text-gray-400'
          }`}>
            No more device limits!
          </p>
        </div>
      </div>
    </div>
  );

  // Show sign-in screen if not authenticated
  if (!isAuthenticated) {
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
        dir='ltr'
      >
        <SignInScreen />
      </div>
    );
  }

  // Show loading if auth is still initializing
  if (authLoading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
          isDarkMode ? 'bg-gray-900' : ''
        }`}
        style={{
          background: isDarkMode
            ? "linear-gradient(135deg, #1f2937 0%, #111827 100%)"
            : "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
        }}
        dir='ltr'
      >
        <div className='text-center'>
          <div className='w-16 h-16 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin mx-auto mb-4'></div>
          <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Loading...</p>
        </div>
      </div>
    );
  }

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
      dir='ltr'
    >
      {/* Bottom Section with Scan Buttons */}
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
                Last scan: {lastScanTime}
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
            <div className='px-6 py-6'>
              {/* Scan Buttons */}
              <div className='grid grid-cols-2 gap-4'>
                <button
                  onClick={() => {
                    patterns.buttonTap();
                    handleScan("10bis");
                  }}
                  disabled={isScanning}
                  className='bg-gradient-to-br from-orange-500 to-red-600 text-white p-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all duration-300 transform shadow-lg hover:scale-[1.02] active:scale-95 disabled:opacity-50'
                >
                  <div className='bg-white/20 p-2 rounded-xl'>
                    {isScanning ? (
                      <div className='w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                    ) : (
                      <Scan size={20} />
                    )}
                  </div>
                  <div className='text-base font-bold'>
                    {isScanning ? "Scanning..." : "10bis"}
                  </div>
                </button>

                <button
                  onClick={() => {
                    patterns.buttonTap();
                    handleScan("cibus");
                  }}
                  disabled={isScanning}
                  className='bg-gradient-to-br from-green-500 to-emerald-600 text-white p-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all duration-300 transform shadow-lg hover:scale-[1.02] active:scale-95 disabled:opacity-50'
                >
                  <div className='bg-white/20 p-2 rounded-xl'>
                    {isScanning ? (
                      <div className='w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                    ) : (
                      <Camera size={20} />
                    )}
                  </div>
                  <div className='text-base font-bold'>
                    {isScanning ? "Scanning..." : "Cibus"}
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
        <div className='flex-1 px-6 pt-6 pb-4 overflow-hidden flex flex-col'>
          {/* Tab Switcher */}
          <div className={`flex gap-2 mb-4 p-1 rounded-2xl ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          } shadow-sm`}>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                patterns.buttonTap();
                setActiveTab('vouchers');
              }}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                activeTab === 'vouchers'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md'
                  : isDarkMode
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Gift size={18} />
              Vouchers
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                patterns.buttonTap();
                setActiveTab('grocery');
              }}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                activeTab === 'grocery'
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md'
                  : isDarkMode
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ShoppingCart size={18} />
              Grocery
            </motion.button>
          </div>

          {/* Tab Content */}
          <div className='flex-1 overflow-hidden'>
            {activeTab === 'vouchers' ? (
              <HomeView />
            ) : (
              <GroceryView
                user={user}
                apiBase={API_BASE}
                isDarkMode={isDarkMode}
                hapticFeedback={hapticFeedback}
                onError={setError}
              />
            )}
          </div>
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
              <h3 className='text-xl font-bold text-gray-800'>Scanning vouchers...</h3>
              <p className='text-gray-600'>Connecting to server and updating data</p>
              
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
              <h3 className='text-2xl font-bold text-gray-800'>Well done! 🎉</h3>
              <p className='text-green-600 font-semibold'>Operation completed successfully</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
