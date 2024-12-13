import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Res,
  HttpStatus,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
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
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get two-factor authentication',
  })
  @ApiOkResponse({
    description: 'two-factor authentication',
  })
  async getTfa(@UserDecorator() user: User, @Res() res: Response) {
    if (user.secret_2FA) {
      throw new HttpException('User has already 2FA', HttpStatus.CONFLICT);
    }
    const { secret, qrCode } =
      await this.twoFactorAuthService.generateTwoFactorAuthSecret();
    return res.status(200).send({ code: secret.base32, qr: qrCode });
  }

  @Put('/')
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
    @Res() res: Response,
  ) {
    if (user.secret_2FA) {
      throw new HttpException('User has already 2FA', HttpStatus.CONFLICT);
    }

    await this.twoFactorAuthService.validateTwoFactorAuthCode(
      updateTfaDto.key,
      updateTfaDto.code,
    );
    await this.userUseCases.updateByUuid(user.uuid, {
      secret_2FA: updateTfaDto.key,
    });

    return res.status(200).send({ message: 'ok' });
  }

  @Delete('/')
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
    @Res() res: Response,
  ) {
    if (!user.secret_2FA) {
      throw new HttpException(
        'Your account does not have 2FA activated.',
        HttpStatus.NO_CONTENT,
      );
    }

    await this.twoFactorAuthService.validateTwoFactorAuthCode(
      user.secret_2FA,
      deleteTfaDto.code,
    );
    const decryptedPass = this.cryptoService.decryptText(deleteTfaDto.pass);

    if (user.password.toString() !== decryptedPass) {
      throw new BadRequestException('Invalid password');
    } else {
      await this.userUseCases.updateByUuid(user.uuid, { secret_2FA: null });
      return res.status(200).send({ message: 'ok' });
    }
  }
}
