export const fmt = (v: number | null | undefined, digits = 0) =>
  v == null
    ? "N/A"
    : v.toLocaleString("en-GB", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      });

/** Signed MW with an explicit plus, so over-forecast is never inferred from colour alone. */
export const signed = (v: number | null | undefined, digits = 0) =>
  v == null
    ? "N/A"
    : (v > 0 ? "+" : v < 0 ? "−" : "") + fmt(Math.abs(v), digits);

export const pct = (v: number | null | undefined) =>
  v == null ? "N/A" : Math.round(v * 100) + "%";

export const dateLabel = (s: string) =>
  new Date(s.slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

export const weekdayLabel = (s: string) =>
  new Date(s.slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

export const stamp = (s: string) =>
  s.slice(0, 10) + " " + s.slice(11, 16) + " UTC";

/** Short form for runs: "15 Jan 09:30". */
export const runLabel = (s: string) => dateLabel(s) + " " + s.slice(11, 16);

export const ruleLabel = (s: string) =>
  s === "hour_mean" ? "Mean of both half-hours" : "First half-hour only";

export const hours = (v: number | null | undefined) =>
  v == null ? "N/A" : fmt(v, v < 10 ? 1 : 0) + " h";

/** Hours between a forecast's creation and a target time. */
export const leadHours = (target: string, publish: string) =>
  (Date.parse(target) - Date.parse(publish)) / 3_600_000;

export const errorWord = (e: number) =>
  e > 0 ? "over-forecast" : e < 0 ? "under-forecast" : "exact";

// Chart palette. Over/under-forecast also carry a sign and words, never colour alone.
export const COLORS = {
  forecast: "#2f6f60",
  actual: "#b85d1c",
  prior: "#7d817f",
  over: "#a8473f",
  under: "#3d6fa8",
};
