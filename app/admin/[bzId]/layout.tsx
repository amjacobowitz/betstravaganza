import { notFound } from 'next/navigation'
import { getById } from '@/lib/db/betstravaganza'
import { BzNav } from '@/components/admin/BzNav'

export default async function BzLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ bzId: string }>
}) {
  const { bzId } = await params
  const bz = await getById(bzId)
  if (!bz) notFound()

  return (
    <div className="space-y-0">
      <BzNav bzId={bzId} bzName={bz.name} bzStatus={bz.status} />
      <div className="pt-4">{children}</div>
    </div>
  )
}
