import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

dayjs.extend(utc);
dayjs.extend(isSameOrBefore);

export type TimeUnit =
  | 'year'
  | 'month'
  | 'week'
  | 'day'
  | 'hour'
  | 'minute'
  | 'second';

export class Time {
  public static now(initialDate?: string | Date | number): Date {
    return dayjs(initialDate).utc().toDate();
  }

  public static dateWithTimeAdded(
    amount: number,
    unit: TimeUnit,
    initialDate?: Date,
  ): Date {
    const date = dayjs(initialDate ?? Time.now()).utc();
    return date.add(amount, unit).toDate();
  }

  public static readonly isToday = (date: Date): boolean => {
    return dayjs(date).utc().isSame(dayjs().utc(), 'day');
  };

  public static readonly isThisMonth = (date: Date): boolean => {
    return dayjs(date).utc().isSame(dayjs().utc(), 'month');
  };

  public static readonly daysSince = (date: Date): number => {
    const now = dayjs().utc();
    const past = dayjs(date).utc();
    return now.diff(past, 'day');
  };

  public static daysAgo(days: number): Date {
    return Time.dateWithTimeAdded(-days, 'day');
  }

  public static readonly convertTimestampToDate = (timestamp: number): Date => {
    return dayjs(timestamp * 1000).toDate();
  };

  /**
   * Returns a new Date object set to the end of the day (23:59:59.999)
   * @param date - Optional date to use. If not provided, uses current date
   * @returns Date object set to end of day
   */
  public static endOfDay(date?: Date): Date {
    const targetDate = date ? dayjs(date) : dayjs(Time.now());
    return targetDate.utc().endOf('day').toDate();
  }

  /**
   * Returns a new Date object set to the start of the specified time unit
   * @param date - Date to use
   * @param unit - Time unit ('day', 'month', or 'year')
   * @returns Date object set to start of the specified unit
   */
  public static startOf(date: Date, unit: 'day' | 'month' | 'year'): Date {
    return dayjs(date).utc().startOf(unit).toDate();
  }

  public static formatAsDateOnly(date: Date): string {
    return dayjs(date).utc().format('YYYY-MM-DD');
  }
  public static isSameOrBefore(
    date1: Date,
    date2: Date,
    unit: dayjs.UnitType = 'day',
  ): boolean {
    return dayjs(date1).utc().isSameOrBefore(dayjs(date2).utc(), unit);
  }
}
