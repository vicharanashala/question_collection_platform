/**
 * Format a number as INR with exactly 2 decimal places.
 * e.g. 50630 → "50,630.00"
 */
export function formatINRFull(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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