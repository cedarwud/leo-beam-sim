#!/usr/bin/env node

/**
 * Dependency-free GLB geometry lock validator.
 *
 * This deliberately compares decoded glTF semantics rather than GLB bytes:
 * texture re-encoding and buffer-view packing may change bytes while leaving
 * geometry unchanged.  It fails closed on unsupported sparse accessors and
 * reports primitive structure, POSITION/indices arrays, node graph/TRS and
 * world-space bounds.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const COMPONENT_SIZE = new Map([
  [5120, 1], // BYTE
  [5121, 1], // UNSIGNED_BYTE
  [5122, 2], // SHORT
  [5123, 2], // UNSIGNED_SHORT
  [5125, 4], // UNSIGNED_INT
  [5126, 4], // FLOAT
]);

const COMPONENT_NAMES = new Map([
  [5120, 'BYTE'],
  [5121, 'UNSIGNED_BYTE'],
  [5122, 'SHORT'],
  [5123, 'UNSIGNED_SHORT'],
  [5125, 'UNSIGNED_INT'],
  [5126, 'FLOAT'],
]);

const COMPONENTS = new Map([
  ['SCALAR', 1],
  ['VEC2', 2],
  ['VEC3', 3],
  ['VEC4', 4],
  ['MAT2', 4],
  ['MAT3', 9],
  ['MAT4', 16],
]);

function fail(message) {
  throw new Error(message);
}

function readGlb(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'glTF') {
    fail(`${file}: not a GLB v2 file`);
  }
  if (bytes.readUInt32LE(4) !== 2) fail(`${file}: unsupported GLB version`);

  const declaredLength = bytes.readUInt32LE(8);
  if (declaredLength !== bytes.length) {
    fail(`${file}: declared length ${declaredLength} != file length ${bytes.length}`);
  }

  let offset = 12;
  let json = null;
  let bin = Buffer.alloc(0);
  while (offset + 8 <= bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + chunkLength;
    if (end > bytes.length) fail(`${file}: chunk exceeds file length`);
    const chunk = bytes.subarray(start, end);
    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(chunk.toString('utf8').replace(/\u0000+$/g, '').trim());
    } else if (chunkType === 0x004e4942) {
      bin = chunk;
    }
    offset = end;
  }
  if (!json) fail(`${file}: missing JSON chunk`);
  return { file, bytes, json, bin };
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function accessorShape(accessor) {
  const componentCount = COMPONENTS.get(accessor.type);
  const componentSize = COMPONENT_SIZE.get(accessor.componentType);
  if (!componentCount || !componentSize) {
    fail(`unsupported accessor shape ${accessor.type}/${accessor.componentType}`);
  }
  return { componentCount, componentSize, elementSize: componentCount * componentSize };
}

function readScalar(buffer, offset, componentType) {
  switch (componentType) {
    case 5120: return buffer.readInt8(offset);
    case 5121: return buffer.readUInt8(offset);
    case 5122: return buffer.readInt16LE(offset);
    case 5123: return buffer.readUInt16LE(offset);
    case 5125: return buffer.readUInt32LE(offset);
    case 5126: return buffer.readFloatLE(offset);
    default: fail(`unsupported component type ${componentType}`);
  }
}

function normalizeComponent(value, componentType) {
  switch (componentType) {
    case 5120: return Math.max(value / 127, -1);
    case 5121: return value / 255;
    case 5122: return Math.max(value / 32767, -1);
    case 5123: return value / 65535;
    case 5125: return value / 4294967295;
    case 5126: return value;
    default: fail(`unsupported normalized component type ${componentType}`);
  }
}

function readAccessor(model, accessorIndex) {
  const accessor = model.json.accessors?.[accessorIndex];
  if (!accessor) fail(`${model.file}: missing accessor ${accessorIndex}`);
  if (accessor.sparse) {
    fail(`${model.file}: sparse accessor ${accessorIndex} is unsupported (fail closed)`);
  }
  const { componentCount, componentSize, elementSize } = accessorShape(accessor);
  const view = accessor.bufferView === undefined
    ? { byteOffset: 0, byteLength: 0 }
    : model.json.bufferViews?.[accessor.bufferView];
  if (!view) fail(`${model.file}: missing bufferView for accessor ${accessorIndex}`);
  const stride = view.byteStride ?? elementSize;
  if (stride < elementSize) fail(`${model.file}: invalid stride for accessor ${accessorIndex}`);
  const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const values = [];
  for (let row = 0; row < accessor.count; row += 1) {
    for (let column = 0; column < componentCount; column += 1) {
      const byteOffset = base + row * stride + column * componentSize;
      if (byteOffset + componentSize > model.bin.length) {
        fail(`${model.file}: accessor ${accessorIndex} exceeds BIN chunk`);
      }
      const raw = readScalar(model.bin, byteOffset, accessor.componentType);
      values.push(accessor.normalized ? normalizeComponent(raw, accessor.componentType) : raw);
    }
  }
  return {
    values,
    count: accessor.count,
    type: accessor.type,
    componentType: COMPONENT_NAMES.get(accessor.componentType),
    normalized: accessor.normalized === true,
  };
}

function imageBytes(model, image) {
  if (image.bufferView !== undefined) {
    const view = model.json.bufferViews?.[image.bufferView];
    if (!view) fail(`${model.file}: image references missing bufferView ${image.bufferView}`);
    return view.byteLength;
  }
  if (typeof image.uri === 'string' && image.uri.startsWith('data:')) {
    const encoded = image.uri.slice(image.uri.indexOf(',') + 1).replace(/=+$/g, '');
    return Math.floor((encoded.length * 3) / 4);
  }
  if (typeof image.uri === 'string') {
    const external = path.resolve(path.dirname(model.file), image.uri);
    return fs.statSync(external).size;
  }
  return 0;
}

function localTransform(node) {
  if (node.matrix) {
    if (node.matrix.length !== 16) fail('node matrix must have 16 elements');
    // glTF matrices are column-major; this representation is row-major.
    const m = node.matrix;
    return [
      [m[0], m[4], m[8], m[12]],
      [m[1], m[5], m[9], m[13]],
      [m[2], m[6], m[10], m[14]],
      [m[3], m[7], m[11], m[15]],
    ];
  }
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  return [
    [(1 - (yy + zz)) * sx, (xy - wz) * sy, (xz + wy) * sz, tx],
    [(xy + wz) * sx, (1 - (xx + zz)) * sy, (yz - wx) * sz, ty],
    [(xz - wy) * sx, (yz + wx) * sy, (1 - (xx + yy)) * sz, tz],
    [0, 0, 0, 1],
  ];
}

function multiply(left, right) {
  const out = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      for (let inner = 0; inner < 4; inner += 1) {
        out[row][column] += left[row][inner] * right[inner][column];
      }
    }
  }
  return out;
}

function transform(matrix, point) {
  return [0, 1, 2].map((row) => (
    matrix[row][0] * point[0]
    + matrix[row][1] * point[1]
    + matrix[row][2] * point[2]
    + matrix[row][3]
  ));
}

function primitiveSummaries(model) {
  return (model.json.meshes ?? []).flatMap((mesh, meshIndex) => (
    (mesh.primitives ?? []).map((primitive, primitiveIndex) => {
      const positionAccessor = primitive.attributes?.POSITION;
      const indexAccessor = primitive.indices;
      const positionCount = positionAccessor === undefined ? 0 : model.json.accessors[positionAccessor].count;
      const indexCount = indexAccessor === undefined ? positionCount : model.json.accessors[indexAccessor].count;
      const mode = primitive.mode ?? 4;
      const triangles = mode === 4
        ? Math.floor(indexCount / 3)
        : (mode === 5 || mode === 6 ? Math.max(0, indexCount - 2) : 0);
      return {
        meshIndex,
        primitiveIndex,
        mode,
        attributes: Object.keys(primitive.attributes ?? {}).sort(),
        indexed: indexAccessor !== undefined,
        positionCount,
        indexCount,
        triangles,
      };
    })
  ));
}

function nodeGraph(model) {
  return (model.json.nodes ?? []).map((node) => ({
    transform: localTransform(node),
    mesh: node.mesh ?? null,
    children: node.children ?? [],
  }));
}

function bounds(model) {
  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];
  const nodes = model.json.nodes ?? [];
  const meshes = model.json.meshes ?? [];
  const visited = new Set();
  const roots = model.json.scenes?.[model.json.scene ?? 0]?.nodes ?? nodes.map((_, index) => index);

  const includePoint = (point) => {
    for (let axis = 0; axis < 3; axis += 1) {
      low[axis] = Math.min(low[axis], point[axis]);
      high[axis] = Math.max(high[axis], point[axis]);
    }
  };

  const visit = (nodeIndex, parent) => {
    if (visited.has(nodeIndex)) return;
    visited.add(nodeIndex);
    const node = nodes[nodeIndex];
    if (!node) fail(`${model.file}: missing node ${nodeIndex}`);
    const world = multiply(parent, localTransform(node));
    if (node.mesh !== undefined) {
      const mesh = meshes[node.mesh];
      if (!mesh) fail(`${model.file}: missing mesh ${node.mesh}`);
      for (const primitive of mesh.primitives ?? []) {
        if (primitive.attributes?.POSITION === undefined) continue;
        const position = readAccessor(model, primitive.attributes.POSITION).values;
        for (let index = 0; index < position.length; index += 3) {
          includePoint(transform(world, position.slice(index, index + 3)));
        }
      }
    }
    for (const child of node.children ?? []) visit(child, world);
  };
  const identity = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
  for (const root of roots) visit(root, identity);
  if (!Number.isFinite(low[0])) fail(`${model.file}: no POSITION data for bounds`);
  return {
    min: low,
    max: high,
    size: high.map((value, axis) => value - low[axis]),
  };
}

function imageSummary(model) {
  return (model.json.images ?? []).map((image) => ({
    mimeType: image.mimeType ?? 'unknown',
    bytes: imageBytes(model, image),
  }));
}

function stats(model) {
  const primitives = primitiveSummaries(model);
  return {
    bytes: model.bytes.length,
    sha256: sha256(model.bytes),
    meshes: model.json.meshes?.length ?? 0,
    primitives: primitives.length,
    triangles: primitives.reduce((sum, primitive) => sum + primitive.triangles, 0),
    positions: primitives.reduce((sum, primitive) => sum + primitive.positionCount, 0),
    indices: primitives.reduce((sum, primitive) => sum + primitive.indexCount, 0),
    primitiveSummaries: primitives,
    images: imageSummary(model),
    extensionsUsed: [...(model.json.extensionsUsed ?? [])].sort(),
    extensionsRequired: [...(model.json.extensionsRequired ?? [])].sort(),
    bounds: bounds(model),
  };
}

function arraysEqual(left, right) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (!Object.is(left[index], right[index])) return false;
  }
  return true;
}

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function geometryComparison(candidate, reference) {
  const candidateStats = stats(candidate);
  const referenceStats = stats(reference);
  const checks = [];
  const check = (name, pass, detail) => checks.push({ name, pass, detail });

  check(
    'primitive structure',
    jsonEqual(candidateStats.primitiveSummaries, referenceStats.primitiveSummaries),
    `${candidateStats.primitives} primitive(s), ${candidateStats.triangles} triangles`,
  );

  const candidatePrimitives = primitiveSummaries(candidate);
  const referencePrimitives = primitiveSummaries(reference);
  let positionPass = candidatePrimitives.length === referencePrimitives.length;
  let indicesPass = positionPass;
  if (positionPass) {
    for (let meshIndex = 0; meshIndex < (candidate.json.meshes ?? []).length; meshIndex += 1) {
      const candidateMesh = candidate.json.meshes[meshIndex];
      const referenceMesh = reference.json.meshes[meshIndex];
      if (!referenceMesh || (candidateMesh.primitives ?? []).length !== (referenceMesh.primitives ?? []).length) {
        positionPass = false;
        indicesPass = false;
        break;
      }
      for (let primitiveIndex = 0; primitiveIndex < (candidateMesh.primitives ?? []).length; primitiveIndex += 1) {
        const left = candidateMesh.primitives[primitiveIndex];
        const right = referenceMesh.primitives[primitiveIndex];
        const leftPosition = left.attributes?.POSITION === undefined ? null : readAccessor(candidate, left.attributes.POSITION).values;
        const rightPosition = right.attributes?.POSITION === undefined ? null : readAccessor(reference, right.attributes.POSITION).values;
        const leftIndices = left.indices === undefined ? null : readAccessor(candidate, left.indices).values;
        const rightIndices = right.indices === undefined ? null : readAccessor(reference, right.indices).values;
        if ((leftPosition === null) !== (rightPosition === null) || (leftPosition && !arraysEqual(leftPosition, rightPosition))) positionPass = false;
        if ((leftIndices === null) !== (rightIndices === null) || (leftIndices && !arraysEqual(leftIndices, rightIndices))) indicesPass = false;
      }
    }
  }
  check('POSITION semantic arrays', positionPass, 'decoded POSITION arrays are exact');
  check('indices semantic arrays', indicesPass, 'decoded index arrays are exact');

  const candidateNodes = nodeGraph(candidate);
  const referenceNodes = nodeGraph(reference);
  check('node transforms and graph', jsonEqual(candidateNodes, referenceNodes), `${candidateNodes.length} node(s)`);
  check('world bounds', jsonEqual(candidateStats.bounds, referenceStats.bounds), JSON.stringify(candidateStats.bounds));

  return {
    pass: checks.every((item) => item.pass),
    checks,
    candidate: candidateStats,
    reference: referenceStats,
  };
}

function parseArguments() {
  const manifestFlag = process.argv.indexOf('--manifest');
  if (manifestFlag < 0 || !process.argv[manifestFlag + 1]) fail('usage: validate-glb-geometry.mjs --manifest <manifest.json> [--json]');
  return {
    manifest: path.resolve(process.argv[manifestFlag + 1]),
    json: process.argv.includes('--json'),
  };
}

function resolveReference(manifestFile, value) {
  return path.isAbsolute(value) ? value : path.resolve(path.dirname(manifestFile), value);
}

function run() {
  const args = parseArguments();
  const manifest = JSON.parse(fs.readFileSync(args.manifest, 'utf8'));
  const results = [];
  let allPass = true;

  for (const entry of manifest.entries ?? []) {
    const candidatePath = resolveReference(args.manifest, entry.candidate);
    const baselinePath = resolveReference(args.manifest, entry.baseline);
    const donorPath = entry.geometryDonor ? resolveReference(args.manifest, entry.geometryDonor) : null;
    const candidate = readGlb(candidatePath);
    const baseline = readGlb(baselinePath);
    const donor = donorPath ? readGlb(donorPath) : null;
    const comparisons = [{ label: 'candidate vs baseline', result: geometryComparison(candidate, baseline) }];
    if (donor && donorPath !== baselinePath) {
      comparisons.push({ label: 'candidate vs geometry donor', result: geometryComparison(candidate, donor) });
    }
    const pass = comparisons.every((comparison) => comparison.result.pass);
    allPass = allPass && pass;
    results.push({
      id: entry.id,
      policy: entry.policy,
      candidate: candidatePath,
      baseline: baselinePath,
      geometryDonor: donorPath,
      pass,
      comparisons,
    });
  }

  const report = {
    validator: 'glb-geometry-locked/v1',
    manifest: args.manifest,
    allPass,
    results,
  };
  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    console.log(`GLB geometry lock: ${allPass ? 'PASS' : 'FAIL'}`);
    for (const item of results) {
      console.log(`\n[${item.pass ? 'PASS' : 'FAIL'}] ${item.id} (${item.policy})`);
      console.log(`  candidate: ${item.candidate}`);
      for (const comparison of item.comparisons) {
        console.log(`  ${comparison.label}: ${comparison.result.pass ? 'PASS' : 'FAIL'}`);
        const candidateStats = comparison.result.candidate;
        console.log(`    size=${candidateStats.bytes} bytes sha256=${candidateStats.sha256}`);
        console.log(`    meshes=${candidateStats.meshes} primitives=${candidateStats.primitives} triangles=${candidateStats.triangles} positions=${candidateStats.positions} indices=${candidateStats.indices}`);
        console.log(`    images=${JSON.stringify(candidateStats.images)} extensionsUsed=${JSON.stringify(candidateStats.extensionsUsed)} extensionsRequired=${JSON.stringify(candidateStats.extensionsRequired)}`);
        console.log(`    bounds=${JSON.stringify(candidateStats.bounds)}`);
        for (const check of comparison.result.checks) console.log(`    ${check.pass ? 'PASS' : 'FAIL'} ${check.name}: ${check.detail}`);
      }
    }
  }
  if (!allPass) process.exitCode = 1;
}

try {
  run();
} catch (error) {
  console.error(`GLB geometry lock: ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
