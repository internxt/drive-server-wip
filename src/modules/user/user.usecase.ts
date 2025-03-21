import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment } from '@internxt/inxt-js';
import { v4 } from 'uuid';
import { generateMnemonic } from 'bip39';
import * as speakeasy from 'speakeasy';
import crypto from 'crypto';

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
import { SequelizeWorkspaceRepository } from '../workspaces/repositories/workspaces.repository';
import { UserNotificationTokens } from './user-notification-tokens.domain';
import { RegisterNotificationTokenDto } from './dto/register-notification-token.dto';
import { LoginAccessDto } from '../auth/dto/login-access.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { isUUID } from 'class-validator';
import { KeyServerUseCases } from '../keyserver/key-server.usecase';
import { UserKeysEncryptVersions } from '../keyserver/key-server.domain';
import { AppSumoUseCase } from '../app-sumo/app-sumo.usecase';
import { BackupUseCase } from '../backups/backup.usecase';
import { convertSizeToBytes } from '../../lib/convert-size-to-bytes';
import { CacheManagerService } from '../cache-manager/cache-manager.service';
import { AsymmetricEncryptionService } from '../../externals/asymmetric-encryption/asymmetric-encryption.service';
import {
  decryptMessageWithPrivateKey,
  encryptMessageWithPublicKey,
  generateNewKeys,
} from '../../externals/asymmetric-encryption/openpgp';

