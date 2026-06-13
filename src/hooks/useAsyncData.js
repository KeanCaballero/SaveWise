import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

/** Tiny data-fetching hook: runs `fn`, exposes { data, loading, refresh }. */
export function useAsyncData(fn, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    let active = true
    setLoading(true)
    fnRef
      .current()
      .then((d) => active && setData(d))
      .catch((e) => {
        console.error(e)
        if (active) toast.error('Could not load data', { description: e.message })
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const refresh = useCallback(() => setTick((t) => t + 1), [])
  return { data, loading, refresh }
}
