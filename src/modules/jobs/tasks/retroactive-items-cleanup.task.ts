import { Injectable, Logger } from '@nestjs/common';
import { SequelizeFolderRepository } from '../../folder/folder.repository';
import { SequelizeFileRepository } from '../../file/file.repository';
import { SequelizeUserRepository } from '../../user/user.repository';

@Injectable()
export class RetroActiveDeleteItemsCleanupTask {
  private readonly logger = new Logger(RetroActiveDeleteItemsCleanupTask.name);
  private readonly maxItemsPerBatch = 100;

  constructor(
    private readonly folderRepository: SequelizeFolderRepository,
    private readonly fileRepository: SequelizeFileRepository,
    private readonly usersRepository: SequelizeUserRepository,
  ) {}

  async cleanupOrphanedFolders(options?: { startFromUserId?: number }) {
    let processedUsers = 0;

    for await (const userBatch of this.getUsersOrderedById(
      this.maxItemsPerBatch,
      options?.startFromUserId,
    )) {
      for (const user of userBatch) {
        const lastDeletedFolder =
          await this.folderRepository.getLastDeletedFolder(user.id);

        if (!lastDeletedFolder) {
          processedUsers++;
          continue;
        }

        const lastDeletedFolderDate = lastDeletedFolder.updatedAt ?? new Date();
        const processedFolders = await this.processUserFolders(
          user.id,
          lastDeletedFolderDate,
        );
        const processedFiles = await this.processUserFiles(
          user.id,
          lastDeletedFolderDate,
        );

        processedUsers++;
        this.logger.log(
          `Deleted folders cleanup completed for user ${user.id}, affected folders: ${processedFolders}, affected files: ${processedFiles}`,
        );
      }

      this.logger.log(
        `Batch complete. Users processed: ${processedUsers}. Last user Processed id: ${userBatch.at(-1)?.id}`,
      );
    }

    this.logger.log(
      `Cleanup finished. Total users processed: ${processedUsers}`,
    );
  }

  async *getUsersOrderedById(limit: number = 100, startFromUserId?: number) {
    let offset = 0;
    let totalBatch = 0;
    do {
      const users = await this.usersRepository.getUsersOrderedById(
        limit,
        offset,
        startFromUserId,
      );
      totalBatch = users.length;

      yield users;
      offset += limit;
    } while (totalBatch === limit);
  }

  async processUserFolders(userId: number, cutoffDate: Date): Promise<number> {
    let hasMore = true;
    let totalUpdated = 0;

    while (hasMore) {
      const result =
        await this.folderRepository.getUuidOfFoldersWithNotDeletedChildrenByUser(
          userId,
          cutoffDate,
          this.maxItemsPerBatch,
        );

      const updatedFolders =
        await this.folderRepository.markChildFoldersAsRemoved(
          result.map(({ uuid }) => uuid),
        );

      hasMore = result.length === this.maxItemsPerBatch;
      totalUpdated = updatedFolders.updatedCount;
    }

    return totalUpdated;
  }

  async processUserFiles(userId: number, cutoffDate: Date): Promise<number> {
    let totalUpdated = 0;
    let hasMore = true;

    while (hasMore) {
      const result =
        await this.folderRepository.getUuidOfFoldersWithNotDeletedFilesByUser(
          userId,
          cutoffDate,
          this.maxItemsPerBatch,
        );
      const updatedFiles = await this.fileRepository.markFilesInFolderAsRemoved(
        result.map(({ uuid }) => uuid),
      );
      hasMore = result.length === this.maxItemsPerBatch;
      totalUpdated = updatedFiles.updatedCount;
    }

    return totalUpdated;
  }
}
