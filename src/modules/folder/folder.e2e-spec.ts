import { HttpStatus } from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { SequelizeFileRepository } from '../file/file.repository';
import { newFile, newFolder } from '../../../test/fixtures';
import { type File } from '../file/file.domain';
import { SequelizeFolderRepository } from './folder.repository';
import { type Folder } from './folder.domain';
import { CreateFolderDto } from './dto/create-folder.dto';
import {
  createTestUser,
  type TestUserContext,
} from '../../../test/helpers/user.helper';
import { createTestApp } from '../../../test/helpers/test-app.helper';

describe('Folder module', () => {
  let app: NestExpressApplication;
  let testUser: TestUserContext;
  let fileRepository: SequelizeFileRepository;
  let folderRepository: SequelizeFolderRepository;

  const DEFAULT_LIMIT = 50;
  const DEFAULT_OFFSET = 0;

  beforeAll(async () => {
    app = await createTestApp();
    fileRepository = app.get(SequelizeFileRepository);
    folderRepository = app.get(SequelizeFolderRepository);
  });

  beforeEach(async () => {
    testUser = await createTestUser(app);
  });

  afterEach(async () => {
    await testUser.cleanup();
  });

  afterAll(async () => {
    await app.close();
  });

  const makeRequest = (method: 'get' | 'post', url: string) => {
    return request(app.getHttpServer())
      [method](url)
      .set('Authorization', `bearer ${testUser.token}`);
  };

  describe('POST /folders/ - Creates a folder', () => {
    it('When folder is created succesfully, then it should return the folder as expected', async () => {
      const folderUuid = testUser.rootFolder?.uuid;
      const folderName = 'New folder';
      const createFolderDto = new CreateFolderDto();
      createFolderDto.plainName = folderName;
      createFolderDto.parentFolderUuid = folderUuid;

      const response = await makeRequest('post', `/folders/`)
        .send(createFolderDto)
        .expect(HttpStatus.CREATED);
      expect(response.body).toMatchObject({
        plainName: folderName,
        parentUuid: folderUuid,
      });
    });

    it('When users tries to create a folder inside a folder that they do not own, then it should fail', async () => {
      const anotherTestUser = await createTestUser(app);

      const folderName = 'New folder';
      const createFolderDto = new CreateFolderDto();
      createFolderDto.plainName = folderName;
      createFolderDto.parentFolderUuid = anotherTestUser.rootFolder.uuid;

      await makeRequest('post', `/folders/`)
        .send(createFolderDto)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('GET /folders/content/:uuid/files - Gets files in folder by folder UUID', () => {
    let file: File;
    beforeEach(async () => {
      const fileAttributes = newFile({
        attributes: {
          folderId: testUser.rootFolder?.id,
          folderUuid: testUser.rootFolder?.uuid,
          userId: testUser.user.id,
        },
      });
      file = await fileRepository.create(fileAttributes);
    });

    afterEach(async () => {
      await fileRepository.destroyFile({ id: file.id });
    });

    it('When successful, it returns files with valid params', async () => {
      const folderUuid = testUser.rootFolder?.uuid;

      const response = await makeRequest(
        'get',
        `/folders/content/${folderUuid}/files`,
      )
        .query({ limit: DEFAULT_LIMIT, offset: DEFAULT_OFFSET })
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('files');
      expect(response.body.files.length).toBe(1);
      expect(response.body.files[0]).toMatchObject({
        uuid: file.uuid,
        name: file.name,
        folderId: file.folderId,
        folderUuid: file.folderUuid,
        userId: file.userId,
        size: file.size,
        type: file.type,
      });
    });

    it('When user does not match the folder owner, then it should return nothing', async () => {
      const anotherTestUser = await createTestUser(app);
      const folderUuid = testUser.rootFolder?.uuid;

      const response = await request(app.getHttpServer())
        .get(`/folders/content/${folderUuid}/files`)
        .query({ limit: DEFAULT_LIMIT, offset: DEFAULT_OFFSET })
        .set('Authorization', `bearer ${anotherTestUser.token}`);
      await anotherTestUser.cleanup();

      expect(response.body).toHaveProperty('files');
      expect(response.body.files.length).toBe(0);
    });

    it('When query params are invalid, it returns 400', async () => {
      const folderUuid = testUser.rootFolder?.uuid;
      await makeRequest('get', `/folders/content/${folderUuid}/files`)
        .query({ limit: 'invalid', offset: 'invalid' })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('GET /folders/content/:uuid/folders - Gets folders in folder by folder UUID', () => {
    let folder: Folder;

    beforeEach(async () => {
      const folderAttributes = newFolder({
        attributes: {
          parentId: testUser.rootFolder?.id,
          parentUuid: testUser.rootFolder?.uuid,
          userId: testUser.user.id,
        },
      });
      folder = await folderRepository.createWithAttributes(folderAttributes);
    });

    afterEach(async () => {
      await folderRepository.deleteById(folder.id);
    });

    it('When successful, it returns folders with valid params', async () => {
      const folderUuid = testUser.rootFolder?.uuid;

      const response = await makeRequest(
        'get',
        `/folders/content/${folderUuid}/folders`,
      )
        .query({ limit: DEFAULT_LIMIT, offset: DEFAULT_OFFSET })
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('folders');
      expect(response.body.folders.length).toBe(1);
    });
  });
});
