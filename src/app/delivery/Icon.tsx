// Line icons for the delivery screen (24px grid, stroke follows the text colour).
const PATHS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  clock: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  refresh: 'M20 11a8 8 0 10-2.3 5.7M20 5v6h-6',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  back: 'M15 6l-6 6 6 6',
  nav: 'M4 11l16-7-7 16-2-7-7-2z',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, className = 'size-5' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}
