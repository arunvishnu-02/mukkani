// Shown at once when a menu item or link is clicked, while the server builds the page.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-32 rounded bg-s2" />
      <div className="h-8 w-64 rounded bg-s2" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-s2" />)}
      </div>
      <div className="h-80 rounded-xl bg-s2" />
    </div>
  )
}
