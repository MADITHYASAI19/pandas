"""
SharePoint Fetch — Part 2, Path A
===================================

Converts a SharePoint "anyone with the link" share URL into a direct-download
URL, fetches the raw Excel bytes, and returns them for the shared normalizer
in attendance_engine.py to process.

Usage
-----
    from sharepoint_fetch import fetch_attendance_from_sharepoint

    raw_bytes = fetch_attendance_from_sharepoint()
    # Then pass raw_bytes into attendance_engine.normalize_attendance()

The share link itself lives in config.py (SHAREPOINT_SHARE_LINK) so it can
be changed without touching this module.
"""

from __future__ import annotations

import io
from urllib.parse import urlparse, parse_qs, quote, unquote

import requests

from config import SHAREPOINT_SHARE_LINK, SHAREPOINT_TIMEOUT_SECONDS


# ═══════════════════════════════════════════════════════════════════════════
#  URL conversion
# ═══════════════════════════════════════════════════════════════════════════

class SharePointURLError(Exception):
    """Raised when a SharePoint share link cannot be converted."""


class SharePointFetchError(Exception):
    """Raised when the HTTP fetch from SharePoint fails."""


def convert_share_link_to_download_url(share_link: str) -> str:
    """Convert a SharePoint *share* link into a direct-download URL.

    SharePoint "anyone with the link" URLs typically look like one of:

        https://<tenant>.sharepoint.com/:x:/s/<site>/EaBcDeFgHi...
        https://<tenant>.sharepoint.com/:x:/g/personal/<user>/EaBcDeFgHi...

    The standard trick is to replace the trailing path segment with
    ``download=1`` on the ``/download.aspx`` endpoint, or — more reliably —
    append ``&download=1`` to the share link itself, which SharePoint
    honours for anonymous-access links.

    Parameters
    ----------
    share_link : str
        The "Copy link" URL from SharePoint.

    Returns
    -------
    str
        A URL that, when fetched with ``requests.get()``, returns the raw
        file bytes (content-type ``application/...``) instead of an HTML page.

    Raises
    ------
    SharePointURLError
        If the link is empty or clearly not a SharePoint share URL.
    """
    if not share_link or not share_link.strip():
        raise SharePointURLError(
            "SharePoint share link is empty.  "
            "Set SHAREPOINT_SHARE_LINK in config.py."
        )

    link = share_link.strip()
    parsed = urlparse(link)

    # Basic validation: must be HTTPS and look like *.sharepoint.com
    if not parsed.scheme == "https":
        raise SharePointURLError(
            f"Expected an HTTPS URL, got scheme '{parsed.scheme}'."
        )
    if "sharepoint.com" not in parsed.hostname.lower():
        raise SharePointURLError(
            f"URL does not appear to be a SharePoint link "
            f"(hostname: {parsed.hostname})."
        )

    # Append download=1 query parameter
    separator = "&" if parsed.query else "?"
    download_url = f"{link}{separator}download=1"

    return download_url


# ═══════════════════════════════════════════════════════════════════════════
#  HTTP fetch
# ═══════════════════════════════════════════════════════════════════════════

