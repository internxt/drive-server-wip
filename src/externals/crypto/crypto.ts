import { Logger } from '@nestjs/common';
import { AesService } from './aes';
import CryptoJS from 'crypto-js';
import crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

export class CryptoService {
  private static instance: CryptoService;

  private configService: ConfigService;
  private aesService: AesService;
  private cryptoSecret: string;

  private constructor(configService: ConfigService) {
    this.configService = configService;
    this.aesService = new AesService(
      this.configService.get('secrets.magicIv'),
      this.configService.get('secrets.magicSalt'),
      this.configService.get('secrets.cryptoSecret2'),
    );
    this.cryptoSecret = process.env.CRYPTO_SECRET;
  }

  static getInstance(configService: ConfigService): CryptoService {
    return (
      CryptoService.instance ||
      (this.instance = new CryptoService(configService))
    );
  }

  encryptName(name, salt) {
    if (salt) {
      return this.aesService.encrypt(name, salt, salt === undefined);
    }
    return this.probabilisticEncryption(name);
  }

  deterministicEncryption(content, salt) {
    try {
      const key = CryptoJS.enc.Hex.parse(this.cryptoSecret);
      const iv = salt ? CryptoJS.enc.Hex.parse(salt.toString()) : key;

      const encrypt = CryptoJS.AES.encrypt(content, key, { iv }).toString();
      const b64 = CryptoJS.enc.Base64.parse(encrypt);
      const eHex = b64.toString(CryptoJS.enc.Hex);

      return eHex;
    } catch (e) {
      return null;
    }
  }

  probabilisticEncryption(content) {
    try {
      const b64 = CryptoJS.AES.encrypt(content, this.cryptoSecret).toString();
      const e64 = CryptoJS.enc.Base64.parse(b64);
      const eHex = e64.toString(CryptoJS.enc.Hex);

      return eHex;
    } catch (error) {
      Logger.error(`(probabilisticEncryption): ${error}`);

      return null;
    }
  }

  /* DECRYPT */

  decryptName(cipherText, salt) {
    if (salt) {
      try {
        return this.aesService.decrypt(cipherText, salt);
      } catch (e) {
        // no op
      }
      // If salt is provided, we could have 2 scenarios
      // 1. The cipherText is truly encripted with salt in a deterministic way
      const decrypted = this.deterministicDecryption(cipherText, salt);

      if (!decrypted) {
        // 2. The deterministic algorithm failed although salt were provided.
        // So, the cipherText is encrypted in a probabilistic way.

        return this.probabilisticDecryption(cipherText);
      }

      return decrypted;
    }
    // If no salt, something is trying to use legacy decryption
    return this.probabilisticDecryption(cipherText);
  }

  deterministicDecryption(cipherText, salt) {
    try {
      const key = CryptoJS.enc.Hex.parse(this.cryptoSecret);
      const iv = salt ? CryptoJS.enc.Hex.parse(salt.toString()) : key;

      const reb64 = CryptoJS.enc.Hex.parse(cipherText);
      const bytes = reb64.toString(CryptoJS.enc.Base64);
      const decrypt = CryptoJS.AES.decrypt(bytes, key, { iv });
      const plain = decrypt.toString(CryptoJS.enc.Utf8);

      return plain;
    } catch (e) {
      return null;
    }
  }

  probabilisticDecryption(cipherText) {
    try {
      const reb64 = CryptoJS.enc.Hex.parse(cipherText);
      const bytes = reb64.toString(CryptoJS.enc.Base64);
      const decrypt = CryptoJS.AES.decrypt(bytes, this.cryptoSecret);
      const plain = decrypt.toString(CryptoJS.enc.Utf8);

      return plain;
    } catch (error) {
      Logger.error(`(probabilisticDecryption): ${error}`);

      return null;
    }
  }

  hashSha256(text: string | Buffer): string | null {
    try {
      return crypto.createHash('sha256').update(text).digest('hex');
    } catch (error) {
      Logger.error('[CRYPTO sha256] ', error);

      return null;
    }
  }
}
