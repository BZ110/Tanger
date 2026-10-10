"""Persistent cameras, diagnostic views and reversible render overrides."""

import hashlib
import json
import math
import bpy
from mathutils import Vector
from authoring.context import objects, path
from authoring.privacy import sanitize_png
from authoring.materials.face_shadow import update_light
from authoring.render_review.scene import setup, frame, light_preset
from authoring.render_review.outlines import build as outlines, update_depth
from authoring.render_review.sheets import sheet

MODES = {
    "FACE_SCULPT": "matcap",
    "FACE_FINAL": "beauty",
    "SILHOUETTE": "silhouette",
    "TOPOLOGY": "wireframe",
    "HAIR_SCULPT": "clay",
    "CLOTHING_SCULPT": "clay",
    "DEFORMATION": "clay",
}
PASSES = {
    "beauty",
    "clay",
    "matcap",
    "silhouette",
    "wireframe",
    "normals",
    "depth",
    "ambient_occlusion",
    "flat_albedo",
    "material_ids",
    "shadow_only",
    "specular_only",
    "outline_only",
    "face_shadow_mask",
    "hair_highlight_mask",
}
ANGLES = {
    "front": (0, 0),
    "profile": (math.pi / 2, 0),
    "portrait_3q": (math.pi / 4, 0),
    "portrait_3q_left": (-math.pi / 4, 0),
    "high_3q": (math.pi / 4, 0.25),
    "low_3q": (math.pi / 4, -0.2),
    "back": (math.pi, 0),
}


