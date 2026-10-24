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

export type Swap = {
  avoids: string[] // menu fruits the customer cannot have
  swapTo: string | null // fruit given instead
  saladAvoids: string[] // things in the day's salad the customer does not eat
  saladTo: string | null // salad given instead
}

const NOTHING = new Set(['none', 'nil', 'no', 'na', 'n/a', '-', 'nothing'])
const terms = (s: string | null | undefined) => splitList(s).filter((t) => !NOTHING.has(t.toLowerCase()))

// "No Banana → Apple" and "No peanut in salad → plain salad", for sheets, screens and reports.
export const fruitLine = (s: Swap | null | undefined) => (s && s.avoids.length ? `No ${s.avoids.join(', ')}${s.swapTo ? ` → ${s.swapTo}` : ''}` : '')
export const saladLine = (s: Swap | null | undefined) => (s && s.saladAvoids.length ? `No ${s.saladAvoids.join(', ')} in salad${s.saladTo ? ` → ${s.saladTo}` : ''}` : '')
export const hasSwap = (s: Swap | null | undefined) => !!s && (s.avoids.length > 0 || s.saladAvoids.length > 0)

// Customers are given swap fruits in turn so the kitchen's swap fruit is spread out.
// Salad: anything the customer avoids (salad field and foods to avoid) that the day's salad contains.
export function matchSwaps<T extends { id: string; avoidFoods: string | null; avoidSalad?: string | null; healthNotes: string | null }>(
  customers: T[],
  menuFruits: string[],
  swapFruits: string[],
  salad?: { menu: string | null; swapTo: string | null },
): Map<string, Swap> {
  const out = new Map<string, Swap>()
  let turn = 0
  for (const c of customers) {
    const text = [c.avoidFoods, c.healthNotes].filter(Boolean).join(', ')
    const avoids = text ? menuFruits.filter((f) => mentions(text, f)) : []
    let swapTo: string | null = null
    if (avoids.length) {
      const allowed = swapFruits.filter((f) => !mentions(text, f) && !menuFruits.includes(f))
      const pool = allowed.length ? allowed : swapFruits.filter((f) => !mentions(text, f))
      swapTo = pool.length ? pool[turn++ % pool.length] : null
    }
    const saladAvoids = salad?.menu ? [...new Set([...terms(c.avoidSalad), ...terms(c.avoidFoods)].filter((t) => mentions(salad.menu!, t)))] : []
    if (avoids.length === 0 && saladAvoids.length === 0) continue
    out.set(c.id, { avoids, swapTo, saladAvoids, saladTo: saladAvoids.length ? (salad?.swapTo ?? null) : null })
  }
  return out
}
