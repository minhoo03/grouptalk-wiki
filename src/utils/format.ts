export function formatDateKey(key: string | null): string {
  if (!key) return "날짜 미상";
  const [y, m, d] = key.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

export function formatTime(hour: number | null, minute: number | null): string {
  if (hour === null || minute === null) return "";
  const ampm = hour < 12 ? "오전" : "오후";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${ampm} ${h}:${String(minute).padStart(2, "0")}`;
}

export function formatHour(hour: number | null): string {
  if (hour === null) return "알 수 없음";
  if (hour < 5) return `새벽 ${hour}시`;
  if (hour < 12) return `오전 ${hour}시`;
  if (hour === 12) return "낮 12시";
  return `오후 ${hour - 12}시`;
}

export function truncate(text: string, max: number): string {
  const single = text.replace(/\s+/g, " ");
  return single.length > max ? `${single.slice(0, max)}…` : single;
}
/** 로컬 시각을 `yyyy-MM-dd HH:mm`(withSeconds면 `:ss`까지) 형식으로 표시한다. */
export function formatDateTime(date: Date, withSeconds = false): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${withSeconds ? `${time}:${pad(date.getSeconds())}` : time}`;
}
