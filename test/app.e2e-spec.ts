import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { TransformInterceptor } from '../src/lib/transform.interceptor';
import { HttpStatus } from '@nestjs/common';

// Running e2e tests require a database named "Xcloud_test" in the mariadb database first.
describe('AppController (e2e)', () => {
  let app: INestApplication;

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
                  type: 'jpg',
                  networkId: 'test',
                  encryptionKey: 'test',
                  size: 100000,
                },
              ],
              sender: 'clopez@internxt.com',
              receivers: ['clopez@internxt.com'],
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
            'receivers must be an array',
            'receivers should not be empty',
            'sender should not be empty',
            'code should not be empty',
            'title should not be empty',
            'subject should not be empty',
            'items must contain not more than 50 elements',
            'items must be an array',
          ]);
        });
        it('/links (POST) - Return 400 - Max 50 items', async () => {
          const items = [];
          for (let i = 0; i <= 51; i++) {
            items.push({
              name: 'test',
              type: 'jpg',
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
              code: 'code',
              title: 'File Test',
              subject: 'Esto es una prueba de archivo',
            });
          expect(response.status).toBe(HttpStatus.BAD_REQUEST);
          expect(response.body).toMatchObject({
            error: 'Bad Request',
            message: ['items must contain not more than 50 elements'],
            statusCode: HttpStatus.BAD_REQUEST,
          });
        });
      });

      describe('Get Send Link', () => {
        it('/links/:linkId (GET) - Return 404 - LinkId invalid', async () => {
          const response = await request(app.getHttpServer())
            .get(`/links/test`)
            .send();
          expect(response.status).toBe(HttpStatus.NOT_FOUND);
          expect(response.body).toMatchObject({
            error: 'Not Found',
            message: 'SendLink with id test not found',
            statusCode: HttpStatus.NOT_FOUND,
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
