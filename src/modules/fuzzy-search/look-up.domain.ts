import { type FileModel } from '../file/file.model';
import { type FolderModel } from '../folder/folder.model';
import { type UserModel } from '../user/user.model';

export const itemTypes = ['file', 'folder'] as const;

export type ItemType = (typeof itemTypes)[number];

export interface LookUpAttributes {
  id: string;
  itemId: FileModel['uuid'];
  itemType: ItemType;
  userId: UserModel['uuid'];
  name: FileModel['plainName'] | FolderModel['plainName'];
  tokenizedName: string;
}

export class LookUp implements LookUpAttributes {
  id: string;
  itemId: string;
  itemType: ItemType;
  userId: string;
  name: string;
  tokenizedName: string;

  private constructor(attributes: LookUpAttributes) {
    this.id = attributes.id;
    this.itemId = attributes.itemId;
    this.itemType = attributes.itemType;
    this.userId = attributes.userId;
    this.name = attributes.name;
    this.tokenizedName = attributes.tokenizedName;
  }

  static build(attributes: LookUpAttributes): LookUp {
    return new LookUp(attributes);
  }
}
