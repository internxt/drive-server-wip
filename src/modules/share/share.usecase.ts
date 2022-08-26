import {
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
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
    @Inject(forwardRef(() => FileUseCases))
    private fileUseCases: FileUseCases,
    @Inject(forwardRef(() => FolderUseCases))
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
      throw new ForbiddenException(`You are not owner of this share`);
    }
    share.timesValid = content.timesValid;
    share.active = content.active;

    await this.shareRepository.update(share);
    return share.toJSON();
  }

  async getShareByToken(token: string, user: User) {
    const share = await this.shareRepository.findByToken(token);
    // if is owner, not increment view
    const isTheOwner = user && share.isOwner(user.id);
    if (!isTheOwner) {
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

    return share;
  }
  async listByUserPaginated(
    user: any,
    page = 0,
    perPage = 50,
    orderBy?: 'views:ASC' | 'views:DESC' | 'createdAt:ASC' | 'createdAt:DESC',
  ) {
    const { count, items } = await this.shareRepository.findAllByUserPaginated(
      user,
      page,
      perPage,
      orderBy,
    );

    return {
      pagination: {
        page,
        perPage,
        countAll: count,
        orderBy,
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

  async deleteShareById(id: number, user: User) {
    const share = await this.shareRepository.findById(id);
    if (share.user.id !== user.id) {
      throw new ForbiddenException(`You are not owner of this share`);
    }
    await this.shareRepository.delete(share);
    return true;
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
      return { item: share, created: false };
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
    return { item: shareCreated, created: true };
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
      return { item: share, created: false };
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

    return { item: shareCreated, created: true };
  }

  async deleteFileShare(fileId: number, user: User): Promise<void> {
    const share = await this.shareRepository.findByFileIdAndUser(
      fileId,
      user.id,
    );

    if (share.user.id !== user.id) {
      throw new ForbiddenException(`You are not owner of this share`);
    }

    return this.shareRepository.delete(share);
  }
}
