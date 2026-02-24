import { Test, type TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { UserUseCases } from '../user/user.usecase';
import { JwtStrategy } from './jwt.strategy';
import { newUser } from '../../../test/fixtures';
import { UnauthorizedException } from '@nestjs/common';
import { getTokenDefaultIat } from '../../lib/jwt';
import { CacheManagerService } from '../cache-manager/cache-manager.service';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { v4 } from 'uuid';

describe('Jwt strategy', () => {
  let userUseCases: UserUseCases;
  let strategy: JwtStrategy;
  let cacheManagerService: CacheManagerService;
  let featureLimitService: FeatureLimitService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [JwtStrategy],
    })
      .useMocker(createMock)
      .compile();
    userUseCases = moduleRef.get<UserUseCases>(UserUseCases);
    strategy = moduleRef.get<JwtStrategy>(JwtStrategy);
    cacheManagerService =
      moduleRef.get<CacheManagerService>(CacheManagerService);
    featureLimitService =
      moduleRef.get<FeatureLimitService>(FeatureLimitService);
  });

  it('When token is old version, then fail', async () => {
    await expect(strategy.validate({ email: 'test@test.com' })).rejects.toThrow(
      new UnauthorizedException('Old token version detected'),
    );
  });

  it('When user does not exist, then fail', async () => {
    jest.spyOn(userUseCases, 'getUser').mockResolvedValue(null);

    await expect(
      strategy.validate({ payload: { uuid: 'anyUuid' } }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('When token iat is less than lastPasswordChangedAt , then fail', async () => {
    const user = newUser();
    const tokenIat = getTokenDefaultIat();
    const greaterDate = new Date(tokenIat * 1000);
    greaterDate.setMinutes(greaterDate.getMinutes() + 1);
    user.lastPasswordChangedAt = greaterDate;

    jest.spyOn(userUseCases, 'getUser').mockResolvedValue(user);

    await expect(
      strategy.validate({ payload: { uuid: 'anyUuid' }, iat: tokenIat }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('When user iat is greater than lastPasswordChangedAt, then return user', async () => {
    const user = newUser();
    const tokenIat = getTokenDefaultIat();
    const olderDate = new Date(tokenIat * 1000);
    olderDate.setMinutes(olderDate.getMinutes() - 1);
    user.lastPasswordChangedAt = olderDate;

    jest.spyOn(userUseCases, 'getUser').mockResolvedValue(user);

    const result = await strategy.validate({
      payload: { uuid: 'anyUuid' },
      iat: tokenIat,
    });
    expect(result).toEqual([user, { platform: undefined, tier: undefined }]);
  });

  it('When token has iat but user has not lastPasswordChangedAt, then return user', async () => {
    const tokenIat = getTokenDefaultIat();
    const user = newUser();
    user.lastPasswordChangedAt = null;

    jest.spyOn(userUseCases, 'getUser').mockResolvedValue(user);

    const result = await strategy.validate({
      payload: { uuid: 'anyUuid' },
      iat: tokenIat,
    });
    expect(result).toEqual([user, { platform: undefined, tier: undefined }]);
  });

  it('When user is guest on shared workspace and token is valid, then return owner', async () => {
    const guestUser = newUser();
    const owner = newUser();
    guestUser.bridgeUser = owner.username;
    const anyUuid = 'testUuid';

    const tokenIat = getTokenDefaultIat();
    const olderDate = new Date(tokenIat * 1000);
    olderDate.setMinutes(olderDate.getMinutes() - 1);
    guestUser.lastPasswordChangedAt = olderDate;

    const getUserSpy = jest
      .spyOn(userUseCases, 'getUser')
      .mockResolvedValue(guestUser);

    const getUserByUsernameSpy = jest
      .spyOn(userUseCases, 'getUserByUsername')
      .mockResolvedValue(owner);

    const result = await strategy.validate({
      payload: { uuid: anyUuid },
      iat: tokenIat,
    });
    expect(result).toEqual([owner, { platform: undefined }]);

    expect(getUserSpy).toHaveBeenCalledWith(anyUuid);
    expect(getUserByUsernameSpy).toHaveBeenCalledWith(owner.username);
  });

  it('When token has jti and is blacklisted, then throw UnauthorizedException', async () => {
    const jti = v4();
    const user = newUser();
    user.lastPasswordChangedAt = null;

    jest.spyOn(userUseCases, 'getUser').mockResolvedValue(user);
    jest.spyOn(cacheManagerService, 'isJwtBlacklisted').mockResolvedValue(true);

    await expect(
      strategy.validate({
        payload: { uuid: user.uuid },
        jti,
        iat: getTokenDefaultIat(),
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(cacheManagerService.isJwtBlacklisted).toHaveBeenCalledWith(jti);
  });

  it('When token has jti and is not blacklisted, then continue validation and return user', async () => {
    const jti = v4();
    const user = newUser();
    user.lastPasswordChangedAt = null;

    jest.spyOn(userUseCases, 'getUser').mockResolvedValue(user);
    jest.spyOn(cacheManagerService, 'isJwtBlacklisted').mockResolvedValue(null);

    const result = await strategy.validate({
      payload: { uuid: user.uuid },
      jti,
      iat: getTokenDefaultIat(),
    });

    expect(cacheManagerService.isJwtBlacklisted).toHaveBeenCalledWith(jti);
    expect(result).toEqual([user, { platform: undefined, tier: undefined }]);
  });

  it('When token has no jti, then skip blacklist check and continue validation', async () => {
    const user = newUser();
    user.lastPasswordChangedAt = null;

    jest.spyOn(userUseCases, 'getUser').mockResolvedValue(user);
    const isBlacklistedSpy = jest.spyOn(
      cacheManagerService,
      'isJwtBlacklisted',
    );

    const result = await strategy.validate({
      payload: { uuid: user.uuid },
      iat: getTokenDefaultIat(),
    });

    expect(isBlacklistedSpy).not.toHaveBeenCalled();
    expect(result).toEqual([user, { platform: undefined, tier: undefined }]);
  });

  it('When user has tierId and tier exists, then return user with tier', async () => {
    const user = newUser();
    const tierId = v4();
    const mockTier = {
      id: tierId,
      label: 'premium_individual',
      context: 'drive',
    };
    user.tierId = tierId;
    user.lastPasswordChangedAt = null;

    jest.spyOn(userUseCases, 'getUser').mockResolvedValue(user);
    jest
      .spyOn(featureLimitService, 'getTier')
      .mockResolvedValue(mockTier as any);

    const result = await strategy.validate({
      payload: { uuid: user.uuid },
      iat: getTokenDefaultIat(),
    });

    expect(featureLimitService.getTier).toHaveBeenCalledWith(tierId);
    expect(result).toEqual([user, { platform: undefined, tier: mockTier }]);
  });

  it('When user has tierId but tier does not exist, then return user without tier', async () => {
    const user = newUser();
    const tierId = v4();
    user.tierId = tierId;
    user.lastPasswordChangedAt = null;

    jest.spyOn(userUseCases, 'getUser').mockResolvedValue(user);
    jest.spyOn(featureLimitService, 'getTier').mockResolvedValue(null);

    const result = await strategy.validate({
      payload: { uuid: user.uuid },
      iat: getTokenDefaultIat(),
    });

    expect(featureLimitService.getTier).toHaveBeenCalledWith(tierId);
    expect(result).toEqual([user, { platform: undefined, tier: null }]);
  });

  it('When user does not have tierId, then skip getTier call', async () => {
    const user = newUser();
    user.tierId = null;
    user.lastPasswordChangedAt = null;

    jest.spyOn(userUseCases, 'getUser').mockResolvedValue(user);
    const getTierSpy = jest.spyOn(featureLimitService, 'getTier');

    const result = await strategy.validate({
      payload: { uuid: user.uuid },
      iat: getTokenDefaultIat(),
    });

    expect(getTierSpy).not.toHaveBeenCalled();
    expect(result).toEqual([user, { platform: undefined, tier: undefined }]);
  });
});
