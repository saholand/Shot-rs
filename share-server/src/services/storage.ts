import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3'
import type { Readable } from 'stream'

let client: S3Client
let bucketName: string

export function initStorage(): void {
  const accountId = process.env.R2_ACCOUNT_ID!
  const accessKeyId = process.env.R2_ACCESS_KEY_ID!
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!
  bucketName = process.env.R2_BUCKET_NAME || 'share-uploads'

  client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey }
  })
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType
    })
  )
}

export async function getObject(
  key: string
): Promise<{ body: Readable; contentType?: string }> {
  const res = await client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    })
  )
  return {
    body: res.Body as Readable,
    contentType: res.ContentType
  }
}

export async function deleteObject(key: string): Promise<void> {
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key
    })
  )
}
