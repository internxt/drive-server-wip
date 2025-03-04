import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class UploadGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const version = request.headers['internxt-version'];
    const client = request.headers['internxt-client'];

    if (version === '1.0.5' && client === '@internxt/cli') {
      throw new BadRequestException(
        'This Internxt CLI version is not allowed. Please update it.',
      );
    }
    return true;
  }
}
