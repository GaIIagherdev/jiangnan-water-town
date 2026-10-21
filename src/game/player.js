import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const angleDelta = (from, to) => ((to - from + Math.PI) % TAU + TAU) % TAU - Math.PI;
const approachAngle = (from, to, amount) => from + angleDelta(from, to) * amount;
const isEditing = target => target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]');

/** Absolute coordinates are kept independent of the streamed world's render origin. */
export function createPlayer({ scene, camera, canvas, world, assets, onInteract, onModeChange } = {}) {
  const position = new THREE.Vector3(7.3, .55, 12);
  const velocity = new THREE.Vector2();
  const keys = new Set();
  const input = { x: 0, y: 0, sprint: false };
  const traveler = assets.traveler();
  const avatar = traveler.group;
  const boat = assets.boat();
  avatar.name = 'player-traveler';
  boat.name = 'player-boat';
  scene.add(avatar, boat);
  boat.visible = false;
  const lantern = new THREE.PointLight(0xffba73, 4.7, 6, 2);
  lantern.name = 'traveler-lantern';
  scene.add(lantern);

  let mode = 'walk';
  let yaw = Math.PI;
  let cameraYaw = Math.PI;
  let cameraPitch = .37;
  let cameraDistance = 7.8;
  let active = false;
  let disposed = false;
  let travel = 0;
  let movePhase = 0;
  let pointer = null;
  let lastBlocked = false;
  let cameraInitialized = false;
  let clearanceDistance = cameraDistance;
  let clearanceTimer = 0;
  let cameraAutoTimer = 0;
  const cameraAbsolute = new THREE.Vector3();
  const cameraTargetAbsolute = new THREE.Vector3();
  const target = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3();
  const localTarget = new THREE.Vector3();
  const listeners = [];
  const lastOrigin = { x: 0, z: 0 };

  function listen(targetElement, type, callback, options) {
    targetElement.addEventListener(type, callback, options);
    listeners.push(() => targetElement.removeEventListener(type, callback, options));
  }
  function clearInput() {
    keys.clear();
    input.x = 0;
    input.y = 0;
    input.sprint = false;
    pointer = null;
    velocity.set(0, 0);
  }
  function setActive(value) {
    const next = !!value;
    if (active && !next) clearInput();
    active = next;
  }
  function interact() {
    if (active) return onInteract?.();
  }
  const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
  listen(window, 'keydown', event => {
    if (!active || event.ctrlKey || event.metaKey || event.altKey || isEditing(event.target)) return;
    if (movementKeys.has(event.code)) {
      keys.add(event.code);
      event.preventDefault();
    } else if (event.code === 'KeyE' && !event.repeat) {
      event.preventDefault();
      interact();
    }
  });
  listen(window, 'keyup', event => { keys.delete(event.code); });
  listen(window, 'blur', clearInput);
  listen(document, 'visibilitychange', () => { if (document.hidden) clearInput(); });
  function lookDrag(dx, dy) {
    if (!finite(dx) || !finite(dy)) return;
    cameraYaw -= dx * .0045;
    cameraPitch = clamp(cameraPitch + dy * .0035, .20, 1.04);
    cameraAutoTimer = 1.8;
    clearanceTimer = .12;
  }
  listen(canvas, 'pointerdown', event => {
    if (!active || pointer || (event.button !== 0 && event.button !== 2)) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    try { canvas.setPointerCapture(event.pointerId); } catch { /* detached canvas */ }
  });
  listen(canvas, 'pointermove', event => {
    if (!active || !pointer || pointer.id !== event.pointerId) return;
    lookDrag(event.clientX - pointer.x, event.clientY - pointer.y);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });
  function endPointer(event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    try { canvas.releasePointerCapture(event.pointerId); } catch { /* pointer already released */ }
    pointer = null;
  }
  listen(canvas, 'pointerup', endPointer);
  listen(canvas, 'pointercancel', endPointer);
  listen(canvas, 'contextmenu', event => { if (active) event.preventDefault(); });
  listen(canvas, 'wheel', event => {
    if (!active) return;
    cameraDistance = clamp(cameraDistance + event.deltaY * .007, 4.2, 13);
    clearanceTimer = .12;
    event.preventDefault();
  }, { passive: false });

  function setInput(value = {}) {
    input.x = finite(value.x) ? clamp(value.x, -1, 1) : 0;
    input.y = finite(value.y) ? clamp(value.y, -1, 1) : 0;
    input.sprint = !!value.sprint;
  }
  function getHeight(x, z) {
    const value = world.getHeight(x, z);
    return finite(value) ? value : null;
  }
  function canWalk(x, z, oldY = position.y) {
    if (!world.canWalk(x, z, .30)) return false;
    const height = getHeight(x, z);
    return height !== null && Math.abs(height - oldY) < .58;
  }
  function underpassClear(x, z, height) {
    const lx = x - Math.floor((x + 32) / 64) * 64;
    const lz = z - Math.floor((z + 32) / 64) * 64;
    let axis = null;
    if (Math.abs(lx) < 5.8 && Math.abs(Math.abs(lz) - 18) < 1.35) axis = lx;
    else if (Math.abs(lz) < 5.8 && Math.abs(Math.abs(lx) - 18) < 1.35) axis = lz;
    if (axis === null) return true;
    const clearance = -.12 + 2.35 * Math.sqrt(Math.max(0, 1 - (axis / 5.8) ** 2));
    return height < clearance - .035;
  }
  function canSail(x, z, heading = yaw) {
    // Check the actual narrow hull's rotated corners, rather than a bounding circle.
    const sx = Math.sin(heading), cz = Math.cos(heading);
    for (const longitudinal of [-1.57, 0, 1.57]) {
      for (const lateral of [-.62, .62]) {
        const px = x + sx * longitudinal + cz * lateral;
        const pz = z + cz * longitudinal - sx * lateral;
        if (!world.canSail(px, pz, .12) || !underpassClear(px, pz, 1.30)) return false;
      }
    }
    const riderX = x + sx * .80, riderZ = z + cz * .80;
    for (const [dx, dz] of [[0, 0], [.30, 0], [-.30, 0], [0, .30], [0, -.30]]) {
      if (!underpassClear(riderX + dx, riderZ + dz, 1.47)) return false;
    }
    return world.canSail(x, z, .25);
  }
  function nearestCell(value) { return Math.floor((value + 32) / 64) * 64; }
  function transferCandidates(boarding) {
    const ox = nearestCell(position.x), oz = nearestCell(position.z);
    const lx = position.x - ox, lz = position.z - oz;
    const points = [];
    for (const side of [-1, 1]) {
      const edge = boarding ? 3.65 : 6.85;
      points.push({ x: ox + side * edge, z: position.z, heading: Math.cos(yaw) >= 0 ? 0 : Math.PI, side });
      points.push({ x: position.x, z: oz + side * edge, heading: Math.sin(yaw) >= 0 ? Math.PI / 2 : -Math.PI / 2, side });
    }
    return points
      .map(point => ({ ...point, distance: Math.hypot(point.x - position.x, point.z - position.z) }))
      .sort((a, b) => a.distance - b.distance);
  }
  function toggleMode() {
    if (!active) return { ok: false, mode, reason: '先继续漫游，再与渡口互动。' };
    const boarding = mode === 'walk';
    if (boarding && position.y > 1.15) return { ok: false, mode, reason: '请先走下石桥，在河岸边登船。' };
    const candidate = transferCandidates(boarding).find(point => {
      if (point.distance > (boarding ? 4.35 : 3.8)) return false;
      if (boarding) return canSail(point.x, point.z, point.heading);
      const height = getHeight(point.x, point.z);
      return height !== null && height < 1.15 && world.canWalk(point.x, point.z, .34);
    });
    if (!candidate) return { ok: false, mode, reason: boarding ? '走近河岸，就能唤来一叶小舟。' : '靠近两岸的石阶或空地，再按 E 上岸。' };
    mode = boarding ? 'boat' : 'walk';
    position.x = candidate.x;
    position.z = candidate.z;
    position.y = boarding ? .15 : getHeight(candidate.x, candidate.z);
    yaw = candidate.heading;
    velocity.set(0, 0);
    lastBlocked = false;
    boat.visible = boarding;
    avatar.scale.setScalar(boarding ? .86 : 1);
    (traveler.legs || []).forEach(part => { part.visible = !boarding; part.rotation.x = 0; });
    onModeChange?.(mode);
    return { ok: true, mode, reason: boarding ? '已登船 · 沿水而行' : '已上岸 · 随步寻幽' };
  }

  function moveStep(dx, dz, heading) {
    const oldX = position.x, oldZ = position.z;
    const test = mode === 'boat'
      ? (x, z) => canSail(x, z, heading)
      : (x, z) => canWalk(x, z);
    if (test(oldX + dx, oldZ + dz)) {
      position.x += dx;
      position.z += dz;
    } else {
      if (test(position.x + dx, position.z)) position.x += dx;
      else velocity.x = 0;
      if (test(position.x, position.z + dz)) position.z += dz;
      else velocity.y = 0;
    }
    if (mode === 'walk') {
      const height = getHeight(position.x, position.z);
      if (height !== null) position.y = height;
    }
    return Math.hypot(position.x - oldX, position.z - oldZ);
  }
  function updateCamera(dt, origin) {
    target.set(position.x, position.y + (mode === 'boat' ? 1.15 : 1.3), position.z);
    clearanceTimer += dt;
    if (clearanceTimer >= .1 || !cameraInitialized) {
      clearanceTimer = 0;
      clearanceDistance = cameraDistance;
      // Terrain height is null on canals: water does not shorten the camera.
      // A blocked solid-ground sample represents a house or impassable garden.
      for (let d = 1.8; d <= cameraDistance; d += .4) {
        const sx = target.x - Math.sin(cameraYaw) * Math.cos(cameraPitch) * d;
        const sz = target.z - Math.cos(cameraYaw) * Math.cos(cameraPitch) * d;
        if (getHeight(sx, sz) !== null && !world.canWalk(sx, sz, .08)) {
          clearanceDistance = Math.max(2.25, d - .45);
          break;
        }
      }
    }
    const distance = Math.min(cameraDistance, clearanceDistance);
    desiredCamera.set(
      target.x - Math.sin(cameraYaw) * Math.cos(cameraPitch) * distance,
      target.y + Math.sin(cameraPitch) * distance,
      target.z - Math.cos(cameraYaw) * Math.cos(cameraPitch) * distance,
    );
    if (!cameraInitialized) {
      cameraAbsolute.copy(desiredCamera);
      cameraTargetAbsolute.copy(target);
      cameraInitialized = true;
    } else {
      const alpha = 1 - Math.exp(-dt * 9);
      cameraAbsolute.lerp(desiredCamera, alpha);
      cameraTargetAbsolute.lerp(target, 1 - Math.exp(-dt * 13));
    }
    camera.position.set(cameraAbsolute.x - origin.x, cameraAbsolute.y, cameraAbsolute.z - origin.z);
    localTarget.set(cameraTargetAbsolute.x - origin.x, cameraTargetAbsolute.y, cameraTargetAbsolute.z - origin.z);
    camera.lookAt(localTarget);
  }
  function update(dt, time = 0, options = {}) {
    if (disposed) return;
    dt = finite(dt) ? clamp(dt, 0, .1) : 0;
    if (typeof options.active === 'boolean') setActive(options.active);
    const origin = options.origin || world.origin || lastOrigin;
    lastOrigin.x = finite(origin.x) ? origin.x : 0;
    lastOrigin.z = finite(origin.z) ? origin.z : 0;
    let horizontal = input.x, forward = input.y;
    if (active) {
      horizontal += (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      forward += (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    } else { horizontal = forward = 0; }
    const magnitude = Math.min(1, Math.hypot(horizontal, forward));
    const denominator = Math.max(1, Math.hypot(horizontal, forward));
    horizontal /= denominator;
    forward /= denominator;
    const sprinting = input.sprint || keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = mode === 'boat' ? (sprinting ? 14 : 9) : (sprinting ? 6.2 : 3.45);
    const targetVX = (Math.sin(cameraYaw) * forward - Math.cos(cameraYaw) * horizontal) * speed;
    const targetVZ = (Math.cos(cameraYaw) * forward + Math.sin(cameraYaw) * horizontal) * speed;
    const accel = mode === 'boat' ? 2.8 : 13;
    velocity.lerp(new THREE.Vector2(targetVX, targetVZ), 1 - Math.exp(-dt * accel));
    if (!active) velocity.set(0, 0);
    const moving = velocity.length() > .025;
    let candidateYaw = yaw;
    if (moving) candidateYaw = approachAngle(yaw, Math.atan2(velocity.x, velocity.y), 1 - Math.exp(-dt * (mode === 'boat' ? 4.5 : 14)));
    if (mode === 'walk' || canSail(position.x, position.z, candidateYaw)) yaw = candidateYaw;
    const displacement = velocity.length() * dt;
    const steps = Math.max(1, Math.ceil(displacement / .19));
    let distance = 0;
    for (let i = 0; i < steps; i++) distance += moveStep(velocity.x * dt / steps, velocity.y * dt / steps, yaw);
    travel += distance;
    lastBlocked = active && magnitude > .15 && displacement > .0005 && distance < displacement * .22;
    movePhase += distance * 4.5;
    if (mode === 'boat') position.y = .15;
    avatar.scale.setScalar(mode === 'boat' ? .86 : 1);
    avatar.rotation.y = yaw;
    const seatedOffset = mode === 'boat' ? .80 : 0;
    avatar.position.set(position.x - lastOrigin.x + Math.sin(yaw) * seatedOffset, position.y + (mode === 'boat' ? -.30 : 0), position.z - lastOrigin.z + Math.cos(yaw) * seatedOffset);
    const stride = mode === 'walk' && distance > .0001 ? Math.sin(movePhase) * .55 : 0;
    for (let i = 0; i < (traveler.legs || []).length; i++) {
      const limb = traveler.legs[i];
      limb.visible = mode === 'walk';
      limb.rotation.x = THREE.MathUtils.lerp(limb.rotation.x, i % 2 ? stride : -stride, 1 - Math.exp(-dt * 18));
    }
    for (let i = 0; i < (traveler.arms || []).length; i++) {
      traveler.arms[i].rotation.x = THREE.MathUtils.lerp(traveler.arms[i].rotation.x, mode === 'boat' ? -.25 : (i % 2 ? -stride : stride) * .65, 1 - Math.exp(-dt * 14));
    }
    boat.visible = mode === 'boat';
    boat.position.set(position.x - lastOrigin.x, .15 + Math.sin(time * 1.1) * .018, position.z - lastOrigin.z);
    boat.rotation.set(Math.sin(time * .7) * .008, yaw, Math.sin(time * .9) * .012);
    lantern.position.set(avatar.position.x + .2, avatar.position.y + .9, avatar.position.z);
    lantern.intensity = mode === 'boat' ? 5.2 : 3.5;
    cameraAutoTimer = Math.max(0, cameraAutoTimer - dt);
    updateCamera(dt, lastOrigin);
  }
  function resetCamera() {
    cameraYaw = yaw;
    cameraPitch = .37;
    cameraDistance = 7.8;
    clearanceDistance = cameraDistance;
    clearanceTimer = .12;
  }
  function getState() {
    return { x: position.x, y: position.y, z: position.z, mode, yaw, cameraYaw, cameraPitch, cameraDistance, travel };
  }
  function setState(state) {
    if (!state || !finite(state.x) || !finite(state.z) || Math.abs(state.x) > 1e12 || Math.abs(state.z) > 1e12) return false;
    const nextMode = state.mode === 'boat' ? 'boat' : 'walk';
    const nextYaw = finite(state.yaw) ? state.yaw : Math.PI;
    const safe = nextMode === 'boat' ? canSail(state.x, state.z, nextYaw) : world.canWalk(state.x, state.z, .30);
    if (!safe) return false;
    const height = nextMode === 'boat' ? .15 : getHeight(state.x, state.z);
    if (height === null) return false;
    position.set(state.x, height, state.z);
    mode = nextMode;
    yaw = nextYaw;
    cameraYaw = finite(state.cameraYaw) ? state.cameraYaw : yaw;
    cameraPitch = finite(state.cameraPitch) ? clamp(state.cameraPitch, .20, 1.04) : .37;
    cameraDistance = finite(state.cameraDistance) ? clamp(state.cameraDistance, 4.2, 13) : 7.8;
    travel = finite(state.travel) ? Math.max(0, state.travel) : 0;
    cameraInitialized = false;
    velocity.set(0, 0);
    onModeChange?.(mode);
    return true;
  }
  function dispose() {
    disposed = true;
    for (const remove of listeners) remove();
    scene.remove(avatar, boat, lantern);
    // Asset geometry and materials belong to the shared asset library.
    lantern.dispose();
  }
  return {
    position, avatar, boat, lantern,
    get mode() { return mode; },
    get yaw() { return yaw; },
    get active() { return active; },
    update, setInput, lookDrag, interact, toggleMode, setState, getState, setActive, resetCamera, dispose,
    stats() { return { mode, speed: velocity.length(), travelled: travel, blocked: lastBlocked, yaw, cameraYaw, cameraDistance, active }; },
  };
}
