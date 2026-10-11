// Shown at once when a menu item is tapped, while the page's data loads.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-[18px]" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-8 w-64 rounded-lg bg-s2" />
        <div className="h-4 w-80 rounded bg-s2" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-[92px] rounded-xl border border-line bg-surface" />)}
      </div>
      <div className="h-80 rounded-xl border border-line bg-surface" />
    </div>
  )
}
