import { newUserNotificationStatus } from '../../../../test/fixtures';

describe('UserNotificationStatus Domain', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('isRead', () => {
    it('When notification has readAt date, then it should be read', () => {
      const userNotificationStatus = newUserNotificationStatus({
        attributes: { readAt: new Date() },
      });

      const isRead = userNotificationStatus.isRead();

      expect(isRead).toBe(true);
    });

    it('When notification has no readAt date, then it should not be read', () => {
      const userNotificationStatus = newUserNotificationStatus({
        attributes: { readAt: null },
      });

      const isRead = userNotificationStatus.isRead();

      expect(isRead).toBe(false);
    });
  });

  describe('markAsRead', () => {
    it('When notification is marked as read, then readAt should be set to current date', () => {
      const fixedDate = new Date('2025-01-15T10:30:00.000Z');
      jest.setSystemTime(fixedDate);

      const userNotificationStatus = newUserNotificationStatus({
        attributes: { readAt: null },
      });

      expect(userNotificationStatus.readAt).toBeNull();

      userNotificationStatus.markAsRead();

      expect(userNotificationStatus.readAt).toEqual(fixedDate);
    });

    it('When notification is marked as read, then isRead should return true', () => {
      const userNotificationStatus = newUserNotificationStatus({
        attributes: { readAt: null },
      });

      expect(userNotificationStatus.isRead()).toBe(false);

      userNotificationStatus.markAsRead();

      expect(userNotificationStatus.isRead()).toBe(true);
    });
  });
});
