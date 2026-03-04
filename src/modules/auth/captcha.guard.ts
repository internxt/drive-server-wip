import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { type Observable } from 'rxjs';
import { CaptchaService } from '../../externals/captcha/captcha.service';

@Injectable()
export class CaptchaGuard implements CanActivate {
  constructor(private readonly captchaService: CaptchaService) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const captchaToken = request.headers['x-internxt-captcha'];
    const ip = request.ips.length ? request.ips[0] : request.ip;

    if (!captchaToken) {
      return false;
    }

    return this.captchaService.verifyCaptcha(captchaToken, ip);
  }
}
