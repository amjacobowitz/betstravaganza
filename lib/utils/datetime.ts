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
  // Probe: treat the local string as UTC to anchor a moment in time
  const probeMs = Date.UTC(y, mo - 1, d, h, mi)
  // Find what ET clock shows for that probe UTC moment
  const etParts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false, hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(probeMs))
  const etHour = parseInt(etParts.find(p => p.type === 'hour')!.value) % 24
  const etMin  = parseInt(etParts.find(p => p.type === 'minute')!.value)
  // Shift probe so ET clock shows h:mi
  const deltaMs = ((h - etHour) * 60 + (mi - etMin)) * 60_000
  return new Date(probeMs + deltaMs).toISOString()
}
