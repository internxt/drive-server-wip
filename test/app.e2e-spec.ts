import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { TransformInterceptor } from '../src/lib/transform.interceptor';

const token = process.env.TEST_AUTH_TOKEN;
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
    describe('TRASH Endpoints', () => {
      describe('Get Trash', () => {
        it('/storage/trash (GET) - Unauthorized', async () => {
          return request(app.getHttpServer()).get('/storage/trash').expect(401);
        });

        it('/storage/trash (GET) - Return 200', async () => {
          return request(app.getHttpServer())
            .get('/storage/trash')
            .set('Authorization', 'Bearer ' + token)
            .expect(200);
        });
      });

      describe('Move Items To Trash', () => {
        it('/storage/trash/add (POST) - Unauthorized', async () => {
          return request(app.getHttpServer())
            .post('/storage/trash/add')
            .expect(401);
        });

        it('/storage/trash/add (POST) - Return 200', async () => {
          return request(app.getHttpServer())
            .post('/storage/trash/add')
            .set('Authorization', 'Bearer ' + token)
            .send({
              items: [{ id: '4', type: 'folder' }],
            })
            .expect(200);
        });

        it('/storage/trash/add (POST) - Return 400 - types invalid', async () => {
          const response = await request(app.getHttpServer())
            .post('/storage/trash/add')
            .set('Authorization', 'Bearer ' + token)
            .send({
              items: [{ id: '4', type: 'folder2' }],
            });

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            error: 'Bad Request',
            message: 'type folder2 invalid',
            statusCode: 400,
          });
        });
      });
    });
  });
});
