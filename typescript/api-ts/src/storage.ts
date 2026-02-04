/**
 * S3/MinIO storage operations for the Gallery feature.
 */
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutBucketPolicyCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { minioConfig } from "./config.js";

let s3Client: S3Client | null = null;

/** Get S3 client for MinIO (singleton). Returns null if not configured. */
export function getS3Client(): S3Client | null {
  if (s3Client) {
    return s3Client;
  }

  const { endpoint, accessKey, secretKey } = minioConfig;
  if (!endpoint || !accessKey || !secretKey) {
    return null;
  }

  s3Client = new S3Client({
    endpoint,
    region: "us-east-1",
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
    forcePathStyle: true,
  });

  return s3Client;
}

/** Create bucket if it doesn't exist and set public read policy. */
export async function ensureBucket(s3: S3Client): Promise<void> {
  const { bucket } = minioConfig;

  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (error: unknown) {
    const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    }
  }

  // Ensure public read policy
  try {
    const publicPolicy = {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "PublicRead",
          Effect: "Allow",
          Principal: "*",
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        },
      ],
    };
    await s3.send(
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: JSON.stringify(publicPolicy),
      }),
    );
  } catch {
    // Policy might already be set
  }
}

export interface GalleryImage {
  key: string;
  url: string;
  lastModified?: string;
  size?: number;
}

/** List all images in the gallery bucket, sorted by last modified (newest first). */
export async function listImages(s3: S3Client): Promise<GalleryImage[]> {
  const { bucket, publicBaseUrl, endpoint } = minioConfig;
  const images: GalleryImage[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }),
    );

    for (const item of response.Contents || []) {
      if (
        item.Key &&
        (item.Key.endsWith(".jpg") || item.Key.endsWith(".jpeg") || item.Key.endsWith(".png"))
      ) {
        const baseUrl = publicBaseUrl || endpoint;
        images.push({
          key: item.Key,
          url: `${baseUrl?.replace(/\/$/, "")}/${bucket}/${item.Key}`,
          lastModified: item.LastModified?.toISOString(),
          size: item.Size,
        });
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  // Sort by lastModified descending
  images.sort((a, b) => {
    if (!a.lastModified || !b.lastModified) {
      return 0;
    }
    return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
  });

  return images;
}

/** Delete an image from the gallery bucket. */
export async function deleteImage(s3: S3Client, key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: minioConfig.bucket, Key: key }));
}
