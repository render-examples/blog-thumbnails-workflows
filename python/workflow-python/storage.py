"""MinIO/S3 storage utilities for uploading thumbnail images."""

import io
import logging
import os
import uuid
from datetime import datetime

from PIL import Image

try:
    import boto3
    from botocore.config import Config as BotoConfig
    from botocore.exceptions import ClientError
except ImportError:
    boto3 = None
    BotoConfig = None
    ClientError = Exception

logger = logging.getLogger(__name__)


class MinioStorageError(Exception):
    """Raised when saving to MinIO fails."""


_bucket_cache = set()


def _get_config():
    endpoint = os.getenv("MINIO_ENDPOINT")
    access_key = os.getenv("MINIO_ACCESS_KEY")
    secret_key = os.getenv("MINIO_SECRET_KEY")
    bucket = os.getenv("MINIO_BUCKET", "thumbnails")
    public_base_url = os.getenv("MINIO_PUBLIC_BASE_URL")

    if not endpoint or not access_key or not secret_key:
        raise MinioStorageError(
            "MinIO credentials not configured (MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY)"
        )

    return {
        "endpoint": endpoint,
        "access_key": access_key,
        "secret_key": secret_key,
        "bucket": bucket,
        "public_base_url": public_base_url,
    }


def _get_client():
    if boto3 is None:
        raise MinioStorageError("boto3 is required for MinIO storage but is not installed")

    config = _get_config()

    # Debug: log config (mask secrets)
    logger.info(f"[storage] MinIO endpoint: {config['endpoint']}")
    logger.info(f"[storage] MinIO bucket: {config['bucket']}")
    logger.info(
        f"[storage] MinIO access_key: {config['access_key'][:4]}...{config['access_key'][-4:] if len(config['access_key']) > 8 else '***'}"
    )

    session = boto3.session.Session()
    s3 = session.client(
        "s3",
        endpoint_url=config["endpoint"],
        aws_access_key_id=config["access_key"],
        aws_secret_access_key=config["secret_key"],
        region_name="us-east-1",
        config=BotoConfig(s3={"addressing_style": "path"}),
    )
    return s3, config["bucket"], config["public_base_url"], config["endpoint"]


def _ensure_bucket_exists(s3, bucket: str):
    if bucket in _bucket_cache:
        return
    try:
        s3.head_bucket(Bucket=bucket)
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        if error_code in ("404", "NoSuchBucket", "NotFound"):
            logger.info(f"[storage] Creating bucket: {bucket}")
            s3.create_bucket(Bucket=bucket)
        elif error_code in ("403", "AccessDenied"):
            raise MinioStorageError("Access denied when checking MinIO bucket") from exc
        else:
            s3.create_bucket(Bucket=bucket)

    # Set public read policy
    try:
        import json

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
        s3.put_bucket_policy(Bucket=bucket, Policy=json.dumps(public_policy))
        logger.info(f"[storage] Set public read policy on bucket: {bucket}")
    except Exception as e:
        logger.warning(f"[storage] Could not set bucket policy: {e}")

    _bucket_cache.add(bucket)


def generate_image_key(model: str, style: str) -> str:
    """Generate a unique key for a thumbnail image."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_model = "".join(c if c.isalnum() or c in "-_" else "_" for c in model)
    safe_style = "".join(c if c.isalnum() or c in "-_" else "_" for c in style)
    unique_id = uuid.uuid4().hex[:8]
    return f"{safe_style}/{safe_model}_{timestamp}_{unique_id}.jpg"


def upload_image(image_data: bytes, key: str, content_type: str = "image/jpeg") -> str:
    """Upload image bytes to MinIO and return the public URL."""
    s3, bucket, public_base_url, endpoint = _get_client()
    _ensure_bucket_exists(s3, bucket)

    # Note: Don't use ACL="public-read" - MinIO doesn't support it by default.
    # Public access is handled by the bucket policy set in _ensure_bucket_exists()
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=image_data,
        ContentType=content_type,
        ContentLength=len(image_data),
    )

    if public_base_url:
        return f"{public_base_url.rstrip('/')}/{bucket}/{key}"
    return f"{endpoint.rstrip('/')}/{bucket}/{key}"


def upload_pil_image(image: Image.Image, key: str, format: str = "JPEG", quality: int = 85) -> str:
    """Upload a PIL Image to MinIO and return the public URL."""
    buffer = io.BytesIO()
    image.save(buffer, format=format, quality=quality)
    buffer.seek(0)

    content_type = "image/jpeg" if format.upper() == "JPEG" else f"image/{format.lower()}"
    return upload_image(buffer.read(), key, content_type)


def list_images(prefix: str = "") -> list[dict[str, any]]:
    """List all images in the bucket."""
    s3, bucket, public_base_url, endpoint = _get_client()
    _ensure_bucket_exists(s3, bucket)

    images = []
    kwargs = {"Bucket": bucket, "Prefix": prefix}

    while True:
        response = s3.list_objects_v2(**kwargs)
        for item in response.get("Contents", []):
            key = item.get("Key")
            if key and (
                key.lower().endswith(".jpg")
                or key.lower().endswith(".jpeg")
                or key.lower().endswith(".png")
            ):
                base_url = public_base_url or endpoint
                images.append(
                    {
                        "key": key,
                        "url": f"{base_url.rstrip('/')}/{bucket}/{key}",
                        "lastModified": item.get("LastModified"),
                        "size": item.get("Size"),
                    }
                )

        if response.get("IsTruncated"):
            kwargs["ContinuationToken"] = response.get("NextContinuationToken", "")
        else:
            break

    # Sort by lastModified descending (newest first)
    images.sort(key=lambda x: x.get("lastModified") or datetime.min, reverse=True)
    return images


def delete_image(key: str) -> None:
    """Delete an image from the bucket."""
    s3, bucket, _, _ = _get_client()
    s3.delete_object(Bucket=bucket, Key=key)
