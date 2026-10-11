// WhatsApp is tap-to-send: the app opens WhatsApp with the message ready, the person presses send.

export function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}

// Indian numbers: 10 digits get the 91 country code.
export function waNumber(phone: string) {
  const d = phone.replace(/\D/g, '')
  return d.length === 10 ? `91${d}` : d.replace(/^0+/, '')
}

export function waLink(phone: string, text: string) {
  return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`
}

export const firstName = (name: string) => name.split(' ')[0]
