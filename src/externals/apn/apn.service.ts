import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as http2 from 'http2';
import jwt, { type JwtHeader } from 'jsonwebtoken';
import { type ApnAlert } from './apn.types';

@Injectable()
export class ApnService {
  private readonly logger = new Logger(ApnService.name);

  private client: http2.ClientHttp2Session;
  private readonly maxReconnectAttempts = 3;
  private reconnectAttempts = 0;
  private readonly reconnectDelay = 1000;
  private jwt: string | null = null;
  private jwtGeneratedAt = 0;
  private lastActivity = Date.now();
  private readonly pingInterval = 3600 * 1000;
  private pingIntervalId: NodeJS.Timeout | null = null;
  private readonly topic: string;

  private readonly apnSecret: string;
  private readonly apnKeyId: string;
  private readonly apnTeamId: string;
  private readonly bundleId: string;
  private readonly apnUrl: string;

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {
    this.apnSecret = this.configService.get('apn.secret');
    this.apnKeyId = this.configService.get('apn.keyId');
    this.apnTeamId = this.configService.get('apn.teamId');
    this.bundleId = this.configService.get('apn.bundleId');
    this.apnUrl = this.configService.get('apn.url');

    this.client = this.connectToAPN();
    this.schedulePing();
  }

  private connectToAPN(): http2.ClientHttp2Session {
    if (!this.apnSecret || !this.apnKeyId || !this.apnTeamId || !this.apnUrl) {
      this.logger.warn('APN env variables are not defined');
      return null;
    }

    const client = http2.connect(this.apnUrl);

    client.on('error', (err) => {
      this.logger.error('APN connection error:', err.message);
      this.logger.error('Error stack:', err.stack);
      this.logger.error('Full error object:', err);
    });
    client.on('close', () => {
      this.logger.warn('APN connection was closed');
      this.handleReconnect();
    });
    client.on('connect', () => {
      this.reconnectAttempts = 0;
      this.lastActivity = Date.now();
      this.logger.log('Connected to APN');
    });

    return client;
  }

  async sendNotification(
    deviceToken: string,
    payload: ApnAlert,
    userUuid?: string,
    isStorageNotification = false,
    customKeys: Record<string, any> = {},
  ): Promise<{
    statusCode: number;
    body: string;
  } | null> {
    return new Promise((resolve, reject) => {
      if (!this.client || this.client.closed) {
        this.logger.warn(
          'APN client session is closed, attempting to reconnect',
        );
        this.client = this.connectToAPN();
      }

      const headers: http2.OutgoingHttpHeaders = {
        [http2.constants.HTTP2_HEADER_METHOD]: 'POST',
        [http2.constants.HTTP2_HEADER_PATH]: `/3/device/${deviceToken}`,
        [http2.constants.HTTP2_HEADER_SCHEME]: 'https',
        [http2.constants.HTTP2_HEADER_AUTHORITY]: this.apnUrl,
        [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: 'application/json',
        [http2.constants.HTTP2_HEADER_AUTHORIZATION]:
          `bearer ${this.generateJwt()}`,
        'apns-topic': `${this.bundleId}.pushkit.fileprovider`,
      };

      const req = this.client.request({ ...headers });

      req.setEncoding('utf8');

      if (isStorageNotification && userUuid) {
        req.write(
          JSON.stringify({
            'container-identifier':
              'NSFileProviderWorkingSetContainerItemIdentifier',
            domain: userUuid,
          }),
        );
      } else {
        req.write(
          JSON.stringify({
            aps: {
              alert: this.generateAlertBody(payload),
            },
            customKeys,
          }),
        );
      }

      req.end();

      let statusCode = 0;
      let data = '';

      req.on('response', (res) => {
        statusCode = res[':status'] || 0;
      });

      req.on('data', (chunk) => {
        data += chunk;
      });

      req.on('end', () => {
        if (statusCode > 399) {
          reject(new Error(JSON.parse(data).reason));
        } else {
          resolve({ statusCode, body: data });
        }
      });
    });
  }

  private generateJwt(): string {
    if (this.jwt && Date.now() - this.jwtGeneratedAt < 3500 * 1000) {
      // 3500 seconds to add buffer
      return this.jwt;
    }

    this.jwt = jwt.sign(
      {
        iss: this.apnTeamId,
        iat: Math.floor(Date.now() / 1000),
      },
      Buffer.from(this.apnSecret, 'base64').toString('utf8'),
      {
        algorithm: 'ES256',
        header: {
          alg: 'ES256',
          kid: this.apnKeyId,
          typ: undefined,
        } as JwtHeader,
      },
    );

    this.jwtGeneratedAt = Date.now();

    return this.jwt;
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(
        () => {
          this.logger.log(
            `Attempting to reconnect to APN (#${this.reconnectAttempts + 1})`,
          );
          if (this.client && !this.client.closed) {
            this.client.close();
          }
          this.client = this.connectToAPN();
          this.reconnectAttempts++;
        },
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      );
    } else {
      this.logger.error('Maximum APN reconnection attempts reached');
    }
  }

  private schedulePing() {
    this.pingIntervalId = setInterval(() => {
      if (Date.now() - this.lastActivity >= this.pingInterval) {
        this.sendPing();
      }
    }, this.pingInterval);
  }

  private sendPing() {
    if (this.client && !this.client.closed) {
      this.client.ping((err) => {
        if (err) {
          this.logger.error('APN PING error', err);
        } else {
          this.logger.log('APN PING sent successfully');
          this.lastActivity = Date.now();
        }
      });
    }
  }

  public close() {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
    if (this.client && !this.client.closed) {
      this.client.close();
    }
  }

  private convertToKebabCase(key: string): string {
    return key.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  }

  private generateAlertBody(payload: ApnAlert) {
    const alert = {};
    for (const key in payload) {
      alert[this.convertToKebabCase(key)] = payload[key];
    }
    return alert;
  }
}
