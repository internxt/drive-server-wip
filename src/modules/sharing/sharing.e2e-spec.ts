import { HttpStatus } from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { v4 } from 'uuid';
import { aes } from '@internxt/lib';

import { SequelizeFolderRepository } from '../folder/folder.repository';
import { type Folder } from '../folder/folder.domain';
import { SequelizeSharingRepository } from './sharing.repository';
import { SHARING_ACCESS_TOKEN_INVALID } from './exception/sharing-access-token-invalid.exception';
import { type Sharing, SharingType } from './sharing.domain';
import {
  createTestUser,
  type TestUserContext,
} from '../../../test/helpers/user.helper';
import { createTestApp } from '../../../test/helpers/test-app.helper';
import { Time } from '../../lib/time';

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

  describe('GET /sharings/public/items/:sharedFolderId - Lists a public folder', () => {
    const code = 'link-code';
    const password = 'link-password';
    let sharedFolder: Folder;
    let childFolder: Folder;

    const createSharing = (
      type: SharingType,
      encryptedPassword: string | null = null,
      itemId: Folder['uuid'] = sharedFolder.uuid,
    ): Promise<Sharing> =>
      sharingRepository.createSharing({
        itemId,
        itemType: 'folder',
        ownerId: owner.user.uuid,
        sharedWith:
          type === SharingType.Public
            ? '00000000-0000-0000-0000-000000000000'
            : otherUser.user.uuid,
        encryptionKey: 'encryption-key',
        encryptionAlgorithm: 'inxt-v2',
        encryptedCode: 'encrypted-code',
        encryptedPassword,
        type,
      } as Omit<Sharing, 'id'>);

    const listFolder = (
      type: 'folders' | 'files',
      options: { token?: string; accessToken?: string } = {},
    ) => {
      const req = request(app.getHttpServer())
        .get(`/sharings/public/items/${sharedFolder.uuid}/${type}`)
        .query({ code, token: options.token ?? '' });

      if (options.accessToken) {
        req.set('x-share-access-token', options.accessToken);
      }

      return req;
    };

    const unlockSharing = async (sharing: Sharing): Promise<string> => {
      const response = await request(app.getHttpServer())
        .get(`/sharings/${sharing.id}/meta`)
        .set('x-share-code', code)
        .set('x-share-password', encodeURIComponent(password))
        .expect(HttpStatus.OK);

      return response.body.accessToken;
    };

    beforeEach(async () => {
      sharedFolder = await folderRepository.create(
        owner.user.id,
        'shared folder',
        owner.rootFolder.bucket,
        owner.rootFolder.id,
        '03-aes',
        owner.rootFolder.uuid,
      );
      childFolder = await folderRepository.create(
        owner.user.id,
        'child folder',
        owner.rootFolder.bucket,
        sharedFolder.id,
        '03-aes',
        sharedFolder.uuid,
      );
    });

    afterEach(async () => {
      jest.restoreAllMocks();
      await sharingRepository.deleteSharingsBy({ ownerId: owner.user.uuid });
    });

    describe.each(['folders', 'files'] as const)('/%s', (type) => {
      it('When the navigation token is not valid, then it is forbidden', async () => {
        await createSharing(SharingType.Public);

        await listFolder(type, { token: 'not-a-valid-token' }).expect(
          HttpStatus.FORBIDDEN,
        );
      });

      it('When the folder id is not a valid UUID, then it is a bad request', async () => {
        await request(app.getHttpServer())
          .get(`/sharings/public/items/not-a-uuid/${type}`)
          .query({ code })
          .expect(HttpStatus.BAD_REQUEST);
      });

      it('When the folder is only shared privately, then it is not found', async () => {
        await createSharing(SharingType.Private);

        await listFolder(type).expect(HttpStatus.NOT_FOUND);
      });

      it('When the folder is shared publicly, then it returns its content', async () => {
        await createSharing(SharingType.Public);

        const response = await listFolder(type).expect(HttpStatus.OK);

        expect(response.body.token).toEqual(expect.any(String));
      });

      it('When the folder is shared both privately and publicly, then the public link returns its content', async () => {
        await createSharing(SharingType.Private);
        await createSharing(SharingType.Public);

        await listFolder(type).expect(HttpStatus.OK);
      });

      it('When the link has a password and it was unlocked, then it returns its content', async () => {
        const sharing = await createSharing(
          SharingType.Public,
          aes.encrypt(password, code),
        );
        const accessToken = await unlockSharing(sharing);

        await listFolder(type, { accessToken }).expect(HttpStatus.OK);
      });

      it('When the link has a password and the access token is not valid, then it is forbidden', async () => {
        await createSharing(SharingType.Public, aes.encrypt(password, code));

        const response = await listFolder(type, {
          accessToken: 'not-a-valid-token',
        }).expect(HttpStatus.FORBIDDEN);

        expect(response.body.errorCode).toBe(SHARING_ACCESS_TOKEN_INVALID);
      });

      it('When the link has a password and the access token has expired, then it is forbidden', async () => {
        const sharing = await createSharing(
          SharingType.Public,
          aes.encrypt(password, code),
        );
        const accessToken = await unlockSharing(sharing);
        jest
          .spyOn(Date, 'now')
          .mockReturnValue(Time.dateWithTimeAdded(25, 'hour').getTime());

        const response = await listFolder(type, { accessToken }).expect(
          HttpStatus.FORBIDDEN,
        );

        expect(response.body.errorCode).toBe(SHARING_ACCESS_TOKEN_INVALID);
      });

      // TODO: expect SHARING_ACCESS_TOKEN_INVALID after bypass removal
      it('When the link has a password and no access token is sent, then it still returns its content', async () => {
        await createSharing(SharingType.Public, aes.encrypt(password, code));

        await listFolder(type).expect(HttpStatus.OK);
      });
    });

    it('When navigating into a subfolder of a public folder, then it returns its content', async () => {
      await createSharing(SharingType.Public);
      const rootResponse = await listFolder('folders').expect(HttpStatus.OK);

      const response = await request(app.getHttpServer())
        .get(`/sharings/public/items/${childFolder.uuid}/folders`)
        .query({ code, token: rootResponse.body.token })
        .expect(HttpStatus.OK);

      expect(response.body.items).toEqual([]);
    });

    it('When the folder stops being public, then navigating with an old token is not found', async () => {
      const sharing = await createSharing(SharingType.Public);
      const rootResponse = await listFolder('folders').expect(HttpStatus.OK);
      await sharingRepository.deleteSharingsBy({ id: sharing.id });
      await createSharing(SharingType.Private);

      await request(app.getHttpServer())
        .get(`/sharings/public/items/${childFolder.uuid}/folders`)
        .query({ code, token: rootResponse.body.token })
        .expect(HttpStatus.NOT_FOUND);
    });

    it('When navigating back up from a subfolder, then it returns the shared folder content', async () => {
      await createSharing(SharingType.Public);
      const rootResponse = await listFolder('folders').expect(HttpStatus.OK);
      const childResponse = await request(app.getHttpServer())
        .get(`/sharings/public/items/${childFolder.uuid}/folders`)
        .query({ code, token: rootResponse.body.token })
        .expect(HttpStatus.OK);

      const response = await listFolder('folders', {
        token: childResponse.body.token,
      }).expect(HttpStatus.OK);

      expect(response.body.items).toEqual([
        expect.objectContaining({ uuid: childFolder.uuid }),
      ]);
    });

    it('When navigating up from the shared folder, then it is not found', async () => {
      await createSharing(SharingType.Public);
      const rootResponse = await listFolder('folders').expect(HttpStatus.OK);

      await request(app.getHttpServer())
        .get(`/sharings/public/items/${owner.rootFolder.uuid}/folders`)
        .query({ code, token: rootResponse.body.token })
        .expect(HttpStatus.NOT_FOUND);
    });

    it('When navigating to a folder outside the shared folder, then it is not found', async () => {
      await createSharing(SharingType.Public);
      const outsideFolder = await folderRepository.create(
        owner.user.id,
        'outside folder',
        owner.rootFolder.bucket,
        owner.rootFolder.id,
        '03-aes',
        owner.rootFolder.uuid,
      );
      const rootResponse = await listFolder('folders').expect(HttpStatus.OK);

      await request(app.getHttpServer())
        .get(`/sharings/public/items/${outsideFolder.uuid}/folders`)
        .query({ code, token: rootResponse.body.token })
        .expect(HttpStatus.NOT_FOUND);
    });

    it('When the shared folder is in the trash, then it is not found', async () => {
      await createSharing(SharingType.Public);
      await folderRepository.updateById(sharedFolder.id, { deleted: true });

      await listFolder('folders').expect(HttpStatus.NOT_FOUND);
    });

    it('When a folder that is not shared is in the trash, then it is not found', async () => {
      await folderRepository.updateById(sharedFolder.id, { deleted: true });

      await listFolder('folders').expect(HttpStatus.NOT_FOUND);
    });

    it('When the access token was granted for another link, then it is forbidden', async () => {
      const otherFolder = await folderRepository.create(
        owner.user.id,
        'other shared folder',
        owner.rootFolder.bucket,
        owner.rootFolder.id,
        '03-aes',
        owner.rootFolder.uuid,
      );
      const otherSharing = await createSharing(
        SharingType.Public,
        aes.encrypt(password, code),
        otherFolder.uuid,
      );
      const accessToken = await unlockSharing(otherSharing);
      await createSharing(SharingType.Public, aes.encrypt(password, code));

      const response = await listFolder('folders', { accessToken }).expect(
        HttpStatus.FORBIDDEN,
      );

      expect(response.body.errorCode).toBe(SHARING_ACCESS_TOKEN_INVALID);
    });

    it('When the password changed after the link was unlocked, then it is forbidden', async () => {
      const sharing = await createSharing(
        SharingType.Public,
        aes.encrypt(password, code),
      );
      const accessToken = await unlockSharing(sharing);
      await sharingRepository.updateSharing(
        { id: sharing.id },
        { encryptedPassword: aes.encrypt('new-password', code) },
      );

      const response = await listFolder('folders', { accessToken }).expect(
        HttpStatus.FORBIDDEN,
      );

      expect(response.body.errorCode).toBe(SHARING_ACCESS_TOKEN_INVALID);
    });
  });

  describe('GET /sharings/:sharingId/meta - Gets a public sharing', () => {
    const code = 'link-code';
    const password = 'link-password';
    let sharedFolder: Folder;

    const createSharing = (
      encryptedPassword: string | null = null,
    ): Promise<Sharing> =>
      sharingRepository.createSharing({
        itemId: sharedFolder.uuid,
        itemType: 'folder',
        ownerId: owner.user.uuid,
        sharedWith: '00000000-0000-0000-0000-000000000000',
        encryptionKey: 'encryption-key',
        encryptionAlgorithm: 'inxt-v2',
        encryptedCode: 'encrypted-code',
        encryptedPassword,
        type: SharingType.Public,
      } as Omit<Sharing, 'id'>);

    beforeEach(async () => {
      sharedFolder = await folderRepository.create(
        owner.user.id,
        'shared folder',
        owner.rootFolder.bucket,
        owner.rootFolder.id,
        '03-aes',
        owner.rootFolder.uuid,
      );
    });

    afterEach(async () => {
      await sharingRepository.deleteSharingsBy({ itemId: sharedFolder.uuid });
    });

    it('When the code is sent in the header, then it returns the sharing', async () => {
      const sharing = await createSharing();

      const response = await request(app.getHttpServer())
        .get(`/sharings/${sharing.id}/meta`)
        .set('x-share-code', code)
        .expect(HttpStatus.OK);

      expect(response.body).toMatchObject({ id: sharing.id });
    });

    it('When the code is sent as query param, then it returns the sharing', async () => {
      const sharing = await createSharing();

      await request(app.getHttpServer())
        .get(`/sharings/${sharing.id}/meta`)
        .query({ code })
        .expect(HttpStatus.OK);
    });

    it('When the code header is empty, then it uses the query param', async () => {
      const sharing = await createSharing();

      await request(app.getHttpServer())
        .get(`/sharings/${sharing.id}/meta`)
        .set('x-share-code', '')
        .query({ code })
        .expect(HttpStatus.OK);
    });

    it('When no code is sent, then it is a bad request', async () => {
      const sharing = await createSharing();

      await request(app.getHttpServer())
        .get(`/sharings/${sharing.id}/meta`)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('When the link has no password, then no access token is returned', async () => {
      const sharing = await createSharing();

      const response = await request(app.getHttpServer())
        .get(`/sharings/${sharing.id}/meta`)
        .set('x-share-code', code)
        .expect(HttpStatus.OK);

      expect(response.body.accessToken).toBeNull();
    });

    it('When the link has a password and none is sent, then it is forbidden', async () => {
      const sharing = await createSharing(aes.encrypt(password, code));

      await request(app.getHttpServer())
        .get(`/sharings/${sharing.id}/meta`)
        .set('x-share-code', code)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('When the link has a password and a wrong one is sent, then it is forbidden', async () => {
      const sharing = await createSharing(aes.encrypt(password, code));

      await request(app.getHttpServer())
        .get(`/sharings/${sharing.id}/meta`)
        .set('x-share-code', code)
        .set('x-share-password', encodeURIComponent('wrong-password'))
        .expect(HttpStatus.FORBIDDEN);
    });

    it('When the link has a password and the right one is sent, then it returns an access token', async () => {
      const sharing = await createSharing(aes.encrypt(password, code));

      const response = await request(app.getHttpServer())
        .get(`/sharings/${sharing.id}/meta`)
        .set('x-share-code', code)
        .set('x-share-password', encodeURIComponent(password))
        .expect(HttpStatus.OK);

      expect(response.body.accessToken).toEqual(expect.any(String));
    });
  });
});
