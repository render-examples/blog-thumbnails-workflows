"""S3/MinIO storage operations for the Gallery feature."""

import json

import boto3
from botocore.exceptions import ClientError
from config import GalleryImage, minio_config

# Singleton S3 client
_s3_client = None


def get_s3_client():
    """
    Get S3 client for MinIO (singleton).
    Returns None if MinIO is not configured.
    """
    global _s3_client

    if _s3_client is not None:
        return _s3_client

    if not minio_config.is_configured:
        return None

    _s3_client = boto3.client(
        "s3",
        endpoint_url=minio_config.endpoint,
        aws_access_key_id=minio_config.access_key,
        aws_secret_access_key=minio_config.secret_key,
        region_name="us-east-1",
    )

    return _s3_client


def ensure_bucket(s3_client) -> None:
    """Create bucket if it doesn't exist and set public read policy."""
    bucket = minio_config.bucket

    # Check if bucket exists
    try:
        s3_client.head_bucket(Bucket=bucket)
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code")
        if error_code in ("404", "NoSuchBucket"):
            s3_client.create_bucket(Bucket=bucket)
        else:
            raise

    # Set public read policy
    try:
        public_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Sid": "PublicRead",
                    "Effect": "Allow",
                    "Principal": "*",
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{bucket}/*"],
                }
            ],
        }
        s3_client.put_bucket_policy(Bucket=bucket, Policy=json.dumps(public_policy))
    except ClientError:
        # Policy might already be set
        pass


def list_images(s3_client) -> list[GalleryImage]:
    """List all images in the gallery bucket, sorted by last modified (newest first)."""
    bucket = minio_config.bucket
    public_base_url = minio_config.public_base_url or minio_config.endpoint
    images: list[GalleryImage] = []

    paginator = s3_client.get_paginator("list_objects_v2")

    for page in paginator.paginate(Bucket=bucket):
        for item in page.get("Contents", []):
            key = item.get("Key", "")
            if key.endswith((".jpg", ".jpeg", ".png")):
                base_url = public_base_url.rstrip("/")
                images.append(
                    GalleryImage(
                        key=key,
                        url=f"{base_url}/{bucket}/{key}",
                        last_modified=item.get("LastModified").isoformat()
                        if item.get("LastModified")
                        else None,
                        size=item.get("Size"),
                    )
                )

    # Sort by last_modified descending (newest first)
    images.sort(key=lambda x: x.last_modified or "", reverse=True)

    return images


def delete_image(s3_client, key: str) -> None:
    """Delete an image from the gallery bucket."""
    s3_client.delete_object(Bucket=minio_config.bucket, Key=key)
