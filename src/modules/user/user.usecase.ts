import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment } from '@internxt/inxt-js';
import { v4 } from 'uuid';
import { generateMnemonic } from 'bip39';

import { SequelizeUserRepository } from './user.repository';
import {
  AccountTokenAction,
  ReferralAttributes,
  ReferralKey,
  User,
  UserReferralAttributes,
} from './user.domain';
import { UserAttributes } from './user.attributes';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { FolderUseCases } from '../folder/folder.usecase';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { InvitationAcceptedEvent } from '../../externals/notifications/events/invitation-accepted.event';
import { NotificationService } from '../../externals/notifications/notification.service';
import {
  Sign,
  SignEmail,
  SignWithCustomDuration,
} from '../../middlewares/passport';
import { SequelizeSharedWorkspaceRepository } from '../../shared-workspace/shared-workspace.repository';
import { SequelizeReferralRepository } from './referrals.repository';
import { SequelizeUserReferralsRepository } from './user-referrals.repository';
import { ReferralRedeemedEvent } from '../../externals/notifications/events/referral-redeemed.event';
import { PaymentsService } from '../../externals/payments/payments.service';
import { NewsletterService } from '../../externals/newsletter';
import { MailerService } from '../../externals/mailer/mailer.service';
import { Folder } from '../folder/folder.domain';
import { SignUpErrorEvent } from '../../externals/notifications/events/sign-up-error.event';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { FileUseCases } from '../file/file.usecase';
import { SequelizeKeyServerRepository } from '../keyserver/key-server.repository';
import { ShareUseCases } from '../share/share.usecase';
import { AvatarService } from '../../externals/avatar/avatar.service';
import { SequelizePreCreatedUsersRepository } from './pre-created-users.repository';
import { PreCreateUserDto } from './dto/pre-create-user.dto';
import {
  decryptMessageWithPrivateKey,
  encryptMessageWithPublicKey,
  generateNewKeys,
} from '../../lib/openpgp';
import { aes } from '@internxt/lib';
import { PreCreatedUserAttributes } from './pre-created-users.attributes';
import { PreCreatedUser } from './pre-created-user.domain';
import { SequelizeSharingRepository } from '../sharing/sharing.repository';
import { SequelizeAttemptChangeEmailRepository } from './attempt-change-email.repository';
import { AttemptChangeEmailAlreadyVerifiedException } from './exception/attempt-change-email-already-verified.exception';
import { AttemptChangeEmailHasExpiredException } from './exception/attempt-change-email-has-expired.exception';
import { AttemptChangeEmailNotFoundException } from './exception/attempt-change-email-not-found.exception';
import { UserEmailAlreadyInUseException } from './exception/user-email-already-in-use.exception';
import { UserNotFoundException } from './exception/user-not-found.exception';
import { getTokenDefaultIat } from '../../lib/jwt';
import { MailTypes } from '../security/mail-limit/mailTypes';
import { SequelizeMailLimitRepository } from '../security/mail-limit/mail-limit.repository';
import { Time } from '../../lib/time';
import { SequelizeFeatureLimitsRepository } from '../feature-limit/feature-limit.repository';

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

export class KeyServerNotFoundError extends Error {
  constructor() {
    super('Key server not found');

    Object.setPrototypeOf(this, KeyServerNotFoundError.prototype);
  }
}
export class UserNotFoundError extends Error {
  constructor() {
    super('User not found');
    Object.setPrototypeOf(this, UserNotFoundError.prototype);
  }
}

export class MailLimitReachedException extends HttpException {
  constructor() {
    super('Mail Limit reached', HttpStatus.TOO_MANY_REQUESTS);
  }
}

type NewUser = Pick<
  UserAttributes,
  'email' | 'name' | 'lastname' | 'mnemonic' | 'password'
> & {
  salt: string;
  referrer?: UserAttributes['referrer'];
  registerCompleted?: UserAttributes['registerCompleted'];
};

