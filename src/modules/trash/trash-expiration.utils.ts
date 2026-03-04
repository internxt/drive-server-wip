import { Time } from '../../lib/time';
export const TRASH_EXPIRATION_START_DATE = new Date('2026-03-03');
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
