import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Eye, EyeOff, Info, Loader2, MapPin, Share2, ShieldCheck, ShieldOff } from 'lucide-react'
import type { LocationState } from '../hooks/useLocation'
import LocationPanel from '../components/LocationPanel'
import { drawOverlay, TEMPLATES, type OverlayInfo } from '../lib/overlay'
import { canEncode, downloadBlob, exportPhoto, loadBitmap, shareBlob, type ExportResult } from '../lib/image'
import type { CapturedPhoto, ExportFormat, ExportMode, OverlayPosition, OverlaySettings } from '../lib/types'

const POSITIONS: { id: OverlayPosition; label: string }[] = [
  { id: 'top-left', label: 'Top left' }, { id: 'top-right', label: 'Top right' },
  { id: 'bottom-left', label: 'Bottom left' }, { id: 'bottom-center', label: 'Bottom center' }, { id: 'bottom-right', label: 'Bottom right' },
]
const FIELDS: { k: keyof OverlaySettings['fields']; label: string }[] = [
  { k: 'place', label: 'Location name' }, { k: 'coords', label: 'Coordinates' }, { k: 'date', label: 'Date' },
  { k: 'time', label: 'Time' }, { k: 'altitude', label: 'Altitude' }, { k: 'accuracy', label: 'Accuracy' },
]
const MODES: { id: ExportMode; label: string; desc: string }[] = [
  { id: 'original', label: 'Original', desc: 'No overlay, location metadata removed' },
  { id: 'overlay', label: 'Location Overlay', desc: 'Location printed on the image' },
  { id: 'exif', label: 'GPS EXIF', desc: 'JPEG with verified GPS metadata' },
]
const PREVIEW_MAX = 1600

