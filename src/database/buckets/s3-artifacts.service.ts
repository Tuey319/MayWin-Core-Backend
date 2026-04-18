// src/database/buckets/s3-artifacts.service.ts
import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  GetObjectLockConfigurationCommand,
  NoSuchKey,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

@Injectable()
export class S3ArtifactsService {
  private readonly s3 = new S3Client({ region: process.env.AWS_REGION });
  private readonly bucket = process.env.MAYWIN_ARTIFACTS_BUCKET?.trim();
  private readonly prefix = (process.env.MAYWIN_ARTIFACTS_PREFIX ?? '').replace(/^\/*/, '').replace(/\/*$/, '');

  private ensureBucket(): string {
    if (!this.bucket) {
      throw new Error('MAYWIN_ARTIFACTS_BUCKET is not configured');
    }
    return this.bucket;
  }

  private keyOf(parts: string[]) {
    const base = this.prefix ? `${this.prefix}/` : '';
    return base + parts.map(p => p.replace(/^\/+|\/+$/g, '')).join('/');
  }

  async putJson(keyParts: string[], data: any) {
    const key = this.keyOf(keyParts);
    const body = Buffer.from(JSON.stringify(data), 'utf8');
    const bucket = this.ensureBucket();

    await this.s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'application/json',
    }));

    return { bucket, key };
  }

  async putBuffer(keyParts: string[], body: Buffer | Uint8Array, contentType: string) {
    const key = this.keyOf(keyParts);
    const bucket = this.ensureBucket();

    await this.s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));

    return { bucket, key };
  }

  async getJson(ref: { bucket: string; key: string }) {
    const res = await this.s3.send(new GetObjectCommand({
      Bucket: ref.bucket,
      Key: ref.key,
    }));

    const text = await streamToString(res.Body as Readable);
    return JSON.parse(text);
  }

  async getObject(ref: { bucket: string; key: string }) {
    return this.s3.send(new GetObjectCommand({
      Bucket: ref.bucket,
      Key: ref.key,
    }));
  }

  async putText(keyParts: string[], text: string, contentType = 'text/plain; charset=utf-8') {
    const key = this.keyOf(keyParts);
    const bucket = this.ensureBucket();
    const body = Buffer.from(text, 'utf8');

    await this.s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));

    return { bucket, key };
  }

  async deleteObject(ref: { bucket: string; key: string }) {
    await this.s3.send(new DeleteObjectCommand({
      Bucket: ref.bucket,
      Key: ref.key,
    }));
  }

  /** Returns true if the bucket has S3 Object Lock enabled (A.8.15 audit log integrity). */
  async getBucketObjectLockConfig(): Promise<boolean> {
    const bucket = this.bucket;
    if (!bucket) return false;
    try {
      const res = await this.s3.send(new GetObjectLockConfigurationCommand({ Bucket: bucket }));
      return res.ObjectLockConfiguration?.ObjectLockEnabled === 'Enabled';
    } catch {
      return false;
    }
  }

  /**
   * Returns the text content of an S3 object, or null if it does not exist.
   */
  async getText(keyParts: string[]): Promise<string | null> {
    const key = this.keyOf(keyParts);
    const bucket = this.ensureBucket();
    try {
      const res = await this.s3.send(new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }));
      return streamToString(res.Body as Readable);
    } catch (err: any) {
      if (err instanceof NoSuchKey || err?.name === 'NoSuchKey' || err?.Code === 'NoSuchKey') {
        return null;
      }
      throw err;
    }
  }
}

async function streamToString(stream: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
