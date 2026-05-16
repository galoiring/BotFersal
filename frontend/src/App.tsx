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
import { PullToRefresh } from "./components/PullToRefresh";
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
  const [scanResults, setScanResults] = useState<{count: number, details: string} | null>(null);
  // const [touchFeedback, setTouchFeedback] = useState<string>("");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'vouchers' | 'grocery'>(() => {
    const saved = localStorage.getItem('botfersal:activeTab');
    return saved === 'grocery' ? 'grocery' : 'vouchers';
  });

  useEffect(() => {
    localStorage.setItem('botfersal:activeTab', activeTab);
  }, [activeTab]);

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

      // Close immediately so the user can scan the next voucher.
      // Haptic + brief inline banner is enough confirmation;
      // skip the fullscreen success modal which blocks rapid back-to-back scans.
      setShowBarcode(false);

      // Optimistically decrement the count so the UI reflects the use immediately.
      // loadVouchers() reconciles below in case the server disagrees.
      const usedAmount = selectedVoucher;
      setVouchers(prev => ({
        ...prev,
        [usedAmount]: Math.max(0, (prev[usedAmount] ?? 0) - 1),
      }));
      setSelectedVoucher(null);

      setError("✅ Used");
      setTimeout(() => setError(""), 1200);

      loadVouchers();
      
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

          // Show detailed info about new vouchers
          const voucherDetails = data.data.vouchers || {};
          const detailsText = Object.entries(voucherDetails)
            .filter(([_, count]) => (count as number) > 0)
            .map(([amount, count]) => `${count}x ${amount}₪`)
            .join(', ');

          // Store scan results for success modal
          setScanResults({
            count: data.data.added_count,
            details: detailsText
          });

          setShowSuccessAnimation(true);
          setError(`🎉 Added ${data.data.added_count} new vouchers!${detailsText ? `\n${detailsText}` : ''}`);
          await loadVouchers(); // Reload vouchers
          setTimeout(() => {
            setShowSuccessAnimation(false);
            setScanResults(null);
          }, 1500);
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

      {/* Balance Banner (Smaller) */}
      <div className='balanceBanner mb-4'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='greeting'>Hello, {googleUser?.name?.split(' ')[0] || (user === 'jewbaca1' ? 'Gal' : 'Rinat')}</p>
            <div className='flex items-baseline gap-1'>
              <span className='amount'>₪{totalValue.toLocaleString()}</span>
              <span className='label'>available</span>
            </div>
          </div>

          {/* Refresh Chip */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              patterns.buttonTap();
              loadVouchers();
            }}
            className='refreshBtn'
          >
            <svg className='w-5 h-5 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'></path>
            </svg>
          </motion.button>
        </div>
      </div>

      {/* Section Header */}
      <div className='flex items-center justify-between mb-4'>
        <h2 className='text-sm font-semibold text-text'>My Vouchers</h2>
        <span className='text-xs text-text-muted'>
          {Object.values(vouchers).reduce((sum, count) => sum + count, 0)} available
        </span>
      </div>

      {/* Vouchers Grid (2 Columns) */}
      <div className='flex-1 overflow-hidden'>
        {loading ? (
          <div className='text-center py-8'>
            <div className='w-10 h-10 border-4 border-accent/20 border-t-accent rounded-full animate-spin mx-auto mb-3'></div>
            <p className='text-sm text-text-muted'>Loading vouchers...</p>
          </div>
        ) : (
          <PullToRefresh onRefresh={loadVouchers}>
            <div className='grid grid-cols-2 gap-3 pb-4'>
              {Object.entries(vouchers).map(([amount, count]) => (
                <motion.button
                  key={amount}
                  whileTap={count > 0 ? { scale: 0.99 } : {}}
                  onClick={() => count > 0 && handleVoucherClick(amount)}
                  disabled={count === 0}
                  className={`voucherTile group ${count === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {/* Availability Dot */}
                  {count > 0 && <div className='availability' />}

                  {/* Value */}
                  <div className='relative'>
                    <div className='value'>₪{amount}</div>
                    <div className='count'>
                      {count} {count === 1 ? 'voucher' : 'vouchers'}
                    </div>
                  </div>
                </motion.button>
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

          {/* DEV MODE: Quick login bypass for testing */}
          {process.env.NODE_ENV === 'development' && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const devUser = {
                  id: 'dev-user',
                  name: 'Gal (Dev Mode)',
                  email: 'gal.oiring@gmail.com',
                  picture: ''
                };
                handleGoogleSignIn(devUser);
              }}
              className='w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-2xl font-medium hover:from-purple-600 hover:to-indigo-700 transition-all'
            >
              🔧 Dev Mode Sign In
            </motion.button>
          )}
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
        className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'dark' : ''}`}
        style={{
          background: "var(--grad-bg)",
          backgroundSize: isDarkMode ? "100% 100%" : "400% 400%",
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
        className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${isDarkMode ? 'dark' : ''}`}
        style={{
          background: "var(--grad-bg)",
          backgroundSize: isDarkMode ? "100% 100%" : "400% 400%",
        }}
        dir='ltr'
      >
        <div className='text-center'>
          <div className='w-16 h-16 border-4 border-accent/20 border-t-accent rounded-full animate-spin mx-auto mb-4'></div>
          <p className='text-text-muted'>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'dark' : ''}`}
      style={{
        background: "var(--grad-bg)",
        backgroundSize: isDarkMode ? "100% 100%" : "400% 400%",
      }}
      dir='ltr'
    >
      {/* Bottom Section with Scan Buttons - Only show on vouchers tab */}
      {activeTab === 'vouchers' && (
        <div className='fixed bottom-0 left-0 right-0 z-40'>
          <div className='max-w-md mx-auto'>
            {/* Scan Last Time Info */}
            {lastScanTime && (
              <div className='px-6 pb-2'>
                <div className={`text-center text-xs p-2 rounded-xl backdrop-blur-sm ${
                  isDarkMode
                    ? 'text-gray-300 bg-gray-800/70 border border-gray-700/30'
                    : 'text-gray-700 bg-white/90 border border-gray-300/50 shadow-sm'
                }`}>
                  <TrendingUp className='w-3 h-3 inline mr-1' />
                  Last scan: {lastScanTime}
                </div>
              </div>
            )}

            {/* Background with blur */}
            <div
              className={`backdrop-blur-xl border-t ${
                isDarkMode
                  ? 'bg-gray-900/95 border-gray-700/50 shadow-2xl'
                  : 'bg-gradient-to-b from-white/98 to-gray-50/98 border-gray-200/80 shadow-lg'
              }`}
            >
              <div className='px-6 py-4'>
                {/* Section Header */}
                <p className='text-xs font-semibold text-text-muted mb-3'>Scan for New Vouchers</p>

                {/* Scan Buttons */}
                <div className='grid grid-cols-2 gap-4'>
                  <motion.button
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      patterns.buttonTap();
                      handleScan("10bis");
                    }}
                    disabled={isScanning}
                    className='providerBtn tenbis disabled:opacity-50'
                  >
                    <div className='icon'>
                      {isScanning ? (
                        <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                      ) : (
                        <Scan size={20} />
                      )}
                    </div>
                    <span>{isScanning ? "Scanning..." : "10bis"}</span>
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      patterns.buttonTap();
                      handleScan("cibus");
                    }}
                    disabled={isScanning}
                    className='providerBtn cibus disabled:opacity-50'
                  >
                    <div className='icon'>
                      {isScanning ? (
                        <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                      ) : (
                        <Camera size={20} />
                      )}
                    </div>
                    <span>{isScanning ? "Scanning..." : "Cibus"}</span>
                  </motion.button>
                </div>
              </div>

              {/* Home indicator */}
              <div className='flex justify-center pb-2'>
                <div className={`w-32 h-1 rounded-full ${
                  isDarkMode ? 'bg-gray-600' : 'bg-gray-400'
                }`}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className='max-w-md mx-auto h-screen flex flex-col'>
        <div className='flex-1 px-6 pt-4 pb-4 overflow-hidden flex flex-col'>
          {/* Tab Switcher - iOS 26 Liquid Glass Style */}
          <div className="tabs mb-5">
            {/* Liquid Glass Indicator */}
            <motion.div
              layoutId="tab-indicator"
              className="absolute top-1 bottom-1 rounded-xl"
              style={{
                background: "var(--grad-tabs)",
                backdropFilter: 'blur(20px) saturate(180%)',
                boxShadow: '0 8px 24px -8px rgba(var(--accent), 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.2)',
                width: 'calc(50% - 4px)',
                left: activeTab === 'vouchers' ? '4px' : 'calc(50% + 4px)',
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 35,
              }}
            />

            {/* Tab Buttons */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                patterns.buttonTap();
                setActiveTab('vouchers');
              }}
              className={`tabBase ${activeTab === 'vouchers' ? 'tabActive' : 'tabInactive'}`}
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
              className={`tabBase ${activeTab === 'grocery' ? 'tabActive' : 'tabInactive'}`}
            >
              <ShoppingCart size={18} />
              Grocery
            </motion.button>
          </div>

          {/* Tab Content - No animation, instant switch */}
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

      {/* Enhanced Liquid Glass Loading Modal */}
      {isScanning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className='fixed inset-0 flex items-center justify-center z-50'
          style={{
            background: isDarkMode
              ? 'rgba(17, 24, 39, 0.8)'
              : 'rgba(255, 255, 255, 0.3)',
            backdropFilter: 'blur(40px) saturate(180%)',
          }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className='relative max-w-sm w-full mx-4'
            style={{
              background: isDarkMode
                ? 'rgba(31, 41, 55, 0.7)'
                : 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(60px) saturate(200%)',
              borderRadius: '32px',
              border: isDarkMode
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(255, 255, 255, 0.4)',
              boxShadow: isDarkMode
                ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)'
                : '0 25px 50px -12px rgba(0, 0, 0, 0.25), inset 0 1px 0 0 rgba(255, 255, 255, 0.6)',
            }}
          >
            {/* Specular highlight */}
            <div
              className='absolute top-0 left-1/4 right-1/4 h-20 rounded-full opacity-60'
              style={{
                background: 'radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, transparent 70%)',
                filter: 'blur(20px)',
              }}
            />

            <div className='relative p-8 text-center'>
              {/* Animated Scanner Icon */}
              <div className='relative mb-6 flex justify-center'>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className='w-20 h-20 rounded-full flex items-center justify-center'
                  style={{
                    background: isDarkMode
                      ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(139, 92, 246, 0.3))'
                      : 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
                    border: isDarkMode
                      ? '2px solid rgba(139, 92, 246, 0.5)'
                      : '2px solid rgba(139, 92, 246, 0.3)',
                  }}
                >
                  <Scan className={`w-10 h-10 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
                </motion.div>
              </div>

              <h3 className={`text-2xl font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Scanning Vouchers
              </h3>
              <p className={`text-base mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Checking your inbox for new vouchers...
              </p>

              {/* Progress dots */}
              <div className='flex justify-center space-x-2'>
                {[0, 200, 400].map((delay, i) => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: delay / 1000 }}
                    className='w-2 h-2 rounded-full'
                    style={{
                      background: isDarkMode
                        ? 'linear-gradient(135deg, #818cf8, #a78bfa)'
                        : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      
      {/* Success Animation - Liquid Glass Style */}
      {showSuccessAnimation && scanResults && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className='fixed inset-0 flex items-center justify-center z-50'
          style={{
            background: isDarkMode
              ? 'rgba(6, 78, 59, 0.4)'
              : 'rgba(134, 239, 172, 0.3)',
            backdropFilter: 'blur(40px) saturate(180%)',
          }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className='relative max-w-sm w-full mx-4'
            style={{
              background: isDarkMode
                ? 'rgba(6, 78, 59, 0.7)'
                : 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(60px) saturate(200%)',
              borderRadius: '32px',
              border: isDarkMode
                ? '1px solid rgba(134, 239, 172, 0.3)'
                : '1px solid rgba(134, 239, 172, 0.4)',
              boxShadow: isDarkMode
                ? '0 25px 50px -12px rgba(34, 197, 94, 0.5), inset 0 1px 0 0 rgba(134, 239, 172, 0.2)'
                : '0 25px 50px -12px rgba(34, 197, 94, 0.3), inset 0 1px 0 0 rgba(255, 255, 255, 0.6)',
            }}
          >
            {/* Specular highlight */}
            <div
              className='absolute top-0 left-1/4 right-1/4 h-20 rounded-full opacity-60'
              style={{
                background: 'radial-gradient(circle, rgba(134, 239, 172, 0.6) 0%, transparent 70%)',
                filter: 'blur(20px)',
              }}
            />

            {/* Celebration particles */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className='absolute -top-2 -left-2 w-3 h-3 bg-yellow-400 rounded-full'
            />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 }}
              className='absolute -top-4 -right-1 w-2 h-2 bg-green-400 rounded-full'
            />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
              className='absolute -bottom-2 -left-4 w-2 h-2 bg-blue-400 rounded-full'
            />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3 }}
              className='absolute -bottom-4 -right-2 w-3 h-3 bg-purple-400 rounded-full'
            />

            <div className='relative p-8 text-center'>
              {/* Success Icon */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 15, stiffness: 200 }}
                className='relative mb-6 flex justify-center'
              >
                <div
                  className='w-24 h-24 rounded-full flex items-center justify-center'
                  style={{
                    background: isDarkMode
                      ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.4), rgba(16, 185, 129, 0.4))'
                      : 'linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(16, 185, 129, 0.3))',
                    border: isDarkMode
                      ? '3px solid rgba(34, 197, 94, 0.6)'
                      : '3px solid rgba(34, 197, 94, 0.4)',
                  }}
                >
                  <CheckCircle className={`w-14 h-14 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
                </div>
              </motion.div>

              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
              >
                Success! 🎉
              </motion.h3>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className='mb-4'
              >
                <div
                  className='inline-block px-6 py-3 rounded-2xl mb-3'
                  style={{
                    background: isDarkMode
                      ? 'rgba(34, 197, 94, 0.2)'
                      : 'rgba(34, 197, 94, 0.15)',
                    border: isDarkMode
                      ? '1px solid rgba(34, 197, 94, 0.3)'
                      : '1px solid rgba(34, 197, 94, 0.2)',
                  }}
                >
                  <div className={`text-4xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                    +{scanResults.count}
                  </div>
                  <div className={`text-sm font-medium ${isDarkMode ? 'text-green-300' : 'text-green-700'}`}>
                    New Vouchers
                  </div>
                </div>
              </motion.div>

              {scanResults.details && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
                >
                  {scanResults.details}
                </motion.p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default App;
