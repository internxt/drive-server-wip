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

  constructor(configService: ConfigService) {
    this.configService = configService;
    this.client = this.connectToAPN();
  }

  private connectToAPN(): http2.ClientHttp2Session {
    const apnSecret = this.configService.get('apn.secret');
    const apnKeyId = this.configService.get('apn.keyId');
    const apnTeamId = this.configService.get('apn.teamId');
    const apnUrl = this.configService.get('apn.url');

    console.log('apnSecret', apnUrl);

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
      Logger.log('Connected to APN');
    });

    return client;
  }

  async sendNotification(deviceToken: string, payload: ApnAlert) {
    return new Promise((resolve, reject) => {
      if (!this.client || this.client.closed) {
        this.connectToAPN();
      }

      const headers: http2.OutgoingHttpHeaders = {
        [http2.constants.HTTP2_HEADER_METHOD]: 'POST',
        [http2.constants.HTTP2_HEADER_PATH]: `/3/device/${deviceToken}`,
        [http2.constants.HTTP2_HEADER_SCHEME]: 'https',
        [http2.constants.HTTP2_HEADER_AUTHORITY]: 'api.push.apple.com',
        [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: 'application/json',
        [http2.constants.HTTP2_HEADER_AUTHORIZATION]:
          `bearer ${this.generateJwt()}`,
        'apns-topic': `${this.configService.get('apn.bundleId')}`,
      };

      const req = this.client.request({
        ...headers,
      });

      req.setEncoding('utf8');

      req.write(
        JSON.stringify({
          aps: {
            alert: this.generateAlertBody(payload),
          },
        }),
      );

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
        console.log('statusCode', statusCode);
        if (statusCode > 399) {
          reject(new Error(JSON.parse(data).reason));
        } else {
          resolve({ statusCode, body: data });
        }
      });
    });
  }

  private generateJwt(): string {
    const apnSecret = this.configService.get('apn.secret');
    const apnKeyId = this.configService.get('apn.keyId');
    const apnTeamId = this.configService.get('apn.teamId');
    console.log('apnSecret', apnSecret);
    console.log('apnKeyId', apnKeyId);
    console.log('apnTeamId', apnTeamId);
    if (!apnSecret || !apnKeyId || !apnTeamId) {
      throw new Error(
        'Undefined APN env variables, necessary for JWT generation',
      );
    }
    if (this.jwt && Date.now() - this.jwtGeneratedAt < 3600 * 1000) {
      return this.jwt;
    }

    this.jwt = jwt.sign(
      {
        iss: apnTeamId,
        iat: Math.floor(Date.now() / 1000),
      },
      Buffer.from(apnSecret, 'base64').toString('utf8'),
      {
        algorithm: 'ES256',
        header: {
          alg: 'ES256',
          kid: apnKeyId,
          typ: undefined,
        } as JwtHeader,
      },
    );

    this.jwtGeneratedAt = Date.now();

    console.log('jwt', this.jwt);

    return this.jwt;
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(
        () => {
          Logger.log(
            `Attempting to reconnect to APN (#${this.reconnectAttempts + 1})`,
          );
          this.connectToAPN();
          this.reconnectAttempts++;
        },
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      );
    } else {
      Logger.error('Maximum APN reconnection attempts reached');
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
