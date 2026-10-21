import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import * as THREE from '../src/vendor/three.module.js';
import * as topology from '../src/game/world-math.js';

const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/game/player.js', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
  alias: { three: fileURLToPath(new URL('../src/vendor/three.module.js', import.meta.url)) },
});
const { createPlayer } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

function setup(t, options = {}) {
  globalThis.Element = class {};
  globalThis.window = new EventTarget();
  globalThis.document = new EventTarget();
  document.hidden = false;
  const canvas = new EventTarget();
  canvas.setPointerCapture = canvas.releasePointerCapture = () => {};
  const plans = new Map();
  const world = {
    origin: { x: 0, z: 0 },
    getHeight: topology.groundHeight,
    canSail: topology.canSailAt,
    canWalk(x, z, radius) {
      if (!topology.hasWalkableGround(x, z, radius)) return false;
      const { cx, cz, lx, lz } = topology.getCell(x, z);
      const key = `${cx}:${cz}`;
      if (!plans.has(key)) plans.set(key, topology.getChunkPlan(cx, cz, 'jiangnan'));
      return !plans.get(key).buildings.some(building => topology.intersectsBuilding(lx, lz, building, radius));
    },
  };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const player = createPlayer({
    scene, camera, canvas, world,
    assets: {
      traveler: () => ({ group: new THREE.Group(), legs: [new THREE.Group(), new THREE.Group()], arms: [new THREE.Group(), new THREE.Group()] }),
      boat: () => new THREE.Group(),
    },
    ...options,
  });
  let time = 0;
  player.setActive(true);
  t.after(() => player.dispose());
  return {
    player, world, scene, camera,
    step(seconds, inspect) {
      for (let i = 0; i < Math.round(seconds * 60); i++) {
        const cell = topology.getCell(player.position.x, player.position.z);
        world.origin.x = cell.cx * topology.CHUNK_SIZE;
        world.origin.z = cell.cz * topology.CHUNK_SIZE;
        player.update(1 / 60, time += 1 / 60, { origin: world.origin });
        inspect?.();
      }
    },
  };
}

function key(type, code, extra = {}) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { code, ...extra });
  window.dispatchEvent(event);
  return event;
}

test('walking stops at riverbanks and solid houses without entering either', t => {
  const { player, world, step } = setup(t);
  player.setInput({ x: -1 });
  step(4);
  assert.ok(player.position.x >= 5.79);
  assert.equal(player.mode, 'walk');
  assert.equal(player.stats().blocked, true);
  assert.equal(world.canWalk(player.position.x, player.position.z, .3), true);

  assert.equal(player.setState({ x: 7.3, z: 12 }), true);
  player.setInput({ x: 1 });
  step(3);
  assert.ok(player.position.x < 10);
  assert.equal(player.stats().blocked, true);
  assert.equal(world.canWalk(player.position.x, player.position.z, .3), true);
});

test('walking follows the full arch and reaches the opposite riverbank', t => {
  const { player, step } = setup(t);
  assert.equal(player.setState({ x: 7.3, z: -18, yaw: Math.PI, cameraYaw: Math.PI }), true);
  player.setInput({ x: -1 });
  let peakHeight = 0;
  step(4.5, () => { peakHeight = Math.max(peakHeight, player.position.y); });
  assert.ok(peakHeight > 2.95);
  assert.ok(player.position.x < -6.6);
  assert.equal(player.position.y, topology.LAND_HEIGHT);
});

test('boarding connects to canals and sailing crosses multiple streamed chunks', t => {
  const { player, world, step } = setup(t);
  assert.equal(player.toggleMode().ok, true);
  assert.equal(player.mode, 'boat');
  player.setInput({ y: 1, sprint: true });
  step(20);
  assert.ok(player.position.z < -250);
  assert.ok(world.origin.z <= -256);
  assert.equal(topology.isWater(player.position.x, player.position.z), true);
  assert.equal(player.boat.visible, true);
  assert.ok(player.stats().travelled > 260);
});

