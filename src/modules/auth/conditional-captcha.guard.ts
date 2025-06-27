import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { UserUseCases } from '../user/user.usecase';
import { CaptchaService } from 'src/externals/captcha/captcha.service';

@Injectable()
export class ConditionalCaptchaGuard implements CanActivate {
  private readonly threshold = 5;

  constructor(
    private readonly userUseCase: UserUseCases,
    private readonly captchaService: CaptchaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const captchaToken = request.headers?.['x-internxt-captcha'];
    const ip = request.ips.length ? request.ips[0] : request.ip;
    const email = request.body?.email;

    if (!email) {
      throw new UnauthorizedException(
        'Email is required to evaluate captcha condition',
      );
    }

    const { errorLoginCount } = await this.userUseCase.findByEmail(email);

    if (errorLoginCount >= this.threshold) {
      if (!captchaToken) {
        throw new UnauthorizedException(
          'Captcha is required after multiple failed attempts',
        );
      }

      Logger.log(`ERROR LOGIN COUNT: ${errorLoginCount}. EMAIL: ${email}`);
      const passed = await this.captchaService.verifyCaptcha(captchaToken, ip);
      if (!passed) {
        throw new UnauthorizedException('Captcha validation failed');
      }
    }

    return true;
  }
}
