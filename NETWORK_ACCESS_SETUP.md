# Network Access Setup - Access from Other Devices

## Problem
Next.js app running on `localhost:3000` but not accessible from network IP `http://192.168.56.1:3000` or other devices on the network.

## Solution
Updated `package.json` scripts to bind to `0.0.0.0` instead of `localhost` only.

---

## Changes Made

### package.json
```json
"scripts": {
  "dev": "next dev -H 0.0.0.0",      // ✅ Added -H 0.0.0.0
  "start": "next start -H 0.0.0.0",  // ✅ Added -H 0.0.0.0
}
```

### What `-H 0.0.0.0` Does:
- **Before**: Binds only to `127.0.0.1` (localhost) - only accessible from same computer
- **After**: Binds to `0.0.0.0` (all network interfaces) - accessible from any device on network

---

## How to Use

### 1. Restart the Development Server

Stop the current server (Ctrl+C) and restart:

```bash
npm run dev
```

### 2. Check the Output

You should now see:

```
▲ Next.js 16.3.0
- Local:        http://localhost:3000
- Network:      http://192.168.56.1:3000  ✅ Now available!

✓ Starting...
✓ Ready in 2.1s
```

### 3. Access from Other Devices

Now you can access from:

**Same Computer:**
- ✅ `http://localhost:3000`
- ✅ `http://127.0.0.1:3000`
- ✅ `http://192.168.56.1:3000`

**Other Devices on Same Network:**
- ✅ `http://192.168.56.1:3000` (from mobile, tablet, another PC)

---

## Testing Network Access

### From Your Phone/Tablet:

1. **Connect to same WiFi** as your computer
2. **Open browser** on phone
3. **Navigate to**: `http://192.168.56.1:3000`
4. **Should load** the StudyLib app

### From Another Computer:

1. **Ensure same network**
2. **Open browser**
3. **Type**: `http://192.168.56.1:3000`
4. **App loads** ✅

---

## Firewall Configuration

If it still doesn't work after restart, you may need to allow the port through Windows Firewall:

### Option 1: Windows Defender Firewall (GUI)

1. **Open**: Control Panel → Windows Defender Firewall → Advanced Settings
2. **Click**: Inbound Rules → New Rule
3. **Select**: Port → Next
4. **Select**: TCP → Specific local ports: `3000` → Next
5. **Select**: Allow the connection → Next
6. **Check**: Domain, Private, Public (or just Private) → Next
7. **Name**: "Next.js Development Server" → Finish

### Option 2: PowerShell (Quick)

Open PowerShell as Administrator and run:

```powershell
New-NetFirewallRule -DisplayName "Next.js Dev Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

---

## Environment Variables Update

If you have `NEXT_PUBLIC_APP_URL` in your `.env`, update it to use the network IP:

### For Development (Network Access):
```env
NEXT_PUBLIC_APP_URL="http://192.168.56.1:3000"
```

### For Production:
```env
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
```

**Current .env**:
```env
NEXT_PUBLIC_APP_URL="http://localhost:3000"  # Only works on same machine
```

**Updated .env** (if you want network access by default):
```env
NEXT_PUBLIC_APP_URL="http://192.168.56.1:3000"  # Works from network
```

---

## Production Deployment

For production with `npm start`:

```bash
npm run build
npm start
```

The start script now also binds to `0.0.0.0`, so it will be accessible on your network.

---

## Alternative: Use `turbo` for Auto Network Binding

If you want automatic network detection, you can also use:

```json
"dev": "next dev --turbo -H 0.0.0.0"
```

This enables Turbopack with network binding.

---

## Security Note

⚠️ **Important**: Binding to `0.0.0.0` makes your development server accessible to anyone on your network.

**For Development**:
- ✅ Safe on home/office WiFi
- ✅ Good for testing on mobile devices
- ✅ Allows team collaboration on local network

**Avoid**:
- ❌ Public WiFi (café, airport, etc.)
- ❌ Untrusted networks
- ❌ Production servers (use proper hosting instead)

---

## Troubleshooting

### Still Not Accessible?

**Check 1: Verify Server is Running**
```bash
npm run dev
```
Look for "Network: http://192.168.56.1:3000" in output

**Check 2: Check Your IP Address**
The IP might have changed. Find current IP:

```powershell
ipconfig
```

Look for "IPv4 Address" under your active network adapter (usually starts with 192.168.x.x)

**Check 3: Firewall**
- Temporarily disable Windows Firewall to test
- If it works, add firewall rule (see above)

**Check 4: Network Type**
- Ensure your network is set to "Private" not "Public"
- Settings → Network & Internet → WiFi → Your Network → Network profile: Private

**Check 5: Ping Test**
From another device, try to ping your computer:
```bash
ping 192.168.56.1
```
If this fails, it's a network/firewall issue, not Next.js.

---

## Mobile Testing Tips

### Testing on Phone

1. ✅ Use WiFi (not mobile data)
2. ✅ Same network as computer
3. ✅ Type full URL with port: `http://192.168.56.1:3000`
4. ✅ Don't use `https://` (unless you've set up SSL)

### QR Code Access (Optional)

Install a terminal tool like:
```bash
npm install -g qrcode-terminal
```

Then in your terminal:
```bash
npx qrcode-terminal http://192.168.56.1:3000
```

Scan with phone camera to open instantly!

---

## Summary

**What Changed**:
- ✅ Added `-H 0.0.0.0` to `npm run dev` script
- ✅ Added `-H 0.0.0.0` to `npm start` script

**Result**:
- ✅ App now accessible from network IP
- ✅ Can test on mobile/tablet on same WiFi
- ✅ Can share with team on local network
- ✅ No more "localhost only" limitation

**Next Steps**:
1. Restart server: `npm run dev`
2. Check output for Network URL
3. Access from phone: `http://192.168.56.1:3000`
4. If firewall blocks, add rule (see above)
