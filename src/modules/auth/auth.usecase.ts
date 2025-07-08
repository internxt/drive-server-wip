import { JwtService } from '@nestjs/jwt';
import { CacheManagerService } from '../cache-manager/cache-manager.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthUsecases {
  constructor(
    private readonly cacheManagerService: CacheManagerService,
    private readonly jwtService: JwtService,
  ) {}

  async logout(jwt: string) {
    const tokenClaims = this.jwtService.decode(jwt);

    if (tokenClaims?.jti) {
      const currentTime = Math.floor(Date.now() / 1000);
      const ttl = tokenClaims.exp - currentTime;
      if (ttl > 0) {
        await this.cacheManagerService.blacklistJwt(tokenClaims.jti, ttl);
      }
    }
  }
}
