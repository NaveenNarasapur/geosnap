# GeoSnap — Capture Moments. Preserve Locations.

GeoSnap is an installable PWA for taking geotagged photos. It captures from the device camera, gets a GPS fix, and exports:

- **GPS EXIF JPEG**: real `GPSLatitude/Ref`, `GPSLongitude/Ref`, `GPSAltitude/Ref`, `GPSDateStamp`, `GPSTimeStamp`, `GPSMapDatum`, `GPSHPositioningError`, `DateTimeOriginal` and `OffsetTimeOriginal`. After writing, the file is **parsed again and checked against the fix**. If the check fails, the download is not reported as geotagged.
- **Location overlay**: JPG, JPEG, PNG or WebP with one of five templates (Minimal GPS, Travel Stamp, Maps Card, Camera Timestamp, Cinematic). A JPG overlay can also carry GPS EXIF.
- **Original**: no overlay, and location metadata removed.

Everything runs in the browser. Photos are never uploaded. The only network call that involves your data is the optional address lookup, which sends coordinates to OpenStreetMap Nominatim, and only after you tap it or turn on auto-lookup.

## Stack
React 19 · Vite · TypeScript · Tailwind CSS 3 · lucide-react · piexifjs (EXIF) · vite-plugin-pwa (Workbox) · Cloudflare Pages.

## Quick start
```bash
npm install
npm run dev          # http://localhost:5173 (localhost counts as a secure context, so camera and GPS work)
npm run build        # type-check + production build → dist/
npm run preview      # serve dist/ on :4173
```
To test on a phone during development, use an HTTPS tunnel (for example `npx cloudflared tunnel --url http://localhost:5173`). Camera and GPS need HTTPS.

## Project structure
```
src/
  App.tsx                 screen routing, offline banner, SW update toast, install prompt
  screens/Landing.tsx     landing page + iOS “Add to Home Screen” guide
  screens/CameraScreen.tsx  live camera, torch, switch, permission + GPS status
  screens/PreviewScreen.tsx (lazy) live overlay editor + export panel
  components/LocationPanel.tsx  lat/lng/alt/accuracy/date/time/timezone/address, copy, Maps, refresh
  components/HowItWorks.tsx (lazy)
  hooks/useCamera.ts      getUserMedia (video only), ImageCapture full-res stills, cleanup
  hooks/useLocation.ts    geolocation + throttled, in-memory-cached Nominatim
  lib/exif.ts             DMS rational conversion, embed, verify
  lib/overlay.ts          canvas templates (shared by preview and export)
  lib/image.ts            export pipeline, download/share
public/_headers, _redirects   Cloudflare Pages headers + SPA fallback
scripts/icons.mjs        regenerates all icons
tests/                   EXIF unit tests + Chrome end-to-end test
```

## How image quality is preserved
- On Chromium/Android with the rear camera, `ImageCapture.takePhoto()` returns a full-sensor-resolution JPEG. Elsewhere (Safari, Firefox, front camera) the frame is grabbed from the stream at native video resolution and encoded at 95%.
- For GPS EXIF and Original exports at quality ≥ 92%, the **camera JPEG bytes are kept unchanged**. Only the APP1/EXIF segment is rewritten. The tests confirm the compressed scan data is byte-identical.
- An overlay, or a quality below 92%, means re-encoding the image (that's unavoidable). Orientation is then reset to 1 because the pixels are already upright.

## PWA
- Manifest: standalone, theme and background `#0a0a0b`, icons at 192/512/maskable-512 plus a 180 Apple touch icon.
- Service worker: precaches the app shell only. There is **no runtime caching**, so geocoding responses, photos and coordinates are never cached. Photos exist only as in-memory blobs.
- Updates: prompt-based (“A new version is available → Update”).
- Install: Android/desktop Chrome and Edge use the native prompt (“Install app” button). On iPhone, the button opens Safari's Share → Add to Home Screen steps.

## Deploying to Cloudflare Pages
**Dashboard (Git):** push to GitHub, go to Cloudflare → Workers & Pages → Create → Pages → Connect to Git, then set:
- Framework preset: *Vite* (or None)
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variable: `NODE_VERSION=22`

**CLI:**
```bash
npx wrangler login
npm run deploy        # build + wrangler pages deploy dist --project-name geosnap
```
Pages serves over HTTPS automatically. `public/_redirects` provides the SPA fallback. `public/_headers` sets `Permissions-Policy: camera=(self), geolocation=(self), microphone=()`, no-cache for `sw.js` and the manifest, and immutable caching for hashed assets. No API keys are used.

## Testing
```bash
npm test                         # EXIF unit tests (Node)
npm run build && npm run preview -- --port 4173 &
npm run test:e2e                 # Chrome + fake camera + mocked GPS/Nominatim
```
See **TESTING.md** for results and the manual device checklist.

## Browser notes and limitations
| Feature | Chrome/Edge (Android, desktop) | Safari iOS 16.4+ | Firefox |
|---|---|---|---|
| Camera, switching | ✅ | ✅ | ✅ |
| Torch | ✅ on most Android rear cameras | ❌ (no API; button disabled) | ❌ |
| Full-res `takePhoto` | ✅ | ❌ (uses stream frame) | ❌ |
| WebP export | ✅ | ✅ Safari 17+; older versions disable the button | ✅ |
| Install | Native prompt | Share → Add to Home Screen | Android only |
| Altitude | Depends on device | Usually ✅ | Depends on device |

- PNG and WebP files **don't carry GPS metadata** from GeoSnap, and the UI says so.
- On iOS, use **Share / Save to Photos** after export to put the photo in the Photos library. A plain download goes to Files.
- Nominatim allows at most 1 request per second. GeoSnap throttles calls, caches results in memory only, and calls only on user action.
