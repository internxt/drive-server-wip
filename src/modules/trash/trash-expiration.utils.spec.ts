import { Time } from '../../lib/time';
import {
  calculateTrashExpirationDate,
  TRASH_EXPIRATION_START_DATE,
  getTrashNotExpiredCutoffDate,
} from './trash-expiration.utils';

describe('calculateTrashExpirationDate', () => {
  it('When deletedAt is before the expiration start date, then caducity date should be calculated from the start date', () => {
    const date = new Date('2025-10-30T00:00:00Z');
    const result = calculateTrashExpirationDate(2, date);
    expect(result).toEqual(
      Time.dateWithTimeAdded(2, 'day', TRASH_EXPIRATION_START_DATE),
    );
  });

  it('When deletedAt is before the expiration start date with 30 days retention, then caducity date should be 30 days from the start date', () => {
    const date = new Date('2025-10-30T00:00:00Z');
    const result = calculateTrashExpirationDate(30, date);
    expect(result).toEqual(
      Time.dateWithTimeAdded(30, 'day', TRASH_EXPIRATION_START_DATE),
    );
  });

  it('When deletedAt is after the expiration start date, then caducity date should be calculated from deletedAt', () => {
    const date = new Date('2026-06-01T00:00:00Z');
    const result = calculateTrashExpirationDate(30, date);
    expect(result).toEqual(Time.dateWithTimeAdded(30, 'day', date));
  });

  it('When deletedAt equals the expiration start date, then caducity date should be calculated from deletedAt', () => {
    const result = calculateTrashExpirationDate(
      15,
      TRASH_EXPIRATION_START_DATE,
    );
    expect(result).toEqual(
      Time.dateWithTimeAdded(15, 'day', TRASH_EXPIRATION_START_DATE),
    );
  });
});

describe('getTrashNotExpiredCutoffDate', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('When cutoff date is before or equal to the expiration start date, then it should return null', () => {
    jest.setSystemTime(new Date('2026-03-20T00:00:00Z'));

    const result = getTrashNotExpiredCutoffDate(15);

    const expectedCutoff = Time.dateWithTimeAdded(-15, 'day', new Date());
    expect(TRASH_EXPIRATION_START_DATE >= expectedCutoff).toBe(true);
    expect(result).toBeNull();
  });

  it('When cutoff date is after the expiration start date, then it should return the cutoff date', () => {
    jest.setSystemTime(new Date('2026-05-01T00:00:00Z'));

    const result = getTrashNotExpiredCutoffDate(15);

    const expectedCutoff = Time.dateWithTimeAdded(-15, 'day', new Date());

    expect(result).toEqual(expectedCutoff);
  });
});
