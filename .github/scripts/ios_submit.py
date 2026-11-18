#!/usr/bin/env python3
"""Pull an in-review Nonogram iOS version, attach a new build, and submit it."""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from pathlib import Path

import jwt
import requests

BUNDLE_ID = os.environ.get("BUNDLE_ID", "com.revisitedlabs.nonogram")
ASC_BASE = "https://api.appstoreconnect.apple.com"
EDITABLE_STATES = {
    "PREPARE_FOR_SUBMISSION",
    "DEVELOPER_REJECTED",
    "REJECTED",
    "METADATA_REJECTED",
    "INVALID_BINARY",
    "READY_FOR_REVIEW",
}


class ReleaseError(RuntimeError):
    pass


def asc_session() -> requests.Session:
    key_id = os.environ.get("ASC_KEY_ID", "").strip()
    issuer_id = os.environ.get("ASC_ISSUER_ID", "").strip()
    key_path = os.environ.get("ASC_KEY_PATH", "").strip()
    if not key_id or not issuer_id or not key_path:
        raise ReleaseError("ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_PATH are required")
    key = Path(key_path).read_text()
    now = int(time.time())
    token = jwt.encode(
        {"iss": issuer_id, "iat": now - 30, "exp": now + 1200, "aud": "appstoreconnect-v1"},
        key,
        algorithm="ES256",
        headers={"kid": key_id},
    )
    session = requests.Session()
    session.headers["Authorization"] = f"Bearer {token}"
    session.headers["Accept"] = "application/json"
    return session


def _request(session: requests.Session, method: str, path: str, **kwargs) -> requests.Response:
    last: requests.Response | None = None
    for attempt in range(5):
        last = session.request(method, ASC_BASE + path, timeout=120, **kwargs)
        if last.status_code < 500:
            return last
        if attempt < 4:
            delay = 4 * (attempt + 1)
            print(f"[ios] {method} {path} -> HTTP {last.status_code}; retrying in {delay}s")
            time.sleep(delay)
    return last  # type: ignore[return-value]


def get(session: requests.Session, path: str, **params) -> dict:
    resp = _request(session, "GET", path, params=params)
    if resp.status_code >= 400:
        raise ReleaseError(f"GET {path} -> HTTP {resp.status_code}: {resp.text[:1200]}")
    return resp.json()


def write(session: requests.Session, method: str, path: str, payload: dict) -> dict:
    resp = _request(session, method, path, json=payload)
    if resp.status_code >= 400:
        raise ReleaseError(f"{method} {path} -> HTTP {resp.status_code}: {resp.text[:1200]}")
    return resp.json() if resp.content else {}


def find_app(session: requests.Session) -> dict:
    data = get(session, "/v1/apps", **{"filter[bundleId]": BUNDLE_ID}).get("data", [])
    if not data:
        raise ReleaseError(f"no App Store Connect app for {BUNDLE_ID}")
    return data[0]


def list_versions(session: requests.Session, app_id: str) -> list[dict]:
    return get(
        session,
        f"/v1/apps/{app_id}/appStoreVersions",
        **{"filter[platform]": "IOS", "limit": 200},
    ).get("data", [])


def version_state(session: requests.Session, version_id: str) -> str | None:
    data = get(
        session,
        f"/v1/appStoreVersions/{version_id}",
        **{"fields[appStoreVersions]": "versionString,appStoreState"},
    )["data"]
    return data["attributes"].get("appStoreState")


def remove_from_review(session: requests.Session, version: dict) -> None:
    version_id = version["id"]
    label = version.get("attributes", {}).get("versionString", version_id)
    legacy = get(
        session, f"/v1/appStoreVersions/{version_id}/appStoreVersionSubmission"
    ).get("data")
    if not legacy:
        raise ReleaseError(f"{label} is in review but has no legacy submission")
    print(f"[ios] removing {label} from review (submission {legacy['id']})")
    resp = _request(session, "DELETE", f"/v1/appStoreVersionSubmissions/{legacy['id']}")
    if resp.status_code >= 400:
        raise ReleaseError(f"DELETE legacy submission -> HTTP {resp.status_code}: {resp.text[:1200]}")
    state = None
    for _ in range(12):
        state = version_state(session, version_id)
        print(f"[ios] {label} state after removal: {state}")
        if state not in {"WAITING_FOR_REVIEW", "IN_REVIEW"}:
            return
        time.sleep(5)
    raise ReleaseError(f"{label} is still {state} after removal")


