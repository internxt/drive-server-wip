import {
  BadRequestException,
  ConflictException,
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
import { v4, validate } from 'uuid';
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
import { AvatarService } from '../../externals/avatar/avatar.service';
import { SequelizePreCreatedUsersRepository } from './pre-created-users.repository';
import { PreCreateUserDto } from './dto/pre-create-user.dto';
import {
  decryptMessageWithPrivateKey,
  encryptMessageWithPublicKey,
} from '../../externals/asymmetric-encryption/openpgp';
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
import { getTokenDefaultIat, verifyToken } from '../../lib/jwt';
import getEnv from '../../config/configuration';
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
import { SharingInvite } from '../sharing/sharing.domain';
import { AsymmetricEncryptionService } from '../../externals/asymmetric-encryption/asymmetric-encryption.service';
import { WorkspacesUsecases } from '../workspaces/workspaces.usecase';
import { LegacyRecoverAccountDto } from './dto/legacy-recover-account.dto';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { GetOrCreatePublicKeysDto } from './dto/responses/get-or-create-publickeys.dto';
import { IncompleteCheckoutDto } from './dto/incomplete-checkout.dto';
import { UserResponseDto } from './dto/responses/user-credentials.dto';

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
    private readonly userRepository: SequelizeUserRepository,
    private readonly preCreatedUserRepository: SequelizePreCreatedUsersRepository,
    private readonly sharedWorkspaceRepository: SequelizeSharedWorkspaceRepository,
    private readonly referralsRepository: SequelizeReferralRepository,
    private readonly userReferralsRepository: SequelizeUserReferralsRepository,
    private readonly attemptChangeEmailRepository: SequelizeAttemptChangeEmailRepository,
    private readonly sharingRepository: SequelizeSharingRepository,
    private readonly workspaceRepository: SequelizeWorkspaceRepository,
    @Inject(forwardRef(() => FileUseCases))
    private readonly fileUseCases: FileUseCases,
    @Inject(forwardRef(() => FolderUseCases))
    private readonly folderUseCases: FolderUseCases,
    @Inject(forwardRef(() => WorkspacesUsecases))
    private readonly workspaceUseCases: WorkspacesUsecases,
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
    private readonly networkService: BridgeService,
    private readonly notificationService: NotificationService,
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

  async getCachedAvatar(user: User): Promise<string | null> {
    if (!user.avatar) return null;

    const cached = await this.cacheManager.getUserAvatar(user.uuid);
    if (cached) return cached;

    const url = await this.getAvatarUrl(user.avatar);
    if (url) {
      await this.cacheManager.setUserAvatar(user.uuid, url);
    }
    return url;
  }

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

  async getOrPreCreateUser(
    email: User['email'],
    requestingUser: User,
  ): Promise<GetOrCreatePublicKeysDto> {
    const user = await this.getUserByUsername(email);

    if (user) {
      const keys = await this.keyServerUseCases.getPublicKeys(user.id);
      return {
        publicKey: keys.ecc,
        publicKyberKey: keys.kyber,
      };
    }

    const preCreateLimit = await this.mailLimitRepository.findOrCreate(
      {
        userId: requestingUser.id,
        mailType: MailTypes.PreCreateUser,
      },
      {
        userId: requestingUser.id,
        mailType: MailTypes.PreCreateUser,
        attemptsLimit: 50,
        attemptsCount: 0,
        lastMailSent: new Date(),
      },
    );

    if (preCreateLimit[0].isLimitForTodayReached()) {
      throw new MailLimitReachedException('Limit reached');
    }

    const [preCreatedUser, wasCreated] = await this.preCreateUser({
      email,
    });

    if (wasCreated) {
      preCreateLimit[0].increaseTodayAttempts();
      await this.mailLimitRepository.updateByUserIdAndMailType(
        requestingUser.id,
        MailTypes.PreCreateUser,
        preCreateLimit[0],
      );
    }

    return {
      publicKey: preCreatedUser.publicKey,
      publicKyberKey: preCreatedUser.publicKyberKey,
    };
  }

  getWorkspaceMembersByBrigeUser(bridgeUser: string) {
    return this.userRepository.findAllBy({ bridgeUser });
  }

  updateByUuid(userUuid: User['uuid'], payload: Partial<User>) {
    return this.userRepository.updateByUuid(userUuid, payload);
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
          '(usersReferralsService.redeemUserReferral) GATEWAY_USER' +
            ' || GATEWAY_PASS not found. Skipping storage increasing',
        );
      }
    }

    console.info(
      `(usersReferralsService.redeemUserReferral) ` +
        `The user '${uuid}' (id: ${userId}) has redeemed a referral: ${type} - ${credit}`,
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
    const rootFolderName = v4();

    const rootFolder = await this.folderUseCases.createRootFolder(
      user,
      rootFolderName,
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

      const { newToken, token } = await this.getAuthTokens(
        user,
        undefined,
        '3d',
      );

      return {
        token,
        newToken,
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
        stack: err.stack ?? 'NO STACK',
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
    const privateKyberKey = encPrivateKyberKey
      ? aes.decrypt(encPrivateKyberKey, defaultPass)
      : null;

    const invites = await this.sharingRepository.getInvitesBySharedwith(
      preCreatedUser.uuid,
    );

    const invitesToUpdate: SharingInvite[] = [];

    for (const invite of invites) {
      const { encryptionKey } = invite;

      if (invite.isHybrid() && (!newPublicKyberKey || !privateKyberKey)) {
        await this.sharingRepository.deleteInvite(invite);
        continue;
      }

      const decryptedEncryptionKey =
        await this.asymmetricEncryptionService.hybridDecryptMessageWithPrivateKey(
          {
            encryptedMessageInBase64: encryptionKey,
            privateKeyInBase64: privateKey,
            privateKyberKeyInBase64: invite.isHybrid() ? privateKyberKey : null,
          },
        );

      const newEncryptedEncryptionKey =
        await this.asymmetricEncryptionService.hybridEncryptMessageWithPublicKey(
          {
            message: decryptedEncryptionKey.toString(),
            publicKeyInBase64: newPublicKey,
            publicKyberKeyBase64: invite.isHybrid() ? newPublicKyberKey : null,
          },
        );

      invite.encryptionKey = newEncryptedEncryptionKey;
      invite.sharedWith = newUserUuid;

      invitesToUpdate.push(invite);
    }

    await this.sharingRepository.bulkUpdate(invitesToUpdate);

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

  async preCreateUser(newUser: PreCreateUserDto): Promise<
    [
      {
        id: number;
        email: string;
        uuid: string;
        username: string;
        publicKyberKey: string;
        publicKey: string;
        password: string;
      },
      boolean,
    ]
  > {
    const email = newUser.email.toLowerCase();

    const [existentUser, preCreatedUser] = await Promise.all([
      this.userRepository.findByUsername(email),
      this.preCreatedUserRepository.findByUsername(email),
    ]);

    if (existentUser) {
      throw new ConflictException(newUser.email);
    }

    if (preCreatedUser) {
      return [
        {
          ...preCreatedUser.toJSON(),
          publicKyberKey: preCreatedUser.publicKyberKey.toString(),
          publicKey: preCreatedUser.publicKey.toString(),
          password: preCreatedUser.password.toString(),
        },
        false,
      ];
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

    const {
      privateKeyArmored,
      publicKeyArmored,
      revocationCertificate,
      privateKyberKeyBase64,
      publicKyberKeyBase64,
    } =
      await this.asymmetricEncryptionService.generateNewKeys(keysCreationDate);

    const encPrivateKey = aes.encrypt(privateKeyArmored, defaultPass);

    const encPrivateKyberKey = aes.encrypt(privateKyberKeyBase64, defaultPass);

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
      publicKyberKey: publicKyberKeyBase64,
      revocationKey: revocationCertificate,
      encryptVersion: UserKeysEncryptVersions.Ecc,
    });

    return [
      {
        ...user.toJSON(),
        publicKyberKey: user.publicKyberKey.toString(),
        publicKey: user.publicKey.toString(),
        password: user.password.toString(),
      },
      true,
    ];
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
      throw new NotFoundException('User not found');
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
    tokenExpirationTime: string | number = '3d',
    platform?: string,
  ): Promise<{ token: string; newToken: string }> {
    const jti = v4();

    const availableWorkspaces =
      await this.workspaceRepository.findUserAvailableWorkspaces(user.uuid);

    const owners = [
      ...new Set(availableWorkspaces.map(({ workspace }) => workspace.ownerId)),
    ];

    const token = SignEmail(
      user.email,
      this.configService.get('secrets.jwt'),
      tokenExpirationTime,
      customIat,
    );
    const newToken = Sign(
      {
        jti,
        sub: user.uuid,
        payload: {
          uuid: user.uuid,
          email: user.email,
          name: user.name,
          lastname: user.lastname,
          username: user.username,
          sharedWorkspace: true,
          networkCredentials: {
            user: user.bridgeUser,
          },
          workspaces: { owners },
          ...(platform && { platform }),
        },
        ...(customIat ? { iat: customIat } : null),
      },
      this.configService.get('secrets.jwt'),
      tokenExpirationTime,
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

  /**
   * @deprecated in favor of updateCredentials as privateKeys are required
   */
  async updateCredentialsOld(
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
        deleteWorkspaces: true,
        deleteBackups: true,
      });
    }
    await this.keyServerRepository.deleteByUserId(user.id);
  }

  async updateCredentials(
    userUuid: User['uuid'],
    newCredentials: {
      mnemonic: string;
      password: string;
      salt: string;
      privateKeys?: {
        ecc: string;
        kyber: string;
      };
    },
    withReset = false,
  ): Promise<void> {
    const { mnemonic, password, salt, privateKeys } = newCredentials;

    const shouldUpdateKeys = privateKeys && Object.keys(privateKeys).length > 0;

    if (!withReset && !shouldUpdateKeys) {
      throw new BadRequestException(
        'Keys are required if the account is not being reset',
      );
    }

    const user = await this.userRepository.findByUuid(userUuid);

    if (shouldUpdateKeys) {
      for (const [version, privateKey] of Object.entries(privateKeys)) {
        await this.keyServerUseCases.updateByUserAndEncryptVersion(
          user.id,
          version as UserKeysEncryptVersions,
          { privateKey },
        );
      }
    }

    await this.userRepository.updateByUuid(userUuid, {
      mnemonic,
      password: this.cryptoService.decryptText(password),
      hKey: this.cryptoService.decryptText(salt),
    });

    if (withReset) {
      await this.keyServerRepository.deleteByUserId(user.id);
      await this.resetUser(user, {
        deleteFiles: true,
        deleteFolders: true,
        deleteShares: true,
        deleteWorkspaces: true,
        deleteBackups: true,
      });
    }
  }

  async recoverAccountLegacy(
    userUuid: User['uuid'],
    credentials: LegacyRecoverAccountDto,
  ): Promise<void> {
    const { mnemonic, password, salt, asymmetricEncryptedMnemonic, keys } =
      credentials;

    const user = await this.userRepository.findByUuid(userUuid);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const keyVersions = Object.values(UserKeysEncryptVersions);

    for (const version of keyVersions) {
      const key = keys[version];
      const revocationKey =
        'revocationKey' in key ? key.revocationKey : undefined;

      await this.keyServerUseCases.updateByUserAndEncryptVersion(
        user.id,
        version,
        {
          privateKey: key.private,
          publicKey: key.public,
          revocationKey,
        },
      );
    }

    const ownedWorkspaceAndUsers =
      await this.workspaceRepository.findWorkspaceUsersOfOwnedWorkspaces(
        user.uuid,
      );

    if (ownedWorkspaceAndUsers.length > 0) {
      //  TODO: this should be updated when we add support for workspace hybrid keys
      await Promise.all(
        ownedWorkspaceAndUsers.map((workspaceAndUser) =>
          this.workspaceRepository.updateWorkspaceUserEncryptedKeyByMemberId(
            workspaceAndUser.workspaceUser.memberId,
            workspaceAndUser.workspace.id,
            asymmetricEncryptedMnemonic.ecc,
          ),
        ),
      );
    }

    await this.userRepository.updateByUuid(userUuid, {
      mnemonic,
      password: this.cryptoService.decryptText(password),
      hKey: this.cryptoService.decryptText(salt),
    });

    //  New keys were created, so we need to delete invitations made with the old keys
    await Promise.all([
      await this.sharingRepository.deleteSharingsBy({ sharedWith: user.uuid }),
      await this.sharingRepository.deleteInvitesBy({ sharedWith: user.uuid }),
      await this.workspaceUseCases.removeUserFromNonOwnedWorkspaces(user),
    ]);
  }

  verifyAndDecodeAccountRecoveryToken(token: string): {
    userUuid: string;
  } {
    try {
      const jwtSecret = getEnv().secrets.jwt;
      const decoded = verifyToken<{
        payload: { uuid?: string; action?: string };
      }>(token, jwtSecret);

      if (typeof decoded === 'string') {
        Logger.error(
          `[RECOVER-ACCOUNT/VERIFY-AND-DECODE-TOKEN]: Token is a string`,
        );
        throw new ForbiddenException('Invalid token');
      }

      const decodedContent = decoded?.payload;

      if (
        !decodedContent?.uuid ||
        decodedContent?.action !== 'recover-account' ||
        !validate(decodedContent.uuid)
      ) {
        Logger.error(
          `[RECOVER-ACCOUNT/VERIFY-AND-DECODE-TOKEN]: Invalid token structure ${JSON.stringify(
            decoded,
          )}`,
        );
        throw new ForbiddenException('Invalid token');
      }

      return { userUuid: decodedContent.uuid };
    } catch (error) {
      Logger.error(
        `[RECOVER-ACCOUNT/VERIFY-AND-DECODE-TOKEN]: Error ${JSON.stringify(
          error,
        )}`,
      );
      if (error instanceof JsonWebTokenError) {
        const isTokenExpired = error instanceof TokenExpiredError;

        throw new ForbiddenException(
          isTokenExpired ? 'Token expired' : 'Invalid token',
        );
      }
      throw error;
    }
  }

  async resetUser(
    user: User,
    options: {
      deleteFiles: boolean;
      deleteFolders: boolean;
      deleteShares: boolean;
      deleteWorkspaces: boolean;
      deleteBackups: boolean;
    },
  ): Promise<void> {
    if (options.deleteShares) {
      await this.sharingRepository.deleteSharingsBy({ sharedWith: user.uuid });
      await this.sharingRepository.deleteSharingsBy({ ownerId: user.uuid });
      await this.sharingRepository.deleteInvitesBy({ sharedWith: user.uuid });
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

    if (options.deleteWorkspaces) {
      await this.workspaceUseCases.emptyAllUserOwnedWorkspaces(user);
      await this.workspaceUseCases.removeUserFromNonOwnedWorkspaces(user);
    }

    if (options.deleteBackups) {
      await this.backupUseCases.deleteUserBackups(user.id);
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

    const { newToken, token } = await this.getAuthTokens(user, undefined, '3d');

    return {
      ...emails,
      newAuthentication: {
        token,
        newToken,
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
    > & { platform?: string },
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
    const { token, newToken } = await this.getAuthTokens(
      userData,
      undefined,
      '3d',
      loginAccessDto.platform,
    );
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
      tierId: userData.tierId,
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
    await this.cacheManager.setUserAvatar(user.uuid, avatarUrl);
    return { avatar: avatarUrl };
  }

  async deleteAvatar(user: User): Promise<Error | void> {
    if (user.avatar) {
      await this.avatarService.deleteAvatar(user.avatar);
      await this.userRepository.updateById(user.id, {
        avatar: null,
      });
      await this.cacheManager.deleteUserAvatar(user.uuid);
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

  async getUserUsage(
    user: User,
  ): Promise<{ drive: number; backup: number; total: number }> {
    let totalDriveUsage = 0;
    const cachedUsage = await this.cacheManager.getUserUsage(user.uuid);

    if (cachedUsage) {
      totalDriveUsage = cachedUsage.usage;
    } else {
      const driveUsage = await this.fileUseCases.getUserUsedStorage(user);
      await this.cacheManager.setUserUsage(user.uuid, driveUsage);
      totalDriveUsage = driveUsage;
    }

    const backupUsage = await this.backupUseCases.sumExistentBackupSizes(
      user.id,
    );

    return {
      drive: totalDriveUsage,
      backup: backupUsage,
      total: totalDriveUsage + backupUsage,
    };
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
        await this.sharingRepository.deleteInvitesBy({
          sharedWith: user.uuid,
        }),
        await this.sharingRepository.deleteSharingsBy({ ownerId: user.uuid }),
        await this.sharingRepository.deleteSharingsBy({
          sharedWith: user.uuid,
        }),
        await this.userRepository.deleteUserNotificationTokens(user.uuid),
        await this.keyServerRepository.deleteByUserId(user.id),
        await this.appSumoUseCases.deleteByUserId(user.id),
        await this.backupUseCases.deleteUserBackups(user.id),
      ]);

      await this.userRepository.deleteBy({ uuid: user.uuid });
      await this.folderUseCases.removeUserOrphanFolders(user);

      return user;
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

  async getSpaceLimit(user: User): Promise<number> {
    const cachedLimit = await this.cacheManager.getUserStorageLimit(user.uuid);
    if (cachedLimit) {
      return cachedLimit.limit;
    }

    const limit = await this.networkService.getLimit(
      user.bridgeUser,
      user.userId,
    );
    await this.cacheManager.setUserStorageLimit(user.uuid, limit);

    return limit;
  }

  async generateMnemonic() {
    const mnemonic = generateMnemonic(256);
    return mnemonic;
  }

  async hasUploadedFiles(user: User) {
    return await this.fileUseCases.hasUploadedFiles(user);
  }

  async handleIncompleteCheckoutEvent(
    user: User,
    dto: IncompleteCheckoutDto,
  ): Promise<{ success: boolean }> {
    const [mailLimit] = await this.mailLimitRepository.findOrCreate(
      {
        userId: user.id,
        mailType: MailTypes.IncompleteCheckout,
      },
      {
        attemptsCount: 0,
        attemptsLimit: 5,
        lastMailSent: new Date(),
        userId: user.id,
        mailType: MailTypes.IncompleteCheckout,
      },
    );

    if (mailLimit.isLimitForTodayReached()) {
      throw new BadRequestException(
        'Daily limit for incomplete checkout emails reached',
      );
    }

    await this.mailerService.sendIncompleteCheckoutEmail(
      user.email,
      dto.completeCheckoutUrl,
    );

    mailLimit.increaseTodayAttempts();
    await this.mailLimitRepository.updateByUserIdAndMailType(
      user.id,
      MailTypes.IncompleteCheckout,
      mailLimit,
    );

    return { success: true };
  }

  async checkAndNotifyStorageThreshold(
    user: User,
    usage: { drive: number; backup: number; total: number },
  ): Promise<void> {
    const NOTIFY_THRESHOLD = 80;
    const COOLDOWN_DAYS = 14;
    const MAX_EMAILS_PER_MONTH = 2;

    try {
      const limit = await this.getSpaceLimit(user);
      const usagePercent = (usage.total / limit) * 100;

      if (usagePercent < NOTIFY_THRESHOLD) {
        return;
      }

      const [mailLimit] = await this.mailLimitRepository.findOrCreate(
        {
          userId: user.id,
          mailType: MailTypes.FullStorage,
        },
        {
          attemptsCount: 0,
          attemptsLimit: MAX_EMAILS_PER_MONTH,
          lastMailSent: new Date(0),
        },
      );

      if (Time.daysSince(mailLimit.lastMailSent) < COOLDOWN_DAYS) {
        return;
      }

      if (mailLimit.isLimitForThisMonthReached()) {
        return;
      }

      await this.mailerService
        .sendFullStorageEmail(user.email)
        .catch((error) => {
          new Logger('[MAILER/FULL_STORAGE]').error(
            `Failed to send full storage email to ${user.email}: ${error.message}`,
          );
          throw error;
        });

      mailLimit.increaseMonthAttempts();
      await this.mailLimitRepository.updateByUserIdAndMailType(
        user.id,
        MailTypes.FullStorage,
        mailLimit,
      );

      new Logger('[STORAGE/THRESHOLD]').log(
        `Storage notification sent to user ${user.uuid} (${usagePercent.toFixed(1)}% used, attempt ${mailLimit.attemptsCount}/${MAX_EMAILS_PER_MONTH} this month)`,
      );
    } catch (error) {
      new Logger('[STORAGE/THRESHOLD_CHECK]').error(
        `Error checking storage threshold for user ${user.uuid}: ${error.message}`,
      );
    }
  }

  async getUserCredentials(user: User, tokenExpirationTime?: string | number) {
    const [{ token: oldToken, newToken }, avatar, rootFolder, keys] =
      await Promise.all([
        this.getAuthTokens(user, undefined, tokenExpirationTime),
        this.getAvatarUrl(user.avatar),
        this.getOrCreateUserRootFolderAndBucket(user),
        this.keyServerUseCases.findUserKeys(user.id),
      ]);

    const userResponse: UserResponseDto = {
      email: user.email,
      userId: user.userId,
      mnemonic: user.mnemonic.toString(),
      root_folder_id: rootFolder.id,
      rootFolderId: rootFolder.uuid,
      name: user.name,
      lastname: user.lastname,
      uuid: user.uuid,
      credit: user.credit,
      createdAt: user.createdAt,
      privateKey: keys.ecc?.privateKey ?? null,
      publicKey: keys.ecc?.publicKey ?? null,
      revocateKey: keys.ecc?.revocationKey ?? null,
      keys: {
        ecc: {
          privateKey: keys.ecc?.privateKey ?? null,
          publicKey: keys.ecc?.publicKey ?? null,
        },
        kyber: {
          privateKey: keys.kyber?.privateKey ?? null,
          publicKey: keys.kyber?.publicKey ?? null,
        },
      },
      bucket: rootFolder.bucket,
      registerCompleted: user.registerCompleted,
      teams: false,
      username: user.username,
      bridgeUser: user.bridgeUser,
      sharedWorkspace: user.sharedWorkspace,
      hasReferralsProgram: false,
      backupsBucket: user.backupsBucket,
      emailVerified: user.emailVerified,
      lastPasswordChangedAt: user.lastPasswordChangedAt,
      avatar,
    };

    return {
      user: userResponse,
      oldToken: oldToken,
      token: oldToken,
      newToken: newToken,
    };
  }
}
