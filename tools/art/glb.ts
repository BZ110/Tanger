interface Primitive {
  attributes: Record<string, number>;
  indices?: number;
  mode?: number;
  material?: number;
  targets?: Record<string, number>[];
}
interface GltfDocument {
  meshes?: {
    name?: string;
    primitives: Primitive[];
    extras?: { targetNames?: string[] };
  }[];
  accessors?: { count: number }[];
  nodes?: { name?: string; mesh?: number; skin?: number }[];
  skins?: { joints: number[] }[];
  animations?: {
    name?: string;
    channels: { target: { node?: number; path: string } }[];
  }[];
  materials?: { name?: string }[];
  buffers?: { uri?: string }[];
  images?: { uri?: string; bufferView?: number; mimeType?: string }[];
  bufferViews?: { byteOffset?: number; byteLength: number }[];
  extensionsRequired?: string[];
}

export function decodeGlb(bytes: Uint8Array): {
  document: GltfDocument;
  binary: Uint8Array;
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    bytes.byteLength < 20 ||
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== bytes.byteLength
  )
    throw new Error('Expected a complete glTF 2.0 binary (.glb)');
  let offset = 12;
  let document: GltfDocument | undefined;
  let binary = new Uint8Array();
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) throw new Error('Truncated GLB chunk');
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    offset += 8;
    if (length % 4 || offset + length > bytes.byteLength)
      throw new Error('Invalid GLB chunk length');
    const chunk = bytes.subarray(offset, offset + length);
    if (type === 0x4e4f534a)
      document = JSON.parse(new TextDecoder().decode(chunk)) as GltfDocument;
    if (type === 0x004e4942) binary = new Uint8Array(chunk);
    offset += length;
  }
  if (!document) throw new Error('GLB has no JSON document');
  return { document, binary };
}
