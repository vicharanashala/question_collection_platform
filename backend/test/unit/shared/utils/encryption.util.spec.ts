import { decrypt, encrypt } from '../../../../src/shared/utils/encryption.util';

describe('encryption.util', () => {
  it('round-trips plaintext through encrypt and decrypt', () => {
    const plaintext = 'HDFC0001234|123456789012|Ramesh Kumar';

    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('round-trips unicode text such as Indic account holder names', () => {
    const plaintext = 'रमेश कुमार';

    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('produces the iv:tag:ciphertext hex format', () => {
    const [iv, tag, ciphertext] = encrypt('secret').split(':');

    expect(iv).toMatch(/^[0-9a-f]{32}$/);
    expect(tag).toMatch(/^[0-9a-f]{32}$/);
    expect(ciphertext).toMatch(/^[0-9a-f]+$/);
  });

  it('uses a fresh IV so equal inputs never produce equal ciphertexts', () => {
    expect(encrypt('same value')).not.toBe(encrypt('same value'));
  });

  it.each(['', 'not-encrypted', 'aa:bb', '::'])('rejects malformed input %p', (input) => {
    expect(() => decrypt(input)).toThrow('Invalid encrypted data format');
  });

  it('rejects ciphertext that was tampered with (GCM authentication)', () => {
    const [iv, tag, ciphertext] = encrypt('account-number').split(':');
    const flipped = (parseInt(ciphertext[0], 16) ^ 1).toString(16) + ciphertext.slice(1);

    expect(() => decrypt(`${iv}:${tag}:${flipped}`)).toThrow();
  });

  it('rejects a forged authentication tag', () => {
    const [iv, , ciphertext] = encrypt('account-number').split(':');

    expect(() => decrypt(`${iv}:${'0'.repeat(32)}:${ciphertext}`)).toThrow();
  });
});