class Observer:
    def __init__(self, state, size=768):
        self.state = state
        self.size = size
        self.view = {
            "name": "portrait_3q",
            "center": state["framing"]["headCenter"],
            "span": state["framing"]["headSpan"],
            "yaw": math.pi / 4,
            "pitch": 0,
            "mode": "FACE_FINAL",
            "lighting": "neutral",
            "keyYaw": None,
            "keyElevation": 35,
            "fill": None,
            "rim": None,
        }
        # Scene controls are reusable and never added to the source collection.
        for o in list(bpy.data.objects):
            if o.name.startswith(
                ("TANGER 85mm review camera", "Review Key", "Review Fill", "Review Rim")
            ):
                data = o.data
                bpy.data.objects.remove(o, do_unlink=True)
                if data.users == 0:
                    (
                        bpy.data.cameras
                        if isinstance(data, bpy.types.Camera)
                        else bpy.data.lights
                    ).remove(data)
        self.camera, self.lights = setup(size)
        bpy.context.scene.eevee.taa_render_samples = 48
        self.configure()

    def configure(self):
        frame(
            self.camera,
            self.view["center"],
            self.view["span"],
            self.view["yaw"],
            self.view["pitch"],
        )
        direction = light_preset(
            self.lights, self.view["lighting"], self.state["framing"]["headCenter"]
        )
        if self.view["keyYaw"] is not None:
            yaw = math.radians(self.view["keyYaw"])
            pitch = math.radians(self.view["keyElevation"])
            direction = Vector(
                (
                    math.sin(yaw) * math.cos(pitch),
                    -math.cos(yaw) * math.cos(pitch),
                    math.sin(pitch),
                )
            )
            key = self.lights[0]
            key.location = Vector(self.state["framing"]["headCenter"]) + direction * 4
            key.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
        if self.view["fill"] is not None:
            self.lights[1].data.energy = self.view["fill"]
        if self.view["rim"] is not None:
            self.lights[2].data.energy = self.view["rim"]
        profile = json.loads(path(self.state["shaderProfile"]).read_text())
        update_light(profile, direction)
        for obj in objects(self.state):
            if (
                obj.type == "MESH"
                and any(m and m.name == "Hair" for m in obj.data.materials)
                and not obj.name.startswith("Soft eyebrow")
            ):
                obj.hide_set(self.view["mode"] == "FACE_SCULPT")
        # GUI sessions retain actual 3D viewport shading and camera alignment.
        for screen in bpy.data.screens:
            for area in screen.areas:
                if area.type == "VIEW_3D":
                    space = area.spaces.active
                    space.region_3d.view_perspective = "CAMERA"
                    space.shading.type = (
                        "MATERIAL" if self.view["mode"] == "FACE_FINAL" else "SOLID"
                    )
                    space.shading.light = (
                        "MATCAP" if self.view["mode"] == "FACE_SCULPT" else "STUDIO"
                    )
                    space.overlay.show_wireframes = self.view["mode"] == "TOPOLOGY"
                    space.overlay.show_extras = False
                    space.overlay.show_relationship_lines = False
                    space.overlay.show_floor = False
                    space.overlay.show_axis_x = False
                    space.overlay.show_axis_y = False
                    if self.view["mode"] in ["FACE_SCULPT", "TOPOLOGY"]:
                        space.shading.color_type = "SINGLE"
                        space.shading.single_color = (0.55, 0.55, 0.55)
                    area.tag_redraw()
        return dict(self.view)

    def set_view(self, args):
        name = args.get("name", self.view["name"])
        if name not in ANGLES:
            raise ValueError("Unknown named view")
        self.view.update(name=name, yaw=ANGLES[name][0], pitch=ANGLES[name][1])
        if "mode" in args:
            if args["mode"] not in MODES:
                raise ValueError("Unknown viewport mode")
            self.view["mode"] = args["mode"]
        return self.configure()

    def orbit(self, args):
        self.view["yaw"] += math.radians(args.get("yaw", 0))
        self.view["pitch"] += math.radians(args.get("pitch", 0))
        self.view["name"] = "custom"
        return self.configure()

    def frame_region(self, regions, args):
        regions.select(args["region"])
        bounds = [
            o.matrix_world @ o.data.vertices[i].co
            for o, values in regions.selection.items()
            for i in values
        ]
        if not bounds:
            raise ValueError("Empty region")
        low = Vector([min(p[a] for p in bounds) for a in range(3)])
        high = Vector([max(p[a] for p in bounds) for a in range(3)])
        self.view["center"] = list((low + high) / 2)
        self.view["span"] = max(high - low) * args.get("margin", 1.6)
        return self.configure()

    def lighting(self, args):
        for key in ["keyYaw", "keyElevation", "fill", "rim", "lighting"]:
            if key in args:
                self.view[key] = args[key]
        if self.view["lighting"] not in [
            "front",
            "quarter",
            "side",
            "opposite",
            "neutral",
            "dramatic",
        ]:
            raise ValueError("Unknown lighting preset")
        return self.configure()

    def render(self, filename, mode=None):
        mode = mode or MODES[self.view["mode"]]
        if mode not in PASSES:
            raise ValueError("Unsupported diagnostic pass")
        self.configure()
        source = objects(self.state)
        scene = bpy.context.scene
        saved_hidden = {o: (o.hide_render, o.hide_get()) for o in scene.objects}
        slots = {}
        temporary = []
        hulls = []
        scene.render.resolution_x = scene.render.resolution_y = self.size
        scene.render.film_transparent = mode not in ["silhouette", "outline_only"]
        background = scene.world.node_tree.nodes["Background"]
        saved_background = (
            background.inputs[0].default_value[:],
            background.inputs[1].default_value,
        )
        if mode in ["silhouette", "outline_only"]:
            background.inputs[0].default_value = (1, 1, 1, 1)
            background.inputs[1].default_value = 1
        previous_exposure = scene.view_settings.exposure
        scene.view_settings.exposure = -1.8 if mode == "clay" else 0
        try:
            for o in scene.objects:
                o.hide_render = o not in source and o not in [self.camera, *self.lights]
                if o in source:
                    o.hide_render = False
                    if self.view["mode"] == "FACE_SCULPT" and (
                        any(s in o.name.lower() for s in ["hair", "lock", "fringe"])
                        or (
                            o.type == "MESH"
                            and any(m and m.name == "Hair" for m in o.data.materials)
                            and not o.name.startswith("Soft eyebrow")
                        )
                    ):
                        o.hide_render = True
                    o.hide_set(o.hide_render)
            profile = json.loads(path(self.state["shaderProfile"]).read_text())
            if mode in ["beauty", "outline_only"]:
                hulls = outlines(source, profile["outline"])
                update_depth(hulls, self.camera)
                if mode == "outline_only":
                    for o in source:
                        o.hide_render = True
            if mode not in ["beauty", "outline_only"]:
                for obj in source:
                    if obj.type != "MESH":
                        continue
                    slots[obj] = list(obj.data.materials)
                    for i, original in enumerate(slots[obj]):
                        material = diagnostic(original, mode, obj, self.view["mode"])
                        temporary.append(material)
                        obj.data.materials[i] = material
            scene.render.filepath = str(path(filename))
            path(filename).parent.mkdir(parents=True, exist_ok=True)
            bpy.ops.render.render(write_still=True)
            sanitize_png(path(filename))
        finally:
            for obj, materials in slots.items():
                obj.data.materials.clear()
                for material in materials:
                    obj.data.materials.append(material)
            hull_meshes = [o.data for o in hulls]
            hull_materials = {m for o in hulls for m in o.data.materials if m}
            for o in hulls:
                bpy.data.objects.remove(o, do_unlink=True)
            for mesh in hull_meshes:
                if mesh.users == 0:
                    bpy.data.meshes.remove(mesh)
            for material in hull_materials:
                if material.users == 0:
                    bpy.data.materials.remove(material)
            for material in temporary:
                bpy.data.materials.remove(material)
            for obj, (hidden, viewport) in saved_hidden.items():
                obj.hide_render = hidden
                obj.hide_set(viewport)
            scene.view_settings.exposure = previous_exposure
            background.inputs[0].default_value = saved_background[0]
            background.inputs[1].default_value = saved_background[1]
        record = {
            "path": filename,
            "sha256": hashlib.sha256(path(filename).read_bytes()).hexdigest(),
            "cameraVersion": "tanger-artist-v2-85mm-vertical36",
            "size": self.size,
            "view": dict(self.view),
            "pass": mode,
            "exposure": -1.8 if mode == "clay" else 0,
            "pose": {
                "frame": scene.frame_current,
                "morphs": {
                    o.name: {k.name: k.value for k in o.data.shape_keys.key_blocks}
                    for o in source
                    if o.type == "MESH" and o.data.shape_keys
                },
                "bones": {
                    o.name: {
                        b.name: [list(row) for row in b.matrix] for b in o.pose.bones
                    }
                    for o in source
                    if o.type == "ARMATURE"
                },
            },
        }
        path(filename + ".json").write_text(json.dumps(record, indent=2) + "\n")
        return record

    def sweep(self, root, angles=None):
        original = dict(self.view)
        records = []
        try:
            for angle in angles or range(0, 181, 15):
                self.lighting({"keyYaw": angle})
                records.append(self.render(root + f"/key-{angle:03}.png", "beauty"))
            sheet([path(r["path"]) for r in records], path(root + "/contact-sheet.png"))
        finally:
            self.view = original
            self.configure()
        return {"images": records, "contactSheet": root + "/contact-sheet.png"}


