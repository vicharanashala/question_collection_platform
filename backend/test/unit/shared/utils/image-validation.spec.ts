import { detectImage, MAX_IMAGE_SIZE_BYTES } from '../../../../src/shared/utils/image-validation';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);

describe('image-validation', () => {
  it('caps uploads at 5 MB', () => {
    expect(MAX_IMAGE_SIZE_BYTES).toBe(5 * 1024 * 1024);
  });

  it.each([
    ['jpeg', JPEG, 'image/jpeg', 'jpg'],
    ['png', PNG, 'image/png', 'png'],
    ['webp', WEBP, 'image/webp', 'webp'],
  ])('detects %s from its magic bytes', (_name, buffer, mime, ext) => {
    expect(detectImage(buffer)).toEqual(expect.objectContaining({ mime, ext }));
  });

  it.each([
    ['gif', Buffer.from('GIF89a')],
    ['pdf', Buffer.from('%PDF-1.7')],
    ['html disguised as an image', Buffer.from('<html><script>')],
    ['RIFF audio (not WEBP)', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')])],
    ['empty buffer', Buffer.alloc(0)],
  ])('rejects %s', (_name, buffer) => {
    expect(detectImage(buffer)).toBeNull();
  });
});
