import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sendgrid from '@sendgrid/mail';
import { type User } from '../../modules/user/user.domain';
import { type Folder } from '../../modules/folder/folder.domain';
import { type File } from '../../modules/file/file.domain';
import { type Workspace } from '../../modules/workspaces/domains/workspaces.domain';

type SendInvitationToSharingContext = {
  notification_message: string;
  item_name: string;
  sender_email: string;
  accept_url: string;
  decline_url: string;
};

type SendInvitationToSharingGuestContext = {
  notification_message: string;
  item_name: string;
  sender_email: string;
  signup_url: string;
};

type RemovedFromSharingContext = {
  item_name: string;
};

type UpdatedSharingRoleContext = {
  item_name: string;
  new_role: string;
};

@Injectable()
export class MailerService {
  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {
    sendgrid.setApiKey(this.configService.get('mailer.apiKey'));
  }

  async send(email, templateId, context) {
    const msg = {
      to: email,
      from: {
        email: this.configService.get('mailer.from'),
        name: this.configService.get('mailer.name'),
      },
      subject: '',
      text: 'send link',
      html: 'send link',
      personalizations: [
        {
          to: [
            {
              email,
            },
          ],
          dynamic_template_data: context,
        },
      ],
      template_id: templateId,
      mail_settings: {
        sandbox_mode: {
          enable: this.configService.get('mailer.sandbox'),
        },
      },
    };
    await sendgrid.send(msg);
  }

  async sendInvitationToSharingReceivedEmail(
    ownerOfTheItemEmail: User['email'],
    invitedUserEmail: User['email'],
    itemName: File['plainName'] | Folder['plainName'],
    mailInfo: {
      acceptUrl: string;
      declineUrl: string;
      message: string;
    },
  ): Promise<void> {
    const context: SendInvitationToSharingContext = {
      sender_email: ownerOfTheItemEmail,
      accept_url: mailInfo.acceptUrl,
      decline_url: mailInfo.declineUrl,
      item_name: itemName,
      notification_message: mailInfo.message,
    };
    await this.send(
      invitedUserEmail,
      this.configService.get('mailer.templates.invitationToSharingReceived'),
      context,
    );
  }

  async sendInvitationToSharingGuestEmail(
    ownerOfTheItemEmail: User['email'],
    invitedUserEmail: User['email'],
    itemName: File['plainName'] | Folder['plainName'],
    mailInfo: {
      signUpUrl: string;
      message: string;
    },
  ): Promise<void> {
    const context: SendInvitationToSharingGuestContext = {
      sender_email: ownerOfTheItemEmail,
      item_name: itemName,
      signup_url: mailInfo.signUpUrl,
      notification_message: mailInfo.message,
    };
    await this.send(
      invitedUserEmail,
      this.configService.get(
        'mailer.templates.invitationToSharingGuestReceived',
      ),
      context,
    );
  }

  async sendWorkspaceUserInvitation(
    senderName: User['name'],
    invitedUserEmail: User['email'],
    workspaceName: Workspace['name'],
    mailInfo: {
      acceptUrl: string;
      declineUrl: string;
    },
    optionals: {
      avatar?: {
        pictureUrl: string;
        initials: string;
      };
      message?: string;
    },
  ): Promise<void> {
    const context = {
      sender_name: senderName,
      workspace_name: workspaceName,
      avatar: {
        picture_url: optionals?.avatar?.pictureUrl,
        initials: optionals?.avatar?.initials,
      },
      accept_url: mailInfo.acceptUrl,
      decline_url: mailInfo.declineUrl,
      message: optionals?.message,
    };
    await this.send(
      invitedUserEmail,
      this.configService.get('mailer.templates.invitationToWorkspaceUser'),
      context,
    );
  }

  async sendWorkspaceUserExternalInvitation(
    senderName: User['name'],
    invitedUserEmail: User['email'],
    workspaceName: Workspace['name'],
    signUpUrl: string,
    optionals: {
      avatar?: {
        pictureUrl: string;
        initials: string;
      };
      message?: string;
    },
  ): Promise<void> {
    const context = {
      sender_name: senderName,
      workspace_name: workspaceName,
      avatar: {
        picture_url: optionals?.avatar?.pictureUrl,
        initials: optionals?.avatar?.initials,
      },
      signup_url: signUpUrl,
      message: optionals?.message,
    };
    await this.send(
      invitedUserEmail,
      this.configService.get('mailer.templates.invitationToWorkspaceGuestUser'),
      context,
    );
  }

  async sendRemovedFromSharingEmail(
    userRemovedFromSharingEmail: User['email'],
    itemName: File['plainName'] | Folder['plainName'],
  ): Promise<void> {
    const context: RemovedFromSharingContext = {
      item_name: itemName,
    };

    await this.send(
      userRemovedFromSharingEmail,
      this.configService.get('mailer.templates.removedFromSharing'),
      context,
    );
  }

  async sendUpdatedSharingRoleEmail(
    userUpdatedSharingRoleEmail: User['email'],
    itemName: File['plainName'] | Folder['plainName'],
    newRole: string,
  ): Promise<void> {
    const context: UpdatedSharingRoleContext = {
      item_name: itemName,
      new_role: newRole,
    };

    await this.send(
      userUpdatedSharingRoleEmail,
      this.configService.get('mailer.templates.updatedSharingRole'),
      context,
    );
  }

  async sendUpdateUserEmailVerification(
    newEmail: string,
    encryptedAttemptId: string,
  ) {
    const webUrl = this.configService.get('clients.drive.web');

    const verificationUrl = `${webUrl}/change-email/${encryptedAttemptId}?n=${newEmail}`;

    await this.send(
      newEmail,
      this.configService.get('mailer.templates.updateUserEmail'),
      {
        verification_url: verificationUrl,
      },
    );
  }

  async sendAutoAccountUnblockEmail(email: User['email'], url: string) {
    const context = {
      email,
      unblock_url: url,
    };
    await this.send(
      email,
      this.configService.get('mailer.templates.unblockAccountEmail'),
      context,
    );
  }

  async sendVerifyAccountEmail(email: User['email'], url: string) {
    const context = {
      verification_url: url,
    };
    await this.send(
      email,
      this.configService.get('mailer.templates.verifyAccountEmail'),
      context,
    );
  }

  async sendDriveInactiveUsersEmail(email: string): Promise<void> {
    await this.send(
      email,
      this.configService.get('mailer.templates.driveInactiveUsers'),
      {},
    );
  }

  async sendFailedPaymentEmail(userEmail: User['email']): Promise<void> {
    await this.send(
      userEmail,
      this.configService.get('mailer.templates.failedPayments'),
      {},
    );
  }

  async sendFirstUploadEmail(userEmail: User['email']): Promise<void> {
    await this.send(
      userEmail,
      this.configService.get('mailer.templates.firstUpload'),
      {},
    );
  }

  async sendIncompleteCheckoutEmail(
    email: string,
    completeCheckoutUrl: string,
  ): Promise<void> {
    const context = {
      complete_checkout_url: completeCheckoutUrl,
    };

    await this.send(
      email,
      this.configService.get('mailer.templates.incompleteCheckout'),
      context,
    );
  }

  async sendFullStorageEmail(userEmail: User['email']): Promise<void> {
    await this.send(
      userEmail,
      this.configService.get('mailer.templates.fullStorage'),
      {},
    );
  }
}
