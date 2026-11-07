import type { ReactNode } from "react";

export type InfoRow = {
  label: string;
  value: ReactNode;
};

type InfoboxProps = {
  title: string;
  subtitle: string;
  hero: ReactNode;
  rows: InfoRow[];
};

export function Infobox({ title, subtitle, hero, rows }: InfoboxProps) {
  return (
    <aside className="w-full overflow-hidden rounded-[6px] border-2 border-ink bg-white shadow-[4px_4px_0_0_#1E2A28]">
      <div className="bg-namu px-4 py-3 text-center text-white">
        <p className="font-pixel text-xl">{title}</p>
        <p className="mt-0.5 text-sm font-semibold">{subtitle}</p>
      </div>
      <div className="border-b-2 border-ink px-4 py-5">{hero}</div>
      <dl>
        {rows.map((row, index) => (
          <div
            key={row.label}
            className={`grid grid-cols-[96px_1fr] ${index > 0 ? "border-t border-line" : ""}`}
          >
            <dt className="flex items-center justify-center bg-namu-dark px-2 py-2.5 text-center text-sm font-bold text-white">
              {row.label}
            </dt>
            <dd className="px-3 py-2.5 text-sm text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
