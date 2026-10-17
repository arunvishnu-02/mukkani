'use client'

import { useState } from 'react'

// Sends the monthly report as a one-page PDF. The front page of the printed report is turned into a PDF in the
// browser. On a phone the share sheet opens so WhatsApp gets the PDF attached; where sharing files is not
// possible, the PDF is downloaded and WhatsApp opens with the message, ready for the PDF to be attached.
export function SendReport({ packageId, fileName, waHref, text, small }: { packageId: string; fileName: string; waHref: string; text: string; small?: boolean }) {
  const [state, setState] = useState<'idle' | 'making' | 'downloaded' | 'failed'>('idle')

  async function makePdf(): Promise<File> {
    const frame = document.createElement('iframe')
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;height:1400px;border:0'
    frame.src = `/print/report/${packageId}`
    document.body.appendChild(frame)
    try {
      await new Promise<void>((ok, bad) => { frame.onload = () => ok(); frame.onerror = () => bad(new Error('load')) })
      const doc = frame.contentDocument!
      await doc.fonts?.ready
      await Promise.all([...doc.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r }))))
      const page = doc.querySelector<HTMLElement>('.a4')
      if (!page) throw new Error('no page')
      const [{ toJpeg }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])
      const w = page.offsetWidth
      const h = page.offsetHeight
      // The page is centred on screen with a shadow; the copy for the PDF sits at 0,0 at its own size.
      const img = await toJpeg(page, { quality: 0.92, pixelRatio: 2, backgroundColor: '#ffffff', width: w, height: h, style: { margin: '0', boxShadow: 'none' } })
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      const ph = Math.min(297, (210 * h) / w)
      // Fit the page into A4: full width, or full height if the page is taller than A4.
      pdf.addImage(img, 'JPEG', 0, 0, (ph * w) / h, ph)
      return new File([pdf.output('blob')], fileName, { type: 'application/pdf' })
    } finally {
      frame.remove()
    }
  }

  async function send() {
    setState('making')
    let file: File
    try {
      file = await makePdf()
    } catch {
      setState('failed')
      return
    }
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text })
        setState('idle')
        return
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') { setState('idle'); return }
    }
    const url = URL.createObjectURL(file)
    const a = Object.assign(document.createElement('a'), { href: url, download: fileName })
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    window.open(waHref, '_blank', 'noreferrer')
    setState('downloaded')
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={send} disabled={state === 'making'} className={`inline-flex items-center justify-center gap-2 rounded-lg bg-leaf font-semibold text-white hover:opacity-90 disabled:opacity-60 ${small ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2.5 text-sm'}`}>
        {state === 'making' ? 'Making PDF…' : small ? 'Send PDF' : 'Send PDF on WhatsApp'}
      </button>
      {state === 'downloaded' && <span className="max-w-56 text-[11px] text-muted">PDF downloaded. In the WhatsApp chat, attach it (📎 → Document).</span>}
      {state === 'failed' && <span className="text-[11px] text-red">Could not make the PDF. Try again or use Print.</span>}
    </span>
  )
}
