import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createGameAssets } from './assets.js';
import { CHUNK_SIZE, CANAL_HALF_WIDTH, LAND_HEIGHT, getCell, getChunkPlan, groundHeight, canSailAt, hasWalkableGround, intersectsBuilding, seededRandom } from './world-math.js';

/** Stream a small moving window of a deterministic, unbounded world. */
export function createWorld({ scene, seed = 'jiangnan', collected = new Set(), mobile = false, assets: suppliedAssets } = {}) {
  const assets = suppliedAssets || createGameAssets();
  const ownsAssets = !suppliedAssets;
  const radius = mobile ? 1 : 2;
  const origin = { x: 0, z: 0 };
  const root = new THREE.Group(); root.name = 'Endless Jiangnan'; scene.add(root);
  const chunks = new Map(), plans = new Map();
  const cellKey = (cx, cz) => `${cx},${cz}`;
  let queue = [], currentCX = NaN, currentCZ = NaN, disposed = false;
  let totalGenerated = 0, previousTime = 0, playerPosition = { x: 7.3, z: 12 };
  const tempMatrix = new THREE.Matrix4(), tempTransform = new THREE.Object3D();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1); plane.rotateX(-Math.PI / 2);
  const greenColors = [0x576551, 0x4b5e48, 0x607253, 0x5b6962];
  const groundMaterials = greenColors.map(color => new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  const stone = assets.materials.stone || new THREE.MeshStandardMaterial({ color: 0x788777, roughness: .94 });
  const quay = assets.materials.quay || stone;
  const gardenMaterial = new THREE.MeshStandardMaterial({ color: 0x6a7d51, roughness: 1, side: THREE.DoubleSide });
  const grassGeometry = new THREE.BufferGeometry();
  grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-.045, 0, 0, .045, 0, 0, .025, .42, .035, -.012, .7, .08, -.018, .32, .03], 3));
  grassGeometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, .6, .5, 1, 0, .5], 2));
  grassGeometry.setIndex([0, 1, 4, 1, 2, 4, 2, 3, 4]); grassGeometry.computeVertexNormals();
  const bridgePlacements = [{ x: 0, z: -18, rotation: 0 }, { x: 0, z: 18, rotation: 0 }, { x: -18, z: 0, rotation: Math.PI / 2 }, { x: 18, z: 0, rotation: Math.PI / 2 }];

  function planAt(cx, cz) {
    const key = cellKey(cx, cz);
    if (!plans.has(key)) plans.set(key, getChunkPlan(cx, cz, seed));
    const plan = plans.get(key);
    // Analytic queries must remain bounded even after years of travel.
    if (plans.size > 100) {
      for (const [oldKey] of plans) {
        if (!chunks.has(oldKey) && oldKey !== key) { plans.delete(oldKey); break; }
      }
    }
    return plan;
  }

  function bakeGeometry(geometry, material, matrix, batches) {
    if (!geometry || !material) return;
    const copy = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    copy.applyMatrix4(matrix);
    for (const name of Object.keys(copy.attributes)) if (!['position', 'normal', 'uv'].includes(name)) copy.deleteAttribute(name);
    if (!copy.attributes.normal) copy.computeVertexNormals();
    if (!copy.attributes.uv) copy.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(copy.attributes.position.count * 2), 2));
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material).push(copy);
  }

  function addBox(x, y, z, sx, sy, sz, material, batches, ry = 0) {
    tempTransform.position.set(x, y, z); tempTransform.rotation.set(0, ry, 0); tempTransform.scale.set(sx, sy, sz); tempTransform.updateMatrix();
    bakeGeometry(cube, material, tempTransform.matrix, batches);
  }

  function addTemplate(template, x, y, z, rotation, scale, batches) {
    if (!template) return;
    tempTransform.position.set(x, y, z); tempTransform.rotation.set(0, rotation || 0, 0); tempTransform.scale.setScalar(scale || 1); tempTransform.updateMatrix();
    const placement = tempTransform.matrix.clone();
    template.updateMatrixWorld(true);
    template.traverse(object => {
      if (!object.isMesh || Array.isArray(object.material)) return;
      tempMatrix.multiplyMatrices(placement, object.matrixWorld);
      bakeGeometry(object.geometry, object.material, tempMatrix, batches);
    });
  }

  function makeChunk(cx, cz) {
    const plan = planAt(cx, cz), random = seededRandom(`${seed}:details`, cx, cz);
    const group = new THREE.Group(); group.name = `${plan.name} (${cx},${cz})`;
    const batches = new Map(), markers = [];
    // Four islands meet their neighbours exactly at the ±32 metre boundaries.
    const islandSize = CHUNK_SIZE / 2 - CANAL_HALF_WIDTH;
    const center = CANAL_HALF_WIDTH + islandSize / 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      addBox(sx * center, LAND_HEIGHT - .8, sz * center, islandSize, 1.6, islandSize, groundMaterials[plan.biomeIndex], batches);
      // Continuous stone quays on both edges, with unobtrusive joints.
      addBox(sx * 6.7, .53, sz * center, 2.4, .04, islandSize, quay, batches);
      addBox(sx * center, .53, sz * 6.7, islandSize, .04, 2.4, quay, batches);
      addBox(sx * 5.58, .12, sz * center, .24, .85, islandSize, stone, batches);
      addBox(sx * center, .12, sz * 5.58, islandSize, .85, .24, stone, batches);
      // Pale cross paths connect all bridges and the next village beyond the edge.
      addBox(sx * 18, .551, sz * center, 2.2, .022, islandSize, quay, batches);
      addBox(sx * center, .551, sz * 18, islandSize, .022, 2.2, quay, batches);
      for (let step = 0; step < 18; step++) {
        const along = 5.8 + step * 1.48;
        addBox(sx * 6.7, .556, sz * along, 2.12, .016, 1.40, quay, batches);
        addBox(sx * along, .556, sz * 6.7, 1.40, .016, 2.12, quay, batches);
      }
      // Selectively clustered rushes leave the walking strip open.
      for (let i = 0; i < (mobile ? 14 : 28); i++) {
        const along = 9 + random() * 21;
        tempTransform.position.set(sx * (5.73 + random() * .25), .59, sz * along);
        tempTransform.rotation.set(0, random() * Math.PI * 2, (random() - .5) * .3);
        tempTransform.scale.setScalar(.4 + random() * .55); tempTransform.updateMatrix();
        bakeGeometry(grassGeometry, gardenMaterial, tempTransform.matrix, batches);
      }
    }
    for (const home of plan.buildings) addTemplate(assets.house(home.kind), home.x, LAND_HEIGHT, home.z, home.rotation, home.scale, batches);
    for (const bridge of bridgePlacements) addTemplate(assets.bridge(), bridge.x, 0, bridge.z, bridge.rotation, 1, batches);
    for (const tree of plan.trees) addTemplate(tree.kind === 'bamboo' ? assets.bamboo() : assets.willow(), tree.x, LAND_HEIGHT, tree.z, tree.rotation, tree.scale, batches);
    for (const prop of plan.props) addTemplate(assets.prop(prop.kind), prop.x, prop.kind === 'lotus' ? .035 : LAND_HEIGHT, prop.z, prop.rotation, prop.scale, batches);
    for (const [material, geometries] of batches) {
      const geometry = mergeGeometries(geometries, false);
      geometries.forEach(g => g.dispose());
      if (!geometry) continue;
      const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData.chunkOwned = true; group.add(mesh);
    }
    for (const item of plan.collectibles) {
      if (collected.has(item.id)) continue;
      const marker = assets.collectible(item.type);
      marker.position.set(item.lx, item.y, item.lz);
      marker.userData.collectibleId = item.id; group.add(marker);
      markers.push({ group: marker, item, phase: random() * Math.PI * 2 });
    }
    group.position.set(cx * CHUNK_SIZE - origin.x, 0, cz * CHUNK_SIZE - origin.z);
    root.add(group); totalGenerated++;
    return { group, plan, markers };
  }

  function removeChunk(key) {
    const chunk = chunks.get(key); if (!chunk) return;
    root.remove(chunk.group);
    chunk.group.traverse(object => { if (object.isMesh && object.userData.chunkOwned) object.geometry.dispose(); });
    chunks.delete(key);
  }

  function refreshWindow(cx, cz) {
    currentCX = cx; currentCZ = cz;
    origin.x = cx * CHUNK_SIZE; origin.z = cz * CHUNK_SIZE;
    const requested = [];
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) requested.push({ cx: cx + dx, cz: cz + dz, distance: dx * dx + dz * dz });
    requested.sort((a, b) => a.distance - b.distance);
    const needed = new Set(requested.map(c => cellKey(c.cx, c.cz)));
    for (const [key] of chunks) if (!needed.has(key)) removeChunk(key);
    for (const chunk of chunks.values()) chunk.group.position.set(chunk.plan.cx * CHUNK_SIZE - origin.x, 0, chunk.plan.cz * CHUNK_SIZE - origin.z);
    queue = requested.filter(c => !chunks.has(cellKey(c.cx, c.cz)));
  }

  function update(playerX, playerZ, time = 0) {
    if (disposed || !Number.isFinite(playerX) || !Number.isFinite(playerZ)) return;
    playerPosition.x = playerX; playerPosition.z = playerZ;
    const { cx, cz } = getCell(playerX, playerZ);
    if (cx !== currentCX || cz !== currentCZ) refreshWindow(cx, cz);
    // One new chunk per frame amortizes generation and prevents a crossing hitch.
    if (queue.length) {
      const next = queue.shift(), key = cellKey(next.cx, next.cz);
      if (!chunks.has(key)) chunks.set(key, makeChunk(next.cx, next.cz));
    }
    previousTime = time;
    for (const chunk of chunks.values()) for (const marker of chunk.markers) {
      marker.group.visible = !collected.has(marker.item.id) && Math.hypot(marker.item.x - playerX, marker.item.z - playerZ) < 65;
      marker.group.position.y = marker.item.y + Math.sin(time * 1.5 + marker.phase) * .12;
      marker.group.rotation.y = time * .45 + marker.phase;
    }
  }

  function getNearbyCollectible(x, z, distance = 2.1) {
    const { cx, cz } = getCell(x, z);
    let nearest = null, nearestDistance = distance;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      for (const item of planAt(cx + dx, cz + dz).collectibles) {
        if (collected.has(item.id)) continue;
        const d = Math.hypot(item.x - x, item.z - z);
        if (d < nearestDistance) { nearest = item; nearestDistance = d; }
      }
    }
    return nearest ? { ...nearest, distance: nearestDistance } : null;
  }

  function collect(id) {
    if (collected.has(id)) return false;
    collected.add(id);
    for (const chunk of chunks.values()) for (const marker of chunk.markers) if (marker.item.id === id) marker.group.visible = false;
    return true;
  }

  function canWalk(x, z, collisionRadius = .3) {
    if (!hasWalkableGround(x, z, collisionRadius)) return false;
    const { cx, cz } = getCell(x, z);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const plan = planAt(cx + dx, cz + dz);
      const lx = x - plan.cx * CHUNK_SIZE, lz = z - plan.cz * CHUNK_SIZE;
      for (const home of plan.buildings) if (intersectsBuilding(lx, lz, home, collisionRadius)) return false;
      for (const tree of plan.trees) if (Math.hypot(lx - tree.x, lz - tree.z) < .24 * tree.scale + collisionRadius) return false;
    }
    return true;
  }

  function getCellInfo(x, z) {
    const { cx, cz } = getCell(x, z), plan = planAt(cx, cz);
    return { cx, cz, name: plan.name, biome: plan.biome, biomeIndex: plan.biomeIndex };
  }

  function stats() {
    let triangles = 0, drawMeshes = 0;
    for (const chunk of chunks.values()) chunk.group.traverse(object => {
      if (!object.isMesh) return;
      drawMeshes++;
      triangles += (object.geometry.index?.count || object.geometry.attributes.position?.count || 0) / 3;
    });
    return { activeChunks: chunks.size, loaded: chunks.size, queuedChunks: queue.length, cachedPlans: plans.size, totalGenerated, triangles, drawMeshes, originX: origin.x, originZ: origin.z, radius, time: previousTime };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const [key] of chunks) removeChunk(key);
    root.removeFromParent(); plans.clear(); queue = [];
    cube.dispose(); plane.dispose(); grassGeometry.dispose();
    groundMaterials.forEach(m => m.dispose()); gardenMaterial.dispose();
    if (ownsAssets) assets.dispose?.();
  }

  update(7.3, 12, 0);
  return { origin, root, assets, update, getNearbyCollectible, collect, getCellInfo, getHeight: groundHeight, canWalk, canSail: canSailAt, stats, dispose, ready: true, get seed() { return seed; } };
}
