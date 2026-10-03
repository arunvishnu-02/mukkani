// OpenStreetMap embed: free, no API key.
export function MapPin({ lat, lng, height = 170 }: { lat: number; lng: number; height?: number }) {
  const d = 0.004
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`
  return <iframe title="Map" src={src} className="w-full rounded-[10px] border border-line" style={{ height }} loading="lazy" />
}
