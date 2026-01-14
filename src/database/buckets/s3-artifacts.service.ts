// src/database/buckets/s3-artifacts.service.ts
import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

@Injectable()
export class S3ArtifactsService {
  private readonly s3 = new S3Client({ region: process.env.AWS_REGION });
  private readonly bucket = process.env.MAYWIN_ARTIFACTS_BUCKET!;
  private readonly prefix = (process.env.MAYWIN_ARTIFACTS_PREFIX ?? '').replace(/^\/*/, '').replace(/\/*$/, '');

  private keyOf(parts: string[]) {
    const base = this.prefix ? `${this.prefix}/` : '';
    return base + parts.map(p => p.replace(/^\/+|\/+$/g, '')).join('/');
  }

  async putJson(keyParts: string[], data: any) {
    const key = this.keyOf(keyParts);
    const body = Buffer.from(JSON.stringify(data), 'utf8');

    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: 'application/json',
    }));

    return { bucket: this.bucket, key };
  }

  async getJson(ref: { bucket: string; key: string }) {
    const res = await this.s3.send(new GetObjectCommand({
      Bucket: ref.bucket,
      Key: ref.key,
    }));

    const text = await streamToString(res.Body as Readable);
    return JSON.parse(text);
  }
}

async function streamToString(stream: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
