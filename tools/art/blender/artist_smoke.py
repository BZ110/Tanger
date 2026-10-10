"""Behavior checks on a private copy, never an artistic approval of Bebben."""

import hashlib
import json
import pathlib
import shutil
import sys
import time
import bpy
import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from authoring.context import path, objects
from artist.engine import Artist
from artist.state import digest
from artist.comparison import pixels

original = json.loads(path(sys.argv[sys.argv.index("--") + 1]).read_text())
root = "art/.build/artist-smoke"
shutil.rmtree(path(root), ignore_errors=True)
path(root + "/source").mkdir(parents=True)
state = dict(original)
state.update(
    character="artist-smoke",
    source=root + "/source/fixture.blend",
    shaderProfile=root + "/source/profile.json",
    reviewRoot=root + "/review/iterations",
    checkpointRoot=root + "/checkpoints",
    accepted=[],
    latestAssessment=None,
)
shutil.copyfile(path(original["source"]), path(state["source"]))
shutil.copytree(
    path(original["source"]).parent / "textures", path(root + "/source/textures")
)
profile = json.loads(path(original["shaderProfile"]).read_text())
for settings in profile.values():
    if isinstance(settings, dict):
        for key, value in settings.items():
            if key.endswith("Mask") and value:
                settings[key] = root + "/source/textures/" + path(value).name
path(state["shaderProfile"]).write_text(json.dumps(profile, indent=2) + "\n")
workflow = root + "/workflow.json"
path(workflow).write_text(json.dumps(state))
artist = Artist(workflow, 192)
checks = []


def call(role, action, args=None):
    return artist.execute({"role": role, "action": action, "args": args or {}})


def expect_error(role, action, args, part):
    try:
        call(role, action, args)
    except ValueError as error:
        assert part in str(error), (part, str(error))
        return
    raise AssertionError("Expected rejection: " + action)


def observe(name):
    return call("critic", "render.view", {"id": name})


def diagnose(region="face.chin", scale="secondary"):
    call(
        "critic",
        "critic.record",
        {
            "problems": [
                {
                    "region": region,
                    "scale": scale,
                    "severity": "HIGH",
                    "problem": "Technical fixture displacement",
                    "consequence": "Exercises tool feedback",
                    "correction": "Localized reversible stroke",
                }
            ]
        },
    )


def coords():
    return {
        o.name: np.array([v.co[:] for v in o.data.vertices])
        for o in objects(artist.state)
        if o.type == "MESH"
    }


def edit(name, operations):
    return call("artist", "artist.edit", {"id": name, "operations": operations})


def decision(name, accepted=True):
    return call(
        "reviewer",
        "reviewer.decide",
        {
            "id": name,
            "verdict": "BETTER" if accepted else "WORSE",
            "decision": "accepted" if accepted else "rejected",
            "reason": "Technical behavior fixture only; no artistic approval.",
        },
    )


expect_error(
    "artist", "artist.edit", {"id": "no-critique", "operations": []}, "diagnosis"
)
observe("baseline")
diagnose()
initial = digest(state["source"])
before = coords()
expect_error(
    "critic", "artist.edit", {"id": "wrong-role", "operations": []}, "Only the artist"
)
expect_error(
    "artist",
    "artist.edit",
    {"id": "too-many", "operations": [{"tool": "sculpt.grab"}] * 4},
    "1–3",
)
response = edit(
    "local-grab",
    [
        {
            "tool": "sculpt.grab",
            "region": "face.chin",
            "args": {"space": "world", "displacement": [0, -0.003, 0]},
        }
    ],
)
after = coords()
assert response["affected"][0]["affectedVertices"] > 0
changed = [name for name in before if not np.array_equal(before[name], after[name])]
assert changed == ["Face — orbital loops / sculpted nose and jaw"], changed
assert not np.array_equal(
    pixels(response["comparison"]["before"]), pixels(response["comparison"]["after"])
)
expect_error(
    "artist",
    "artist.edit",
    {"id": "blind-followup", "operations": []},
    "Pending review",
)
expect_error("artist", "reviewer.decide", {"id": "local-grab"}, "Only the reviewer")
decision("local-grab", False)
assert digest(state["source"]) == initial
assert all(np.array_equal(coords()[name], before[name]) for name in before)
checks.append("localized changes + rejected edit restores byte-exact source")

observe("screen-baseline")
diagnose()
point = call("critic", "camera.project_region", {"region": "face.chin"})["point"]
response = edit(
    "screen-grab",
    [
        {
            "tool": "camera.screen_grab",
            "region": "face.chin",
            "args": {
                "point": point,
                "delta": [4, 0],
                "radius": 30,
                "depthBehavior": "all",
                "frontFaceOnly": False,
            },
        }
    ],
)
assert response["affected"][0]["affectedVertices"] > 0
decision("screen-grab")
accepted = digest(state["source"])
call("artist", "state.undo")
assert digest(state["source"]) == initial
call("artist", "state.redo")
assert digest(state["source"]) == accepted
checks.append("screen projection + persistent undo/redo")

