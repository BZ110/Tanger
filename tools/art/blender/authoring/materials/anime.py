import bpy
from ..context import path
from .face_shadow import initialize_mask, update_light


def role(name):
    return {
        "Skin": "skin",
        "SkinFace": "skin",
        "Hair": "hair",
        "Clothing": "clothing",
        "Trousers": "clothing",
        "Ribbing": "clothing",
        "Leather": "leather",
        "Sole": "leather",
        "Hardware": "metal",
    }.get(name)


def build(material, profile):
    name = material.name
    category = role(name) or material.get("TANGER_shader_role")
    original_texture = (
        next(
            (
                node.image
                for node in material.node_tree.nodes
                if node.type == "TEX_IMAGE"
                and node.image
                and not node.image.name.startswith("Face direction")
            ),
            None,
        )
        if material.use_nodes
        else None
    )
    if material.get("TANGER_original_texture"):
        original_texture = bpy.data.images.get(material["TANGER_original_texture"])
    elif original_texture:
        material["TANGER_original_texture"] = original_texture.name
    material.use_nodes = True
    tree = material.node_tree
    tree.nodes.clear()

    def node(kind, label=None):
        value = tree.nodes.new(kind)
        if label:
            value.name = value.label = label
        return value

    def link(source, target):
        tree.links.new(source, target)

    def math_node(kind, left, right):
        result = node("ShaderNodeMath")
        result.operation = kind
        if isinstance(left, (float, int)):
            result.inputs[0].default_value = left
        else:
            link(left, result.inputs[0])
        if isinstance(right, (float, int)):
            result.inputs[1].default_value = right
        else:
            link(right, result.inputs[1])
        return result.outputs[0]

    output = node("ShaderNodeOutputMaterial")
    emission = node("ShaderNodeEmission")
    if not category:
        color = material.diffuse_color[:3]
        if name == "Eyes":
            color = profile["eyes"]["scleraColor"]
        elif name == "Eye-light":
            color = profile["eyes"]["catchlightColor"]
        elif name == "Iris":
            color = profile["eyes"]["irisBase"]
        emission.inputs[0].default_value = (*color, 1)
        if original_texture:
            texture = node("ShaderNodeTexImage")
            texture.image = original_texture
            link(texture.outputs["Color"], emission.inputs[0])
        link(emission.outputs[0], output.inputs["Surface"])
        return
    settings = profile[category]
    material.diffuse_color = (*settings["baseColor"], 1)
    if category == "metal":
        shader = node("ShaderNodeBsdfPrincipled", "Metal response")
        shader.inputs["Base Color"].default_value = (*settings["baseColor"], 1)
        shader.inputs["Metallic"].default_value = settings["metallic"]
        shader.inputs["Roughness"].default_value = settings["roughness"]
        link(shader.outputs[0], output.inputs["Surface"])
        return
    geometry = node("ShaderNodeNewGeometry")
    combine = node("ShaderNodeCombineXYZ")
    for axis, initial in zip("XYZ", (-0.5, -0.7, 0.5)):
        value = node("ShaderNodeValue", "Key" + axis)
        value.outputs[0].default_value = initial
        link(value.outputs[0], combine.inputs[axis])
    dot = node("ShaderNodeVectorMath", "Graphic key response")
    dot.operation = "DOT_PRODUCT"
    link(geometry.outputs["Normal"], dot.inputs[0])
    link(combine.outputs[0], dot.inputs[1])
    lit = math_node(
        "MULTIPLY_ADD", dot.outputs["Value"], 0.5 * settings.get("normalInfluence", 1)
    )
    # MULTIPLY_ADD third input adds a centered 0.5 light interval.
    lit.node.inputs[2].default_value = 0.5
    softness = settings["shadowSoftness"]
    minimum, maximum = (
        settings["shadowThreshold"] - softness,
        settings["shadowThreshold"] + softness,
    )
    face_mask = (
        profile["skin"]["faceShadowMask"]
        if material.get("TANGER_face_material")
        else None
    )
    if category == "skin" and face_mask:
        texture = node("ShaderNodeTexImage", "Artist face SDF (R left / G right)")
        texture.image = bpy.data.images.load(str(path(face_mask)), check_existing=True)
        texture.image.colorspace_settings.name = "Non-Color"
        texture.image.pack()
        channels = node("ShaderNodeSeparateColor")
        link(texture.outputs["Color"], channels.inputs[0])
        choose = node("ShaderNodeMixRGB")
        choose.blend_type = "MIX"
        side = node("ShaderNodeValue", "FaceSide")
        link(side.outputs[0], choose.inputs[0])
        link(channels.outputs["Red"], choose.inputs[1])
        link(channels.outputs["Green"], choose.inputs[2])
        threshold = node("ShaderNodeValue", "FaceThreshold")
        threshold.outputs[0].default_value = 0.25
        diff = math_node("SUBTRACT", choose.outputs[0], threshold.outputs[0])
        lit = diff
        minimum, maximum = -profile["face"]["softness"], profile["face"]["softness"]
    smooth = node("ShaderNodeMapRange", "Shadow edge control")
    smooth.interpolation_type = "SMOOTHERSTEP"
    smooth.inputs["From Min"].default_value = minimum
    smooth.inputs["From Max"].default_value = maximum
    link(lit, smooth.inputs["Value"])
    ramp = node("ShaderNodeValToRGB", "Authored shadow ramp")
    ramp.color_ramp.elements.remove(ramp.color_ramp.elements[1])
    for index, (position, value) in enumerate(settings["shadowRamp"]):
        element = (
            ramp.color_ramp.elements[0]
            if index == 0
            else ramp.color_ramp.elements.new(position)
        )
        element.position = position
        element.color = (value, value, value, 1)
    link(smooth.outputs[0], ramp.inputs[0])
    mix = node("ShaderNodeMixRGB", "Base / shadow palette")
    mix.inputs[1].default_value = (*settings["shadowColor"], 1)
    mix.inputs[2].default_value = (*settings["baseColor"], 1)
    link(ramp.outputs[0], mix.inputs[0])
    color_output = mix.outputs[0]
    if original_texture:
        albedo = node("ShaderNodeTexImage", "Artist painted albedo")
        albedo.image = original_texture
        painted = node("ShaderNodeMixRGB")
        painted.blend_type = "MULTIPLY"
        painted.inputs[0].default_value = 1
        link(color_output, painted.inputs[1])
        link(albedo.outputs["Color"], painted.inputs[2])
        color_output = painted.outputs[0]
    if category == "hair":
        coords = node("ShaderNodeTexCoord")
        separate = node("ShaderNodeSeparateXYZ")
        link(coords.outputs["UV"], separate.inputs[0])
        distance = math_node(
            "ABSOLUTE", math_node("SUBTRACT", separate.outputs["Y"], 0.60), 0
        )
        highlight = node("ShaderNodeMapRange", "Directional hair highlight band")
        highlight.clamp = True
        highlight.inputs["From Min"].default_value = 0.035
        highlight.inputs["From Max"].default_value = 0.18
        highlight.inputs["To Min"].default_value = settings["specularStrength"]
        highlight.inputs["To Max"].default_value = 0
        link(distance, highlight.inputs[0])
        band = node("ShaderNodeMixRGB")
        band.inputs[2].default_value = (*settings["highlightColor"], 1)
        highlight_output = highlight.outputs[0]
        if settings["highlightMask"]:
            mask = node("ShaderNodeTexImage", "Artist hair highlight mask")
            mask.image = bpy.data.images.load(
                str(path(settings["highlightMask"])), check_existing=True
            )
            mask.image.colorspace_settings.name = "Non-Color"
            mask.image.pack()
            highlight_output = math_node(
                "MULTIPLY", mask.outputs[0], settings["specularStrength"]
            )
        link(highlight_output, band.inputs[0])
        link(color_output, band.inputs[1])
        color_output = band.outputs[0]
    layer = node("ShaderNodeLayerWeight")
    layer.inputs["Blend"].default_value = 0.3
    rim = math_node(
        "MULTIPLY",
        math_node("POWER", layer.outputs["Facing"], settings.get("rimWidth", 4)),
        settings["rimStrength"],
    )
    rim_mix = node("ShaderNodeMixRGB")
    rim_mix.blend_type = "ADD"
    link(rim, rim_mix.inputs[0])
    link(color_output, rim_mix.inputs[1])
    rim_mix.inputs[2].default_value = (0.35, 0.42, 0.54, 1)
    link(rim_mix.outputs[0], emission.inputs[0])
    # A small controlled physical response sits over the deliberately graphic
    # shader; it does not define the source look or the face's shadow contour.
    response = node("ShaderNodeBsdfPrincipled", "Controlled material response")
    response.inputs["Base Color"].default_value = (*settings["baseColor"], 1)
    response.inputs["Roughness"].default_value = settings["roughness"]
    if settings.get("roughnessMask"):
        rough = node("ShaderNodeTexImage", "Artist roughness mask")
        rough.image = bpy.data.images.load(
            str(path(settings["roughnessMask"])), check_existing=True
        )
        rough.image.colorspace_settings.name = "Non-Color"
        rough.image.pack()
        link(rough.outputs[0], response.inputs["Roughness"])
    response.inputs["Specular IOR Level"].default_value = settings["specularStrength"]
    if category == "skin":
        response.inputs["Subsurface Weight"].default_value = settings["subsurface"]
    if category == "clothing":
        response.inputs["Sheen Weight"].default_value = settings["fabricResponse"]
    if category == "hair":
        response.inputs["Anisotropic"].default_value = settings["anisotropy"]
        response.inputs["Anisotropic Rotation"].default_value = settings[
            "highlightDirection"
        ][0]
        tangent = node("ShaderNodeTangent")
        tangent.direction_type = "UV_MAP"
        tangent.uv_map = "AuthoredUV"
        link(tangent.outputs[0], response.inputs["Tangent"])
    strength = settings["specularStrength"] * 0.25
    if settings.get("specularMask"):
        spec = node("ShaderNodeTexImage")
        spec.image = bpy.data.images.load(
            str(path(settings["specularMask"])), check_existing=True
        )
        spec.image.colorspace_settings.name = "Non-Color"
        strength = math_node("MULTIPLY", spec.outputs[0], strength)
    blend = node("ShaderNodeMixShader")
    if isinstance(strength, (float, int)):
        blend.inputs[0].default_value = strength
    else:
        link(strength, blend.inputs[0])
    link(emission.outputs[0], blend.inputs[1])
    link(response.outputs[0], blend.inputs[2])
    link(blend.outputs[0], output.inputs["Surface"])
    material["TANGER_shader_role"] = category


def apply(profile, source_objects):
    if profile["skin"]["faceShadowMask"]:
        initialize_mask(profile["skin"]["faceShadowMask"])
    for obj in source_objects:
        if obj.type == "MESH" and obj.name.startswith("Face —"):
            skin = bpy.data.materials.get("SkinFace")
            if not skin:
                skin = bpy.data.materials["Skin"].copy()
                skin.name = "SkinFace"
                skin["TANGER_face_material"] = True
            obj.data.materials[0] = skin
    materials = {
        slot.material
        for obj in source_objects
        if obj.type == "MESH"
        for slot in obj.material_slots
        if slot.material
    }
    for material in materials:
        build(material, profile)
    update_light(profile, (-0.6, -0.8, 0.5))
