import { v4 } from 'uuid';
import { Time } from '../../../lib/time';
import { newNotification } from '../../../../test/fixtures';

jest.mock('../../../lib/time');
const mockedTime = jest.mocked(Time);

describe('Notification Domain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isExpired', () => {
    it('When notification has no expiration date, then it should not be expired', () => {
      const notification = newNotification({
        attributes: { expiresAt: null },
      });

      const isExpired = notification.isExpired();

      expect(isExpired).toBe(false);
    });

    it('When notification expires in the future, then it should not be expired', () => {
      const futureDate = new Date('2025-12-31T23:59:59.000Z');
      const currentDate = new Date('2025-01-01T00:00:00.000Z');

      mockedTime.now.mockReturnValue(currentDate);

      const notification = newNotification({
        attributes: { expiresAt: futureDate },
      });

      const isExpired = notification.isExpired();

      expect(isExpired).toBe(false);
      expect(mockedTime.now).toHaveBeenCalled();
    });

    it('When notification expired in the past, then it should be expired', () => {
      const pastDate = new Date('2024-01-01T00:00:00.000Z');
      const currentDate = new Date('2025-01-01T00:00:00.000Z');

      mockedTime.now.mockReturnValue(currentDate);

      const notification = newNotification({
        attributes: { expiresAt: pastDate },
      });

      const isExpired = notification.isExpired();

      expect(isExpired).toBe(true);
      expect(mockedTime.now).toHaveBeenCalled();
    });
  });

  describe('isTargetedForUser', () => {
    const userId = v4();

    it('When notification targets all users, then it should be targeted for any user', () => {
      const notification = newNotification({
        attributes: { targetType: 'all', targetValue: null },
      });

      const isTargeted = notification.isTargetedForUser(userId);

      expect(isTargeted).toBe(true);
    });

    it('When notification targets specific user and user matches, then it should be targeted', () => {
      const notification = newNotification({
        attributes: { targetType: 'user', targetValue: userId },
      });

      const isTargeted = notification.isTargetedForUser(userId);

      expect(isTargeted).toBe(true);
    });

    it('When notification targets specific user and user does not match, then it should not be targeted', () => {
      const otherUserId = v4();
      const notification = newNotification({
        attributes: { targetType: 'user', targetValue: otherUserId },
      });

      const isTargeted = notification.isTargetedForUser(userId);

      expect(isTargeted).toBe(false);
    });
  });

  describe('isValidForDelivery', () => {
    it('When notification is expired, then it should not be valid for delivery', () => {
      const pastDate = new Date('2024-01-01T00:00:00.000Z');
      const currentDate = new Date('2025-01-01T00:00:00.000Z');

      mockedTime.now.mockReturnValue(currentDate);

      const notification = newNotification({
        attributes: { expiresAt: pastDate },
      });

      const isValid = notification.isValidForDelivery();

      expect(isValid).toBe(false);
    });

    it('When notification is active and has no expiration date, then it should be valid for delivery', () => {
      const notification = newNotification({
        attributes: { expiresAt: null },
      });

      const isValid = notification.isValidForDelivery();

      expect(isValid).toBe(true);
    });
  });
});
