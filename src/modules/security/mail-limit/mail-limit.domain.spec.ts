import { MailLimit } from './mail-limit.domain';
import { MailTypes } from './mailTypes';
import { Time } from '../../../lib/time';

describe('MailLimit', () => {
  const buildMailLimit = (lastMailSent: Date, attemptsCount = 1) =>
    MailLimit.build({
      id: 1,
      userId: 10,
      mailType: MailTypes.OutdatedClient,
      attemptsCount,
      attemptsLimit: 1,
      lastMailSent,
    });

  describe('wasSentInTheLastDays', () => {
    it('When the mail was sent within the period, then it was sent recently', () => {
      const mailLimit = buildMailLimit(Time.daysAgo(3));

      const wasSent = mailLimit.wasSentInTheLastDays(14);

      expect(wasSent).toBe(true);
    });

    it('When the mail was sent before the period, then it was not sent recently', () => {
      const mailLimit = buildMailLimit(Time.daysAgo(15));

      const wasSent = mailLimit.wasSentInTheLastDays(14);

      expect(wasSent).toBe(false);
    });

    it('When the mail was never sent, then it was not sent recently', () => {
      const mailLimit = buildMailLimit(new Date(0), 0);

      const wasSent = mailLimit.wasSentInTheLastDays(14);

      expect(wasSent).toBe(false);
    });
  });

  describe('markAsSent', () => {
    it('When marking the mail as sent, then it counts the attempt and stores the date', () => {
      const mailLimit = buildMailLimit(new Date(0), 0);
      const sentAt = new Date('2026-11-17T10:00:00.000Z');

      mailLimit.markAsSent(sentAt);

      expect(mailLimit.attemptsCount).toBe(1);
      expect(mailLimit.lastMailSent).toEqual(sentAt);
    });

    it('When marking the mail as sent without a date, then it stores the current date', () => {
      const mailLimit = buildMailLimit(new Date(0), 0);
      const before = Date.now();

      mailLimit.markAsSent();

      expect(mailLimit.attemptsCount).toBe(1);
      expect(mailLimit.lastMailSent.getTime()).toBeGreaterThanOrEqual(before);
    });
  });
});
