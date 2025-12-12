export interface UserNotificationStatusAttributes {
  id: string;
  userId: string;
  notificationId: string;
  deliveredAt: Date;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class UserNotificationStatus implements UserNotificationStatusAttributes {
  id: string;
  userId: string;
  notificationId: string;
  deliveredAt: Date;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  constructor({
    id,
    userId,
    notificationId,
    deliveredAt,
    readAt,
    createdAt,
    updatedAt,
  }: UserNotificationStatusAttributes) {
    this.id = id;
    this.userId = userId;
    this.notificationId = notificationId;
    this.deliveredAt = deliveredAt;
    this.readAt = readAt;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(
    attributes: UserNotificationStatusAttributes,
  ): UserNotificationStatus {
    return new UserNotificationStatus(attributes);
  }

  isRead(): boolean {
    return this.readAt !== null;
  }

  markAsRead(): void {
    this.readAt = new Date();
  }
}
