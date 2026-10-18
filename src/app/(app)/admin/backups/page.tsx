import { requireUser } from '@/lib/auth'
import { listBackups, todayIst } from '@/lib/backup'
import { Callout, Empty, ErrorNote, PageHeader, Tile, Tiles } from '@/components/ui'
import { backupNow } from '../actions'

const size = (b: number) => (b > 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`)

// Nightly copies of all the data. Download one now and then and keep it somewhere safe (Google Drive, a pen drive).
export default async function BackupsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['ADMIN'])
  const sp = await searchParams
  const files = await listBackups().catch(() => [])
  const today = todayIst()
  return (
    <>
      <PageHeader title="Backups" crumb="Business" sub="A full copy of all the data (customers, attendance, payments, photos) is made every night after 1 AM. The last 30 are kept.">
        <form action={backupNow}><button className="btn">Back up now</button></form>
      </PageHeader>
      <ErrorNote error={sp.error} />
      {sp.made && <Callout>Backup made: {sp.made}</Callout>}
      <Tiles cols={3}>
        <Tile label="Today's backup" value={files.some((f) => f.day === today) ? 'Done' : 'Not yet'} sub="made after 1 AM" tone={files.some((f) => f.day === today) ? 'leaf' : 'warn'} />
        <Tile label="Backups kept" value={files.length} sub="newest 30" />
        <Tile label="Latest" value={files[0]?.day ?? '—'} sub={files[0] ? size(files[0].size) : 'none yet'} />
      </Tiles>
      <Callout tone="sky">Once a week, download the latest file and keep it in Google Drive or on a pen drive. If the server is ever lost, the data can be put back from that file.</Callout>
      <section className="card overflow-x-auto">
        {files.length === 0 ? <Empty>No backups yet. Press Back up now.</Empty> : (
          <table className="w-full">
            <thead><tr><th className="th">File</th><th className="th">Day</th><th className="th text-right">Size</th><th className="th"></th></tr></thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.name}>
                  <td className="td font-mono text-[13px]">{f.name}</td>
                  <td className="td">{f.day}</td>
                  <td className="td text-right">{size(f.size)}</td>
                  <td className="td text-right"><a href={`/api/backup/${f.name}`} className="btn-secondary btn-sm">Download</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
