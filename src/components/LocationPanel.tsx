import { useState } from 'react'
import { AlertTriangle, Check, Copy, ExternalLink, Loader2, MapPin, RefreshCw, Search } from 'lucide-react'
import type { LocationState } from '../hooks/useLocation'
import { accuracyColor, accuracyLevel, fmtDate, fmtDecimal, fmtLatLng, fmtTime, mapsUrl, tzName, tzOffset } from '../lib/format'

function Row({ k, v, mono }: { k: string; v?: string | null; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-white/45">{k}</span>
      <span className={`text-right ${mono ? 'font-mono text-[13px]' : ''} ${v ? 'text-white' : 'text-white/30'}`}>{v || 'Not available'}</span>
    </div>
  )
}

export default function LocationPanel({ loc, capturedAt, compact }: { loc: LocationState; capturedAt?: Date; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  const { fix, loading, error, locate, address, addrLoading, addrError, lookup, autoAddress, setAutoAddress } = loc
  const when = capturedAt ?? (fix ? new Date(fix.timestamp) : new Date())
  const copy = async () => {
    if (!fix) return
    try { await navigator.clipboard.writeText(fmtDecimal(fix)) } catch {
      const t = document.createElement('textarea'); t.value = fmtDecimal(fix); document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove()
    }
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
  const lvl = fix ? accuracyLevel(fix.accuracy) : null

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{error.message}</span>
        </div>
      )}
      {!fix && !error && !loading && (
        <p className="text-sm text-white/55">Location is requested only when you tap the button below. It is used to tag your photo and is never stored or uploaded by GeoSnap.</p>
      )}
      {fix && (
        <div>
          <Row k="Latitude" v={fix.latitude.toFixed(6) + '°'} mono />
          <Row k="Longitude" v={fix.longitude.toFixed(6) + '°'} mono />
          <Row k="Altitude" v={fix.altitude != null ? `${fix.altitude.toFixed(1)} m${fix.altitudeAccuracy ? ` (±${Math.round(fix.altitudeAccuracy)} m)` : ''}` : null} />
          <div className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-white/45">Accuracy</span>
            <span className={`font-medium ${accuracyColor[lvl!]}`}>±{Math.round(fix.accuracy)} m · {lvl}</span>
          </div>
          {lvl === 'poor' && <p className="mb-1 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">Low GPS accuracy. Move outdoors or near a window and tap Refresh for a better fix.</p>}
          {!compact && <>
            <Row k="Date" v={fmtDate(when)} />
            <Row k="Time" v={fmtTime(when)} />
            <Row k="Timezone" v={`${tzName()} (UTC${tzOffset(when)})`} />
          </>}
          <div className="mt-2 border-t border-white/10 pt-2">
            {address ? <>
              <Row k="City" v={address.city} />
              <Row k="State" v={address.state} />
              <Row k="Country" v={address.country} />
              {!compact && <Row k="Address" v={address.displayName} />}
              <p className="mt-1 text-[10px] text-white/35">Address © OpenStreetMap contributors</p>
            </> : addrLoading ? (
              <p className="flex items-center gap-2 py-1.5 text-sm text-white/55"><Loader2 size={14} className="animate-spin" /> Looking up address…</p>
            ) : (
              <div className="space-y-2">
                {addrError && <p className="text-xs text-amber-300">{addrError}</p>}
                <button className="btn-ghost w-full !py-2" onClick={() => lookup(fix)} disabled={!navigator.onLine}><Search size={15} /> {addrError ? 'Retry address lookup' : 'Look up address'}</button>
                <p className="text-[11px] leading-snug text-white/40">Address lookup sends your coordinates to OpenStreetMap Nominatim and requires internet. Your photo is never sent.</p>
              </div>
            )}
            <label className="mt-2 flex items-center gap-2 text-xs text-white/55">
              <input type="checkbox" className="accent-amber-400" checked={autoAddress} onChange={(e) => setAutoAddress(e.target.checked)} />
              Always look up the address automatically
            </label>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary flex-1 !py-2.5" onClick={locate} disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : fix ? <RefreshCw size={16} /> : <MapPin size={16} />}
          {loading ? 'Getting GPS fix…' : fix ? 'Refresh location' : 'Get my location'}
        </button>
        {fix && <>
          <button className="btn-ghost !px-3.5 !py-2.5" onClick={copy} aria-label="Copy coordinates" title={fmtLatLng(fix)}>{copied ? <Check size={16} /> : <Copy size={16} />}<span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span></button>
          <a className="btn-ghost !px-3.5 !py-2.5" href={mapsUrl(fix)} target="_blank" rel="noopener noreferrer" aria-label="Open in Google Maps"><ExternalLink size={16} /><span className="hidden sm:inline">Maps</span></a>
        </>}
      </div>
    </div>
  )
}
