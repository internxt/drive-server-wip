import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { User } from '../user/user.domain';
import { MailUseCases } from './mail.usecase';
import { CreateMailAccountDto } from './dto/create-mail-account.dto';
import { AuditLog } from '../../common/audit-logs/decorators/audit-log.decorator';
import { AuditAction } from '../../common/audit-logs/audit-logs.attributes';

@Controller('mail')
export class MailController {
  constructor(private readonly mailUseCases: MailUseCases) {}

  @Post('accounts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Provision a mail account for the user' })
  @ApiBearerAuth()
  @AuditLog({
    action: AuditAction.MailSetup,
    metadata: (_req, res) => ({
      address: res.address,
    }),
  })
  async createMailAccount(
    @UserDecorator() user: User,
    @Body() createMailAccountDto: CreateMailAccountDto,
  ) {
    return this.mailUseCases.createMailAccount(user, createMailAccountDto);
  }
}
