// Utility functions and types for time formatting used by TimeDisplay

export enum TimeFormat {
  Local = "local",
  Utc = "utc",
  Delta = "delta",
}

// Time constants in milliseconds
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND; // 60000
export const MS_PER_HOUR = 60 * MS_PER_MINUTE; // 3600000
export const MS_PER_DAY = 24 * MS_PER_HOUR; // 86400000

/** Cycle to the next TimeFormat in display order. */
export function nextFormat(current: TimeFormat): TimeFormat {
  switch (current) {
    case TimeFormat.Local:
      return TimeFormat.Utc;
    case TimeFormat.Utc:
      return TimeFormat.Delta;
    case TimeFormat.Delta:
      return TimeFormat.Local;
    default:
      return TimeFormat.Local;
  }
}

/** Return a human-readable relative time string ("delta" mode). */
export function formatDeltaTime(timestampSeconds: number): string {
  const nowMs = Date.now();
  const thenMs = timestampSeconds * MS_PER_SECOND;
  const diff = thenMs - nowMs;

  if (diff < 0) {
    const absDiff = Math.abs(diff);
    if (absDiff < MS_PER_MINUTE) {
      return "Just ended";
    }
    if (absDiff < MS_PER_HOUR) {
      return `${Math.floor(absDiff / MS_PER_MINUTE)} min ago`;
    }
    if (absDiff < MS_PER_DAY) {
      return `${Math.floor(absDiff / MS_PER_HOUR)} hr ago`;
    }
    return `${Math.floor(absDiff / MS_PER_DAY)} days ago`;
  } else {
    if (diff < MS_PER_MINUTE) {
      return "< 1 min";
    }
    if (diff < MS_PER_HOUR) {
      return `${Math.floor(diff / MS_PER_MINUTE)} min`;
    }
    if (diff < MS_PER_DAY) {
      return `${Math.floor(diff / MS_PER_HOUR)} hr`;
    }
    return `${Math.floor(diff / MS_PER_DAY)} days`;
  }
}

/** Format a unix epoch seconds timestamp according to a format mode. */
export function formatTime(timestampSeconds: number | null, fmt: TimeFormat): string {
  if (!timestampSeconds) {
    return "—";
  }
  switch (fmt) {
    case TimeFormat.Local: {
      const d = new Date(timestampSeconds * MS_PER_SECOND);
      return d.toLocaleString();
    }
    case TimeFormat.Utc: {
      const d = new Date(timestampSeconds * MS_PER_SECOND);
      return d.toUTCString();
    }
    case TimeFormat.Delta:
      return formatDeltaTime(timestampSeconds);
    default:
      return "—";
  }
}
