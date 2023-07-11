import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';

import { TransformInterceptor } from '../../lib/transform.interceptor';
import { AppModule } from '../../app.module';

import { users } from '../../../seeders/20230308180046-test-users.js';
import { ConfigService } from '@nestjs/config';
import { Sign } from '../../middlewares/passport';

const user = users.testUser;

describe('PrivateSharing module', () => {
  let app: INestApplication;
  let configService: ConfigService;
  let expressInstance;

  function getToken(): string {
    return Sign(
      {
        payload: {
          uuid: user.uuid,
          email: user.email,
          name: user.name,
          lastname: user.lastname,
          username: user.username,
          sharedWorkspace: true,
          networkCredentials: {
            user: user.bridgeUser,
            pass: user.userId,
          },
        },
      },
      configService.get('secrets.jwt'),
      true,
    );
  }

  beforeAll(async () => {
    jest.resetModules();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configService = moduleFixture.get<ConfigService>(ConfigService);
    app.useGlobalPipes(new ValidationPipe());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
    expressInstance = app.getHttpAdapter().getInstance();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/private-sharing/receive/folders (GET)', async () => {
    return await request(expressInstance)
      .get('/private-sharing/receive/folders')
      .set('Authorization', 'Bearer ' + getToken())
      .expect(HttpStatus.OK);
  });

  it('/private-sharing/sent/folders (GET)', async () => {
    return await request(expressInstance)
      .get('/private-sharing/sent/folders')
      .set('Authorization', 'Bearer ' + getToken())
      .expect(HttpStatus.OK);
  });

  it('/private-sharing/receive/folders (GET)', async () => {
    return await request(expressInstance)
      .get('/private-sharing/receive/folders')
      .set('Authorization', 'Bearer ' + getToken())
      .then((response) => {
        console.log('Error message:', response.body);
        expect(response.status).toEqual(HttpStatus.OK);
      });
  });
});
