const TZ = 'America/New_York'

/** Format a UTC ISO string for display in ET. */
export function formatET(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleString('en-US', { timeZone: TZ, ...opts })
}

/**
 * Convert a UTC/ISO timestamp to the "YYYY-MM-DDTHH:MM" string that
 * datetime-local inputs expect, expressed in ET.
 */
export function toDatetimeLocalET(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).format(new Date(iso)).replace(' ', 'T')
}

/**
 * Convert a datetime-local value ("YYYY-MM-DDTHH:MM") that the user entered
 * in ET into a UTC ISO string for storage.
 */
export function etDatetimeLocalToISO(localStr: string): string {
  if (!localStr) return ''
  const parts = localStr.match(/\d+/g)
  if (!parts || parts.length < 5) return ''
  const [y, mo, d, h, mi] = parts.map(Number)

  // Try both ET offsets (EDT = UTC-4, EST = UTC-5) and keep the one that
  // round-trips correctly back to the user's intended local time.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
  for (const offsetH of [4, 5]) {
    const ms = Date.UTC(y, mo - 1, d, h + offsetH, mi)
    const p = fmt.formatToParts(new Date(ms))
    const g = (t: string) => parseInt(p.find(x => x.type === t)!.value) % (t === 'hour' ? 24 : Infinity)
    if (g('year') === y && g('month') === mo && g('day') === d && g('hour') === h && g('minute') === mi) {
      return new Date(ms).toISOString()
    }
  }
  // Fallback: assume EDT
  return new Date(Date.UTC(y, mo - 1, d, h + 4, mi)).toISOString()
}
