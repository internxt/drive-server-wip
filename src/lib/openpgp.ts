import { generateKey } from 'openpgp';

export async function generateNewKeys(): Promise<{
  privateKeyArmored: string;
  publicKeyArmored: string;
  revocationCertificate: string;
}> {
  const { privateKey, publicKey, revocationCertificate } = await generateKey({
    userIDs: [{ email: 'inxt@inxt.com' }],
    curve: 'ed25519',
  });

  return {
    privateKeyArmored: privateKey,
    publicKeyArmored: Buffer.from(publicKey).toString('base64'),
    revocationCertificate: Buffer.from(revocationCertificate).toString(
      'base64',
    ),
  };
}
