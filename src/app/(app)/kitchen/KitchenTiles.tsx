import { Tile, Tiles } from '@/components/ui'
import type { kitchenToday } from '@/lib/queries'

export function KitchenTiles({ k }: { k: Awaited<ReturnType<typeof kitchenToday>> }) {
  return (
    <Tiles cols={6}>
      <Tile big label="Total boxes today" value={k.total} />
      <Tile big label="Regular boxes" value={k.packages.length} tone="leaf" />
      <Tile big label="Trial boxes" value={k.trials.length} tone="warn" />
      <Tile big label="New trials" value={k.newTrials} sub="start today" tone="sky" />
      <Tile big label="Trials ending" value={k.endingTrials} sub="end today" tone="warn" />
      <Tile big label="Paused" value={k.paused} sub="no box today" tone="muted" />
    </Tiles>
  )
}
