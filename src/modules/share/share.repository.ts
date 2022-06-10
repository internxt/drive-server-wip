import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Share } from './share.domain';
import { File } from '../file/file.domain';
import {
  Column,
  Model,
  Table,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  DataType,
  Default,
  Unique,
} from 'sequelize-typescript';
import { FileModel } from '../file/file.repository';
@Table({
  underscored: true,
  timestamps: false,
  tableName: 'shares',
})
export class ShareModel extends Model {
  @PrimaryKey
  @Column
  id: number;

  @Unique
  @Column
  token: string;

  @Column(DataType.BLOB)
  mnemonic: string;

  // relation??
  @Column
  user: number;

  @ForeignKey(() => FileModel)
  @Column(DataType.STRING(24))
  fileId: string;

  @BelongsTo(() => FileModel, 'fileId')
  file: FileModel;

  @Column(DataType.STRING(64))
  encryptionKey: string;

  @Column(DataType.STRING(24))
  bucket: string;

  @Column(DataType.STRING(64))
  fileToken: string;

  @Default(false)
  @Column
  isFolder: boolean;

  @Default(1)
  @Column
  views: number;
}

export interface ShareRepository {
  findAllByUser(user: any): Promise<Array<Share> | []>;
}

@Injectable()
export class SequelizeShareRepository implements ShareRepository {
  constructor(
    @InjectModel(ShareModel)
    private shareModel: typeof ShareModel,
    @InjectModel(FileModel)
    private fileModel: typeof FileModel,
  ) {}

  async findAllByUser(user): Promise<Array<Share> | []> {
    const files = await this.shareModel.findAll({
      where: {
        user: user.email,
        mnemonic: '',
      },
      include: [
        {
          model: this.fileModel,
          where: { userId: user.id },
        },
      ],
    });
    return files.map((file) => {
      return this.toDomain(file);
    });
  }

  toDomain(model): Share {
    return Share.build({
      ...model.toJSON(),
      file: model.file ? File.build(model.file) : null,
    });
  }

  toModel(domain) {
    return domain.toJSON();
  }
}
