import {
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import crypto from 'crypto';
import { Environment } from '@internxt/inxt-js';

import getEnv from '../../config/configuration';
import { User } from '../user/user.domain';
import { CreateShareDto } from './dto/create-share.dto';
import { Share } from './share.domain';
import { SequelizeShareRepository } from './share.repository';
import { FolderUseCases } from '../folder/folder.usecase';
import { UpdateShareDto } from './dto/update-share.dto';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { SequelizeFileRepository } from '../file/file.repository';
import { SequelizeFolderRepository } from '../folder/folder.repository';
import { SequelizeUserRepository } from '../user/user.repository';

@Injectable()
export class ShareUseCases {
  constructor(
    private shareRepository: SequelizeShareRepository,
    private filesRepository: SequelizeFileRepository,
    private foldersRepository: SequelizeFolderRepository,
    private usersRepository: SequelizeUserRepository,
    @Inject(forwardRef(() => FolderUseCases))
    private folderUseCases: FolderUseCases,
    private cryptoService: CryptoService,
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
    if (share.userId !== user.id) {
      throw new ForbiddenException(`You are not owner of this share`);
    }

    if (content.plainPassword === null) {
      share.hashedPassword = null;
    } else {
      share.hashedPassword = this.cryptoService.deterministicEncryption(
        content.plainPassword,
        getEnv().secrets.magicSalt,
      );
    }

    await this.shareRepository.update(share);
    return share.toJSON();
  }

  async getShareByToken(
    token: string,
    //user: User,
    code?: string,
    password?: string,
  ): Promise<Share> {
    const share = await this.shareRepository.findByToken(token);

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    if (share.isProtected()) {
      this.unlockShare(share, password);
    }

    if (!share.isActive()) {
      throw new NotFoundException('Share expired');
    }

    if (share.isFolder) {
      share.item = await this.foldersRepository.findById(share.folderId);
    } else {
      share.item = await this.filesRepository.findOne(
        share.fileId,
        share.userId,
      );

      if (code) {
        const shareOwner = await this.usersRepository.findById(share.userId);
        const fileInfo = await new Environment({
          bridgePass: shareOwner.userId,
          bridgeUser: shareOwner.bridgeUser,
          bridgeUrl: getEnv().apis.storage.url,
        }).getFileInfo(share.bucket, share.item.fileId);

        const encryptionKey = await Environment.utils.generateFileKey(
          share.decryptMnemonic(code),
          share.bucket,
          Buffer.from(fileInfo.index, 'hex'),
        );

        share.encryptionKey = encryptionKey.toString('hex');
      }
    }

    /*const isTheOwner = user && share.userId === user.id;

    if (!isTheOwner) {
      share.incrementView();
      await this.shareRepository.update(share);
    }*/

    return share;
  }

  async incrementShareView(share: Share, user: User) {
    const isTheOwner = user && share.userId === user.id;

    if (!isTheOwner) {
      share.incrementView();
      await this.shareRepository.update(share);
    }

    return true;
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
          code: share.code,
          createdAt: share.createdAt,
          updatedAt: share.updatedAt,
          fileSize: share.fileSize,
        };
      }),
    };
  }

  async deleteShareById(id: number, user: User) {
    const share = await this.shareRepository.findById(id);
    if (share.userId !== user.id) {
      throw new ForbiddenException(`You are not owner of this share`);
    }
    await this.shareRepository.deleteById(share.id);
    return true;
  }

  async createShareFile(
    fileId: number,
    user: User,
    {
      timesValid,
      itemToken,
      bucket,
      encryptedCode,
      encryptedMnemonic,
      encryptedPassword,
    }: CreateShareDto,
  ) {
    const file = await this.filesRepository.findOne(fileId, user.id);
    if (!file) {
      throw new NotFoundException(`File ${fileId} not found`);
    }
    const share = await this.shareRepository.findByFileIdAndUser(
      file.id,
      user.id,
    );
    if (share) {
      return { item: share, created: false, encryptedCode: share.code };
    }
    const token = crypto.randomBytes(10).toString('hex');

    const hashedPassword = encryptedPassword
      ? this.cryptoService.decryptText(encryptedPassword)
      : null;

    const newShare = Share.build({
      id: 1,
      token,
      mnemonic: encryptedMnemonic,
      userId: user.id,
      bucket,
      fileToken: itemToken,
      folderId: null,
      isFolder: false,
      views: 0,
      timesValid,
      active: true,
      code: encryptedCode,
      createdAt: new Date(),
      updatedAt: new Date(),
      fileId,
      fileSize: file.size,
      hashedPassword,
    });
    await this.shareRepository.create(newShare);

    return { item: newShare, created: true };
  }

  async createShareFolder(
    folderId: number,
    user: User,
    {
      timesValid,
      itemToken,
      bucket,
      encryptedPassword,
      encryptedMnemonic: mnemonic,
      encryptedCode: code,
    }: CreateShareDto,
  ) {
    const folder = await this.foldersRepository.findById(folderId);
    if (!folder) {
      throw new NotFoundException(`Folder ${folderId} not found`);
    }
    const share = await this.shareRepository.findByFolderIdAndUser(
      folder.id,
      user.id,
    );
    if (share) {
      return { item: share, created: false, encryptedCode: share.code };
    }

    const hashedPassword = encryptedPassword
      ? this.cryptoService.decryptText(encryptedPassword)
      : null;

    const token = crypto.randomBytes(10).toString('hex');
    const newShare = Share.build({
      id: 1,
      token,
      mnemonic,
      userId: user.id,
      bucket,
      fileToken: itemToken,
      fileId: null,
      isFolder: true,
      views: 0,
      timesValid,
      active: true,
      code,
      createdAt: new Date(),
      updatedAt: new Date(),
      folderId,
      fileSize: null,
      hashedPassword,
    });
    await this.shareRepository.create(newShare);

    return { item: newShare, created: true };
  }

  async deleteFileShare(fileId: number, user: User): Promise<void> {
    const share = await this.shareRepository.findByFileIdAndUser(
      fileId,
      user.id,
    );

    if (!share) {
      return;
    }

    if (share.userId !== user.id) {
      throw new ForbiddenException(`You are not owner of this share`);
    }

    return this.shareRepository.deleteById(share.id);
  }

  unlockShare(share: Share, password: string): void {
    if (!share.isProtected()) return;

    if (!password) {
      throw new UnauthorizedException('Share protected by password');
    }

    const hashedPassword = this.cryptoService.decryptText(password);

    if (hashedPassword !== share.hashedPassword) {
      throw new UnauthorizedException('Invalid password for share');
    }
  }
}
