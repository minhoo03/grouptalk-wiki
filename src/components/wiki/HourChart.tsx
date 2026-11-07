type HourChartProps = {
  data: number[];
  label: string;
};

const AXIS_LABELS = ["0시", "6시", "12시", "18시", "23시"];

export function HourChart({ data, label }: HourChartProps) {
  const max = Math.max(...data, 1);
  const peakValue = Math.max(...data);
  const peakHour = data.indexOf(peakValue);

  return (
    <figure className="rounded-[6px] border-2 border-ink bg-white p-4">
      <div
        role="img"
        aria-label={label}
        className="flex h-32 items-end gap-[3px]"
      >
        {data.map((value, hour) => {
          const colorClassName =
            value === 0 ? "bg-line" : hour === peakHour ? "bg-gold" : "bg-namu";
          const height =
            value === 0 ? "3%" : `${Math.max(8, (value / max) * 100)}%`;
          return (
            <div
              key={hour}
              className="flex h-full flex-1 items-end"
              title={`${hour}시 · ${value}개`}
            >
              <div
                className={`w-full rounded-t-[2px] ${colorClassName}`}
                style={{ height }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between font-pixel text-[11px] text-subtle">
        {AXIS_LABELS.map((axisLabel) => (
          <span key={axisLabel}>{axisLabel}</span>
        ))}
      </div>
      {peakValue > 0 && (
        <figcaption className="mt-3 flex items-center gap-2 text-sm text-subtle">
          <span
            className="inline-block h-3 w-3 rounded-[2px] border border-ink bg-gold"
            aria-hidden="true"
          />
          가장 활발한 시간: {peakHour}시 ({peakValue}개)
        </figcaption>
      )}
    </figure>
  );
}
