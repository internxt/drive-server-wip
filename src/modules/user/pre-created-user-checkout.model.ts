import {
  AllowNull,
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript';
import { type PreCreatedUserCheckoutAttributes } from './pre-created-user-checkout.attributes';
import { PreCreatedUserStatus } from './pre-created-users.attributes';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'pre_created_user_checkouts',
})
export class PreCreatedUserCheckoutModel
  extends Model
  implements PreCreatedUserCheckoutAttributes
{
  @PrimaryKey
  @Column(DataType.UUID)
  networkUuid: string;

  @Unique
  @AllowNull(false)
  @Column
  email: string;

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(PreCreatedUserStatus)))
  status: PreCreatedUserStatus;

  @AllowNull(true)
  @Column(DataType.UUID)
  tierId: string | null;

  @AllowNull(true)
  @Column(DataType.DATE)
  setupEmailSentAt: Date | null;

  @AllowNull(false)
  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  setupEmailResendCount: number;
}
