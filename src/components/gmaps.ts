'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
// Loads the Google Maps JavaScript API once per page. The key comes from the server (GOOGLE_MAPS_BROWSER_KEY).
let loading: Promise<any> | null = null

export function loadGoogleMaps(key: string): Promise<any> {
  const w = window as any
  if (w.google?.maps?.Map) return Promise.resolve(w.google.maps)
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    w.__mkMapsReady = () => resolve(w.google.maps)
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=__mkMapsReady`
    s.async = true
    s.onerror = () => {
      loading = null
      reject(new Error('Google Maps did not load'))
    }
    document.head.appendChild(s)
  })
  return loading
}

export const MAP_OPTIONS = {
  disableDefaultUI: true,
  zoomControl: true,
  clickableIcons: false,
  gestureHandling: 'greedy',
  styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
}
