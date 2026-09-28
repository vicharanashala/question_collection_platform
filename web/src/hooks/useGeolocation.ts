import { useState, useCallback } from 'react'

export interface Coordinates {
  latitude: number
  longitude: number
}

export function useGeolocation() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const getCurrentPosition = useCallback((): Promise<Coordinates> => {
    setLoading(true)
    setError(null)
    setPermissionDenied(false)
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const msg = 'Location services are not available on this device.'
        setError(msg)
        setLoading(false)
        reject(new Error(msg))
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLoading(false)
          resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        },
        (err) => {
          setLoading(false)
          if (err.code === err.PERMISSION_DENIED) {
            setPermissionDenied(true)
            setError('Location permission was denied.')
          } else {
            setError('Could not determine your location. Please try again.')
          }
          reject(new Error('location_failed'))
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      )
    })
  }, [])

  return { getCurrentPosition, loading, error, permissionDenied }
}