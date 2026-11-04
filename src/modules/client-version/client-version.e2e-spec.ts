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
  const targetedSunsetAt = new Date('2098-01-01T00:00:00.000Z');

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
      {
        client: ClientEnum.Mobile,
        version: '2.9.0',
        minVersion: '2.9.1',
        recommendedVersion: '2.9.1',
      },
      {
        client: ClientEnum.Mobile,
        version: '2.9.2',
        deprecatedBelow: '2.9.3',
        sunsetAt: targetedSunsetAt,
        recommendedVersion: '2.9.3',
      },
      {
        client: ClientEnum.Mobile,
        version: '2.9.4',
        recommendedVersion: '2.9.5',
      },
      {
        client: ClientEnum.DesktopMacos,
        version: '2.8.0',
        minVersion: '2.8.1',
      },
    ]);
    await app.get(ClientVersionUseCase).refreshPolicies();
    testUser = await createTestUser(app);
  });

  afterAll(async () => {
    await testUser.cleanup();
    await policyModel.destroy({
      where: {
        client: [
          ClientEnum.Mobile,
          ClientEnum.DesktopLegacy,
          ClientEnum.DesktopMacos,
        ],
      },
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
        message: 'This version of the app is deprecated. Please update.',
        recommendedVersion: '3.0.0',
        sunsetAt: sunsetAt.toISOString(),
      });
    });

    it('When the status is requested, then the response is not cached', async () => {
      const response = await getCompatibility(
        clientHeaders(ClientEnum.Mobile, '3.0.0'),
      );

      expect(response.headers['cache-control']).toBe('no-store');
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

  describe('Policy for a specific version', () => {
    it('When the policy targets the app version, then access is denied with its update details', async () => {
      const response = await listRootFolderFiles(
        clientHeaders(ClientEnum.Mobile, '2.9.0'),
      );

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
      expect(response.body).toMatchObject({
        errorCode: 'CLIENT_VERSION_UNSUPPORTED',
        recommendedVersion: '2.9.1',
      });
    });

    it('When the app is on another version, then the request is allowed', async () => {
      const response = await listRootFolderFiles(
        clientHeaders(ClientEnum.Mobile, '2.9.1'),
      );

      expect(response.status).toBe(HttpStatus.OK);
    });

    it('When the policy targets the app version, then the status is unsupported', async () => {
      const response = await getCompatibility(
        clientHeaders(ClientEnum.Mobile, '2.9.0'),
      );

      expect(response.body).toEqual({
        status: ClientVersionStatus.Unsupported,
        message:
          'This version of the app is no longer supported. Please update to a newer version.',
        recommendedVersion: '2.9.1',
        sunsetAt: null,
      });
    });

    it('When the policy deprecates the app version, then its sunset date and update target are returned', async () => {
      const response = await getCompatibility(
        clientHeaders(ClientEnum.Mobile, '2.9.2'),
      );

      expect(response.body).toEqual({
        status: ClientVersionStatus.Deprecated,
        message: 'This version of the app is deprecated. Please update.',
        recommendedVersion: '2.9.3',
        sunsetAt: targetedSunsetAt.toISOString(),
      });
    });

    it('When the policy deprecates the app version, then the request is still allowed', async () => {
      const response = await listRootFolderFiles(
        clientHeaders(ClientEnum.Mobile, '2.9.2'),
      );

      expect(response.status).toBe(HttpStatus.OK);
    });

    it('When the policy recommends an update for the app version, then its update target is returned', async () => {
      const response = await getCompatibility(
        clientHeaders(ClientEnum.Mobile, '2.9.4'),
      );

      expect(response.body).toEqual({
        status: ClientVersionStatus.UpdateRecommended,
        message: 'A new version of the app is available. Please update.',
        recommendedVersion: '2.9.5',
        sunsetAt: null,
      });
    });

    it('When the app is on another version, then the general policy still applies', async () => {
      const response = await getCompatibility(
        clientHeaders(ClientEnum.Mobile, '2.9.1'),
      );

      expect(response.body).toMatchObject({
        status: ClientVersionStatus.UpdateRecommended,
        recommendedVersion: '3.0.0',
      });
    });

    it('When the app version is a prerelease of the targeted version, then the policy applies', async () => {
      const response = await getCompatibility(
        clientHeaders(ClientEnum.Mobile, '2.9.0-rc.1'),
      );

      expect(response.body.status).toBe(ClientVersionStatus.Unsupported);
    });

    it('When the app only has a policy for one version, then other versions are up to date', async () => {
      const targetedVersion = await getCompatibility(
        clientHeaders(ClientEnum.DesktopMacos, '2.8.0'),
      );
      const olderVersion = await getCompatibility(
        clientHeaders(ClientEnum.DesktopMacos, '2.7.0'),
      );

      expect(targetedVersion.body.status).toBe(ClientVersionStatus.Unsupported);
      expect(olderVersion.body.status).toBe(ClientVersionStatus.UpToDate);
    });

    it('When a general policy already exists for the app, then another one cannot be created', async () => {
      const creation = policyModel.create({ client: ClientEnum.Mobile });

      await expect(creation).rejects.toThrow();
    });

    it('When a policy already targets the version, then another one cannot be created', async () => {
      const creation = policyModel.create({
        client: ClientEnum.Mobile,
        version: '2.9.0',
      });

      await expect(creation).rejects.toThrow();
    });
  });

  describe('Any other endpoint', () => {
    it('When the app version is unsupported, then access is denied with the update details', async () => {
      const response = await listRootFolderFiles(
        clientHeaders(ClientEnum.Mobile, '0.9.0'),
      );

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
      expect(response.body).toEqual({
        message:
          'This version of the app is no longer supported. Please update to a newer version.',
        error: 'Forbidden',
        statusCode: HttpStatus.FORBIDDEN,
        errorCode: 'CLIENT_VERSION_UNSUPPORTED',
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
