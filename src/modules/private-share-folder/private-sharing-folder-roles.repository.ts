import { Injectable } from '@nestjs/common';
import { Folder } from '../folder/folder.domain';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../user/user.domain';
import { PrivateSharingFolderRolesModel } from './private-sharing-folder-roles.model';
import { PrivateSharingFolderRole } from './private-sharing-folder-roles.domain';

export interface PrivateSharingRolesRepository {
  removeByFolderUuid(
    folderUuid: Folder['uuid'],
  ): Promise<any>;
  removeByUserUuid(
    folderUuid: Folder['uuid'],
    userUuid: User['uuid'],
  ): Promise<any>;
}

@Injectable()
export class PrivateSharingFolderRolesRepository
  implements PrivateSharingRolesRepository
{
  constructor(
    @InjectModel(PrivateSharingFolderRolesModel)
    private privateSharingFolderRolesModel: typeof PrivateSharingFolderRolesModel,
  ) {}
    private async removeByField(fields: Partial<PrivateSharingFolderRole>) {
        const privateFolder = await this.privateSharingFolderRolesModel.destroy({
        where: fields
        });
        return privateFolder;
    }
    async removeByUserUuid(folderUuid: string, userUuid: string): Promise<any> {
        return await this.removeByField({ folderId: folderUuid, userId: userUuid})
    }
    async removeByFolderUuid(folderUuid: string): Promise<any> {
        return await this.removeByField({ folderId: folderUuid})
    }

}
