import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Copy, MessageCircle, Mail, Check } from 'lucide-react';

interface ShareButtonProps {
  title?: string;
  text?: string;
  url?: string;
  voucherData?: {
    amount: string;
    barcode?: string;
  };
  onShare?: () => void;
  className?: string;
  hapticFeedback?: (type: 'light' | 'medium' | 'heavy') => void;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  title = "BotFersal Voucher",
  text = "Check out this voucher!",
  url = window.location.href,
  voucherData,
  onShare,
  className = "",
  hapticFeedback,
}) => {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareData = {
    title,
    text: voucherData
      ? `${text}\n\nVoucher: ₪${voucherData.amount}\nBarcode: ${voucherData.barcode || 'Available in app'}`
      : text,
    url,
  };

  const handleNativeShare = async () => {
    hapticFeedback?.('medium');

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        onShare?.();
        setShowShareMenu(false);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Share failed:', error);
          // Fallback to share menu
          setShowShareMenu(true);
        }
      }
    } else {
      // Fallback for browsers without native share
      setShowShareMenu(true);
    }
  };

  const copyToClipboard = async () => {
    hapticFeedback?.('light');

    try {
      const textToCopy = `${shareData.title}\n${shareData.text}\n${shareData.url}`;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onShare?.();
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const shareViaWhatsApp = () => {
    hapticFeedback?.('medium');
    const whatsappText = encodeURIComponent(`${shareData.text}\n${shareData.url}`);
    window.open(`https://wa.me/?text=${whatsappText}`, '_blank');
    onShare?.();
    setShowShareMenu(false);
  };

  const shareViaEmail = () => {
    hapticFeedback?.('medium');
    const emailSubject = encodeURIComponent(shareData.title);
    const emailBody = encodeURIComponent(`${shareData.text}\n\n${shareData.url}`);
    window.open(`mailto:?subject=${emailSubject}&body=${emailBody}`, '_blank');
    onShare?.();
    setShowShareMenu(false);
  };

  const shareOptions = [
    {
      icon: MessageCircle,
      label: 'WhatsApp',
      action: shareViaWhatsApp,
      color: 'bg-green-500',
    },
    {
      icon: Mail,
      label: 'Email',
      action: shareViaEmail,
      color: 'bg-blue-500',
    },
    {
      icon: copied ? Check : Copy,
      label: copied ? 'Copied!' : 'Copy',
      action: copyToClipboard,
      color: copied ? 'bg-green-500' : 'bg-gray-500',
    },
  ];

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={handleNativeShare}
        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-blue-500 text-white font-medium shadow-lg active:shadow-md transition-all duration-200 ${className}`}
      >
        <Share2 size={16} />
        Share
      </motion.button>

      {/* Fallback share menu */}
      <AnimatePresence>
        {showShareMenu && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShareMenu(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />

            {/* Share menu */}
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed bottom-6 left-6 right-6 bg-white rounded-3xl p-6 shadow-2xl z-50"
            >
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Share Voucher</h3>
                <p className="text-sm text-gray-500 mt-1">Choose how to share this voucher</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {shareOptions.map((option, index) => (
                  <motion.button
                    key={option.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={option.action}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className={`w-12 h-12 ${option.color} rounded-full flex items-center justify-center text-white`}>
                      <option.icon size={20} />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{option.label}</span>
                  </motion.button>
                ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowShareMenu(false)}
                className="w-full mt-6 py-3 bg-gray-100 rounded-2xl text-gray-600 font-medium"
              >
                Cancel
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};