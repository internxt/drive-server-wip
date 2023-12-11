import { Injectable } from '@nestjs/common';
import { AttemptChangeEmailRepository } from './attempt-change-email.repository';
import { User } from '../user.domain';
import { Sequelize } from 'sequelize-typescript';
import { AttemptChangeEmailNotFoundException } from './exception/attempt-change-email-not-found.exception';
import { AttemptChangeEmailHasExpiredException } from './exception/attempt-change-email-has-expired.exception';
import { AttemptChangeEmailAlreadyVerifiedException } from './exception/attempt-change-email-already-verified.exception';
import { UserUseCases } from '../user.usecase';
import { MailerService } from 'src/externals/mailer/mailer.service';
import { CryptoService } from 'src/externals/crypto/crypto.service';

@Injectable()
export class AttemptChangeEmailUseCase {
  constructor(
    private readonly attemptChangeEmailRepository: AttemptChangeEmailRepository,
    private readonly userUseCases: UserUseCases,
    private readonly mailerService: MailerService,
    private readonly cryptoService: CryptoService,
    private readonly sequelize: Sequelize,
  ) {}

  async createAttemptChangeEmail(user: User, newEmail: string): Promise<void> {
    const attempt = await this.attemptChangeEmailRepository.create({
      userId: user.id,
      newEmail,
    });

    const encryptedId = this.cryptoService.encryptText(attempt.id.toString());

    await this.mailerService.sendUpdateUserEmailVerification(
      newEmail,
      encryptedId,
    );
  }

  async isAttemptChangeEmailExpired(encryptedId: string) {
    const attemptChangeEmailId = parseInt(
      this.cryptoService.decryptText(encryptedId),
    );

    const attemptChangeEmail =
      await this.attemptChangeEmailRepository.getOneById(attemptChangeEmailId);

    if (!attemptChangeEmail) {
      throw new AttemptChangeEmailNotFoundException();
    }

    if (attemptChangeEmail.isVerified) {
      throw new AttemptChangeEmailAlreadyVerifiedException();
    }

    return { isExpired: attemptChangeEmail.isExpired };
  }

  acceptAttemptChangeEmail(encryptedId: string) {
    return this.sequelize.transaction(async (t) => {
      const attemptChangeEmailId = parseInt(
        this.cryptoService.decryptText(encryptedId),
      );

      const attemptChangeEmail =
        await this.attemptChangeEmailRepository.getOneById(
          attemptChangeEmailId,
        );

      if (!attemptChangeEmail) {
        throw new AttemptChangeEmailNotFoundException();
      }

      if (attemptChangeEmail.isExpired) {
        throw new AttemptChangeEmailHasExpiredException();
      }

      if (attemptChangeEmail.isVerified) {
        throw new AttemptChangeEmailAlreadyVerifiedException();
      }

      const emails = await this.userUseCases.changeUserEmailById(
        attemptChangeEmail.userId,
        attemptChangeEmail.newEmail,
        t,
      );
      await this.attemptChangeEmailRepository.acceptAttemptChangeEmail(
        attemptChangeEmailId,
        t,
      );

      return emails;
    });
  }
}
