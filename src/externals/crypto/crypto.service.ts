import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AesService } from './aes';
import CryptoJS from 'crypto-js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export enum AsymmetricEncryptionAlgorithms {
  EllipticCurve = 'ed25519',
}

@Injectable()
export class CryptoService {
  private readonly configService: ConfigService;
  private readonly aesService: AesService;
  private readonly cryptoSecret: string;

  constructor(configService: ConfigService) {
    this.configService = configService;
    this.aesService = new AesService(
      this.configService.get('secrets.cryptoSecret2'),
    );
    this.cryptoSecret = this.configService.get('secrets.cryptoSecret');
  }

  encrypt(text: string, buffer?: Buffer) {
    return this.aesService.encrypt(text, buffer);
  }

  encryptName(name: string, salt?: number | string) {
    if (salt) {
      return this.aesService.encrypt(name, salt);
    }
    return this.probabilisticEncryption(name);
  }

  deterministicEncryption(content) {
    try {
      const key = CryptoJS.enc.Hex.parse(this.cryptoSecret);
      const iv = CryptoJS.lib.WordArray.random(16);
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

  decryptText(encryptedText: string, salt?: number | string) {
    return this.decryptName(encryptedText, salt);
  }

  encryptText(textToEncrypt: string, salt?: number | string) {
    return this.encryptName(textToEncrypt, salt);
  }

  encryptTextWithKey(textToEncrypt: string, keyToEncrypt: string): string {
    const bytes = CryptoJS.AES.encrypt(textToEncrypt, keyToEncrypt).toString();
    const text64 = CryptoJS.enc.Base64.parse(bytes);

    return text64.toString(CryptoJS.enc.Hex);
  }

  passToHash(password: string): { salt: string; hash: string } {
    const salt = CryptoJS.lib.WordArray.random(128 / 8);
    const hash = CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: 10000,
    });
    const hashedObjetc = {
      salt: salt.toString(),
      hash: hash.toString(),
    };

    return hashedObjetc;
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

  hashBcrypt(text: string): string | null {
    try {
      return bcrypt.hashSync(text.toString(), 8);
    } catch (err) {
      console.error('FATAL BCRYPT ERROR', (err as Error).message);

      return null;
    }
  }
}
