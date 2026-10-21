import test from 'node:test';
import assert from 'node:assert/strict';
import { CHUNK_SIZE, getCell, isWater, bridgeHeight, groundHeight, canSailAt, hasWalkableGround, getChunkPlan, intersectsBuilding, seededRandom } from '../src/game/world-math.js';

test('chunk coordinates have continuous, canonical boundaries in both signs', () => {
  for (const x of [-1000000, -96, -32.001, -32, -.001, 0, 31.999, 32, 95.999, 96, 1000000]) {
    const cell = getCell(x, -x);
    assert.ok(cell.lx >= -32 && cell.lx < 32);
    assert.ok(cell.lz >= -32 && cell.lz < 32);
    assert.equal(cell.cx * CHUNK_SIZE + cell.lx, x);
    assert.ok(Math.abs(cell.cz * CHUNK_SIZE + cell.lz + x) < 1e-9);
  }
  assert.equal(getCell(-32, 0).cx, 0);
  assert.equal(getCell(32, 0).cx, 1);
  assert.equal(getCell(-32.001, 0).cx, -1);
});

test('canals connect across all four chunk edges without a seam', () => {
  for (let c = -8; c <= 8; c++) {
    for (const edge of [c * 64 - 32, c * 64 + 32]) {
      assert.equal(isWater(edge - .01, 0), true);
      assert.equal(isWater(edge + .01, 0), true);
      assert.equal(isWater(0, edge - .01), true);
      assert.equal(isWater(0, edge + .01), true);
      assert.equal(canSailAt(edge, 0, .95), true);
      assert.equal(canSailAt(0, edge, .95), true);
      assert.equal(hasWalkableGround(edge, 7.3, .31), true);
    }
  }
});

test('walkers follow all four bridge decks, while boats pass beneath', () => {
  for (const [x, z] of [[0, 18], [0, -18], [18, 0], [-18, 0]]) {
    assert.equal(bridgeHeight(x, z), 3);
    assert.equal(groundHeight(x, z), 3);
    assert.equal(hasWalkableGround(x, z, .31), true);
    assert.equal(canSailAt(x, z, .95), true);
  }
  assert.equal(groundHeight(0, 0), null);
  assert.equal(hasWalkableGround(0, 0), false);
  assert.equal(groundHeight(7.3, 12), .55);
  assert.equal(hasWalkableGround(5.6, 12, .31), false);
  assert.equal(canSailAt(5.3, 12, .95), false);
});

test('every bridge connects bank to bank with finite heights', () => {
  for (let x = -8; x <= 8; x += .125) {
    assert.ok(Number.isFinite(groundHeight(x, 18)));
    assert.equal(hasWalkableGround(x, 18, .3), true);
  }
});

test('same seed and location reproduce all landmarks; different seeds vary', () => {
  const a = getChunkPlan(-12, 87, '归舟');
  assert.deepEqual(a, getChunkPlan(-12, 87, '归舟'));
  assert.notDeepEqual(a, getChunkPlan(-12, 87, '听雨'));
  const r1 = seededRandom('hello', 5, -12), r2 = seededRandom('hello', 5, -12);
  assert.deepEqual(Array.from({ length: 20 }, r1), Array.from({ length: 20 }, r2));
});

test('collectibles stay reachable and identifiers remain distinct across the world', () => {
  const ids = new Set();
  for (let cx = -4; cx <= 4; cx++) for (let cz = -4; cz <= 4; cz++) {
    const plan = getChunkPlan(cx, cz, 'test');
    assert.ok(plan.collectibles.length >= 3 && plan.collectibles.length <= 4);
    for (const item of plan.collectibles) {
      assert.ok(!ids.has(item.id)); ids.add(item.id);
      assert.equal(hasWalkableGround(item.x, item.z, .31), true);
      assert.ok(item.type >= 0 && item.type < 6);
      assert.ok(!plan.buildings.some(b => intersectsBuilding(item.lx, item.lz, b, .31)));
    }
  }
  assert.deepEqual(getChunkPlan(0, 0, 'test').collectibles[0].x, 7.3);
  assert.deepEqual(getChunkPlan(0, 0, 'test').collectibles[0].z, 8);
});

test('generated houses keep connected crossing routes free', () => {
  for (let cx = -3; cx <= 3; cx++) for (let cz = -3; cz <= 3; cz++) {
    const { buildings } = getChunkPlan(cx, cz, 'routes');
    for (const lane of [-18, 18]) for (let t = -32; t <= 32; t += .5) {
      assert.equal(buildings.some(b => intersectsBuilding(t, lane, b, .31)), false);
      assert.equal(buildings.some(b => intersectsBuilding(lane, t, b, .31)), false);
    }
  }
});
