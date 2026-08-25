# Fix: Site Can't Be Reached from Phone

## Problem
Phone can't access `http://192.168.56.1:3000` - Windows Firewall is blocking port 3000.

---

## Quick Fix (Choose One Method)

### Method 1: PowerShell (Recommended - Fastest)

1. **Right-click** on PowerShell and select **"Run as Administrator"**

2. **Copy and paste** this command:
   ```powershell
   New-NetFirewallRule -DisplayName "Next.js Dev Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Private,Domain
   ```

3. **Press Enter**

4. **Test from phone**: `http://192.168.56.1:3000` ✅

---

### Method 2: Windows Firewall GUI (Visual)

1. **Press** `Windows + R`
2. **Type**: `wf.msc` and press Enter
3. **Click**: "Inbound Rules" (left sidebar)
4. **Click**: "New Rule..." (right sidebar)
5. **Select**: "Port" → Click "Next"
6. **Select**: "TCP"
7. **Enter**: Specific local ports: `3000` → Click "Next"
8. **Select**: "Allow the connection" → Click "Next"
9. **Check**: "Private" and "Domain" (uncheck "Public") → Click "Next"
10. **Name**: "Next.js Dev Server" → Click "Finish"
11. **Done!** Test from phone ✅

---

### Method 3: Temporarily Disable Firewall (Testing Only)

⚠️ **Use only for testing - Not recommended for security reasons**

1. **Press** `Windows + R`
2. **Type**: `firewall.cpl` and press Enter
3. **Click**: "Turn Windows Defender Firewall on or off" (left sidebar)
4. **Select**: "Turn off Windows Defender Firewall" for Private network
5. **Click**: "OK"
6. **Test from phone**: Should work now ✅
7. **Remember to turn it back on!**

---

## Verify It's Working

### Step 1: Check Firewall Rule
Open PowerShell (no admin needed) and run:
```powershell
Get-NetFirewallRule -DisplayName "*Next*" | Select-Object DisplayName, Enabled, Direction, Action
```

Should show:
```
DisplayName              Enabled Direction Action
-----------              ------- --------- ------
Next.js Dev Server       True    Inbound   Allow
```

### Step 2: Test from Same Computer
Open browser on your computer:
```
http://192.168.56.1:3000
```
Should load ✅

### Step 3: Test from Phone
1. **Connect phone to same WiFi**
2. **Open browser**
3. **Type**: `http://192.168.56.1:3000`
4. **Should load!** ✅

---

## Still Not Working?

### Check 1: Same Network?
- **Computer WiFi**: Settings → Network & Internet → WiFi → Check network name
- **Phone WiFi**: Settings → WiFi → Check connected network
- **Must be the same!**

### Check 2: Check Your IP
Your IP might have changed. Run in PowerShell:
```powershell
ipconfig
```
Look for "IPv4 Address" under your WiFi adapter.

If different from `192.168.56.1`, use the new IP!

### Check 3: Ping Test
From another device on network, open terminal/cmd:
```bash
ping 192.168.56.1
```

**If ping fails**:
- Firewall blocking ICMP (ping)
- Different network/subnet
- Network isolation enabled on router

**If ping succeeds**:
- Firewall blocking port 3000
- Server not running
- Wrong port

### Check 4: Server Running?
On your computer, verify server is running:
```bash
npm run dev
```

Should show:
```
┌─────────────────────────────────────────────┐
│  ✓ Server ready!                           │
├─────────────────────────────────────────────┤
│  Local:    http://localhost:3000           │
│  Network:  http://192.168.56.1:3000        │
└─────────────────────────────────────────────┘
```

### Check 5: Network Profile
Windows might be treating your network as "Public" which has stricter firewall rules.

**Change to Private**:
1. Settings → Network & Internet → WiFi
2. Click your network name
3. Under "Network profile", select **"Private"**
4. Restart dev server

### Check 6: Antivirus Software
Some antivirus software (Norton, McAfee, Kaspersky) has their own firewall:
- Check antivirus settings
- Add exception for port 3000
- Or temporarily disable to test

---

## Alternative: Use Your Computer's Actual Hostname

Instead of IP, you can use hostname:

1. Find your computer name:
   ```powershell
   hostname
   ```
   Example output: `DESKTOP-ABC123`

2. Access from phone:
   ```
   http://DESKTOP-ABC123.local:3000
   ```

This might work even without firewall rule (depends on network).

---

## For Public WiFi / Mobile Hotspot

If you want to test using your phone's hotspot:

1. **Enable hotspot on phone**
2. **Connect computer to phone's hotspot**
3. **Get computer's new IP** (will be different, like `192.168.43.x`)
   ```powershell
   ipconfig
   ```
4. **Update next.config.ts** with new IP in `allowedDevOrigins`
5. **Restart dev server**
6. **Access from phone**: `http://192.168.43.x:3000`

---

## Production Note

For production deployment, use a proper hosting service:
- **Vercel** (easiest for Next.js)
- **Netlify**
- **AWS / DigitalOcean / Railway**
- **Cloudflare Pages**

These automatically handle HTTPS, SSL, and network configuration!

---

## Summary

**Most Common Fix**:
1. Open PowerShell as Administrator
2. Run: 
   ```powershell
   New-NetFirewallRule -DisplayName "Next.js Dev Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Private
   ```
3. Test from phone: `http://192.168.56.1:3000`
4. Done! ✅

**If that doesn't work**:
- Verify same WiFi network
- Check IP hasn't changed (`ipconfig`)
- Ensure server is running (`npm run dev`)
- Try pinging the IP from phone
- Change network profile to "Private"
