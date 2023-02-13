import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { UserModel } from '../user/user.model';
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
  sender: string;

  @Column
  receivers: string;

  @Column
  code: string;

  @Column
  title: string;

  @Column
  subject: string;

  @Column
  expirationAt: Date;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;

  @AllowNull
  @Column(DataType.TEXT)
  hashedPassword: string;

  @HasMany(() => SendLinkItemModel)
  items: SendLinkItemModel[];
}
