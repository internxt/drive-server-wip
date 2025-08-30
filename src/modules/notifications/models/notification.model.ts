import {
  Column,
  Model,
  Table,
  PrimaryKey,
  DataType,
  Default,
  AllowNull,
} from 'sequelize-typescript';
import { NotificationAttributes } from '../domain/notification.domain';

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

  @AllowNull(true)
  @Column(DataType.TEXT)
  link: string | null;

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
  @Default(true)
  @Column(DataType.BOOLEAN)
  isActive: boolean;

  @AllowNull(false)
  @Column(DataType.DATE)
  createdAt: Date;

  @AllowNull(false)
  @Column(DataType.DATE)
  updatedAt: Date;
}
