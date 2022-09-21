import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CryptoService } from '../../externals/crypto/crypto';
import { FileUseCases } from '../file/file.usecase';
import { UserAttributes } from '../user/user.domain';
import { Folder, FolderAttributes } from './folder.domain';
import { SequelizeFolderRepository } from './folder.repository';

@Injectable()
export class FolderUseCases {
  constructor(
    private folderRepository: SequelizeFolderRepository,
    @Inject(forwardRef(() => FileUseCases))
    private fileUseCases: FileUseCases,
    private readonly cryptoService: CryptoService,
  ) {}

  async getFolder(folderId: FolderAttributes['id']) {
    const folder = await this.folderRepository.findById(folderId);
    if (!folder) {
      throw new NotFoundException(`Folder with ID ${folderId} not found`);
    }
    return folder;
  }

  async getChildrenFoldersToUser(
    folderId: FolderAttributes['id'],
    userId: FolderAttributes['userId'],
    deleted: FolderAttributes['deleted'] = false,
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
    deleted: FolderAttributes['deleted'] = false,
  ) {
    const folders = await this.folderRepository.findAll({
      userId,
      deleted,
    });

    return folders;
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

  async deleteFolderPermanently(folder: Folder): Promise<void> {
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

  async deleteOrphansFolders(userId: UserAttributes['id']): Promise<void> {
    const remainingFolders = await this.folderRepository.clearOrphansFolders(
      userId,
    );

    if (remainingFolders > 0) {
      await this.deleteOrphansFolders(userId);
    }
  }

  decryptFolderName(folder: Folder): any {
    const decryptedName = this.cryptoService.decryptName(
      folder.name,
      folder.parentId,
    );

    return Folder.build({ ...folder, name: decryptedName }).toJSON();
  }
}
