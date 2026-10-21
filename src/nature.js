import * as THREE from 'three';

// All foliage is geometry, batched per species. The scene stays entirely local.
export function createNature({ scene, random: seededRandom } = {}) {
  let seed = 73129;
  const random = seededRandom || (() => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; });
  const rand = (a, b) => a + (b - a) * random();
  const group = new THREE.Group();
  group.name = 'Willows, riverbank gardens and distant hills';
  scene?.add(group);
  const timeUniform = { value: 0 };
  const swaying = [];
  const temp = new THREE.Object3D();
  const color = new THREE.Color();

  function merge(geometries) {
    const p = [], n = [], uv = [], indices = [];
    let offset = 0;
    for (const g of geometries) {
      const pos = g.getAttribute('position');
      const nor = g.getAttribute('normal');
      const uvs = g.getAttribute('uv');
      for (let i = 0; i < pos.count; i++) {
        p.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        n.push(nor?.getX(i) || 0, nor?.getY(i) || 1, nor?.getZ(i) || 0);
        uv.push(uvs?.getX(i) || 0, uvs?.getY(i) || 0);
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) indices.push(g.index.getX(i) + offset);
      else for (let i = 0; i < pos.count; i++) indices.push(i + offset);
      offset += pos.count;
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    out.setIndex(indices);
    return out;
  }

  function taperTube(points, r0, r1, segments = 24, radial = 7) {
    const curve = new THREE.CatmullRomCurve3(points);
    const frames = curve.computeFrenetFrames(segments, false);
    const verts = [], uv = [], ids = [];
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const point = curve.getPointAt(u);
      const r = THREE.MathUtils.lerp(r0, r1, Math.pow(u, .75));
      for (let j = 0; j <= radial; j++) {
        const t = j / radial * Math.PI * 2;
        const irregular = 1 + .08 * Math.sin(j * 2.7 + i * 1.1);
        const v = point.clone().addScaledVector(frames.normals[i], Math.cos(t) * r * irregular).addScaledVector(frames.binormals[i], Math.sin(t) * r * irregular);
        verts.push(v.x, v.y, v.z);
        uv.push(j / radial, u * Math.max(r0 * 8, 2));
      }
    }
    for (let i = 0; i < segments; i++) for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      ids.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(ids); geo.computeVertexNormals();
    return geo;
  }

  function barkTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 512;
    const c = canvas.getContext('2d');
    c.fillStyle = '#69695a'; c.fillRect(0, 0, 128, 512);
    for (let i = 0; i < 1800; i++) {
      const gray = Math.round(rand(45, 105));
      c.strokeStyle = `rgba(${gray},${gray + 4},${gray - 12},${rand(.1, .38)})`;
      c.lineWidth = rand(.3, 2.2);
      const x = rand(0, 128), y = rand(-50, 512);
      c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + rand(-4, 4), y + 15, x + rand(-8, 8), y + 40, x + rand(-5, 5), y + rand(45, 120)); c.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
  }
  const bark = new THREE.MeshStandardMaterial({ color: 0xb2b09a, map: barkTexture(), roughness: .97 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x9da574, roughness: .85, metalness: 0, side: THREE.DoubleSide });
  leafMat.onBeforeCompile = shader => {
    shader.uniforms.uWillowTime = timeUniform;
    shader.vertexShader = 'uniform float uWillowTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 leafOrigin = instanceMatrix[3].xyz;
        float heightWeight = clamp(leafOrigin.y / 7.0, 0.0, 1.0);
        transformed.x += sin(uWillowTime * 0.62 + leafOrigin.y * 1.16 + leafOrigin.z * .35) * .038 * heightWeight;
        transformed.z += cos(uWillowTime * .47 + leafOrigin.y * .87 + leafOrigin.x * .4) * .025 * heightWeight;
      #endif
    `);
  };
  const leafGeo = new THREE.BufferGeometry();
  // A curved, double-ended lanceolate willow leaf, its central vein slightly raised.
  leafGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, -.027, -.055, .008, .027, -.055, .008,
    -.035, -.13, .014, .035, -.13, .014, -.019, -.22, .005,
    .019, -.22, .005, 0, -.3, -.012,
  ], 3));
  leafGeo.setAttribute('uv', new THREE.Float32BufferAttribute([.5, 0, 0, .2, 1, .2, 0, .45, 1, .45, .1, .75, .9, .75, .5, 1], 2));
  leafGeo.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6, 5, 7, 6]);
  leafGeo.computeVertexNormals();

  function willow(x, z, scale, rotation, density = 1) {
    const tree = new THREE.Group(); tree.position.set(x, .53, z); tree.scale.setScalar(scale); tree.rotation.y = rotation;
    group.add(tree); swaying.push({ tree, phase: rand(0, 6.28) });
    const woody = [];
    const trunkPoints = [new THREE.Vector3(0, -.2, 0), new THREE.Vector3(-.2, 1, .08), new THREE.Vector3(.11, 2.4, .1), new THREE.Vector3(-.23, 3.6, -.12), new THREE.Vector3(.1, 4.7, -.14)];
    woody.push(taperTube(trunkPoints, .29, .06, 34, 11));
    // Exposed roots curve over the stone embankment.
    for (let r = 0; r < 5; r++) {
      const a = r / 5 * Math.PI * 2 + rand(-.3, .3);
      woody.push(taperTube([new THREE.Vector3(.01, .54, .03), new THREE.Vector3(Math.cos(a) * .28, .12, Math.sin(a) * .28), new THREE.Vector3(Math.cos(a) * .92, -.05, Math.sin(a) * .92)], .12, .014, 10, 7));
    }
    const leaves = [], twigPos = [];
    const branchCount = 14;
    for (let b = 0; b < branchCount; b++) {
      const angle = b / branchCount * Math.PI * 2 + rand(-.3, .3);
      const radius = rand(2, 3.7);
      const y = rand(4.1, 6.05);
      const startY = rand(2.4, 3.9);
      const tip = new THREE.Vector3(Math.cos(angle) * radius, y - rand(.2, .8), Math.sin(angle) * radius);
      const arch = new THREE.Vector3(Math.cos(angle) * radius * .62, y + .2, Math.sin(angle) * radius * .6);
      const branchPath = [new THREE.Vector3(-.07, startY, 0), new THREE.Vector3(Math.cos(angle) * .7, y - .8, Math.sin(angle) * .6), arch, tip];
      const branchCurve = new THREE.CatmullRomCurve3(branchPath);
      woody.push(taperTube(branchPath, rand(.032, .072), .004, 24, 7));
      // Fine, irregular sprays clothe the upper boughs as well as their pendulous tips.
      for (let k = 0; k < 230 * density; k++) {
        const along = rand(.35, 1);
        const p = branchCurve.getPoint(along);
        const spread = rand(.05, .53);
        const a = rand(0, Math.PI * 2);
        p.x += Math.cos(a) * spread; p.z += Math.sin(a) * spread; p.y += rand(-.27, .27);
        leaves.push({p, rz: rand(-1.4, 1.4), ry: rand(0, 6.28), rx: rand(-1.1, 1.1), scale: rand(.7, 1.05), width: 1.25});
      }
      const sprigs = Math.round(rand(10, 17) * density);
      for (let s = 0; s < sprigs; s++) {
        const spread = rand(.4, 1.2);
        const strandStart = branchCurve.getPoint(rand(.42, 1));
        strandStart.x += rand(-spread, spread); strandStart.z += rand(-spread, spread); strandStart.y += rand(-.25, .75);
        const length = rand(1.4, 3.65);
        const side = rand(-.4, .4), sideZ = rand(-.4, .4);
        const strand = [];
        const count = Math.round(length / .12);
        for (let j = 0; j <= count; j++) {
          const t = j / count;
          const point = new THREE.Vector3(
            strandStart.x + Math.cos(angle) * Math.sin(t * Math.PI * .75) * .23 + side * t * t + Math.sin(t * 6 + b) * .035,
            strandStart.y - length * t,
            strandStart.z + Math.sin(angle) * Math.sin(t * Math.PI * .75) * .23 + sideZ * t * t
          );
          strand.push(point);
          if (j > 0) {
            const prev = strand[j - 1]; twigPos.push(prev.x, prev.y, prev.z, point.x, point.y, point.z);
          }
          if (j < count) {
            leaves.push({ p: point, rz: (j % 2 ? 1 : -1) * rand(.28, .8), ry: angle + rand(-1.1, 1.1), rx: rand(-.6, .6), scale: rand(.72, 1.2) * (1 - t * .15) });
            if (random() > .58) leaves.push({ p: point.clone().add(new THREE.Vector3(rand(-.07, .07), -.035, rand(-.07, .07))), rz: (j % 2 ? -1 : 1) * rand(.3, .8), ry: angle + 1.5, rx: rand(-.5, .5), scale: rand(.6, 1) });
          }
        }
      }
    }
    const treeWood = new THREE.Mesh(merge(woody), bark); treeWood.castShadow = true; treeWood.receiveShadow = true; tree.add(treeWood);
    const twigs = new THREE.BufferGeometry(); twigs.setAttribute('position', new THREE.Float32BufferAttribute(twigPos, 3));
    const thread = new THREE.LineSegments(twigs, new THREE.LineBasicMaterial({ color: 0x727552, transparent: true, opacity: .47 })); tree.add(thread);
    const foliage = new THREE.InstancedMesh(leafGeo, leafMat, leaves.length);
    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i]; temp.position.copy(leaf.p); temp.rotation.set(leaf.rx, leaf.ry, leaf.rz); temp.scale.set(leaf.scale * (leaf.width || 1.08), leaf.scale, leaf.scale); temp.updateMatrix(); foliage.setMatrixAt(i, temp.matrix);
      color.setHSL(rand(.19, .245), rand(.2, .37), rand(.33, .57)); foliage.setColorAt(i, color);
    }
    foliage.castShadow = true; foliage.receiveShadow = true; tree.add(foliage);
    tree.userData.leafCount = leaves.length;
  }
  willow(-8.4, 9.8, 1.25, .6, 1.05);
  willow(14.5, 15.5, 1.04, -1.2, 1.05);
  willow(-9.1, -22, .88, 2.2, .8);
  willow(9.1, -28, .82, -.4, .75);
  willow(-15.4, -8.8, .85, 1.2, .65);

  // Broad, sculpted mountain walls; their irregular ridges overlap through haze.
  const mountainGroup = new THREE.Group(); mountainGroup.name = 'Layered blue-green mountain silhouettes'; group.add(mountainGroup);
  function ridge(z, width, height, baseColor, phase, depth) {
    const nx = 320, nz = 22;
    const verts = [], cols = [], ids = [];
    const mountainColor = new THREE.Color(baseColor);
    for (let j = 0; j <= nz; j++) {
      const t = j / nz;
      for (let i = 0; i <= nx; i++) {
        const x = (i / nx - .5) * width;
        const u = x / width;
        const profile = .42 + .18 * Math.sin(u * 19 + phase) + .14 * Math.sin(u * 31 - phase * 2) + .065 * Math.sin(u * 57 + phase) + .022 * Math.sin(u * 91 + .3);
        const riverValley = .56 + .44 * Math.min(1, Math.abs(x + 6) / 38);
        const top = height * .72 * Math.max(.1, profile) * riverValley;
        const y = Math.max(-3, top * Math.pow(Math.sin(t * Math.PI), .7) - 2 + Math.sin(x * .35 + t * 4) * .12);
        verts.push(x, y, z - depth * t);
        const variation = .92 + .1 * Math.sin(x * .31 + j * .8) + .06 * t;
        cols.push(mountainColor.r * variation, mountainColor.g * variation, mountainColor.b * variation);
      }
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + nx + 1;
      ids.push(a, a + 1, b, a + 1, b + 1, b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.setIndex(ids); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true }));
    mountainGroup.add(m);
  }
  ridge(-93, 270, 35, 0x607b7a, 1.1, 35);
  ridge(-76, 230, 30, 0x526f70, 2.7, 28);
  ridge(-60, 200, 25, 0x3d5d5b, 4.5, 24);
  ridge(-46, 180, 21, 0x2b4743, 6.1, 23);

  function fogTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.scale(1, .5);
    const g = ctx.createRadialGradient(64, 64, 1, 64, 64, 63);
    g.addColorStop(0, 'rgba(210,224,216,.28)'); g.addColorStop(.4, 'rgba(210,224,216,.16)'); g.addColorStop(1, 'rgba(210,224,216,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }
  const mistTexture = fogTexture();
  const mist = [];
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTexture, color: 0xb4cccb, transparent: true, opacity: rand(.18, .35), depthWrite: false, fog: true }));
    m.position.set(rand(-50, 50), rand(1.1, 5), rand(-67, -36)); m.scale.set(rand(25, 50), rand(2.5, 5), 1);
    group.add(m); mist.push({ mesh: m, x: m.position.x, phase: rand(0, 6.28) });
  }

  // Eroded, moss-edged waterside stonework. Varied instances keep the shore organic.
  const rockGeo = new THREE.DodecahedronGeometry(1, 1);
  const rockPos = rockGeo.getAttribute('position');
  for (let i = 0; i < rockPos.count; i++) {
    const x = rockPos.getX(i), y = rockPos.getY(i), z = rockPos.getZ(i);
    const d = 1 + .12 * Math.sin(x * 14 + z * 7 + y * 3);
    rockPos.setXYZ(i, x * d, y * d, z * d);
  }
  rockGeo.computeVertexNormals();
  const stones = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: 0x8f9681, roughness: 1, flatShading: false }), 176);
  for (let i = 0; i < 176; i++) {
    const side = i % 2 ? -1 : 1; const z = rand(-34, 25);
    temp.position.set(side * rand(6.05, 7.05), rand(.14, .43), z);
    temp.rotation.set(rand(-.4, .4), rand(0, 6.28), rand(-.35, .35)); temp.scale.set(rand(.2, .55), rand(.16, .35), rand(.25, .64)); temp.updateMatrix(); stones.setMatrixAt(i, temp.matrix);
    color.setHSL(rand(.13, .2), rand(.06, .16), rand(.29, .45)); stones.setColorAt(i, color);
  }
  stones.receiveShadow = true; stones.castShadow = true; group.add(stones);

  // Fine waterside sedges and loosely clustered ferns.
  const grassGeo = new THREE.BufferGeometry();
  grassGeo.setAttribute('position', new THREE.Float32BufferAttribute([-.026, 0, 0, .026, 0, 0, -.018, .24, .026, .018, .24, .026, -.009, .48, .08, .009, .48, .08, 0, .68, .16], 3));
  grassGeo.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]); grassGeo.computeVertexNormals();
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x96a275, roughness: .95, side: THREE.DoubleSide });
  const grass = new THREE.InstancedMesh(grassGeo, grassMat, 2300);
  for (let i = 0; i < 2300; i++) {
    const side = i % 2 ? -1 : 1;
    const cluster = Math.floor(i / 22);
    const z = -32 + (cluster % 52) * 1.13;
    temp.position.set(side * (6.4 + .38 * Math.sin(cluster * 9.1)) + rand(-.22, .22), .48 + rand(0, .09), z + rand(-.38, .38));
    temp.rotation.set(rand(-.2, .2), rand(0, 6.28), rand(-.35, .35)); temp.scale.set(rand(.5, 1.3), rand(.35, .95), 1); temp.updateMatrix(); grass.setMatrixAt(i, temp.matrix);
    color.setHSL(rand(.17, .25), rand(.19, .36), rand(.25, .48)); grass.setColorAt(i, color);
  }
  grass.receiveShadow = true; group.add(grass);

  // Sparse low shrubs behind the paths, composed of individual leaves rather than faceted blobs.
  const shrubCount = 1500;
  const shrubs = new THREE.InstancedMesh(leafGeo, leafMat, shrubCount);
  for (let i = 0; i < shrubCount; i++) {
    const cluster = Math.floor(i / 90), a = rand(0, Math.PI * 2), r = Math.sqrt(random()) * .9;
    const side = cluster % 2 ? -1 : 1;
    const centerX = side * (7.1 + .3 * Math.sin(cluster * 4));
    const centerZ = -30 + cluster * 3.45;
    temp.position.set(centerX + Math.cos(a) * r, .6 + (1 - r) * rand(.3, .9), centerZ + Math.sin(a) * r);
    temp.rotation.set(rand(-1.4, 1.4), rand(0, Math.PI * 2), rand(-1.3, 1.3)); temp.scale.set(rand(1.6, 2.7), rand(.9, 1.5), 1); temp.updateMatrix(); shrubs.setMatrixAt(i, temp.matrix);
    color.setHSL(rand(.22, .29), .3, rand(.21, .42)); shrubs.setColorAt(i, color);
  }
  shrubs.receiveShadow = true; group.add(shrubs);

  return {
    group,
    trees: swaying.map(s => s.tree),
    mountains: mountainGroup,
    update(time) {
      timeUniform.value = time;
      for (const item of swaying) item.tree.rotation.z = Math.sin(time * .21 + item.phase) * .004;
      for (const item of mist) item.mesh.position.x = item.x + Math.sin(time * .035 + item.phase) * 1.3;
    },
  };
}