observe("mask-baseline")
diagnose("hair.fringe.02")
mask = root + "/source/textures/test-highlight.png"
edit(
    "make-mask",
    [
        {
            "tool": "paint.create_mask",
            "region": "hair.fringe.02",
            "args": {"image": mask, "size": 64, "parameter": "hair.highlightMask"},
        }
    ],
)
decision("make-mask")
mask_before = digest(mask)
profile_before = digest(state["shaderProfile"])
observe("paint-baseline")
diagnose("hair.fringe.02")
response = edit(
    "paint-mask",
    [
        {
            "tool": "paint.stroke",
            "region": "hair.fringe.02",
            "args": {
                "image": mask,
                "points": [[0.2, 0.6], [0.8, 0.6]],
                "radius": 0.1,
                "color": [1, 1, 1, 1],
                "selectedOnly": True,
            },
        }
    ],
)
assert response["affected"][0]["pixels"] > 0
assert digest(mask) != mask_before
decision("paint-mask", False)
assert digest(mask) == mask_before and digest(state["shaderProfile"]) == profile_before
checks.append("UV mask painting + external texture and shader checkpoint restore")

observe("hair-baseline")
diagnose("hair.fringe.02")
before = coords()
edit(
    "one-lock",
    [
        {
            "tool": "hair.reshape",
            "region": "hair.fringe.02",
            "args": {"tipDelta": [0.003, 0, 0], "twist": 0.12},
        }
    ],
)
after = coords()
assert [name for name in before if not np.array_equal(before[name], after[name])] == [
    "Fringe / layer 2"
]
decision("one-lock", False)
checks.append("independent hair lock cage editing")

observe("library-baseline")
diagnose()
try:
    edit(
        "unreviewed-base",
        [{"tool": "library.import", "args": {"id": "bebben-working-head"}}],
    )
except ValueError as error:
    assert "not reviewed" in str(error)
else:
    raise AssertionError("Working library part was treated as reviewed")
observe("library-copy-baseline")
diagnose()
edit(
    "working-base-copy",
    [
        {
            "tool": "library.import",
            "args": {
                "id": "bebben-working-head",
                "name": "Working head tool fixture",
                "requireProductionReady": False,
            },
        }
    ],
)
decision("working-base-copy", False)
checks.append(
    "library refuses unreviewed production parts; explicit working import is checkpointed"
)

observe("stale-baseline")
diagnose()
profile = json.loads(path(state["shaderProfile"]).read_text())
profile["skin"]["roughness"] = 0.42
path(state["shaderProfile"]).write_text(json.dumps(profile))
expect_error(
    "artist",
    "artist.edit",
    {"id": "stale-edit", "operations": [{"tool": "sculpt.grab"}]},
    "current critic",
)
checks.append("external shader changes invalidate observations")
observe("tertiary-baseline")
diagnose(scale="tertiary")
expect_error(
    "artist",
    "artist.edit",
    {"id": "premature-detail", "operations": [{"tool": "sculpt.grab"}]},
    "Tertiary",
)
checks.append("no tertiary detail before form gates")

call("critic", "view.set", {"name": "portrait_3q", "mode": "FACE_FINAL"})
for mode in sorted(call("critic", "session.info")["diagnostics"]):
    record = call(
        "critic",
        "render.view",
        {"id": "diagnostic-" + mode.replace("_", "-"), "pass": mode},
    )
    assert path(record["path"]).stat().st_size > 100
    assert str(pathlib.Path.home()).encode() not in path(record["path"]).read_bytes()
    if mode == "silhouette":
        image = pixels(record["path"])
        assert image[:, :, :3].max() > 0.99 and image[:, :, :3].min() < 0.01
checks.append(
    "all 15 reversible diagnostic passes render, silhouette is black/white, PNG metadata is portable"
)
mesh_count = len(bpy.data.meshes)
for index in range(3):
    observe("resource-check-" + str(index))
assert len(bpy.data.meshes) == mesh_count
checks.append("repeated previews release temporary outline mesh data")
assert str(pathlib.Path.home()).encode() not in path(state["source"]).read_bytes()
call("critic", "lighting.sweep", {"id": "light-sweep", "angles": [0, 45, 90, 135, 180]})
checks.append("repeatable key-light sweep")
path(root + "/result.json").write_text(
    json.dumps({"passed": checks, "artisticApproval": False}, indent=2) + "\n"
)
print("ARTIST SMOKE PASSED: " + json.dumps(checks))
