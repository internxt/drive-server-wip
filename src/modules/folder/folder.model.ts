import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  Index,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { UserModel } from '../user/user.model';
import { FolderAttributes } from './folder.attributes';
import { PrivateSharingFolderModel } from '../private-share-folder/private-sharing-folder.model';
import { ShareModel } from '../share/share.repository';
import { Share } from '../share/share.domain';
import { PrivateSharingFolder } from '../private-share-folder/private-sharing-folder.domain';
import { SharingModel } from '../sharing/models';

export const FOLDER_MODEL_TOKEN = Symbol('FolderModelToken');
@Table({
  underscored: true,
  timestamps: true,
  tableName: 'folders',
})
export class FolderModel extends Model implements FolderAttributes {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Index
  @Column
  uuid: string;

  @ForeignKey(() => FolderModel)
  @Column
  parentId: number;

  @BelongsTo(() => FolderModel)
  parent: FolderModel;

  @ForeignKey(() => FolderModel)
  @Column(DataType.UUIDV4)
  parentUuid: FolderAttributes['uuid'];

  @Index
  @Column
  name: string;

  @Column(DataType.STRING(24))
  bucket: string;

  @ForeignKey(() => UserModel)
  @Column
  userId: number;

  @BelongsTo(() => UserModel)
  user: UserModel;

  @HasMany(() => PrivateSharingFolderModel, {
    constraints: false,
  })
  privateSharingFolder: PrivateSharingFolderModel;

  @Column
  encryptVersion: '03-aes';

  @Index
  @Column
  plainName: string;

  @Default(false)
  @Column
  deleted: boolean;

  @Default(false)
  @Column
  removed: boolean;

  @AllowNull
  @Column
  deletedAt: Date;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;

  @Column
  removedAt: Date;

  @HasMany(() => ShareModel, 'folderId')
  shares: Share[];

  @HasMany(() => SharingModel, {
    foreignKey: 'itemId',
    sourceKey: 'uuid',
  })
  privateShares: SharingModel[];
}
