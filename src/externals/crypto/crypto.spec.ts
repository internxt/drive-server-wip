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

  describe('fakeSaltFor', () => {
    it('When called, then it should return a 32 chars hex string like a real salt', () => {
      const email = 'nonexistent@test.com';

      const result = cryptoService.fakeSaltFor(email);

      expect(result).toMatch(/^[0-9a-f]{32}$/);
    });

    it('When called twice with the same email, then it should return the same salt', () => {
      const email = 'nonexistent@test.com';

      const first = cryptoService.fakeSaltFor(email);
      const second = cryptoService.fakeSaltFor(email);

      expect(first).toBe(second);
    });

    it('When called with different emails, then it should return different salts', () => {
      const emailA = 'a@test.com';
      const emailB = 'b@test.com';

      const saltA = cryptoService.fakeSaltFor(emailA);
      const saltB = cryptoService.fakeSaltFor(emailB);

      expect(saltA).not.toBe(saltB);
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