export default function PreviewScreen({ photo, location, onRetake }: { photo: CapturedPhoto; location: LocationState; onRetake: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [overlay, setOverlay] = useState<OverlaySettings>({
    visible: true, template: 'travel', position: 'bottom-left', customTitle: '', scale: 1,
    fields: { place: true, coords: true, date: true, time: true, altitude: false, accuracy: false },
  })
  const [mode, setMode] = useState<ExportMode>('exif')
  const [format, setFormat] = useState<ExportFormat>('jpg')
  const [quality, setQuality] = useState(0.95)
  const [embedGps, setEmbedGps] = useState(true)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ExportResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [webpOk, setWebpOk] = useState(true)
  const [tab, setTab] = useState<'overlay' | 'location' | 'export'>('overlay')

  const { fix, address } = location
  useEffect(() => { canEncode('image/webp').then(setWebpOk) }, [])

  // Decode a downscaled bitmap once for the live preview.
  useEffect(() => {
    let alive = true, bmp: ImageBitmap | null = null
    ;(async () => {
      const full = await loadBitmap(photo.blob)
      const s = Math.min(1, PREVIEW_MAX / Math.max(full.width, full.height))
      bmp = s < 1 ? await createImageBitmap(full, { resizeWidth: Math.round(full.width * s), resizeHeight: Math.round(full.height * s), resizeQuality: 'high' }) : full
      if (bmp !== full) full.close()
      if (alive) setBitmap(bmp); else bmp.close()
    })().catch(() => setErr('This photo could not be decoded for preview.'))
    return () => { alive = false; bmp?.close() }
  }, [photo])

  const info: OverlayInfo = useMemo(() => ({
    title: address?.shortName || address?.city || (fix ? 'GPS Location' : undefined),
    subtitle: [address?.state, address?.country].filter(Boolean).join(', ') || undefined,
    latitude: fix?.latitude, longitude: fix?.longitude, altitude: fix?.altitude, accuracy: fix?.accuracy,
    date: photo.capturedAt,
  }), [address, fix, photo.capturedAt])

  const showOverlay = mode === 'overlay'
  useEffect(() => {
    const c = canvasRef.current
    if (!c || !bitmap) return
    const id = requestAnimationFrame(() => {
      c.width = bitmap.width; c.height = bitmap.height
      const ctx = c.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)
      if (showOverlay) drawOverlay(ctx, c.width, c.height, info, overlay)
    })
    return () => cancelAnimationFrame(id)
  }, [bitmap, info, overlay, showOverlay])

  useEffect(() => { setResult(null); setErr(null) }, [mode, format, quality, overlay, fix, embedGps])

  const isJpeg = format === 'jpg' || format === 'jpeg'
  const set = <K extends keyof OverlaySettings>(k: K, v: OverlaySettings[K]) => setOverlay((o) => ({ ...o, [k]: v }))

  const doExport = async () => {
    setBusy(true); setErr(null); setResult(null)
    await new Promise((r) => setTimeout(r, 30))
    try {
      const r = await exportPhoto({ photo, mode, format: mode === 'exif' && !isJpeg ? 'jpg' : format, quality, overlay, info, fix, embedGps })
      setResult(r)
      downloadBlob(r.blob, r.filename)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const exifBlocked = mode === 'exif' && !fix

  return (
    <div className="min-h-full bg-ink-950 lg:flex lg:h-full">
      {/* Preview */}
      <div className="relative flex flex-col lg:flex-1 lg:p-6">
        <div className="flex items-center justify-between px-4 py-3 safe-top lg:px-0 lg:pt-0">
          <button className="btn-ghost !px-3.5 !py-2" onClick={onRetake}><ArrowLeft size={16} /> Retake</button>
          <span className="text-xs text-white/45">{photo.width}×{photo.height}{photo.fullResolution ? ' · full-res' : ''}</span>
        </div>
        <div className="flex flex-1 items-center justify-center bg-black lg:rounded-3xl lg:border lg:border-white/10">
          {bitmap ? <canvas ref={canvasRef} className="max-h-[55vh] w-auto max-w-full object-contain lg:max-h-[calc(100vh-7rem)]" />
            : <div className="flex h-[40vh] items-center gap-2 text-white/50"><Loader2 className="animate-spin" size={18} /> Preparing preview…</div>}
        </div>
        {mode === 'overlay' && <p className="py-2 text-center text-[11px] text-white/40">Live preview — the original photo is untouched until you export.</p>}
      </div>

      {/* Editing panel */}
      <aside className="w-full border-white/10 lg:h-full lg:w-[400px] lg:overflow-y-auto lg:border-l">
        <div className="sticky top-0 z-10 flex gap-1 border-b border-white/10 bg-ink-950/95 p-2 backdrop-blur">
          {(['overlay', 'location', 'export'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize ${tab === t ? 'bg-white/10 text-white' : 'text-white/50'}`}>{t}</button>
          ))}
        </div>
        <div className="space-y-5 p-4 pb-32 lg:pb-6">
          {/* Export mode always visible */}
          <div>
            <p className="label mb-2">Export mode</p>
            <div className="grid grid-cols-3 gap-2">
              {MODES.map((m) => (
                <button key={m.id} onClick={() => { setMode(m.id); if (m.id === 'exif' && !isJpeg) setFormat('jpg') }} className={`seg text-left ${mode === m.id ? 'seg-on' : 'seg-off'}`}>
                  <span className="block font-semibold">{m.label}</span>
                  <span className={`mt-0.5 block text-[10px] leading-tight ${mode === m.id ? 'text-ink-950/60' : 'text-white/40'}`}>{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {tab === 'overlay' && (mode !== 'overlay' ? (
            <p className="rounded-xl bg-white/5 p-3 text-sm text-white/60">Overlay settings apply to the <b>Location Overlay</b> export mode. <button className="text-accent underline" onClick={() => setMode('overlay')}>Switch to overlay</button></p>
          ) : <>
            <div className="flex items-center justify-between">
              <p className="label">Show location overlay</p>
              <button className={`btn !py-1.5 !px-3 ${overlay.visible ? 'bg-accent text-ink-950' : 'bg-white/10'}`} onClick={() => set('visible', !overlay.visible)}>{overlay.visible ? <><Eye size={14} /> Visible</> : <><EyeOff size={14} /> Hidden</>}</button>
            </div>
            {!fix && <p className="flex gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200"><Info size={14} className="shrink-0" /> No GPS fix yet — the overlay shows only date/time. Add your location in the Location tab.</p>}
            <div className={overlay.visible ? '' : 'pointer-events-none opacity-40'}>
              <p className="label mb-2">Template</p>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map((t) => (
                  <button key={t.id} onClick={() => set('template', t.id)} className={`seg text-left ${overlay.template === t.id ? 'seg-on' : 'seg-off'}`}>
                    <span className="block font-semibold">{t.name}</span><span className={`block text-[10px] ${overlay.template === t.id ? 'text-ink-950/60' : 'text-white/40'}`}>{t.hint}</span>
                  </button>
                ))}
              </div>
              <p className="label mb-2 mt-5">Position</p>
              <div className="flex flex-wrap gap-2">
                {POSITIONS.map((p) => <button key={p.id} onClick={() => set('position', p.id)} className={`seg ${overlay.position === p.id ? 'seg-on' : 'seg-off'}`}>{p.label}</button>)}
              </div>
              <p className="label mb-2 mt-5">Location title</p>
              <input value={overlay.customTitle} onChange={(e) => set('customTitle', e.target.value)} maxLength={80}
                placeholder={info.title || 'e.g. Marine Drive, Mumbai'} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-accent" />
              <p className="label mb-2 mt-5">Details shown</p>
              <div className="grid grid-cols-2 gap-2">
                {FIELDS.map((f) => (
                  <label key={f.k} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm">
                    <input type="checkbox" className="accent-amber-400" checked={overlay.fields[f.k]} onChange={(e) => set('fields', { ...overlay.fields, [f.k]: e.target.checked })} /> {f.label}
                  </label>
                ))}
              </div>
              <p className="label mb-2 mt-5">Size</p>
              <input type="range" min={0.6} max={1.8} step={0.05} value={overlay.scale} onChange={(e) => set('scale', Number(e.target.value))} className="w-full accent-amber-400" />
            </div>
          </>)}

          {tab === 'location' && (
            <div className="card p-4"><p className="label mb-2 flex items-center gap-1.5"><MapPin size={12} /> Photo location</p><LocationPanel loc={location} capturedAt={photo.capturedAt} /></div>
          )}

          {tab === 'export' && <>
            <div>
              <p className="label mb-2">Format</p>
              <div className="grid grid-cols-4 gap-2">
                {(['jpg', 'jpeg', 'png', 'webp'] as ExportFormat[]).map((f) => {
                  const disabled = (mode === 'exif' && (f === 'png' || f === 'webp')) || (f === 'webp' && !webpOk)
                  return <button key={f} disabled={disabled} onClick={() => setFormat(f)} className={`seg uppercase disabled:opacity-30 ${format === f ? 'seg-on' : 'seg-off'}`}>{f}</button>
                })}
              </div>
              {!webpOk && <p className="mt-2 text-xs text-white/45">This browser cannot encode WebP (e.g. older Safari). Use JPG or PNG.</p>}
              {mode === 'exif' && <p className="mt-2 text-xs text-white/45">GPS EXIF export is JPEG-only — that is the format with a standard GPS metadata block.</p>}
            </div>
            {format !== 'png' && (
              <div>
                <div className="mb-2 flex justify-between"><p className="label">Quality</p><span className="text-xs text-white/60">{Math.round(quality * 100)}%</span></div>
                <input type="range" min={0.5} max={1} step={0.01} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-amber-400" />
                {isJpeg && mode !== 'overlay' && <p className="mt-1 text-[11px] text-white/40">{quality >= 0.92 ? 'At ≥92% the original camera JPEG is kept byte-for-byte (no recompression); only metadata is rewritten.' : 'Below 92% the image is re-encoded to reduce file size.'}</p>}
              </div>
            )}
            {mode === 'overlay' && isJpeg && (
              <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-sm">
                <input type="checkbox" className="accent-amber-400" checked={embedGps} onChange={(e) => setEmbedGps(e.target.checked)} disabled={!fix} /> Also embed GPS EXIF metadata {!fix && <span className="text-white/40">(needs location)</span>}
              </label>
            )}
            {!isJpeg && <p className="flex gap-2 rounded-xl bg-white/5 p-3 text-xs text-white/60"><Info size={14} className="shrink-0" /> {format.toUpperCase()} does not support standard JPEG EXIF GPS metadata. The downloaded file will contain no embedded location — only what is visibly printed in an overlay.</p>}
            {mode === 'original' && <p className="flex gap-2 rounded-xl bg-white/5 p-3 text-xs text-white/60"><ShieldOff size={14} className="shrink-0" /> Location metadata is removed from Original exports.</p>}
          </>}

          {exifBlocked && <p className="flex gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200"><AlertTriangle size={14} className="shrink-0" /> A GPS fix is required for the GPS EXIF photo. Open the Location tab and tap “Get my location”.</p>}
          {err && <p className="flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200"><AlertTriangle size={16} className="shrink-0" /> {err}</p>}
          {result && (
            <div className={`rounded-xl border p-3 text-sm ${result.gpsEmbedded ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}>
              <p className="flex items-center gap-2 font-medium">
                {result.gpsEmbedded ? <><ShieldCheck size={16} className="text-emerald-400" /> GPS metadata embedded &amp; verified</> : <><CheckCircle2 size={16} className="text-white/70" /> Downloaded — no GPS metadata in file</>}
              </p>
              {result.verification?.hasGps && <p className="mt-1 font-mono text-xs text-emerald-200/80">Read back: {result.verification.latitude!.toFixed(6)}, {result.verification.longitude!.toFixed(6)}{result.verification.altitude != null ? ` · ${result.verification.altitude.toFixed(1)} m` : ''}</p>}
              {result.verification && <p className="mt-1 text-xs text-white/50">DateTimeOriginal: {result.verification.dateTimeOriginal ?? '—'}{result.lossless ? ' · original pixels preserved' : ''}</p>}
              {result.note && <p className="mt-1 text-xs text-white/55">{result.note}</p>}
              <p className="mt-1 text-xs text-white/40">{result.filename} · {(result.blob.size / 1024 / 1024).toFixed(2)} MB</p>
              <button className="btn-ghost mt-2 !py-2" onClick={async () => { if (!(await shareBlob(result.blob, result.filename))) downloadBlob(result.blob, result.filename) }}><Share2 size={15} /> Share / Save to Photos</button>
            </div>
          )}
        </div>
        <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-ink-950/95 p-3 backdrop-blur safe-bottom lg:static lg:border-0 lg:bg-transparent lg:px-4">
          <button className="btn-primary w-full py-3.5 text-base" onClick={doExport} disabled={busy || exifBlocked}>
            {busy ? <><Loader2 size={18} className="animate-spin" /> Processing…</> : <><Download size={18} /> Download {mode === 'exif' ? 'GPS JPEG' : format.toUpperCase()}</>}
          </button>
        </div>
      </aside>
    </div>
  )
}
