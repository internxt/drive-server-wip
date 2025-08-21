import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

export class Time {
  private static freeze: Date | null = null;

  public static now(initialDate?: string | Date | number): Date {
    if (Time.freeze !== null) {
      return new Date(Time.freeze.getTime());
    }

    if (initialDate) {
      return new Date(initialDate);
    }

    return new Date();
  }

  public static dateWithDaysAdded(days: number): Date {
    const date = Time.now();
    date.setDate(date.getDate() + days);
    return date;
  }

  public static setTime(now: Date): void {
    Time.freeze = now;
  }

  public static stopTime(): Date {
    Time.freeze = new Date();
    return Time.freeze;
  }

  public static resumeTime(): void {
    Time.freeze = null;
  }

  public static readonly isToday = (date: Date): boolean => {
    return dayjs(date).utc().isSame(dayjs().utc(), 'day');
  };

  public static readonly convertTimestampToDate = (timestamp: number): Date => {
    return new Date(timestamp * 1000);
  };

  /**
   * Returns a new Date object set to the start of the day (00:00:00.000)
   * @param date - Optional date to use. If not provided, uses current date
   * @returns Date object set to start of day
   */
  public static startOfDay(date?: Date): Date {
    const targetDate = date ? dayjs(date) : dayjs(Time.now());
    return targetDate.utc().startOf('day').toDate();
  }

  /**
   * Returns a new Date object set to the end of the day (23:59:59.999)
   * @param date - Optional date to use. If not provided, uses current date
   * @returns Date object set to end of day
   */
  public static endOfDay(date?: Date): Date {
    const targetDate = date ? dayjs(date) : dayjs(Time.now());
    return targetDate.utc().endOf('day').toDate();
  }
}
