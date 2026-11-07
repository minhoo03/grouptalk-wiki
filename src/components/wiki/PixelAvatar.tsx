import { avatarColor, avatarInitial } from "@/utils/avatar";

type PixelAvatarProps = {
  name: string;
  size?: "sm" | "md" | "lg";
};

const SIZE_CLASS_NAME = {
  sm: "h-7 w-7 text-[11px] border-2",
  md: "h-11 w-11 text-sm border-2",
  lg: "h-24 w-24 text-2xl border-[3px] shadow-[4px_4px_0_0_#1E2A28]",
};

export function PixelAvatar({ name, size = "md" }: PixelAvatarProps) {
  const color = avatarColor(name);

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-[6px] border-ink font-pixel ${SIZE_CLASS_NAME[size]}`}
      style={{ backgroundColor: color.bg, color: color.fg }}
    >
      {avatarInitial(name)}
    </span>
  );
}
