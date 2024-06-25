export interface UserNotificationTokenAttributes {
  id: string;
  userId: string;
  token: string;
  type: 'macos' | 'android' | 'ios';
  createdAt: Date;
  updatedAt: Date;
}
