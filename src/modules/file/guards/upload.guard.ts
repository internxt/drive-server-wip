import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import * as semver from 'semver';

@Injectable()
export class UploadGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const client = request.headers['internxt-client'];
    const version = request.headers['internxt-version'];

    if (client === '@internxt/cli' && semver.lt(version, '1.5.0')) {
      throw new BadRequestException(
        'This Internxt CLI version is not allowed. Please update it.',
      );
    }
    return true;
  }
}
