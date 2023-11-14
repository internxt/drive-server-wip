import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CaptchaService } from '../../externals/captcha/captcha.service';

@Injectable()
export class CaptchaGuard implements CanActivate {
  constructor(private readonly captchaService: CaptchaService) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const captchaToken = request.body.captchaToken;

    if (!captchaToken) {
      return false;
    }

    return this.captchaService.verifyCaptcha(captchaToken);
  }
}
