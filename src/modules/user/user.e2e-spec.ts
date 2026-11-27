import { HttpStatus } from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { getModelToken } from '@nestjs/sequelize';
import request from 'supertest';
import { v4 } from 'uuid';
import getEnv from '../../config/configuration';

import { createTestApp } from '../../../test/helpers/test-app.helper';
import {
  generateValidRegistrationData,
  type RegisterUserDto,
} from '../../../test/helpers/register.helper';
import { UserModel } from './user.model';
import { FolderModel } from '../folder/folder.model';
import { FileModel } from '../file/file.model';
import { KeyServerModel } from '../keyserver/key-server.model';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { TierModel } from '../feature-limit/models/tier.model';
import { SequelizeFeatureLimitsRepository } from '../feature-limit/feature-limit.repository';
import { Op } from 'sequelize';
import { createTestUser } from '../../../test/helpers/user.helper';
import { AsymmetricEncryptionService } from '../../externals/asymmetric-encryption/asymmetric-encryption.service';
import { RoleModel, SharingInviteModel, SharingModel } from '../sharing/models';
import { HYBRID_ALGORITHM } from '../sharing/sharing.domain';
import { Time } from '../../lib/time';
import { PreCreatedUserModel } from './pre-created-users.model';
import { UserUseCases } from './user.usecase';
import {
  EmailLinkTokenAction,
  signEmailLinkToken,
} from './utils/email-link-token.util';

