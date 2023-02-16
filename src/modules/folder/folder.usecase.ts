import {
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { FileUseCases } from '../file/file.usecase';
import { User } from '../user/user.domain';
import { UserAttributes } from '../user/user.attributes';
import { SequelizeUserRepository } from '../user/user.repository';
import { Folder, FolderAttributes, FolderOptions } from './folder.domain';
import { SequelizeFolderRepository } from './folder.repository';

const invalidName = /[\\/]|^\s*$/;

@Injectable()
export class FolderUseCases {
  constructor(
    private folderRepository: SequelizeFolderRepository,
    private userRepository: SequelizeUserRepository,
    @Inject(forwardRef(() => FileUseCases))
    private fileUseCases: FileUseCases,
    private readonly cryptoService: CryptoService,
  ) {}

  async getFolder(
    folderId: FolderAttributes['id'],
    { deleted }: FolderOptions = { deleted: false },
  ) {
    const folder = await this.folderRepository.findById(folderId, deleted);
    if (!folder) {
      throw new NotFoundException(`Folder with ID ${folderId} not found`);
    }
    return folder;
  }

  async getChildrenFoldersToUser(
    folderId: FolderAttributes['id'],
    userId: FolderAttributes['userId'],
    { deleted }: FolderOptions = { deleted: false },
  ) {
    const folders = await this.folderRepository.findAllByParentIdAndUserId(
      folderId,
      userId,
      deleted,
    );

    return folders;
  }

  async getFoldersToUser(
    userId: FolderAttributes['userId'],
    { deleted }: FolderOptions = { deleted: false },
  ) {
    const folders = await this.folderRepository.findAll({
      userId,
      deleted,
    });

    return folders;
  }

  async createRootFolder(
    creator: User,
    name: FolderAttributes['name'],
    bucketId: string,
  ): Promise<Folder> {
    const isAGuestOnSharedWorkspace = creator.email !== creator.bridgeUser;
    let user = creator;

    if (isAGuestOnSharedWorkspace) {
      /* 
        The owner of all the folders in a shared workspace is the HOST, not the GUEST
        The owner email is on the bridgeUser field, as all the users on a shared workspace
        use the email of the owner as the network user. 
      */
      user = await this.userRepository.findByUsername(creator.bridgeUser);
    }

    if (name === '' || invalidName.test(name)) {
      throw new Error('Invalid folder name');
    }

    const encryptedFolderName = this.cryptoService.encryptName(name, null);

    const folder = await this.folderRepository.create(
      user.id,
      encryptedFolderName,
      bucketId,
      null,
      '03-aes',
    );

    return folder;
  }

  async createFolders(
    creator: User,
    folders: {
      name: FolderAttributes['name'];
      parentFolderId: FolderAttributes['id'];
    }[],
  ): Promise<Folder[]> {
    for (const { parentFolderId } of folders) {
      if (parentFolderId >= 2147483648) {
        throw new Error('Invalid parent folder');
      }
    }

    const isAGuestOnSharedWorkspace = creator.email !== creator.bridgeUser;
    let user = creator;

    if (isAGuestOnSharedWorkspace) {
      /* 
        The owner of all the folders in a shared workspace is the HOST, not the GUEST
        The owner email is on the bridgeUser field, as all the users on a shared workspace
        use the email of the owner as the network user. 
      */
      user = await this.userRepository.findByUsername(creator.bridgeUser);
    }

    return this.folderRepository.bulkCreate(
      folders.map((folder) => {
        return {
          userId: user.id,
          name: this.cryptoService.encryptName(
            folder.name,
            folder.parentFolderId,
          ),
          encryptVersion: '03-aes',
          bucket: null,
          parentId: folder.parentFolderId,
        };
      }),
    );
  }

  async createFolder(
    creator: User,
    name: FolderAttributes['name'],
    parentFolderId: FolderAttributes['id'],
  ): Promise<Folder> {
    if (parentFolderId >= 2147483648) {
      throw new Error('Invalid parent folder');
    }

    const isAGuestOnSharedWorkspace = creator.email !== creator.bridgeUser;
    let user = creator;

    if (isAGuestOnSharedWorkspace) {
      /* 
        The owner of all the folders in a shared workspace is the HOST, not the GUEST
        The owner email is on the bridgeUser field, as all the users on a shared workspace
        use the email of the owner as the network user. 
      */
      user = await this.userRepository.findByUsername(creator.bridgeUser);
    }

    const parentFolderExists = await this.folderRepository.findOne({
      id: parentFolderId,
      userId: user.id,
    });

    if (!parentFolderExists) {
      throw new Error('Parent folder does not exist or is not yours');
    }

    if (name === '' || invalidName.test(name)) {
      throw new Error('Invalid folder name');
    }

    const encryptedFolderName = this.cryptoService.encryptName(
      name,
      parentFolderId,
    );

    const nameAlreadyInUse = await this.folderRepository.findOne({
      parentId: parentFolderId,
      name: encryptedFolderName,
    });

    if (nameAlreadyInUse) {
      throw Error('Folder with the same name already exists');
    }

    const folder = await this.folderRepository.create(
      user.id,
      encryptedFolderName,
      null,
      parentFolderId,
      '03-aes',
    );

    return folder;
  }

  async moveFolderToTrash(folderId: FolderAttributes['id']): Promise<Folder> {
    return this.folderRepository.updateByFolderId(folderId, {
      deleted: true,
      deletedAt: new Date(),
    });
  }
  async moveFoldersToTrash(folderIds: FolderAttributes['id'][]): Promise<void> {
    this.folderRepository.updateManyByFolderId(folderIds, {
      deleted: true,
      deletedAt: new Date(),
    });
  }

  async getFolderSize(folderId: FolderAttributes['id']) {
    const folder = await this.folderRepository.findById(folderId);
    if (!folder) {
      throw new NotFoundException(`Folder ${folderId} does not exist`);
    }

    const foldersToCheck = [folder.id];
    let totalSize = 0;

    while (foldersToCheck.length > 0) {
      const currentFolderId = foldersToCheck.shift();

      const [childrenFolder, filesSize] = await Promise.all([
        this.folderRepository.findAllByParentIdAndUserId(
          currentFolderId,
          folder.userId,
          false,
        ),
        this.fileUseCases.getTotalSizeOfFilesFromFolder(currentFolderId),
      ]);
      totalSize += filesSize;

      childrenFolder.forEach((fld: Folder) => foldersToCheck.push(fld.id));
    }

    return totalSize;
  }

  async getFoldersByParent(folderId: number, page, perPage) {
    return this.folderRepository.findAllByParentId(
      folderId,
      false,
      page,
      perPage,
    );
  }

  async deleteFolderPermanently(folder: Folder, user: User): Promise<void> {
    if (folder.userId !== user.id) {
      Logger.error(
        `User with id: ${user.id} tried to delete a folder that does not own.`,
      );
      throw new ForbiddenException(`You are not owner of this share`);
    }

    if (folder.isRootFolder()) {
      throw new UnprocessableEntityException(
        `folder with id ${folder.id} is a root folder`,
      );
    }

    if (!folder.deleted) {
      throw new UnprocessableEntityException(
        `folder with id ${folder.id} cannot be permanently deleted`,
      );
    }

    await this.folderRepository.deleteById(folder.id);
  }

  getDriveFoldersCount(userId: UserAttributes['id']): Promise<number> {
    return this.folderRepository.getFoldersCountWhere({
      userId,
      deleted: false,
    });
  }

  getTrashFoldersCount(userId: UserAttributes['id']): Promise<number> {
    return this.folderRepository.getFoldersCountWhere({
      userId,
      deleted: true,
    });
  }

  getOrphanFoldersCount(userId: UserAttributes['id']): Promise<number> {
    return this.folderRepository.getFoldersWhoseParentIdDoesNotExist(userId);
  }

  async deleteOrphansFolders(userId: UserAttributes['id']): Promise<number> {
    let remainingFolders = await this.folderRepository.clearOrphansFolders(
      userId,
    );

    if (remainingFolders > 0) {
      remainingFolders += await this.deleteOrphansFolders(userId);
    } else {
      return remainingFolders;
    }
  }

  decryptFolderName(folder: Folder): any {
    const decryptedName = this.cryptoService.decryptName(
      folder.name,
      folder.parentId,
    );

    if (decryptedName === '') {
      throw new Error('Unable to decrypt folder name');
    }

    return Folder.build({ ...folder, name: decryptedName }).toJSON();
  }
}
