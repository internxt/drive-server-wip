import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';
import { ConfigService } from '@nestjs/config';
import { User } from '../../modules/user/user.domain';
import { CryptoService } from '../crypto/crypto.service';
import { HttpClient } from '../http/http.service';
import { BridgeService } from './bridge.service';
import { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { mockLogger } from '../../../test/helpers/auth.helper';

describe('Bridge Service', () => {
  let service: BridgeService;
  let httpClient: DeepMockProxy<HttpClient>;
  let cryptoService: DeepMockProxy<CryptoService>;
  let configService: DeepMockProxy<ConfigService>;

  const mockedUser = User.build({
    id: 2,
    userId: 'userId',
    name: 'User Owner',
    lastname: 'Lastname',
    email: 'fake@internxt.com',
    username: 'fake',
    bridgeUser: 'fake@internxt.com',
    rootFolderId: 1,
    errorLoginCount: 0,
    isEmailActivitySended: 1,
    referralCode: null,
    referrer: null,
    syncDate: new Date(),
    uuid: 'uuid',
    lastResend: new Date(),
    credit: null,
    welcomePack: true,
    registerCompleted: true,
    backupsBucket: 'bucket',
    sharedWorkspace: true,
    avatar: 'avatar',
    password: '',
    mnemonic: '',
    hKey: undefined,
    secret_2FA: '',
    lastPasswordChangedAt: new Date(),
    emailVerified: false,
  });

  beforeEach(async () => {
    cryptoService = mockDeep<CryptoService>();
    httpClient = mockDeep<HttpClient>();
    configService = mockDeep<ConfigService>();

    service = new BridgeService(cryptoService, httpClient, configService);
    mockLogger();
  });

  describe('delete file', () => {
    it('should generate the correct call', async () => {
      const testUrl = 'bridge.test.com';
      const hash = '36121346839494429743';
      const response: AxiosResponse<void> = {
        data: null,
        status: 200,
        headers: {},
        config: {} as InternalAxiosRequestConfig,
        statusText: 'OK',
      };
      configService.get.mockReturnValue(testUrl);
      cryptoService.hashSha256.mockReturnValue(hash);
      httpClient.delete.mockResolvedValueOnce(response);

      await service.deleteFile(
        mockedUser,
        'cc925fa0-a145-58b8-8959-8b3796fd025f',
        '6c4f6109-0f64-565d-b0c4-25091a3ec247',
      );

      expect(httpClient.delete).toHaveBeenCalledTimes(1);
      expect(httpClient.delete).toHaveBeenCalledWith(
        testUrl +
          '/buckets/cc925fa0-a145-58b8-8959-8b3796fd025f/files/6c4f6109-0f64-565d-b0c4-25091a3ec247',
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ZmFrZUBpbnRlcm54dC5jb206MzYxMjEzNDY4Mzk0OTQ0Mjk3NDM=`,
          },
        },
      );
    });
  });

  describe('sendDeactivationEmail', () => {
    const testBridgeApiUrl = 'bridge.test.com';
    const deactivationRedirectUrl = 'http://example.com/redirect';
    const deactivator = 'user';

    it('When deactivation email is being requested, it should make the request successfully', async () => {
      const response: AxiosResponse<void> = {
        data: null,
        status: 200,
        headers: {},
        config: {} as InternalAxiosRequestConfig,
        statusText: 'OK',
      };

      configService.get.mockReturnValue(testBridgeApiUrl);
      httpClient.delete.mockResolvedValueOnce(response);

      await service.sendDeactivationEmail(
        mockedUser,
        deactivationRedirectUrl,
        deactivator,
      );

      expect(httpClient.delete).toHaveBeenCalledTimes(1);
      expect(httpClient.delete).toHaveBeenCalledWith(
        `${testBridgeApiUrl}/users/${mockedUser.email}?redirect=${deactivationRedirectUrl}&deactivator=${deactivator}`,
        expect.any(Object),
      );
    });

    it('When deactivation email fails, it should throw', async () => {
      configService.get.mockReturnValue(testBridgeApiUrl);
      httpClient.delete.mockRejectedValueOnce(new Error());

      await expect(
        service.sendDeactivationEmail(
          mockedUser,
          deactivationRedirectUrl,
          deactivator,
        ),
      ).rejects.toThrow();
    });
  });

  describe('confirmDeactivation', () => {
    const testBridgeApiUrl = 'bridge.test.com';
    const token = 'deactivationToken';
    const email = 'test@email.com';

    it('When user deactivation is being confirmed, it should make the request successfully', async () => {
      const response: AxiosResponse<{ email: string }> = {
        data: { email },
        status: 200,
        headers: {},
        config: {} as InternalAxiosRequestConfig,
        statusText: 'OK',
      };

      configService.get.mockReturnValue(testBridgeApiUrl);
      httpClient.get.mockResolvedValueOnce(response);

      await service.confirmDeactivation(token);

      expect(httpClient.get).toHaveBeenCalledTimes(1);
      expect(httpClient.get).toHaveBeenCalledWith(
        `${testBridgeApiUrl}/deactivationStripe/${token}`,
        expect.any(Object),
      );
    });

    it('When user deactivation confirmation fails, it should throw', async () => {
      configService.get.mockReturnValue(testBridgeApiUrl);
      httpClient.get.mockRejectedValueOnce(new Error());

      await expect(service.confirmDeactivation(token)).rejects.toThrow();
    });
  });
});
