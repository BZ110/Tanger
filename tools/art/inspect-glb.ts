import { validateBytes } from 'gltf-validator';
import type { CharacterManifest } from './character-schema';

import { decodeGlb } from './glb';

function imageEdge(
  bytes: Uint8Array,
  mime: string | undefined,
): number | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    mime === 'image/png' &&
    bytes.length >= 24 &&
    view.getUint32(0) === 0x89504e47
  )
    return Math.max(view.getUint32(16), view.getUint32(20));
  if (mime === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1]!;
      const length = view.getUint16(offset + 2);
      if ([0xc0, 0xc1, 0xc2].includes(marker) && offset + 9 < bytes.length)
        return Math.max(view.getUint16(offset + 5), view.getUint16(offset + 7));
      if (length < 2) break;
      offset += length + 2;
    }
  }
  return undefined;
}

export async function inspectGlb(
  bytes: Uint8Array,
  manifest: CharacterManifest,
) {
  const { document: doc, binary } = decodeGlb(bytes);
  const errors: string[] = [];
  const warnings: string[] = [];
  // A single self-contained file keeps browser imports and review reproducible.
  for (const item of [...(doc.buffers ?? []), ...(doc.images ?? [])])
    if (item.uri)
      errors.push(
        'External/data URI resources are unsupported: embed all resources in the GLB.',
      );
  for (const extension of doc.extensionsRequired ?? [])
    if (
      [
        'KHR_draco_mesh_compression',
        'EXT_meshopt_compression',
        'KHR_texture_basisu',
      ].includes(extension)
    )
      errors.push(
        `${extension} needs a runtime decoder; deliver an uncompressed review GLB first.`,
      );
  const validator = await validateBytes(bytes, {
    format: 'glb',
    uri: `${manifest.id}.glb`,
    writeTimestamp: false,
    maxIssues: 200,
    externalResourceFunction: async () => {
      throw new Error('External resources disabled');
    },
  });
  if (validator.issues.numErrors)
    errors.push(
      `Khronos validator: ${validator.issues.numErrors} errors (see report).`,
    );
  if (validator.issues.numWarnings)
    warnings.push(
      `Khronos validator: ${validator.issues.numWarnings} warnings (inspect report).`,
    );
  const primitives = (doc.meshes ?? []).flatMap((mesh) => mesh.primitives);
  let triangles = 0;
  let vertices = 0;
  for (const primitive of primitives) {
    const count =
      doc.accessors?.[primitive.indices ?? primitive.attributes.POSITION ?? -1]
        ?.count ?? 0;
    const vertexCount =
      doc.accessors?.[primitive.attributes.POSITION ?? -1]?.count ?? 0;
    vertices += vertexCount;
    if ((primitive.mode ?? 4) !== 4)
      errors.push('Character surfaces must use triangle primitives.');
    else triangles += count / 3;
    if (primitive.attributes.NORMAL === undefined)
      errors.push('A surface is missing exported normals.');
    if (primitive.attributes.TEXCOORD_0 === undefined)
      warnings.push(
        'A surface has no UV0; check whether it needs authored textures.',
      );
  }
  const materialNames = (doc.materials ?? []).map(
    (item) => item.name ?? '(unnamed)',
  );
  const skins = doc.skins ?? [];
  const jointNames = new Set(
    skins.flatMap((skin) =>
      skin.joints.map((index) => doc.nodes?.[index]?.name ?? '(unnamed)'),
    ),
  );
  const clips = (doc.animations ?? []).map((item) => item.name ?? '(unnamed)');
  const expressions = new Set(
    (doc.meshes ?? []).flatMap((mesh) =>
      (mesh.extras?.targetNames ?? []).filter((_name, index) =>
        mesh.primitives.some(
          (primitive) => (primitive.targets?.length ?? 0) > index,
        ),
      ),
    ),
  );
  const edges = (doc.images ?? []).map((image) => {
    const range = doc.bufferViews?.[image.bufferView ?? -1];
    if (!range) return undefined;
    return imageEdge(
      binary.subarray(
        range.byteOffset ?? 0,
        (range.byteOffset ?? 0) + range.byteLength,
      ),
      image.mimeType,
    );
  });
  if (edges.some((edge) => edge === undefined))
    errors.push(
      'A texture could not be inspected; use embedded PNG/JPEG for the baseline pipeline.',
    );
  const stats = {
    triangles,
    vertices,
    drawPrimitives: primitives.length,
    materials: materialNames.length,
    joints: jointNames.size,
    skins: skins.length,
    textureEdge: Math.max(
      0,
      ...edges.filter((edge): edge is number => edge !== undefined),
    ),
    fileMiB: bytes.byteLength / 1048576,
    clips,
    expressions: [...expressions],
    materialNames,
  };
  if (!primitives.length) errors.push('No renderable mesh surfaces.');
  for (const [key, limit] of Object.entries(manifest.deliveryBudgets)) {
    const actual = stats[key as keyof CharacterManifest['deliveryBudgets']];
    if (actual > limit)
      errors.push(
        `${key}: ${actual.toFixed(2)} exceeds this asset's editable delivery budget of ${limit}.`,
      );
  }
  for (const name of Object.values(manifest.materialRoles))
    if (!materialNames.includes(name))
      errors.push(`Missing authored material: ${name}`);
  if (manifest.stage === 'rigged' || manifest.stage === 'review') {
    if (
      !skins.length ||
      !(doc.nodes ?? []).some(
        (node) =>
          node.skin !== undefined &&
          (doc.meshes?.[node.mesh ?? -1]?.primitives ?? []).some(
            (primitive) =>
              primitive.attributes.JOINTS_0 !== undefined &&
              primitive.attributes.WEIGHTS_0 !== undefined,
          ),
      )
    )
      errors.push('Rigged delivery needs a skinned mesh with vertex weights.');
    if (new Set(clips).size !== clips.length)
      errors.push('Animation clip names must be unique.');
    if (
      !manifest.rig.requiredJoints.length ||
      !Object.keys(manifest.rig.clips).length ||
      !manifest.rig.expressions.length
    )
      errors.push(
        'Declare the required rig joints, animation bindings, and expressions.',
      );
    for (const name of manifest.rig.requiredJoints)
      if (!jointNames.has(name)) errors.push(`Missing skin joint: ${name}`);
    for (const name of Object.values(manifest.rig.clips))
      if (!clips.includes(name)) errors.push(`Missing animation clip: ${name}`);
    for (const name of manifest.rig.expressions)
      if (!expressions.has(name))
        errors.push(`Missing expression morph: ${name}`);
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings: [...new Set(warnings)],
    stats,
    validator,
  };
}
