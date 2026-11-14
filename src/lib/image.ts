import { drawOverlay, type OverlayInfo } from './overlay'
import { embedExif, verifyExif, type VerifyResult } from './exif'
import type { CapturedPhoto, ExportFormat, ExportMode, GeoFix, OverlaySettings } from './types'

export const MIME: Record<ExportFormat, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

export function canEncode(mime: string): Promise<boolean> {
  const c = document.createElement('canvas'); c.width = c.height = 2
  return new Promise((r) => c.toBlob((b) => r(!!b && b.type === mime), mime))
}

function toBlob(c: HTMLCanvasElement | OffscreenCanvas, type: string, quality?: number): Promise<Blob> {
  if ('convertToBlob' in c) return c.convertToBlob({ type, quality })
  return new Promise((res, rej) => (c as HTMLCanvasElement).toBlob((b) => (b ? res(b) : rej(new Error(`Your browser cannot encode ${type}.`))), type, quality))
}

function makeCanvas(w: number, h: number) {
  if (typeof OffscreenCanvas !== 'undefined') {
    try { const oc = new OffscreenCanvas(w, h); if (oc.getContext('2d')) return oc } catch { /* fall through */ }
  }
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c
}

export async function loadBitmap(blob: Blob): Promise<ImageBitmap> {
  try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }) } catch { return await createImageBitmap(blob) }
}

export interface ExportRequest {
  photo: CapturedPhoto
  mode: ExportMode
  format: ExportFormat
  quality: number // 0.5 - 1
  overlay: OverlaySettings
  info: OverlayInfo
  fix: GeoFix | null
  /** For JPEG overlay exports: also write GPS EXIF. */
  embedGps: boolean
}

export interface ExportResult {
  blob: Blob
  filename: string
  verification: VerifyResult | null
  gpsEmbedded: boolean
  lossless: boolean
  note?: string
}

export async function exportPhoto(r: ExportRequest): Promise<ExportResult> {
  const fmt: ExportFormat = r.mode === 'exif' ? (r.format === 'jpeg' ? 'jpeg' : 'jpg') : r.format
  const mime = MIME[fmt]
  const stamp = r.photo.capturedAt.toISOString().replace(/[:T]/g, '-').slice(0, 19)
  const filename = `GeoSnap_${stamp}_${r.mode}.${fmt}`
  const isJpegOut = mime === 'image/jpeg'
  const wantGps = isJpegOut && (r.mode === 'exif' || (r.mode === 'overlay' && r.embedGps))
  if (r.mode === 'exif' && !r.fix) throw new Error('No GPS fix available. Get your location first, then export the GPS EXIF photo.')

  let blob: Blob
  let lossless = false
  const srcIsJpeg = r.photo.blob.type === 'image/jpeg'
  const needsRender = r.mode === 'overlay' && r.overlay.visible

  if (!needsRender && isJpegOut && srcIsJpeg && r.quality >= 0.92) {
    // Byte-exact original pixels: only the EXIF segment is rewritten (no recompression).
    blob = r.photo.blob; lossless = true
  } else {
    const bmp = await loadBitmap(r.photo.blob)
    const c = makeCanvas(bmp.width, bmp.height)
    const ctx = c.getContext('2d') as CanvasRenderingContext2D
    ctx.drawImage(bmp, 0, 0)
    if (needsRender) {
      // Yield so the UI can paint the "processing" state before heavy work.
      await new Promise((res) => setTimeout(res, 0))
      drawOverlay(ctx, bmp.width, bmp.height, r.info, r.overlay)
    }
    bmp.close()
    blob = await toBlob(c, mime, mime === 'image/png' ? undefined : r.quality)
    if (blob.type !== mime) throw new Error(`Your browser does not support exporting ${fmt.toUpperCase()}. Try JPG or PNG instead.`)
  }

  let verification: VerifyResult | null = null
  if (isJpegOut) {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const out = embedExif(bytes, {
      fix: wantGps ? r.fix : null,
      stripLocation: !wantGps,
      capturedAt: r.photo.capturedAt,
      resetOrientation: !lossless,
      width: r.photo.width, height: r.photo.height,
    })
    verification = verifyExif(out, wantGps ? r.fix : null)
    if (!verification.ok) throw Object.assign(new Error('EXIF verification failed: ' + verification.problems.join(' ')), { verification })
    blob = new Blob([out as BlobPart], { type: 'image/jpeg' })
  }

  return {
    blob, filename, verification, lossless,
    gpsEmbedded: !!verification?.ok && verification.hasGps,
    note: isJpegOut ? undefined : `${fmt.toUpperCase()} files do not carry standard JPEG EXIF GPS metadata. This file contains no embedded location data${r.mode === 'overlay' && r.overlay.visible ? ' (the location is only visible in the overlay)' : ''}.`,
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.rel = 'noopener'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** Share sheet (iOS saves to Photos this way). Returns false if unsupported. */
export async function shareBlob(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (!nav.canShare?.({ files: [file] })) return false
  try { await navigator.share({ files: [file], title: 'GeoSnap photo' }); return true } catch (e) { if ((e as Error).name === 'AbortError') return true; return false }
}