test('boarding and disembarking require a safe bank and reject the bridge crown', t => {
  const { player, world } = setup(t);
  assert.equal(player.setState({ x: 0, z: -18 }), true);
  assert.equal(player.toggleMode().ok, false);
  assert.equal(player.mode, 'walk');
  assert.equal(player.setState({ x: 0, z: 12, mode: 'boat' }), true);
  assert.equal(player.toggleMode().ok, false);
  assert.equal(player.mode, 'boat');
  assert.equal(player.setState({ x: 3.65, z: 12, mode: 'boat' }), true);
  assert.equal(player.toggleMode().ok, true);
  assert.equal(player.mode, 'walk');
  assert.equal(world.canWalk(player.position.x, player.position.z, .34), true);
});

test('boat and rider stop below a low arch but can steer back into clearance', t => {
  const { player, step } = setup(t);
  assert.equal(player.setState({ x: 4.5, z: 12, mode: 'boat', yaw: Math.PI, cameraYaw: Math.PI }), true);
  player.setInput({ y: 1 });
  step(10);
  assert.ok(player.position.z > -15.2);
  assert.equal(player.stats().blocked, true);
  const previousX = player.position.x;
  player.setInput({ x: -1 });
  step(.4);
  assert.ok(player.position.x < previousX - .1);
});

test('keyboard and touch controls move the traveler and interaction fires once per press', t => {
  let interactions = 0;
  const { player, step } = setup(t, { onInteract: () => interactions++ });
  assert.equal(key('keydown', 'KeyW').defaultPrevented, true);
  step(1);
  key('keyup', 'KeyW');
  const keyboardZ = player.position.z;
  assert.ok(keyboardZ < 9);
  assert.equal(player.setState({ x: 7.3, z: 12 }), true);
  player.setInput({ y: 1 });
  step(1);
  assert.ok(Math.abs(player.position.z - keyboardZ) < 1e-8);
  key('keydown', 'KeyE');
  key('keydown', 'KeyE', { repeat: true });
  assert.equal(interactions, 1);
  player.setActive(false);
  key('keydown', 'KeyE');
  assert.equal(interactions, 1);
});

test('pause, focus loss, and hidden tabs clear held controls and boat momentum', t => {
  const { player, step } = setup(t);
  assert.equal(player.toggleMode().ok, true);
  key('keydown', 'KeyW');
  step(.5);
  player.setActive(false);
  let previous = player.position.clone();
  step(1);
  assert.deepEqual(player.position, previous);
  player.setActive(true);
  step(.5);
  assert.deepEqual(player.position, previous);
  for (const clear of [() => window.dispatchEvent(new Event('blur')), () => {
    document.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
  }]) {
    key('keydown', 'KeyW');
    step(.2);
    clear();
    previous = player.position.clone();
    step(.5);
    assert.deepEqual(player.position, previous);
  }
});

test('invalid saved positions leave the complete current state unchanged', t => {
  const { player } = setup(t);
  const before = player.getState();
  for (const state of [null, { x: NaN, z: 0 }, { x: 0, z: Infinity }, { x: 1e13, z: 12 }, { x: 0, z: 0, mode: 'walk' }, { x: 12, z: 12, mode: 'boat' }]) {
    assert.equal(player.setState(state), false);
    assert.deepEqual(player.getState(), before);
  }
});

test('floating-origin changes preserve absolute camera and traveler positions', t => {
  const { player, camera, world, step } = setup(t);
  step(.2);
  const absoluteCamera = camera.position.clone().add(new THREE.Vector3(world.origin.x, 0, world.origin.z));
  const absolutePlayer = player.position.clone();
  world.origin.x += 64;
  world.origin.z -= 64;
  player.update(0, .2, { origin: world.origin });
  const rebasedCamera = camera.position.clone().add(new THREE.Vector3(world.origin.x, 0, world.origin.z));
  assert.ok(absoluteCamera.distanceTo(rebasedCamera) < 1e-8);
  assert.deepEqual(player.position, absolutePlayer);
  assert.ok(Math.abs(player.avatar.position.x + world.origin.x - absolutePlayer.x) < 1e-8);
  assert.ok(Math.abs(player.avatar.position.z + world.origin.z - absolutePlayer.z) < 1e-8);
});

test('disposing releases scene objects and keyboard listeners', t => {
  let interactions = 0;
  const { player, scene } = setup(t, { onInteract: () => interactions++ });
  assert.equal(scene.children.length, 3);
  player.dispose();
  assert.equal(scene.children.length, 0);
  key('keydown', 'KeyE');
  assert.equal(interactions, 0);
});
