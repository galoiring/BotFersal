# email_processor.py - Fixed version with Hebrew support
import imaplib
import email
import re
import requests
from bs4 import BeautifulSoup
from typing import Optional, List
import logging
from datetime import datetime, timedelta
from dataclasses import dataclass


@dataclass
class CibusVoucher:
    """Cibus voucher data"""
    amount: float
    barcode: str
    expiry_date: datetime
    source_url: str = ""


class CibusEmailProcessor:
    """Process Cibus voucher emails from gal.cibus@gmail.com"""

    def __init__(self, email_address: str, email_password: str):
        self.email_address = email_address
        self.email_password = email_password
        self.logger = logging.getLogger(__name__)

    def get_new_vouchers(self) -> List[CibusVoucher]:
        """Get new Cibus voucher emails"""
        vouchers = []

        try:
            # Connect to Gmail
            mail = imaplib.IMAP4_SSL('imap.gmail.com')
            mail.login(self.email_address, self.email_password)
            mail.select('INBOX')

            # Search for unread emails - using simple search to avoid encoding issues
            _, message_numbers = mail.search(None, 'UNSEEN')

            if message_numbers[0]:
                print(f"Found {len(message_numbers[0].split())} unread emails")

                for num in message_numbers[0].split():
                    try:
                        voucher = self._process_email_safely(mail, num)
                        if voucher:
                            vouchers.append(voucher)
                            # Mark as read
                            mail.store(num, '+FLAGS', '\\Seen')
                            print(
                                f"✅ Processed voucher: ₪{voucher.amount} - {voucher.barcode}")
                    except Exception as e:
                        print(f"Error processing email {num}: {e}")
            else:
                print("No unread emails found")

            mail.close()
            mail.logout()

        except Exception as e:
            print(f"Email connection error: {e}")

        return vouchers

    def _process_email_safely(self, mail: imaplib.IMAP4_SSL, message_num: bytes) -> Optional[CibusVoucher]:
        """Process email with safe encoding handling"""
        try:
            _, msg_data = mail.fetch(message_num, '(RFC822)')
            email_msg = email.message_from_bytes(msg_data[0][1])

            # Get subject with safe decoding
            subject = self._safe_decode_header(email_msg['Subject'])
            sender = self._safe_decode_header(email_msg['From'])

            print(f"Processing email from: {sender}")
            print(f"Subject: {subject[:50]}...")

            # Check if this looks like a Cibus email
            if not self._is_cibus_email(subject, sender):
                print("Not a Cibus email, skipping")
                return None

            # Get email body
            body = self._get_email_body_safe(email_msg)

            # Extract amount from subject or body
            amount = self._extract_amount_safe(subject, body)
            if not amount:
                print("No amount found")
                return None

            # Extract barcode
            barcode = self._extract_barcode_safe(body)

            # Extract voucher URL
            voucher_url = self._extract_url_safe(body)

            # If no barcode in email, try URL
            if not barcode and voucher_url:
                print(
                    f"No barcode in email, trying URL: {voucher_url[:50]}...")
                barcode = self._fetch_barcode_from_url(voucher_url)

            if not barcode:
                print("No barcode found")
                return None

            # Set expiry date (6 months from now)
            expiry_date = datetime.now() + timedelta(days=180)

            return CibusVoucher(
                amount=amount,
                barcode=barcode,
                expiry_date=expiry_date,
                source_url=voucher_url or ""
            )

        except Exception as e:
            print(f"Error processing email: {e}")
            return None

    def _is_cibus_email(self, subject: str, sender: str) -> bool:
        """Check if email is from Cibus"""
        if not subject and not sender:
            return False

        # Check for Cibus indicators
        indicators = [
            'cibus', 'pluxee', 'שובר', 'voucher',
            'שופרסל', 'myconsumers'
        ]

        text_to_check = f"{subject} {sender}".lower()

        for indicator in indicators:
            if indicator in text_to_check:
                return True

        return False

    def _safe_decode_header(self, header: str) -> str:
        """Safely decode email header"""
        if not header:
            return ""

        try:
            decoded_parts = email.header.decode_header(header)
            result = ""

            for part, encoding in decoded_parts:
                if isinstance(part, bytes):
                    try:
                        if encoding:
                            result += part.decode(encoding)
                        else:
                            # Try common encodings
                            for enc in ['utf-8', 'windows-1255', 'iso-8859-8']:
                                try:
                                    result += part.decode(enc)
                                    break
                                except:
                                    continue
                            else:
                                result += part.decode('utf-8', errors='ignore')
                    except:
                        result += str(part, errors='ignore')
                else:
                    result += str(part)

            return result

        except Exception as e:
            print(f"Header decode error: {e}")
            return str(header)

    def _get_email_body_safe(self, msg: email.message.Message) -> str:
        """Safely extract email body"""
        body = ""

        try:
            if msg.is_multipart():
                for part in msg.walk():
                    content_type = part.get_content_type()
                    if content_type in ["text/plain", "text/html"]:
                        try:
                            payload = part.get_payload(decode=True)
                            if payload:
                                # Try multiple encodings
                                content = None
                                for encoding in ['utf-8', 'windows-1255', 'iso-8859-8', 'latin-1']:
                                    try:
                                        content = payload.decode(encoding)
                                        break
                                    except:
                                        continue

                                if not content:
                                    content = payload.decode(
                                        'utf-8', errors='ignore')

                                if content_type == "text/html":
                                    soup = BeautifulSoup(
                                        content, 'html.parser')
                                    body += soup.get_text()
                                else:
                                    body += content
                        except Exception as e:
                            print(f"Part decode error: {e}")
            else:
                try:
                    payload = msg.get_payload(decode=True)
                    if payload:
                        for encoding in ['utf-8', 'windows-1255', 'iso-8859-8']:
                            try:
                                body = payload.decode(encoding)
                                break
                            except:
                                continue
                        else:
                            body = payload.decode('utf-8', errors='ignore')
                except Exception as e:
                    print(f"Body decode error: {e}")

        except Exception as e:
            print(f"Email body extraction error: {e}")

        return body

    def _extract_amount_safe(self, subject: str, body: str) -> Optional[float]:
        """Safely extract amount from subject or body"""
        text = f"{subject} {body}"

        # Multiple patterns for different formats
        patterns = [
            r'₪\s*([\d,]+\.?\d*)',  # ₪100.00
            r'([\d,]+\.?\d*)\s*₪',  # 100.00₪
            r'(\d+\.\d+)',          # 100.00
            r'(\d+)',               # 100
        ]

        for pattern in patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                try:
                    amount_str = match.replace(',', '')
                    amount = float(amount_str)
                    # Reasonable voucher amount (between 10-500)
                    if 10 <= amount <= 500:
                        return amount
                except:
                    continue

        return None

    def _extract_barcode_safe(self, body: str) -> Optional[str]:
        """Safely extract barcode from body"""
        # Look for long number sequences
        patterns = [
            r'(\d{20})',     # 20-digit barcode
            r'(\d{16,19})',  # 16-19 digit numbers
            r'(\d{12,15})',  # 12-15 digit numbers
        ]

        for pattern in patterns:
            matches = re.findall(pattern, body)
            for match in matches:
                # Skip phone numbers and other short numbers
                if len(match) >= 16:
                    return match

        return None

    def _extract_url_safe(self, body: str) -> Optional[str]:
        """Safely extract voucher URL"""
        pattern = r'https://myconsumers\.pluxee\.co\.il/[^\s<>"\'\)]*'
        match = re.search(pattern, body)
        return match.group(0) if match else None

    def _fetch_barcode_from_url(self, url: str) -> Optional[str]:
        """Try to get barcode from voucher URL"""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }

            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                # Look for barcode in page
                page_text = response.text

                # Look for 20-digit number
                pattern = r'(\d{20})'
                match = re.search(pattern, page_text)
                if match:
                    return match.group(1)

                # Try with BeautifulSoup
                soup = BeautifulSoup(response.content, 'html.parser')
                text = soup.get_text()
                match = re.search(pattern, text)
                if match:
                    return match.group(1)

        except Exception as e:
            print(f"URL fetch error: {e}")

        return None

# Test with debug info


def test_with_debug():
    """Test email processing with debug output"""
    import appSettings

    print("=== Cibus Email Debug Test ===")

    processor = CibusEmailProcessor(
        appSettings.gmail_address,
        appSettings.gmail_app_password
    )

    # Enable logging
    logging.basicConfig(level=logging.INFO)

    vouchers = processor.get_new_vouchers()

    print(f"\n=== Results ===")
    print(f"Found {len(vouchers)} vouchers:")

    for i, voucher in enumerate(vouchers, 1):
        print(f"\nVoucher {i}:")
        print(f"  Amount: ₪{voucher.amount}")
        print(f"  Barcode: {voucher.barcode}")
        print(f"  Expires: {voucher.expiry_date.strftime('%Y-%m-%d')}")
        print(
            f"  URL: {voucher.source_url[:60]}..." if voucher.source_url else "  URL: None")

    return vouchers


if __name__ == "__main__":
    test_with_debug()
