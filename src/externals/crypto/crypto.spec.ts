import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import configuration from '../../config/configuration';
import { CryptoService } from './crypto.service';
import { Environment } from '@internxt/inxt-js';

describe('Crypto', () => {
  let cryptoService: CryptoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: [`.env.${process.env.NODE_ENV}`],
          load: [configuration],
          isGlobal: true,
        }),
      ],
      providers: [
        {
          provide: CryptoService,
          useFactory: async (configService: ConfigService) => {
            return new CryptoService(configService);
          },
          inject: [ConfigService],
        },
      ],
    }).compile();

    cryptoService = module.get<CryptoService>(CryptoService);
  });

  describe('check crypto as singleton', () => {
    it('encrypt text without random IV does not throw an exception', () => {
      cryptoService.encryptName('text to encrypt', 1453363321);
    });
  });

  describe('hashSha256', () => {
    it('should hash correctly', () => {
      const result = cryptoService.hashSha256('Azboodo');

      expect(result).toBe(
        '0b9d660f04cb895b899243f88c92e82483d7d881fc6d3d16d229d0e88c33b7e6',
      );
    });

    it('should hash correctly when empty', () => {
      const result = cryptoService.hashSha256('');

      expect(result).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
    });
  });

  describe('getFileDeterministicKey works', () => {
    const buckeyKeyHex =
      '5f1c199c1e0bea246e12710cef0296a0c4a6ee54b1248365bee3113f755461b5f36e92a9055a360fceef85f149ae5b5e29890421fe9b575f76acc82c8620bd83';
    const bucketKey = Buffer.from(buckeyKeyHex, 'hex').subarray(0, 32);
    const index = Buffer.from([0, 0, 0, 1]);
    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const bucketId = 'test';

    it('should compute encryption key correctly', () => {
      const result = cryptoService.getFileDeterministicKey(bucketKey, index);
      const resultHex = Buffer.from(result).toString('hex');

      expect(resultHex).toBe(
        '32f4b6c619e13b5a7651a6a84434b0b1020cb706193624e9b8307dd3a13945a2',
      );
    });

    it('should compute the same key as env', async () => {
      const result = cryptoService.getFileDeterministicKey(bucketKey, index);

      const correctKey = await Environment.utils.generateFileKey(
        mnemonic,
        bucketId,
        index,
      );

      expect(result).toEqual(correctKey);
    });
  });
});
