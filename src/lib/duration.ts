const UNITS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

/** Parses "90s", "10m", "1h30m", "2d", "1w" into milliseconds. Returns null if invalid. */
export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!/^(\d+[smhdw])+$/.test(text)) return null;
  let total = 0;
  for (const match of text.matchAll(/(\d+)([smhdw])/g)) {
    const amount = Number(match[1]);
    const unit = UNITS[match[2] ?? ""];
    if (!unit || !Number.isFinite(amount)) return null;
    total += amount * unit;
  }
  return total > 0 ? total : null;
}

/** 5400000 -> "1h 30m" */
export function formatDuration(ms: number): string {
  const parts: string[] = [];
  let rest = Math.round(ms / 1000);
  for (const [unit, seconds] of [
    ["d", 86_400],
    ["h", 3_600],
    ["m", 60],
    ["s", 1],
  ] as const) {
    const amount = Math.floor(rest / seconds);
    if (amount > 0) parts.push(`${amount}${unit}`);
    rest -= amount * seconds;
  }
  return parts.length > 0 ? parts.join(" ") : "0s";
}

/** Discord timestamp markdown, e.g. <t:1700000000:R> */
export function discordTime(ms: number, style: "R" | "F" | "f" | "D" = "R"): string {
  return `<t:${Math.floor(ms / 1000)}:${style}>`;
}
