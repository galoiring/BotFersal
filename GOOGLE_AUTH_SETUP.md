# 🔐 Google Authentication Setup Guide

## Step 1: Google Cloud Console Setup

### 1.1 Create OAuth 2.0 Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to "APIs & Services" → "Credentials"
3. Click "Create Credentials" → "OAuth 2.0 Client ID"
4. Choose "Web application"

### 1.2 Configure Authorized Domains
Add these **exact URLs**:

**Authorized JavaScript origins:**
```
http://localhost:3000
https://botfersal.site
https://www.botfersal.site
```

**Authorized redirect URIs:**
```
http://localhost:3000
https://www.botfersal.site
https://botfersal.site
```

### 1.3 Get Your Client ID
Copy the generated **Client ID** (looks like: `123456789-abcdefg.apps.googleusercontent.com`)

## Step 2: Environment Configuration

### 2.1 Update Frontend Environment
Edit `/frontend/.env`:
```env
REACT_APP_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
REACT_APP_API_URL=https://botfersal.site/api
REACT_APP_ENVIRONMENT=production
```

### 2.2 Update Root Environment
Edit `/.env`:
```env
REACT_APP_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
```

## Step 3: User Email Mapping

### 3.1 Authorized Users
The app is configured to only allow these emails:
```typescript
const emailMap: { [key: string]: string } = {
  'gal.oiring@gmail.com': 'jewbaca1',
  'rinatmamo94@gmail.com': 'rinat_user',
};
```

**✅ Access is restricted to these emails only**
**❌ Any other email will be denied access**

## Step 4: Testing

### 4.1 Local Testing
```bash
cd frontend
npm start
```

### 4.2 Production Testing
Deploy to Netlify and test at `https://botfersal.site`

## ✅ Benefits of Google Auth

- ✅ **No more device limits!**
- ✅ **Multi-device support**
- ✅ **Secure authentication**
- ✅ **User profiles with photos**
- ✅ **One-click sign-in**
- ✅ **Works on all devices**

## 🚀 What Changed

- Removed device fingerprinting completely
- Added Google Sign-In button
- User profiles display Google photos
- Tap profile picture to sign out
- No more "maximum 2 devices" errors

## 🔧 Troubleshooting

### Common Issues:
1. **"redirect_uri_mismatch"** - Check authorized domains match exactly
2. **"invalid_client"** - Verify Client ID is correct
3. **Auth not loading** - Check console for script loading errors

### Debug Steps:
1. Open browser console (F12)
2. Look for Google Auth errors
3. Verify environment variables are loaded
4. Test on localhost first, then production