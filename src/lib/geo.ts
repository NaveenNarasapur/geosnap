import type { Address, GeoFix } from './types'

export type GeoErrorCode = 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'insecure'
export class GeoError extends Error {
  code: GeoErrorCode
  constructor(code: GeoErrorCode, message: string) { super(message); this.code = code }
}

export function getPosition(timeoutMs = 20000): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) return reject(new GeoError('insecure', 'Location requires HTTPS.'))
    if (!('geolocation' in navigator)) return reject(new GeoError('unsupported', 'This browser does not support location.'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({
        latitude: p.coords.latitude,
        longitude: p.coords.longitude,
        accuracy: p.coords.accuracy,
        altitude: p.coords.altitude,
        altitudeAccuracy: p.coords.altitudeAccuracy,
        timestamp: p.timestamp,
      }),
      (e) => {
        if (e.code === e.PERMISSION_DENIED) reject(new GeoError('denied', 'Location permission was denied. Enable it in your browser or system settings for this site, then tap Refresh.'))
        else if (e.code === e.TIMEOUT) reject(new GeoError('timeout', 'Getting a GPS fix took too long. Move to an open area with a clear view of the sky and try again.'))
        else reject(new GeoError('unavailable', 'Your position is currently unavailable. Make sure device location services (GPS) are turned on.'))
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    )
  })
}

// --- OpenStreetMap Nominatim reverse geocoding -------------------------------
// Usage policy: max 1 request/second, identify the app (browser sends Referer),
// cache results, no bulk use. We only call on explicit user action, keep an
// in-memory cache (never persisted), and throttle to >= 1.1s between calls.
const cache = new Map<string, Address>()
let lastCall = 0

export async function reverseGeocode(lat: number, lon: number, signal?: AbortSignal): Promise<Address> {
  if (!navigator.onLine) throw new Error('You are offline. Address lookup needs an internet connection; coordinates still work offline.')
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`
  const hit = cache.get(key)
  if (hit) return hit
  const wait = 1100 - (Date.now() - lastCall)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lon}&accept-language=${encodeURIComponent(navigator.language || 'en')}`
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' }, referrerPolicy: 'strict-origin-when-cross-origin', cache: 'no-store' })
  if (res.status === 429) throw new Error('The address service is busy (rate limited). Please wait a moment and try again.')
  if (!res.ok) throw new Error(`Address lookup failed (HTTP ${res.status}).`)
  const j = await res.json()
  if (j.error) throw new Error('No address found for this location.')
  const a = j.address ?? {}
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.hamlet ?? a.suburb ?? a.county
  const addr: Address = {
    city,
    state: a.state ?? a.region ?? a.state_district,
    country: a.country,
    displayName: j.display_name,
    shortName: [a.neighbourhood ?? a.suburb ?? a.road, city].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(', ') || undefined,
  }
  cache.set(key, addr)
  return addr
}
