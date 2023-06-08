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
import { User } from '../user/user.domain';
import { v4 } from 'uuid';
import { generateJWT } from '../../lib/jwt';
import getEnv from '../../config/configuration';

const user = new User({
  id: 1,
  email: '',
  password: '',
  name: '',
  lastname: '',
  username: '',
  bridgeUser: '',
  mnemonic: '',
  rootFolderId: 1,
  hKey: Buffer.from(''),
  userId: '',
  secret_2FA: '',
  errorLoginCount: 0,
  isEmailActivitySended: 0,
  referralCode: '',
  referrer: '',
  syncDate: new Date(),
  uuid: v4(),
  lastResend: new Date(),
  credit: 0,
  welcomePack: false,
  registerCompleted: false,
  backupsBucket: '',
  sharedWorkspace: false,
  tempKey: '',
  avatar: '',
});

const wrongFolderIdException = new BadRequestWrongFolderIdException();
const wrongOffsetOrLimitException = new BadRequestWrongOffsetOrLimitException();
const invalidOffsetException = new BadRequestInvalidOffsetException();
const outOfRangeLimitException = new BadRequestOutOfRangeLimitException();

const existentFolderId = 2;
const nonExistentFolderId = 1;
const invalidFolderId = 0;
const notAFolderId = 'invalidFolderId';
const invalidLimit = 51;
const validLimit = 1;
const validOffset = 0;

