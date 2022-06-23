import {
  Column,
  Model,
  Table,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  DataType,
  AllowNull,
  HasMany,
} from 'sequelize-typescript';
import { UserModel } from 'src/modules/user/user.repository';
import { SendLinkItemModel } from './send-link-item.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'send_links',
})
export class SendLinkModel extends Model {
  @PrimaryKey
  @Column
  id: string;

  @Column
  views: number;

  @ForeignKey(() => UserModel)
  @Column
  userId: number;

  @BelongsTo(() => UserModel)
  user: UserModel;

  @Column
  receiver: string;

  @HasMany(() => SendLinkItemModel)
  items!: SendLinkItemModel[];
}
