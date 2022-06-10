import { Injectable, NotFoundException } from '@nestjs/common';
import { FileUseCases } from '../file/file.usecase';
import { User } from '../user/user.domain';
import { CreateShareDto } from './dto/create-share.dto';
import { Share } from './share.domain';
import { SequelizeShareRepository } from './share.repository';
import crypto from 'crypto';

@Injectable()
export class ShareUseCases {
  constructor(
    private shareRepository: SequelizeShareRepository,
    private fileUseCases: FileUseCases,
  ) {}

  async getShareByToken(token: string, user: User) {
    const share = await this.shareRepository.findByToken(token);
    // if is owner, not increment view
    if (!share.isOwner(user.id)) {
      if (share.canHaveView()) {
        share.incrementView();
        if (!share.canHaveView()) {
          // if next viewer cant view deactivate share
          share.deactivate();
        }
        await this.shareRepository.update(share);
      } else {
        throw new NotFoundException('cannot view this share');
      }
    }
    return {
      id: share.id,
      token: share.token,
      item: share.item,
      isFolder: share.isFolder,
      bucket: share.bucket,
      bucketToken: share.itemToken,
    };
  }
  async listByUserPaginated(user: any, page: number, perPage = 50) {
    const { count, items } = await this.shareRepository.findAllByUserPaginated(
      user,
      page,
      perPage,
    );

    return {
      pagination: {
        page,
        perPage,
        countAll: count,
      },
      items: items.map((share) => {
        return {
          id: share.id,
          token: share.token,
          item: share.item,
          views: share.views,
          timesValid: share.timesValid,
          active: share.active,
          createdAt: share.createdAt,
          updatedAt: share.updatedAt,
        };
      }),
    };
  }

  async createShareFile(
    fileId: string,
    user: User,
    { timesValid, active, encryptionKey, fileToken, bucket }: CreateShareDto,
  ) {
    const file = await this.fileUseCases.getByFileIdAndUser(fileId, user.id);
    if (!file) {
      throw new NotFoundException(`file with id ${fileId} not found`);
    }
    const share = await this.shareRepository.findByFileIdAndUser(
      file.id,
      user.id,
    );
    if (share) {
      return share.toJSON();
    }
    const token = crypto.randomBytes(10).toString('hex');
    const shareCreated = Share.build({
      id: 1,
      token,
      mnemonic: '',
      user: user,
      item: file,
      encryptionKey,
      bucket,
      itemToken: fileToken,
      isFolder: false,
      views: 0,
      timesValid,
      active,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    // await this.shareRepository.create(shareCreated);
    return shareCreated.toJSON();
  }
}
