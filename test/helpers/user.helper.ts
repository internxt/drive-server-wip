import { type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { v4 } from 'uuid';
import { UserModel } from '../../src/modules/user/user.model';
import { FolderModel } from '../../src/modules/folder/folder.model';
import { User } from '../../src/modules/user/user.domain';
import { Folder } from '../../src/modules/folder/folder.domain';
import { type UserAttributes } from '../../src/modules/user/user.attributes';
import { Sign } from '../../src/middlewares/passport';
import getEnv from '../../src/config/configuration';
import { FileModel } from '../../src/modules/file/file.model';

export interface CreateTestUserOptions {
  attributes?: Partial<UserAttributes>;
}

export interface TestUserContext {
  user: User;

  rootFolder?: Folder;
  token: string;
  cleanup: () => Promise<void>;
}

export async function createTestUser(
  app: INestApplication,
  options: CreateTestUserOptions = {},
): Promise<TestUserContext> {
  const { attributes = {} } = options;
  const userModel = app.get(getModelToken(UserModel));
  const folderModel = app.get(getModelToken(FolderModel));
  const fileModel = app.get(getModelToken(FileModel));

  const timestamp = Date.now();
  const randomSuffix = v4().substring(0, 8);
  const testEmail =
    attributes.email || `test-${timestamp}-${randomSuffix}@test.com`;

  const userAttributes: Partial<UserAttributes> = {
    userId: v4().substring(0, 24),
    name: 'Test',
    lastname: 'User',
    uuid: v4(),
    email: testEmail,
    username: testEmail,
    bridgeUser: testEmail,
    password: 'hashed-test-password',
    mnemonic: 'mnemonic',
    referralCode: v4().substring(0, 8),
    hKey: Buffer.from('test-hkey'),
    errorLoginCount: 0,
    registerCompleted: true,
    secret_2FA: '',
    backupsBucket: '',
    sharedWorkspace: false,
    avatar: null,
    emailVerified: true,
    ...attributes,
  };

  const createdUser = await userModel.create(userAttributes);
  const rootFolderAttributes = {
    uuid: v4(),
    name: 'root',
    plainName: 'root',
    bucket: v4().substring(0, 24),
    userId: createdUser.id,
    parentId: null,
    parentUuid: null,
    encryptVersion: '03-aes',
    deleted: false,
    removed: false,
    deletedAt: null,
    removedAt: null,
    creationTime: new Date(),
    modificationTime: new Date(),
  };
  const createdRootFolder = await folderModel.create(rootFolderAttributes);
  const rootFolder = Folder.build({
    ...createdRootFolder.toJSON(),
  });

  await userModel.update(
    { rootFolderId: createdRootFolder.id },
    { where: { id: createdUser.id } },
  );
  const user = User.build({
    ...createdUser.toJSON(),
    rootFolder: rootFolder || null,
  });

  const secret = getEnv().secrets.jwt;
  const token = Sign(
    {
      jti: v4(),
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
      },
    },
    secret,
  );

  const cleanup = async () => {
    await userModel.destroy({ where: { id: createdUser.id } });
    await fileModel.destroy({ where: { userId: createdUser.id } });
    await folderModel.destroy({ where: { userId: createdUser.id } });
  };

  return {
    user,
    rootFolder,
    token,
    cleanup,
  };
}