def diagnostic(original, mode, obj, viewport):
    # Copying graph for linked diagnostics keeps its authored mask/ramp intact.
    if mode in ["shadow_only", "specular_only"] and original.use_nodes:
        material = original.copy()
        tree = material.node_tree
        output = next(n for n in tree.nodes if n.type == "OUTPUT_MATERIAL")
        source = tree.nodes.get(
            "Authored shadow ramp"
            if mode == "shadow_only"
            else "Controlled material response"
        )
        if mode == "specular_only" and not source:
            source = tree.nodes.get("Metal response")
        if source:
            if mode == "shadow_only":
                emission = tree.nodes.new("ShaderNodeEmission")
                tree.links.new(source.outputs[0], emission.inputs[0])
                source = emission
            else:
                # Isolate reflective response rather than showing the full
                # Principled diffuse/subsurface/sheeen shader as "specular".
                if source.name != "Metal response":
                    source.inputs["Base Color"].default_value = (0, 0, 0, 1)
                for name in ["Subsurface Weight", "Sheen Weight", "Coat Weight"]:
                    source.inputs[name].default_value = 0
            tree.links.new(source.outputs[0], output.inputs["Surface"])
            return material
        bpy.data.materials.remove(material)
    material = bpy.data.materials.new("Artist diagnostic " + mode)
    material.use_nodes = True
    tree = material.node_tree
    tree.nodes.clear()
    output = tree.nodes.new("ShaderNodeOutputMaterial")
    emission = tree.nodes.new("ShaderNodeEmission")
    tree.links.new(emission.outputs[0], output.inputs["Surface"])
    emission.inputs[0].default_value = (0.65, 0.65, 0.65, 1)

    def connect(socket):
        tree.links.new(socket, emission.inputs[0])

    if mode == "silhouette":
        emission.inputs[0].default_value = (0, 0, 0, 1)
    elif mode == "flat_albedo":
        emission.inputs[0].default_value = original.diffuse_color
        original_image = bpy.data.images.get(
            original.get("TANGER_original_texture", "")
        )
        if original_image:
            texture = tree.nodes.new("ShaderNodeTexImage")
            texture.image = original_image
            palette = tree.nodes.new("ShaderNodeMixRGB")
            palette.blend_type = "MULTIPLY"
            palette.inputs[0].default_value = 1
            palette.inputs[1].default_value = original.diffuse_color
            tree.links.new(texture.outputs["Color"], palette.inputs[2])
            connect(palette.outputs[0])
    elif mode == "material_ids":
        value = hashlib.sha256(original.name.encode()).digest()
        emission.inputs[0].default_value = tuple(
            0.15 + x / 255 * 0.75 for x in value[:3]
        ) + (1,)
    elif mode in ["normals", "matcap"]:
        geometry = tree.nodes.new("ShaderNodeNewGeometry")
        transform = tree.nodes.new("ShaderNodeVectorTransform")
        transform.vector_type = "NORMAL"
        transform.convert_from = "WORLD"
        transform.convert_to = "CAMERA"
        tree.links.new(geometry.outputs["Normal"], transform.inputs[0])
        if mode == "normals":
            vector = tree.nodes.new("ShaderNodeVectorMath")
            vector.operation = "MULTIPLY_ADD"
            vector.inputs[1].default_value = (0.5, 0.5, 0.5)
            vector.inputs[2].default_value = (0.5, 0.5, 0.5)
            tree.links.new(transform.outputs[0], vector.inputs[0])
            connect(vector.outputs[0])
        else:
            dot = tree.nodes.new("ShaderNodeVectorMath")
            dot.operation = "DOT_PRODUCT"
            dot.inputs[1].default_value = (-0.4, 0.5, -0.75)
            tree.links.new(transform.outputs[0], dot.inputs[0])
            ramp = tree.nodes.new("ShaderNodeValToRGB")
            ramp.color_ramp.elements[0].color = (0.06, 0.075, 0.095, 1)
            ramp.color_ramp.elements[1].color = (0.8, 0.82, 0.85, 1)
            tree.links.new(dot.outputs["Value"], ramp.inputs[0])
            connect(ramp.outputs[0])
    elif mode == "clay":
        shader = tree.nodes.new("ShaderNodeBsdfPrincipled")
        shader.inputs["Base Color"].default_value = (0.55, 0.58, 0.62, 1)
        shader.inputs["Roughness"].default_value = 0.8
        if viewport == "HAIR_SCULPT" and any(
            x in obj.name.lower() for x in ["hair", "lock", "fringe"]
        ):
            shader.inputs["Base Color"].default_value = (0.2, 0.45, 0.65, 1)
        if viewport == "CLOTHING_SCULPT" and any(
            x in obj.name.lower() for x in ["skin", "face", "palm"]
        ):
            shader.inputs["Base Color"].default_value = (0.15, 0.16, 0.18, 1)
        tree.links.new(shader.outputs[0], output.inputs["Surface"])
    elif mode == "wireframe":
        wire = tree.nodes.new("ShaderNodeWireframe")
        wire.use_pixel_size = True
        wire.inputs["Size"].default_value = 0.6
        mix = tree.nodes.new("ShaderNodeMixRGB")
        mix.inputs[1].default_value = (0.6, 0.6, 0.6, 1)
        mix.inputs[2].default_value = (0.015, 0.02, 0.03, 1)
        tree.links.new(wire.outputs[0], mix.inputs[0])
        connect(mix.outputs[0])
    elif mode == "depth":
        camera = tree.nodes.new("ShaderNodeCameraData")
        mapping = tree.nodes.new("ShaderNodeMapRange")
        current = bpy.context.scene.camera
        distance = (current.location - Vector((0, 0, 1.62))).length
        mapping.inputs["From Min"].default_value = distance - 0.25
        mapping.inputs["From Max"].default_value = distance + 0.25
        tree.links.new(camera.outputs["View Z Depth"], mapping.inputs[0])
        connect(mapping.outputs[0])
    elif mode == "ambient_occlusion":
        ao = tree.nodes.new("ShaderNodeAmbientOcclusion")
        ao.inputs["Distance"].default_value = 0.06
        connect(ao.outputs["Color"])
    elif mode in ["face_shadow_mask", "hair_highlight_mask"]:
        profile = json.loads(
            path(bpy.context.scene["TANGER_artist_profile"]).read_text()
        )
        filename = (
            profile["skin"]["faceShadowMask"]
            if mode == "face_shadow_mask"
            else profile["hair"]["highlightMask"]
        )
        relevant = (
            obj.name.startswith("Face —")
            if mode == "face_shadow_mask"
            else any("Hair" in m.name for m in obj.data.materials)
        )
        emission.inputs[0].default_value = (0, 0, 0, 1)
        if relevant and filename:
            tex = tree.nodes.new("ShaderNodeTexImage")
            tex.image = bpy.data.images.load(str(path(filename)), check_existing=True)
            connect(tex.outputs[0])
    elif mode in ["shadow_only", "specular_only"]:
        emission.inputs[0].default_value = (0, 0, 0, 1)
    return material
