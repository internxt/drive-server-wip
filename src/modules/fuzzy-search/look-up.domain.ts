import { FileModel } from '../file/file.model';
import { FolderModel } from '../folder/folder.model';
import { UserModel } from '../user/user.model';

export const itemTypes = ['FILE', 'FOLDER'] as const;

export type ItemType = typeof itemTypes[number];

export interface LookUpAttributes {
  id: string;
  itemUuid: FileModel['uuid'];
  itemType: ItemType;
  userUuid: UserModel['uuid'];
  name: FileModel['plainName'] | FolderModel['plainName'];
  tokenizedName: string;
}

export class LookUp implements LookUpAttributes {
  id: string;
  itemUuid: string;
  itemType: ItemType;
  userUuid: string;
  name: string;
  tokenizedName: string;

  private constructor(attributes: LookUpAttributes) {
    this.id = attributes.id;
    this.itemUuid = attributes.itemUuid;
    this.itemType = attributes.itemType;
    this.userUuid = attributes.userUuid;
    this.name = attributes.name;
    this.tokenizedName = attributes.tokenizedName;
  }

  static build(attributes: LookUpAttributes): LookUp {
    return new LookUp(attributes);
  }
}
