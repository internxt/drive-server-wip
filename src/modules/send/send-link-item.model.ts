import {
  Table,
  Model,
  PrimaryKey,
  Column,
  ForeignKey,
  BelongsTo,
  AllowNull,
  DataType,
} from 'sequelize-typescript';
import { SendLinkModel } from './send-link.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'send_links_items',
})
export class SendLinkItemModel extends Model {
  @PrimaryKey
  @Column
  id: string;

  @Column
  name: string;

  @Column
  type: string;

  @ForeignKey(() => SendLinkModel)
  @Column
  linkId: string;

  @BelongsTo(() => SendLinkModel)
  link: any;

  @AllowNull
  @Column
  networkId: string;

  @Column(DataType.STRING(64))
  encryptionKey: string;

  @Column(DataType.INTEGER.UNSIGNED)
  size: number;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;

  @Column(DataType.INTEGER)
  version: number;

  @Column
  parent_folder: string;
}