def wait_for_build(
    session: requests.Session, app_id: str, build_number: str, timeout_seconds: int = 900
) -> dict:
    deadline = time.time() + timeout_seconds
    while True:
        data = get(
            session,
            "/v1/builds",
            **{
                "filter[app]": app_id,
                "filter[version]": build_number,
                "include": "preReleaseVersion",
                "limit": 50,
            },
        ).get("data", [])
        for build in data:
            if (
                build["attributes"].get("version") == build_number
                and build["attributes"].get("processingState") == "VALID"
            ):
                print(f"[ios] build {build_number} is VALID ({build['id']})")
                return build
        if time.time() > deadline:
            states = sorted(
                {b["attributes"].get("processingState") for b in data} or {"not found"}
            )
            raise ReleaseError(
                f"build {build_number} did not become VALID in time (states: {states})"
            )
        print(f"[ios] waiting for build {build_number} to process...")
        time.sleep(15)


def attached_build(session: requests.Session, version_id: str) -> str | None:
    version = get(
        session,
        f"/v1/appStoreVersions/{version_id}",
        include="build",
        **{"fields[builds]": "version,processingState"},
    )["data"]
    rel = version.get("relationships", {}).get("build", {}).get("data")
    return rel["id"] if rel else None


def open_submission(session: requests.Session, app_id: str) -> dict | None:
    data = get(
        session,
        "/v1/reviewSubmissions",
        **{"filter[app]": app_id, "filter[platform]": "IOS", "limit": 50},
    ).get("data", [])
    for submission in data:
        state = submission["attributes"].get("state")
        print(f"[ios] review submission {submission['id']}: {state}")
        if state == "READY_FOR_REVIEW":
            return submission
    return None


def submission_items(session: requests.Session, submission_id: str) -> list[dict]:
    return get(session, f"/v1/reviewSubmissions/{submission_id}/items", limit=50).get(
        "data", []
    )


