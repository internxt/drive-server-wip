import {
  Column,
  Model,
  Table,
  PrimaryKey,
  DataType,
  Default,
  AllowNull,
  BelongsTo,
  ForeignKey,
} from 'sequelize-typescript';
import { NotificationModel } from './notification.model';
import { type UserNotificationStatusAttributes } from '../domain/user-notification-status.domain';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'user_notification_status',
})
export class UserNotificationStatusModel extends Model<UserNotificationStatusAttributes> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  userId: string;

  @AllowNull(false)
  @ForeignKey(() => NotificationModel)
  @Column(DataType.UUID)
  notificationId: string;

  @AllowNull(false)
  @Default(DataType.NOW)
  @Column(DataType.DATE)
  deliveredAt: Date;

  @AllowNull(true)
  @Column(DataType.DATE)
  readAt: Date | null;

  @AllowNull(false)
  @Column(DataType.DATE)
  createdAt: Date;

  @AllowNull(false)
  @Column(DataType.DATE)
  updatedAt: Date;

  @BelongsTo(() => NotificationModel)
  notification: NotificationModel;
}
