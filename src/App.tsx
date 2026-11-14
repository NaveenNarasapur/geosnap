import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { RefreshCw, WifiOff, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import Landing from './screens/Landing'
import CameraScreen from './screens/CameraScreen'
import { useLocation } from './hooks/useLocation'
import type { CapturedPhoto } from './lib/types'

const PreviewScreen = lazy(() => import('./screens/PreviewScreen'))
const HowItWorks = lazy(() => import('./components/HowItWorks'))

type Screen = 'landing' | 'camera' | 'preview'
interface BIPEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null)
  const [how, setHow] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [bip, setBip] = useState<BIPEvent | null>(null)
  const location = useLocation()
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW()

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    const onBip = (e: Event) => { e.preventDefault(); setBip(e as BIPEvent) }
    const onInstalled = () => setBip(null)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    window.addEventListener('beforeinstallprompt', onBip); window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('beforeinstallprompt', onBip); window.removeEventListener('appinstalled', onInstalled) }
  }, [])

  // Android back button / browser back navigates between screens.
  const go = useCallback((s: Screen) => { setScreen(s); if (s !== 'landing') history.pushState({ s }, '') }, [])
  useEffect(() => {
    const onPop = (e: PopStateEvent) => setScreen((e.state?.s as Screen) ?? 'landing')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const onCaptured = (p: CapturedPhoto) => { if (photo) URL.revokeObjectURL(photo.url); setPhoto(p); go('preview') }
  const retake = () => { if (photo) URL.revokeObjectURL(photo.url); setPhoto(null); setScreen('camera') }
  const install = async () => { if (!bip) return; await bip.prompt(); await bip.userChoice; setBip(null) }

  return (
    <div className="h-full">
      {!online && (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-xs font-medium text-ink-950 safe-top">
          <WifiOff size={14} /> Offline — camera, GPS and exports still work. Address lookup needs internet.
        </div>
      )}
      {screen === 'landing' && <Landing onStart={() => go('camera')} onHow={() => setHow(true)} canInstall={!!bip} onInstall={install} />}
      {screen === 'camera' && <CameraScreen location={location} onCaptured={onCaptured} onBack={() => history.back()} />}
      {screen === 'preview' && photo && (
        <Suspense fallback={<div className="grid h-full place-items-center text-white/60">Loading editor…</div>}>
          <PreviewScreen photo={photo} location={location} onRetake={retake} />
        </Suspense>
      )}
      {screen === 'preview' && !photo && <CameraScreen location={location} onCaptured={onCaptured} onBack={() => setScreen('landing')} />}
      {how && <Suspense fallback={null}><HowItWorks onClose={() => setHow(false)} /></Suspense>}
      {needRefresh && (
        <div className="fixed inset-x-3 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/10 bg-ink-800 p-3 shadow-2xl animate-fadeUp">
          <RefreshCw size={18} className="text-accent" />
          <span className="flex-1 text-sm">A new version of GeoSnap is available.</span>
          <button className="btn-primary !py-2" onClick={() => updateServiceWorker(true)}>Update</button>
          <button className="icon-btn !h-8 !w-8" aria-label="Dismiss" onClick={() => setNeedRefresh(false)}><X size={16} /></button>
        </div>
      )}
    </div>
  )
}
