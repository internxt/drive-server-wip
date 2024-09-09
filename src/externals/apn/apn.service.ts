import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as http2 from 'http2';
import jwt, { JwtHeader } from 'jsonwebtoken';
import { ApnAlert } from './apn.types';

@Injectable()
export class ApnService {
  private static instance: ApnService;
  private configService: ConfigService;
  private client: http2.ClientHttp2Session;
  private readonly maxReconnectAttempts = 3;
  private reconnectAttempts = 0;
  private reconnectDelay = 1000;
  private jwt: string | null = null;
  private jwtGeneratedAt = 0;
  private lastActivity = Date.now();
  private readonly pingInterval = 3600 * 1000;
  private pingIntervalId: NodeJS.Timeout | null = null;
  private topic: string;

  private apnSecret: string;
  private apnKeyId: string;
  private apnTeamId: string;

  constructor(
    {
      topic,
      secret,
      keyId,
      teamId,
    }: {
      topic: string;
      secret: string;
      keyId: string;
      teamId: string;
    },
    configService: ConfigService,
  ) {
    this.configService = configService;
    this.client = this.connectToAPN();
    this.schedulePing();

    this.topic = topic;
    this.apnSecret = secret;
    this.apnKeyId = keyId;
    this.apnTeamId = teamId;
  }

  private connectToAPN(): http2.ClientHttp2Session {
    const apnSecret = this.configService.get('apn.secret');
    const apnKeyId = this.configService.get('apn.keyId');
    const apnTeamId = this.configService.get('apn.teamId');
    const apnUrl = this.configService.get('apn.url');

    if (!apnSecret || !apnKeyId || !apnTeamId || !apnUrl) {
      Logger.warn('APN env variables are not defined');
    }

    const client = http2.connect(apnUrl);

    client.on('error', (err) => {
      Logger.error('APN connection error:', err.message);
      Logger.error('Error stack:', err.stack);
      Logger.error('Full error object:', err);
    });
    client.on('close', () => {
      Logger.warn('APN connection was closed');
      this.handleReconnect();
    });
    client.on('connect', () => {
      this.reconnectAttempts = 0;
      this.lastActivity = Date.now();
      Logger.log('Connected to APN');
    });

    return client;
  }

  async sendNotification(
    deviceToken: string,
    payload: ApnAlert,
    userUuid?: string,
    isStorageNotification = false,
  ) {
    return new Promise((resolve, reject) => {
      if (!this.client || this.client.closed) {
        this.client = this.connectToAPN();
      }

      const headers: http2.OutgoingHttpHeaders = {
        [http2.constants.HTTP2_HEADER_METHOD]: 'POST',
        [http2.constants.HTTP2_HEADER_PATH]: `/3/device/${deviceToken}`,
        [http2.constants.HTTP2_HEADER_SCHEME]: 'https',
        [http2.constants.HTTP2_HEADER_AUTHORITY]:
          this.configService.get('apn.url'),
        [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: 'application/json',
        [http2.constants.HTTP2_HEADER_AUTHORIZATION]:
          `bearer ${this.generateJwt()}`,
        'apns-topic': this.topic,
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
          Logger.log(
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
      Logger.error('Maximum APN reconnection attempts reached');
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
          Logger.error('APN PING error', err);
        } else {
          Logger.log('APN PING sent successfully');
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
