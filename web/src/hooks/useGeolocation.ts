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
      const onSuccess = (pos: GeolocationPosition) => {
        setLoading(false)
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
      }
      const onFailure = (err: GeolocationPositionError) => {
        setLoading(false)
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied.'
            : 'Could not determine your location. Please try again.'
        if (err.code === err.PERMISSION_DENIED) setPermissionDenied(true)
        setError(msg)
        reject(new Error(msg))
      }
      // Try high accuracy first, then fall back to network based location and a recent cached fix,
      // since GPS often times out indoors or on devices without a GPS chip.
      navigator.geolocation.getCurrentPosition(
        onSuccess,
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            onFailure(err)
            return
          }
          navigator.geolocation.getCurrentPosition(onSuccess, onFailure, {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 5 * 60 * 1000,
          })
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60 * 1000 },
      )
    })
  }, [])

  return { getCurrentPosition, loading, error, permissionDenied }
}