export class ReferralsNotAvailableError extends Error {
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

export class UserNotFoundError extends Error {
  constructor() {
    super('User not found');
    Object.setPrototypeOf(this, UserNotFoundError.prototype);
  }
}

export class MailLimitReachedException extends HttpException {
  constructor(customMessage?: string) {
    super(customMessage ?? 'Mail Limit reached', HttpStatus.TOO_MANY_REQUESTS);
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
    private workspaceRepository: SequelizeWorkspaceRepository,
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
    private readonly keyServerUseCases: KeyServerUseCases,
    private readonly appSumoUseCases: AppSumoUseCase,
    private readonly backupUseCases: BackupUseCase,
    private readonly cacheManager: CacheManagerService,
    private readonly asymmetricEncryptionService: AsymmetricEncryptionService,
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

  findPreCreatedUsersByUuids(
    uuids: PreCreatedUser['uuid'][],
  ): Promise<PreCreatedUser[]> {
    return this.preCreatedUserRepository.findByUuids(uuids);
  }

  findByUuid(uuid: User['uuid']): Promise<User> {
    return this.userRepository.findByUuid(uuid);
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

  updateByUuid(userUuid: User['uuid'], payload: Partial<User>) {
    return this.userRepository.updateByUuid(userUuid, payload);
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
  async createInitialFolders(
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
        {
          name: 'Family',
          parentFolderId: rootFolder.id,
          parentUuid: rootFolder.uuid,
        },
        {
          name: 'Personal',
          parentFolderId: rootFolder.id,
          parentUuid: rootFolder.uuid,
        },
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
    const { email: rawEmail, password, salt } = newUser;
    const email = rawEmail.toLowerCase();

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

    let rootFolder: Folder;

    try {
      const bucket = await this.networkService.createBucket(email, networkPass);
      const [createdRootFolder] = await this.createInitialFolders(
        user,
        bucket.id,
      );
      rootFolder = createdRootFolder;

      const hasReferrer = !!newUser.referrer;
      if (hasReferrer) {
        this.applyReferralIfHasReferrer(
          userUuid,
          email,
          newUser.referrer,
        ).catch(notifySignUpError);
      }

      const newTokenPayload = this.getNewTokenPayload(user);

      return {
        token: SignEmail(
          newUser.email,
          this.configService.get('secrets.jwt'),
          true,
        ),
        newToken: Sign(
          newTokenPayload,
          this.configService.get('secrets.jwt'),
          true,
        ),
        user: {
          ...user.toJSON(),
          hKey: user.hKey.toString(),
          password: user.password.toString(),
          mnemonic: user.mnemonic.toString(),
          rootFolderId: rootFolder.id,
          rootFolderUuid: rootFolder.uuid,
          bucket: bucket.id,
          uuid: userUuid,
          userId: networkPass,
          hasReferralsProgram: false,
        } as unknown as User & { rootFolderUuid: string },
        uuid: userUuid,
      };
    } catch (err) {
      const error = {
        message: err.message,
        stack: err.stack || 'NO STACK',
        body: newUser,
      };

      Logger.error(`[SIGNUP/ROOT_FOLDER/ERROR]: ${JSON.stringify(error)}`);
      notifySignUpError(err);

      if (user) {
        Logger.warn(
          `[SIGNUP/USER]: Rolling back user created ${user.uuid}, email: ${user.email}`,
        );
        await this.userRepository.deleteBy({ uuid: user.uuid });
        if (rootFolder) {
          await this.folderUseCases.deleteFolderPermanently(rootFolder, user);
        }
      }

      throw err;
    }
  }

  async replacePreCreatedUser(
    email: string,
    newUserUuid: string,
    newPublicKey: string,
    newPublicKyberKey?: string,
  ) {
    const preCreatedUser =
      await this.preCreatedUserRepository.findByUsername(email);

    if (!preCreatedUser) {
      return;
    }

    const defaultPass = this.configService.get('users.preCreatedPassword');
    const { privateKey: encPrivateKey, privateKyberKey: encPrivateKyberKey } =
      preCreatedUser;

    const privateKey = aes.decrypt(encPrivateKey, defaultPass);
    const privateKyberKey = aes.decrypt(encPrivateKyberKey, defaultPass);

    const invites = await this.sharingRepository.getInvitesBySharedwith(
      preCreatedUser.uuid,
    );

    for (const invite of invites) {
      const { encryptionKey } = invite;

      const decryptedEncryptionKey =
        await this.asymmetricEncryptionService.hybridDecryptMessageWithPrivateKey(
          {
            encryptedMessageInBase64: encryptionKey,
            privateKeyInBase64: privateKey,
            privateKyberKeyInBase64: privateKyberKey,
          },
        );

      const newEncryptedEncryptionKey =
        await this.asymmetricEncryptionService.hybridEncryptMessageWithPublicKey(
          {
            message: decryptedEncryptionKey.toString(),
            publicKeyInBase64: newPublicKey,
            publicKyberKeyBase64: newPublicKyberKey,
          },
        );

      invite.encryptionKey = newEncryptedEncryptionKey;

      invite.sharedWith = newUserUuid;
    }

    await this.sharingRepository.bulkUpdate(invites);

    await this.replacePreCreatedUserWorkspaceInvitations(
      preCreatedUser.uuid,
      newUserUuid,
      privateKey,
      newPublicKey,
    );

    await this.preCreatedUserRepository.deleteByUuid(preCreatedUser.uuid);
  }

  async replacePreCreatedUserWorkspaceInvitations(
    preCreatedUserUuid: PreCreatedUserAttributes['uuid'],
    newUserUuid: User['uuid'],
    privateKeyInBase64: string,
    newPublicKey: string,
  ) {
    const invitations = await this.workspaceRepository.findInvitesBy({
      invitedUser: preCreatedUserUuid,
    });

    if (invitations.length === 0) {
      return;
    }

    const invitationsUpdated = [...invitations];

    for (const invitation of invitationsUpdated) {
      const decryptedEncryptionKey = await decryptMessageWithPrivateKey({
        encryptedMessage: Buffer.from(
          invitation.encryptionKey,
          'base64',
        ).toString('binary'),
        privateKeyInBase64,
      });

      const newEncryptedEncryptionKey = await encryptMessageWithPublicKey({
        message: decryptedEncryptionKey.toString(),
        publicKeyInBase64: newPublicKey,
      });

      invitation.encryptionKey = Buffer.from(
        newEncryptedEncryptionKey.toString(),
        'binary',
      ).toString('base64');

      invitation.invitedUser = newUserUuid;
    }

    await this.workspaceRepository.bulkUpdateInvitesKeysAndUsers(
      invitationsUpdated,
    );
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
        publicKyberKey: preCreatedUser.publicKey,
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

    const kyberKeys =
      await this.asymmetricEncryptionService.generateKyberKeys();

    const encPrivateKyberKey = aes.encrypt(kyberKeys.privateKey, defaultPass, {
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
      privateKyberKey: encPrivateKyberKey,
      publicKyberKey: kyberKeys.publicKey,
      revocationKey: revocationCertificate,
      encryptVersion: UserKeysEncryptVersions.Ecc,
    });

    return {
      ...user.toJSON(),
      publicKey: user.publicKey.toString(),
      publicKyberKey: user.publicKyberKey,
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

  async canUserExpandStorage(user: User, additionalBytes = 0) {
    const MAX_STORAGE_BYTES = convertSizeToBytes(100, 'TB');

    const currentMaxSpaceBytes = await this.networkService.getLimit(
      user.bridgeUser,
      user.userId,
    );

    const expandableBytes = MAX_STORAGE_BYTES - currentMaxSpaceBytes;

    const canExpand =
      currentMaxSpaceBytes + additionalBytes <= MAX_STORAGE_BYTES;

    return { canExpand, currentMaxSpaceBytes, expandableBytes };
  }

  async updateUserStorage(user: User, maxSpaceBytes: number) {
    await this.networkService.setStorage(user.username, maxSpaceBytes);
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

  async getAuthTokens(
    user: User,
    customIat?: number,
  ): Promise<{ token: string; newToken: string }> {
    const availableWorkspaces =
      await this.workspaceRepository.findUserAvailableWorkspaces(user.uuid);

    const owners = [
      ...new Set(availableWorkspaces.map(({ workspace }) => workspace.ownerId)),
    ];

    const expires = true;
    const token = SignEmail(
      user.email,
      this.configService.get('secrets.jwt'),
      expires,
      customIat,
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
          workspaces: { owners },
        },
        ...(customIat ? { iat: customIat } : null),
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
    mailLimit.increaseTodayAttempts(lastMailSentDate);

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
    const { newPassword, newSalt, mnemonic, privateKey, privateKyberKey } =
      updatePasswordDto;

    const keysToUpdate: Partial<Record<UserKeysEncryptVersions, string>> = {
      ecc: privateKey,
      kyber: privateKyberKey,
    };

    const userKeys = await this.keyServerUseCases.findUserKeys(user.id);

    if (userKeys.kyber?.privateKey && !keysToUpdate.kyber) {
      throw new BadRequestException(
        'User has kyber keys, you need to send kyber keys to update user password',
      );
    }

    await this.userRepository.updateById(user.id, {
      password: newPassword,
      hKey: Buffer.from(newSalt),
      mnemonic,
      lastPasswordChangedAt: new Date(),
    });

    for (const [version, key] of Object.entries(keysToUpdate)) {
      if (key) {
        await this.keyServerUseCases.updateByUserAndEncryptVersion(
          user.id,
          version as UserKeysEncryptVersions,
          { privateKey: key },
        );
      }
    }
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
        token: SignEmail(
          user.email,
          this.configService.get('secrets.jwt'),
          true,
        ),
        newToken: Sign(
          newTokenPayload,
          this.configService.get('secrets.jwt'),
          true,
        ),
        user,
      },
    };
  }

  getMeetClosedBetaUsers() {
    return this.userRepository.getMeetClosedBetaUsers();
  }

  setRoomToBetaUser(room: string, user: User) {
    return this.userRepository.setRoomToBetaUser(room, user);
  }

  getBetaUserFromRoom(room: string) {
    return this.userRepository.getBetaUserFromRoom(room);
  }

  async registerUserNotificationToken(
    user: User,
    registerTokenDto: RegisterNotificationTokenDto,
  ): Promise<void> {
    const tokenCount = await this.userRepository.getNotificationTokenCount(
      user.uuid,
    );

    if (tokenCount >= 10) {
      throw new BadRequestException('Max token limit reached');
    }

    const tokenExists = await this.userRepository.getNotificationTokens(
      user.uuid,
      {
        token: registerTokenDto.token,
        type: registerTokenDto.type,
      },
    );

    if (tokenExists.length > 0) {
      throw new BadRequestException('Token already exists');
    }

    return this.userRepository.addNotificationToken(
      user.uuid,
      registerTokenDto.token,
      registerTokenDto.type,
    );
  }

  getUserNotificationTokens(user: User): Promise<UserNotificationTokens[]> {
    return this.userRepository.getNotificationTokens(user.uuid);
  }

  async loginAccess(
    loginAccessDto: Omit<
      LoginAccessDto,
      'privateKey' | 'publicKey' | 'revocateKey' | 'revocationKey'
    >,
  ) {
    const MAX_LOGIN_FAIL_ATTEMPTS = 10;

    const userData = await this.findByEmail(loginAccessDto.email.toLowerCase());

    if (!userData) {
      throw new UnauthorizedException('Wrong login credentials');
    }

    const loginAttemptsLimitReached =
      userData.errorLoginCount >= MAX_LOGIN_FAIL_ATTEMPTS;

    if (loginAttemptsLimitReached) {
      throw new ForbiddenException(
        'Your account has been blocked for security reasons. Please reach out to us',
      );
    }

    const hashedPass = this.cryptoService.decryptText(loginAccessDto.password);

    if (hashedPass !== userData.password.toString()) {
      await this.userRepository.loginFailed(userData, true);
      throw new UnauthorizedException('Wrong login credentials');
    }

    const twoFactorEnabled =
      userData.secret_2FA && userData.secret_2FA.length > 0;
    if (twoFactorEnabled) {
      const tfaResult = speakeasy.totp.verifyDelta({
        secret: userData.secret_2FA,
        token: loginAccessDto.tfa,
        encoding: 'base32',
        window: 2,
      });

      if (!tfaResult) {
        throw new UnauthorizedException('Wrong 2-factor auth code');
      }
    }
    const { token, newToken } = await this.getAuthTokens(userData);
    await this.userRepository.loginFailed(userData, false);

    this.updateByUuid(userData.uuid, { updatedAt: new Date() });

    const rootFolder = await this.getOrCreateUserRootFolderAndBucket(userData);

    const userBucket = rootFolder?.bucket;

    const newKeys = loginAccessDto?.keys;

    const keys = await this.keyServerUseCases.findUserKeys(userData.id);

    const shouldCreateEccKeys = !keys.ecc && newKeys?.ecc;

    const ecc = shouldCreateEccKeys
      ? await this.keyServerUseCases.findOrCreateKeysForUser(userData.id, {
          publicKey: newKeys.ecc.publicKey,
          privateKey: newKeys.ecc.privateKey,
          revocationKey: newKeys.ecc.revocationKey,
          encryptVersion: UserKeysEncryptVersions.Ecc,
        })
      : keys.ecc;

    const shouldCreateKyberKeys = !keys.kyber && newKeys?.kyber;

    const kyber = shouldCreateKyberKeys
      ? await this.keyServerUseCases.findOrCreateKeysForUser(userData.id, {
          publicKey: newKeys.kyber.publicKey,
          privateKey: newKeys.kyber.privateKey,
          encryptVersion: UserKeysEncryptVersions.Kyber,
        })
      : keys.kyber;

    const user = {
      email: userData.email,
      userId: userData.userId,
      mnemonic: userData.mnemonic.toString(),
      root_folder_id: rootFolder?.id,
      rootFolderId: rootFolder?.uuid,
      name: userData.name,
      lastname: userData.lastname,
      uuid: userData.uuid,
      credit: userData.credit,
      createdAt: userData.createdAt,
      privateKey: ecc?.privateKey || null,
      publicKey: ecc?.publicKey || null,
      revocateKey: ecc?.revocationKey || null,
      keys: {
        ecc: {
          privateKey: ecc?.privateKey || null,
          publicKey: ecc?.publicKey || null,
        },
        kyber: {
          privateKey: kyber?.privateKey || null,
          publicKey: kyber?.publicKey || null,
        },
      },
      bucket: userBucket,
      registerCompleted: userData.registerCompleted,
      teams: false,
      username: userData.username,
      bridgeUser: userData.bridgeUser,
      sharedWorkspace: userData.sharedWorkspace,
      appSumoDetails: null,
      hasReferralsProgram: false,
      backupsBucket: userData.backupsBucket,
      avatar: userData.avatar ? await this.getAvatarUrl(userData.avatar) : null,
      emailVerified: userData.emailVerified,
      lastPasswordChangedAt: userData.lastPasswordChangedAt,
    };

    return { user, token, userTeam: null, newToken };
  }

  async getOrCreateUserRootFolderAndBucket(user: User) {
    const rootFolder = await this.folderUseCases.getFolder(user.rootFolderId);

    if (rootFolder) {
      return rootFolder;
    }

    const bucket = await this.networkService.createBucket(
      user.username,
      user.userId,
    );
    const [newRootFolder] = await this.createInitialFolders(user, bucket.id);

    return newRootFolder;
  }

  areCredentialsCorrect(user: User, hashedPassword: User['password']) {
    if (!hashedPassword) {
      throw new BadRequestException('Hashed password needed');
    }

    if (user.password.toString() !== hashedPassword) {
      throw new UnauthorizedException('Wrong credentials');
    }

    return true;
  }

  async verifyUserEmail(verificationToken: string) {
    const secret = this.configService.get('secrets.jwt');

    let userUuid: string;

    try {
      userUuid = this.cryptoService.decryptText(verificationToken, secret);

      if (!isUUID(userUuid)) {
        throw new Error('Token without valid user uuid');
      }
    } catch (err) {
      Logger.error(
        `[AUTH/EMAIL_VERIFICATION] Error while validating verificationToken: ${err.message}`,
      );
      throw new BadRequestException(
        `Could not verify this verificationToken: "${verificationToken}"`,
      );
    }

    await this.userRepository.updateByUuid(userUuid, {
      emailVerified: true,
    });
  }

  async sendAccountEmailVerification(user: User) {
    const [mailLimit] = await this.mailLimitRepository.findOrCreate(
      {
        userId: user.id,
        mailType: MailTypes.EmailVerification,
      },
      {
        attemptsCount: 0,
        attemptsLimit: 10,
      },
    );

    if (mailLimit.isLimitForTodayReached()) {
      throw new MailLimitReachedException(
        'Mail verification daily limit reached',
      );
    }

    const secret = this.configService.get('secrets.jwt');
    const verificationToken = this.cryptoService.encryptText(user.uuid, secret);
    const verificationTokenEncoded = encodeURIComponent(verificationToken);

    const driveWebUrl = this.configService.get('clients.drive.web');
    const url = `${driveWebUrl}/verify-email/${verificationTokenEncoded}`;

    await this.mailerService.sendVerifyAccountEmail(user.email, url);

    mailLimit.increaseTodayAttempts();

    await this.mailLimitRepository.updateByUserIdAndMailType(
      user.id,
      MailTypes.EmailVerification,
      mailLimit,
    );
  }

  async upsertAvatar(
    user: User,
    avatarKey: string,
  ): Promise<Error | { avatar: string }> {
    if (user.avatar) {
      await this.avatarService.deleteAvatar(user.avatar);
    }
    await this.userRepository.updateById(user.id, {
      avatar: avatarKey,
    });
    const avatarUrl = await this.getAvatarUrl(avatarKey);
    return { avatar: avatarUrl };
  }

  async deleteAvatar(user: User): Promise<Error | void> {
    if (user.avatar) {
      await this.avatarService.deleteAvatar(user.avatar);
      await this.userRepository.updateById(user.id, {
        avatar: null,
      });
    }
  }

  async updateProfile(user: User, payload: UpdateProfileDto) {
    await this.userRepository.updateByUuid(user.uuid, payload);
  }

  logReferralError(userId: number | string, err: unknown) {
    if (err instanceof ReferralsNotAvailableError) {
      return;
    }

    if (err instanceof Error && !err.message) {
      return Logger.error(
        '[STORAGE]: ERROR message undefined applying referral for user %s',
        userId,
      );
    }

    return Logger.error(
      '[STORAGE]: ERROR applying referral for user %s: %s',
      userId,
      err instanceof Error ? err.message : 'Unknown error',
    );
  }

  async sendDeactivationEmail(user: User) {
    const [mailLimit] = await this.mailLimitRepository.findOrCreate(
      {
        userId: user.id,
        mailType: MailTypes.DeactivateUser,
      },
      {
        attemptsCount: 0,
        attemptsLimit: 10,
      },
    );

    if (mailLimit.isLimitForTodayReached()) {
      throw new MailLimitReachedException(
        'Mail deactivation daily limit reached',
      );
    }

    const deactivator = crypto.randomBytes(256).toString('hex');
    const deactivationUrl = `${this.configService.get(
      'clients.drive.web',
    )}/deactivations/${deactivator}`;

    await this.networkService.sendDeactivationEmail(
      user,
      deactivationUrl,
      deactivator,
    );

    mailLimit.increaseTodayAttempts();

    await this.mailLimitRepository.updateByUserIdAndMailType(
      user.id,
      MailTypes.DeactivateUser,
      mailLimit,
    );
  }

  async getUserUsage(user: User): Promise<{ drive: number }> {
    let totalDriveUsage = 0;
    const cachedUsage = await this.cacheManager.getUserUsage(user.uuid);

    if (cachedUsage) {
      totalDriveUsage = cachedUsage.usage;
    } else {
      const driveUsage = await this.fileUseCases.getUserUsedStorage(user);
      await this.cacheManager.setUserUsage(user.uuid, driveUsage);
      totalDriveUsage = driveUsage;
    }

    return { drive: totalDriveUsage };
  }

  async confirmDeactivation(token: string) {
    const userEmail = await this.networkService.confirmDeactivation(token);
    const user = await this.userRepository.findByEmail(userEmail);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    try {
      await this.userRepository.updateByUuid(user.uuid, {
        rootFolderId: null,
      });

      // DELETING FOREIGN KEYS (not cascade)
      await Promise.all([
        await this.userRepository.deleteUserNotificationTokens(user.uuid),
        await this.keyServerRepository.deleteByUserId(user.id),
        await this.appSumoUseCases.deleteByUserId(user.id),
        await this.backupUseCases.deleteUserBackups(user.id),
      ]);

      await this.userRepository.deleteBy({ uuid: user.uuid });
      await this.folderUseCases.removeUserOrphanFolders(user);
    } catch (err) {
      if (user) {
        const tempUsername = `${user.email}-${crypto
          .randomBytes(5)
          .toString('hex')}-DELETED`;

        await this.userRepository.updateBy(
          { uuid: user.uuid },
          {
            email: tempUsername,
            username: tempUsername,
            bridgeUser: tempUsername,
          },
        );

        const errorDetails = {
          message: err.message,
          stack: err.stack,
        };

        throw new Error(
          `Deactivation error for user: ${
            user.email
          } (renamed to ${tempUsername}): ${JSON.stringify(errorDetails)}`,
        );
      } else {
        throw err;
      }
    }
  }

  getSpaceLimit(user: User): Promise<number> {
    return this.networkService.getLimit(user.bridgeUser, user.userId);
  }
}
