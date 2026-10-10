"""Role-separated visual iteration. A fixed API, not an arbitrary-code endpoint."""

import json
import math
import shutil
import time
import bpy
from authoring.context import load, objects, path
from authoring.materials.anime import apply as apply_materials
from authoring.render_review.sheets import sheet
from .regions import Regions
from .observation import Observer, PASSES, ANGLES
from .operations import brush, mesh_edit, screen_grab, hair_edit, BRUSHES
from .painting import paint
from .comparison import compare
from .state import History, digest, appearance_digest
from .components import curve, library_import
from .eyelids import edit as eye_edit
from .constraints import validate

CATALOG = {
    "VIEW": ["view.set", "view.orbit", "view.frame_region", "view.mode"],
    "SELECT": [
        "select.region",
        "select.vertices",
        "select.grow",
        "select.shrink",
        "select.invert",
        "select.mask",
        "select.clear_masks",
    ],
    "SCULPT": ["sculpt." + x for x in sorted(BRUSHES)],
    "MESH": [
        "mesh." + x
        for x in [
            "move",
            "proportional_move",
            "scale",
            "rotate",
            "smooth",
            "relax",
            "subdivide",
            "insert_loop",
            "edge_slide",
            "delete_loop",
            "merge",
            "split",
            "snap_to_surface",
            "shrinkwrap",
            "reproject",
            "subdivision",
            "multires",
            "voxel_remesh",
        ]
    ],
    "CAMERA": ["camera.screen_grab", "camera.project_region"],
    "CURVES": [
        "curve." + x
        for x in ["create", "edit", "move", "add", "remove", "profile", "convert"]
    ],
    "HAIR": ["hair.reshape", "hair.screen_grab"],
    "EYES": [
        "eye." + x
        for x in [
            "upper_arc",
            "lower_arc",
            "outer_canthus",
            "inner_canthus",
            "slant",
            "depth",
            "iris_exposure",
            "lid_thickness",
        ]
    ],
    "MATERIAL": ["material.set", "material.apply"],
    "PAINT": [
        "paint.stroke",
        "paint.erase",
        "paint.blur",
        "paint.smudge",
        "paint.fill",
        "paint.gradient",
        "paint.mirror",
        "paint.create_mask",
    ],
    "LIGHTING": ["lighting.set", "lighting.sweep"],
    "STATE": [
        "state.checkpoint",
        "state.restore",
        "state.undo",
        "state.redo",
        "state.variant",
        "state.save",
        "state.reload",
    ],
    "RENDER": [
        "render.view",
        "render.region",
        "render.contact_sheet",
        "render.turntable",
    ],
    "COMPARE": ["compare.renders", "compare.paintover"],
    "LOOP": [
        "critic.record",
        "artist.edit",
        "reviewer.decide",
        "library.import",
        "example.save",
    ],
}
EDITABLE = set(
    CATALOG["SCULPT"]
    + CATALOG["MESH"]
    + CATALOG["CURVES"]
    + CATALOG["HAIR"]
    + CATALOG["MATERIAL"]
    + CATALOG["PAINT"]
    + CATALOG["EYES"]
    + ["camera.screen_grab", "library.import"]
)


