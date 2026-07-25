/** ISO 8601 Duration → 分 */

export function parseIso8601DurationToMinutes(value: unknown): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    return Number(text);
  }
  const match = text.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i,
  );
  if (!match) {
    // PT1H20M style already covered; also allow 30 minutes plain JP later
    const jp = text.match(/(\d+)\s*時間(?:\s*(\d+)\s*分)?|(\d+)\s*分/);
    if (jp) {
      if (jp[3]) return Number(jp[3]);
      return Number(jp[1] ?? 0) * 60 + Number(jp[2] ?? 0);
    }
    return null;
  }
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  const total = days * 24 * 60 + hours * 60 + minutes + seconds / 60;
  return Number.isFinite(total) ? Math.round(total) : null;
}
