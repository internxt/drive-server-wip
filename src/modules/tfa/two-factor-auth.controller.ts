import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  HttpStatus,
  BadRequestException,
  HttpCode,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { User } from '../user/user.domain';
import { UserUseCases } from '../user/user.usecase';
import { CryptoService } from './../../externals/crypto/crypto.service';
import { TwoFactorAuthService } from './two-factor-auth.service';
import { UpdateTfaDto } from './dto/update-tfa.dto';
import { DeleteTfaDto } from './dto/delete-tfa.dto';

@ApiTags('TFA')
@Controller('tfa')
export class TwoFactorAuthController {
  constructor(
    private readonly userUseCases: UserUseCases,
    private cryptoService: CryptoService,
    private twoFactorAuthService: TwoFactorAuthService,
  ) {}

  @Get('/')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get two-factor authentication',
  })
  @ApiOkResponse({
    description: 'two-factor authentication',
  })
  async getTfa(@UserDecorator() user: User) {
    if (user.secret_2FA) {
      throw new ConflictException('User has already 2FA');
    }
    const { secret, qrCode } =
      await this.twoFactorAuthService.generateTwoFactorAuthSecret();
    return { code: secret.base32, qr: qrCode };
  }

  @Put('/')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update two-factor authentication',
  })
  @ApiOkResponse({
    description: 'two-factor authentication',
  })
  async putTfa(
    @UserDecorator() user: User,
    @Body() updateTfaDto: UpdateTfaDto,
  ) {
    if (user.secret_2FA) {
      throw new ConflictException('User has already 2FA');
    }

    await this.twoFactorAuthService.validateTwoFactorAuthCode(
      updateTfaDto.key,
      updateTfaDto.code,
    );
    await this.userUseCases.updateByUuid(user.uuid, {
      secret_2FA: updateTfaDto.key,
    });

    return { message: 'ok' };
  }

  @Delete('/')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete two-factor authentication',
  })
  @ApiOkResponse({
    description: 'two-factor authentication',
  })
  async deleteTfa(
    @UserDecorator() user: User,
    @Body() deleteTfaDto: DeleteTfaDto,
  ) {
    if (!user.secret_2FA) {
      throw new NotFoundException('Your account does not have 2FA activated.');
    }

    await this.twoFactorAuthService.validateTwoFactorAuthCode(
      user.secret_2FA,
      deleteTfaDto.code,
    );
    const decryptedPass = this.cryptoService.decryptText(deleteTfaDto.pass);

    if (user.password.toString() !== decryptedPass) {
      throw new BadRequestException('Invalid password');
    }
    await this.userUseCases.updateByUuid(user.uuid, { secret_2FA: null });
    return { message: 'ok' };
  }
}
