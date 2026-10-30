import {
  ConflictException,
  HttpStatus,
  type ArgumentsHost,
} from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import { UniqueConstraintError } from 'sequelize';
import { type NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { SequelizeFileRepository } from '../file/file.repository';
import { newFile, newFolder } from '../../../test/fixtures';
import { type File, FileStatus } from '../file/file.domain';
import { SequelizeFolderRepository } from './folder.repository';
import { type Folder, FolderStatus } from './folder.domain';
import { CreateFolderDto } from './dto/create-folder.dto';
import {
  createTestUser,
  type TestUserContext,
} from '../../../test/helpers/user.helper';
import { createTestApp } from '../../../test/helpers/test-app.helper';
import { UniqueConstraintFilter } from '../../common/filters/unique-constraint.filter';

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

      const response = await makeRequest('post', '/folders/')
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

      await makeRequest('post', '/folders/')
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
        folderId: file.folderId,
        folderUuid: file.folderUuid,
        userId: file.userId,
        size: file.size,
        type: file.type,
        name: file.plainName,
        plainName: file.plainName,
        status: FileStatus.EXISTS,
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
      expect(response.body.folders[0]).toMatchObject({
        uuid: folder.uuid,
        plainName: folder.plainName,
        status: FolderStatus.EXISTS,
      });
    });

    it('When the user lists the subfolders of a folder of another user, then nothing is returned', async () => {
      const anotherTestUser = await createTestUser(app);
      const folderUuid = testUser.rootFolder?.uuid;

      const response = await request(app.getHttpServer())
        .get(`/folders/content/${folderUuid}/folders`)
        .query({ limit: DEFAULT_LIMIT, offset: DEFAULT_OFFSET })
        .set('Authorization', `bearer ${anotherTestUser.token}`);
      await anotherTestUser.cleanup();

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.folders.length).toBe(0);
    });
  });

  describe('POST /folders/content/:uuid/files/existence', () => {
    let file: File;

    beforeEach(async () => {
      file = await fileRepository.create(
        newFile({
          attributes: {
            folderId: testUser.rootFolder?.id,
            folderUuid: testUser.rootFolder?.uuid,
            userId: testUser.user.id,
          },
        }),
      );
    });

    afterEach(async () => {
      await fileRepository.destroyFile({ id: file.id });
    });

    it('When the user checks a file that exists in their folder, then the file is returned', async () => {
      const folderUuid = testUser.rootFolder?.uuid;
      const body = { files: [{ plainName: file.plainName, type: file.type }] };

      const response = await makeRequest(
        'post',
        `/folders/content/${folderUuid}/files/existence`,
      )
        .send(body)
        .expect(HttpStatus.CREATED);

      expect(response.body.existentFiles).toHaveLength(1);
      expect(response.body.existentFiles[0]).toMatchObject({
        uuid: file.uuid,
        plainName: file.plainName,
        status: FileStatus.EXISTS,
      });
    });

    it('When the user checks files in a folder of another user, then an error is thrown', async () => {
      const anotherTestUser = await createTestUser(app);
      const folderUuid = testUser.rootFolder?.uuid;
      const body = { files: [{ plainName: file.plainName, type: file.type }] };

      const response = await request(app.getHttpServer())
        .post(`/folders/content/${folderUuid}/files/existence`)
        .set('Authorization', `bearer ${anotherTestUser.token}`)
        .send(body);
      await anotherTestUser.cleanup();

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });
  });

  describe('GET /folders/:id/metadata', () => {
    it('When the user requests the metadata of their own folder, then it is returned', async () => {
      const folderId = testUser.rootFolder?.id;

      const response = await makeRequest(
        'get',
        `/folders/${folderId}/metadata`,
      ).expect(HttpStatus.OK);

      expect(response.body).toMatchObject({
        id: folderId,
        uuid: testUser.rootFolder?.uuid,
        plainName: testUser.rootFolder?.plainName,
        status: FolderStatus.EXISTS,
      });
    });

    it('When the user requests the metadata of a folder of another user, then it is not found', async () => {
      const anotherTestUser = await createTestUser(app);
      const folderId = testUser.rootFolder?.id;

      const response = await request(app.getHttpServer())
        .get(`/folders/${folderId}/metadata`)
        .set('Authorization', `bearer ${anotherTestUser.token}`);
      await anotherTestUser.cleanup();

      expect(response.status).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('Folder unique constraint', () => {
    it('When a folder with a duplicated name is inserted, then the violated constraint is mapped to a conflict', async () => {
      const folderAttributes = newFolder({
        attributes: {
          parentId: testUser.rootFolder?.id,
          parentUuid: testUser.rootFolder?.uuid,
          userId: testUser.user.id,
        },
      });
      await folderRepository.createWithAttributes(folderAttributes);

      const duplicatedFolder = newFolder({
        attributes: {
          name: folderAttributes.name,
          plainName: folderAttributes.plainName,
          parentId: testUser.rootFolder?.id,
          parentUuid: testUser.rootFolder?.uuid,
          userId: testUser.user.id,
        },
      });

      const error = await folderRepository
        .createWithAttributes(duplicatedFolder)
        .then(() => null)
        .catch((err) => err);

      expect(error).toBeInstanceOf(UniqueConstraintError);
      expect(() =>
        new UniqueConstraintFilter().catch(error, createMock<ArgumentsHost>()),
      ).toThrow(
        new ConflictException(
          'A folder with this name already exists in this location',
        ),
      );
    });
  });
});
