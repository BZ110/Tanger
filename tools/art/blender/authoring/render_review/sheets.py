import math
import bpy
import numpy as np


def sheet(paths, output, columns=4, tile=480):
    rows = math.ceil(len(paths) / columns)
    canvas = np.zeros((rows * tile, columns * tile, 4), dtype=np.float32)
    canvas[:, :, :] = (0.03, 0.04, 0.06, 1)
    for index, filename in enumerate(paths):
        image = bpy.data.images.load(str(filename), check_existing=False)
        image.scale(tile, tile)
        pixels = np.empty(tile * tile * 4, dtype=np.float32)
        image.pixels.foreach_get(pixels)
        row, column = divmod(index, columns)
        # Blender pixels run bottom-up; ordered rows remain top-down in the sheet.
        y = (rows - row - 1) * tile
        canvas[y : y + tile, column * tile : (column + 1) * tile] = pixels.reshape(
            tile, tile, 4
        )
        bpy.data.images.remove(image)
    result = bpy.data.images.new(
        "Review contact sheet", width=columns * tile, height=rows * tile, alpha=True
    )
    result.pixels.foreach_set(canvas.ravel())
    result.filepath_raw = str(output)
    result.file_format = "PNG"
    result.save()
    bpy.data.images.remove(result)
