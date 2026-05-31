export type ScheduleBucket = 'live' | 'upcoming' | 'completed' | 'tbd'

export function bucketItem(startTime: string | null, hasResult: boolean): ScheduleBucket {
  if (hasResult) return 'completed'
  if (!startTime) return 'tbd'
  return new Date(startTime) > new Date() ? 'upcoming' : 'live'
}
