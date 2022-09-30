import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment } from '@internxt/inxt-js';
import { v4 } from 'uuid';

import { SequelizeUserRepository } from './user.repository';
import {
  ReferralAttributes,
  ReferralKey,
  UserAttributes,
  UserReferralAttributes,
} from './user.domain';
import { CryptoService } from '../../externals/crypto/crypto';
import { FolderUseCases } from '../folder/folder.usecase';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { InvitationAcceptedEvent } from '../../externals/notifications/events/invitation-accepted.event';
import { NotificationService } from '../../externals/notifications/notification.service';
import { Sign } from '../../middlewares/passport';
import { SequelizeSharedWorkspaceRepository } from '../../shared-workspace/shared-workspace.repository';
import { SequelizeReferralRepository } from './referrals.repository';
import { SequelizeUserReferralsRepository } from './user-referrals.repository';
import { ReferralRedeemedEvent } from '../../externals/notifications/events/referral-redeemed.event';
import { PaymentsService } from '../../externals/payments/payments.service';
import { NewsletterService } from 'src/externals/newsletter';

class ReferralsNotAvailableError extends Error {
  constructor() {
    super('Referrals program not available for this user');
  }
}

export class InvalidReferralCodeError extends Error {
  constructor() {
    super('The referral code used is not correct');

    Object.setPrototypeOf(this, InvalidReferralCodeError.prototype);
  }
}

export class UserAlreadyRegisteredError extends Error {
  constructor(email: string) {
    super(`User ${email || ''} is already registered`);

    Object.setPrototypeOf(this, UserAlreadyRegisteredError.prototype);
  }
}

@Injectable()
export class UserUseCases {
  constructor(
    private userRepository: SequelizeUserRepository,
    private sharedWorkspaceRepository: SequelizeSharedWorkspaceRepository,
    private referralsRepository: SequelizeReferralRepository,
    private userReferralsRepository: SequelizeUserReferralsRepository,
    private folderUseCases: FolderUseCases,
    private configService: ConfigService,
    private cryptoService: CryptoService,
    private networkService: BridgeService,
    private notificationService: NotificationService,
    private readonly paymentsService: PaymentsService,
    private readonly newsletterService: NewsletterService,
  ) {}

  getUserByUsername(email: string) {
    return this.userRepository.findByUsername(email);
  }

  getWorkspaceMembersByBrigeUser(bridgeUser: string) {
    return this.userRepository.findAllBy({ bridgeUser });
  }

  async getNetworkByUserId(id: number, mnemonic: string) {
    const user = await this.userRepository.findById(id);
    return new Environment({
      bridgePass: user.userId,
      bridgeUser: user.bridgeUser,
      encryptionKey: mnemonic,
      bridgeUrl: this.configService.get('apis.storage.url'),
    });
  }

  async applyReferral(
    userId: UserAttributes['id'],
    referralKey: ReferralAttributes['key'],
    referred?: UserReferralAttributes['referred'],
  ): Promise<void> {
    const referral = await this.referralsRepository.findOne({
      key: referralKey,
    });

    if (!referral) {
      throw new Error('Referral not found');
    }

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }
    const userReferral = await this.userReferralsRepository.findOneWhere({
      userId,
      referralId: referral.id,
      applied: false,
    });

    if (!userReferral) {
      return;
    }
    const userHasReferralsProgram = await this.hasReferralsProgram(
      user.email,
      user.bridgeUser,
      user.userId,
    );
    if (!userHasReferralsProgram) {
      throw new ReferralsNotAvailableError();
    }

    await this.userReferralsRepository.updateReferralById(userReferral.id, {
      applied: true,
      referred,
    });

    await this.redeemUserReferral(
      user.uuid,
      user.userId,
      referral.type,
      referral.credit,
    );

