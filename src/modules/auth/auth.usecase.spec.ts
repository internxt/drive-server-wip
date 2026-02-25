import { Test, type TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthUsecases } from './auth.usecase';
import { CacheManagerService } from '../cache-manager/cache-manager.service';
import { createMock } from '@golevelup/ts-jest';
import { v4 } from 'uuid';

describe('AuthUsecases', () => {
  let usecases: AuthUsecases;
  let jwtService: JwtService;
  let cacheManagerService: CacheManagerService;

  const mockJwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [AuthUsecases],
    })
      .useMocker(createMock)
      .compile();

    usecases = moduleRef.get<AuthUsecases>(AuthUsecases);
    jwtService = moduleRef.get<JwtService>(JwtService);
    cacheManagerService =
      moduleRef.get<CacheManagerService>(CacheManagerService);
  });

  it('When tests are started, then it should be defined', () => {
    expect(usecases).toBeDefined();
    expect(jwtService).toBeDefined();
    expect(cacheManagerService).toBeDefined();
  });

  describe('logout use case', () => {
    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(1640995200000); // 2022-01-01 00:00:00
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('When valid JWT with jti and exp is provided, then token should be blacklisted', async () => {
      const mockTokenClaims = {
        jti: v4(),
        exp: 1640995800, // 10 minutes from now
      };
      const expectedTtl = 600; // 10 minutes

      jest.spyOn(jwtService, 'decode').mockReturnValue(mockTokenClaims);
      jest.spyOn(cacheManagerService, 'blacklistJwt').mockResolvedValue(true);

      await usecases.logout(mockJwtToken);

      expect(jwtService.decode).toHaveBeenCalledWith(mockJwtToken);
      expect(cacheManagerService.blacklistJwt).toHaveBeenCalledWith(
        mockTokenClaims.jti,
        expectedTtl,
      );
    });

    it('When JWT has no jti claim, then token should not be blacklisted', async () => {
      const mockTokenClaims = {
        exp: 1640995800,
      };

      jest.spyOn(jwtService, 'decode').mockReturnValue(mockTokenClaims);
      jest.spyOn(cacheManagerService, 'blacklistJwt');

      await usecases.logout(mockJwtToken);

      expect(jwtService.decode).toHaveBeenCalledWith(mockJwtToken);
      expect(cacheManagerService.blacklistJwt).not.toHaveBeenCalled();
    });

    it('When JWT has no exp claim, then token should not be blacklisted', async () => {
      const mockTokenClaims = {
        jti: v4(),
      };

      jest.spyOn(jwtService, 'decode').mockReturnValue(mockTokenClaims);
      jest.spyOn(cacheManagerService, 'blacklistJwt');

      await usecases.logout(mockJwtToken);

      expect(jwtService.decode).toHaveBeenCalledWith(mockJwtToken);
      expect(cacheManagerService.blacklistJwt).not.toHaveBeenCalled();
    });

    it('When JWT is expired, then token should not be blacklisted', async () => {
      const mockTokenClaims = {
        jti: v4(),
        exp: 1640994600, // 10 minutes ago
      };

      jest.spyOn(jwtService, 'decode').mockReturnValue(mockTokenClaims);
      jest.spyOn(cacheManagerService, 'blacklistJwt');

      await usecases.logout(mockJwtToken);

      expect(jwtService.decode).toHaveBeenCalledWith(mockJwtToken);
      expect(cacheManagerService.blacklistJwt).not.toHaveBeenCalled();
    });

    it('When JWT decode returns nothing, then token should not be blacklisted', async () => {
      jest.spyOn(jwtService, 'decode').mockReturnValue(null);
      jest.spyOn(cacheManagerService, 'blacklistJwt');

      await usecases.logout(mockJwtToken);

      expect(jwtService.decode).toHaveBeenCalledWith(mockJwtToken);
      expect(cacheManagerService.blacklistJwt).not.toHaveBeenCalled();
    });

    it('When JWT has jti but ttl is exactly 0, then token should not be blacklisted', async () => {
      const mockTokenClaims = {
        jti: v4(),
        exp: 1640995200,
      };

      jest.spyOn(jwtService, 'decode').mockReturnValue(mockTokenClaims);
      jest.spyOn(cacheManagerService, 'blacklistJwt');

      await usecases.logout(mockJwtToken);

      expect(jwtService.decode).toHaveBeenCalledWith(mockJwtToken);
      expect(cacheManagerService.blacklistJwt).not.toHaveBeenCalled();
    });
  });
});
