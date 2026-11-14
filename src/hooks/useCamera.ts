import { useCallback, useEffect, useRef, useState } from 'react'
import type { CapturedPhoto } from '../lib/types'

type Facing = 'environment' | 'user'
export type CamError = { code: 'denied' | 'notfound' | 'inuse' | 'insecure' | 'unsupported' | 'unknown'; message: string }

declare global {
  interface Window { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto(o?: object): Promise<Blob>; getPhotoCapabilities(): Promise<{ imageWidth?: { max: number }; imageHeight?: { max: number } }> } }
}

function mapError(e: unknown): CamError {
  const n = (e as DOMException)?.name
  if (n === 'NotAllowedError' || n === 'SecurityError') return { code: 'denied', message: 'Camera permission was denied. Allow camera access for this site in your browser settings (tap the lock/“aA” icon in the address bar), then tap Retry.' }
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return { code: 'notfound', message: 'No usable camera was found on this device.' }
  if (n === 'NotReadableError' || n === 'AbortError') return { code: 'inuse', message: 'The camera is in use by another app or tab. Close it and tap Retry.' }
  return { code: 'unknown', message: (e as Error)?.message || 'The camera could not be started.' }
}

export function useCamera(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [facing, setFacing] = useState<Facing>('environment')
  const [active, setActive] = useState(false)
  const [error, setError] = useState<CamError | null>(null)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [hasMultiple, setHasMultiple] = useState(true)
  const streamRef = useRef<MediaStream | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setActive(false); setTorchOn(false)
  }, [videoRef])

  const start = useCallback(async (f: Facing) => {
    stop(); setError(null)
    if (!window.isSecureContext) return setError({ code: 'insecure', message: 'The camera requires a secure (HTTPS) connection.' })
    if (!navigator.mediaDevices?.getUserMedia) return setError({ code: 'unsupported', message: 'This browser does not support camera access. Try the latest Chrome, Safari, Edge or Firefox.' })
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false, // never request microphone
        video: { facingMode: { ideal: f }, width: { ideal: 3840 }, height: { ideal: 2160 } },
      })
      streamRef.current = stream
      const v = videoRef.current
      if (v) { v.srcObject = stream; await v.play().catch(() => {}) }
      const track = stream.getVideoTracks()[0]
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean }
      setTorchSupported(!!caps.torch)
      setActive(true)
      navigator.mediaDevices.enumerateDevices().then((d) => setHasMultiple(d.filter((x) => x.kind === 'videoinput').length > 1)).catch(() => {})
    } catch (e) { setError(mapError(e)) }
  }, [stop, videoRef])

  useEffect(() => { start(facing); return stop }, [facing, start, stop])

  // Release the camera when the app is backgrounded; resume when visible again.
  useEffect(() => {
    const onVis = () => { if (document.hidden) stop(); else start(facing) }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [facing, start, stop])

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try { await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] }); setTorchOn(!torchOn) }
    catch { setTorchSupported(false) }
  }, [torchOn])

  const flip = useCallback(() => setFacing((f) => (f === 'environment' ? 'user' : 'environment')), [])

  const capture = useCallback(async (): Promise<CapturedPhoto> => {
    const v = videoRef.current, track = streamRef.current?.getVideoTracks()[0]
    if (!v || !track || !v.videoWidth) throw new Error('Camera is not ready yet.')
    const capturedAt = new Date()
    // 1) Full-resolution still via ImageCapture (Chromium/Android). Rear camera only — front images would need un-mirroring checks.
    if (window.ImageCapture && facing === 'environment') {
      try {
        const ic = new window.ImageCapture(track)
        const pc = await ic.getPhotoCapabilities().catch(() => null)
        const blob = await ic.takePhoto(pc?.imageWidth?.max ? { imageWidth: pc.imageWidth.max } : {})
        if (blob.type === 'image/jpeg') {
          const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' })
          const r: CapturedPhoto = { blob, url: URL.createObjectURL(blob), width: bmp.width, height: bmp.height, capturedAt, fullResolution: true }
          bmp.close(); return r
        }
      } catch { /* fall back to frame grab */ }
    }
    // 2) Frame grab from the live stream at native video resolution.
    const c = document.createElement('canvas')
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0)
    const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Capture failed.'))), 'image/jpeg', 0.95))
    return { blob, url: URL.createObjectURL(blob), width: c.width, height: c.height, capturedAt, fullResolution: false }
  }, [facing, videoRef])

  return { facing, flip, active, error, retry: () => start(facing), stop, capture, torchSupported, torchOn, toggleTorch, hasMultiple }
}
