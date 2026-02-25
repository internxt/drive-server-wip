import { type UserNotificationTokenAttributes } from './user-notification-tokens.attribute';

export class UserNotificationTokens implements UserNotificationTokenAttributes {
  id: string;
  userId: string;
  token: string;
  type: 'macos' | 'android' | 'ios';
  createdAt: Date;
  updatedAt: Date;

  constructor({
    id,
    userId,
    token,
    type,
    createdAt,
    updatedAt,
  }: UserNotificationTokenAttributes) {
    this.id = id;
    this.userId = userId;
    this.token = token;
    this.type = type;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(
    attributes: UserNotificationTokenAttributes,
  ): UserNotificationTokens {
    return new UserNotificationTokens(attributes);
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      token: this.token,
      type: this.type,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