def add_item(
    session: requests.Session, submission_id: str, version_id: str
) -> str | None:
    try:
        write(
            session,
            "POST",
            "/v1/reviewSubmissionItems",
            {
                "data": {
                    "type": "reviewSubmissionItems",
                    "relationships": {
                        "reviewSubmission": {
                            "data": {"type": "reviewSubmissions", "id": submission_id}
                        },
                        "appStoreVersion": {
                            "data": {"type": "appStoreVersions", "id": version_id}
                        },
                    },
                }
            },
        )
        return None
    except ReleaseError as exc:
        text = str(exc)
        if "ITEM_PART_OF_ANOTHER_SUBMISSION" in text:
            match = re.search(r"with id ([0-9a-f-]{36})", text)
            if match:
                other = match.group(1)
                print(f"[ios] version already belongs to submission {other}; using it")
                return other
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version-name", default="1.0")
    parser.add_argument("--build-number", required=True)
    parser.add_argument("--remove-in-review", action="store_true")
    parser.add_argument("--release-notes", default="")
    parser.add_argument("--inspect", action="store_true")
    args = parser.parse_args()

    session = asc_session()
    app = find_app(session)
    app_id = app["id"]
    print(f"[ios] app: {app.get('attributes', {}).get('name')} ({app_id})")

    versions = list_versions(session, app_id)
    for version in versions:
        attrs = version.get("attributes", {})
        print(f"[ios] version {attrs.get('versionString')}: {attrs.get('appStoreState')} ({version['id']})")

    if args.inspect:
        builds = get(
            session,
            "/v1/builds",
            **{"filter[app]": app_id, "limit": 50, "sort": "-uploadedDate"},
        ).get("data", [])
        for build in builds:
            attrs = build.get("attributes", {})
            print(
                f"[ios] build {attrs.get('version')}: {attrs.get('processingState')} "
                f"uploaded={attrs.get('uploadedDate')}"
            )
        return 0

    if args.remove_in_review:
        for version in versions:
            if version.get("attributes", {}).get("appStoreState") in {
                "WAITING_FOR_REVIEW",
                "IN_REVIEW",
            }:
                remove_from_review(session, version)
        versions = list_versions(session, app_id)

    target = next(
        (
            version
            for version in versions
            if version.get("attributes", {}).get("versionString") == args.version_name
        ),
        None,
    )
    if target is None:
        editable = next(
            (
                version
                for version in versions
                if version.get("attributes", {}).get("appStoreState")
                in EDITABLE_STATES
            ),
            None,
        )
        if editable is None:
            created = write(
                session,
                "POST",
                "/v1/appStoreVersions",
                {
                    "data": {
                        "type": "appStoreVersions",
                        "attributes": {
                            "platform": "IOS",
                            "versionString": args.version_name,
                        },
                        "relationships": {
                            "app": {"data": {"type": "apps", "id": app_id}}
                        },
                    }
                },
            )["data"]
            print(f"[ios] created version {args.version_name} ({created['id']})")
            target = created
        else:
            old_name = editable.get("attributes", {}).get("versionString")
            write(
                session,
                "PATCH",
                f"/v1/appStoreVersions/{editable['id']}",
                {
                    "data": {
                        "type": "appStoreVersions",
                        "id": editable["id"],
                        "attributes": {"versionString": args.version_name},
                    }
                },
            )
            print(f"[ios] renamed editable version {old_name} as {args.version_name}")
            target = editable
            target["attributes"]["versionString"] = args.version_name

    version_id = target["id"]
    state = version_state(session, version_id)
    print(f"[ios] target version {args.version_name}: state={state}")
    if state in {"WAITING_FOR_REVIEW", "IN_REVIEW"}:
        print("[ios] version is already in review; nothing to submit")
        return 0
    if state not in EDITABLE_STATES:
        raise ReleaseError(f"version {args.version_name} is in state {state}; cannot submit")

    build = wait_for_build(session, app_id, args.build_number)
    if build.get("attributes", {}).get("usesNonExemptEncryption") is None:
        write(
            session,
            "PATCH",
            f"/v1/builds/{build['id']}",
            {
                "data": {
                    "type": "builds",
                    "id": build["id"],
                    "attributes": {"usesNonExemptEncryption": False},
                }
            },
        )
        print("[ios] set usesNonExemptEncryption=false on build")

    attached = attached_build(session, version_id)
    print(f"[ios] attached build: {attached or 'none'}")
    if attached != build["id"]:
        write(
            session,
            "PATCH",
            f"/v1/appStoreVersions/{version_id}/relationships/build",
            {"data": {"type": "builds", "id": build["id"]}},
        )
        print(f"[ios] attached build {args.build_number}")

    locals_ = get(
        session,
        f"/v1/appStoreVersions/{version_id}/appStoreVersionLocalizations",
        limit=50,
    ).get("data", [])
    for loc in locals_:
        attrs = loc.get("attributes", {})
        print(
            f"[ios] locale {attrs.get('locale')}: "
            f"whatsNew={'set' if attrs.get('whatsNew') else 'empty'}"
        )
    if args.release_notes:
        for loc in locals_:
            try:
                write(
                    session,
                    "PATCH",
                    f"/v1/appStoreVersionLocalizations/{loc['id']}",
                    {
                        "data": {
                            "type": "appStoreVersionLocalizations",
                            "id": loc["id"],
                            "attributes": {"whatsNew": args.release_notes},
                        }
                    },
                )
                print(f"[ios] set What's New for {loc['attributes'].get('locale')}")
            except ReleaseError as exc:
                print(f"[ios] skipped What's New: {exc}")

    submission = open_submission(session, app_id)
    if submission is None:
        submission = write(
            session,
            "POST",
            "/v1/reviewSubmissions",
            {
                "data": {
                    "type": "reviewSubmissions",
                    "attributes": {"platform": "IOS"},
                    "relationships": {"app": {"data": {"type": "apps", "id": app_id}}},
                }
            },
        )["data"]
        print(f"[ios] created review submission {submission['id']}")
        target_submission = (
            add_item(session, submission["id"], version_id) or submission["id"]
        )
        print("[ios] added version item")
    else:
        already = any(
            item.get("relationships", {})
            .get("appStoreVersion", {})
            .get("data", {})
            .get("id")
            == version_id
            for item in submission_items(session, submission["id"])
        )
        if already:
            print("[ios] version already in submission")
            target_submission = submission["id"]
        else:
            target_submission = (
                add_item(session, submission["id"], version_id) or submission["id"]
            )
            print("[ios] added version item")

    write(
        session,
        "PATCH",
        f"/v1/reviewSubmissions/{target_submission}",
        {
            "data": {
                "type": "reviewSubmissions",
                "id": target_submission,
                "attributes": {"submitted": True},
            }
        },
    )
    print(
        f"[ios] {args.version_name} build {args.build_number} submitted for review"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ReleaseError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
