import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { TransformInterceptor } from '../src/transform.interceptor';

// Running e2e tests require a database named "notes_test" in the postgres database first.
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

  describe('HTTP tests', () => {
    it('/notes (GET) - Unauthorized first call for notes', async () => {
      return request(app.getHttpServer()).get('/notes').expect(401);
    });

    describe('User registration errors', () => {
      it('/signup (POST) -  Request to signup', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/signup')
          .send({
            email: 'example@example.com',
            password: 'example',
          })
          .expect(400);
        const body = response.body;
        expect(body.message.includes());
        console.log(body);
        // expect(response.body.message).toBe('Validation failed');
      });
    });

    // describe('User flow', () => {
    //   let token: string;

    //   beforeAll(async () => {
    //     const response = await request(app.getHttpServer())
    //       .post('/auth/login')
    //       .send({
    //         email: 'example@example.com',
    //         password: 'example',
    //       });
    //     token = response.body.token;
    //   });

    //   it('/notes (GET) - Authorized request for notes', async () => {
    //     return request(app.getHttpServer())
    //       .get('/notes')
    //       .set('Authorization', `Bearer ${token}`)
    //       .expect(200);
    //   });

    //   it('/notes (POST) - Authorized first call for notes', async () => {
    //     return request(app.getHttpServer())
    //       .post('/notes')
    //       .set('Authorization', `Bearer ${token}`)
    //       .send({
    //         title: 'Test title',
    //         content: 'Test content',
    //       })
    //       .expect(201);
    //   });

    //   it('/notes (GET) - Authorized second call for notes', async () => {
    //     return request(app.getHttpServer())
    //       .get('/notes')
    //       .set('Authorization', `Bearer ${token}`)
    //       .expect(200);
    //   });

    //   it('/notes (GET) - Authorized third call for notes', async () => {
    //     return request(app.getHttpServer())
    //       .get('/notes')
    //       .set('Authorization', `Bearer ${token}`)
    //       .expect(200);
    //   });
    // });
  });
});
