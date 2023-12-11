import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { AttemptChangeEmailUseCase } from './attempt-change-email.usecase';
import { CreateAttemptChangeEmail } from './dto/create-attempt-change-email.dto';
import { User } from '../user.domain';
import { User as UserDecorator } from '../../auth/decorators/user.decorator';
import { ThrottlerGuard } from '@nestjs/throttler';
import { HttpExceptionFilter } from 'src/lib/http/http-exception.filter';

@UseFilters(new HttpExceptionFilter())
@Controller('users/attempt-change-email')
export class AttemptChangeEmailController {
  constructor(
    private readonly attemptChangeEmailUseCase: AttemptChangeEmailUseCase,
  ) {}

  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Post()
  async createAttemptChangeEmail(
    @UserDecorator() user: User,
    @Body() body: CreateAttemptChangeEmail,
  ) {
    await this.attemptChangeEmailUseCase.createAttemptChangeEmail(
      user,
      body.newEmail,
    );
  }

  @HttpCode(201)
  @Post(':encryptedAttemptChangeEmailId/accept')
  async acceptAttemptChangeEmail(
    @Param('encryptedAttemptChangeEmailId') id: string,
  ) {
    return await this.attemptChangeEmailUseCase.acceptAttemptChangeEmail(id);
  }

  @HttpCode(200)
  @Get(':encryptedAttemptChangeEmailId/verify-expiration')
  async verifyAttemptChangeEmail(
    @Param('encryptedAttemptChangeEmailId') id: string,
  ) {
    return await this.attemptChangeEmailUseCase.isAttemptChangeEmailExpired(id);
  }
}
