import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { TransformInterceptor } from '../src/lib/transform.interceptor';
import { HttpStatus } from '@nestjs/common';
import { SequelizeShareRepository } from './../src/modules/share/share.repository';
import { ShareMother } from './share.mother';
import { UserMother } from './user.mother';
import { SequelizeUserRepository } from './../src/modules/user/user.repository';
import { Share } from './../src/modules/share/share.domain';
import { NotificationService } from './../src/externals/notifications/notification.service';
import { CryptoService } from '../src/externals/crypto/crypto.service';
// import { File } from '../src/modules/file/file.domain';
// import { SequelizeFileRepository } from '../src/modules/file/file.repository';
import { SequelizeFolderRepository } from '../src/modules/folder/folder.repository';
import { Folder } from '../src/modules/folder/folder.domain';

// Running e2e tests require a database named "Xcloud_test" in the mariadb database first.
describe('AppController (e2e)', () => {
  let app: INestApplication;

  let cryptoService: CryptoService;

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Cannot do E2E tests without NODE_ENV=test ');
    }
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

  describe('HTTP tests', () => {
    // describe('TRASH Endpoints', () => {
    //   describe('Get Trash', () => {
    //     it('/storage/trash (GET) - Unauthorized', async () => {
    //       return request(app.getHttpServer()).get('/storage/trash').expect(401);
    //     });

    //     it('/storage/trash (GET) - Return 200', async () => {
    //       return request(app.getHttpServer())
    //         .get('/storage/trash')
    //         .set('Authorization', 'Bearer ' + token)
    //         .expect(200);
    //     });
    //   });

    //   describe('Move Items To Trash', () => {
    //     it('/storage/trash/add (POST) - Unauthorized', async () => {
    //       return request(app.getHttpServer())
    //         .post('/storage/trash/add')
    //         .expect(401);
    //     });

    //     it('/storage/trash/add (POST) - Return 200', async () => {
    //       return request(app.getHttpServer())
    //         .post('/storage/trash/add')
    //         .set('Authorization', 'Bearer ' + token)
    //         .send({
    //           items: [{ id: '4', type: 'folder' }],
    //         })
    //         .expect(200);
    //     });

    //     it('/storage/trash/add (POST) - Return 400 - types invalid', async () => {
    //       const response = await request(app.getHttpServer())
    //         .post('/storage/trash/add')
    //         .set('Authorization', 'Bearer ' + token)
    //         .send({
    //           items: [{ id: '4', type: 'folder2' }],
    //         });

    //       expect(response.status).toBe(400);
    //       expect(response.body).toEqual({
    //         error: 'Bad Request',
    //         message: 'type folder2 invalid',
    //         statusCode: 400,
    //       });
    //     });
    //   });
    // });

    describe('Send Links Endpoints', () => {
      let sendLink;
      describe('Create Send Link', () => {
        it('/links (POST) - Return 201 - Created', async () => {
          const response = await request(app.getHttpServer())
            .post('/links')
            .send({
              items: [
                {
                  name: 'test',
                  type: 'file',
                  networkId: 'test',
                  encryptionKey: 'test',
                  size: 100000,
                },
              ],
              sender: 'clopez@internxt.com',
              receivers: ['clopez@internxt.com'],
              plainCode: 'code',
              code: 'code',
              title: 'File Test',
              subject: 'Esto es una prueba de archivo',
            });
          expect(response.status).toBe(HttpStatus.CREATED);
          sendLink = response.body;
        });
        it('/links (POST) - Return 400 - Fields invalids', async () => {
          const response = await request(app.getHttpServer())
            .post('/links')
            .send({});
          expect(response.status).toBe(HttpStatus.BAD_REQUEST);
          expect(response.body.message).toMatchObject([
            'code should not be empty',
            'plainCode should not be empty',
            'items must contain not more than 100 elements',
            'items must be an array',
          ]);
        });
        it('/links (POST) - Return 400 - Max size of item', async () => {
          const response = await request(app.getHttpServer())
            .post('/links')
            .send({
              items: [
                {
                  name: 'test',
                  type: 'file',
                  networkId: 'test',
                  encryptionKey: 'test',
                  size: 606870910000,
                },
              ],
              sender: 'clopez@internxt.com',
              receivers: ['clopez@internxt.com'],
              plainCode: 'code',
              code: 'code',
              title: 'File Test',
              subject: 'Esto es una prueba de archivo',
            });
          expect(response.status).toBe(HttpStatus.BAD_REQUEST);
          expect(response.body.message).toMatchObject([
            'items.0.size must not be greater than 5G',
          ]);
        });
        it('/links (POST) - Return 400 - Max 100 items', async () => {
          const items = [];
          for (let i = 0; i <= 101; i++) {
            items.push({
              name: 'test',
              type: 'file',
              networkId: 'test',
              encryptionKey: 'test',
              size: 100000,
            });
          }
          const response = await request(app.getHttpServer())
            .post('/links')
            .send({
              items,
              sender: 'clopez@internxt.com',
              receivers: ['clopez@internxt.com'],
              plainCode: 'code',
              code: 'code',
              title: 'File Test',
              subject: 'Esto es una prueba de archivo',
            });
          expect(response.status).toBe(HttpStatus.BAD_REQUEST);
          expect(response.body).toMatchObject({
            error: 'Bad Request',
            message: ['items must contain not more than 100 elements'],
            statusCode: HttpStatus.BAD_REQUEST,
          });
        });
        it('creates a link protected by password', async () => {
          const items = Array(50).fill({
            name: 'test',
            type: 'file',
            networkId: 'test',
            encryptionKey: 'test',
            size: 100000,
          });
          const password = 'mVu6yjLUsN93RgcHfDUv';
          const plainPassword = cryptoService.encryptText(password);
          const response = await request(app.getHttpServer())
            .post('/links')
            .send({
              items,
              sender: 'clopez@internxt.com',
              receivers: ['clopez@internxt.com'],
              plainCode: 'code',
              code: 'code',
              title: 'File Test',
              subject: 'Esto es una prueba de archivo',
              plainPassword: plainPassword,
            });

          expect(response.status).toBe(HttpStatus.CREATED);
          expect(response.body.protected).toBe(true);
        });
      });

      describe('Get Send Link', () => {
        it('/links/:linkId (GET) - Return 404 - LinkId invalid', async () => {
          const response = await request(app.getHttpServer())
            .get(`/links/test`)
            .send();
          expect(response.body).toMatchObject({
            error: 'Bad Request',
            message: 'id is not in uuid format',
            statusCode: HttpStatus.BAD_REQUEST,
          });
        });
        it('/links/:linkId (GET) - Return 200 - Found', async () => {
          const response = await request(app.getHttpServer())
            .get(`/links/${sendLink.id}`)
            .send();
          expect(response.status).toBe(HttpStatus.OK);
          expect(response.body).toMatchObject({
            id: sendLink.id,
            subject: sendLink.subject,
            title: sendLink.title,
            code: sendLink.code,
          });
        });
      });
    });
  });
});

