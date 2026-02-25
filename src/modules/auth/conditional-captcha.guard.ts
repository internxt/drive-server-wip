import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserUseCases } from '../user/user.usecase';
import { CaptchaService } from '../../externals/captcha/captcha.service';
import { ClientHeaders } from '../../common/decorators/client.decorator';
import { ClientEnum } from '../../common/enums/platform.enum';

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
    const inxtClient =
      request.headers[ClientHeaders.CLIENT_ID] ??
      request.headers[ClientHeaders.CLIENT] ??
      '';
    const ip = request.ips.length ? request.ips[0] : request.ip;
    const email = request.body?.email;

    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const { errorLoginCount } = await this.userUseCase.findByEmail(email);

    if (errorLoginCount >= this.threshold) {
      if (inxtClient !== ClientEnum['Web']) {
        throw new ForbiddenException({
          message: 'Too many failed attempts, go to the web app to login',
          code: 'WebLoginRequired',
        });
      }

      if (!captchaToken) {
        throw new ForbiddenException({
          message: 'Captcha is required after multiple failed attempts',
          code: 'CaptchaRequired',
        });
      }

      const passed = await this.captchaService.verifyCaptcha(captchaToken, ip);
      if (!passed) {
        throw new UnauthorizedException('Captcha validation failed');
      }
    }

    return true;
  }
}
