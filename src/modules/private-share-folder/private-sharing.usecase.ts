import { Injectable } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';
import { Sequelize } from 'sequelize';
import { SequelizePrivateSharingRepository } from './private-sharing.repository';

@Injectable()
export class PrivateSharingUseCase {
  constructor(
    private privateSharingRespository: SequelizePrivateSharingRepository,
  ) {}
  async getSentFolders(
    user: User,
    offset: number,
    limit: number,
    order: [string, string][],
  ): Promise<Folder[]> {
    const folders =
      await this.privateSharingRespository.findSharedByMePrivateFolders(
        user.id,
        offset,
        limit,
        order,
      );
    return folders;
  }

  async getReceivedFolders(
    user: User,
    offset: number,
    limit: number,
    order: [string, string][],
  ): Promise<Folder[]> {
    const folders =
      await this.privateSharingRespository.findSharedWithMePrivateFolders(
        user.id,
        offset,
        limit,
        order,
      );
    return folders;
  }
}
