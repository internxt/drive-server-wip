import { Injectable } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';
import { PrivateSharingFolderRolesRepository } from './private-sharing-folder-roles.repository';

@Injectable()
export class PrivateSharingFolderRolesUseCase {
  constructor(
    private privateSharingFolderRolesRespository: PrivateSharingFolderRolesRepository,
  ) {}
  async removeByFolder(folderUuid: Folder['uuid']): Promise<any> {
    const sharingRemoved = await this.privateSharingFolderRolesRespository.removeByFolderUuid(folderUuid);
    return sharingRemoved;
  }

  async removeByUserAndFolder(folderUuid: Folder['uuid'], userUuid: User['uuid']): Promise<any>{
    const userSharedRemoved = await this.privateSharingFolderRolesRespository.removeByUserUuid(folderUuid, userUuid);
    return userSharedRemoved;
  }
}