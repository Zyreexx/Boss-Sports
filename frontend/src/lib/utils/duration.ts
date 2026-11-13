/**
 * Utility functions for flexible booking durations in Boss-Sports.
 *
 * Rules:
 * - 30 minutes -> "0.5 hours" (or "30 minutes")
 * - 60 minutes -> "1 hour"
 * - 90 minutes -> "1.5 hours"
 * - 120 minutes -> "2 hours"
 * - 150 minutes -> "2.5 hours"
 * - 180 minutes -> "3 hours"
 * - Never returns e.g. "180 hours"
 */

export const SUPPORTED_DURATIONS_MINUTES = [30, 60, 90, 120, 150, 180] as const;

export function formatDurationLabel(minutes: number): string {
  const hours = minutes / 60;
  if (Number.isInteger(hours)) {
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return `${hours} hours`;
}

export function getBookingDurationMinutes(booking: {
  durationMinutes?: number;
  duration_minutes?: number;
  durationHours?: number;
  duration_hours?: number;
  startTime?: string;
  start_at?: string;
  endTime?: string;
  end_at?: string;
}): number {
  if (booking.durationMinutes) return booking.durationMinutes;
  if (booking.duration_minutes) return booking.duration_minutes;
  const start = booking.startTime || booking.start_at;
  const end = booking.endTime || booking.end_at;
  if (start && end) {
    const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    if (!isNaN(diff) && diff > 0) return diff;
  }
  if (booking.durationHours) return booking.durationHours * 60;
  if (booking.duration_hours) return booking.duration_hours * 60;
  return 60;
}

export function formatBookingDuration(booking: {
  durationDisplay?: string;
  duration_display?: string;
  durationMinutes?: number;
  duration_minutes?: number;
  durationHours?: number;
  duration_hours?: number;
  startTime?: string;
  start_at?: string;
  endTime?: string;
  end_at?: string;
}): string {
  if (booking.durationDisplay) return booking.durationDisplay;
  if (booking.duration_display) return booking.duration_display;
  const mins = getBookingDurationMinutes(booking);
  return formatDurationLabel(mins);
}
