import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
}

export function Card({ title, children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface p-4 ${className}`}
      {...props}
    >
      {title && <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">{title}</h2>}
      {children}
    </div>
  )
}
