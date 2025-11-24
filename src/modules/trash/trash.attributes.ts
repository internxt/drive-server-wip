export enum TrashItemType {
  File = 'file',
  Folder = 'folder',
}

export interface TrashAttributes {
  itemId: string;
  itemType: TrashItemType;
  caducityDate: Date;
  userId: number;
}
