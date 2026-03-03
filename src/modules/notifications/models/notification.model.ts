import {
  Column,
  Model,
  Table,
  PrimaryKey,
  DataType,
  Default,
  AllowNull,
  HasMany,
} from 'sequelize-typescript';
import { type NotificationAttributes } from '../domain/notification.domain';
import { UserNotificationStatusModel } from './user-notification-status.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'notifications',
})
export class NotificationModel extends Model implements NotificationAttributes {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  link: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  message: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  targetType: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  targetValue: string | null;

  @AllowNull(true)
  @Column(DataType.DATE)
  expiresAt: Date | null;

  @AllowNull(false)
  @Column(DataType.DATE)
  createdAt: Date;

  @AllowNull(false)
  @Column(DataType.DATE)
  updatedAt: Date;

  @HasMany(() => UserNotificationStatusModel)
  userNotificationStatuses: UserNotificationStatusModel[];
}
