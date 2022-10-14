import { Folder } from './../src/modules/folder/folder.domain';
import { Share } from './../src/modules/share/share.domain';

const mockFolder = Folder.build({
  id: 1,
  parentId: 529,
  name: 'ONzgORtJ77qI28jDnr+GjwJn6xELsAEqsn3FKlKNYbHR7Z129AD/WOMkAChEKx6rm7hOER2drdmXmC296dvSXtE5y5os0XCS554YYc+dcCOvvzjCQr6p+/BdhHlgRYg8cssug7p9DonVw19e',
  bucket: 'bucket',
  userId: 1,
  encryptVersion: '03-aes',
  deleted: true,
  deletedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
});

export class ShareMother {
  static createWithPassword(hashedPassword: string): Share {
    const share = Share.build({
      id: 1,
      token: 'token',
      mnemonic: 'test',
      bucket: 'test',
      isFolder: true,
      views: 0,
      timesValid: 10,
      active: true,
      createdAt: new Date('2022-09-22T08:06:02.436Z'),
      updatedAt: new Date('2022-09-22T08:06:02.436Z'),
      hashedPassword,
      userId: 3165201048,
      fileId: null,
      fileSize: null,
      folderId: 50,
      code: 'code',
      fileToken: 'fileToken',
    });

    share.item = mockFolder;

    return share;
  }
}
