"""Blog scraping utilities for fetching context and metadata."""

import re

import requests
from bs4 import BeautifulSoup
from config import MAX_CONTEXT_CHARS


def _clean_text(text: str) -> str:
    """Clean and truncate text content."""
    text = re.sub(r"\s+", " ", text).strip()
    return text[:MAX_CONTEXT_CHARS]


def fetch_blog_context(url: str) -> str:
    """
    Fetch and extract text content from a blog URL.
    Removes scripts, styles, and other non-content elements.
    """
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise Exception(f"Failed to fetch blog URL: {exc}") from exc

    soup = BeautifulSoup(response.text, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = soup.get_text(separator=" ")
    return _clean_text(text)


def fetch_blog_title(url: str) -> str:
    """
    Fetch the title from a blog URL.
    Tries og:title, twitter:title, then <title> tag.
    """
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise Exception(f"Failed to fetch blog URL: {exc}") from exc

    soup = BeautifulSoup(response.text, "html.parser")

    # Try Open Graph title first
    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        return _clean_text(og_title["content"])

    # Try Twitter title
    twitter_title = soup.find("meta", attrs={"name": "twitter:title"})
    if twitter_title and twitter_title.get("content"):
        return _clean_text(twitter_title["content"])

    # Fall back to <title> tag
    if soup.title and soup.title.string:
        return _clean_text(soup.title.string)

    return ""
