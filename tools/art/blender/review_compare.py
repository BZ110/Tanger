import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from common import arguments
from authoring.context import path
from authoring.render_review.sheets import sheet

workflow, before, after = arguments()
state = json.loads(path(workflow).read_text())
old = path(state["reviewRoot"] + "/" + before)
new = path(state["reviewRoot"] + "/" + after)
left = json.loads((old / "capture.json").read_text())
right = json.loads((new / "capture.json").read_text())
if left["cameraVersion"] != right["cameraVersion"]:
    raise ValueError("Camera versions differ")
pairs = []
for image in right["images"]:
    prior = next(
        (item for item in left["images"] if item["view"] == image["view"]), None
    )
    if not prior:
        continue
    for key in (
        "lensMm",
        "center",
        "span",
        "azimuth",
        "elevation",
        "lighting",
        "exposure",
    ):
        if prior[key] != image[key]:
            raise ValueError(f"Incomparable {image['view']}: {key} changed")
    output = new / ("compare-" + image["view"] + ".png")
    sheet([path(prior["path"]), path(image["path"])], output, columns=2, tile=720)
    pairs.append(
        {"view": image["view"], "before": prior["path"], "after": image["path"]}
    )
(new / "comparison.json").write_text(
    json.dumps({"before": before, "after": after, "pairs": pairs}, indent=2) + "\n"
)