@Injectable()
export class UserUseCases {
  constructor(
    private userRepository: SequelizeUserRepository,
    private preCreatedUserRepository: SequelizePreCreatedUsersRepository,
    private sharedWorkspaceRepository: SequelizeSharedWorkspaceRepository,
    private referralsRepository: SequelizeReferralRepository,
    private userReferralsRepository: SequelizeUserReferralsRepository,
    private readonly attemptChangeEmailRepository: SequelizeAttemptChangeEmailRepository,
    private sharingRepository: SequelizeSharingRepository,
    @Inject(forwardRef(() => FileUseCases))
    private fileUseCases: FileUseCases,
    @Inject(forwardRef(() => FolderUseCases))
    private folderUseCases: FolderUseCases,
    private shareUseCases: ShareUseCases,
    private configService: ConfigService,
    private cryptoService: CryptoService,
    private networkService: BridgeService,
    private notificationService: NotificationService,
    private readonly paymentsService: PaymentsService,
    private readonly keyServerRepository: SequelizeKeyServerRepository,
    private readonly avatarService: AvatarService,
    private readonly mailerService: MailerService,
    private readonly mailLimitRepository: SequelizeMailLimitRepository,
    private readonly featureLimitRepository: SequelizeFeatureLimitsRepository,
  ) {}

  findByEmail(email: User['email']): Promise<User | null> {
    return this.userRepository.findByUsername(email);
  }

  findPreCreatedByEmail(
    email: PreCreatedUserAttributes['email'],
  ): Promise<PreCreatedUser | null> {
    return this.preCreatedUserRepository.findByUsername(email);
  }

  findByUuids(uuids: User['uuid'][]): Promise<User[]> {
    return this.userRepository.findByUuids(uuids);
  }
  findById(id: User['id']): Promise<User | null> {
    return this.userRepository.findById(id);
  }

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

  /**
   * Creates root and default initial folders and relates them to the user
   * @param user Owner of the folders
   * @param bucketId Network bucket
   * @returns Created folders
   */
  private async createInitialFolders(
    user: User,
    bucketId: string,
  ): Promise<[Folder, Folder, Folder]> {
    const rootFolderName = this.cryptoService.encryptName(`${v4()}`);

    const rootFolder = await this.folderUseCases.createRootFolder(
      user,
      rootFolderName,
      bucketId,
    );

    const [, [familyFolder, personalFolder]] = await Promise.all([
      // Relate the root folder to the user
      this.userRepository.updateById(user.id, { rootFolderId: rootFolder.id }),
      this.folderUseCases.createFolders(user, [
        { name: 'Family', parentFolderId: rootFolder.id },
        { name: 'Personal', parentFolderId: rootFolder.id },
      ]),
    ]);

    return [rootFolder, familyFolder, personalFolder];
  }

  /**
   * Applies a referral if the user referrer exists
   * @param referredUuid Uuid of the user that has been referred
   * @param referredEmail Email of the user that has been referred
   * @param referralCode Referral code of the user that has referred
   */
  async applyReferralIfHasReferrer(
    referredUuid: UserAttributes['uuid'],
    referredEmail: UserAttributes['email'],
    referralCode: UserAttributes['referralCode'],
  ): Promise<void> {
    const referrer = await this.userRepository.findByReferralCode(referralCode);

    if (!referrer) {
      throw new InvalidReferralCodeError();
    }

    this.notificationService.add(
      new InvitationAcceptedEvent(
        'invitation.accepted',
        referredUuid,
        referrer.uuid,
        referrer.email,
        {},
      ),
    );

    // TODO: Move this to EventBus
    await this.invitationAccepted(referrer.id, {
      email: referredEmail,
      uuid: referredUuid,
    });
  }

