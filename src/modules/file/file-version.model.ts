import {
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { FileModel } from './file.model';
import { UserModel } from '../user/user.model';
import {
  FileVersionAttributes,
  FileVersionStatus,
} from './file-version.domain';
import { Sequelize } from 'sequelize';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'file_versions',
})
export class FileVersionModel extends Model implements FileVersionAttributes {
  @PrimaryKey
  @Default(Sequelize.literal('uuid_generate_v4()'))
  @Column(DataType.UUIDV4)
  id: string;

  @ForeignKey(() => FileModel)
  @Column(DataType.UUIDV4)
  fileId: string;

  @BelongsTo(() => FileModel, 'fileId')
  file: FileModel;

  @ForeignKey(() => UserModel)
  @Column(DataType.STRING(36))
  userId: string;

  @BelongsTo(() => UserModel, 'userId')
  user: UserModel;

  @Column(DataType.STRING)
  networkFileId: string;

  @Column(DataType.BIGINT.UNSIGNED)
  size: bigint;

  @Column({
    type: DataType.ENUM,
    values: Object.values(FileVersionStatus),
    defaultValue: FileVersionStatus.EXISTS,
    allowNull: false,
  })
  status: FileVersionStatus;

  @Default(Sequelize.fn('NOW'))
  @Column
  createdAt: Date;

  @Default(Sequelize.fn('NOW'))
  @Column
  updatedAt: Date;
}
