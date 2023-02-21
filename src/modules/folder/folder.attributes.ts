export interface FolderAttributes {
  id: number;
  parentId: number;
  parent?: any;
  name: string;
  plain_name: string;
  bucket: string;
  userId: number;
  uuid: string;
  user?: any;
  encryptVersion: '03-aes';
  deleted: boolean;
  deletedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
