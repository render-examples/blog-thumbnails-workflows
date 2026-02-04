/**
 * MinIO/S3 storage utilities for uploading thumbnail images.
 */

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

// Lazy-initialized S3 client
let _s3Client: S3Client | null = null;
let _bucketChecked = false;

function getConfig() {
  const endpoint = process.env.MINIO_ENDPOINT;
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;
  const bucket = process.env.MINIO_BUCKET || "thumbnails";
  const publicBaseUrl = process.env.MINIO_PUBLIC_BASE_URL;

  if (!endpoint || !accessKey || !secretKey) {
    throw new Error(
      "MinIO credentials not configured (MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY)",
    );
  }

  return { endpoint, accessKey, secretKey, bucket, publicBaseUrl };
}

function getS3Client(): S3Client {
  if (!_s3Client) {
    const { endpoint, accessKey, secretKey } = getConfig();
    _s3Client = new S3Client({
      endpoint,
      region: "us-east-1", // Required but ignored by MinIO
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true, // Required for MinIO
    });
  }
  return _s3Client;
}

async function ensureBucketExists(): Promise<void> {
  if (_bucketChecked) return;

  const s3 = getS3Client();
  const { bucket } = getConfig();

  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (error: unknown) {
    const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      console.log(`[storage] Creating bucket: ${bucket}`);
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    } else {
      throw error;
    }
  }

  // Set public read policy (always try, in case it wasn't set before)
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
    console.log(`[storage] Set public read policy on bucket: ${bucket}`);
  } catch (policyError) {
    console.warn(`[storage] Could not set bucket policy:`, policyError);
    // Continue anyway - policy might already be set
  }

  _bucketChecked = true;
}

/**
 * Upload an image buffer to MinIO and return the public URL.
 */
export async function uploadImage(
  buffer: Buffer,
  key: string,
  contentType = "image/jpeg",
): Promise<string> {
  await ensureBucketExists();

  const s3 = getS3Client();
  const { bucket, publicBaseUrl } = getConfig();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: "public-read",
    }),
  );

  // Construct public URL
  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/$/, "")}/${bucket}/${key}`;
  }

  // Fallback to endpoint URL
  const { endpoint } = getConfig();
  return `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;
}

/**
 * Generate a unique key for a thumbnail image.
 */
export function generateImageKey(model: string, style: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeModel = model.replace(/[^a-zA-Z0-9-_]/g, "_");
  const safeStyle = style.replace(/[^a-zA-Z0-9-_]/g, "_");
  const uniqueId = Math.random().toString(36).substring(2, 10);
  return `${safeStyle}/${safeModel}_${timestamp}_${uniqueId}.jpg`;
}

export interface ImageListItem {
  key: string;
  url: string;
  lastModified?: Date;
  size?: number;
}

/**
 * List all images in the bucket.
 */
export async function listImages(prefix = ""): Promise<ImageListItem[]> {
  await ensureBucketExists();

  const s3 = getS3Client();
  const { bucket, publicBaseUrl, endpoint } = getConfig();

  const images: ImageListItem[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
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
          lastModified: item.LastModified,
          size: item.Size,
        });
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  // Sort by lastModified descending (newest first)
  images.sort((a, b) => {
    if (!a.lastModified || !b.lastModified) return 0;
    return b.lastModified.getTime() - a.lastModified.getTime();
  });

  return images;
}

/**
 * Delete an image from the bucket.
 */
export async function deleteImage(key: string): Promise<void> {
  const s3 = getS3Client();
  const { bucket } = getConfig();

  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}
