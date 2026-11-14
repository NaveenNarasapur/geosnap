import type { GeoFix } from './types'

export const fmtCoord = (v: number, pos: string, neg: string) =>
  `${Math.abs(v).toFixed(6)}° ${v >= 0 ? pos : neg}`

export const fmtLatLng = (f: Pick<GeoFix, 'latitude' | 'longitude'>) =>
  `${fmtCoord(f.latitude, 'N', 'S')}, ${fmtCoord(f.longitude, 'E', 'W')}`

export const fmtDecimal = (f: Pick<GeoFix, 'latitude' | 'longitude'>) =>
  `${f.latitude.toFixed(6)}, ${f.longitude.toFixed(6)}`

export const fmtDate = (d: Date) =>
  d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

export const fmtTime = (d: Date) =>
  d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export const tzOffset = (d: Date) => {
  const m = -d.getTimezoneOffset()
  const s = m >= 0 ? '+' : '-'
  const a = Math.abs(m)
  return `${s}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`
}

export const tzName = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return '' }
}

export type AccuracyLevel = 'excellent' | 'good' | 'fair' | 'poor'
export const accuracyLevel = (m: number): AccuracyLevel =>
  m <= 10 ? 'excellent' : m <= 30 ? 'good' : m <= 100 ? 'fair' : 'poor'

export const accuracyColor: Record<AccuracyLevel, string> = {
  excellent: 'text-emerald-400', good: 'text-lime-400', fair: 'text-amber-400', poor: 'text-red-400',
}

export const mapsUrl = (f: Pick<GeoFix, 'latitude' | 'longitude'>) =>
  `https://www.google.com/maps/search/?api=1&query=${f.latitude},${f.longitude}`
