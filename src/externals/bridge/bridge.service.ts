import { Logger } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileAttributes } from '../../modules/file/file.domain';
import { User } from '../../modules/user/user.domain';
import { UserAttributes } from '../../modules/user/user.attributes';
import { CryptoService } from '../crypto/crypto.service';
import { HttpClient } from '../http/http.service';

export function signToken(duration: string, secret: string) {
  return sign({}, Buffer.from(secret, 'base64').toString('utf8'), {
    algorithm: 'RS256',
    expiresIn: duration,
  });
}

@Injectable()
export class BridgeService {
  constructor(
    private readonly cryptoService: CryptoService,
    private readonly httpClient: HttpClient,
    @Inject(ConfigService)
    private configService: ConfigService,
  ) {}

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

    // log.info('[INXT createBucket]: User: %s, Bucket: %s', networkUser, name);

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
    const bcryptId = await this.cryptoService.hashBcrypt(networkUserId);
    const networkPassword = this.cryptoService.hashSha256(bcryptId);

    const jwt = signToken('5m', this.configService.get('secrets.gateway'));

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
        if (err.response.status === 404) {
          return;
        }
        throw err;
      });
  }

  async addStorage(uuid: UserAttributes['uuid'], bytes: number): Promise<void> {
    const { GATEWAY_USER, GATEWAY_PASS } = process.env;
    const url = this.configService.get('apis.storage.url');

    const params = {
      headers: { 'Content-Type': 'application/json' },
      auth: { username: GATEWAY_USER, password: GATEWAY_PASS },
    };

    await this.httpClient.put(
      `${url}/gateway/increment-storage-by-uuid`,
      { uuid, bytes },
      params,
    );
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
}
