#!/usr/bin/env python3
"""
Certbot DNS-01 hook for Hostinger DNS API.

Usage:
  python3 /work/nginx/hostinger-dns-hook.py auth
  python3 /work/nginx/hostinger-dns-hook.py cleanup

Required environment variables:
  HOSTINGER_API_TOKEN
  HOSTINGER_ZONE
  CERTBOT_DOMAIN
  CERTBOT_VALIDATION

Optional environment variables:
  HOSTINGER_API_BASE_URL (default: https://developers.hostinger.com)
  HOSTINGER_ACME_RECORD_NAME (default: _acme-challenge)
  HOSTINGER_DNS_TTL (default: 60)
  HOSTINGER_DNS_PROPAGATION_SECONDS (default: 60)
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List


def log(message: str) -> None:
    print(message, file=sys.stderr)


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def int_env(name: str, default_value: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default_value

    try:
        return int(raw)
    except ValueError as exc:
        raise RuntimeError(f"Invalid integer in {name}: {raw}") from exc


def request_json(
    *,
    api_base: str,
    token: str,
    method: str,
    path: str,
    payload: Dict[str, Any] | None = None,
) -> Any:
    url = f"{api_base}{path}"
    data = None
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

    request = urllib.request.Request(url=url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read().decode("utf-8")
            if not raw:
                return None
            return json.loads(raw)
    except urllib.error.HTTPError as exc:
        error_text = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Hostinger API {method} {path} failed: HTTP {exc.code}: {error_text}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Hostinger API {method} {path} failed: {exc}") from exc


def normalize_txt_value(value: str) -> str:
    cleaned = value.strip()
    if len(cleaned) >= 2 and cleaned.startswith('"') and cleaned.endswith('"'):
        return cleaned[1:-1]
    return cleaned


def unique(values: List[str]) -> List[str]:
    seen = set()
    result: List[str] = []

    for value in values:
        if value and value not in seen:
            seen.add(value)
            result.append(value)

    return result


def get_existing_txt_values(
    *,
    api_base: str,
    token: str,
    zone: str,
    record_name: str,
) -> List[str]:
    encoded_zone = urllib.parse.quote(zone, safe="")
    records = request_json(
        api_base=api_base,
        token=token,
        method="GET",
        path=f"/api/dns/v1/zones/{encoded_zone}",
    )

    if not isinstance(records, list):
        return []

    values: List[str] = []

    for record in records:
        if not isinstance(record, dict):
            continue

        if record.get("name") != record_name or record.get("type") != "TXT":
            continue

        for txt_record in record.get("records", []):
            if not isinstance(txt_record, dict):
                continue

            content = txt_record.get("content")
            if isinstance(content, str):
                values.append(normalize_txt_value(content))

    return unique(values)


def upsert_txt_values(
    *,
    api_base: str,
    token: str,
    zone: str,
    record_name: str,
    ttl: int,
    values: List[str],
) -> None:
    encoded_zone = urllib.parse.quote(zone, safe="")
    payload = {
        "overwrite": True,
        "zone": [
            {
                "name": record_name,
                "type": "TXT",
                "ttl": ttl,
                "records": [{"content": value} for value in values],
            }
        ],
    }

    request_json(
        api_base=api_base,
        token=token,
        method="PUT",
        path=f"/api/dns/v1/zones/{encoded_zone}",
        payload=payload,
    )


def delete_txt_record_name(
    *,
    api_base: str,
    token: str,
    zone: str,
    record_name: str,
) -> None:
    encoded_zone = urllib.parse.quote(zone, safe="")
    payload = {
        "filters": [
            {
                "name": record_name,
                "type": "TXT",
            }
        ]
    }

    request_json(
        api_base=api_base,
        token=token,
        method="DELETE",
        path=f"/api/dns/v1/zones/{encoded_zone}",
        payload=payload,
    )


def run_auth() -> None:
    token = required_env("HOSTINGER_API_TOKEN")
    zone = required_env("HOSTINGER_ZONE")
    validation = required_env("CERTBOT_VALIDATION")
    domain = required_env("CERTBOT_DOMAIN")

    api_base = os.getenv("HOSTINGER_API_BASE_URL", "https://developers.hostinger.com").rstrip("/")
    record_name = os.getenv("HOSTINGER_ACME_RECORD_NAME", "_acme-challenge").strip() or "_acme-challenge"
    ttl = int_env("HOSTINGER_DNS_TTL", 60)
    propagation_seconds = int_env("HOSTINGER_DNS_PROPAGATION_SECONDS", 60)

    existing_values = get_existing_txt_values(
        api_base=api_base,
        token=token,
        zone=zone,
        record_name=record_name,
    )

    target_values = unique(existing_values + [validation])

    log(f"Hostinger DNS auth hook: setting TXT {record_name}.{zone} for {domain} ({len(target_values)} value(s)).")
    upsert_txt_values(
        api_base=api_base,
        token=token,
        zone=zone,
        record_name=record_name,
        ttl=ttl,
        values=target_values,
    )

    if propagation_seconds > 0:
        log(f"Hostinger DNS auth hook: waiting {propagation_seconds}s for DNS propagation.")
        time.sleep(propagation_seconds)


def run_cleanup() -> None:
    token = required_env("HOSTINGER_API_TOKEN")
    zone = required_env("HOSTINGER_ZONE")
    validation = required_env("CERTBOT_VALIDATION")

    api_base = os.getenv("HOSTINGER_API_BASE_URL", "https://developers.hostinger.com").rstrip("/")
    record_name = os.getenv("HOSTINGER_ACME_RECORD_NAME", "_acme-challenge").strip() or "_acme-challenge"
    ttl = int_env("HOSTINGER_DNS_TTL", 60)

    try:
        existing_values = get_existing_txt_values(
            api_base=api_base,
            token=token,
            zone=zone,
            record_name=record_name,
        )

        remaining_values = [value for value in existing_values if value != validation]

        if remaining_values:
            log(f"Hostinger DNS cleanup hook: preserving {len(remaining_values)} TXT value(s) on {record_name}.{zone}.")
            upsert_txt_values(
                api_base=api_base,
                token=token,
                zone=zone,
                record_name=record_name,
                ttl=ttl,
                values=remaining_values,
            )
        elif existing_values:
            log(f"Hostinger DNS cleanup hook: deleting TXT record {record_name}.{zone}.")
            delete_txt_record_name(
                api_base=api_base,
                token=token,
                zone=zone,
                record_name=record_name,
            )
        else:
            log(f"Hostinger DNS cleanup hook: no TXT record to remove for {record_name}.{zone}.")
    except Exception as exc:  # noqa: BLE001
        # Cleanup failure should not fail cert issuance after successful validation.
        log(f"Hostinger DNS cleanup hook warning: {exc}")


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in {"auth", "cleanup"}:
        print("Usage: hostinger-dns-hook.py <auth|cleanup>", file=sys.stderr)
        return 2

    mode = sys.argv[1]

    try:
        if mode == "auth":
            run_auth()
        else:
            run_cleanup()
        return 0
    except Exception as exc:  # noqa: BLE001
        log(str(exc))
        return 1


if __name__ == "__main__":
    sys.exit(main())
