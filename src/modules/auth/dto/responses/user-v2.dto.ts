import { OmitType } from '@nestjs/swagger';
import { UserDto } from './user.dto';

export class UserV2Dto extends OmitType(UserDto, [
  'privateKey',
  'publicKey',
  'revocateKey',
] as const) {}