import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import configuration from '../../config/configuration';
import { CryptoService } from './crypto.service';

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
});