  async createUser(newUser: NewUser) {
    const { email, password, salt } = newUser;

    const maybeExistentUser = await this.userRepository.findByUsername(email);
    const userAlreadyExists = !!maybeExistentUser;

    if (userAlreadyExists) {
      throw new UserAlreadyRegisteredError(newUser.email);
    }

    const userPass = this.cryptoService.decryptText(password);

    const userSalt = this.cryptoService.decryptText(salt);

    const { userId: networkPass, uuid: userUuid } =
      await this.networkService.createUser(email);

    const notifySignUpError = (err: Error) =>
      this.notificationService.add(
        new SignUpErrorEvent({ email, uuid: userUuid }, err),
      );

    const hasBeenSubscribedPromise = this.hasUserBeenSubscribedAnyTime(
      email,
      email,
      networkPass,
    ).catch((err) => {
      Logger.error(
        `[SIGNUP/SUBSCRIPTION/ERROR]: ${err.message}. ${
          err.stack || 'NO STACK'
        }`,
      );
      notifySignUpError(err);
      return false;
    });

    const freeTier = await this.featureLimitRepository.getFreeTier();

    const user = await this.userRepository.create({
      email,
      name: newUser.name,
      lastname: newUser.lastname,
      password: userPass,
      hKey: userSalt,
      referrer: newUser.referrer,
      referralCode: v4(),
      uuid: userUuid,
      userId: networkPass,
      credit: 0,
      welcomePack: true,
      registerCompleted: newUser.registerCompleted,
      username: email,
      bridgeUser: email,
      mnemonic: newUser.mnemonic,
      tierId: freeTier?.id,
    });

    try {
      const bucket = await this.networkService.createBucket(email, networkPass);
      const [rootFolder] = await this.createInitialFolders(user, bucket.id);

      const hasReferrer = !!newUser.referrer;
      if (hasReferrer) {
        this.applyReferralIfHasReferrer(
          userUuid,
          email,
          newUser.referrer,
        ).catch(notifySignUpError);
      }

      let hasBeenSubscribed = false;
      try {
        hasBeenSubscribed = await hasBeenSubscribedPromise;

        if (!hasBeenSubscribed) {
          await this.createUserReferrals(user.id);
        }
      } catch (err) {
        notifySignUpError(err);
      }

      const newTokenPayload = this.getNewTokenPayload(user);

      return {
        token: SignEmail(newUser.email, this.configService.get('secrets.jwt')),
        newToken: Sign(newTokenPayload, this.configService.get('secrets.jwt')),
        user: {
          ...user.toJSON(),
          hKey: user.hKey.toString(),
          password: user.password.toString(),
          mnemonic: user.mnemonic.toString(),
          rootFolderId: rootFolder.id,
          bucket: bucket.id,
          uuid: userUuid,
          userId: networkPass,
          hasReferralsProgram: !hasBeenSubscribed,
        } as unknown as User,
        uuid: userUuid,
      };
    } catch (err) {
      Logger.error(
        `[SIGNUP/ROOT_FOLDER/ERROR]: ${err.message}. ${
          err.stack || 'NO STACK'
        }`,
      );
      notifySignUpError(err);

      throw err;
    }
  }

  async replacePreCreatedUser(
    email: string,
    newUserUuid: string,
    newPublicKey: string,
  ) {
    const preCreatedUser =
      await this.preCreatedUserRepository.findByUsername(email);

    if (!preCreatedUser) {
      return;
    }

    const defaultPass = this.configService.get('users.preCreatedPassword');
    const { privateKey: encPrivateKey } = preCreatedUser;
    const privateKey = aes.decrypt(encPrivateKey, defaultPass);

    const invites = await this.sharingRepository.getInvitesBySharedwith(
      preCreatedUser.uuid,
    );

    for (const invite of invites) {
      const decryptedEncryptionKey = await decryptMessageWithPrivateKey({
        encryptedMessage: Buffer.from(invite.encryptionKey, 'base64').toString(
          'binary',
        ),
        privateKeyInBase64: privateKey,
      });

      const newEncryptedEncryptionKey = await encryptMessageWithPublicKey({
        message: decryptedEncryptionKey.toString(),
        publicKeyInBase64: newPublicKey,
      });

      invite.encryptionKey = Buffer.from(
        newEncryptedEncryptionKey.toString(),
        'binary',
      ).toString('base64');

      invite.sharedWith = newUserUuid;
    }

    await this.sharingRepository.bulkUpdate(invites);

    await this.preCreatedUserRepository.deleteByUuid(preCreatedUser.uuid);
  }

