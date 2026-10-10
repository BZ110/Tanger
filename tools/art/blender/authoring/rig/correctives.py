import bpy


def corrective(obj, rig, bone_name, axis, peak, name, deltas):
    if not obj.data.shape_keys:
        obj.shape_key_add(name="Basis")
    key = obj.data.shape_keys.key_blocks.get(name) or obj.shape_key_add(name=name)
    for index, delta in deltas.items():
        point = key.data[int(index)]
        point.co.x += delta[0]
        point.co.y += delta[1]
        point.co.z += delta[2]
    driver = key.driver_add("value").driver
    variable = driver.variables.new()
    variable.name = "bend"
    variable.type = "TRANSFORMS"
    target = variable.targets[0]
    target.id = rig
    target.bone_target = bone_name
    target.transform_type = "ROT_" + axis
    target.transform_space = "LOCAL_SPACE"
    driver.expression = f"min(1.0, max(0.0, abs(bend) / {float(peak)}))"
    return key


POSES = {
    "arms-raised": {"upper_arm.L": (0, 0, -1.25), "upper_arm.R": (0, 0, 1.25)},
    "arms-forward": {"upper_arm.L": (-1.15, 0, 0), "upper_arm.R": (-1.15, 0, 0)},
    "elbow-bent": {"forearm.L": (-1.4, 0, 0), "forearm.R": (-1.4, 0, 0)},
    "wrist-rotated": {"hand.L": (0, 1.2, 0), "hand.R": (0, -1.2, 0)},
    "torso-twist": {"chest": (0, 0, 0.65)},
    "hip-flexion": {"thigh.L": (-1.1, 0, 0)},
    "knee-bend": {"shin.L": (1.4, 0, 0)},
    "crouch": {
        "thigh.L": (-0.8, 0, 0),
        "thigh.R": (-0.8, 0, 0),
        "shin.L": (1.35, 0, 0),
        "shin.R": (1.35, 0, 0),
        "spine": (0.2, 0, 0),
    },
}


def pose(rig, values):
    for bone in rig.pose.bones:
        bone.location = (0, 0, 0)
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (0, 0, 0)
        bone.scale = (1, 1, 1)
    for name, rotation in values.items():
        if name not in rig.pose.bones:
            raise ValueError("Missing deformation joint: " + name)
        rig.pose.bones[name].rotation_euler = rotation
    bpy.context.view_layer.update()
