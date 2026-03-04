import {
  Model,
  Table,
  Column,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { UserModel } from './user.model';
import { type UserNotificationTokenAttributes } from './user-notification-tokens.attribute';

@Table({
  tableName: 'user_notification_tokens',
  underscored: true,
  timestamps: true,
})
export class UserNotificationTokensModel
  extends Model
  implements UserNotificationTokenAttributes
{
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false })
  userId: string;

  @BelongsTo(() => UserModel)
  user: UserModel;

  @Column({ type: DataType.STRING, allowNull: false })
  token: string;

  @Column({ type: DataType.ENUM('macos', 'android', 'ios'), allowNull: false })
  type: 'macos' | 'android' | 'ios';

  @Column({ allowNull: false, defaultValue: DataType.NOW })
  createdAt: Date;

  @Column({ allowNull: false, defaultValue: DataType.NOW })
  updatedAt: Date;
}
