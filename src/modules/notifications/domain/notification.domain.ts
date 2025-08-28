import { Time } from '../../../lib/time';

export type NotificationTargetType = 'all' | 'user' | 'client_type';

export interface NotificationAttributes {
  id: string;
  link: string | null;
  message: string;
  targetType: string;
  targetValue: string | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Notification implements NotificationAttributes {
  id: string;
  link: string | null;
  message: string;
  targetType: string;
  targetValue: string | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor({
    id,
    link,
    message,
    targetType,
    targetValue,
    expiresAt,
    isActive,
    createdAt,
    updatedAt,
  }: NotificationAttributes) {
    this.id = id;
    this.link = link;
    this.message = message;
    this.targetType = targetType;
    this.targetValue = targetValue;
    this.expiresAt = expiresAt;
    this.isActive = isActive;
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
    if (this.targetType === 'all') return true;
    if (this.targetType === 'user' && this.targetValue === userId) return true;
    return false;
  }

  isValidForDelivery(): boolean {
    return this.isActive && !this.isExpired();
  }

  toJSON() {
    return {
      id: this.id,
      link: this.link,
      message: this.message,
      targetType: this.targetType,
      targetValue: this.targetValue,
      expiresAt: this.expiresAt,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
