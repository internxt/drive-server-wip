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
  declare id: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare link: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare message: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare targetType: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare targetValue: string | null;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare expiresAt: Date | null;

  @AllowNull(false)
  @Column(DataType.DATE)
  declare createdAt: Date;

  @AllowNull(false)
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @HasMany(() => UserNotificationStatusModel)
  declare userNotificationStatuses: UserNotificationStatusModel[];
}
