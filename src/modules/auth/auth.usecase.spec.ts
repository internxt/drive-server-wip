import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import { JwtService } from '@nestjs/jwt';
import { AuthUsecases } from './auth.usecase';
import { CacheManagerService } from '../cache-manager/cache-manager.service';
import { v4 } from 'uuid';

describe('AuthUsecase', () => {
  let authUsecase: AuthUsecases;
  let jwtService: DeepMockProxy<JwtService>;
  let cacheManagerService: DeepMockProxy<CacheManagerService>;

  const mockJwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';

  beforeEach(async () => {
    jwtService = mockDeep<JwtService>();
    cacheManagerService = mockDeep<CacheManagerService>();

    authUsecase = new AuthUsecases(cacheManagerService, jwtService);
  });

  it('When tests are started, then it should be defined', () => {
    expect(authUsecase).toBeDefined();
    expect(jwtService).toBeDefined();
    expect(cacheManagerService).toBeDefined();
  });

  describe('logout use case', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(1640995200000); // 2022-01-01 00:00:00
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('When valid JWT with jti and exp is provided, then token should be blacklisted', async () => {
      const mockTokenClaims = {
        jti: v4(),
        exp: 1640995800, // 10 minutes from now
      };
      const expectedTtl = 600; // 10 minutes

      jwtService.decode.mockReturnValue(mockTokenClaims);
      cacheManagerService.blacklistJwt.mockResolvedValue(true);

      await authUsecase.logout(mockJwtToken);

      expect(jwtService.decode).toHaveBeenCalledWith(mockJwtToken);
      expect(cacheManagerService.blacklistJwt).toHaveBeenCalledWith(
        mockTokenClaims.jti,
        expectedTtl,
      );
    });

    it('When JWT has no jti claim, then token should not be blacklisted', async () => {
      const mockTokenClaims = {
        exp: 1640995800, // 10 minutes from now
      };

      jwtService.decode.mockReturnValue(mockTokenClaims);

      await authUsecase.logout(mockJwtToken);

      expect(jwtService.decode).toHaveBeenCalledWith(mockJwtToken);
      expect(cacheManagerService.blacklistJwt).not.toHaveBeenCalled();
    });

    it('When JWT has no exp claim, then token should not be blacklisted', async () => {
      const mockTokenClaims = {
        jti: v4(),
      };

      jwtService.decode.mockReturnValue(mockTokenClaims);

      await authUsecase.logout(mockJwtToken);

      expect(jwtService.decode).toHaveBeenCalledWith(mockJwtToken);
      expect(cacheManagerService.blacklistJwt).not.toHaveBeenCalled();
    });

    it('When JWT is expired, then token should not be blacklisted', async () => {
      const mockTokenClaims = {
        jti: v4(),
        exp: 1640994600, // 10 minutes ago
      };

      jwtService.decode.mockReturnValue(mockTokenClaims);

      await authUsecase.logout(mockJwtToken);

      expect(jwtService.decode).toHaveBeenCalledWith(mockJwtToken);
      expect(cacheManagerService.blacklistJwt).not.toHaveBeenCalled();
    });

    it('When JWT decode returns nothing, then token should not be blacklisted', async () => {
      jwtService.decode.mockReturnValue(null);

      await authUsecase.logout(mockJwtToken);

      expect(jwtService.decode).toHaveBeenCalledWith(mockJwtToken);
      expect(cacheManagerService.blacklistJwt).not.toHaveBeenCalled();
    });

    it('When JWT has jti but ttl is exactly 0, then token should not be blacklisted', async () => {
      const mockTokenClaims = {
        jti: v4(),
        exp: 1640995200,
      };

      jwtService.decode.mockReturnValue(mockTokenClaims);

      await authUsecase.logout(mockJwtToken);

      expect(jwtService.decode).toHaveBeenCalledWith(mockJwtToken);
      expect(cacheManagerService.blacklistJwt).not.toHaveBeenCalled();
    });
  });
});
