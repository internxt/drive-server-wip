import { Time } from '../../lib/time';

// Deployment of the feature
export const TRASH_EXPIRATION_START_DATE = new Date('2026-03-09T00:00:00Z');

export function calculateTrashExpirationDate(
  retentionDays: number,
  deletedAt: Date,
): Date {
  const baseDate =
    deletedAt < TRASH_EXPIRATION_START_DATE
      ? TRASH_EXPIRATION_START_DATE
      : deletedAt;
  return Time.dateWithTimeAdded(retentionDays, 'day', baseDate);
}

export function getTrashNotExpiredCutoffDate(
  retentionDays: number,
): Date | null {
  const cutoffDate = Time.dateWithTimeAdded(-retentionDays, 'day', new Date());
  if (TRASH_EXPIRATION_START_DATE >= cutoffDate) {
    return null;
  }
  return cutoffDate;
}
