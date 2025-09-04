import { Time } from '../../../lib/time';

export enum NotificationTargetType {
  ALL = 'all',
  USER = 'user',
}

export interface NotificationWithStatus {
  notification: Notification;
  isRead: boolean;
  deliveredAt: Date;
  readAt: Date | null;
}

export interface NotificationAttributes {
  id: string;
  link: string;
  message: string;
  targetType: string;
  targetValue: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Notification implements NotificationAttributes {
  id: string;
  link: string;
  message: string;
  targetType: string;
  targetValue: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  constructor({
    id,
    link,
    message,
    targetType,
    targetValue,
    expiresAt,
    createdAt,
    updatedAt,
  }: NotificationAttributes) {
    this.id = id;
    this.link = link;
    this.message = message;
    this.targetType = targetType;
    this.targetValue = targetValue;
    this.expiresAt = expiresAt;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(attributes: NotificationAttributes): Notification {
    return new Notification(attributes);
  }

  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return Time.now() > this.expiresAt;
  }

  isTargetedForUser(userId: string): boolean {
    if (this.targetType === NotificationTargetType.ALL) return true;
    if (
      this.targetType === NotificationTargetType.USER &&
      this.targetValue === userId
    ) {
      return true;
    }
    return false;
  }
}
