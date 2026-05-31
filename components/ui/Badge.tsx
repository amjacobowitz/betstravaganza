type BadgeVariant = 'win' | 'loss' | 'push' | 'pending' | 'clash' | 'required' | 'admin' | 'default'

const styles: Record<BadgeVariant, string> = {
  win:      'bg-win/20 text-win border-win/30',
  loss:     'bg-loss/20 text-loss border-loss/30',
  push:     'bg-push/20 text-push border-push/30',
  pending:  'bg-zinc-700/40 text-zinc-400 border-zinc-600/30',
  clash:    'bg-clash/20 text-clash border-clash/30',
  required: 'bg-accent-2/20 text-accent-2 border-accent-2/30',
  admin:    'bg-accent/20 text-accent border-accent/30',
  default:  'bg-surface-2 text-muted border-border',
}

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${styles[variant]} ${className}`}>
      {children}
    </span>
  )
}

export function ClashBadge() {
  return (
    <Badge variant="clash">
      🏈💥🏈 CLASH
    </Badge>
  )
}
