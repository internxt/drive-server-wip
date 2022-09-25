import { Logger } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { FileAttributes } from 'src/modules/file/file.domain';
import { User, UserAttributes } from 'src/modules/user/user.domain';
import { CryptoService } from '../crypto/crypto';
import { HttpClient } from '../http/http.service';

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
  ): Promise<any> {
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

    return this.httpClient.post(`${url}/buckets`, {}, params);
  }

  get networkUrl(): string {
    return this.configService.get('apis.storage.url');
  }

  async createUser(networkUserId: UserAttributes['bridgeUser']): Promise<{
    userId: UserAttributes['bridgeUser'];
    uuid: UserAttributes['uuid'];
  }> {
    const networkPassword = await this.cryptoService.hashBcrypt(networkUserId);

    const networkUser = await this.httpClient.post(
      `${this.networkUrl}/users`,
      { email: networkUserId, password: networkPassword },
      { headers: { 'Content-Type': 'application/json' } },
    );

    return { userId: networkPassword, uuid: networkUser.data.uuid };
  }

  public async deleteFile(
    user: User,
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

    await this.httpClient.delete(
      `${url}/buckets/${bucket}/files/${bucketEntry}`,
      params,
    );
  }
}