class Artist:
    def __init__(self, workflow, size=768):
        self.workflow = workflow
        self.state = load(workflow)
        self.size = size
        self.history = History(self.state)
        self.reload()
        if self.history.data["pending"]:
            self.observer.view = self.history.data["pending"]["view"]
            self.observer.configure()
        self.last_observation = None
        if self.history.data.get("viewport"):
            self.observer.view = self.history.data["viewport"]
            self.observer.configure()

    def reload(self, view=None):
        self.state = json.loads(path(self.workflow).read_text())
        self.regions = Regions(self.state)
        self.observer = Observer(self.state, self.size)
        bpy.context.scene["TANGER_artist_profile"] = self.state["shaderProfile"]
        if view:
            self.observer.view = view
            self.observer.configure()
        self.loaded_source_sha = digest(self.state["source"])
        self.loaded_geometry = self.geometry_signature()

    def geometry_signature(self):
        import hashlib
        import numpy as np

        value = hashlib.sha256()
        for obj in sorted(objects(self.state), key=lambda obj: obj.name):
            value.update(obj.name.encode())
            value.update(np.array(obj.matrix_world, dtype=np.float32).tobytes())
            if obj.type == "CURVE":
                for spline in obj.data.splines:
                    for point in spline.bezier_points:
                        value.update(
                            np.array(
                                [
                                    point.co[:],
                                    point.handle_left[:],
                                    point.handle_right[:],
                                ],
                                dtype=np.float32,
                            ).tobytes()
                        )
            if obj.type == "ARMATURE":
                for bone in obj.pose.bones:
                    value.update(np.array(bone.matrix, dtype=np.float32).tobytes())
            if obj.type != "MESH":
                continue
            if obj.data.shape_keys:
                for key in obj.data.shape_keys.key_blocks:
                    value.update(str(key.value).encode())
            coordinates = np.empty(len(obj.data.vertices) * 3, dtype=np.float32)
            obj.data.vertices.foreach_get("co", coordinates)
            value.update(obj.name.encode())
            value.update(coordinates.tobytes())
            value.update(str(len(obj.data.polygons)).encode())
        return value.hexdigest()

    def synchronized(self):
        if digest(self.state["source"]) != self.loaded_source_sha:
            raise ValueError(
                "Source was saved outside this session; use state.reload before observing or editing"
            )
        if self.geometry_signature() != self.loaded_geometry:
            raise ValueError(
                "Unsaved native geometry changes: save them manually then state.reload, or reopen the source before using guarded artist edits"
            )

    def info(self):
        return {
            "mode": "ARTIST_MODE",
            "character": self.state["character"],
            "sourceSha256": digest(self.state["source"]),
            "view": self.observer.view,
            "selection": self.regions.report(),
            "pendingReview": self.history.data["pending"],
            "objects": [
                {
                    "name": o.name,
                    "type": o.type,
                    "materials": (
                        [m.name for m in o.data.materials if m]
                        if o.type == "MESH"
                        else []
                    ),
                }
                for o in objects(self.state)
            ],
            "catalog": CATALOG,
            "diagnostics": sorted(PASSES),
            "regions": self.regions.catalog(),
        }

    def execute(self, request):
        if not isinstance(request, dict) or set(request) - {"role", "action", "args"}:
            raise ValueError(
                "Expected role, action, args; arbitrary Python is not supported"
            )

        def finite(value):
            if isinstance(value, float) and not math.isfinite(value):
                raise ValueError("Tool numbers must be finite")
            if isinstance(value, dict):
                for item in value.values():
                    finite(item)
            if isinstance(value, list):
                for item in value:
                    finite(item)

        finite(request)
        role = request.get("role")
        action = request.get("action")
        args = request.get("args", {})
        if role not in ["critic", "artist", "reviewer"]:
            raise ValueError("Use a logical critic, artist, or reviewer role")
        if not isinstance(args, dict):
            raise ValueError("Tool arguments must be an object")
        if action == "session.info":
            return self.info()
        if action == "session.stop":
            return {"stop": True}
        if action not in ["state.reload"]:
            self.synchronized()
        if action in EDITABLE:
            raise ValueError(
                "Artistic mutations must be submitted through artist.edit, with critique and review"
            )
        if action == "artist.edit":
            if role != "artist":
                raise ValueError("Only the artist role edits")
            return self.edit(args)
        if action == "critic.record":
            if role != "critic":
                raise ValueError("Only the critic role diagnoses")
            return self.critique(args)
        if action == "reviewer.decide":
            if role != "reviewer":
                raise ValueError("Only the reviewer role accepts/rejects")
            return self.review(args)
        if action.startswith("state."):
            if role != "artist":
                raise ValueError("State mutation requires artist role")
            return self.state_action(action, args)
        if action.startswith("view."):
            if action == "view.set":
                return self.observer.set_view(args)
            if action == "view.orbit":
                return self.observer.orbit(args)
            if action == "view.frame_region":
                return self.observer.frame_region(self.regions, args)
            if action == "view.mode":
                from .observation import MODES

                if args["mode"] not in MODES:
                    raise ValueError("Unknown viewport mode")
                self.observer.view["mode"] = args["mode"]
                return self.observer.configure()
        if action.startswith("select."):
            if action == "select.vertices":
                obj = bpy.data.objects.get(args["object"])
                if not obj or obj.type != "MESH" or obj not in objects(self.state):
                    raise ValueError("Low-level selection requires a SOURCE mesh")
                indices = args["indices"]
                if not indices or any(
                    not isinstance(i, int) or not 0 <= i < len(obj.data.vertices)
                    for i in indices
                ):
                    raise ValueError("Vertex index is out of bounds")
                group = obj.vertex_groups.get("artist/manual") or obj.vertex_groups.new(
                    name="artist/manual"
                )
                group.remove(list(range(len(obj.data.vertices))))
                group.add(indices, 1, "REPLACE")
                self.regions.bindings["manual"] = {
                    "objects": [obj.name],
                    "group": "artist/manual",
                }
                return self.regions.select("manual")
            if action == "select.region":
                return self.regions.select(args["region"])
            if action in ["select.grow", "select.shrink"]:
                return self.regions.grow(
                    args.get("amount", 1), action == "select.shrink"
                )
            if action == "select.invert":
                self.regions.selection = {
                    o: {i: 1 for i in range(len(o.data.vertices)) if i not in values}
                    for o, values in self.regions.selection.items()
                }
                return self.regions.report()
            if action == "select.mask":
                self.regions.resolve(args["region"])
                self.regions.masks.add(args["region"])
                return {"masked": sorted(self.regions.masks)}
            if action == "select.clear_masks":
                self.regions.masks.clear()
                return {"masked": []}
        if action == "camera.project_region":
            from bpy_extras.object_utils import world_to_camera_view

            self.regions.select(args["region"])
            p = world_to_camera_view(
                bpy.context.scene,
                self.observer.camera,
                __import__("mathutils").Vector(self.regions.report()["center"]),
            )
            return {
                "region": args["region"],
                "point": [p.x * self.size, (1 - p.y) * self.size],
                "depth": p.z,
                "size": self.size,
            }
        if action == "lighting.set":
            return self.observer.lighting(args)
        if action == "lighting.sweep":
            return self.observer.sweep(
                self.artifact_root(args.get("id", "light-sweep")), args.get("angles")
            )
        if action in ["render.view", "render.region"]:
            if action == "render.region":
                self.observer.frame_region(self.regions, args)
            root = self.artifact_root(args.get("id", "observation"))
            record = self.observer.render(root + "/view.png", args.get("pass"))
            record["sourceSha256"] = digest(self.state["source"])
            record["appearanceSha256"] = appearance_digest(self.state)
            self.last_observation = record
            path(root + "/observation.json").write_text(
                json.dumps(record, indent=2) + "\n"
            )
            return record
        if action in ["render.contact_sheet", "render.turntable"]:
            root = self.artifact_root(args.get("id", "views"))
            view = dict(self.observer.view)
            records = []
            try:
                if action == "render.turntable":
                    for angle in args.get("angles", range(0, 360, 30)):
                        self.observer.view["name"] = "turntable"
                        self.observer.view["yaw"] = math.radians(angle)
                        self.observer.configure()
                        records.append(
                            self.observer.render(
                                root + f"/yaw-{angle:03}.png", args.get("pass")
                            )
                        )
                    names = []
                else:
                    names = args.get(
                        "views",
                        ["front", "portrait_3q", "profile", "high_3q", "low_3q"],
                    )
                for name in names:
                    self.observer.set_view({"name": name})
                    records.append(
                        self.observer.render(
                            root + "/" + name + ".png", args.get("pass")
                        )
                    )
                sheet(
                    [path(x["path"]) for x in records],
                    path(root + "/contact-sheet.png"),
                )
            finally:
                self.observer.view = view
                self.observer.configure()
            return {"images": records, "contactSheet": root + "/contact-sheet.png"}
        if action in ["compare.renders", "compare.paintover"]:
            return compare(
                args["before"],
                args["after"],
                self.artifact_root(args.get("id", "comparison")),
                action == "compare.paintover",
            )
        if action == "example.save":
            if role != "reviewer":
                raise ValueError("Only reviewer can publish a solved example")
            return self.example(args)
        raise ValueError("Unknown tool: " + str(action))

    def artifact_root(self, name):
        if not name or any(
            c not in "abcdefghijklmnopqrstuvwxyz0123456789-" for c in name
        ):
            raise ValueError("Artifact ID must use lowercase letters, digits, hyphens")
        root = self.history.root + "/observations/" + name
        path(root).mkdir(parents=True, exist_ok=False)
        return root

    def critique(self, args):
        if self.history.data["pending"]:
            raise ValueError("Review the pending edit before a new critique")
        evidence = args.get("evidence", self.last_observation)
        if not evidence or not 1 <= len(args.get("problems", [])) <= 3:
            raise ValueError(
                "Critique needs observed evidence and 1–3 high-impact problems"
            )
        record = json.loads(path(evidence["path"] + ".json").read_text())
        if digest(evidence["path"]) != record["sha256"]:
            raise ValueError("Observation image was changed")
        observed = path(evidence["path"]).parent / "observation.json"
        if (
            not observed.exists()
            or json.loads(observed.read_text())["sourceSha256"]
            != digest(self.state["source"])
            or json.loads(observed.read_text()).get("appearanceSha256")
            != appearance_digest(self.state)
        ):
            raise ValueError("Critique must inspect a current source observation")
        for problem in args["problems"]:
            if not all(
                isinstance(problem.get(k), str) and problem[k].strip()
                for k in [
                    "region",
                    "problem",
                    "consequence",
                    "correction",
                    "severity",
                    "scale",
                ]
            ):
                raise ValueError(
                    "Each diagnosis needs region, problem, consequence, correction, severity, scale"
                )
            self.regions.resolve(problem["region"])
            if problem["scale"] not in ["primary", "secondary", "tertiary"]:
                raise ValueError("Unknown visual scale")
            if problem["severity"] not in ["BLOCKING", "HIGH", "MEDIUM", "LOW"]:
                raise ValueError("Unknown severity")
        critique = {
            "role": "critic",
            "sourceSha256": digest(self.state["source"]),
            "appearanceSha256": appearance_digest(self.state),
            "evidence": evidence,
            "problems": args["problems"],
        }
        self.history.data["critique"] = critique
        self.history.flush()
        return critique

    def edit(self, args):
        history = self.history.data
        if history["pending"]:
            raise ValueError("Pending review blocks further artistic edits")
        critique = history["critique"]
        ops = args.get("operations", [])
        if (
            not critique
            or critique["sourceSha256"] != digest(self.state["source"])
            or critique.get("appearanceSha256") != appearance_digest(self.state)
        ):
            raise ValueError("A current critic diagnosis is required")
        if not 1 <= len(ops) <= 3:
            raise ValueError(
                "Significant edit batches contain 1–3 operations, then visual review"
            )
        if any(p["scale"] == "tertiary" for p in critique["problems"]):
            # A request cannot self-certify solved primary/secondary forms.
            assessment = self.state.get("latestAssessment")
            review = json.loads(path(assessment).read_text()) if assessment else {}
            if review.get("sourceSha256") != digest(self.state["source"]) or any(
                review.get("categories", {}).get(k, {}).get("severity") != "PASS"
                for k in [
                    "silhouette",
                    "face",
                    "eyes",
                    "profile",
                    "hair",
                    "anatomy",
                    "clothing",
                ]
            ):
                raise ValueError(
                    "Tertiary edits require current primary/secondary form gates to pass"
                )
        for op in ops:
            if set(op) - {"tool", "region", "args"} or op.get("tool") not in EDITABLE:
                raise ValueError("Unsupported artistic operation")
        identifier = args["id"]
        root = self.artifact_root(identifier)
        view = dict(self.observer.view)
        before = self.observer.render(root + "/before.png", args.get("pass"))
        checkpoint = self.history.checkpoint(identifier + "-before", view)
        results = []
        try:
            for op in ops:
                results.append(self.mutate(op))
            self.history.save_source()
            self.loaded_source_sha = digest(self.state["source"])
            self.loaded_geometry = self.geometry_signature()
            after = self.observer.render(root + "/after.png", args.get("pass"))
            comparison = compare(before["path"], after["path"], root + "/compare")
            after_checkpoint = self.history.checkpoint(identifier + "-after", view)
        except Exception:
            restored = self.history.restore(checkpoint)
            self.reload(restored)
            raise
        cycle = {
            "id": identifier,
            "critique": critique,
            "operations": ops,
            "results": results,
            "view": view,
            "before": before,
            "after": after,
            "comparison": comparison,
            "beforeCheckpoint": checkpoint,
            "afterCheckpoint": after_checkpoint,
            "sourceSha256": digest(self.state["source"]),
            "appearanceSha256": appearance_digest(self.state),
            "outcome": "pending",
            "review": None,
        }
        history["cycles"].append(cycle)
        history["pending"] = cycle
        history["redo"] = []
        self.history.flush()
        return {
            "affected": results,
            "preview": after,
            "comparison": comparison,
            "pendingReview": identifier,
            "checkpoint": checkpoint,
        }

    def mutate(self, op):
        tool = op["tool"]
        args = op.get("args", {})
        region = op.get("region")
        if region:
            self.regions.select(region)
        if (
            tool.startswith(("sculpt.", "mesh.", "hair.", "camera.", "paint."))
            and not self.regions.selection
        ):
            raise ValueError("Select a semantic region first")
        count = 0
        extra = {}
        if tool.startswith("sculpt."):
            count = brush(self.regions, tool.split(".")[1], args, self.observer.camera)
        elif tool.startswith("mesh."):
            count = mesh_edit(
                self.regions, tool.split(".")[1], args, self.observer.camera
            )
        elif tool in ["camera.screen_grab", "hair.screen_grab"]:
            count = screen_grab(self.regions, args, self.observer.camera)
        elif tool == "hair.reshape":
            count = hair_edit(self.regions, args)
        elif tool.startswith("eye."):
            count = eye_edit(
                self.regions, tool.split(".")[1], args, self.observer.camera
            )
        elif tool.startswith("curve."):
            extra = curve(self.state, tool.split(".")[1], args)
        elif tool.startswith("paint."):
            if not path(args["image"]).is_relative_to(
                path(self.state["source"]).parent / "textures"
            ):
                raise ValueError(
                    "Paint only this character’s source textures; import a copy of external references first"
                )
            if tool == "paint.create_mask":
                from .painting import create_mask

                extra = create_mask(self.state, args)
            else:
                extra = paint(self.regions, {**args, "mode": tool.split(".")[1]})
        elif tool.startswith("material."):
            profile = json.loads(path(self.state["shaderProfile"]).read_text())
            if tool == "material.set":
                keys = args["parameter"].split(".")
                target = profile
                for key in keys[:-1]:
                    target = target[key]
                if keys[-1] not in target:
                    raise ValueError("Unknown material parameter")
                old = target[keys[-1]]
                value = args["value"]
                if isinstance(old, (float, int)) and (
                    not isinstance(value, (float, int)) or not math.isfinite(value)
                ):
                    raise ValueError("Expected finite material number")
                if isinstance(old, list) and (
                    not isinstance(value, list) or len(value) != len(old)
                ):
                    raise ValueError("Material tuple size changed")
                target[keys[-1]] = value
                validate(
                    json.loads(
                        path("art/schemas/anime-shader-profile.schema.json").read_text()
                    ),
                    profile,
                )
                path(self.state["shaderProfile"]).write_text(
                    json.dumps(profile, indent=2) + "\n"
                )
            apply_materials(profile, objects(self.state))
            extra = {
                "parameter": args.get("parameter", "profile"),
                "value": args.get("value"),
                "affectedMaterials": sorted(
                    {
                        m.name
                        for o in objects(self.state)
                        if o.type == "MESH"
                        for m in o.data.materials
                        if m
                    }
                ),
            }
        elif tool == "library.import":
            extra = library_import(self.state, args)
        else:
            raise ValueError("Unknown mutation")
        self.observer.configure()
        return {
            "tool": tool,
            "region": region or self.regions.selected_name,
            "affectedVertices": count,
            **extra,
        }

    def review(self, args):
        cycle = self.history.data["pending"]
        if not cycle:
            raise ValueError("No pending edit")
        verdict = args.get("verdict")
        decision = args.get("decision")
        reason = args.get("reason", "")
        if (
            verdict not in ["BETTER", "WORSE", "MIXED"]
            or decision not in ["accepted", "rejected", "partially accepted"]
            or not reason.strip()
        ):
            raise ValueError("Reviewer needs verdict, decision and visual reasons")
        if verdict == "WORSE" and decision != "rejected":
            raise ValueError("Worse edits must be restored")
        if verdict == "MIXED" and decision == "accepted":
            raise ValueError(
                "Mixed results must be rejected or partially accepted, with unresolved defects"
            )
        if (
            digest(self.state["source"]) != cycle["sourceSha256"]
            or appearance_digest(self.state) != cycle["appearanceSha256"]
        ):
            raise ValueError("Source changed outside the pending review")
        if args.get("id") != cycle["id"]:
            raise ValueError("Review ID does not match pending edit")
        cycle["review"] = {
            "role": "reviewer",
            "verdict": verdict,
            "decision": decision,
            "reason": reason,
        }
        cycle["outcome"] = decision
        if decision == "rejected":
            view = self.history.restore(cycle["beforeCheckpoint"])
            self.reload(view)
        else:
            self.history.data["undo"].append(
                {
                    "before": cycle["beforeCheckpoint"],
                    "after": cycle["afterCheckpoint"],
                    "cycle": cycle["id"],
                }
            )
        # Restore can replace bpy state, but never discard the artistic record.
        self.history.data["pending"] = None
        self.history.data["critique"] = None
        self.history.flush()
        return {
            "outcome": decision,
            "restored": decision == "rejected",
            "sourceSha256": digest(self.state["source"]),
            "comparison": cycle["comparison"],
        }

    def state_action(self, action, args):
        if self.history.data["pending"]:
            raise ValueError("Review pending edit first; reject it to restore")
        history = self.history.data
        if action == "state.save":
            self.history.save_source()
            self.loaded_source_sha = digest(self.state["source"])
            self.loaded_geometry = self.geometry_signature()
            history["critique"] = None
            self.history.flush()
            return {"saved": self.state["source"]}
        if action == "state.reload":
            view = dict(self.observer.view)
            load(self.workflow)
            self.reload(view)
            history["critique"] = None
            self.history.flush()
            return {"reloaded": self.state["source"]}
        if action == "state.checkpoint":
            return {
                "checkpoint": self.history.checkpoint(
                    args["name"], dict(self.observer.view)
                )
            }
        if action == "state.variant":
            if not args["name"] or any(
                c not in "abcdefghijklmnopqrstuvwxyz0123456789-" for c in args["name"]
            ):
                raise ValueError("Invalid variant name")
            root = self.state["checkpointRoot"] + "/variants/" + args["name"]
            path(root).mkdir(parents=True, exist_ok=False)
            checkpoint = self.history.checkpoint(
                "variant-" + args["name"], dict(self.observer.view)
            )
            return {"variant": checkpoint}
        if action in ["state.undo", "state.redo"]:
            source, destination = (
                ("undo", "redo") if action == "state.undo" else ("redo", "undo")
            )
            if not history[source]:
                raise ValueError("No " + source + " available")
            item = history[source].pop()
            view = self.history.restore(item["before" if source == "undo" else "after"])
            history[destination].append(item)
            self.reload(view)
            history["critique"] = None
            self.history.flush()
            return {
                "restored": item["cycle"],
                "sourceSha256": digest(self.state["source"]),
            }
        if action == "state.restore":
            before = self.history.checkpoint(
                "restore-" + str(time.time_ns()), dict(self.observer.view)
            )
            view = self.history.restore(args["checkpoint"])
            self.reload(view)
            history["undo"].append(
                {
                    "before": before,
                    "after": args["checkpoint"],
                    "cycle": "manual-restore",
                }
            )
            history["redo"] = []
            history["critique"] = None
            self.history.flush()
            return {"restored": args["checkpoint"]}
        raise ValueError("Unknown state tool")

    def example(self, args):
        cycle = next(
            (x for x in self.history.data["cycles"] if x["id"] == args["cycle"]), None
        )
        if (
            not cycle
            or cycle["outcome"] != "accepted"
            or cycle["review"]["verdict"] != "BETTER"
        ):
            raise ValueError("Solved examples require a better, accepted visual review")
        category = args["category"]
        if category not in ["face", "hair", "clothing", "deformation", "materials"]:
            raise ValueError("Unknown example category")
        name = args["name"]
        if not name or any(
            c not in "abcdefghijklmnopqrstuvwxyz0123456789-" for c in name
        ):
            raise ValueError("Invalid example name")
        root = "art/examples/" + category + "/" + name
        path(root).mkdir(parents=True, exist_ok=False)
        for key in ["before", "after"]:
            shutil.copyfile(path(cycle[key]["path"]), path(root + "/" + key + ".png"))
        for filename, data in [
            ("critique", cycle["critique"]),
            ("operations", cycle["operations"]),
            ("review", cycle["review"]),
        ]:
            path(root + "/" + filename + ".json").write_text(
                json.dumps(data, indent=2) + "\n"
            )
        return {"example": root, "whyImproved": cycle["review"]["reason"]}
