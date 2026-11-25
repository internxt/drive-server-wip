import { HttpStatus } from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { v4 } from 'uuid';

import { SequelizeFolderRepository } from '../folder/folder.repository';
import { type Folder } from '../folder/folder.domain';
import { SequelizeSharingRepository } from './sharing.repository';
import { SharingType } from './sharing.domain';
import {
  createTestUser,
  type TestUserContext,
} from '../../../test/helpers/user.helper';
import { createTestApp } from '../../../test/helpers/test-app.helper';

describe('Sharing module', () => {
  let app: NestExpressApplication;
  let owner: TestUserContext;
  let otherUser: TestUserContext;
  let folderRepository: SequelizeFolderRepository;
  let sharingRepository: SequelizeSharingRepository;

  beforeAll(async () => {
    app = await createTestApp();
    folderRepository = app.get(SequelizeFolderRepository);
    sharingRepository = app.get(SequelizeSharingRepository);
  });

  beforeEach(async () => {
    owner = await createTestUser(app);
    otherUser = await createTestUser(app);
  });

  afterEach(async () => {
    await owner.cleanup();
    await otherUser.cleanup();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /sharings - Creates a public sharing', () => {
    let folder: Folder;

    const buildDto = (itemId: string) => ({
      itemId,
      itemType: 'folder',
      encryptionKey: 'encryption-key',
      encryptionAlgorithm: 'aes-256-gcm',
      encryptedCode: 'encrypted-code',
    });

    beforeEach(async () => {
      folder = await folderRepository.create(
        owner.user.id,
        'shared folder',
        owner.rootFolder.bucket,
        owner.rootFolder.id,
        '03-aes',
        owner.rootFolder.uuid,
      );
    });

    afterEach(async () => {
      await sharingRepository.deleteSharingsBy({ itemId: folder.uuid });
    });

    it('When the owner creates it, then it returns the public sharing', async () => {
      const response = await request(app.getHttpServer())
        .post('/sharings')
        .set('Authorization', `Bearer ${owner.token}`)
        .send(buildDto(folder.uuid))
        .expect(HttpStatus.CREATED);

      expect(response.body).toMatchObject({
        itemId: folder.uuid,
        type: SharingType.Public,
        ownerId: owner.user.uuid,
      });
    });

    it('When a user who is not the owner tries to create it, then it fails', async () => {
      await request(app.getHttpServer())
        .post('/sharings')
        .set('Authorization', `Bearer ${otherUser.token}`)
        .send(buildDto(folder.uuid))
        .expect(HttpStatus.FORBIDDEN);
    });

    it('When the item does not exist, then it fails', async () => {
      await request(app.getHttpServer())
        .post('/sharings')
        .set('Authorization', `Bearer ${owner.token}`)
        .send(buildDto(v4()))
        .expect(HttpStatus.NOT_FOUND);
    });
  });
});
