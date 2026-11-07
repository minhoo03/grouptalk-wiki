type StatBarProps = {
  label: string;
  value: number;
  raw: string;
};

/** 값이 0%여도 막대가 있다는 것이 보이도록 최소 너비를 둔다. */
export const MIN_BAR_PERCENT = 2;

export function StatBar({ label, value, raw }: StatBarProps) {
  return (
    <div className="grid grid-cols-[88px_1fr_auto] items-center gap-3">
      <span className="text-sm font-bold text-ink">{label}</span>
      <span
        className="h-3 overflow-hidden rounded-[2px] border border-ink bg-white"
        role="meter"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          className="block h-full bg-namu"
          style={{ width: `${Math.max(value, MIN_BAR_PERCENT)}%` }}
        />
      </span>
      <span className="w-24 text-right text-xs text-subtle tabular-nums">
        {raw}
      </span>
    </div>
  );
}
