import type { User } from "@/lib/types";

export type ChartSeries = {
  name: string;
  color: string;
  kind?: User["system_type"] | "player";
};

export const defaultChartColors = ["#34d399", "#60a5fa", "#fb7185", "#a78bfa", "#facc15", "#2dd4bf", "#f97316", "#c084fc"];

const systemDefaults: Record<NonNullable<User["system_type"]>, string> = {
  bookmaker: "#f59e0b",
  model: "#f8fafc",
};

export function colorForUser(user: User, index: number) {
  if (user.display_color) return user.display_color;
  if (user.system_type) return systemDefaults[user.system_type];
  return defaultChartColors[index % defaultChartColors.length];
}

export function chartSeriesForUsers(users: User[]): ChartSeries[] {
  return users.map((user, index) => ({
    name: user.display_name,
    color: colorForUser(user, index),
    kind: user.system_type ?? "player",
  }));
}

export function isValidChartColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}
