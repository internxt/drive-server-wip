import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import { User } from '../../modules/user/user.domain';
import { CryptoService } from '../crypto/crypto.service';
import { HttpClientModule } from '../http/http.module';
import { HttpClient } from '../http/http.service';
import { BridgeService } from './bridge.service';
import { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { CryptoModule } from '../crypto/crypto.module';

describe('Bridge Service', () => {
  let service: BridgeService;
  let httpClient: HttpClient;
  let cryptoService: CryptoService;
  let configService: ConfigService;

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
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule, HttpClientModule, CryptoModule],
      providers: [BridgeService],
    })
      .setLogger(createMock<Logger>())
      .compile();

    service = module.get<BridgeService>(BridgeService);
    httpClient = module.get<HttpClient>(HttpClient);
    configService = module.get<ConfigService>(ConfigService);
    cryptoService = module.get<CryptoService>(CryptoService);
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
      jest.spyOn(configService, 'get').mockReturnValue(testUrl);
      jest.spyOn(cryptoService, 'hashSha256').mockReturnValue(hash);
      jest.spyOn(httpClient, 'delete').mockResolvedValueOnce(response);

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

      jest.spyOn(configService, 'get').mockReturnValue(testBridgeApiUrl);
      jest.spyOn(httpClient, 'delete').mockResolvedValueOnce(response);

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
      jest.spyOn(configService, 'get').mockReturnValue(testBridgeApiUrl);
      jest.spyOn(httpClient, 'delete').mockRejectedValueOnce(new Error());

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

      jest.spyOn(configService, 'get').mockReturnValue(testBridgeApiUrl);
      jest.spyOn(httpClient, 'get').mockResolvedValueOnce(response);

      await service.confirmDeactivation(token);

      expect(httpClient.get).toHaveBeenCalledTimes(1);
      expect(httpClient.get).toHaveBeenCalledWith(
        `${testBridgeApiUrl}/deactivationStripe/${token}`,
        expect.any(Object),
      );
    });

    it('When user deactivation confirmation fails, it should throw', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(testBridgeApiUrl);
      jest.spyOn(httpClient, 'get').mockRejectedValueOnce(new Error());

      await expect(service.confirmDeactivation(token)).rejects.toThrow();
    });
  });
});