describe('Folder module', () => {
  let app: INestApplication;
  let cryptoService: CryptoService;

  function getToken(): string {
    return generateJWT(user.toJSON(), '5m', getEnv().secrets.jwt);
  }

  beforeAll(async () => {
    jest.resetModules();
    // if (process.env.NODE_ENV !== 'test') {
    //   throw new Error('Cannot do E2E tests without NODE_ENV=test ');
    // }
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    cryptoService = moduleFixture.get<CryptoService>(CryptoService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /folders/:folderId/files - Gets folder files', () => {
    describe('Fails with invalid query params', () => {
      it('When folder id is lower than 1', async () => {
        const response = await request(app.getHttpServer())
          .get(`/folders/${invalidFolderId}/files`)
          .set('Authorization', 'bearer ' + getToken())
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(wrongFolderIdException.message);
      });
  
      it('When folder id is not a number', async () => {
        const response = await request(app.getHttpServer())
          .get(`/folders/${notAFolderId}/files`)
          .set('Authorization', 'bearer ' + getToken())
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(wrongFolderIdException.message);
      });

      it('When limit is not a number', async () => {
        const limit = 'nonValidLimit';
        const response = await request(app.getHttpServer())
          .get(`/folders/${existentFolderId}/files?limit=${limit}`)
          .set('Authorization', 'bearer ' + getToken())
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(wrongOffsetOrLimitException.message);
      });

      it('When offset is not a number', async () => {
        const offset = 'notValidOffset';
        const response = await request(app.getHttpServer())
          .get(`/folders/${existentFolderId}/files?limit=${validLimit}&offset=${offset}`)
          .set('Authorization', 'bearer ' + getToken())
          .expect(HttpStatus.BAD_REQUEST);
        
        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(wrongOffsetOrLimitException.message);
      });

      it('When offset is negative', async () => {
        const offset = -1;
        const response = await request(app.getHttpServer())
          .get(`/folders/${existentFolderId}/files?limit=${validLimit}&offset=${offset}`)
          .set('Authorization', 'bearer ' + getToken())
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(invalidOffsetException.message);
      });

      it('When limit is less than 1', async () => {
        const limit = 0;
        const response = await request(app.getHttpServer())
          .get(`/folders/${existentFolderId}/files?offset=${validOffset}&limit=${limit}`)
          .set('Authorization', 'bearer ' + getToken())
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(outOfRangeLimitException.message);
      });

      it('When limit is greater than 50', async () => {
        const response = await request(app.getHttpServer())
          .get(`/folders/${existentFolderId}/files?offset=${validOffset}&limit=${invalidLimit}`)
          .set('Authorization', 'bearer ' + getToken())
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(outOfRangeLimitException.message);
      });
    });

    // it('Fails if the folder does not exist', async () => {
    //   const folderId = nonExistentFolderId;
    //   const response = await request(app.getHttpServer())
    //     .get(`/folders/${folderId}/files`)
    //     .expect(404);

    //   expect(response.body).toEqual({
    //     statusCode: 404,
    //     message: 'Folder not found',
    //   });
    // });
   
    // it('Returns the files if the request is valid', async () => {
    //   const folderId = existentFolderId;
    //   const limit = validLimit;
    //   const offset = 0;

    //   const response = await request(app.getHttpServer())
    //     .get(`/folders/${folderId}/files?limit=${limit}&offset=${offset}`)
    //     .expect(200);

    //   expect(response.body).toEqual({
    //     files: [
    //       {
    //         id: 1,
    //         name: 'file1',
    //         size: 100,
    //         type: 'image',
    //         folderId: 1,
    //       }
    //     ],
    //   });
    // });
  });

  describe('GET /folders/:folderId/folders - Gets folder children folders', () => {
    describe('Fails with invalid query params', () => {
      it('When folder id is lower than 1', async () => {
        const response = await request(app.getHttpServer())
          .get(`/folders/${invalidFolderId}/folders`)
          .set('Authorization', 'bearer ' + getToken())
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(wrongFolderIdException.message);
      });
  
      it('When folder id is not a number', async () => {
        const response = await request(app.getHttpServer())
          .get(`/folders/${notAFolderId}/folders`)
          .set('Authorization', 'bearer ' + getToken())
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(wrongFolderIdException.message);
      });

      it('When limit is not a number', async () => {
        const limit = 'nonValidLimit';
        const response = await request(app.getHttpServer())
          .get(`/folders/${existentFolderId}/folders?limit=${limit}`)
          .set('Authorization', 'bearer ' + getToken())
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(wrongOffsetOrLimitException.message);
      });

      it('When offset is not a number', async () => {
        const offset = 'notValidOffset';
        const response = await request(app.getHttpServer())
          .get(`/folders/${existentFolderId}/folders?limit=${validLimit}&offset=${offset}`)
          .set('Authorization', 'bearer ' + getToken())
          .expect(HttpStatus.BAD_REQUEST);
        
        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(wrongOffsetOrLimitException.message);
      });

      it('When offset is negative', async () => {
        const offset = -1;
        const response = await request(app.getHttpServer())
          .get(`/folders/${existentFolderId}/folders?limit=${validLimit}&offset=${offset}`)
          .set('Authorization', 'bearer ' + getToken())
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(invalidOffsetException.message);
      });

      it('When limit is less than 1', async () => {
        const limit = 0;
        const response = await request(app.getHttpServer())
          .get(`/folders/${existentFolderId}/folders?offset=${validOffset}&limit=${limit}`)
          .set('Authorization', 'bearer ' + getToken())
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(outOfRangeLimitException.message);
      });

      it('When limit is greater than 50', async () => {
        const response = await request(app.getHttpServer())
          .get(`/folders/${existentFolderId}/folders?offset=${validOffset}&limit=${invalidLimit}`)
          .set('Authorization', 'bearer ' + getToken())
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toBe(outOfRangeLimitException.message);
      });
    });

    // it('Fails when the folder id does not exist', async () => {
    //   const response = await request(app.getHttpServer())
    //     .get(`/folders/${nonExistentFolderId}/folders?offset=${validOffset}&limit=${validLimit}`)
    //     .set('Authorization', 'bearer ' + getToken())
    //     .expect(HttpStatus.NOT_FOUND);

    //   expect(response.status).toBe(HttpStatus.NOT_FOUND);
    //   expect(response.body.message).toBe(new NotFoundException().message);
    // });

  //   it('Returns the folders if the request is valid', async () => {
  //     const folderId = existentFolderId;
  //     const limit = validLimit;
  //     const offset = 0;

  //     const response = await request(app.getHttpServer())
  //       .get(`/folders/${folderId}/folders?limit=${limit}&offset=${offset}`)
  //       .expect(200);

  //     expect(response.body).toEqual({
  //       folders: [
  //         {
  //           id: 1,
  //           name: 'folder1',
  //           parentId: 1,
  //         }
  //       ],
  //     });
  //   });
  });
});
