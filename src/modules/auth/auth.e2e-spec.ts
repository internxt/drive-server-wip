import { HttpStatus } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { getModelToken } from '@nestjs/sequelize';
import request from 'supertest';
import speakeasy from 'speakeasy';

import { createTestApp } from '../../../test/helpers/test-app.helper';
import {
  generateValidRegistrationData,
  generateHashedPassword,
  RegisterUserDto,
} from '../../../test/helpers/register.helper';
import { UserModel } from '../user/user.model';
import { FolderModel } from '../folder/folder.model';
import { FileModel } from '../file/file.model';
import { KeyServerModel } from '../keyserver/key-server.model';
import { CryptoService } from '../../externals/crypto/crypto.service';

describe('User Authentication E2E', () => {
  let app: NestExpressApplication;
  let userModel: typeof UserModel;
  let folderModel: typeof FolderModel;
  let fileModel: typeof FileModel;
  let keyServerModel: typeof KeyServerModel;
  let cryptoService: CryptoService;
  let createdUserIds: number[] = [];

  const encryptRegistrationData = (data: RegisterUserDto): RegisterUserDto => {
    return {
      ...data,
      password: cryptoService.encryptText(data.password),
      salt: cryptoService.encryptText(data.salt),
    };
  };

  const registerUser = async (
    data: RegisterUserDto,
  ): Promise<{ email: string; password: string; userId: number }> => {
    const encryptedData = encryptRegistrationData(data);
    await request(app.getHttpServer())
      .post('/users')
      .send(encryptedData)
      .expect(HttpStatus.CREATED);

    const createdUser = await userModel.findOne({
      where: { email: data.email },
    });
    createdUserIds.push(createdUser.id);

    return {
      email: data.email,
      password: encryptedData.password,
      userId: createdUser.id,
    };
  };

  beforeAll(async () => {
    app = await createTestApp();
    userModel = app.get(getModelToken(UserModel));
    folderModel = app.get(getModelToken(FolderModel));
    fileModel = app.get(getModelToken(FileModel));
    keyServerModel = app.get(getModelToken(KeyServerModel));
    cryptoService = app.get(CryptoService);
  });

  afterEach(async () => {
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

  describe('Security details retrieval on auth login', () => {
    describe('Returns security details for valid email', () => {
      it('When email exists, then returns sKey and security flags', async () => {
        const registrationData = generateValidRegistrationData();
        await registerUser(registrationData);

        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: registrationData.email })
          .expect(HttpStatus.OK);

        expect(response.body).toHaveProperty('sKey');
        expect(response.body).toHaveProperty('tfa');
        expect(response.body).toHaveProperty('hasKeys');
        expect(response.body).toHaveProperty('hasEccKeys');
        expect(response.body).toHaveProperty('hasKyberKeys');
        expect(typeof response.body.sKey).toBe('string');
        expect(typeof response.body.tfa).toBe('boolean');
      });

      it('When user has ECC keys, then hasEccKeys is true', async () => {
        const registrationData = generateValidRegistrationData();
        await registerUser(registrationData);

        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: registrationData.email })
          .expect(HttpStatus.OK);

        expect(response.body.hasEccKeys).toBe(true);
      });

      it('When user has no 2FA enabled, then tfa is false', async () => {
        const registrationData = generateValidRegistrationData();
        await registerUser(registrationData);

        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: registrationData.email })
          .expect(HttpStatus.OK);

        expect(response.body.tfa).toBe(false);
      });
    });

    describe('Rejects requests with non-existent email', () => {
      it('When email does not exist, then returns 401', async () => {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'nonexistent@test.com' })
          .expect(HttpStatus.UNAUTHORIZED);
      });

      it('When email format is invalid, then returns 400', async () => {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'invalid-email' })
          .expect(HttpStatus.BAD_REQUEST);
      });

      it('When email is missing, then returns 400', async () => {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({})
          .expect(HttpStatus.BAD_REQUEST);
      });
    });
  });

  describe('User authentication on login access', () => {
    describe('Returns token and user data with valid credentials', () => {
      it('When credentials are valid, then returns user object', async () => {
        const registrationData = generateValidRegistrationData();
        const { email, password } = await registerUser(registrationData);

        const response = await request(app.getHttpServer())
          .post('/auth/login/access')
          .send({ email, password })
          .expect(HttpStatus.OK);

        expect(response.body).toHaveProperty('user');
        expect(response.body.user.email).toBe(email);
        expect(response.body.user.name).toBe(registrationData.name);
        expect(response.body.user.lastname).toBe(registrationData.lastname);
      });

      it('When credentials are valid, then returns both tokens', async () => {
        const registrationData = generateValidRegistrationData();
        const { email, password } = await registerUser(registrationData);

        const response = await request(app.getHttpServer())
          .post('/auth/login/access')
          .send({ email, password })
          .expect(HttpStatus.OK);

        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('newToken');
        expect(typeof response.body.token).toBe('string');
        expect(typeof response.body.newToken).toBe('string');
        expect(response.body.token.length).toBeGreaterThan(0);
        expect(response.body.newToken.length).toBeGreaterThan(0);
      });

      it('When credentials are valid, then returns user UUID and root folder', async () => {
        const registrationData = generateValidRegistrationData();
        const { email, password } = await registerUser(registrationData);

        const response = await request(app.getHttpServer())
          .post('/auth/login/access')
          .send({ email, password })
          .expect(HttpStatus.OK);

        expect(response.body.user.uuid).toBeDefined();
        expect(response.body.user.uuid).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
        expect(response.body.user.rootFolderId).toBeDefined();
      });

      it('When credentials are valid, then returns user keys', async () => {
        const registrationData = generateValidRegistrationData();
        const { email, password } = await registerUser(registrationData);

        const response = await request(app.getHttpServer())
          .post('/auth/login/access')
          .send({ email, password })
          .expect(HttpStatus.OK);

        expect(response.body.user.keys).toBeDefined();
        expect(response.body.user.keys.ecc).toBeDefined();
        expect(response.body.user.keys.ecc.publicKey).toBeDefined();
        expect(response.body.user.keys.ecc.privateKey).toBeDefined();
      });

      it('When login is successful, then userTeam is null', async () => {
        const registrationData = generateValidRegistrationData();
        const { email, password } = await registerUser(registrationData);

        const response = await request(app.getHttpServer())
          .post('/auth/login/access')
          .send({ email, password })
          .expect(HttpStatus.OK);

        expect(response.body.userTeam).toBeNull();
      });
    });

    describe('Rejects requests with invalid credentials', () => {
      it('When password is incorrect, then returns 401', async () => {
        const registrationData = generateValidRegistrationData();
        const { email } = await registerUser(registrationData);

        await request(app.getHttpServer())
          .post('/auth/login/access')
          .send({ email, password: generateHashedPassword() })
          .expect(HttpStatus.UNAUTHORIZED);
      });

      it('When email does not exist, then returns 401', async () => {
        await request(app.getHttpServer())
          .post('/auth/login/access')
          .send({
            email: 'nonexistent@test.com',
            password: generateHashedPassword(),
          })
          .expect(HttpStatus.UNAUTHORIZED);
      });

      it('When email is missing, then returns 400', async () => {
        await request(app.getHttpServer())
          .post('/auth/login/access')
          .send({ password: generateHashedPassword() })
          .expect(HttpStatus.BAD_REQUEST);
      });

      it('When password is missing, then returns 400', async () => {
        const registrationData = generateValidRegistrationData();
        const { email } = await registerUser(registrationData);

        await request(app.getHttpServer())
          .post('/auth/login/access')
          .send({ email })
          .expect(HttpStatus.BAD_REQUEST);
      });

      it('When email format is invalid, then returns 400', async () => {
        await request(app.getHttpServer())
          .post('/auth/login/access')
          .send({ email: 'invalid-email', password: generateHashedPassword() })
          .expect(HttpStatus.BAD_REQUEST);
      });
    });

    describe('Account blocking after failed attempts', () => {
      it('When login fails, then errorLoginCount increments', async () => {
        const registrationData = generateValidRegistrationData();
        const { email, userId } = await registerUser(registrationData);

        for (let i = 1; i <= 3; i++) {
          await request(app.getHttpServer())
            .post('/auth/login/access')
            .send({ email, password: generateHashedPassword() })
            .expect(HttpStatus.UNAUTHORIZED);

          const user = await userModel.findOne({ where: { id: userId } });
          expect(user.errorLoginCount).toBe(i);
        }
      });

      it('When account has 10 failed attempts, then returns 403', async () => {
        const registrationData = generateValidRegistrationData();
        const { email, userId } = await registerUser(registrationData);

        await userModel.update(
          { errorLoginCount: 10 },
          { where: { id: userId } },
        );

        await request(app.getHttpServer())
          .post('/auth/login/access')
          .send({ email, password: generateHashedPassword() })
          .expect(HttpStatus.FORBIDDEN);
      });

      it('When login succeeds, then errorLoginCount resets to 0', async () => {
        const registrationData = generateValidRegistrationData();
        const { email, password, userId } =
          await registerUser(registrationData);

        await userModel.update(
          { errorLoginCount: 5 },
          { where: { id: userId } },
        );

        await request(app.getHttpServer())
          .post('/auth/login/access')
          .send({ email, password })
          .expect(HttpStatus.OK);

        const user = await userModel.findOne({ where: { id: userId } });
        expect(user.errorLoginCount).toBe(0);
      });
    });

    describe('Two-factor authentication', () => {
      // Database column secret_2_f_a is VARCHAR(40), so we truncate the secret
      const generateTfaSecret = () =>
        speakeasy.generateSecret().base32.substring(0, 40);

      it('When 2FA is enabled and no code provided, then returns 401', async () => {
        const registrationData = generateValidRegistrationData();
        const { email, password, userId } =
          await registerUser(registrationData);

        const secret = generateTfaSecret();
        await userModel.update(
          { secret_2FA: secret },
          { where: { id: userId } },
        );

        await request(app.getHttpServer())
          .post('/auth/login/access')
          .send({ email, password })
          .expect(HttpStatus.UNAUTHORIZED);
      });

      it('When 2FA is enabled and wrong code provided, then returns 401', async () => {
        const registrationData = generateValidRegistrationData();
        const { email, password, userId } =
          await registerUser(registrationData);

        const secret = generateTfaSecret();
        await userModel.update(
          { secret_2FA: secret },
          { where: { id: userId } },
        );

        await request(app.getHttpServer())
          .post('/auth/login/access')
          .send({ email, password, tfa: '000000' })
          .expect(HttpStatus.UNAUTHORIZED);
      });

      it('When 2FA is enabled and correct code provided, then returns 200', async () => {
        const registrationData = generateValidRegistrationData();
        const { email, password, userId } =
          await registerUser(registrationData);

        const secret = generateTfaSecret();
        await userModel.update(
          { secret_2FA: secret },
          { where: { id: userId } },
        );

        const validCode = speakeasy.totp({
          secret: secret,
          encoding: 'base32',
        });

        await request(app.getHttpServer())
          .post('/auth/login/access')
          .send({ email, password, tfa: validCode })
          .expect(HttpStatus.OK);
      });

      it('When user has 2FA enabled, then /auth/login returns tfa true', async () => {
        const registrationData = generateValidRegistrationData();
        const { userId } = await registerUser(registrationData);

        const secret = generateTfaSecret();
        await userModel.update(
          { secret_2FA: secret },
          { where: { id: userId } },
        );

        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: registrationData.email })
          .expect(HttpStatus.OK);

        expect(response.body.tfa).toBe(true);
      });
    });
  });
});