  async preCreateUser(newUser: PreCreateUserDto) {
    const { email } = newUser;

    const [existentUser, preCreatedUser] = await Promise.all([
      this.userRepository.findByUsername(email),
      this.preCreatedUserRepository.findByUsername(email),
    ]);

    if (existentUser) {
      throw new UserAlreadyRegisteredError(newUser.email);
    }

    if (preCreatedUser) {
      return {
        ...preCreatedUser.toJSON(),
        publicKey: preCreatedUser.publicKey.toString(),
        password: preCreatedUser.password.toString(),
      };
    }

    const defaultPass = this.configService.get('users.preCreatedPassword');
    const hashObj = this.cryptoService.passToHash(defaultPass);

    const mnemonic = generateMnemonic(256);
    const encMnemonic = this.cryptoService.encryptTextWithKey(
      mnemonic,
      defaultPass,
    );

    const keysCreationDate = new Date();
    keysCreationDate.setHours(keysCreationDate.getHours() - 1);

    const { privateKeyArmored, publicKeyArmored, revocationCertificate } =
      await generateNewKeys(keysCreationDate);

    const encPrivateKey = aes.encrypt(privateKeyArmored, defaultPass, {
      iv: this.configService.get('secrets.magicIv'),
      salt: this.configService.get('secrets.magicSalt'),
    });

    const user = await this.preCreatedUserRepository.create({
      email,
      uuid: v4(),
      password: hashObj.hash,
      hKey: Buffer.from(hashObj.salt),
      username: email,
      mnemonic: encMnemonic,
      publicKey: publicKeyArmored,
      privateKey: encPrivateKey,
      revocationKey: revocationCertificate,
      encryptVersion: null,
    });

    return {
      ...user.toJSON(),
      publicKey: user.publicKey.toString(),
      password: user.password.toString(),
    };
  }

  getNewTokenPayload(userData: any) {
    return {
      payload: {
        uuid: userData.uuid,
        email: userData.email,
        name: userData.name,
        lastname: userData.lastname,
        username: userData.username,
        sharedWorkspace: true,
        networkCredentials: {
          user: userData.bridgeUser,
          pass: userData.userId,
        },
      },
      iat: getTokenDefaultIat(),
    };
  }

  async invitationAccepted(
    referrerId: User['id'],
    referred: { email: string; uuid: string },
  ): Promise<void> {
    await this.sharedWorkspaceRepository.updateByHostAndGuest(
      referrerId,
      referred.email,
    );

    await this.applyReferral(
      referrerId,
      ReferralKey.InviteFriends,
      referred.uuid,
    );
  }

