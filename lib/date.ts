/** 曜日ラベル（月曜始まり） */
export const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"] as const;

/** 日付を YYYY-MM-DD にする */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** YYYY-MM-DD をローカル日付として解釈する */
export function parseDate(dateText: string): Date {
  const [yearText, monthText, dayText] = dateText.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  return new Date(year, month - 1, day);
}

/** 指定日が属する週の月曜日 */
export function getWeekStart(date: Date = new Date()): string {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay(); // 0=日
  const diffToMonday = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diffToMonday);
  return formatDate(copy);
}

/** 週開始日から n 日後 */
export function addDays(weekStart: string, days: number): string {
  const date = parseDate(weekStart);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

/** 月曜始まりの7日分 */
export function getWeekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

/** 表示用（例: 3/24） */
export function formatMonthDay(dateText: string): string {
  const date = parseDate(dateText);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/** 今日の YYYY-MM-DD */
export function getToday(): string {
  return formatDate(new Date());
}

/** 表示用（例: 2026年7月24日（金）） */
export function formatDisplayDate(dateText: string): string {
  const date = parseDate(dateText);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"] as const;
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${weekdays[date.getDay()]}）`;
}

/** 任意日付が属する週の月曜日 */
export function getWeekStartFromDate(dateText: string): string {
  return getWeekStart(parseDate(dateText));
}

/** 週を前後にずらす */
export function shiftWeek(weekStart: string, weekDelta: number): string {
  return addDays(weekStart, weekDelta * 7);
}
