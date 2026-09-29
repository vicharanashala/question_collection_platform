import { useEffect, useState } from 'react'
import { authApi } from '@/api/client'
import type { Crop } from '@/components/ui/crop-picker-modal'

interface CropsResponse {
  crops: Crop[]
}

// Shared in-flight request so every picker on the page reuses one fetch.
let cropsRequest: Promise<Crop[]> | null = null

// Fetches the crop catalogue once per session and clears the cache on failure so it can be retried.
function loadCrops(): Promise<Crop[]> {
  if (!cropsRequest) {
    cropsRequest = (authApi.getCrops() as Promise<CropsResponse>)
      .then((res) => res.crops ?? [])
      .catch((error: unknown) => {
        cropsRequest = null
        throw error
      })
  }
  return cropsRequest
}

// Returns the crop catalogue for the crop picker, loading it on first use.
export function useCrops(): Crop[] {
  const [crops, setCrops] = useState<Crop[]>([])

  useEffect(() => {
    let active = true
    loadCrops()
      .then((list) => {
        if (active) setCrops(list)
      })
      .catch((error: unknown) => console.error('Failed to fetch crops:', error))
    return () => {
      active = false
    }
  }, [])

  return crops
}
