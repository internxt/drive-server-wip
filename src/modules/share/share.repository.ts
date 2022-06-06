import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Share as ShareModel } from './share.model';
import { File as FileModel } from '../file/file.model';
import { Share } from './share.domain';
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
    console.log(user.id)
    const files = await this.shareModel.findAll({
      where: {
        user: user.email,
        mnemonic: '',
      },
      include: [
        {
          model: this.fileModel,
          as: 'fileInfo',
          where: { userId: user.id },
        },
      ],
    });
    return files.map((file) => {
      return this.toDomain(file);
    });
  }

  toDomain(model): Share {
    return Share.build(model.toJSON());
  }

  toModel(domain) {
    return domain.toJSON();
  }
}
