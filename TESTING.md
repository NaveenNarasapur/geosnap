# Testing results

## Automated (run 2026-11-14, Linux, Chrome stable, Node 22)

### EXIF unit tests — `npm test` → 34/34 pass
Real JPEGs were embedded, then read back by both piexifjs **and an independent parser (exifr)**:
- N/E, S/W, below sea level (GPSAltitudeRef = 1), no altitude, and a 59.99999″ rounding edge case: coordinates within 1e-6°, altitude within 1 cm
- DateTimeOriginal, GPSDateStamp, GPSTimeStamp present
- Compressed image data **byte-identical** to the input (no recompression)
- Output decodes as a valid JPEG at the same dimensions
- Strip mode removes GPS; re-embedding leaves exactly one APP1 segment
- Verification rejects a file with no GPS (no false success); non-JPEG input is rejected

### End-to-end — `npm run test:e2e` → 30/30 pass
Chrome with a fake camera device, mocked geolocation (12.971599, 77.594566 ±8 m), and mocked Nominatim, at a mobile viewport:
- Landing tagline and features; How It Works dialog
- Service worker active; manifest is standalone with icons
- getUserMedia called with `audio:false` and `facingMode: environment`; camera status chip shows
- Switching handled (the headless test device has one camera, so the button is correctly disabled); old streams stopped
- No geocoding request before the user acts; GPS fix and accuracy shown; city/state/country after lookup
- Capture → preview at 3840×2160 via ImageCapture; **all camera tracks ended** after leaving the camera screen
- GPS EXIF `.jpg` and `.jpeg`: coordinates read back by exifr match; UI shows “GPS metadata embedded & verified”
- Overlay PNG and WebP are valid files; the PNG shows the honest “no GPS metadata” notice
- Overlay JPG also carries GPS; Original JPG has no GPS; overlay pixels differ from the original
- All 5 templates render with no runtime errors
- Offline: app shell loads from cache and the offline banner appears; caches hold no geocoding or photo data
- Location permission denied → clear error message

### Production build
`tsc -b && vite build` has no errors. Main bundle is about 82 kB gzip. The editor and How It Works are lazy-loaded (about 18 kB gzip). Precache is 18 entries.

## Manual device checklist (still to do; these need real hardware)
Run on the deployed HTTPS URL:

| Check | Android Chrome | iPhone Safari | Windows Chrome |
|---|---|---|---|
| Camera prompt (no microphone prompt) | ☐ | ☐ | ☐ |
| Rear camera default, switch to front | ☐ | ☐ | n/a |
| Torch on/off | ☐ | n/a (unsupported) | n/a |
| GPS fix outdoors < 15 m | ☐ | ☐ | ☐ (Wi-Fi location) |
| GPS EXIF JPG → open in Google Photos / Apple Photos “Info” shows the location | ☐ | ☐ | ☐ (Properties → Details → GPS) |
| PNG/WebP download | ☐ | ☐ | ☐ |
| Install to home screen, opens standalone | ☐ | ☐ | ☐ |
| Airplane mode → app opens, offline banner | ☐ | ☐ | ☐ |
| Leave camera screen → camera indicator turns off | ☐ | ☐ | ☐ |
