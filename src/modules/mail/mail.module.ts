import { forwardRef, Module } from '@nestjs/common';
import { MailServiceModule } from '../../externals/mail/mail.module';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { AuditLogsModule } from '../../common/audit-logs/audit-logs.module';
import { FeatureLimitModule } from '../feature-limit/feature-limit.module';
import { MailController } from './mail.controller';
import { MailUseCases } from './mail.usecase';

@Module({
  imports: [
    MailServiceModule,
    CryptoModule,
    AuditLogsModule,
    forwardRef(() => FeatureLimitModule),
  ],
  controllers: [MailController],
  providers: [MailUseCases],
  exports: [MailUseCases],
})
export class MailModule {}
