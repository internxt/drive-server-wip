import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../modules/user/user.domain';
import { CryptoService } from '../crypto/crypto.service';
import { HttpClientModule } from '../http/http.module';
import { HttpClient } from '../http/http.service';
import { BridgeService } from './bridge.service';
import { AxiosResponse } from 'axios';
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
    tempKey: '',
    lastPasswordChangedAt: new Date(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule, HttpClientModule, CryptoModule],
      providers: [BridgeService],
    }).compile();

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
        config: {},
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
      expect(httpClient.delete).toBeCalledWith(
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
});
