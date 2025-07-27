import React, { useState, useEffect } from "react";
import {
  Camera,
  Scan,
  Wallet,
  RefreshCw,
  CheckCircle,
  XCircle,
  Home,
  Settings,
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
        setBarcodeData(data.data.barcode);
        setSelectedVoucher(amount);
        setShowBarcode(true);
      } else {
        setError(data.message || `אין שוברים זמינים על סך ${amount}₪`);
        setTimeout(() => setError(""), 3000);
      }
    } catch (err: any) {
      setError("שגיאה בקבלת השובר");
      setTimeout(() => setError(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleVoucherUse = async (): Promise<void> => {
    if (!selectedVoucher) return;

    try {
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

      // Reload vouchers to get updated counts
      await loadVouchers();

      setShowBarcode(false);
      setSelectedVoucher(null);
    } catch (err: any) {
      setError("שגיאה בעדכון השובר");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleVoucherCancel = (): void => {
    setShowBarcode(false);
    setSelectedVoucher(null);
  };

  const handleScan = async (type: string): Promise<void> => {
    setIsScanning(true);
    setError("");

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
          setError(`✅ ${data.message}`);
          await loadVouchers(); // Reload vouchers
        } else {
          setError("ℹ️ לא נמצאו שוברים חדשים");
        }
      } else {
        setError(data.message || "שגיאה בסריקה");
      }
    } catch (err: any) {
      setError("שגיאה בסריקה");
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
      className={`relative overflow-hidden rounded-2xl p-6 transition-all duration-300 transform ${
        count > 0
          ? "bg-white/90 backdrop-blur-xl border border-white/30 shadow-xl cursor-pointer hover:scale-105 hover:shadow-2xl active:scale-95"
          : "bg-gray-100/50 backdrop-blur-xl border border-gray-200/30 opacity-50"
      }`}
      onClick={() => count > 0 && onClick(amount)}
    >
      {/* Glassmorphism shine effect */}
      <div className='absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent opacity-60'></div>

      <div className='relative z-10 text-center'>
        <div className='text-3xl font-light text-gray-800 mb-2'>₪{amount}</div>
        <div className='text-sm font-medium text-gray-500 mb-3'>שובר</div>
        <div
          className={`text-xl font-semibold px-3 py-1 rounded-full ${
            count > 0
              ? "bg-blue-100 text-blue-600"
              : "bg-gray-100 text-gray-400"
          }`}
        >
          {count} יחידות
        </div>
      </div>
    </div>
  );

  const BarcodeDisplay: React.FC<BarcodeDisplayProps> = ({
    barcode,
    amount,
    onUse,
    onCancel,
  }) => (
    <div
      className='fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center p-4 z-50'
      style={{ backdropFilter: "blur(20px)" }}
    >
      <div
        className='bg-white/95 backdrop-blur-xl rounded-3xl p-8 w-full max-w-lg border border-white/30 shadow-3xl transform transition-all duration-300'
        style={{
          boxShadow:
            "0 40px 80px -20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.3) inset",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)",
        }}
      >
        <div className='relative z-10'>
          <div className='text-center mb-8'>
            <h3 className='text-3xl font-light text-gray-800 mb-8'>
              שובר ₪{amount}
            </h3>

            {/* BIGGER Barcode Section */}
            <div className='bg-gray-50/80 backdrop-blur-sm rounded-2xl p-8 mb-8 border border-gray-200/30'>
              <div className='font-mono text-xl mb-6 text-gray-700 tracking-wider'>
                {barcode}
              </div>

              {/* MUCH BIGGER Barcode Image */}
              <div className='bg-white/90 p-6 rounded-xl border border-gray-200/50'>
                <img
                  src={`${API_BASE.replace("/api", "")}/api/barcode/${barcode}`}
                  alt='Barcode'
                  className='w-full h-auto max-h-32 object-contain'
                  style={{ minHeight: "80px" }}
                  onError={(e) => {
                    // Fallback to text representation if image fails
                    e.currentTarget.style.display = "none";
                    const fallback = e.currentTarget
                      .nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = "block";
                  }}
                />
                <div className='hidden font-mono text-sm tracking-widest text-gray-800 text-center py-4'>
                  ||||&nbsp;&nbsp;||&nbsp;&nbsp;||||&nbsp;&nbsp;||&nbsp;&nbsp;||||&nbsp;&nbsp;||&nbsp;&nbsp;||||&nbsp;&nbsp;||&nbsp;&nbsp;||||
                </div>
              </div>
            </div>
          </div>

          <div className='text-center'>
            <p className='text-gray-600 mb-6 font-medium text-lg'>
              האם השתמשת בשובר?
            </p>
            <div className='flex gap-4'>
              <button
                onClick={onUse}
                className='flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 px-6 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-xl backdrop-blur-xl'
                style={{
                  boxShadow:
                    "0 15px 30px -10px rgba(34, 197, 94, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.2) inset",
                }}
              >
                <CheckCircle size={24} />
                כן, השתמשתי 🍽️
              </button>
              <button
                onClick={onCancel}
                className='flex-1 bg-white/90 backdrop-blur-xl text-gray-700 py-4 px-6 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all duration-300 transform hover:scale-105 active:scale-95 border border-gray-200/50 shadow-lg'
                style={{
                  boxShadow:
                    "0 10px 20px -8px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.3) inset",
                }}
              >
                <XCircle size={24} />
                עוד לא 😋
              </button>
            </div>
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

      {/* Header Card */}
      <div
        className='relative overflow-hidden rounded-3xl p-8 text-white'
        style={{
          background:
            "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
          boxShadow:
            "0 30px 60px -20px rgba(102, 126, 234, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.2) inset",
        }}
      >
        {/* Animated background elements */}
        <div className='absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16'></div>
        <div className='absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12'></div>

        <div className='relative z-10'>
          <h1 className='text-2xl font-light mb-2'>BotFersal</h1>
          <p className='text-white/80 mb-6'>שלום {user}! 👋</p>
          <div>
            <div className='text-4xl font-light mb-1'>
              ₪{totalValue.toLocaleString()}
            </div>
            <div className='text-white/80 font-medium'>סה״כ שווי שוברים</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className='grid grid-cols-2 gap-4'>
        <button
          onClick={() => handleScan("10bis")}
          disabled={isScanning}
          className='bg-gradient-to-br from-orange-500/90 to-red-600/90 text-white p-4 rounded-2xl font-semibold flex flex-col items-center gap-3 transition-all duration-300 transform backdrop-blur-xl border border-white/20 shadow-xl hover:scale-105 active:scale-95'
          style={{
            boxShadow:
              "0 20px 40px -12px rgba(255, 69, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.2) inset",
          }}
        >
          <div className='absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent opacity-60 rounded-2xl'></div>
          <div className='relative z-10 flex flex-col items-center gap-2'>
            {isScanning ? (
              <div className='w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
            ) : (
              <Scan size={24} />
            )}
            <span className='text-sm'>
              {isScanning ? "סורק..." : "סריקת 10bis"}
            </span>
          </div>
        </button>

        <button
          onClick={() => handleScan("cibus")}
          disabled={isScanning}
          className='bg-gradient-to-br from-green-500/90 to-teal-600/90 text-white p-4 rounded-2xl font-semibold flex flex-col items-center gap-3 transition-all duration-300 transform backdrop-blur-xl border border-white/20 shadow-xl hover:scale-105 active:scale-95'
          style={{
            boxShadow:
              "0 20px 40px -12px rgba(34, 197, 94, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.2) inset",
          }}
        >
          <div className='absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent opacity-60 rounded-2xl'></div>
          <div className='relative z-10 flex flex-col items-center gap-2'>
            {isScanning ? (
              <div className='w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
            ) : (
              <Camera size={24} />
            )}
            <span className='text-sm'>
              {isScanning ? "סורק..." : "סריקת Cibus"}
            </span>
          </div>
        </button>
      </div>

      {/* Vouchers Grid */}
      <div>
        <h2 className='text-xl font-light text-gray-800 mb-4 flex items-center gap-3'>
          <Wallet size={24} className='text-blue-600' />
          השוברים שלי
        </h2>
        {loading ? (
          <div className='text-center py-8'>
            <div className='w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4'></div>
            <p className='text-gray-600'>טוען שוברים...</p>
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
      {/* Fixed Bottom Navbar */}
      <div className='fixed bottom-0 left-0 right-0 z-40'>
        <div
          className='max-w-md mx-auto bg-white/90 backdrop-blur-xl border-t border-white/30 shadow-lg'
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)",
          }}
        >
          <div className='flex items-center justify-around py-4 px-6'>
            <button
              onClick={() => setCurrentView("home")}
              className={`p-3 rounded-2xl transition-all duration-300 flex flex-col items-center gap-1 ${
                currentView === "home"
                  ? "bg-blue-100/80 text-blue-600 shadow-lg"
                  : "text-gray-600 hover:bg-gray-100/50"
              }`}
            >
              <Home size={22} />
              <span className='text-xs font-medium'>בית</span>
            </button>

            <button
              onClick={loadVouchers}
              className='p-3 rounded-2xl text-gray-600 hover:bg-gray-100/50 transition-all duration-300 flex flex-col items-center gap-1'
            >
              <RefreshCw size={22} />
              <span className='text-xs font-medium'>רענן</span>
            </button>

            <button
              onClick={() => setCurrentView("settings")}
              className={`p-3 rounded-2xl transition-all duration-300 flex flex-col items-center gap-1 ${
                currentView === "settings"
                  ? "bg-blue-100/80 text-blue-600 shadow-lg"
                  : "text-gray-600 hover:bg-gray-100/50"
              }`}
            >
              <Settings size={22} />
              <span className='text-xs font-medium'>הגדרות</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content with Bottom Padding for Navbar */}
      <div className='max-w-md mx-auto p-6 pb-24'>
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

      {/* Loading Overlay */}
      {isScanning && (
        <div
          className='fixed inset-0 bg-black/30 backdrop-blur-lg flex items-center justify-center z-50'
          style={{ backdropFilter: "blur(20px)" }}
        >
          <div
            className='bg-white/95 backdrop-blur-xl rounded-3xl p-8 text-center border border-white/30 shadow-3xl'
            style={{
              boxShadow:
                "0 40px 80px -20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.3) inset",
            }}
          >
            <div className='w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4'></div>
            <p className='text-gray-700 font-medium'>סורק שוברים...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