    this.notificationService.add(
      new ReferralRedeemedEvent(user.uuid, referral.key),
    );
  }

  async redeemUserReferral(
    uuid: UserAttributes['uuid'],
    userId: UserAttributes['userId'],
    type: ReferralAttributes['type'],
    credit: ReferralAttributes['credit'],
  ): Promise<void> {
    const { GATEWAY_USER, GATEWAY_PASS } = process.env;

    if (type === 'storage') {
      if (GATEWAY_USER && GATEWAY_PASS) {
        await this.networkService.addStorage(uuid, credit);
      } else {
        console.warn(
          '(usersReferralsService.redeemUserReferral) GATEWAY_USER\
           || GATEWAY_PASS not found. Skipping storage increasing',
        );
      }
    }

    console.info(
      `(usersReferralsService.redeemUserReferral)\
       The user '${uuid}' (id: ${userId}) has redeemed a referral: ${type} - ${credit}`,
    );
  }

  async createUser(
    newUser: Pick<
      UserAttributes,
      'email' | 'name' | 'lastname' | 'mnemonic' | 'password'
    > & {
      salt: string;
      referrer?: UserAttributes['referrer'];
      registerCompleted?: UserAttributes['registerCompleted'];
    },
  ) {
    const { email, password, salt } = newUser;

    const hasReferrer = !!newUser.referrer;
    const referrer = hasReferrer
      ? await this.userRepository.findByReferralCode(newUser.referrer)
      : null;

    if (hasReferrer && !referrer) {
      throw new InvalidReferralCodeError();
    }

    const userPass = this.cryptoService.decryptText(password);
    const userSalt = this.cryptoService.decryptText(salt);

    const transaction = await this.userRepository.createTransaction();

    try {
      const [userResult, isNewRecord] = await this.userRepository.findOrCreate({
        where: { username: email },
        defaults: {
          email: email,
          name: newUser.name,
          lastname: newUser.lastname,
          password: userPass,
          mnemonic: newUser.mnemonic,
          hKey: userSalt,
          referrer: newUser.referrer,
          referralCode: v4(),
          uuid: null,
          credit: 0,
          welcomePack: true,
          registerCompleted: newUser.registerCompleted,
          username: newUser.email,
          bridgeUser: newUser.email,
        },
        transaction,
      });

      if (!isNewRecord) {
        throw new UserAlreadyRegisteredError(newUser.email);
      }

      const { userId, uuid: userUuid } = await this.networkService.createUser(
        email,
      );

      await this.userRepository.updateById(
        userResult.id,
        { userId, uuid: userUuid },
        transaction,
      );

      if (hasReferrer) {
        const event = new InvitationAcceptedEvent(
          'invitation.accepted',
          userUuid,
          referrer.uuid,
          referrer.email,
          {},
        );

        this.notificationService.add(event);
        await this.sharedWorkspaceRepository.updateByHostAndGuest(
          referrer.id,
          email,
        );

        await this.applyReferral(referrer.id, ReferralKey.InviteFriends);
      }

      const token = Sign(newUser.email, this.configService.get('secrets.jwt'));
      const bucket = await this.networkService.createBucket(email, userId);
      const rootFolderName = await this.cryptoService.encryptName(
        `${bucket.name}`,
      );
      const rootFolder = await this.folderUseCases.createRootFolder(
        userResult,
        rootFolderName,
        bucket.id,
      );

      await transaction.commit();
      await this.createUserReferrals(userResult.id);
      await this.userRepository.updateById(userResult.id, {
        rootFolderId: rootFolder.id,
      });
      await Promise.all([
        this.folderUseCases.createFolder(userResult, 'Family', rootFolder.id),
        this.folderUseCases.createFolder(userResult, 'Personal', rootFolder.id),
      ]);

      await this.newsletterService.subscribe(userResult.email);

      return {
        token,
        user: {
          ...userResult.toJSON(),
          hKey: userResult.hKey.toString(),
          password: userResult.password.toString(),
          mnemonic: userResult.mnemonic.toString(),
          rootFolderId: rootFolder.id,
          bucket: bucket.id,
          uuid: userUuid,
          userId,
          hasReferralsProgram: await this.hasReferralsProgram(
            userResult.email,
            userResult.bridgeUser,
            userId,
          ),
        },
        uuid: userUuid,
      };
    } catch (err) {
      await transaction.rollback().catch((err) => {
        new Logger().error(`[USER/CREATE]: ${err.message}. ${err?.stack}`);
      });

      throw err;
    }
  }

  async createUserReferrals(userId: UserAttributes['id']): Promise<void> {
    const referrals = await this.referralsRepository.findAll({ enabled: true });
    const userReferralsToCreate: Omit<
      UserReferralAttributes,
      'id' | 'startDate'
    >[] = [];

    referrals.forEach((referral) => {
      Array(referral.steps)
        .fill(null)
        .forEach(() => {
          const applied = referral.key === ReferralKey.CreateAccount;
          userReferralsToCreate.push({
            userId,
            referralId: referral.id,
            applied,
            referred: '',
          });
        });
    });

    await this.userReferralsRepository.bulkCreate(userReferralsToCreate);
  }

  async hasUserBeenSubscribedAnyTime(
    email: UserAttributes['email'],
    networkUser: UserAttributes['bridgeUser'],
    networkPass: UserAttributes['userId'],
  ): Promise<boolean> {
    const MAX_FREE_PLAN_BYTES = 10737418240;
    const hasSubscriptions = await this.paymentsService.hasSubscriptions(email);
    const maxSpaceBytes = await this.networkService.getLimit(
      networkUser,
      networkPass,
    );
    const isLifetime = maxSpaceBytes > MAX_FREE_PLAN_BYTES;

    return hasSubscriptions || isLifetime;
  }

  async hasReferralsProgram(
    userEmail: UserAttributes['email'],
    networkUser: UserAttributes['bridgeUser'],
    networkPass: UserAttributes['userId'],
  ): Promise<boolean> {
    const hasBeenSubscribed = await this.hasUserBeenSubscribedAnyTime(
      userEmail,
      networkUser,
      networkPass,
    );

    return !hasBeenSubscribed;
  }
}
