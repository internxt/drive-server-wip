import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { FileUseCases } from '../file/file.usecase';
import { User } from '../user/user.domain';
import { CreateShareDto } from './dto/create-share.dto';
import { Share } from './share.domain';
import { SequelizeShareRepository } from './share.repository';
import crypto from 'crypto';
import { FolderUseCases } from '../folder/folder.usecase';
import { UpdateShareDto } from './dto/update-share.dto';

@Injectable()
export class ShareUseCases {
  constructor(
    private shareRepository: SequelizeShareRepository,
    private fileUseCases: FileUseCases,
    private folderUseCases: FolderUseCases,
  ) {}

  async getShareById(id: number) {
    return await this.shareRepository.findById(id);
  }

  async updateShareById(
    id: number,
    user: User,
    content: Partial<UpdateShareDto>,
  ) {
    const share = await this.shareRepository.findById(id);
    if (share.user.id !== user.id) {
      throw new UnauthorizedException(`You are not owner of this share`);
    }
    share.timesValid = content.timesValid;
    share.active = content.active;

    await this.shareRepository.update(share);
    return share.toJSON();
  }

  async getShareByToken(token: string, user: User) {
    const share = await this.shareRepository.findByToken(token);
    // if is owner, not increment view
    if ((user && !share.isOwner(user.id)) || !user) {
      if (share.isActive() && share.canHaveView()) {
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
    // if file send analytics track, but not in folder?
    return share;
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
          isFolder: share.isFolder,
          createdAt: share.createdAt,
          updatedAt: share.updatedAt,
        };
      }),
    };
  }

  async createShareFile(
    fileId: string,
    user: User,
    { timesValid, encryptionKey, itemToken, bucket }: CreateShareDto,
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
      return { item: share.toJSON(), created: false };
    }
    console.log(user, file, share);
    const token = crypto.randomBytes(10).toString('hex');
    const shareCreated = Share.build({
      id: 1,
      token,
      mnemonic: '',
      user: user,
      item: file,
      encryptionKey,
      bucket,
      itemToken,
      isFolder: false,
      views: 0,
      timesValid,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await this.shareRepository.create(shareCreated);
    // apply userReferral to share-file
    return { item: shareCreated.toJSON(), created: true };
  }

  async createShareFolder(
    folderId: number,
    user: User,
    { timesValid, encryptionKey, itemToken, bucket }: CreateShareDto,
  ) {
    const folder = await this.folderUseCases.getFolder(folderId);
    if (!folder) {
      throw new NotFoundException(`folder with id ${folderId} not found`);
    }
    const share = await this.shareRepository.findByFolderIdAndUser(
      folder.id,
      user.id,
    );
    if (share) {
      return { item: share.toJSON(), created: false };
    }
    const token = crypto.randomBytes(10).toString('hex');
    const shareCreated = Share.build({
      id: 1,
      token,
      mnemonic: '',
      user: user,
      item: folder,
      encryptionKey,
      bucket,
      itemToken,
      isFolder: true,
      views: 0,
      timesValid,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await this.shareRepository.create(shareCreated);

    return { item: shareCreated.toJSON(), created: true };
  }
}
