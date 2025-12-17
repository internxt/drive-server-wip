import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty()
  hasKeys: boolean;

  @ApiProperty()
  sKey: string;

  @ApiProperty()
  tfa: boolean;

  @ApiProperty()
  hasKyberKeys: boolean;

  @ApiProperty()
  hasEccKeys: boolean;

  @ApiProperty()
  useOpaqueLogin: boolean;
}
