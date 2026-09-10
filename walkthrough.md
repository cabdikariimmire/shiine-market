# Walkthrough: Mobile Phone Real Camera & HTTPS Setup

## Problem Resolved

When testing the Tukaan Management System from a mobile phone over LAN (`http://192.168.100.86:3000`), modern browsers (Android Chrome, iOS Safari) restrict `navigator.mediaDevices.getUserMedia()` because the page is not in a Secure Context (`window.isSecureContext === false`).

Rather than leaving mobile camera access disabled, we configured a full **Development HTTPS solution** with local SSL SAN certificates so that phones on the same Wi-Fi can access `https://192.168.100.86:3000` with full access to the **REAL** phone camera.

---

## 1. Development HTTPS Architecture

### Certificate Generation (`scripts/generate-certificates.js`)
- Dynamically scans all active network interfaces to find the PC's LAN IP (e.g. `192.168.100.86`).
- Generates 2048-bit RSA SSL certificates containing Subject Alternative Names (SAN) for:
  - `localhost`
  - `127.0.0.1`
  - `192.168.100.86` (and all other local IPv4 addresses)
- Writes certificate and private key files to `certificates/localhost.pem` and `certificates/localhost-key.pem`.

### HTTPS Dev Server (`server.js`)
- Uses Node.js `https.createServer` with the generated SSL certificates.
- Binds to `0.0.0.0:3000` so any device on the Wi-Fi network can connect.
- Accessible via `npm run dev:https`.

---

## 2. Dynamic Secure Context & Camera Lifecycle

### `src/hooks/use-camera.ts`
- **Dynamic Context Check**: Exposes `isSecureContext`. When accessed via `https://192.168.100.86:3000` or `http://localhost:3000`, `isSecureContext` is `true`.
- **Mobile Rear Camera Preference**: `{ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }` with fallback for desktop webcams.
- **Track Lifecycle**: Calls `stream.getTracks().forEach(t => t.stop())` on stream close, camera flip, and component unmount.
- **Somali Error Mappings**:
  - `NotAllowedError`: *"Camera-da waa la diiday. Fadlan browser-ka ka oggolow Camera permission."*
  - `NotFoundError`: *"Camera lagama helin qalabkan."*
  - `NotReadableError`: *"Camera-da waxaa isticmaalaya app kale."*
  - `SecurityError`: *"Camera-da waxay u baahan tahay HTTPS. Fadlan isticmaal HTTPS URL-ka app-ka."*

### `src/app/ai-camera/page.tsx`
- **No False Warning**: When running in a secure context (`isSecureContext === true`), the HTTPS warning banner is completely hidden.
- **HTTP LAN Redirect Helper**: If user mistakenly opens `http://192.168.100.86:3000`, a one-click button `[ 🔒 U wareeg HTTPS ]` redirects directly to `https://192.168.100.86:3000`.
- **Mobile Video**: Uses `<video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />`.
- **Controls**:
  - Inactive: *"Kaamiradu hadda waa xiran tahay"* with `[ 📷 Fur Kaamirada ]`.
  - Mode 1 (Live Packaging Count): `[ Bilaaw Tirinta Live ]`, `[ ⏹ Jooji Camera ]`, `[ 🔄 Beddel Kaamirada ]`.
  - Mode 2 (Supplier Invoice OCR): `[ 📷 Sawir Invoice-ka ]`, `[ ⏹ Jooji Camera ]`, `[ 🔄 Beddel Kaamirada ]`.

---

## 3. How to Test on Mobile Phone (Android / iPhone)

1. **Start the HTTPS Dev Server**:
   ```bash
   npm run dev:https
   ```
2. **On your Phone (connected to the same Wi-Fi)**:
   - Open Chrome or Safari and navigate to:
     ```
     https://192.168.100.86:3000
     ```
   - *Note on Self-Signed Certificate*: On the first visit, Chrome/Safari will show "Your connection is not private". Tap **Advanced** (or *Details*) and tap **"Proceed to 192.168.100.86 (unsafe)"** to accept the local dev cert.
3. **Open AI Camera (`/ai-camera`)**:
   - The HTTPS warning is gone.
   - Tap **"Fur Kaamirada"**.
   - Tap **"Allow"** when the browser asks for camera permission.
   - The **REAL rear phone camera** feed appears immediately.
4. **Test Invoice Capture & OCR**:
   - Switch to tab **"2. Supplier Invoice AI Scan"**.
   - Tap **"Fur Kaamirada"** -> point at invoice -> tap **"Sawir Invoice-ka"**.
   - Frame is captured -> tap **"Baadh & Akhri Invoice-ka"**.
   - Real Tesseract OCR extracts line items -> tap **"U Dir Products Table (Sida Pending Rows)"**.

---

## 4. Verification

- **TypeScript Compilation**: `npx.cmd tsc --noEmit` passed with 0 errors.
- **Production Build**: `npm.cmd run build` compiled all 24 routes cleanly.