describe('Share Endpoints', () => {
  let app: INestApplication;

  const fakeNotificationService = {
    add: (_: any) => {
      //no op
    },
  } as unknown as NotificationService;

  const fakeUserRepository = {
    findByUsername: (_: string) => UserMother.create(),
  } as unknown as SequelizeUserRepository;

  describe('unprotected shares', () => {
    const databaseShare = ShareMother.createWithPassword(null);
    const databaseSharedFolder = databaseShare.item as Folder;
    const unprotectedShareRepository = {
      findByToken: (token: string) => {
        if (token === databaseShare.token) return databaseShare;
        throw new NotFoundException('share not found');
      },
      update: (_: Share) => Promise.resolve(),
    } as unknown as SequelizeShareRepository;
    const fakeFolderRepository = {
      findById: () => Promise.resolve(databaseSharedFolder),
    } as unknown as SequelizeFolderRepository;

    beforeAll(async () => {
      if (process.env.NODE_ENV !== 'test') {
        throw new Error('Cannot do E2E tests without NODE_ENV=test ');
      }
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(SequelizeShareRepository)
        .useValue(unprotectedShareRepository)
        .overrideProvider(SequelizeUserRepository)
        .useValue(fakeUserRepository)
        .overrideProvider(NotificationService)
        .useValue(fakeNotificationService)
        .overrideProvider(SequelizeFolderRepository)
        .useValue(fakeFolderRepository)
        .compile();
      app = moduleFixture.createNestApplication();
      app.useGlobalPipes(new ValidationPipe());
      app.useGlobalInterceptors(new TransformInterceptor());
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('return the share', async () => {
      const originalViews = databaseShare.views;

      const response = await request(app.getHttpServer()).get(
        `/storage/share/${databaseShare.token}`,
      );

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.views).toBe(originalViews);
      expect(response.body.protected).toBe(false);
    });

    it('returns resource not found if the share not exist', async () => {
      const token = '1234';

      const response = await request(app.getHttpServer()).get(
        `/storage/share/${token}`,
      );

      expect(response.status).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('protected shares', () => {
    let cryptoService: CryptoService;
    let password, databaseShare, databaseSharedFolder;

    beforeAll(async () => {
      if (process.env.NODE_ENV !== 'test') {
        throw new Error('Cannot do E2E tests without NODE_ENV=test ');
      }

      const protectedShareRepository = {
        findByToken: (_: string) => databaseShare,
        update: (_: Share) => Promise.resolve(),
      } as unknown as SequelizeShareRepository;
      const fakeFolderRepository = {
        findById: () => Promise.resolve(databaseSharedFolder),
      } as unknown as SequelizeFolderRepository;
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(SequelizeShareRepository)
        .useValue(protectedShareRepository)
        .overrideProvider(SequelizeUserRepository)
        .useValue(fakeUserRepository)
        .overrideProvider(NotificationService)
        .useValue(fakeNotificationService)
        .overrideProvider(SequelizeFolderRepository)
        .useValue(fakeFolderRepository)
        .compile();
      cryptoService = moduleFixture.get<CryptoService>(CryptoService);
      app = moduleFixture.createNestApplication();
      app.useGlobalPipes(new ValidationPipe());
      app.useGlobalInterceptors(new TransformInterceptor());
      await app.init();

      password = 'KPit1mKILC';
      const hashedPassword = cryptoService.deterministicEncryption(
        password,
        process.env.MAGIC_SALT,
      );
      databaseShare = ShareMother.createWithPassword(hashedPassword);
      databaseSharedFolder = databaseShare.item as Folder;
    });

    afterAll(async () => {
      await app.close();
    });

    it('return the share folder when the correct passwrod is porvided', async () => {
      const originalViews = databaseShare.views;

      const response = await request(app.getHttpServer())
        .get(`/storage/share/${databaseShare.token}`)
        .set('x-share-password', password);

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.views).toBe(originalViews);
      expect(response.body.protected).toBe(true);
    });

    it('return unauthorized response when password is not correct', async () => {
      const token = 'mGc9eCtk8lnphJMV6SpTJmF9SYDV7x';
      const plainPassword = '1234';

      const response = await request(app.getHttpServer())
        .get(`/storage/share/${token}`)
        .set('x-share-password', plainPassword);

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('returns unauthorized response when no password provided', async () => {
      const token = 'whHG1saU0Ex0ilILPGhM';
      const response = await request(app.getHttpServer()).get(
        `/storage/share/${token}`,
      );
      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });
  });
});
