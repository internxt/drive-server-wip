import { Time } from '../../../lib/time';
import { MailTypes } from './mailTypes';
import { MailLimitModelAttributes } from './mail-limit.model';

export class MailLimit implements MailLimitModelAttributes {
  id: number;
  userId: number;
  mailType: MailTypes;
  attemptsCount: number;
  attemptsLimit: number;
  lastMailSent: Date;
  constructor({
    id,
    userId,
    mailType,
    attemptsCount,
    attemptsLimit,
    lastMailSent,
  }: MailLimitModelAttributes) {
    this.id = id;
    this.userId = userId;
    this.mailType = mailType;
    this.attemptsCount = attemptsCount;
    this.attemptsLimit = attemptsLimit;
    this.lastMailSent = lastMailSent;
  }

  static build(mailLimit: MailLimitModelAttributes): MailLimit {
    return new MailLimit(mailLimit);
  }

  isLimitForTodayReached() {
    return (
      Time.isToday(this.lastMailSent) &&
      this.attemptsCount >= this.attemptsLimit
    );
  }

  increaseTodayAttemps(customSentDate?: Date) {
    this.attemptsCount = Time.isToday(this.lastMailSent)
      ? this.attemptsCount + 1
      : 1;
    this.lastMailSent = customSentDate ?? new Date();
  }
}
