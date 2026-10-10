"""Atomic source checkpoints including shader settings and external paint images."""

import hashlib
import json
import shutil
import bpy
from authoring.context import path, save


def digest(filename):
    return hashlib.sha256(path(filename).read_bytes()).hexdigest()


def appearance_digest(state):
    files = [state["shaderProfile"]]
    files.extend(
        p.relative_to(path(".")).as_posix()
        for p in sorted((path(state["source"]).parent / "textures").glob("*"))
        if p.is_file()
    )
    return hashlib.sha256(
        "\n".join(filename + ":" + digest(filename) for filename in files).encode()
    ).hexdigest()


class History:
    def __init__(self, state):
        self.state = state
        self.root = state["reviewRoot"].removesuffix("/iterations") + "/artist"
        path(self.root).mkdir(parents=True, exist_ok=True)
        self.filename = self.root + "/history.json"
        self.data = (
            json.loads(path(self.filename).read_text())
            if path(self.filename).exists()
            else {
                "schemaVersion": 1,
                "character": state["character"],
                "cycles": [],
                "undo": [],
                "redo": [],
                "pending": None,
                "critique": None,
            }
        )

    def flush(self):
        filename = path(self.filename)
        temporary = filename.with_suffix(".tmp")
        temporary.write_text(json.dumps(self.data, indent=2) + "\n")
        temporary.replace(filename)

    def checkpoint(self, name, view):
        if not name or any(
            c not in "abcdefghijklmnopqrstuvwxyz0123456789-" for c in name
        ):
            raise ValueError(
                "Checkpoint name must use lowercase letters, digits and hyphens"
            )
        root = self.state["checkpointRoot"] + "/artist/" + name
        path(root).mkdir(parents=True, exist_ok=False)
        filenames = [self.state["source"], self.state["shaderProfile"]]
        source_dir = path(self.state["source"]).parent
        filenames.extend(
            p.relative_to(path(".")).as_posix()
            for p in sorted((source_dir / "textures").glob("*"))
            if p.is_file()
        )
        bindings = source_dir / "semantic-regions.json"
        if bindings.exists():
            filenames.append(bindings.relative_to(path(".")).as_posix())
        entries = []
        for index, filename in enumerate(filenames):
            snapshot = root + f"/{index:03d}-" + path(filename).name
            shutil.copyfile(path(filename), path(snapshot))
            entries.append(
                {"original": filename, "snapshot": snapshot, "sha256": digest(snapshot)}
            )
        manifest = {"schemaVersion": 1, "name": name, "files": entries, "view": view}
        path(root + "/checkpoint.json").write_text(
            json.dumps(manifest, indent=2) + "\n"
        )
        return root + "/checkpoint.json"

    def restore(self, filename):
        manifest = json.loads(path(filename).read_text())
        for entry in manifest["files"]:
            if digest(entry["snapshot"]) != entry["sha256"]:
                raise ValueError("Checkpoint was changed: " + entry["snapshot"])
        for entry in manifest["files"]:
            shutil.copyfile(path(entry["snapshot"]), path(entry["original"]))
        bpy.ops.wm.open_mainfile(filepath=str(path(self.state["source"])))
        # A texture created by a rejected operation must not survive on disk.
        kept = {entry["original"] for entry in manifest["files"]}
        bindings = path(self.state["source"]).parent / "semantic-regions.json"
        if bindings.exists() and bindings.relative_to(path(".")).as_posix() not in kept:
            bindings.unlink()
        texture_dir = path(self.state["source"]).parent / "textures"
        for filename in texture_dir.glob("*"):
            if (
                filename.is_file()
                and filename.relative_to(path(".")).as_posix() not in kept
            ):
                filename.unlink()
        return manifest["view"]

    def save_source(self):
        # Source image references stay portable, including newly painted masks.
        for image in bpy.data.images:
            if image.source == "FILE" and image.filepath:
                filename = (
                    path(self.state["source"]).parent
                    / "textures"
                    / __import__("pathlib").Path(bpy.path.abspath(image.filepath)).name
                )
                if filename.exists():
                    image.filepath = "//textures/" + filename.name
        save(self.state)