def fetch_attendance_from_sharepoint(
    share_link: str | None = None,
    timeout: int | None = None,
) -> bytes:
    """Fetch the raw attendance Excel file from SharePoint.

    Parameters
    ----------
    share_link : str, optional
        Overrides ``SHAREPOINT_SHARE_LINK`` from config.  Useful for
        one-off fetches without editing config.py.
    timeout : int, optional
        Request timeout in seconds.  Defaults to
        ``SHAREPOINT_TIMEOUT_SECONDS`` from config.

    Returns
    -------
    bytes
        Raw file content (Excel workbook bytes), ready to be wrapped in
        ``io.BytesIO`` and passed to the normalizer.

    Raises
    ------
    SharePointURLError
        If the link is invalid or empty.
    SharePointFetchError
        If the network request fails, times out, or returns an HTML page
        (which typically means a login wall or error page).
    """
    link = share_link or SHAREPOINT_SHARE_LINK
    _timeout = timeout or SHAREPOINT_TIMEOUT_SECONDS

    download_url = convert_share_link_to_download_url(link)

    # ------------------------------------------------------------------
    # Make the HTTP request
    # ------------------------------------------------------------------
    try:
        response = requests.get(download_url, timeout=_timeout, allow_redirects=True)
    except requests.exceptions.Timeout:
        raise SharePointFetchError(
            f"Request timed out after {_timeout}s.  "
            f"Check your network or increase SHAREPOINT_TIMEOUT_SECONDS in config.py."
        )
    except requests.exceptions.ConnectionError as exc:
        raise SharePointFetchError(
            f"Could not reach SharePoint.  Connection error: {exc}"
        )
    except requests.exceptions.RequestException as exc:
        raise SharePointFetchError(
            f"HTTP request failed: {exc}"
        )

    # ------------------------------------------------------------------
    # Validate the response
    # ------------------------------------------------------------------
    if response.status_code != 200:
        raise SharePointFetchError(
            f"SharePoint returned HTTP {response.status_code}.  "
            f"The share link may have expired or be restricted."
        )

    content_type = response.headers.get("Content-Type", "")

    # If we got HTML back, it's almost certainly a login page or error page,
    # not the actual Excel file.
    if "text/html" in content_type.lower():
        # Grab a snippet to help with debugging
        snippet = response.text[:300].replace("\n", " ").strip()
        raise SharePointFetchError(
            f"SharePoint returned an HTML page instead of a file download.  "
            f"This usually means the link requires authentication or has expired.  "
            f"Content-Type: {content_type}.  "
            f"Response snippet: {snippet!r}"
        )

    if len(response.content) == 0:
        raise SharePointFetchError(
            "SharePoint returned an empty response body (0 bytes)."
        )

    return response.content


# ═══════════════════════════════════════════════════════════════════════════
#  Demo / self-test
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 64)
    print("  SharePoint Fetch — URL Conversion Tests")
    print("=" * 64)

    # ── Test 1: valid SharePoint link conversion ──────────────────────
    fake_link = "https://myorg.sharepoint.com/:x:/s/TrainingSite/EaBcDeFgHiJkLmNoPqRsTuVw"
    try:
        result = convert_share_link_to_download_url(fake_link)
        print(f"\n[OK] Converted share link:")
        print(f"  Input:  {fake_link}")
        print(f"  Output: {result}")
    except SharePointURLError as exc:
        print(f"\n[FAIL] {exc}")

    # ── Test 2: link with existing query params ───────────────────────
    fake_link_with_qs = "https://myorg.sharepoint.com/:x:/s/Site/Abc123?e=AbCdEf"
    try:
        result = convert_share_link_to_download_url(fake_link_with_qs)
        print(f"\n[OK] Converted link with query string:")
        print(f"  Input:  {fake_link_with_qs}")
        print(f"  Output: {result}")
    except SharePointURLError as exc:
        print(f"\n[FAIL] {exc}")

    # ── Test 3: empty link → expect error ─────────────────────────────
    print()
    try:
        convert_share_link_to_download_url("")
        print("[FAIL] Expected SharePointURLError for empty link")
    except SharePointURLError as exc:
        print(f"[OK] Empty link correctly rejected: {exc}")

    # ── Test 4: non-SharePoint URL → expect error ─────────────────────
    try:
        convert_share_link_to_download_url("https://drive.google.com/some/file")
        print("[FAIL] Expected SharePointURLError for non-SP link")
    except SharePointURLError as exc:
        print(f"[OK] Non-SharePoint link correctly rejected: {exc}")

    # ── Note on live fetch ────────────────────────────────────────────
    print()
    print("-" * 64)
    print("  NOTE: Live fetch (fetch_attendance_from_sharepoint) is not")
    print("  exercised in this test to avoid real network calls.")
    print("  To test it live, set SHAREPOINT_SHARE_LINK in config.py")
    print("  and call:")
    print()
    print("    raw_bytes = fetch_attendance_from_sharepoint()")
    print("    # Then pass to normalize_attendance(raw_bytes, ...)")
    print("-" * 64)
    print()
