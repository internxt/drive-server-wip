import {
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
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

  getShareById(id: number): Promise<Share> {
    return this.shareRepository.findById(id);
  }

  async shareIsOwned(user: User, share: Share): Promise<boolean> {
    const userIsNotGuest = !user.isGuestOnSharedWorkspace();
    const isOwnedByThisUser = user.id === share.userId;

    if (userIsNotGuest) {
      return isOwnedByThisUser;
    } else {
      const host = await this.usersRepository.findByBridgeUser(user.bridgeUser);
      const isOwnedByHost = host.id === share.userId;

      return isOwnedByHost;
    }
  }

  async updateShareById(
    id: number,
    user: User,
    content: Partial<UpdateShareDto>,
  ) {
    const share = await this.shareRepository.findById(id);
    const shareIsOwned = await this.shareIsOwned(user, share);

    if (!shareIsOwned) {
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
        {
          deleted: false,
        },
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
    user: User,
    page = 0,
    perPage = 50,
    orderBy?: 'views:ASC' | 'views:DESC' | 'createdAt:ASC' | 'createdAt:DESC',
  ) {
    const sharesUsersOwners = [user];

    if (user.isGuestOnSharedWorkspace()) {
      const host = await this.usersRepository.findByBridgeUser(user.bridgeUser);

      sharesUsersOwners.push(host);
    }

    const shares = await this.shareRepository.findAllByUsersPaginated(
      sharesUsersOwners,
      page,
      perPage,
      orderBy,
    );

    return {
      pagination: {
        page,
        perPage,
        orderBy,
      },
      items: shares.map((share) => {
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
          hashed_password: share.hashedPassword,
        };
      }),
    };
  }

  async deleteShareById(id: number, user: User) {
    const share = await this.shareRepository.findById(id);
    const shareIsOwned = await this.shareIsOwned(user, share);

    if (!shareIsOwned) {
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
      plainPassword,
    }: CreateShareDto,
  ) {
    const file = await this.filesRepository.findByIdNotDeleted(fileId);

    if (!file) {
      throw new NotFoundException(`File ${fileId} not found`);
    }

    const fileNotOwnedByThisUser = file.userId !== user.id;

    if (fileNotOwnedByThisUser) {
      if (user.isGuestOnSharedWorkspace()) {
        const host = await this.usersRepository.findByBridgeUser(
          user.bridgeUser,
        );

        const fileNotOwnedByHost = file.userId !== host.id;

        if (fileNotOwnedByHost) {
          throw new ForbiddenException(`You are not owner of this file`);
        }
      } else {
        throw new ForbiddenException(`You are not owner of this file`);
      }
    }

    const share = await this.shareRepository.findByFileIdAndUser(
      file.id,
      file.userId,
    );
    if (share) {
      return {
        id: share.id,
        item: share,
        created: false,
        encryptedCode: share.code,
      };
    }
    const token = crypto.randomBytes(10).toString('hex');

    const hashedPassword = plainPassword
      ? this.cryptoService.deterministicEncryption(
          plainPassword,
          getEnv().secrets.magicSalt,
        )
      : null;

    const newShare = Share.build({
      id: 1,
      token,
      mnemonic: encryptedMnemonic,
      userId: file.userId,
      bucket,
      fileToken: itemToken,
      folderId: null,
      fileUuid: file.uuid,
      folderUuid: null,
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
    const createdShare = await this.shareRepository.create(newShare);

    return {
      id: createdShare.id,
      item: newShare,
      encryptedCode,
      created: true,
    };
  }

  async createShareFolder(
    folderId: number,
    user: User,
    {
      timesValid,
      itemToken,
      bucket,
      plainPassword,
      encryptedMnemonic: mnemonic,
      encryptedCode: code,
    }: CreateShareDto,
  ) {
    const folder = await this.foldersRepository.findById(folderId);
    if (!folder) {
      throw new NotFoundException(`Folder ${folderId} not found`);
    }

    const folderIsOwnedByThisUser = folder.userId === user.id;

    if (!folderIsOwnedByThisUser) {
      if (user.isGuestOnSharedWorkspace()) {
        const host = await this.usersRepository.findByBridgeUser(
          user.bridgeUser,
        );

        const folderIsOwnedByHost = folder.userId === host.id;

        if (!folderIsOwnedByHost) {
          throw new ForbiddenException('You are not the owner of this folder');
        }
      } else {
        throw new ForbiddenException('You are not the owner of this folder');
      }
    }

    const share = await this.shareRepository.findByFolderIdAndUser(
      folder.id,
      folder.userId,
    );
    if (share) {
      return {
        id: share.id,
        item: share,
        created: false,
        encryptedCode: share.code,
      };
    }

    const hashedPassword = plainPassword
      ? this.cryptoService.deterministicEncryption(
          plainPassword,
          getEnv().secrets.magicSalt,
        )
      : null;

    const token = crypto.randomBytes(10).toString('hex');
    const newShare = Share.build({
      id: 1,
      token,
      mnemonic,
      userId: folder.userId,
      bucket,
      fileToken: itemToken,
      fileId: null,
      fileUuid: null,
      isFolder: true,
      folderUuid: folder.uuid,
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
    const createdShare = await this.shareRepository.create(newShare);

    return {
      id: createdShare.id,
      item: newShare,
      encryptedCode: code,
      created: true,
    };
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
      throw new ForbiddenException('Share protected by password');
    }

    const hashedPassword = this.cryptoService.deterministicEncryption(
      password,
      getEnv().secrets.magicSalt,
    );

    if (hashedPassword !== share.hashedPassword) {
      throw new ForbiddenException('Invalid password for share');
    }
  }

  decryptFilenameString(name: string, folderId: number): string | null {
    //On Folders, folderId is parentId. On Files, folderId is folderId
    const decryptedName = this.cryptoService.decryptName(name, folderId);
    return String(decryptedName).trim() === '' ? null : decryptedName;
  }
}
