export async function getKemBuilder() {
  const kemBuilder = await import('@dashlane/pqc-kem-kyber512-node');
  return kemBuilder.default;
}

export class Kyber512 {
  private kem: Awaited<ReturnType<Awaited<ReturnType<typeof getKemBuilder>>>>;

  constructor() {}

  async init() {
    const kemBuilder = await getKemBuilder();
    this.kem = await kemBuilder();
  }

  /**
   * Generates a new Kyber-512 key pair.
   */
  async generateKeys(): Promise<{
    publicKey: Uint8Array;
    privateKey: Uint8Array;
  }> {
    if (!this.kem) await this.init();
    return this.kem.keypair();
  }

  async generateKeysInBase64() {
    const keys = await this.generateKeys();

    return {
      publicKey: Buffer.from(keys.publicKey).toString('base64'),
      privateKey: Buffer.from(keys.privateKey).toString('base64'),
    };
  }

  /**
   * Encrypts a message using the recipient's public key.
   * Kyber encapsulates a shared secret along with a ciphertext.
   */
  async encapsulate(
    publicKey: Uint8Array,
  ): Promise<{ ciphertext: Uint8Array; sharedSecret: Uint8Array }> {
    if (!this.kem) await this.init();
    return this.kem.encapsulate(publicKey);
  }

  /**
   * Decrypts the ciphertext using the recipient's private key.
   * Returns the shared secret that matches the one from encryption.
   */
  async decapsulate(
    ciphertext: Uint8Array,
    privateKey: Uint8Array,
  ): Promise<Uint8Array> {
    if (!this.kem) await this.init();
    const { sharedSecret } = await this.kem.decapsulate(ciphertext, privateKey);
    return sharedSecret;
  }
}
