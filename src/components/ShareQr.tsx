'use client'

import { useState } from 'react'

// Sends the payment QR image with the message. Phones share the image straight to WhatsApp;
// elsewhere WhatsApp opens with the message and the QR is attached by hand.
export function ShareQr({ qrUrl, wa, text }: { qrUrl: string | null; wa: string; text: string }) {
  const [note, setNote] = useState<string | null>(null)
  return (
    <div>
      <button
        type="button"
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        onClick={async () => {
          if (qrUrl && navigator.canShare) {
            try {
              const blob = await (await fetch(qrUrl)).blob()
              const file = new File([blob], 'mukkani-payment-qr.png', { type: blob.type || 'image/png' })
              if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], text })
                return
              }
            } catch (e) {
              if (e instanceof DOMException && e.name === 'AbortError') return
            }
          }
          window.open(wa, '_blank')
          if (qrUrl) setNote('WhatsApp opened with the message. Attach the QR image from your gallery.')
        }}
      >
        Send QR on WhatsApp
      </button>
      {note && <p className="mt-1.5 text-xs text-muted">{note}</p>}
    </div>
  )
}
