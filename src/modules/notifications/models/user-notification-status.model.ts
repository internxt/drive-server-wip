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
  declare id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare userId: string;

  @AllowNull(false)
  @ForeignKey(() => NotificationModel)
  @Column(DataType.UUID)
  declare notificationId: string;

  @AllowNull(false)
  @Default(DataType.NOW)
  @Column(DataType.DATE)
  declare deliveredAt: Date;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare readAt: Date | null;

  @AllowNull(false)
  @Column(DataType.DATE)
  declare createdAt: Date;

  @AllowNull(false)
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => NotificationModel)
  declare notification: NotificationModel;
}
