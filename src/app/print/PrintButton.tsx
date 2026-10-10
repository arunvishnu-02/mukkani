'use client'

export function PrintButton() {
  return <button onClick={() => window.print()} className="btn">Print</button>
}
