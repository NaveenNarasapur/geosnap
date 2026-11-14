import { Camera, Download, MapPin, ShieldCheck, SlidersHorizontal, X } from 'lucide-react'

const steps = [
  { icon: Camera, t: 'Allow the camera', d: 'GeoSnap asks for video only — never the microphone. The rear camera opens by default.' },
  { icon: MapPin, t: 'Get your location', d: 'Tap the location button. Your device GPS provides latitude, longitude, accuracy and altitude (when available).' },
  { icon: SlidersHorizontal, t: 'Capture & customise', d: 'Take the photo, then choose an overlay template, position and which details to show — or hide it entirely.' },
  { icon: Download, t: 'Export', d: 'Download JPG/JPEG with real EXIF GPS tags (verified after writing), or PNG/WebP. PNG and WebP do not carry standard EXIF GPS.' },
  { icon: ShieldCheck, t: 'Private by design', d: 'Photos never leave your device. Only if you request an address are your coordinates sent to OpenStreetMap Nominatim.' },
]

export default function HowItWorks({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-label="How GeoSnap works">
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-b-none p-6 sm:rounded-2xl animate-fadeUp safe-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">How It Works</h2>
          <button className="icon-btn !h-9 !w-9" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <ol className="mt-5 space-y-4">
          {steps.map(({ icon: Icon, t, d }, i) => (
            <li key={t} className="flex gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent"><Icon size={18} /></div>
              <div><p className="font-medium">{i + 1}. {t}</p><p className="mt-0.5 text-sm text-white/55">{d}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
