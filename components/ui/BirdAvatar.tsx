import { getBird } from '@/lib/utils/birds'

export function BirdAvatar({
  teamName,
  size = 32,
  className = '',
}: {
  teamName: string | null | undefined
  size?: number
  className?: string
}) {
  const bird = getBird(teamName)
  if (!bird) return null
  return (
    <img
      src={bird.imageUrl}
      alt={bird.species}
      width={size}
      height={size}
      className={`rounded-full object-cover shrink-0 ring-1 ring-border/50 ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
