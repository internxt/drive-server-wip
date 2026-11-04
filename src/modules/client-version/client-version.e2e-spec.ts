import { HttpStatus } from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { getModelToken } from '@nestjs/sequelize';
import request from 'supertest';

import { createTestApp } from '../../../test/helpers/test-app.helper';
import {
  createTestUser,
  type TestUserContext,
} from '../../../test/helpers/user.helper';
import { ClientEnum } from '../../common/enums/platform.enum';
import { ClientVersionStatus } from './client-version-policy.domain';
import { ClientVersionPolicyModel } from './client-version-policy.model';
import { ClientVersionUseCase } from './client-version.usecase';

describe('Client version policies', () => {
  let app: NestExpressApplication;
  let policyModel: typeof ClientVersionPolicyModel;
  let testUser: TestUserContext;

  const sunsetAt = new Date('2099-01-01T00:00:00.000Z');

  const clientHeaders = (client: ClientEnum, version: string) => ({
    'internxt-client': client,
    'internxt-version': version,
  });

  const getCompatibility = (headers: Record<string, string>) =>
    request(app.getHttpServer()).get('/clients/compatibility').set(headers);

  const listRootFolderFiles = (headers: Record<string, string> = {}) =>
    request(app.getHttpServer())
      .get(`/folders/content/${testUser.rootFolder?.uuid}/files`)
      .query({ limit: 50, offset: 0 })
      .set('Authorization', `bearer ${testUser.token}`)
      .set(headers);

  beforeAll(async () => {
    app = await createTestApp();
    policyModel = app.get(getModelToken(ClientVersionPolicyModel));
    await policyModel.bulkCreate([
      {
        client: ClientEnum.Mobile,
        minVersion: '1.0.0',
        deprecatedBelow: '2.0.0',
        sunsetAt,
        recommendedVersion: '3.0.0',
      },
      {
        client: ClientEnum.DesktopLegacy,
        deprecatedBelow: '2.0.0',
        sunsetAt: new Date('2000-01-01T00:00:00.000Z'),
      },
    ]);
    await app.get(ClientVersionUseCase).refreshPolicies();
    testUser = await createTestUser(app);
  });

  afterAll(async () => {
    await testUser.cleanup();
    await policyModel.destroy({
      where: { client: [ClientEnum.Mobile, ClientEnum.DesktopLegacy] },
    });
    await app.close();
  });

  describe('GET /clients/compatibility', () => {
    it('When the app version is below the minimum, then it is unsupported', async () => {
      const response = await getCompatibility(
        clientHeaders(ClientEnum.Mobile, '0.9.0'),
      );

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body).toEqual({
        status: ClientVersionStatus.Unsupported,
        message:
          'This version of the app is no longer supported. Please update to a newer version.',
        recommendedVersion: '3.0.0',
        sunsetAt: null,
      });
    });

    it('When the app version is deprecated, then the sunset date is returned', async () => {
      const response = await getCompatibility(
        clientHeaders(ClientEnum.Mobile, '1.5.0'),
      );

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body).toEqual({
        status: ClientVersionStatus.Deprecated,
        message:
          'This version of the app is deprecated and will stop working soon. Please update.',
        recommendedVersion: '3.0.0',
        sunsetAt: sunsetAt.toISOString(),
      });
    });

    it('When the app version is below the recommended one, then an update is recommended', async () => {
      const response = await getCompatibility(
        clientHeaders(ClientEnum.Mobile, '2.5.0'),
      );

      expect(response.body.status).toBe(ClientVersionStatus.UpdateRecommended);
    });

    it('When the app is on the recommended version, then it is up to date', async () => {
      const response = await getCompatibility(
        clientHeaders(ClientEnum.Mobile, '3.0.0'),
      );

      expect(response.body).toEqual({
        status: ClientVersionStatus.UpToDate,
        message: null,
        recommendedVersion: '3.0.0',
        sunsetAt: null,
      });
    });

    it('When the app has no policy, then it is up to date', async () => {
      const response = await getCompatibility(
        clientHeaders(ClientEnum.CliLegacy, '0.0.1'),
      );

      expect(response.body.status).toBe(ClientVersionStatus.UpToDate);
    });

    it('When the app does not send its version, then it is a bad request', async () => {
      const response = await getCompatibility({
        'internxt-client': ClientEnum.Mobile,
      });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('Any other endpoint', () => {
    it('When the app version is unsupported, then access is denied with the update details', async () => {
      const response = await listRootFolderFiles(
        clientHeaders(ClientEnum.Mobile, '0.9.0'),
      );

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
      expect(response.body).toEqual({
        statusCode: HttpStatus.FORBIDDEN,
        message:
          'This version of the app is no longer supported. Please update to a newer version.',
        error: 'CLIENT_VERSION_UNSUPPORTED',
        recommendedVersion: '3.0.0',
      });
    });

    it('When the sunset date of a deprecated version has passed, then the request is still allowed', async () => {
      const response = await listRootFolderFiles(
        clientHeaders(ClientEnum.DesktopLegacy, '1.5.0'),
      );

      expect(response.status).toBe(HttpStatus.OK);
    });

    it.each([
      ['deprecated', '1.5.0'],
      ['below the recommended version', '2.5.0'],
    ])(
      'When the app version is %s, then the request is allowed',
      async (_, version) => {
        const response = await listRootFolderFiles(
          clientHeaders(ClientEnum.Mobile, version),
        );

        expect(response.status).toBe(HttpStatus.OK);
      },
    );

    it('When the app does not send its name and version, then the request is allowed', async () => {
      const response = await listRootFolderFiles();

      expect(response.status).toBe(HttpStatus.OK);
    });
  });
});
