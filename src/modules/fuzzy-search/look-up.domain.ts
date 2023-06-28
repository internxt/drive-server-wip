import { FileModel } from '../file/file.model';
import { FolderModel } from '../folder/folder.model';
import { UserModel } from '../user/user.model';

export interface LookUpAttributes {
  id: string;
  userUuid: UserModel['uuid'];
  name: FileModel['plainName'] | FolderModel['plainName'];
}

export class LookUp implements LookUpAttributes {
  id: string;
  userUuid: string;
  name: string;

  private constructor(attributes: LookUpAttributes) {
    this.id = attributes.id;
    this.userUuid = attributes.userUuid;
    this.name = attributes.name;
  }

  static build(attributes: LookUpAttributes): LookUp {
    return new LookUp(attributes);
  }
}
