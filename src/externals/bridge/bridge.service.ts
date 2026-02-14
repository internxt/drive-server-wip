import { Logger, Inject, Injectable, HttpStatus } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { FileAttributes } from '../../modules/file/file.domain';
import { User } from '../../modules/user/user.domain';
import { UserAttributes } from '../../modules/user/user.attributes';
import { CryptoService } from '../crypto/crypto.service';
import { HttpClient } from '../http/http.service';
import { AxiosError } from 'axios';
import { BridgeUserNotFoundException } from './exception/bridge-user-not-found.exception';
import { BridgeException } from './exception/bridge.exception';
import { BridgeUserEmailAlreadyInUseException } from './exception/bridge-user-email-already-in-use.exception';

function signToken(duration: string, secret: string, isDevelopment?: boolean) {
  return sign({}, Buffer.from(secret, 'base64').toString('utf8'), {
    algorithm: 'RS256',
    expiresIn: duration,
    ...(isDevelopment ? { allowInsecureKeySizes: true } : null),
  });
}

@Injectable()
export class BridgeService {
  constructor(
    private readonly cryptoService: CryptoService,
    private readonly httpClient: HttpClient,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  static handleUpdateUserEmailError(error: AxiosError) {
    switch (error.response.status) {
      case HttpStatus.CONFLICT:
        throw new BridgeUserEmailAlreadyInUseException();
      case HttpStatus.NOT_FOUND:
        throw new BridgeUserNotFoundException();
      default:
        throw new BridgeException('Error updating user email');
    }
  }

  private authorizationHeaders(user: string, password: string | number) {
    const hashedPassword = this.cryptoService.hashSha256(password.toString());
    const credential = Buffer.from(`${user}:${hashedPassword}`).toString(
      'base64',
    );
    return {
      Authorization: `Basic ${credential}`,
    };
  }

  async createBucket(
    networkUser: UserAttributes['bridgeUser'],
    networkPass: UserAttributes['userId'],
  ): Promise<{
    user: UserAttributes['bridgeUser'];
    encryptionKey: string;
    publicPermissions: string[];
    created: string;
    maxFrameSize: number;
    name: string;
    pubkeys: string[];
    transfer: number;
    storage: number;
    id: string;
  }> {
    const hashedPassword = this.cryptoService.hashSha256(networkPass);
    const credential = Buffer.from(`${networkUser}:${hashedPassword}`).toString(
      'base64',
    );

    const params = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credential}`,
      },
    };

    const url = this.configService.get('apis.storage.url');
    const res = await this.httpClient.post(`${url}/buckets`, {}, params);

    return res.data;
  }

  get networkUrl(): string {
    return this.configService.get('apis.storage.url');
  }

  async createUser(networkUserId: UserAttributes['bridgeUser']): Promise<{
    userId: UserAttributes['bridgeUser'];
    uuid: UserAttributes['uuid'];
  }> {
    const bcryptId = this.cryptoService.hashBcrypt(networkUserId);
    const networkPassword = this.cryptoService.hashSha256(bcryptId);

    const jwt = signToken(
      '5m',
      this.configService.get('secrets.gateway'),
      this.configService.get('isDevelopment'),
    );

    const response = await this.httpClient.post(
      `${this.networkUrl}/v2/gateway/users`,
      { email: networkUserId, password: networkPassword },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
      },
    );

    return { userId: bcryptId, uuid: response.data.uuid };
  }

  public async deleteFile(
    user: Pick<User, 'bridgeUser' | 'userId'>,
    bucket: FileAttributes['bucket'],
    bucketEntry: FileAttributes['fileId'],
  ): Promise<void> {
    const url = this.configService.get('apis.storage.url');
    const params = {
      headers: {
        'Content-Type': 'application/json',
        ...this.authorizationHeaders(user.bridgeUser, user.userId),
      },
    };

    Logger.log(
      `[INXT removeFile]: User: ${user.bridgeUser}, Bucket: ${bucket}, File: ${bucketEntry}`,
    );

    await this.httpClient
      .delete(`${url}/buckets/${bucket}/files/${bucketEntry}`, params)
      .catch((err) => {
        if (err.response.status !== 500) {
          Logger.log(
            `[INXT removeFile]: Error User: ${user.bridgeUser}, Bucket: ${bucket}, File: ${bucketEntry}`,
          );
          return;
        }
        throw err;
      });
  }

  async addStorage(uuid: UserAttributes['uuid'], bytes: number): Promise<void> {
    try {
      const url = this.configService.get('apis.storage.url');
      const username = this.configService.get('apis.storage.auth.username');
      const password = this.configService.get('apis.storage.auth.password');

      const params = {
        headers: { 'Content-Type': 'application/json' },
        auth: { username, password },
      };

      await this.httpClient.put(
        `${url}/gateway/increment-storage-by-uuid`,
        { uuid, bytes },
        params,
      );
    } catch (error) {
      Logger.error(`
      BridgeService/addStorage: 
      
      Params: 
        uuid: ${uuid}
        bytes: ${bytes}
   
      AddStorage Error: ${JSON.stringify(error)}
      `);
    }
  }

  async setStorage(email: UserAttributes['email'], bytes: number) {
    try {
      const url = this.configService.get('apis.storage.url');
      const username = this.configService.get('apis.storage.auth.username');
      const password = this.configService.get('apis.storage.auth.password');

      const params = {
        headers: { 'Content-Type': 'application/json' },
        auth: { username, password },
      };

      await this.httpClient.post(
        `${url}/gateway/upgrade`,
        { email, bytes },
        params,
      );
    } catch (error) {
      Logger.error(`
      [BRIDGESERVICE/SETSTORAGE]: There was an error while trying to set user storage space Error: ${JSON.stringify(
        error,
      )}
      `);
      throw error;
    }
  }

  async getLimit(
    networkUser: UserAttributes['bridgeUser'],
    networkPass: UserAttributes['userId'],
  ): Promise<number> {
    const hashedNetworkPassword = this.cryptoService.hashSha256(networkPass);
    const basicAuth = Buffer.from(
      `${networkUser}:${hashedNetworkPassword}`,
    ).toString('base64');

    const url = this.configService.get('apis.storage.url');

    return this.httpClient
      .get(`${url}/limit`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${basicAuth}`,
        },
      })
      .then<number>((response) => response.data.maxSpaceBytes);
  }

  async updateUserEmail(userUUID: string, newEmail: string): Promise<any> {
    try {
      const jwt = signToken(
        '5m',
        this.configService.get('secrets.gateway'),
        this.configService.get('isDevelopment'),
      );

      const params = {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
      };

      await this.httpClient.patch(
        `${this.networkUrl}/v2/gateway/users/${userUUID}`,
        { email: newEmail },
        params,
      );
    } catch (error) {
      if (error instanceof AxiosError) {
        BridgeService.handleUpdateUserEmailError(error);
      }

      throw error;
    }
  }

  async sendDeactivationEmail(
    user: Pick<User, 'bridgeUser' | 'userId' | 'email'>,
    deactivationRedirectUrl: string,
    deactivator: string,
  ): Promise<void> {
    try {
      const bridgeApiUrl = this.configService.get('apis.storage.url');

      const params = {
        headers: {
          'Content-Type': 'application/json',
          ...this.authorizationHeaders(user.bridgeUser, user.userId),
        },
      };

      await this.httpClient.delete(
        `${bridgeApiUrl}/users/${user.email}?redirect=${deactivationRedirectUrl}&deactivator=${deactivator}`,
        params,
      );
    } catch (error) {
      Logger.error(`
        [BRIDGE_SERVICE/DEACTIVATION_EMAIL]: There was an error while trying to send deactivation email Error: ${JSON.stringify(
          error,
        )}`);
      throw error;
    }
  }

  async confirmDeactivation(token: string): Promise<string> {
    try {
      const bridgeApiUrl = this.configService.get('apis.storage.url');

      const params = {
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await this.httpClient.get(
        `${bridgeApiUrl}/deactivationStripe/${token}`,
        params,
      );

      return response.data.email;
    } catch (error) {
      Logger.error(
        { error, token },
        '[BRIDGE_SERVICE/DEACTIVATE_USER]: There was an error while trying to deactivate user',
      );
      throw error;
    }
  }
}
