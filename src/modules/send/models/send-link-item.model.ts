import {
  Column,
  Model,
  Table,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  DataType,
  AllowNull,
} from 'sequelize-typescript';
import { FileModel } from 'src/modules/file/file.repository';
import { FolderModel } from 'src/modules/folder/folder.repository';
import { SendLinkModel } from './send-link.model';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'send_items',
})
export class SendLinkItemModel extends Model {
  @PrimaryKey
  @Column
  id: string;

  @Column
  type: string;

  @BelongsTo(() => FileModel, {
    foreignKey: 'send_link_item_id_fk',
    constraints: false,
  })
  file: FileModel;

  @BelongsTo(() => FolderModel, {
    foreignKey: 'send_link_item_id_fk',
    constraints: false,
  })
  folder: FolderModel;

  @Column
  itemType: string;

  @ForeignKey(() => SendLinkModel)
  @Column
  linkId: number;

  @BelongsTo(() => SendLinkModel)
  link: any;

  @AllowNull
  @Column
  networkId: string;

  @Column(DataType.STRING(64))
  encryptionKey: string;

  @Column
  size: bigint;
}
