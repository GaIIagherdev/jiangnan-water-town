/** Deterministic, rendering-independent topology for an unbounded canal country. */
export const CHUNK_SIZE = 64;
export const CANAL_HALF_WIDTH = 5.5;
export const LAND_HEIGHT = .55;
export const BRIDGE_SPAN = 6.6;
export const BRIDGE_HALF_WIDTH = 1.42;
export const BIOMES = ['水乡', '竹径', '荷塘', '烟岚'];
export const COLLECTIBLE_NAMES = ['荷香', '竹影', '古瓷', '流萤', '旧笺', '水纹'];
const PREFIXES = ['清溪', '听雨', '柳汀', '枕河', '青岚', '归云', '白鹭', '桂影', '烟浦', '眠月', '松风', '莲塘', '望舒', '长桥', '苔痕', '栖霞'];
const SUFFIXES = ['里', '渡', '坊', '湾', '埠', '洲', '巷', '溪'];

export function hashSeed(value) {
  const text = String(value ?? 'jiangnan');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seed, cx = 0, cz = 0) {
  let value = hashSeed(`${seed}:${cx}:${cz}`);
  return () => {
    value += 0x6d2b79f5;
    let n = Math.imul(value ^ value >>> 15, 1 | value);
    n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

export function getCell(x, z) {
  const cx = Math.floor((x + CHUNK_SIZE / 2) / CHUNK_SIZE);
  const cz = Math.floor((z + CHUNK_SIZE / 2) / CHUNK_SIZE);
  return { cx, cz, lx: x - cx * CHUNK_SIZE, lz: z - cz * CHUNK_SIZE };
}

export function isWater(x, z) {
  const { lx, lz } = getCell(x, z);
  return Math.abs(lx) < CANAL_HALF_WIDTH || Math.abs(lz) < CANAL_HALF_WIDTH;
}

export function bridgeHeight(x, z) {
  const { lx, lz } = getCell(x, z);
  let axis = null;
  if (Math.abs(lx) <= BRIDGE_SPAN && Math.abs(Math.abs(lz) - 18) <= BRIDGE_HALF_WIDTH) axis = lx;
  else if (Math.abs(lz) <= BRIDGE_SPAN && Math.abs(Math.abs(lx) - 18) <= BRIDGE_HALF_WIDTH) axis = lz;
  return axis === null ? null : .6 + 2.4 * Math.cos(axis / BRIDGE_SPAN * Math.PI / 2);
}

export function groundHeight(x, z) {
  const bridge = bridgeHeight(x, z);
  return bridge ?? (isWater(x, z) ? null : LAND_HEIGHT);
}

/** Bridge decks do not block the navigable water beneath them. */
export function canSailAt(x, z, radius = .9) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  for (const [dx, dz] of [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius], [radius * .7, radius * .7], [-radius * .7, radius * .7], [radius * .7, -radius * .7], [-radius * .7, -radius * .7]]) {
    if (!isWater(x + dx, z + dz)) return false;
  }
  return true;
}

export function intersectsBuilding(x, z, building, radius = .3) {
  const dx = x - building.x, dz = z - building.z;
  const cosine = Math.cos(building.rotation), sine = Math.sin(building.rotation);
  const localX = cosine * dx - sine * dz;
  const localZ = sine * dx + cosine * dz;
  return Math.abs(localX) < building.footprint.halfX + radius && Math.abs(localZ) < building.footprint.halfZ + radius;
}

export function hasWalkableGround(x, z, radius = .3) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  for (const [dx, dz] of [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]]) {
    if (groundHeight(x + dx, z + dz) === null) return false;
  }
  return true;
}

export function getChunkPlan(cx, cz, seed = 'jiangnan') {
  const random = seededRandom(seed, cx, cz);
  const index = Math.floor(random() * BIOMES.length);
  const biome = BIOMES[index];
  const name = PREFIXES[Math.floor(random() * PREFIXES.length)] + SUFFIXES[Math.floor(random() * SUFFIXES.length)];
  const buildings = [], trees = [], props = [];
  const density = [.83, .42, .48, .62][index];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (const [a, b] of [[12, 12], [27, 12], [12, 27], [27, 27]]) {
      // The starting quay gets a familiar illuminated home on either bank.
      if (random() > density && !(cx === 0 && cz === 0 && a === 12 && b === 12)) continue;
      const x = sx * (a + (random() - .5) * .85);
      const z = sz * (b + (random() - .5) * .85);
      const scale = .87 + random() * .16;
      const facingX = a <= b ? random() > .3 : random() > .8;
      const rotation = facingX ? (sx > 0 ? -Math.PI / 2 : Math.PI / 2) : (sz > 0 ? Math.PI : 0);
      buildings.push({ kind: Math.floor(random() * 6), x, z, rotation, scale, footprint: { halfX: 2.78 * scale, halfZ: 3.12 * scale } });
    }
    // Willows mark the embankments; bamboo groves and gardens fill quiet corners.
    trees.push({ kind: index === 1 && random() > .25 ? 'bamboo' : 'willow', x: sx * 7.3, z: sz * (26.1 + random() * 2.4), rotation: random() * Math.PI * 2, scale: .66 + random() * .27 });
    if (index === 1 || random() > .58) trees.push({ kind: index === 1 ? 'bamboo' : 'willow', x: sx * (23 + random() * 1.5), z: sz * 23, rotation: random() * Math.PI * 2, scale: .65 + random() * .22 });
    props.push({ kind: 'rock', x: sx * 6.5, z: sz * 10.4, rotation: random() * Math.PI * 2, scale: .6 + random() * .8 });
    if (index === 2) for (let i = 0; i < 4; i++) props.push({ kind: 'lotus', x: sx * (3.1 + random() * 1.9), z: sz * (22 + random() * 7.5), rotation: random() * Math.PI * 2, scale: .75 + random() * .6 });
  }
  const slots = [[7.3, 8], [-7.3, 22], [23, 7.3], [-23, -7.3], [0, -18], [18, 0], [7.3, -25], [-25, 7.3]];
  const count = 3 + (random() > .48 ? 1 : 0);
  const first = cx === 0 && cz === 0 ? 0 : Math.floor(random() * slots.length);
  const collectibles = [];
  for (let i = 0; i < count; i++) {
    const slot = slots[(first + i * 3) % slots.length];
    const x = cx * CHUNK_SIZE + slot[0], z = cz * CHUNK_SIZE + slot[1];
    const type = Math.floor(random() * COLLECTIBLE_NAMES.length);
    collectibles.push({ id: `${seed}:${cx}:${cz}:${i}`, type, name: COLLECTIBLE_NAMES[type], x, z, y: groundHeight(x, z) + .9, lx: slot[0], lz: slot[1] });
  }
  return { cx, cz, seed, name, biome, biomeIndex: index, buildings, trees, props, collectibles };
}
