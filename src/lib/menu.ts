// Fruit swaps (plan doc section 8): a customer who can't have a fruit on the menu gets another fruit.
// The menu is matched against each customer's foods to avoid and health notes.

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function splitList(s: string | null | undefined): string[] {
  return (s ?? '')
    .split(/[\n,;/]/)
    .map((x) => x.trim())
    .filter(Boolean)
}

// True when the text names the fruit as a word ("banana", "no bananas", "Banana (sugar)"; "apple" is not "pineapple").
export function mentions(text: string, fruit: string) {
  const f = fruit.trim()
  if (!f) return false
  return new RegExp(`\\b${escape(f)}(e?s)?\\b`, 'i').test(text)
}

export type Swap = { avoids: string[]; swapTo: string | null }

// Customers are given swap fruits in turn so the kitchen's swap fruit is spread out.
export function matchSwaps<T extends { id: string; avoidFoods: string | null; healthNotes: string | null }>(
  customers: T[],
  menuFruits: string[],
  swapFruits: string[],
): Map<string, Swap> {
  const out = new Map<string, Swap>()
  let turn = 0
  for (const c of customers) {
    const text = [c.avoidFoods, c.healthNotes].filter(Boolean).join(', ')
    if (!text) continue
    const avoids = menuFruits.filter((f) => mentions(text, f))
    if (avoids.length === 0) continue
    const allowed = swapFruits.filter((f) => !mentions(text, f) && !menuFruits.includes(f))
    const pool = allowed.length ? allowed : swapFruits.filter((f) => !mentions(text, f))
    const swapTo = pool.length ? pool[turn++ % pool.length] : null
    out.set(c.id, { avoids, swapTo })
  }
  return out
}
