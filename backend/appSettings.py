import os

# Bot Token - use environment variable if available, otherwise fallback to hardcoded
botToken = os.getenv(
    'BOT_TOKEN', '5951730571:AAFJjGmdBUKse_a-si3n9Ia6yDDULroR0QM')

# MongoDB connection string
mongo_connection_string = os.getenv('MONGO_CONNECTION_STRING',
                                    'mongodb+srv://botfersal:6hjhXldtncF6f5f3@cluster0.tfybszx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0&tlsAllowInvalidCertificates=true')

# 10bis email
ten_bis_mail = os.getenv('TEN_BIS_MAIL', 'REPLACE_WITH_TEN_BIS_MAIL')

# Telegram username
user_name = os.getenv('USER_NAME', 'jewbaca1')

# Gmail settings for Cibus email scanning
gmail_address = os.getenv('GMAIL_ADDRESS', 'gal.cibus@gmail.com')
gmail_app_password = os.getenv('GMAIL_APP_PASSWORD', 'ywis zfhq wjok hilh')

# Print configuration (without sensitive data) for debugging
if __name__ == "__main__":
    print("=== BotFersal Configuration ===")
    print(f"Bot Token: {'*' * 20}{botToken[-10:] if botToken else 'NOT SET'}")
    print(f"MongoDB: {'SET' if mongo_connection_string else 'NOT SET'}")
    print(f"10bis Email: {ten_bis_mail}")
    print(f"Username: {user_name}")
    print(f"Gmail: {gmail_address}")
    print(f"Gmail Password: {'SET' if gmail_app_password else 'NOT SET'}")
