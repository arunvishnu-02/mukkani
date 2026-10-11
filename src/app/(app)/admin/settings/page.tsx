import { requireUser } from '@/lib/auth'
import { getSettings, type SettingKey, type Settings } from '@/lib/settings'
import { Callout, Card, ErrorNote, PageHeader } from '@/components/ui'
import { saveSettings } from '../actions'

const TAGS = '{name} customer first name · {endDate} last delivery day · {amount} price · {link} review link · {from} {to} report dates'

function Text({ s, k, label, hint, type = 'text' }: { s: Settings; k: SettingKey; label: string; hint?: string; type?: string }) {
  return (
    <div>
      <label className="label" htmlFor={k}>{label}</label>
      <input id={k} name={k} type={type} className="input" defaultValue={s[k]} {...(type === 'number' ? { min: 0, step: k === 'lowStockKg' ? 0.5 : 1 } : {})} />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}
function Area({ s, k, label, hint, rows = 3 }: { s: Settings; k: SettingKey; label: string; hint?: string; rows?: number }) {
  return (
    <div>
      <label className="label" htmlFor={k}>{label}</label>
      <textarea id={k} name={k} rows={rows} className="input" defaultValue={s[k]} />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

// Prices, delivery slots, fruit list, message texts, payment QR and the details printed on the monthly report.
export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['ADMIN'])
  const sp = await searchParams
  const s = await getSettings()
  return (
    <>
      <PageHeader title="Settings" crumb="Business" sub="Prices, delivery slots, message texts, payment QR and report details" />
      <ErrorNote error={sp.error} />
      {sp.saved && <Callout tone="leaf">Settings saved.</Callout>}
      <form action={saveSettings} className="grid items-start gap-4 lg:grid-cols-2">
        <input type="hidden" name="back" value="/admin/settings" />
        <div className="space-y-4">
          <Card title="Prices" sub="New packs and trials use these. Running packs keep their price.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Text s={s} k="monthlyPrice" label="Monthly pack (26 days), Rs" type="number" />
              <Text s={s} k="trialPrice" label="Trial box incl. box, Rs" type="number" />
              <Text s={s} k="buttermilkPrice" label="Buttermilk per bottle per month, Rs" type="number" />
              <Text s={s} k="lowStockKg" label="Low stock below (kg)" type="number" />
            </div>
          </Card>
          <Card title="Delivery and kitchen">
            <div className="space-y-3">
              <Area s={s} k="slots" label="Delivery time slots" hint="One slot per line" />
              <Area s={s} k="fruits" label="Fruits" rows={5} hint="One per line. Used for the menu, stock and wastage." />
            </div>
          </Card>
          <Card title="Payment QR" sub="Sent to the customer on the renewal call">
            <div className="flex items-start gap-4">
              {s.paymentQrId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/files/${s.paymentQrId}`} alt="Payment QR" className="size-28 rounded-lg border border-line object-contain" />
              ) : (
                <div className="flex size-28 items-center justify-center rounded-lg border border-dashed border-line text-center text-xs text-muted">No QR yet</div>
              )}
              <div className="flex-1">
                <label className="label" htmlFor="qr">{s.paymentQrId ? 'Replace the QR image' : 'Upload the QR image'}</label>
                <input id="qr" name="qr" type="file" accept="image/*" className="input py-2" />
                <p className="mt-1 text-xs text-muted">PNG or JPG up to 5 MB.</p>
              </div>
            </div>
          </Card>
          <Card title="Report and business details" sub="Printed on the monthly report">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Text s={s} k="businessPhone" label="Phone" />
                <Text s={s} k="fssai" label="FSSAI number" />
              </div>
              <Text s={s} k="address" label="Address" />
              <Text s={s} k="reviewLink" label="Google review link" type="url" />
              <Area s={s} k="letter" label="Letter on the back of the report" rows={9} hint="{name} is replaced with the customer name" />
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="WhatsApp message texts" sub={TAGS}>
            <div className="space-y-3">
              <Area s={s} k="msgReminder" label="End-date reminder (3 days before)" />
              <Area s={s} k="msgRenewal" label="Renewal: payment QR message" />
              <Area s={s} k="msgReview" label="Google review request" />
              <Area s={s} k="msgBirthday" label="Birthday wish" />
              <Area s={s} k="msgReport" label="Monthly report" />
            </div>
          </Card>
          <div className="sticky bottom-4 flex justify-end">
            <button className="btn shadow-lg">Save settings</button>
          </div>
        </div>
      </form>
    </>
  )
}
