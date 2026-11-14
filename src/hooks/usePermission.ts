import { useEffect, useState } from 'react'

export type PermState = 'granted' | 'denied' | 'prompt' | 'unknown'

/** Observes a permission where the Permissions API supports it (camera is unsupported on some Safari versions). */
export function usePermission(name: 'camera' | 'geolocation', bump = 0): [PermState, (s: PermState) => void] {
  const [state, setState] = useState<PermState>('unknown')
  useEffect(() => {
    let status: PermissionStatus | null = null
    let alive = true
    const onChange = () => status && alive && setState(status.state as PermState)
    navigator.permissions?.query({ name: name as PermissionName }).then((s) => {
      if (!alive) return
      status = s; setState(s.state as PermState); s.addEventListener('change', onChange)
    }).catch(() => { /* unsupported */ })
    return () => { alive = false; status?.removeEventListener('change', onChange) }
  }, [name, bump])
  return [state, setState]
}
