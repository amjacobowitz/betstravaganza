import { Card } from '@/components/ui/Card'
import { SetupForm } from '@/components/admin/SetupForm'
import Link from 'next/link'

export default function NewBetstravaganzaPage() {
  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-muted hover:text-white text-sm transition-colors">
          ← All
        </Link>
        <h1 className="text-2xl font-bold text-white">New Betstravaganza</h1>
      </div>

      <Card>
        <SetupForm />
      </Card>
    </div>
  )
}
