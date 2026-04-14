import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HealthTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-health-token'];
    const expectedToken = this.configService.get<string>('healthCheckToken');

    if (!expectedToken || token !== expectedToken) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
