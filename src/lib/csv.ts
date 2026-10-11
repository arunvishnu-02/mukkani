// Small CSV reader for the leads import. Handles quotes, commas and line breaks inside cells.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell); cell = ''
      rows.push(row); row = []
    } else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''))
}

// Columns of the leads import file, in the order of the sample. Only Name and Phone are required.
export const LEAD_IMPORT_COLUMNS = ['Name', 'Phone', 'Alternate phone', 'Source', 'Region', 'Address', 'Date of birth', 'Time slot', 'Foods to avoid', 'Health issues', 'Notes', 'Next call date'] as const

// A date typed in a spreadsheet: 2026-10-15, 15/10/2026 or 15-10-2026. Returns YYYY-MM-DD, or null when it is not a date.
export function sheetDate(v: string): string | null {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v)
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v)
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]] : dmy ? [dmy[3], dmy[2], dmy[1]] : ['', '', '']
  if (!y) return null
  const out = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  const t = new Date(`${out}T00:00:00Z`)
  return !Number.isNaN(t.getTime()) && t.getUTCDate() === Number(d) ? out : null
}
