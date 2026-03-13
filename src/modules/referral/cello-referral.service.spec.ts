import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import { verify } from 'jsonwebtoken';
import { CelloReferralService } from './cello-referral.service';

describe('CelloReferralService', () => {
  let service: CelloReferralService;

  const celloConfig = {
    'cello.productId': 'test-product-id',
    'cello.productSecret': 'test-product-secret',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule],
      providers: [CelloReferralService],
    })
      .setLogger(createMock<Logger>())
      .compile();

    service = module.get<CelloReferralService>(CelloReferralService);

    const configService = module.get<ConfigService>(ConfigService);
    jest
      .spyOn(configService, 'get')
      .mockImplementation((key: string) => celloConfig[key]);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('generateToken', () => {
    it('When called, then it returns a valid JWT signed with HS512', () => {
      const signupDate = new Date('2024-01-15T10:00:00.000Z');
      const token = service.generateToken('user-uuid', signupDate);

      const decoded = verify(token, celloConfig['cello.productSecret'], {
        algorithms: ['HS512'],
      }) as Record<string, unknown>;

      expect(decoded.productId).toBe(celloConfig['cello.productId']);
      expect(decoded.productUserId).toBe('user-uuid');
      expect(decoded.signupDate).toBe('2024-01-15T10:00:00.000Z');
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBe((decoded.iat as number) + 3600);
    });
  });
});
