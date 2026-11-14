import piexif from 'piexifjs'
import type { GeoFix } from './types'

/*
 * Real EXIF GPS embedding for JPEG.
 * piexifjs rewrites only the APP1 (EXIF) segment of the JPEG; the compressed
 * image data (scan) is copied byte-for-byte, so no recompression happens.
 */

type Rational = [number, number]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExifObj = { '0th'?: Record<number, any>; Exif?: Record<number, any>; GPS?: Record<number, any>; [k: string]: any }

export function toBinaryString(bytes: Uint8Array): string {
  let out = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) out += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[])
  return out
}

export function fromBinaryString(s: string): Uint8Array {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff
  return out
}

export function isJpeg(bytes: Uint8Array) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

/** Decimal degrees -> EXIF [deg, min, sec] rationals (sec with 1/10000 precision). */
export function toDmsRational(decimal: number): [Rational, Rational, Rational] {
  const abs = Math.abs(decimal)
  let d = Math.floor(abs)
  let m = Math.floor((abs - d) * 60)
  let s = Math.round(((abs - d) * 60 - m) * 60 * 10000)
  if (s >= 600000) { s -= 600000; m += 1 }
  if (m >= 60) { m -= 60; d += 1 }
  return [[d, 1], [m, 1], [s, 10000]]
}

export function fromDmsRational(dms: number[][], ref: string): number {
  const [d, m, s] = dms.map(([n, den]) => n / den)
  const v = d + m / 60 + s / 3600
  return ref === 'S' || ref === 'W' ? -v : v
}

// Register tags newer than piexifjs' built-in table (EXIF 2.31 offsets, GPS positioning error).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TAGS = (piexif as any).TAGS as Record<string, Record<number, { name: string; type: string }>>
TAGS.Exif[36880] ??= { name: 'OffsetTime', type: 'Ascii' }
TAGS.Exif[36881] ??= { name: 'OffsetTimeOriginal', type: 'Ascii' }
TAGS.Exif[36882] ??= { name: 'OffsetTimeDigitized', type: 'Ascii' }
TAGS.GPS[31] ??= { name: 'GPSHPositioningError', type: 'Rational' }

/** Drop tags piexifjs can't serialise (vendor/unknown tags from some cameras) so dump() never throws. */
function sanitize(exif: ExifObj) {
  for (const [ifd, table] of [['0th', TAGS.Image], ['Exif', TAGS.Exif], ['GPS', TAGS.GPS]] as const) {
    const o = exif[ifd]; if (!o) continue
    for (const k of Object.keys(o)) if (!table[Number(k)]) delete o[Number(k)]
  }
  delete exif.Interop
  if (exif.Exif) delete exif.Exif[piexif.ExifIFD.InteroperabilityTag]
  if (exif['0th']) { delete exif['0th'][piexif.ImageIFD.ExifTag]; delete exif['0th'][piexif.ImageIFD.GPSTag] }
  return exif
}

