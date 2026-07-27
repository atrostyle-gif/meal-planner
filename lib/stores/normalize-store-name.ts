/** 店舗名の正規化（比較・alias用） */
export function normalizeStoreName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\u3000\s]+/g, "")
    .replace(/[♡♥★☆◆◇●○■□]/g, "")
    .replace(/株式会社|有限会社|\(株\)|（株）/g, "")
    .replace(/店$/g, "");
}
