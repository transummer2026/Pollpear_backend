import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { VaultService } from 'src/vault/vault.service';
import { StorageService } from './storage.service';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  PutObjectCommand: jest.fn(),
}));

describe('StorageService', () => {
  const send = jest.fn();
  const MockedS3Client = jest.mocked(S3Client);
  MockedS3Client.mockImplementation(() => ({ send }) as unknown as S3Client);
  const MockedPutObjectCommand = jest.mocked(PutObjectCommand);

  const vault = {
    s3: {
      endpoint: 'http://minio:9000',
      region: 'eu-west-1',
      bucket: 'pollpear',
      access_key: 'ak',
      secret_key: 'sk',
    },
    app: { gateway_url: 'https://gw.pollpear.dev' },
  } as unknown as VaultService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens a path-style client on the vault s3 credentials', () => {
    new StorageService(vault);

    expect(MockedS3Client).toHaveBeenCalledWith({
      endpoint: 'http://minio:9000',
      region: 'eu-west-1',
      credentials: { accessKeyId: 'ak', secretAccessKey: 'sk' },
      forcePathStyle: true,
    });
  });

  it('uploads the body under the vault bucket with the given key and content type', async () => {
    const service = new StorageService(vault);
    const body = Buffer.from('img');

    await service.save('avatars/7.webp', body, 'image/webp');

    expect(MockedPutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'pollpear',
      Key: 'avatars/7.webp',
      Body: body,
      ContentType: 'image/webp',
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
  });

  it('composes the public url from the gateway and the key', () => {
    const service = new StorageService(vault);

    expect(service.publicUrl('avatars/7.webp')).toBe(
      'https://gw.pollpear.dev/uploads/avatars/7.webp',
    );
  });
});
