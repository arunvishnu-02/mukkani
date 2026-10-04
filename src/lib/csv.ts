// Small CSV reader and writer for the customer import and export. Handles quotes, commas and line breaks inside cells.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
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

export function toCsv(rows: (string | null | undefined)[][]): string {
  const esc = (v: string | null | undefined) => {
    const s = v ?? ''
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  // The leading BOM makes Excel read Tamil and other non-English text correctly.
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n'
}

export const CUSTOMER_COLUMNS = ['Name', 'Phone', 'Location', 'Address', 'Health issues', 'Notes', 'Slot', 'Start date', 'Status']
