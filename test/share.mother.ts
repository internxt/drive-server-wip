import { Folder } from './../src/modules/folder/folder.domain';
import { File } from './../src/modules/file/file.domain';
import { Share } from './../src/modules/share/share.domain';

const mockFolder = Folder.build({
  id: 1,
  parentId: null,
  name: 'name',
  bucket: 'bucket',
  userId: 1,
  encryptVersion: '2',
  deleted: true,
  deletedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
});

const mockFile = File.build({
  id: 1,
  fileId: 'fileId',
  name: 'File 1',
  type: 'png',
  size: null,
  bucket: 'bucket',
  folderId: 1,
  encryptVersion: '',
  deleted: false,
  deletedAt: new Date('2022-09-22T08:06:02.436Z'),
  userId: 1,
  modificationTime: new Date('2022-09-22T08:06:02.436Z'),
  createdAt: new Date('2022-09-22T08:06:02.436Z'),
  updatedAt: new Date('2022-09-22T08:06:02.436Z'),
  folder: mockFolder,
});

export class ShareMother {
  static createWithPassword(hashedPassword: string): Share {
    const share = Share.build({
      id: 1,
      token: 'token',
      mnemonic: 'test',
      bucket: 'test',
      isFolder: false,
      views: 0,
      timesValid: 10,
      active: true,
      createdAt: new Date('2022-09-22T08:06:02.436Z'),
      updatedAt: new Date('2022-09-22T08:06:02.436Z'),
      hashedPassword,
      userId: 3165201048,
      fileId: 2769846583,
      fileSize: BigInt(965990699),
      folderId: 0,
      code: 'code',
      fileToken: 'fileToken',
    });

    share.item = mockFile;

    return share;
  }
}
