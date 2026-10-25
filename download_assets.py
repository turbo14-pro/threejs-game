#!/usr/bin/env python3
"""
Download character skin and animation assets from the deploy server via FTP.

Credentials are read exclusively from environment variables (never hardcoded,
never printed). Required variables:
  FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_PORT, FTP_REMOTE_ROOT
"""

import os
import sys
from pathlib import Path
from ftplib import FTP, error_perm, error_temp

# --- Files to download (remote path -> local path) ---
ASSETS = [
    ("models/cerealbox.glb", "public/models/cerealbox.glb"),
    ("skins/skin_avo.glb", "public/skins/skin_avo.glb"),
    ("skins/skin_egg.glb", "public/skins/skin_egg.glb"),
    ("skins/actions/melee.doublejump.glb", "public/skins/actions/melee.doublejump.glb"),
    ("skins/actions/melee.doublejumpback.glb", "public/skins/actions/melee.doublejumpback.glb"),
    ("skins/actions/melee.idle.glb", "public/skins/actions/melee.idle.glb"),
    ("skins/actions/melee.jump.glb", "public/skins/actions/melee.jump.glb"),
    ("skins/actions/melee.run.bac.glb", "public/skins/actions/melee.run.bac.glb"),
    ("skins/actions/melee.run.for.glb", "public/skins/actions/melee.run.for.glb"),
    ("skins/actions/melee.run.jump.glb", "public/skins/actions/melee.run.jump.glb"),
    ("skins/actions/melee.slide.glb", "public/skins/actions/melee.slide.glb"),
    ("skins/actions/melee.walk.bac.glb", "public/skins/actions/melee.walk.bac.glb"),
    ("skins/actions/melee.walk.for.glb", "public/skins/actions/melee.walk.for.glb"),
]

WORKSPACE = Path(__file__).resolve().parent


def main() -> int:
    host = os.environ.get("FTP_HOST")
    user = os.environ.get("FTP_USER")
    password = os.environ.get("FTP_PASSWORD")
    port = int(os.environ.get("FTP_PORT", "21"))
    remote_root = os.environ.get("FTP_REMOTE_ROOT", "")

    missing = [name for name, val in (
        ("FTP_HOST", host), ("FTP_USER", user), ("FTP_PASSWORD", password),
    ) if not val]
    if missing:
        print(f"ERROR: Missing required environment variables: {', '.join(missing)}", file=sys.stderr)
        return 1

    ftp = FTP()
    try:
        print(f"Connecting to {host}:{port} ...")
        ftp.connect(host, port, timeout=30)
        ftp.login(user, password)
        print("Logged in.")

        if remote_root:
            try:
                ftp.cwd(remote_root)
                print(f"Changed to remote directory: {remote_root}")
            except error_perm as exc:
                print(f"WARNING: Could not enter remote root '{remote_root}': {exc}", file=sys.stderr)

        failures = 0
        for remote_path, local_path in ASSETS:
            local_file = WORKSPACE / local_path
            local_file.parent.mkdir(parents=True, exist_ok=True)

            try:
                with open(local_file, "wb") as fh:
                    ftp.retrbinary(f"RETR {remote_path}", fh.write)
                print(f"OK   {remote_path} -> {local_path}")
            except (error_perm, error_temp) as exc:
                print(f"FAIL {remote_path}: {exc}", file=sys.stderr)
                failures += 1

        print(f"\nDone. {len(ASSETS) - failures}/{len(ASSETS)} files downloaded.")
        return 1 if failures else 0

    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    finally:
        try:
            ftp.quit()
        except Exception:  # noqa: BLE001
            pass


if __name__ == "__main__":
    sys.exit(main())
