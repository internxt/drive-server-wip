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
  declare id: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false })
  declare userId: string;

  @BelongsTo(() => UserModel)
  declare user: UserModel;

  @Column({ type: DataType.STRING, allowNull: false })
  declare token: string;

  @Column({ type: DataType.ENUM('macos', 'android', 'ios'), allowNull: false })
  declare type: 'macos' | 'android' | 'ios';

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare createdAt: Date;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare updatedAt: Date;
}
