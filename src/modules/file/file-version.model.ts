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
  type FileVersionAttributes,
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
  declare id: string;

  @ForeignKey(() => FileModel)
  @Column(DataType.UUIDV4)
  declare fileId: string;

  @BelongsTo(() => FileModel, 'fileId')
  declare file: FileModel;

  @ForeignKey(() => UserModel)
  @Column(DataType.STRING(36))
  declare userId: string;

  @BelongsTo(() => UserModel, 'userId')
  declare user: UserModel;

  @Column(DataType.STRING)
  declare networkFileId: string;

  @Column(DataType.BIGINT.UNSIGNED)
  declare size: bigint;

  @Column({
    type: DataType.ENUM,
    values: Object.values(FileVersionStatus),
    defaultValue: FileVersionStatus.EXISTS,
    allowNull: false,
  })
  declare status: FileVersionStatus;

  @Default(Sequelize.fn('NOW'))
  @Column(DataType.DATE)
  declare modificationTime: Date;

  @Default(Sequelize.fn('NOW'))
  @Column(DataType.DATE)
  declare createdAt: Date;

  @Default(Sequelize.fn('NOW'))
  @Column(DataType.DATE)
  declare updatedAt: Date;
}
