import { useCallback, useEffect, useRef, useState } from 'react'
import { GeoError, getPosition, reverseGeocode } from '../lib/geo'
import type { Address, GeoFix } from '../lib/types'

const AUTO_KEY = 'geosnap.autoAddress' // stores only a yes/no preference, never location

export function useLocation() {
  const [fix, setFix] = useState<GeoFix | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const [address, setAddress] = useState<Address | null>(null)
  const [addrLoading, setAddrLoading] = useState(false)
  const [addrError, setAddrError] = useState<string | null>(null)
  const [autoAddress, setAutoAddressState] = useState(() => { try { return localStorage.getItem(AUTO_KEY) === '1' } catch { return false } })
  const abort = useRef<AbortController | null>(null)

  const setAutoAddress = (v: boolean) => { setAutoAddressState(v); try { localStorage.setItem(AUTO_KEY, v ? '1' : '0') } catch { /* ignore */ } }

  const lookup = useCallback(async (f: GeoFix) => {
    abort.current?.abort()
    const ac = new AbortController(); abort.current = ac
    setAddrLoading(true); setAddrError(null)
    try { setAddress(await reverseGeocode(f.latitude, f.longitude, ac.signal)) }
    catch (e) { if ((e as Error).name !== 'AbortError') { setAddress(null); setAddrError((e as Error).message || 'Address lookup failed.') } }
    finally { if (abort.current === ac) setAddrLoading(false) }
  }, [])

  const locate = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const f = await getPosition()
      setFix(f); setAddress(null); setAddrError(null)
      return f
    } catch (e) {
      const ge = e as GeoError
      setError({ code: ge.code ?? 'unavailable', message: ge.message })
      return null
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (fix && autoAddress && !address && !addrLoading && !addrError) lookup(fix) }, [fix, autoAddress, address, addrLoading, addrError, lookup])
  useEffect(() => () => abort.current?.abort(), [])

  return { fix, loading, error, locate, address, addrLoading, addrError, lookup, autoAddress, setAutoAddress }
}
export type LocationState = ReturnType<typeof useLocation>
