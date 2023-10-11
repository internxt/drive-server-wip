import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';

import { TransformInterceptor } from '../../lib/transform.interceptor';
import { AppModule } from '../../app.module';
import {
  BadRequestWrongFolderIdException,
  BadRequestWrongOffsetOrLimitException,
  BadRequestInvalidOffsetException,
  BadRequestOutOfRangeLimitException,
} from './folder.controller';
import getEnv from '../../config/configuration';
import { sequelizeTest } from '../../../test/__e2e__/sequelize';
import { UserTestRepository } from '../../../test/__e2e__/repositories/users-test.repository';
import { FolderTestRepository } from '../../../test/__e2e__/repositories/folders-test.repository';
import { v4 } from 'uuid';

const wrongFolderIdException = new BadRequestWrongFolderIdException();
const wrongOffsetOrLimitException = new BadRequestWrongOffsetOrLimitException();
const invalidOffsetException = new BadRequestInvalidOffsetException();
const outOfRangeLimitException = new BadRequestOutOfRangeLimitException();

const invalidFolderId = 0;
const notAFolderId = 'invalidFolderId';
const invalidLimit = 51;
const validLimit = 1;
const validOffset = 0;

describe('Folder module', () => {
  let app: INestApplication;
  let updatedAfter: string;
  let user: any;
  let userToken: string;
  let folders: any[];
  let existentFolderId: number;
  let existentFolderUUID: string;
  let folderTestRepository: FolderTestRepository;
  let userTestRerpository: UserTestRepository;

  beforeAll(async () => {
    jest.resetModules();

    folderTestRepository = new FolderTestRepository(sequelizeTest);
    userTestRerpository = new UserTestRepository(sequelizeTest);

    await sequelizeTest.authenticate();
    await sequelizeTest.sync();
    user = await userTestRerpository.getPrincipalUser();
    userToken = userTestRerpository.generateToken(user, getEnv().secrets.jwt);

    folders = await folderTestRepository.getFoldersByUserId(user.id);
    existentFolderId = folders[0].id;
    existentFolderUUID = folders[0].uuid;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    app.useGlobalInterceptors(new TransformInterceptor());

    const date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    updatedAfter = date.toISOString();

    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await sequelizeTest.close();
  });

  describe('GET /folders - Get Folders', () => {
    it('should get all folders when the status is ALL', async () => {
      const res = await request(app.getHttpServer())
        .get(`/folders?status=ALL&limit=10&offset=0&updatedAt=${updatedAfter}`)
        .set('Authorization', 'Bearer ' + userToken)
        .expect(HttpStatus.OK);

      expect(Array.isArray(res.body)).toBeTruthy();
    });

    it('should get all exists folders when the status is EXISTS', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/folders?status=EXISTS&limit=10&offset=0&updatedAt=${updatedAfter}`,
        )
        .set('Authorization', 'Bearer ' + userToken)
        .expect(HttpStatus.OK);

      const statuses = res.body.map((f) => f.status) as string[];
      const everyStatusAreExists = statuses.every(
        (status) => status === 'EXISTS',
      );

      if (!res.body.length) {
        throw Error('No folders found');
      }

      expect(everyStatusAreExists).toBeTruthy();
    });

    it('should get all trashed folders when the status is TRASHED', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/folders?status=TRASHED&limit=10&offset=0&updatedAt=${updatedAfter}`,
        )
        .set('Authorization', 'Bearer ' + userToken)
        .expect(HttpStatus.OK);

      const statuses = res.body.map((f) => f.status) as string[];
      const everyStatusAreTrashed = statuses.every(
        (status) => status === 'TRASHED',
      );

      if (!res.body.length) {
        throw Error('No folders found');
      }

      expect(everyStatusAreTrashed).toBeTruthy();
    });

    it('should get all deleted folders when the status is DELETED', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/folders?status=DELETED&limit=10&offset=0&updatedAt=${updatedAfter}`,
        )
        .set('Authorization', 'Bearer ' + userToken)
        .expect(HttpStatus.OK);

      const statuses = res.body.map((f) => f.status) as string[];
      const everyStatusAreDeleted = statuses.every(
        (status) => status === 'DELETED',
      );

      if (!res.body.length) {
        throw Error('No folders found');
      }

      expect(everyStatusAreDeleted).toBeTruthy();
    });

    describe('Exceptions', () => {
      it('should be a bad request when the status is not ALL, EXISTS, TRASHED or DELETED', async () => {
        const response = await request(app.getHttpServer())
          .get('/folders?status=INVALID_STATUS&limit=10&offset=1')
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body.message).toBe(`Unknown status "INVALID_STATUS"`);
      });

      it('should be a bad request when the offset is negative', async () => {
        const offset = -1;
        const response = await request(app.getHttpServer())
          .get(`/folders?status=ALL&limit=10&offset=${offset}`)
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body.message).toBe(invalidOffsetException.message);
      });

      it('should be a bad request when the limit is less than 1', async () => {
        const limit = 0;
        const response = await request(app.getHttpServer())
          .get(`/folders?status=ALL&offset=1&limit=${limit}`)
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body.message).toBe(outOfRangeLimitException.message);
      });

      it('should be a bad request when the limit is greater than 50', async () => {
        const response = await request(app.getHttpServer())
          .get(`/folders?status=ALL&offset=1&limit=51`)
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body.message).toBe(outOfRangeLimitException.message);
      });

      it('should be a bad request when the status is not provided', async () => {
        const response = await request(app.getHttpServer())
          .get('/folders?limit=10&offset=1')
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body.message).toBe('Missing "status" query param');
      });

      it('should be a bad request when the limit is not provided', async () => {
        const response = await request(app.getHttpServer())
          .get('/folders?status=ALL&offset=1')
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body.message).toBe(`Missing "offset" or "limit" param`);
      });

      it('should be a bad request when the offset is not provided', async () => {
        const response = await request(app.getHttpServer())
          .get('/folders?status=ALL&limit=10')
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body.message).toBe(`Missing "offset" or "limit" param`);
      });
    });
  });

  describe('Delete /folders - Delete Folders', () => {
    // TODO: fix this test in the pipeline, in local it runs fine
    it.skip('should delete all orphan folders', async () => {
      const uuid = v4();

      await folderTestRepository.createOrphan(uuid, user.id);

      await request(app.getHttpServer())
        .delete(`/folders?status=orphan`)
        .set('Authorization', 'Bearer ' + userToken)
        .expect(HttpStatus.OK);

      const folder = await folderTestRepository.getBy('uuid', uuid);

      expect(folder).toBeUndefined();
    });

    describe('Exceptions', () => {
      it('should be a not implemented exception', async () => {
        const response = await request(app.getHttpServer())
          .delete(`/folders?status=trashed`)
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.NOT_IMPLEMENTED);

        expect(response.body.message).toBe('Not Implemented');
      });

      it('should be a bad request when the status is not provided', async () => {
        const response = await request(app.getHttpServer())
          .delete('/folders')
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body.message).toBe('Bad Request');
      });

      it('should be a bad request when the status is not valid', async () => {
        const response = await request(app.getHttpServer())
          .delete('/folders?status=invalid-status')
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body.message).toBe('Bad Request');
      });
    });
  });

  describe('GET /folders/:id/metadata - Get Folder by id', () => {
    it('should get the folder', async () => {
      const res = await request(app.getHttpServer())
        .get(`/folders/${existentFolderId}/metadata`)
        .set('Authorization', 'Bearer ' + userToken)
        .expect(HttpStatus.OK);

      expect(res.body.id).toBe(existentFolderId);
    });

    describe('Exceptions', () => {
      it('should be a bad request when the folder id is lower than 1', async () => {
        const response = await request(app.getHttpServer())
          .get(`/folders/${-1}/metadata`)
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body.message).toBe('Invalid id provided');
      });
    });
  });

  describe('GET /folders/:uuid/meta - Get Folder by uuid', () => {
    it('should get the folder', async () => {
      const res = await request(app.getHttpServer())
        .get(`/folders/${existentFolderUUID}/meta`)
        .set('Authorization', 'Bearer ' + userToken)
        .expect(HttpStatus.OK);

      expect(res.body.id).toBe(existentFolderId);
    });

    describe('Exceptions', () => {
      it('should be a bad request when the folder uuid is invalid', async () => {
        const response = await request(app.getHttpServer())
          .get(`/folders/invalid_uuid/meta`)
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body.message).toBe('Invalid UUID provided');
      });

      it('should be a not found when the folder uuid does not exist', async () => {
        const response = await request(app.getHttpServer())
          .get(`/folders/00000000-0000-0000-0000-000000000000/meta`)
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.NOT_FOUND);

        expect(response.body.message).toBe('Not Found');
      });
    });
  });

  describe('GET /folders/count - Get Folders count', () => {
    describe('Exceptions', () => {
      it('should be a bad request when the status is not orphan, trashed', async () => {
        const response = await request(app.getHttpServer())
          .get('/folders/count?status=INVALID_STATUS')
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body.message).toBe('Bad Request');
      });
    });
  });

  describe('GET /folders/:folderId/files - Gets folder files', () => {
    it('should get the files by folder id', async () => {
      const normalFolder = folders.find(
        (folder) => folder.name === 'NormalFolder',
      );

      const response = await request(app.getHttpServer())
        .get(`/folders/${normalFolder.id}/files?limit=10&offset=0`)
        .set('Authorization', 'Bearer ' + userToken)
        .expect(HttpStatus.OK);

      expect(response.body.result.length).toBeGreaterThan(0);
    });

    describe('Exceptions', () => {
      it('When folder id is lower than 1', async () => {
        const response = await request(app.getHttpServer())
          .get(`/folders/${invalidFolderId}/files`)
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(wrongFolderIdException.message);
      });

      it('When folder id is not a number', async () => {
        const response = await request(app.getHttpServer())
          .get(`/folders/${notAFolderId}/files`)
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(wrongFolderIdException.message);
      });

      it('When limit is not a number', async () => {
        const limit = 'nonValidLimit';
        const response = await request(app.getHttpServer())
          .get(`/folders/${existentFolderId}/files?limit=${limit}`)
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(wrongOffsetOrLimitException.message);
      });

      it('When offset is not a number', async () => {
        const offset = 'notValidOffset';
        const response = await request(app.getHttpServer())
          .get(
            `/folders/${existentFolderId}/files?limit=${validLimit}&offset=${offset}`,
          )
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(wrongOffsetOrLimitException.message);
      });

      it('When offset is negative', async () => {
        const offset = -1;
        const response = await request(app.getHttpServer())
          .get(
            `/folders/${existentFolderId}/files?limit=${validLimit}&offset=${offset}`,
          )
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(invalidOffsetException.message);
      });

      it('When limit is less than 1', async () => {
        const limit = 0;
        const response = await request(app.getHttpServer())
          .get(
            `/folders/${existentFolderId}/files?offset=${validOffset}&limit=${limit}`,
          )
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(outOfRangeLimitException.message);
      });

      it('When limit is greater than 50', async () => {
        const response = await request(app.getHttpServer())
          .get(
            `/folders/${existentFolderId}/files?offset=${validOffset}&limit=${invalidLimit}`,
          )
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(outOfRangeLimitException.message);
      });
    });
  });

  describe('GET /folders/:folderId/folders - Gets folder children folders', () => {
    it('should get the folder children folders', async () => {
      const folderFather = folders.find((item) => item.name === 'FolderFather');

      const response = await request(app.getHttpServer())
        .get(`/folders/${folderFather.id}/folders?limit=10&offset=0`)
        .set('Authorization', 'Bearer ' + userToken)
        .expect(HttpStatus.OK);

      expect(response.body.result.length).toBeGreaterThan(0);
    });

    describe('Exceptions', () => {
      it('When folder id is lower than 1', async () => {
        const response = await request(app.getHttpServer())
          .get(`/folders/${invalidFolderId}/folders`)
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(wrongFolderIdException.message);
      });

      it('When folder id is not a number', async () => {
        const response = await request(app.getHttpServer())
          .get(`/folders/${notAFolderId}/folders`)
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(wrongFolderIdException.message);
      });

      it('When limit is not a number', async () => {
        const limit = 'nonValidLimit';
        const response = await request(app.getHttpServer())
          .get(`/folders/${existentFolderId}/folders?limit=${limit}`)
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(wrongOffsetOrLimitException.message);
      });

      it('When offset is not a number', async () => {
        const offset = 'notValidOffset';
        const response = await request(app.getHttpServer())
          .get(
            `/folders/${existentFolderId}/folders?limit=${validLimit}&offset=${offset}`,
          )
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(wrongOffsetOrLimitException.message);
      });

      it('When offset is negative', async () => {
        const offset = -1;
        const response = await request(app.getHttpServer())
          .get(
            `/folders/${existentFolderId}/folders?limit=${validLimit}&offset=${offset}`,
          )
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(invalidOffsetException.message);
      });

      it('When limit is less than 1', async () => {
        const limit = 0;
        const response = await request(app.getHttpServer())
          .get(
            `/folders/${existentFolderId}/folders?offset=${validOffset}&limit=${limit}`,
          )
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(outOfRangeLimitException.message);
      });

      it('When limit is greater than 50', async () => {
        const response = await request(app.getHttpServer())
          .get(
            `/folders/${existentFolderId}/folders?offset=${validOffset}&limit=${invalidLimit}`,
          )
          .set('Authorization', 'Bearer ' + userToken)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(outOfRangeLimitException.message);
      });
    });
  });
});
