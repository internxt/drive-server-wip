import { HttpStatus } from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { SequelizeFileRepository } from '../file/file.repository';
import { type File, FileStatus } from '../file/file.domain';
import { SequelizeSharingRepository } from '../sharing/sharing.repository';
import { newFile, newSharingInvite } from '../../../test/fixtures';
import {
  createTestUser,
  type TestUserContext,
} from '../../../test/helpers/user.helper';
import { createTestApp } from '../../../test/helpers/test-app.helper';
import { ItemToTrashType } from './dto/controllers/move-items-to-trash.dto';

describe('Trash module', () => {
  let app: NestExpressApplication;
  let testUser: TestUserContext;
  let anotherTestUser: TestUserContext;
  let fileRepository: SequelizeFileRepository;
  let sharingRepository: SequelizeSharingRepository;

  beforeAll(async () => {
    app = await createTestApp();
    fileRepository = app.get(SequelizeFileRepository);
    sharingRepository = app.get(SequelizeSharingRepository);
  });

  beforeEach(async () => {
    testUser = await createTestUser(app);
    anotherTestUser = await createTestUser(app);
  });

  afterEach(async () => {
    await testUser.cleanup();
    await anotherTestUser.cleanup();
  });

  afterAll(async () => {
    await app.close();
  });

  const createUserFile = (owner: TestUserContext) =>
    fileRepository.create(
      newFile({
        attributes: {
          folderId: owner.rootFolder?.id,
          folderUuid: owner.rootFolder?.uuid,
          userId: owner.user.id,
          status: FileStatus.EXISTS,
        },
      }),
    );

  describe('POST /storage/trash/add', () => {
    const inviteToFile = async (file: File, invited: TestUserContext) => {
      const [role] = await sharingRepository.findRoles();
      return sharingRepository.createInvite(
        newSharingInvite({
          itemId: file.uuid,
          itemType: 'file',
          sharedWith: invited.user.uuid,
          roleId: role.id,
        }),
      );
    };

    const moveFileToTrash = (requester: TestUserContext, file: File) =>
      request(app.getHttpServer())
        .post('/storage/trash/add')
        .set('Authorization', `bearer ${requester.token}`)
        .send({ items: [{ uuid: file.uuid, type: ItemToTrashType.FILE }] });

    it('When the user moves their own file to the trash, then the file is trashed and its invitations are removed', async () => {
      const file = await createUserFile(testUser);
      await inviteToFile(file, anotherTestUser);

      const response = await moveFileToTrash(testUser, file);
      const trashedFile = await fileRepository.findOneBy({ uuid: file.uuid });
      const invites = await sharingRepository.getInvitesByItem(
        file.uuid,
        'file',
      );

      expect(response.status).toBe(HttpStatus.OK);
      expect(trashedFile.status).toBe(FileStatus.TRASHED);
      expect(invites).toHaveLength(0);
    });

    it('When the user tries to move a file of another user to the trash, then the file and its invitations are kept', async () => {
      const anotherUserFile = await createUserFile(anotherTestUser);
      await inviteToFile(anotherUserFile, testUser);

      await moveFileToTrash(testUser, anotherUserFile);
      const storedFile = await fileRepository.findOneBy({
        uuid: anotherUserFile.uuid,
      });
      const invites = await sharingRepository.getInvitesByItem(
        anotherUserFile.uuid,
        'file',
      );
      await sharingRepository.bulkDeleteInvites([anotherUserFile.uuid], 'file');

      expect(storedFile.status).toBe(FileStatus.EXISTS);
      expect(invites).toHaveLength(1);
    });
  });
});
