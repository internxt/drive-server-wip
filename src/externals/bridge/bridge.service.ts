import { Logger } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { rejectedSyncPromise } from '@sentry/utils';
import { FileAttributes } from 'src/modules/file/file.domain';
import { User } from 'src/modules/user/user.domain';
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