const pad = (n: number) => String(n).padStart(2, '0')
const exifLocal = (d: Date) => `${d.getFullYear()}:${pad(d.getMonth() + 1)}:${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
const offset = (d: Date) => {
  const m = -d.getTimezoneOffset(), a = Math.abs(m)
  return `${m >= 0 ? '+' : '-'}${pad(Math.floor(a / 60))}:${pad(a % 60)}`
}

export interface EmbedOptions {
  fix: GeoFix | null
  capturedAt: Date
  /** When true, any existing GPS tags are removed and none are written. */
  stripLocation?: boolean
  /** Set when pixels were re-rendered upright, so a stale Orientation tag must be reset. */
  resetOrientation?: boolean
  width?: number
  height?: number
}

/** Insert/replace EXIF in a JPEG. Keeps existing non-GPS tags from the camera when present. */
export function embedExif(jpeg: Uint8Array, o: EmbedOptions): Uint8Array {
  if (!isJpeg(jpeg)) throw new Error('Not a JPEG file — EXIF GPS can only be embedded in JPEG.')
  const bin = toBinaryString(jpeg)
  let exif: ExifObj
  try { exif = piexif.load(bin) as ExifObj } catch { exif = {} as ExifObj }
  exif['0th'] = exif['0th'] ?? {}
  exif.Exif = exif.Exif ?? {}
  exif.GPS = {}
  delete (exif as Record<string, unknown>).thumbnail
  delete (exif as Record<string, unknown>)['1st']

  const z = exif['0th']!, e = exif.Exif!, g = exif.GPS!
  z[piexif.ImageIFD.Software] = 'GeoSnap'
  z[piexif.ImageIFD.DateTime] = exifLocal(o.capturedAt)
  if (o.resetOrientation) z[piexif.ImageIFD.Orientation] = 1
  e[piexif.ExifIFD.DateTimeOriginal] = exifLocal(o.capturedAt)
  e[piexif.ExifIFD.DateTimeDigitized] = exifLocal(o.capturedAt)
  e[36880] = offset(o.capturedAt) // OffsetTime
  e[36882] = offset(o.capturedAt) // OffsetTimeDigitized
  e[36881] = offset(o.capturedAt) // OffsetTimeOriginal
  if (o.width && o.height) { e[piexif.ExifIFD.PixelXDimension] = o.width; e[piexif.ExifIFD.PixelYDimension] = o.height }

  if (o.fix && !o.stripLocation) {
    const f = o.fix
    g[piexif.GPSIFD.GPSVersionID] = [2, 3, 0, 0]
    g[piexif.GPSIFD.GPSLatitudeRef] = f.latitude >= 0 ? 'N' : 'S'
    g[piexif.GPSIFD.GPSLatitude] = toDmsRational(f.latitude)
    g[piexif.GPSIFD.GPSLongitudeRef] = f.longitude >= 0 ? 'E' : 'W'
    g[piexif.GPSIFD.GPSLongitude] = toDmsRational(f.longitude)
    if (f.altitude != null && Number.isFinite(f.altitude)) {
      g[piexif.GPSIFD.GPSAltitudeRef] = f.altitude < 0 ? 1 : 0
      g[piexif.GPSIFD.GPSAltitude] = [Math.round(Math.abs(f.altitude) * 100), 100]
    }
    const t = new Date(f.timestamp)
    g[piexif.GPSIFD.GPSDateStamp] = `${t.getUTCFullYear()}:${pad(t.getUTCMonth() + 1)}:${pad(t.getUTCDate())}`
    g[piexif.GPSIFD.GPSTimeStamp] = [[t.getUTCHours(), 1], [t.getUTCMinutes(), 1], [t.getUTCSeconds(), 1]]
    g[piexif.GPSIFD.GPSMapDatum] = 'WGS-84'
    g[31] = [Math.round(f.accuracy * 100), 100] // GPSHPositioningError (meters)
  }

  // Strip any old APP1 first so we never leave two EXIF blocks.
  let clean = bin
  try { clean = piexif.remove(bin) } catch { /* no exif present */ }
  return fromBinaryString(piexif.insert(piexif.dump(sanitize(exif) as never), clean))
}

export interface VerifyResult {
  ok: boolean
  hasGps: boolean
  latitude?: number
  longitude?: number
  altitude?: number
  dateTimeOriginal?: string
  gpsDate?: string
  problems: string[]
}

/** Re-parse the exported bytes and compare against the intended fix. */
export function verifyExif(jpeg: Uint8Array, expected: GeoFix | null): VerifyResult {
  const problems: string[] = []
  let data: ExifObj
  try { data = piexif.load(toBinaryString(jpeg)) as ExifObj } catch (err) {
    return { ok: false, hasGps: false, problems: [`EXIF could not be read back: ${(err as Error).message}`] }
  }
  const g = data.GPS ?? {}
  const lat = g[piexif.GPSIFD.GPSLatitude], latRef = g[piexif.GPSIFD.GPSLatitudeRef]
  const lon = g[piexif.GPSIFD.GPSLongitude], lonRef = g[piexif.GPSIFD.GPSLongitudeRef]
  const hasGps = Array.isArray(lat) && Array.isArray(lon) && !!latRef && !!lonRef
  const r: VerifyResult = { ok: false, hasGps, problems, dateTimeOriginal: data.Exif?.[piexif.ExifIFD.DateTimeOriginal] as string | undefined }
  if (hasGps) {
    r.latitude = fromDmsRational(lat as number[][], latRef as string)
    r.longitude = fromDmsRational(lon as number[][], lonRef as string)
    const alt = g[piexif.GPSIFD.GPSAltitude] as number[] | undefined
    if (alt) r.altitude = (alt[0] / alt[1]) * (g[piexif.GPSIFD.GPSAltitudeRef] === 1 ? -1 : 1)
    r.gpsDate = g[piexif.GPSIFD.GPSDateStamp] as string | undefined
  }
  if (expected) {
    if (!hasGps) problems.push('GPS tags are missing from the exported file.')
    else {
      if (Math.abs(r.latitude! - expected.latitude) > 1e-6) problems.push('Latitude in file does not match the captured fix.')
      if (Math.abs(r.longitude! - expected.longitude) > 1e-6) problems.push('Longitude in file does not match the captured fix.')
      if (expected.altitude != null && (r.altitude == null || Math.abs(r.altitude - expected.altitude) > 0.01)) problems.push('Altitude in file does not match.')
    }
    if (!r.dateTimeOriginal) problems.push('DateTimeOriginal is missing.')
  } else if (hasGps) problems.push('GPS tags are present although location removal was requested.')
  r.ok = problems.length === 0
  return r
}
