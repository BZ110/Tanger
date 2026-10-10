"""Install an official, checksum-verified portable Blender without global changes."""
import hashlib
import json
import pathlib
import platform
import subprocess
import tarfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
VERSION = "4.5.14"
BASE = f"https://download.blender.org/release/Blender4.5/"


def download(url, destination):
    subprocess.run(["curl", "--fail", "--location", "--retry", "2", "--connect-timeout", "30", "--output", str(destination), url], check=True)


def main():
    system, arch = platform.system(), platform.machine().lower()
    if system == "Darwin" and arch in ("arm64", "aarch64"):
        filename = f"blender-{VERSION}-macos-arm64.dmg"
        binary = ROOT / ".tools/blender/Blender.app/Contents/MacOS/Blender"
    elif system == "Linux" and arch in ("x86_64", "amd64"):
        filename = f"blender-{VERSION}-linux-x64.tar.xz"
        binary = ROOT / f".tools/blender/blender-{VERSION}-linux-x64/blender"
    else:
        raise SystemExit("Portable setup supports macOS arm64 and Linux x64. Install Blender 4.5 LTS and set TANGER_BLENDER on other platforms.")
    if binary.exists():
        subprocess.run([str(binary), "--version"], check=True)
        return
    downloads = ROOT / ".tools/downloads"
    downloads.mkdir(parents=True, exist_ok=True)
    archive = downloads / filename
    checksum_file = downloads / f"blender-{VERSION}.sha256"
    download(BASE + checksum_file.name, checksum_file)
    checksums = checksum_file.read_text()
    expected = next((line.split()[0] for line in checksums.splitlines() if line.split()[-1].lstrip("*") == filename), None)
    if not expected:
        raise SystemExit("Archive is missing from the official checksum list.")
    if not archive.exists():
        print(f"Downloading official Blender {VERSION} ({filename})", flush=True)
        download(BASE + filename, archive)
    digest = hashlib.sha256()
    with archive.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != expected:
        archive.unlink()
        raise SystemExit("Checksum mismatch; discarded the download. Run setup again.")
    destination = ROOT / ".tools/blender"
    destination.mkdir(parents=True, exist_ok=True)
    if system == "Darwin":
        mount = ROOT / ".tools/blender-volume"
        mount.mkdir(exist_ok=True)
        subprocess.run(["hdiutil", "attach", str(archive), "-readonly", "-nobrowse", "-mountpoint", str(mount)], check=True, stdout=subprocess.DEVNULL)
        try:
            subprocess.run(["ditto", str(mount / "Blender.app"), str(destination / "Blender.app")], check=True)
        finally:
            subprocess.run(["hdiutil", "detach", str(mount)], check=True, stdout=subprocess.DEVNULL)
    else:
        with tarfile.open(archive) as source:
            # Official archive, verified above. Reject traversal and link escapes anyway.
            for member in source.getmembers():
                target = (destination / member.name).resolve()
                if not target.is_relative_to(destination.resolve()):
                    raise SystemExit("Unsafe archive member")
                if member.issym() or member.islnk():
                    link = (target.parent / member.linkname).resolve()
                    if not link.is_relative_to(destination.resolve()):
                        raise SystemExit("Unsafe archive link")
            source.extractall(destination)
    (destination / "installation.json").write_text(json.dumps({"version": VERSION, "archive": filename, "sha256": expected, "source": BASE + filename}, indent=2) + "\n")
    subprocess.run([str(binary), "--version"], check=True)
    print("Portable Blender is ready. Run npm run art:doctor.")


if __name__ == "__main__":
    main()
