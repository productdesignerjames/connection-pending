import type { CSSProperties } from "react";
import { avatarForName } from "../domain";

const colors = [
  ["#eb7356", "#ffd28a", "#242b45"],
  ["#54b8aa", "#d2f0cb", "#1d3451"],
  ["#b472bf", "#f4c6a9", "#382952"],
  ["#e7aa3b", "#f7d8b0", "#304d76"],
  ["#4f93cb", "#f2c59d", "#2d3e56"],
  ["#df7e9c", "#ffe1a3", "#3d4266"],
  ["#57a878", "#f1cca1", "#273c45"],
  ["#cf7250", "#f1d594", "#283552"],
];
const patterns = [
  ["01110", "11111", "10101", "01110", "11011"],
  ["00100", "01110", "11111", "10101", "01010"],
  ["11011", "01110", "11111", "10101", "01110"],
  ["00100", "11111", "10101", "01110", "11011"],
  ["01110", "10101", "11111", "01110", "10101"],
  ["11111", "10001", "01110", "10101", "11011"],
];

export default function PixelAvatar({
  name,
  avatarId,
  size = "small",
}: {
  name: string;
  avatarId?: string;
  size?: "tiny" | "small" | "large";
}) {
  const fallback = avatarForName(name);
  const [storedPalette, storedPattern] = avatarId?.split("-").map(Number) ?? [];
  const avatar = {
    palette: Number.isInteger(storedPalette)
      ? ((storedPalette % colors.length) + colors.length) % colors.length
      : fallback.palette,
    pattern: Number.isInteger(storedPattern)
      ? ((storedPattern % patterns.length) + patterns.length) % patterns.length
      : fallback.pattern,
  };
  const palette = colors[avatar.palette];
  return (
    <span
      className={`pixel-avatar avatar-${size}`}
      role="img"
      aria-label={`Abstract avatar for ${name}`}
      style={
        {
          "--avatar-a": palette[0],
          "--avatar-b": palette[1],
          "--avatar-c": palette[2],
        } as CSSProperties
      }
    >
      {patterns[avatar.pattern].flatMap((row, y) =>
        [...row].map((pixel, x) => (
          <i
            className={
              pixel === "1" ? `pixel-tone-${(x + y + avatar.pattern) % 3}` : ""
            }
            key={`${y}-${x}`}
          />
        )),
      )}
    </span>
  );
}