describe('User Registration E2E', () => {
  let app: NestExpressApplication;
  let userModel: typeof UserModel;
  let folderModel: typeof FolderModel;
  let fileModel: typeof FileModel;
  let keyServerModel: typeof KeyServerModel;
  let tierModel: typeof TierModel;
  let featureLimitsRepository: SequelizeFeatureLimitsRepository;
  let cryptoService: CryptoService;
  let asymmetricEncryptionService: AsymmetricEncryptionService;
  let userUseCases: UserUseCases;
  let preCreatedUserModel: typeof PreCreatedUserModel;
  let sharingInviteModel: typeof SharingInviteModel;
  let sharingModel: typeof SharingModel;
  let roleModel: typeof RoleModel;
  let createdUserIds: number[] = [];
  const cleanups: (() => Promise<void>)[] = [];

  const encryptRegistrationData = (data: RegisterUserDto): RegisterUserDto => {
    return {
      ...data,
      password: cryptoService.encryptText(data.password),
      salt: cryptoService.encryptText(data.salt),
    };
  };

  beforeAll(async () => {
    app = await createTestApp();
    userModel = app.get(getModelToken(UserModel));
    folderModel = app.get(getModelToken(FolderModel));
    fileModel = app.get(getModelToken(FileModel));
    keyServerModel = app.get(getModelToken(KeyServerModel));
    tierModel = app.get(getModelToken(TierModel));
    featureLimitsRepository = app.get(SequelizeFeatureLimitsRepository);
    cryptoService = app.get(CryptoService);
    asymmetricEncryptionService = app.get(AsymmetricEncryptionService);
    userUseCases = app.get(UserUseCases);
    preCreatedUserModel = app.get(getModelToken(PreCreatedUserModel));
    sharingInviteModel = app.get(getModelToken(SharingInviteModel));
    sharingModel = app.get(getModelToken(SharingModel));
    roleModel = app.get(getModelToken(RoleModel));
  });

  afterEach(async () => {
    while (cleanups.length) {
      await cleanups.pop()();
    }
    for (const userId of createdUserIds) {
      await userModel.update({ rootFolderId: null }, { where: { id: userId } });
      await keyServerModel.destroy({ where: { userId } });
      await fileModel.destroy({ where: { userId } });
      await folderModel.destroy({ where: { userId } });
      await userModel.destroy({ where: { id: userId } });
    }
    createdUserIds = [];
  });

  afterAll(async () => {
    await app.close();
  });

  const registerUser = (data: RegisterUserDto) => {
    return request(app.getHttpServer()).post('/users').send(data);
  };

  describe('POST /users - User Registration', () => {
    describe('Users can register successfully with valid data', () => {
      it('When valid registration data is provided, then user is created successfully', async () => {
        const registrationData = await generateValidRegistrationData();
        const encryptedData = encryptRegistrationData(registrationData);

        const response = await registerUser(encryptedData).expect(
          HttpStatus.CREATED,
        );

        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('uuid');
        expect(response.body.user.email).toBe(registrationData.email);
        expect(response.body.user.name).toBe(registrationData.name);
        expect(response.body.user.lastname).toBe(registrationData.lastname);

        const createdUser = await userModel.findOne({
          where: { email: registrationData.email },
        });
        expect(createdUser).not.toBeNull();
        createdUserIds.push(createdUser.id);
      });

      it('When registration is successful, then tokens are returned', async () => {
        const registrationData = await generateValidRegistrationData();
        const encryptedData = encryptRegistrationData(registrationData);

        const response = await registerUser(encryptedData).expect(
          HttpStatus.CREATED,
        );

        expect(response.body.token).toBeDefined();
        expect(response.body.newToken).toBeDefined();
        expect(typeof response.body.token).toBe('string');
        expect(typeof response.body.newToken).toBe('string');

        const createdUser = await userModel.findOne({
          where: { email: registrationData.email },
        });
        createdUserIds.push(createdUser.id);
      });
    });

    describe('The system properly rejects invalid registration attempts', () => {
      it('When email is missing, then registration fails with 400', async () => {
        const registrationData = await generateValidRegistrationData();
        delete (registrationData as any).email;

        await registerUser(registrationData).expect(HttpStatus.BAD_REQUEST);
      });

      it('When name is missing, then registration fails with 400', async () => {
        const registrationData = await generateValidRegistrationData();
        delete (registrationData as any).name;

        await registerUser(registrationData).expect(HttpStatus.BAD_REQUEST);
      });

      it('When password is missing, then registration fails with 400', async () => {
        const registrationData = await generateValidRegistrationData();
        delete (registrationData as any).password;

        await registerUser(registrationData).expect(HttpStatus.BAD_REQUEST);
      });

      it('When mnemonic is missing, then registration fails with 400', async () => {
        const registrationData = await generateValidRegistrationData();
        delete (registrationData as any).mnemonic;

        await registerUser(registrationData).expect(HttpStatus.BAD_REQUEST);
      });

      it('When email is invalid format, then registration fails with 400', async () => {
        const registrationData = await generateValidRegistrationData({
          email: 'invalid-email',
        });

        await registerUser(registrationData).expect(HttpStatus.BAD_REQUEST);
      });

      it('When email is already registered, then registration fails with 409', async () => {
        const registrationData = await generateValidRegistrationData();
        const encryptedData = encryptRegistrationData(registrationData);

        await registerUser(encryptedData).expect(HttpStatus.CREATED);

        const createdUser = await userModel.findOne({
          where: { email: registrationData.email },
        });
        createdUserIds.push(createdUser.id);

        const duplicateData = await generateValidRegistrationData({
          email: registrationData.email,
        });
        const encryptedDuplicate = encryptRegistrationData(duplicateData);

        await registerUser(encryptedDuplicate).expect(HttpStatus.CONFLICT);
      });

      it('When name exceeds 100 characters, then registration fails with 400', async () => {
        const registrationData = await generateValidRegistrationData({
          name: 'a'.repeat(101),
        });

        await registerUser(registrationData).expect(HttpStatus.BAD_REQUEST);
      });

      it('When lastname exceeds 100 characters, then registration fails with 400', async () => {
        const registrationData = await generateValidRegistrationData({
          lastname: 'a'.repeat(101),
        });

        await registerUser(registrationData).expect(HttpStatus.BAD_REQUEST);
      });
    });

    describe('Pending invitations of the email', () => {
      it('When someone signs up with an invited email, then the invitations stay pending until the email is verified', async () => {
        const { email, preCreatedUser, invitation } =
          await shareFolderWithEmailWithoutAccount();

        await signUp(email);

        expect(await whoIsInvited(invitation)).toBe(preCreatedUser.uuid);
      });
    });

    describe('All user resources are created correctly after registration', () => {
      it('When registration data includes fields not allowed at signup, then they are ignored', async () => {
        const freeTier = await featureLimitsRepository.getFreeTier();
        const paidTier = await tierModel.findOne({
          where: { id: { [Op.ne]: freeTier.id } },
        });
        const registrationData = await generateValidRegistrationData();
        const encryptedData = {
          ...encryptRegistrationData(registrationData),
          tierId: paidTier.id,
          emailVerified: true,
        };

        await registerUser(encryptedData).expect(HttpStatus.CREATED);

        const createdUser = await userModel.findOne({
          where: { email: registrationData.email },
        });
        createdUserIds.push(createdUser.id);
        expect(createdUser.tierId).toBe(freeTier.id);
        expect(createdUser.emailVerified).toBe(false);
      });

      it('When registration is successful, then root folder is created', async () => {
        const registrationData = await generateValidRegistrationData();
        const encryptedData = encryptRegistrationData(registrationData);

        const response = await registerUser(encryptedData).expect(
          HttpStatus.CREATED,
        );

        expect(response.body.user.root_folder_id).toBeDefined();

        const createdUser = await userModel.findOne({
          where: { email: registrationData.email },
        });
        createdUserIds.push(createdUser.id);

        const rootFolder = await folderModel.findOne({
          where: { userId: createdUser.id, parentId: null },
        });
        expect(rootFolder).not.toBeNull();
        // Note: plainName is not set by the registration endpoint, only name (encrypted)
        expect(rootFolder.name).toBeDefined();
      });

      it('When registration includes ECC keys, then keys are stored', async () => {
        const registrationData = await generateValidRegistrationData();
        const encryptedData = encryptRegistrationData(registrationData);

        const response = await registerUser(encryptedData).expect(
          HttpStatus.CREATED,
        );

        expect(response.body.user.keys).toBeDefined();
        expect(response.body.user.keys.ecc).toBeDefined();
        expect(response.body.user.keys.ecc.publicKey).toBeDefined();
        expect(response.body.user.keys.ecc.privateKey).toBeDefined();

        const createdUser = await userModel.findOne({
          where: { email: registrationData.email },
        });
        createdUserIds.push(createdUser.id);

        const storedKeys = await keyServerModel.findOne({
          where: { userId: createdUser.id },
        });
        expect(storedKeys).not.toBeNull();
        expect(storedKeys.publicKey).toBeDefined();
        expect(storedKeys.privateKey).toBeDefined();
      });

      it('When registration is successful, then user UUID is generated', async () => {
        const registrationData = await generateValidRegistrationData();
        const encryptedData = encryptRegistrationData(registrationData);

        const response = await registerUser(encryptedData).expect(
          HttpStatus.CREATED,
        );

        expect(response.body.uuid).toBeDefined();
        expect(response.body.uuid).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );

        const createdUser = await userModel.findOne({
          where: { email: registrationData.email },
        });
        createdUserIds.push(createdUser.id);
        expect(createdUser.uuid).toBe(response.body.uuid);
      });

      it('When registration is successful, then user and root folder are linked correctly', async () => {
        const registrationData = await generateValidRegistrationData();
        const encryptedData = encryptRegistrationData(registrationData);

        await registerUser(encryptedData).expect(HttpStatus.CREATED);

        const createdUser = await userModel.findOne({
          where: { email: registrationData.email },
        });
        createdUserIds.push(createdUser.id);

        const rootFolder = await folderModel.findOne({
          where: { id: createdUser.rootFolderId },
        });

        expect(rootFolder).not.toBeNull();
        expect(rootFolder.userId).toBe(createdUser.id);
        expect(createdUser.rootFolderId).toBe(rootFolder.id);
      });

      it('When registration is successful, then referral code is generated', async () => {
        const registrationData = await generateValidRegistrationData();
        const encryptedData = encryptRegistrationData(registrationData);

        await registerUser(encryptedData).expect(HttpStatus.CREATED);

        const createdUser = await userModel.findOne({
          where: { email: registrationData.email },
        });
        createdUserIds.push(createdUser.id);

        expect(createdUser.referralCode).toBeDefined();
        expect(createdUser.referralCode).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
      });
    });
  });

  describe('POST /users/email-verification - Email verification', () => {
    it('When the email is verified, then the pending invitations are handed over to the user', async () => {
      const { email, invitation } = await shareFolderWithEmailWithoutAccount();
      const user = await signUp(email);

      await request(app.getHttpServer())
        .post('/users/email-verification')
        .send({
          verificationToken: cryptoService.encryptText(
            user.uuid,
            getEnv().secrets.jwt,
          ),
        })
        .expect(HttpStatus.CREATED);

      expect(await whoIsInvited(invitation)).toBe(user.uuid);
    });
  });

  describe('POST /users/pre-created-users/register - Registration from an invitation', () => {
    it('When the user signs up with the token of the invitation email, then the email is verified and the folder is shared with them', async () => {
      const { email, invitation } = await shareFolderWithEmailWithoutAccount();
      const token = signEmailLinkToken(
        EmailLinkTokenAction.Invitation,
        { email, invitationId: invitation.id, type: 'sharing' },
        invitation.expirationAt,
      );

      const user = await signUpFromInvitationLink(email, invitation, token);

      expect(user.emailVerified).toBe(true);
      expect(
        await sharingModel.count({
          where: { itemId: invitation.itemId, sharedWith: user.uuid },
        }),
      ).toBe(1);
    });

    it('When the user signs up without the token, then the email is not verified and the invitations stay pending', async () => {
      const { email, preCreatedUser, invitation } =
        await shareFolderWithEmailWithoutAccount();

      const user = await signUpFromInvitationLink(email, invitation);

      expect(user.emailVerified).toBe(false);
      expect(await whoIsInvited(invitation)).toBe(preCreatedUser.uuid);
    });

    it('When the user signs up with a token for another email, then the email is not verified and the invitations stay pending', async () => {
      const { email, preCreatedUser, invitation } =
        await shareFolderWithEmailWithoutAccount();
      const token = signEmailLinkToken(
        EmailLinkTokenAction.Invitation,
        {
          email: 'another@test.com',
          invitationId: invitation.id,
          type: 'sharing',
        },
        invitation.expirationAt,
      );

      const user = await signUpFromInvitationLink(email, invitation, token);

      expect(user.emailVerified).toBe(false);
      expect(await whoIsInvited(invitation)).toBe(preCreatedUser.uuid);
    });
  });

  describe('PATCH /users/profile - Profile update', () => {
    it('When the update includes fields not allowed, then only the name and lastname change', async () => {
      const freeTier = await featureLimitsRepository.getFreeTier();
      const paidTier = await tierModel.findOne({
        where: { id: { [Op.ne]: freeTier.id } },
      });
      const testUser = await createTestUser(app, {
        attributes: { tierId: freeTier.id, emailVerified: false },
      });
      const originalEmail = testUser.user.email;

      await request(app.getHttpServer())
        .patch('/users/profile')
        .set('Authorization', `Bearer ${testUser.token}`)
        .send({
          name: 'New name',
          lastname: 'New lastname',
          email: 'another-email@test.com',
          tierId: paidTier.id,
          emailVerified: true,
        })
        .expect(HttpStatus.OK);

      const updatedUser = await userModel.findOne({
        where: { uuid: testUser.user.uuid },
      });
      await testUser.cleanup();
      expect(updatedUser.name).toBe('New name');
      expect(updatedUser.lastname).toBe('New lastname');
      expect(updatedUser.email).toBe(originalEmail);
      expect(updatedUser.tierId).toBe(freeTier.id);
      expect(updatedUser.emailVerified).toBe(false);
    });
  });

  const shareFolderWithEmailWithoutAccount = async () => {
    const email = `invited-${v4()}@test.com`;
    const owner = await createTestUser(app);
    const [preCreatedUser] = await userUseCases.preCreateUser({ email });
    const role = await roleModel.findOne();
    const invitation = await sharingInviteModel.create({
      id: v4(),
      itemId: owner.rootFolder.uuid,
      itemType: 'folder',
      sharedWith: preCreatedUser.uuid,
      encryptionKey:
        await asymmetricEncryptionService.hybridEncryptMessageWithPublicKey({
          message: 'folder-encryption-key',
          publicKeyInBase64: preCreatedUser.publicKey,
          publicKyberKeyBase64: preCreatedUser.publicKyberKey,
        }),
      encryptionAlgorithm: HYBRID_ALGORITHM,
      type: 'OWNER',
      roleId: role.id,
      expirationAt: Time.dateWithTimeAdded(2, 'day'),
    });

    cleanups.push(async () => {
      await sharingModel.destroy({ where: { itemId: invitation.itemId } });
      await sharingInviteModel.destroy({ where: { id: invitation.id } });
      await preCreatedUserModel.destroy({ where: { email } });
      await owner.cleanup();
    });

    return { email, preCreatedUser, invitation };
  };

  const signUp = async (email: string) => {
    await registerUser(
      encryptRegistrationData(await generateValidRegistrationData({ email })),
    ).expect(HttpStatus.CREATED);

    return findCreatedUser(email);
  };

  const signUpFromInvitationLink = async (
    email: string,
    invitation: SharingInviteModel,
    token?: string,
  ) => {
    await request(app.getHttpServer())
      .post('/users/pre-created-users/register')
      .set('x-internxt-captcha', 'captcha-token')
      .send({
        ...encryptRegistrationData(
          await generateValidRegistrationData({ email }),
        ),
        invitationId: invitation.id,
        token,
      })
      .expect(HttpStatus.CREATED);

    return findCreatedUser(email);
  };

  const findCreatedUser = async (email: string) => {
    const user = await userModel.findOne({ where: { email } });
    createdUserIds.push(user.id);

    return user;
  };

  const whoIsInvited = async (invitation: SharingInviteModel) =>
    (await sharingInviteModel.findByPk(invitation.id)).sharedWith;
});
