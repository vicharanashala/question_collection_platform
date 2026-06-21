/**
 * Format a number as INR with exactly 2 decimal places.
 * e.g. 50630 → "50,630.00"
 */
export function formatINRFull(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Abbreviate large numbers for compact display using Indian notation.
 * e.g. 1000 → "1K", 10500 → "10.5K", 100000 → "1L", 1500000 → "15L" / "1.5M"
 */
export function formatINRCompact(n: number): string {
  if (n >= 10000000) {
    const cr = n / 10000000
    return cr % 1 === 0 ? `${cr}Cr` : `${cr.toFixed(1)}Cr`
  }
  if (n >= 100000) {
    const l = n / 100000
    return l % 1 === 0 ? `${l}L` : `${l.toFixed(1)}L`
  }
  if (n >= 1000) {
    const k = n / 1000
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`
  }
  return n.toLocaleString('en-IN', { minimumFractionDigits: 0 })
}

/**
 * Returns a dynamic fontSize for large balance display based on formatted length.
 * Assumes base fontSize of 36 — scales down for longer values.
 */
export function getBalanceFontSize(n: number): number {
  const len = formatINRFull(n).length   // e.g. "50,630.00" → 10
  if (len <= 7)  return 36   // e.g. 1,200.00
  if (len <= 9)  return 30   // e.g. 12,345.00
  if (len <= 11) return 26   // e.g. 1,23,456.00
  if (len <= 13) return 22   // e.g. 12,34,567.00
  return 18                   // very large amounts
}

/**
 * Returns a dynamic fontSize for stat card values.
 * Base is 13 — scales down when the formatted string is longer than ~7 chars.
 * e.g. "10,00,000" → 11, "1,50,630" → 13, "50,000" → 13
 */
export function getStatFontSize(n: number): number {
  const len = n.toLocaleString('en-IN', { minimumFractionDigits: 0 }).length
  if (len <= 5)  return 13   // e.g. 50,000
  if (len <= 7)  return 11   // e.g. 1,50,000
  if (len <= 9)  return 10   // e.g. 10,00,000
  return 9                    // e.g. 1,00,00,000
}