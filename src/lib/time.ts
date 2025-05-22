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
    const todayDate = new Date();
    return (
      date.getDate() === todayDate.getDate() &&
      date.getMonth() === todayDate.getMonth() &&
      date.getFullYear() === todayDate.getFullYear()
    );
  };

  public static readonly convertTimestampToDate = (timestamp: number): Date => {
    return new Date(timestamp * 1000);
  };
}
