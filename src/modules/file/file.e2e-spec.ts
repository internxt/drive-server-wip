import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';

import { TransformInterceptor } from '../../lib/transform.interceptor';
import { AppModule } from '../../app.module';
import getEnv from '../../config/configuration';
import { sequelizeTest } from '../../../test/__e2e__/sequelize';
import { UserTestRepository } from '../../../test/__e2e__/repositories/users-test.repository';
import { FolderTestRepository } from '../../../test/__e2e__/repositories/folders-test.repository';
import { v4 } from 'uuid';

const invalidFolderId = 0;
const notAFolderId = 'invalidFolderId';
const invalidLimit = 51;
const validLimit = 1;
const validOffset = 0;

describe('File module', () => {
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
        .get(`/files?status=ALL&limit=10&offset=0&updatedAt=${updatedAfter}`)
        .set('Authorization', 'Bearer ' + userToken)
        .expect(HttpStatus.OK);

      expect(Array.isArray(res.body)).toBeTruthy();
    });
  });
});
