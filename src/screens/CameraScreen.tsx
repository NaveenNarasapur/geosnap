import { useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, Camera, ChevronDown, Flashlight, FlashlightOff, Loader2, MapPin, RefreshCw, SwitchCamera } from 'lucide-react'
import { useCamera } from '../hooks/useCamera'
import { usePermission, type PermState } from '../hooks/usePermission'
import type { LocationState } from '../hooks/useLocation'
import LocationPanel from '../components/LocationPanel'
import { accuracyColor, accuracyLevel } from '../lib/format'
import type { CapturedPhoto } from '../lib/types'

const permStyle: Record<PermState, string> = {
  granted: 'bg-emerald-500/20 text-emerald-300', denied: 'bg-red-500/20 text-red-300', prompt: 'bg-white/10 text-white/70', unknown: 'bg-white/10 text-white/60',
}

export default function CameraScreen({ location, onCaptured, onBack }: { location: LocationState; onCaptured: (p: CapturedPhoto) => void; onBack: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const cam = useCamera(videoRef)
  const [camPerm] = usePermission('camera', cam.active ? 1 : 0)
  const [geoPerm] = usePermission('geolocation', location.fix ? 1 : location.error ? 2 : 0)
  const [sheet, setSheet] = useState(false)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(false)
  const [capErr, setCapErr] = useState<string | null>(null)

  const camState: PermState = cam.active ? 'granted' : cam.error?.code === 'denied' ? 'denied' : camPerm
  const geoState: PermState = location.fix ? 'granted' : location.error?.code === 'denied' ? 'denied' : geoPerm

  const shoot = async () => {
    if (busy) return
    setBusy(true); setCapErr(null); setFlash(true); setTimeout(() => setFlash(false), 180)
    try {
      const p = await cam.capture()
      cam.stop()
      onCaptured(p)
    } catch (e) { setCapErr((e as Error).message) } finally { setBusy(false) }
  }

  const lvl = location.fix ? accuracyLevel(location.fix.accuracy) : null

  return (
    <div className="fixed inset-0 bg-black lg:flex lg:items-center lg:justify-center lg:gap-6 lg:bg-ink-950 lg:p-6">
      <div className="relative h-full w-full overflow-hidden bg-black lg:h-[min(86vh,820px)] lg:max-w-3xl lg:rounded-3xl lg:border lg:border-white/10">
        <video ref={videoRef} playsInline muted autoPlay className={`absolute inset-0 h-full w-full object-cover ${cam.facing === 'user' ? '-scale-x-100' : ''}`} />
        {flash && <div className="pointer-events-none absolute inset-0 bg-white/80" />}

        {!cam.active && (
          <div className="absolute inset-0 grid place-items-center p-8 text-center">
            {cam.error ? (
              <div className="max-w-sm">
                <AlertTriangle className="mx-auto mb-3 text-amber-400" size={36} />
                <p className="font-semibold">Camera unavailable</p>
                <p className="mt-2 text-sm text-white/60">{cam.error.message}</p>
                <button className="btn-primary mt-5" onClick={cam.retry}><RefreshCw size={16} /> Retry</button>
              </div>
            ) : <div className="flex items-center gap-2 text-white/60"><Loader2 className="animate-spin" size={18} /> Starting camera…</div>}
          </div>
        )}

        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent px-4 pb-10 safe-top">
          <button className="icon-btn" onClick={onBack} aria-label="Back"><ArrowLeft size={20} /></button>
          <div className="flex flex-wrap justify-center gap-1.5">
            <span className={`chip ${permStyle[camState]}`}><Camera size={12} /> Camera: {camState === 'unknown' ? '—' : camState}</span>
            <span className={`chip ${permStyle[geoState]}`}><MapPin size={12} /> GPS: {geoState === 'unknown' ? '—' : geoState}</span>
          </div>
          <button className="icon-btn" onClick={cam.toggleTorch} disabled={!cam.torchSupported || !cam.active} aria-label={cam.torchSupported ? 'Toggle torch' : 'Torch not supported on this device/browser'} title={cam.torchSupported ? 'Torch' : 'Torch not supported on this device/browser'}>
            {cam.torchOn ? <Flashlight size={20} className="text-accent" /> : <FlashlightOff size={20} />}
          </button>
        </div>

        {/* GPS pill */}
        <button onClick={() => (location.fix ? setSheet(true) : location.locate())} className="absolute left-1/2 top-[calc(max(env(safe-area-inset-top),0.75rem)+3.5rem)] flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/55 px-3.5 py-2 text-xs backdrop-blur-md lg:hidden">
          {location.loading ? <><Loader2 size={13} className="animate-spin" /> Getting GPS fix…</>
            : location.fix ? <><MapPin size={13} className={accuracyColor[lvl!]} /> <span className="font-mono">{location.fix.latitude.toFixed(5)}, {location.fix.longitude.toFixed(5)}</span> <span className={accuracyColor[lvl!]}>±{Math.round(location.fix.accuracy)}m</span></>
            : location.error ? <><AlertTriangle size={13} className="text-amber-400" /> Location error — tap to retry</>
            : <><MapPin size={13} className="text-accent" /> Tap to add GPS location</>}
        </button>

        {capErr && <p className="absolute inset-x-6 bottom-40 rounded-xl bg-red-500/20 p-3 text-center text-sm text-red-200">{capErr}</p>}

        {/* Bottom controls */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-8 pt-16 safe-bottom">
          <div className="mx-auto flex max-w-sm items-center justify-between pb-2">
            <button className="icon-btn !h-12 !w-12 lg:invisible" onClick={() => setSheet(true)} aria-label="Location details"><MapPin size={20} /></button>
            <button onClick={shoot} disabled={!cam.active || busy} aria-label="Capture photo" className="grid h-20 w-20 place-items-center rounded-full border-4 border-white/90 transition active:scale-90 disabled:opacity-40">
              <span className="grid h-[62px] w-[62px] place-items-center rounded-full bg-white">{busy && <Loader2 className="animate-spin text-ink-950" />}</span>
            </button>
            <button className="icon-btn !h-12 !w-12" onClick={cam.flip} disabled={!cam.hasMultiple} aria-label="Switch camera" title={cam.hasMultiple ? 'Switch front/rear camera' : 'Only one camera detected'}><SwitchCamera size={20} /></button>
          </div>
          {!location.fix && cam.active && <p className="pb-1 text-center text-[11px] text-white/50">You can capture now and add location afterwards.</p>}
        </div>
      </div>

      {/* Desktop side panel */}
      <aside className="hidden w-[360px] shrink-0 lg:block">
        <div className="card p-5">
          <p className="label mb-3">Location</p>
          <LocationPanel loc={location} />
        </div>
      </aside>

      {/* Mobile sheet */}
      {sheet && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/50 lg:hidden" onClick={() => setSheet(false)}>
          <div className="card max-h-[80vh] w-full overflow-y-auto rounded-b-none p-5 animate-fadeUp safe-bottom" onClick={(e) => e.stopPropagation()}>
            <button className="mx-auto mb-3 flex items-center gap-1 text-xs text-white/50" onClick={() => setSheet(false)}><ChevronDown size={14} /> Location information</button>
            <LocationPanel loc={location} />
          </div>
        </div>
      )}
    </div>
  )
}
