# ImageFlow Pro

Professional, client-side image processing with batch resizing, lossless conversions, **local network sharing**, P2P file sharing, and full PWA support.

## 🏠 **Új Helyi Hálózati Szerver Funkció**

Az ImageFlow Pro most már támogatja a helyi WiFi hálózaton történő fájlmegosztást ideiglenes szerver segítségével!

### **Gyors Indítás:**

1. **Windows felhasználóknak:**
   ```cmd
   start-local-server.bat
   ```

2. **Manuális indítás:**
   ```bash
   # Függőségek telepítése (csak egyszer)
   npm install

   # Szerver indítása
   npm start
   # vagy
   node local-server.js
   ```

3. **Használat:**
   - Nyissa meg a böngészőt: `http://localhost:8080` vagy az automatikusan megjelenített helyi IP címen
   - Más eszközök csatlakozhatnak a QR kód segítségével
   - Csak ugyanazon WiFi hálózaton működik (biztonságos!)

### **Helyi Szerver Előnyei:**
- 🏠 **Saját Hálózat**: Működik offline, internet nélkül is
- 🔒 **Biztonságos**: Csak ugyanazon WiFi hálózaton elérhető
- ⚡ **Gyors**: Direkt kapcsolat, nincs külső szerverre szükség
- 📱 **Mobil Kompatibilis**: QR kóddal egyszerű csatlakozás
- 🔄 **Automatikus Fallback**: Ha nincs helyi szerver, külső PeerJS-re vált

## Features

- Batch processing: resize/convert many images at once
- High-quality resizing via Pica.js
- Format conversion: WebP, JPG, PNG, AVIF
- Adjustable quality and dimensions with presets
- Device pairing with QR codes + PeerJS P2P transfer
- Storage analytics and per‑type breakdown
- Works offline (Service Worker + PWA)
- Dark/light theme

## Quick Start

Local preview (no build step required):

```bash
# Clone the repository
git clone https://github.com/dailyatti/image-resizer.git
cd image-resizer

# Serve locally (choose one)
python -m http.server 8080
# or
npx serve .

# Open
http://localhost:8080
```

## Deploy (Netlify)

This is a static site.

- Publish directory: `.`
- Build command: `echo 'No build process needed'`

Push to your GitHub repository and connect it to Netlify for automatic deploys.

## Usage

1. Upload images (drag & drop or file picker)
2. Choose format, quality, and size, or use presets
3. Process images (Quick or Batch)
4. Download individually or export all as ZIP
5. Optional: Pair devices via QR to transfer files wirelessly

## Tech Stack

- Vanilla JavaScript, Tailwind CSS
- Pica.js (resizing), JSZip + FileSaver (ZIP download)
- PeerJS (WebRTC), QRCode.js (QR generation)
- Service Worker (offline/PWA)

## API (basic)

```javascript
const app = new ImageFlowApp();
await app.processFiles(files);
app.connectManual(deviceId);
app.downloadAll();
```

## License

MIT