  async getUser(uuid: User['uuid']): Promise<User> {
    const user = await this.userRepository.findByUuid(uuid);

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  async sendWelcomeVerifyEmailEmail(email, { userUuid }) {
    const secret = this.configService.get('secrets.jwt');
    const verificationToken = this.cryptoService.encrypt(
      userUuid,
      Buffer.from(secret),
    );

    const verificationTokenEncoded = encodeURIComponent(verificationToken);

    const url = `${process.env.HOST_DRIVE_WEB}/verify-email/${verificationTokenEncoded}`;
    const verifyAccountTemplateId = this.configService.get(
      'mailer.templates.welcomeVerifyEmail',
    );

    return this.mailerService.send(email, verifyAccountTemplateId, {
      verification_url: url,
      email_support: 'mailto:hello@internxt.com',
    });
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
    const [hasSubscriptions, maxSpaceBytes] = await Promise.all([
      this.paymentsService.hasSubscriptions(email),
      this.networkService.getLimit(networkUser, networkPass),
    ]);

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

  getAuthTokens(user: User): { token: string; newToken: string } {
    const expires = true;
    const token = SignEmail(
      user.email,
      this.configService.get('secrets.jwt'),
      expires,
    );
    const newToken = Sign(
      {
        payload: {
          uuid: user.uuid,
          email: user.email,
          name: user.name,
          lastname: user.lastname,
          username: user.username,
          sharedWorkspace: true,
          networkCredentials: {
            user: user.bridgeUser,
            pass: user.userId,
          },
        },
      },
      this.configService.get('secrets.jwt'),
      expires,
    );

    return { token, newToken };
  }

  async sendAccountRecoveryEmail(email: User['email']) {
    const secret = this.configService.get('secrets.jwt');

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const recoverAccountToken = SignWithCustomDuration(
      {
        payload: {
          uuid: user.uuid,
          action: 'recover-account',
        },
      },
      secret,
      '30m',
    );

    const url = `${process.env.HOST_DRIVE_WEB}/recover-account/${recoverAccountToken}`;
    const recoverAccountTemplateId = this.configService.get(
      'mailer.templates.recoverAccountEmail',
    );

    return this.mailerService.send(user.email, recoverAccountTemplateId, {
      email,
      recovery_url: url,
    });
  }

  async sendAccountUnblockEmail(email: User['email']): Promise<void> {
    const secret = this.configService.get('secrets.jwt');
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      return;
    }

    const [mailLimit] = await this.mailLimitRepository.findOrCreate(
      { userId: user.id, mailType: MailTypes.UnblockAccount },
      {
        attemptsCount: 0,
        attemptsLimit: 5,
      },
    );

    if (mailLimit.isLimitForTodayReached()) {
      throw new MailLimitReachedException();
    }

    const defaultIat = getTokenDefaultIat();
    const unblockAccountToken = SignWithCustomDuration(
      {
        payload: {
          uuid: user.uuid,
          email: user.email,
          action: AccountTokenAction.Unblock,
        },
        iat: defaultIat,
      },
      secret,
      '48h',
    );

    const driveWebUrl = this.configService.get('clients.drive.web');
    const url = `${driveWebUrl}/blocked-account/${unblockAccountToken}`;
    await this.mailerService.sendAutoAccountUnblockEmail(user.email, url);

    const lastMailSentDate = Time.convertTimestampToDate(defaultIat);
    mailLimit.increaseTodayAttemps(lastMailSentDate);

    await this.mailLimitRepository.updateByUserIdAndMailType(
      user.id,
      MailTypes.UnblockAccount,
      mailLimit,
    );
  }

  async unblockAccount(
    userUuid: User['uuid'],
    tokenIat: number,
  ): Promise<void> {
    const user = await this.userRepository.findByUuid(userUuid);

    if (!user) {
      throw new BadRequestException();
    }

    const mailLimit = await this.mailLimitRepository.findByUserIdAndMailType(
      user.id,
      MailTypes.UnblockAccount,
    );

    const tokenIssuedAtDate = Time.convertTimestampToDate(tokenIat);

    if (
      mailLimit.lastMailSent > tokenIssuedAtDate ||
      user.lastPasswordChangedAt > tokenIssuedAtDate
    ) {
      throw new ForbiddenException();
    }

    await this.userRepository.updateByUuid(userUuid, {
      errorLoginCount: 0,
      lastPasswordChangedAt: new Date(),
    });
  }

  async updateCredentials(
    userUuid: User['uuid'],
    newCredentials: {
      mnemonic: string;
      password: string;
      salt: string;
      privateKey?: string;
    },
    withReset = false,
  ): Promise<void> {
    const { mnemonic, password, salt } = newCredentials;

    await this.userRepository.updateByUuid(userUuid, {
      mnemonic,
      password: this.cryptoService.decryptText(password),
      hKey: this.cryptoService.decryptText(salt),
    });

    const user = await this.userRepository.findByUuid(userUuid);

    if (withReset) {
      await this.resetUser(user, {
        deleteFiles: true,
        deleteFolders: true,
        deleteShares: true,
      });
    }

    // TODO: Replace with updating the private key once AFS is ready.
    // Requires to send the private key encrypted with the user's password
    await this.keyServerRepository.deleteByUserId(user.id);
  }

  async resetUser(
    user: User,
    options: {
      deleteFiles: boolean;
      deleteFolders: boolean;
      deleteShares: boolean;
    },
  ): Promise<void> {
    if (options.deleteShares) {
      await this.shareUseCases.deleteByUser(user);
    }

    if (options.deleteFolders) {
      let done = false;
      const limit = 50;
      let offset = 0;

      do {
        const opts = { limit, offset };
        const folders = await this.folderUseCases.getFolders(
          user.id,
          { parentId: user.rootFolderId, removed: false },
          opts,
        );

        await this.folderUseCases.deleteByUser(user, folders);

        offset += folders.length;

        done = folders.length < limit || folders.length === 0;
      } while (!done);
    }

    if (options.deleteFiles) {
      let done = false;
      const limit = 50;
      let offset = 0;

      do {
        const opts = { limit, offset };
        const files = await this.fileUseCases.getFilesNotDeleted(
          user.id,
          {
            folderId: user.rootFolderId,
          },
          opts,
        );

        await this.fileUseCases.deleteByUser(user, files);

        offset += files.length;

        done = files.length < limit || files.length === 0;
      } while (!done);
    }
  }

  async updatePassword(
    user: User,
    updatePasswordDto: UpdatePasswordDto,
  ): Promise<void> {
    const { newPassword, newSalt, mnemonic, privateKey } = updatePasswordDto;

    await this.userRepository.updateById(user.id, {
      password: newPassword,
      hKey: Buffer.from(newSalt),
      mnemonic,
    });

    await this.keyServerRepository.findUserKeysOrCreate(user.id, {
      userId: user.id,
      privateKey: privateKey,
      encryptVersion: updatePasswordDto.encryptVersion,
    });

    await this.keyServerRepository.update(user.id, {
      privateKey,
    });
  }

  async getAvatarUrl(avatarKey: string) {
    if (!avatarKey) return null;

    return this.avatarService.getDownloadUrl(avatarKey);
  }

  async changeUserEmailById(userUuid: string, newEmail: string) {
    const user = await this.userRepository.findByUuid(userUuid);

    if (!user) {
      throw new UserNotFoundException();
    }

    const maybeAlreadyExistentUser =
      await this.userRepository.findByUsername(newEmail);

    const userAlreadyExists = !!maybeAlreadyExistentUser;

    if (userAlreadyExists) {
      throw new UserEmailAlreadyInUseException(newEmail);
    }

    const { uuid, email } = user;

    try {
      const payload = {
        email: newEmail,
        username: newEmail,
      };

      const isGuestOnSharedWorkspace = user.isGuestOnSharedWorkspace();

      if (!isGuestOnSharedWorkspace) {
        await this.networkService.updateUserEmail(uuid, newEmail);
        payload['bridgeUser'] = newEmail;
      } else {
        await this.sharedWorkspaceRepository.updateGuestEmail(email, newEmail);
      }

      if (user.sharedWorkspace) {
        await this.userRepository.updateBy(
          { bridgeUser: email },
          { bridgeUser: newEmail },
        );
      }

      await this.userRepository.updateByUuid(user.uuid, payload);
    } catch (error) {
      Logger.error(`[CHANGE-EMAIL/ERROR]: ${JSON.stringify(error)}.`);

      await this.networkService.updateUserEmail(uuid, email);

      throw error;
    }

    return {
      oldEmail: user.email,
      newEmail: newEmail,
    };
  }

  async createAttemptChangeEmail(user: User, newEmail: string): Promise<void> {
    const maybeAlreadyExistentUser =
      await this.userRepository.findByUsername(newEmail);

    const userAlreadyExists = !!maybeAlreadyExistentUser;

    if (userAlreadyExists) {
      throw new UserEmailAlreadyInUseException(newEmail);
    }

    const isTheSameEmail = user.email === newEmail;

    if (isTheSameEmail) {
      throw new BadRequestException('Requested the change to the same email');
    }

    const attempt = await this.attemptChangeEmailRepository.create({
      userUuid: user.uuid,
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

  async acceptAttemptChangeEmail(encryptedId: string) {
    const attemptChangeEmailId = parseInt(
      this.cryptoService.decryptText(encryptedId),
    );

    const attemptChangeEmail =
      await this.attemptChangeEmailRepository.getOneById(attemptChangeEmailId);

    if (!attemptChangeEmail) {
      throw new AttemptChangeEmailNotFoundException();
    }

    if (attemptChangeEmail.isExpired) {
      throw new AttemptChangeEmailHasExpiredException();
    }

    if (attemptChangeEmail.isVerified) {
      throw new AttemptChangeEmailAlreadyVerifiedException();
    }

    const emails = await this.changeUserEmailById(
      attemptChangeEmail.userUuid,
      attemptChangeEmail.newEmail,
    );
    await this.attemptChangeEmailRepository.acceptAttemptChangeEmail(
      attemptChangeEmailId,
    );

    const user = await this.userRepository.findByUuid(
      attemptChangeEmail.userUuid,
    );

    if (user.email !== emails.newEmail) {
      user.email = emails.newEmail;
      user.username = emails.newEmail;
    }

    const newTokenPayload = this.getNewTokenPayload(user);

    return {
      ...emails,
      newAuthentication: {
        token: SignEmail(user.email, this.configService.get('secrets.jwt')),
        newToken: Sign(newTokenPayload, this.configService.get('secrets.jwt')),
        user,
      },
    };
  }

  getMeetClosedBetaUsers() {
    return [];
  }
}
