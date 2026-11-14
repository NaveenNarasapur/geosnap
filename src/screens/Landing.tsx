import { useState } from 'react'
import { Aperture, Camera, Download, FileImage, Lock, MapPin, Share, Smartphone, X } from 'lucide-react'

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

const features = [
  { icon: MapPin, title: 'GPS Location Tagging', text: 'Real EXIF GPS coordinates written into your JPEGs — and verified after export.' },
  { icon: Aperture, title: 'Professional Camera Capture', text: 'Rear camera by default, lens switching, torch, and full-resolution stills where supported.' },
  { icon: FileImage, title: 'Multiple Export Formats', text: 'JPG, JPEG, PNG and WebP, with five elegant location overlay templates.' },
]

export default function Landing({ onStart, onHow, canInstall, onInstall }: { onStart: () => void; onHow: () => void; canInstall: boolean; onInstall: () => void }) {
  const [iosHelp, setIosHelp] = useState(false)
  return (
    <main className="relative min-h-full overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative mx-auto flex min-h-full max-w-5xl flex-col px-6 safe-top safe-bottom">
        <header className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2.5">
            <img src="/icons/icon-192.png" alt="" className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-semibold tracking-tight">GeoSnap</span>
          </div>
          {!isStandalone && (canInstall
            ? <button className="btn-ghost !py-2" onClick={onInstall}><Download size={16} /> Install app</button>
            : isIOS && <button className="btn-ghost !py-2" onClick={() => setIosHelp(true)}><Smartphone size={16} /> Install</button>)}
        </header>

        <section className="flex flex-1 flex-col justify-center py-12 text-center animate-fadeUp">
          <span className="mx-auto mb-6 chip bg-white/5 text-white/70 border border-white/10"><Lock size={12} /> Processed on your device. Never uploaded.</span>
          <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">GeoSnap</h1>
          <p className="mt-4 text-xl font-medium text-accent sm:text-2xl">Capture Moments. Preserve Locations.</p>
          <p className="mx-auto mt-5 max-w-xl text-base text-white/60 sm:text-lg">
            Capture beautiful photographs with accurate GPS location information embedded directly into your images.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button className="btn-primary w-full px-8 py-4 text-base sm:w-auto" onClick={onStart}><Camera size={20} /> Start Capturing</button>
            <button className="btn-ghost w-full px-8 py-4 text-base sm:w-auto" onClick={onHow}>How It Works</button>
          </div>
        </section>

        <section className="grid gap-3 pb-10 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="card p-5 animate-fadeUp" style={{ animationDelay: `${120 + i * 80}ms` }}>
              <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent"><Icon size={20} /></div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-white/55">{text}</p>
            </div>
          ))}
        </section>
        <footer className="pb-2 text-center text-xs text-white/35">
          Needs only Camera and Location permissions. Address lookup uses © OpenStreetMap contributors (Nominatim).
        </footer>
      </div>

      {iosHelp && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={() => setIosHelp(false)}>
          <div className="card w-full max-w-sm p-6 animate-fadeUp" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Install on iPhone</h2><button className="icon-btn !h-8 !w-8" aria-label="Close" onClick={() => setIosHelp(false)}><X size={16} /></button></div>
            <ol className="mt-4 space-y-3 text-sm text-white/75">
              <li>1. Open this page in <b>Safari</b>.</li>
              <li className="flex items-center gap-1">2. Tap the <Share size={16} className="inline text-accent" /> <b>Share</b> button.</li>
              <li>3. Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li>
            </ol>
            <p className="mt-4 text-xs text-white/45">GeoSnap will then open full-screen like a native app.</p>
          </div>
        </div>
      )}
    </main>
  )
}
