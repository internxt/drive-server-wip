import { extendSecret, XORhex } from './utils';

describe('extendSecret', () => {
  it('When input length is 0, then it should pass the test from the blake3 team', async () => {
    const message = Buffer.from('');
    const result = await extendSecret(message, 1048);
    const testResult =
      'af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262e00f03e7b69af26b7faaf09fcd333050338ddfe085b8cc869ca98b206c08243a26f5487789e8f660afe6c99ef9e0c52b92e7393024a80459cf91f476f9ffdbda7001c22e159b402631f277ca96f2defdf1078282314e763699a31c5363165421cce14d';
    expect(result).toBe(testResult);
  });

  it('When input length is 1, then it should pass the test from the blake3 team', async () => {
    const message = Buffer.from([0]);
    const result = await extendSecret(message, 1048);
    const testResult =
      '2d3adedff11b61f14c886e35afa036736dcd87a74d27b5c1510225d0f592e213c3a6cb8bf623e20cdb535f8d1a5ffb86342d9c0b64aca3bce1d31f60adfa137b358ad4d79f97b47c3d5e79f179df87a3b9776ef8325f8329886ba42f07fb138bb502f4081cbcec3195c5871e6c23e2cc97d3c69a613eba131e5f1351f3f1da786545e5';
    expect(result).toBe(testResult);
  });

  it('When input length is 2, then it should pass the test from the blake3 team', async () => {
    const message = Buffer.from([0, 1]);
    const result = await extendSecret(message, 1048);
    const testResult =
      '7b7015bb92cf0b318037702a6cdd81dee41224f734684c2c122cd6359cb1ee63d8386b22e2ddc05836b7c1bb693d92af006deb5ffbc4c70fb44d0195d0c6f252faac61659ef86523aa16517f87cb5f1340e723756ab65efb2f91964e14391de2a432263a6faf1d146937b35a33621c12d00be8223a7f1919cec0acd12097ff3ab00ab1';
    expect(result).toBe(testResult);
  });

  function getBuffer(length: number) {
    const result = Array(length);
    let byte = 0;
    for (let i = 0; i < length; i++) {
      result[i] = byte;
      byte += 1;
      if (byte > 250) {
        byte = 0;
      }
    }
    return Buffer.from(result);
  }

  it('When input length is 7, then it should pass the test from the blake3 team', async () => {
    const message = getBuffer(7);
    const result = await extendSecret(message, 1048);
    const testResult =
      '3f8770f387faad08faa9d8414e9f449ac68e6ff0417f673f602a646a891419fe66036ef6e6d1a8f54baa9fed1fc11c77cfb9cff65bae915045027046ebe0c01bf5a941f3bb0f73791d3fc0b84370f9f30af0cd5b0fc334dd61f70feb60dad785f070fef1f343ed933b49a5ca0d16a503f599a365a4296739248b28d1a20b0e2cc8975c';
    expect(result).toBe(testResult);
  });

  it('When input length is 63, then it should pass the test from the blake3 team', async () => {
    const message = getBuffer(63);
    const result = await extendSecret(message, 1048);
    const testResult =
      'e9bc37a594daad83be9470df7f7b3798297c3d834ce80ba85d6e207627b7db7b1197012b1e7d9af4d7cb7bdd1f3bb49a90a9b5dec3ea2bbc6eaebce77f4e470cbf4687093b5352f04e4a4570fba233164e6acc36900e35d185886a827f7ea9bdc1e5c3ce88b095a200e62c10c043b3e9bc6cb9b6ac4dfa51794b02ace9f98779040755';
    expect(result).toBe(testResult);
  });

  it('When input length is 1023, then it should pass the test from the blake3 team', async () => {
    const message = getBuffer(1023);
    const result = await extendSecret(message, 1048);
    const testResult =
      '10108970eeda3eb932baac1428c7a2163b0e924c9a9e25b35bba72b28f70bd11a182d27a591b05592b15607500e1e8dd56bc6c7fc063715b7a1d737df5bad3339c56778957d870eb9717b57ea3d9fb68d1b55127bba6a906a4a24bbd5acb2d123a37b28f9e9a81bbaae360d58f85e5fc9d75f7c370a0cc09b6522d9c8d822f2f28f485';
    expect(result).toBe(testResult);
  });

  it('When input length is 102400, then it should pass the test from the blake3 team', async () => {
    const message = getBuffer(102400);
    const result = await extendSecret(message, 1048);
    const testResult =
      'bc3e3d41a1146b069abffad3c0d44860cf664390afce4d9661f7902e7943e085e01c59dab908c04c3342b816941a26d69c2605ebee5ec5291cc55e15b76146e6745f0601156c3596cb75065a9c57f35585a52e1ac70f69131c23d611ce11ee4ab1ec2c009012d236648e77be9295dd0426f29b764d65de58eb7d01dd42248204f45f8e';
    expect(result).toBe(testResult);
  });
});

describe('XORhex', () => {
  it('When identical hex strings are XORed, then it should return a string of zeros', () => {
    const hexString = 'deadbeef';
    const expectedResult = '00000000';

    expect(XORhex(hexString, hexString)).toBe(expectedResult);
  });

  it('When a fixed example is provided, it should return the expected result', async () => {
    const firstHex = '74686973206973207468652074657374206d657373616765';
    const secondHex = '7468697320697320746865207365636f6e64206d65737361';
    const resultHex = '0000000000000000000000000700101b4e09451e16121404';

    const xoredMessage = XORhex(firstHex, secondHex);

    expect(xoredMessage).toEqual(resultHex);
  });

  it('When XORing with a zero-filled hex string, then it should return the original string', () => {
    const a = '12345678';
    const zeroString = '00000000';

    expect(XORhex(a, zeroString)).toBe(a);
  });

  it('When input strings have different lengths, then it should throw an error', () => {
    const a = '1234';
    const b = 'abcd12';

    expect(() => XORhex(a, b)).toThrow(
      'Can XOR only strings with identical length',
    );
  });

  it('When both input strings are empty, then it should return an empty string', () => {
    expect(XORhex('', '')).toBe('');
  });
});
