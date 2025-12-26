import { HttpStatus } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { getModelToken } from '@nestjs/sequelize';
import request from 'supertest';

import { createTestApp } from '../../../test/helpers/test-app.helper';
import {
  generateValidRegistrationData,
  RegisterUserDto,
} from '../../../test/helpers/register.helper';
import { UserModel } from './user.model';
import { FolderModel } from '../folder/folder.model';
import { FileModel } from '../file/file.model';
import { KeyServerModel } from '../keyserver/key-server.model';
import { CryptoService } from '../../externals/crypto/crypto.service';

describe('User Registration E2E', () => {
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

  const registerUser = (data: RegisterUserDto) => {
    return request(app.getHttpServer()).post('/users').send(data);
  };

  describe('POST /users - User Registration', () => {
    describe('Users can register successfully with valid data', () => {
      it('When valid registration data is provided, then user is created successfully', async () => {
        const registrationData = generateValidRegistrationData();
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
        const registrationData = generateValidRegistrationData();
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
        const registrationData = generateValidRegistrationData();
        delete (registrationData as any).email;

        await registerUser(registrationData).expect(HttpStatus.BAD_REQUEST);
      });

      it('When name is missing, then registration fails with 400', async () => {
        const registrationData = generateValidRegistrationData();
        delete (registrationData as any).name;

        await registerUser(registrationData).expect(HttpStatus.BAD_REQUEST);
      });

      it('When password is missing, then registration fails with 400', async () => {
        const registrationData = generateValidRegistrationData();
        delete (registrationData as any).password;

        await registerUser(registrationData).expect(HttpStatus.BAD_REQUEST);
      });

      it('When mnemonic is missing, then registration fails with 400', async () => {
        const registrationData = generateValidRegistrationData();
        delete (registrationData as any).mnemonic;

        await registerUser(registrationData).expect(HttpStatus.BAD_REQUEST);
      });

      it('When email is invalid format, then registration fails with 400', async () => {
        const registrationData = generateValidRegistrationData({
          email: 'invalid-email',
        });

        await registerUser(registrationData).expect(HttpStatus.BAD_REQUEST);
      });

      it('When email is already registered, then registration fails with 409', async () => {
        const registrationData = generateValidRegistrationData();
        const encryptedData = encryptRegistrationData(registrationData);

        await registerUser(encryptedData).expect(HttpStatus.CREATED);

        const createdUser = await userModel.findOne({
          where: { email: registrationData.email },
        });
        createdUserIds.push(createdUser.id);

        const duplicateData = generateValidRegistrationData({
          email: registrationData.email,
        });
        const encryptedDuplicate = encryptRegistrationData(duplicateData);

        await registerUser(encryptedDuplicate).expect(HttpStatus.CONFLICT);
      });

      it('When name exceeds 100 characters, then registration fails with 400', async () => {
        const registrationData = generateValidRegistrationData({
          name: 'a'.repeat(101),
        });

        await registerUser(registrationData).expect(HttpStatus.BAD_REQUEST);
      });

      it('When lastname exceeds 100 characters, then registration fails with 400', async () => {
        const registrationData = generateValidRegistrationData({
          lastname: 'a'.repeat(101),
        });

        await registerUser(registrationData).expect(HttpStatus.BAD_REQUEST);
      });
    });

    describe('All user resources are created correctly after registration', () => {
      it('When registration is successful, then root folder is created', async () => {
        const registrationData = generateValidRegistrationData();
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
        const registrationData = generateValidRegistrationData();
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
        const registrationData = generateValidRegistrationData();
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
    });
  });
});
