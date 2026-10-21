import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Whitewashed waterside homes, individually composed and then material-batched. */
export function createVillage({ scene, random = Math.random } = {}) {
  const group = new THREE.Group(); group.name = 'Water town · white walls and dark tiles';
  const houses = new THREE.Group();
  const lights = [], lanterns = [];
  let seed = 97542;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  function texture(kind) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const c = canvas.getContext('2d');
    c.fillStyle = kind === 'wall' ? '#b7b4a2' : '#49504a'; c.fillRect(0,0,512,512);
    for (let i=0;i<21000;i++) {
      const v = rand(); c.fillStyle = `rgba(${kind==='wall'?'55,60,47':'10,15,13'},${v*.065})`;
      c.fillRect(rand()*512,rand()*512,rand()*4+.4,rand()*3+.4);
    }
    if (kind === 'wall') {
      const g=c.createLinearGradient(0,0,0,512); g.addColorStop(0,'rgba(10,25,20,.30)');g.addColorStop(.3,'rgba(10,25,20,0)');g.addColorStop(.75,'rgba(15,25,19,0)');g.addColorStop(1,'rgba(15,25,19,.36)'); c.fillStyle=g;c.fillRect(0,0,512,512);
      for(let i=0;i<70;i++){c.fillStyle=`rgba(50,65,50,${.01+rand()*.05})`;c.fillRect(rand()*512,rand()*512,1+rand()*7,10+rand()*90);}
    } else {
      for(let y=0;y<512;y+=64){c.fillStyle='rgba(8,15,14,.34)';c.fillRect(0,y,512,3);c.fillStyle='rgba(180,184,156,.08)';c.fillRect(0,y+3,512,2);}
      for(let x=0;x<512;x+=40){c.fillStyle='rgba(6,14,12,.26)';c.fillRect(x,0,2,512);}
    }
    const t=new THREE.CanvasTexture(canvas); t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;
    if(kind==='roof')t.repeat.set(2.5,1.2);
    return t;
  }
  const wallTex=texture('wall'), roofTex=texture('roof');
  const plaster=[0xf1ecda,0xc5cec2,0xdedbc8,0xd4d6c8].map(color=>new THREE.MeshStandardMaterial({color,map:wallTex,roughness:.94}));
  const roof=new THREE.MeshStandardMaterial({color:0x727e71,map:roofTex,roughness:.86});
  const tile=new THREE.MeshStandardMaterial({color:0x283a32,roughness:.77});
  const tileHighlight=new THREE.MeshStandardMaterial({color:0x515d4c,roughness:.85});
  const timber=new THREE.MeshStandardMaterial({color:0x352d22,roughness:.87});
  const timberLight=new THREE.MeshStandardMaterial({color:0x554230,roughness:.84});
  const stone=new THREE.MeshStandardMaterial({color:0x777d6c,roughness:.97});
  const darkStone=new THREE.MeshStandardMaterial({color:0x424d40,roughness:1});
  const windowMats=[0xffb760,0xe2b976,0xf1b15a].map(color=>new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.68,roughness:.84}));
  const darkWindow=new THREE.MeshStandardMaterial({color:0x26392f,roughness:.6});
  const terracotta=new THREE.MeshStandardMaterial({color:0x64513a,roughness:1});
  const leafMat=new THREE.MeshStandardMaterial({color:0x314c27,roughness:1});
  const oldBrick=new THREE.MeshStandardMaterial({color:0x596452,roughness:1});
  const vineMat=new THREE.MeshStandardMaterial({color:0x465932,roughness:1});
  function mesh(geometry,material,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
  function box(parent,material,x,y,z,w,h,d){return mesh(new THREE.BoxGeometry(w,h,d),material,parent,x,y,z);}
  function tube(parent,points,radius,material,segments=12){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments,radius,5,false),material,parent);}
  function roofSide(parent,w,d,h,side,scale=1){
    const halfD=d/2+.62, halfW=w/2+.52;
    const lift=1.3*scale;
    const roofY=(u,x)=>h+lift*(1-u)+.29*scale*u*u*u+.14*Math.pow(Math.abs(x)/halfW,9)*u;
    const pos=[],uv=[],idx=[],nx=12,ny=14;
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      const u=j/ny,x=(i/nx-.5)*2*halfW;
      pos.push(x,roofY(u,x),u*halfD*side);uv.push(i/nx,u);
    }
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,dv=c+1; if(side>0)idx.push(a,c,b,b,c,dv);else idx.push(a,b,c,b,dv,c);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
    mesh(geo,roof,parent);
    // Half-round cover tiles read as thin ridges, not a repeated corrugated sheet.
    const count=Math.round(2*halfW/.19);
    for(let n=0;n<=count;n++){
      const x=-halfW+n/count*halfW*2, points=[];
      for(let j=0;j<=7;j++){const u=j/7;points.push([x,roofY(u,x)+.025,u*halfD*side]);}
      tube(parent,points,.025,n%5===0?tileHighlight:tile,14);
    }
    for(let s of [-1,1]) {
      const x=s*halfW,points=[];for(let j=0;j<=9;j++){const u=j/9;points.push([x,roofY(u,x)+.06,u*halfD*side]);}tube(parent,points,.073,tile,18);
    }
    const eavePts=[];for(let i=0;i<=10;i++){const x=-halfW+2*halfW*i/10;eavePts.push([x,roofY(1,x),side*halfD]);}tube(parent,eavePts,.075,tile,20);
    // Roof underside in aged timber, softened at the corners.
    box(parent,timber,0,h+.10,side*(d/2+.16),w+.82,.11,.45);
  }
  function fullRoof(parent,w,d,h,scale=1){
    roofSide(parent,w,d,h,1,scale);roofSide(parent,w,d,h,-1,scale);
    const pts=[];for(let i=0;i<=12;i++){const t=i/12,x=(t-.5)*(w+1.15);pts.push([x,h+1.3*scale+.10+.16*Math.pow(Math.abs(t-.5)*2,10),0]);}tube(parent,pts,.095,tile,24);
    // Simple ridge end ornaments in the local building tradition.
    for(const side of [-1,1]) tube(parent,[[side*(w/2+.43),h+1.3*scale+.12,0],[side*(w/2+.61),h+1.3*scale+.24,0],[side*(w/2+.62),h+1.3*scale+.37,0]],.055,tile,6);
  }
  function window(parent,x,y,z,w,h,lit=true,variant=0){
    box(parent,timber,x,y,z,w+.16,h+.16,.12);
    box(parent,lit?windowMats[variant%3]:darkWindow,x,y,z+.075,w,h,.025);
    const thick=.032;
    for(let xx=-w/2;xx<=w/2+.01;xx+=w/6)box(parent,timber,x+xx,y,z+.1,thick,h,.045);
    for(let yy=-h/2;yy<=h/2+.01;yy+=h/5)box(parent,timber,x,y+yy,z+.1,w,thick,.045);
    box(parent,timberLight,x,y-h/2-.10,z+.08,w+.28,.1,.22);
    if(variant%3===1){box(parent,timberLight,x-w/2-.26,y,z+.03,.32,h+.08,.075);box(parent,timberLight,x+w/2+.26,y,z+.03,.32,h+.08,.075);}
  }
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;
  const glowCtx=glowCanvas.getContext('2d'),glowGrad=glowCtx.createRadialGradient(32,32,0,32,32,32);glowGrad.addColorStop(0,'rgba(255,174,68,.6)');glowGrad.addColorStop(.28,'rgba(255,138,36,.19)');glowGrad.addColorStop(1,'rgba(255,116,25,0)');glowCtx.fillStyle=glowGrad;glowCtx.fillRect(0,0,64,64);
  const glowTexture=new THREE.CanvasTexture(glowCanvas);
  const lanternMat=new THREE.MeshStandardMaterial({color:0xffb15b,emissive:0xff8e28,emissiveIntensity:2.6,roughness:.7});
  function lantern(parent,x,y,z,light=false){
    const lamp=new THREE.Group();lamp.position.set(x,y,z);parent.add(lamp);
    const b=mesh(new THREE.SphereGeometry(.19,16,12),lanternMat,lamp,0,-.17,0);b.scale.y=1.35;
    box(lamp,timber,0,.12,0,.025,.23,.025);
    for(let yy of [.06,-.40])mesh(new THREE.CylinderGeometry(.12,.12,.045,10),timber,lamp,0,yy,0);
    for(let angle=0;angle<Math.PI*2;angle+=Math.PI/4){const points=[];for(let n=0;n<=8;n++){const t=n/8*Math.PI;points.push([.19*Math.sin(t)*Math.cos(angle),-.17+.245*Math.cos(t),.19*Math.sin(t)*Math.sin(angle)]);}tube(lamp,points,.006,timberLight,8);}
    box(lamp,lanternMat,0,-.49,0,.018,.15,.018);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.55}));glow.position.y=-.17;glow.scale.set(1.7,1.7,1);lamp.add(glow);
    if(light){const l=new THREE.PointLight(0xffb65c,4.5,6.5,2);l.position.y=-.2;lamp.add(l);lights.push(l);}
    lamp.userData.keepSeparate=true;
    lanterns.push({mesh:lamp,baseY:y,phase:rand()*Math.PI*2});
    return lamp;
  }
  function gables(parent,w,d,h,material,scale=1){
    for(let s of [-1,1]){
      const sh=new THREE.Shape();sh.moveTo(-d/2,0);sh.lineTo(d/2,0);sh.lineTo(0,1.3*scale);sh.closePath();
      const m=mesh(new THREE.ExtrudeGeometry(sh,{depth:.14,bevelEnabled:false}),material,parent,s*w/2,h,0);m.rotation.y=Math.PI/2;
      // Small dark ventilation slit set into the triangular gable.
      box(parent,darkWindow,s*(w/2+.02),h+.4,0,.05,.25,.32);
    }
  }
  function house({x,z,w=5,d=5,h=3.8,angle=0,variant=0,balcony=false,porch=false}){
    const p=new THREE.Group();p.position.set(x,.55,z);p.rotation.y=angle;houses.add(p);
    const wall=plaster[variant%4];
    box(p,darkStone,0,.15,0,w+.14,.3,d+.14);
    box(p,stone,0,.38,0,w,.3,d);
    box(p,wall,0,(h+.5)/2,0,w,h-.5,d);
    // Corner timbers and low water-stained plinth are the quiet backbone of the facade.
    const front=d/2;
    box(p,timber,0,.7,front+.02,w,.10,.12);
    for(const xx of [-w/2+.12,w/2-.12])box(p,timber,xx,(h+.5)/2,front+.04,.13,h-.45,.13);
    box(p,timber,0,h-.12,front+.07,w,.15,.15);
    const two=h>4.2;
    if(two){box(p,timber,0,2.65,front+.03,w,.16,.16);for(let xx=-w/2+.85;xx<w/2;xx+=1.65)window(p,xx,3.6,front+.05,1.02,1.22,(variant+Math.round(xx*3))%4!==0,variant);}
    const doorX=(variant%2===0?.1:-.45),doorW=.94,doorH=1.85;
    box(p,timber,doorX,1.43,front+.045,doorW+.22,doorH+.12,.15);
    box(p,variant%3===0?windowMats[1]:timberLight,doorX,1.43,front+.13,doorW,doorH,.07);
    for(let n=0;n<5;n++)box(p,timber,doorX-doorW/2+(n+.5)*doorW/5,1.43,front+.18,.023,doorH,.025);
    mesh(new THREE.SphereGeometry(.025,6,5),tileHighlight,p,doorX+.22,1.4,front+.23);
    for(const side of [-1,1])window(p,side*(w*.31),1.76,front+.06,.93,1.10,(variant+side)%3!==0,variant+1);
    // Stone threshold and three broad worn steps to the lane.
    for(let n=0;n<3;n++)box(p,stone,doorX,.11+n*.10,front+.73-n*.17,1.40+n*.07,.16,.46);
    fullRoof(p,w,d,h,variant%3===0?1.1:1);
    gables(p,w,d,h,wall,variant%3===0?1.1:1);
    if(balcony){
      box(p,timberLight,0,2.70,front+.62,w+.28,.16,1.35);
      for(let xx=-w/2+.1;xx<=w/2;xx+=.58)box(p,timber,xx,3.08,front+1.17,.055,.7,.055);
      box(p,timberLight,0,3.45,front+1.17,w,.08,.08);box(p,timber,0,2.85,front+1.17,w,.07,.07);
      for(let xx of [-w/2+.12,w/2-.12])box(p,timber,xx,2.50,front+1.10,.11,3.78,.11);
      const awning=new THREE.Group();awning.position.z=front+.63;p.add(awning);
      fullRoof(awning,w+.1,1.1,3.80,.4);
    }
    if(porch){
      const canopy=new THREE.Group();canopy.position.set(0,0,front+.62);p.add(canopy);
      fullRoof(canopy,w-.3,1.2,2.45,.45);
      for(const xx of [-w/2+.3,w/2-.3])box(canopy,timber,xx,1.4,.6,.11,2.8,.11);
      box(canopy,timber,0,2.35,.63,w-.5,.15,.14);
    }
    lantern(p,-w*.34,two?2.6:2.65,front+.6,lights.length<5 && variant%2===0);
    if(variant%3===0)lantern(p,w*.34,2.65,front+.6,false);
    // Everyday scale: clay planters, stools and a slender bamboo washing pole.
    const pot=mesh(new THREE.CylinderGeometry(.21,.16,.30,9),terracotta,p,w/2+.32,.15,front-.45);
    mesh(new THREE.IcosahedronGeometry(.34,1),leafMat,p,w/2+.31,.53,front-.45);
    if(variant%2===0){box(p,timberLight,-w/2-.25,.52,front-.5,.75,.10,.31);for(let a of [-1,1])box(p,timber,-w/2-.25+a*.27,.27,front-.5,.06,.50,.21);}
    // Side elevations carry the same history as the waterside facade: shutters,
    // limewashed brick showing through near the ground, and a climbing vine.
    for(const sign of [-1,1]) {
      const side=new THREE.Group();side.position.x=sign*(w/2+.025);side.rotation.y=sign*Math.PI/2;p.add(side);
      if(two) {
        window(side,-d*.22,3.58,.04,.87,1.12,variant%3===0,variant+2);
        window(side,d*.22,3.58,.04,.87,1.12,variant%4===0,variant+1);
        box(side,timberLight,0,2.65,.03,d-.15,.095,.10);
      }
      window(side,d*.13,1.82,.045,1.06,1.12,variant%3===1,variant);
      // A shuttered service door on one side, set slightly away from center.
      if(sign<0 && variant%2===0) {
        box(side,timber,-d*.29,1.42,.055,.72,1.80,.11);
        for(let q=0;q<5;q++)box(side,timberLight,-d*.29-.29+q*.145,1.42,.12,.12,1.72,.035);
      }
      // Individual patches of weathered masonry leave most of the plaster quiet.
      for(let row=0;row<4;row++)for(let col=0;col<8;col++){
        if(rand()>.70-row*.14)continue;
        const bx=-d/2+.16+col*.30+(row%2)*.15;
        box(side,oldBrick,bx,.56+row*.17,.036,.275,.14,.025);
      }
      const vineX=sign>0?-d*.41:d*.40;
      const vinePoints=[];for(let j=0;j<=7;j++)vinePoints.push([vineX+Math.sin(j*1.2)*.12,.65+j*.28,.10]);
      tube(side,vinePoints,.012,timberLight,14);
      for(let j=0;j<25;j++){
        const vy=.74+rand()*1.85,vx=vineX+Math.sin(vy*5)*.13+(rand()-.5)*.45;
        const l=mesh(new THREE.IcosahedronGeometry(.075,0),vineMat,side,vx,vy,.12+rand()*.07);l.scale.set(1.25,.54,.28);l.rotation.z=rand()*Math.PI;
      }
      // Dark timber tie at the foot of the gable makes the roof feel constructed.
      box(side,timber,0,h-.13,.045,d+.08,.10,.11);
    }
    // Back facades remain finished when the camera is gently moved.
    const rear=new THREE.Group();rear.rotation.y=Math.PI;p.add(rear);window(rear,0,two?3.7:1.9,d/2+.03,1.04,1.1,false,variant);
    return p;
  }
  const configs=[
    {x:-9.65,z:9.8,w:5.8,d:5.5,h:4.55,angle:Math.PI/2+.012,variant:0,porch:true},
    {x:-9.25,z:-8.0,w:5.2,d:4.8,h:5.0,angle:Math.PI/2-.016,variant:1,balcony:true},
    {x:-10,z:-15.1,w:5.9,d:6.1,h:3.7,angle:Math.PI/2+.025,variant:2,porch:true},
    {x:-10.1,z:-23.2,w:6.6,d:5.5,h:4.5,angle:Math.PI/2-.015,variant:3},
    {x:-15.9,z:7.4,w:5.5,d:5.0,h:4.4,angle:Math.PI/2+.025,variant:4},
    {x:-16.1,z:-7.5,w:6.0,d:5.0,h:5.5,angle:Math.PI/2-.025,variant:5},
    {x:-16.6,z:-20.0,w:6.2,d:5.7,h:5.2,angle:Math.PI/2+.018,variant:6},
    {x:9.65,z:9.0,w:5.8,d:5.4,h:3.7,angle:-Math.PI/2+.018,variant:7,porch:true},
    {x:9.55,z:-8.1,w:5.6,d:5.0,h:4.6,angle:-Math.PI/2-.02,variant:8},
    {x:9.6,z:-15.6,w:5.3,d:5.2,h:3.5,angle:-Math.PI/2+.026,variant:9,porch:true},
    {x:10.3,z:-23.0,w:6.3,d:5.8,h:4.5,angle:-Math.PI/2-.015,variant:10},
    {x:16.2,z:-11.8,w:6.4,d:5.5,h:5.2,angle:-Math.PI/2+.025,variant:11},
    {x:17.0,z:-24.5,w:6.7,d:5.8,h:5.4,angle:-Math.PI/2-.015,variant:12},
    {x:-8.8,z:-35.3,w:5.0,d:4.6,h:3.35,angle:Math.PI/2+.025,variant:13},
    {x:8.9,z:-36.8,w:4.7,d:4.5,h:3.1,angle:-Math.PI/2-.020,variant:14},
    {x:-8.7,z:-43.7,w:4.8,d:4.3,h:3.0,angle:Math.PI/2-.018,variant:15},
    {x:8.6,z:-44.8,w:5.2,d:4.2,h:3.35,angle:-Math.PI/2+.018,variant:16},
    {x:-8.5,z:-51.8,w:4.4,d:4.0,h:2.8,angle:Math.PI/2+.023,variant:17},
    {x:8.7,z:-53.0,w:4.5,d:4.2,h:3.0,angle:-Math.PI/2-.025,variant:18},
  ];
  configs.forEach(house);
  // Batch all immobile geometry per material. Lanterns retain their pivots for a quiet breeze.
  houses.updateMatrixWorld(true);
  const batches=new Map();
  houses.traverse(o=>{
    if(!o.isMesh)return;
    let separate=false,p=o;while(p){if(p.userData.keepSeparate){separate=true;break;}p=p.parent;}if(separate)return;
    let g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);if(g.index)g=g.toNonIndexed();
    // Merge only standard position, normal and UV attributes across geometry types.
    for(const key of Object.keys(g.attributes))if(!['position','normal','uv'].includes(key))g.deleteAttribute(key);
    if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    const arr=batches.get(o.material)||[];arr.push(g);batches.set(o.material,arr);
  });
  for(const [material,geos]of batches){const g=mergeGeometries(geos,false);if(g){const m=new THREE.Mesh(g,material);m.castShadow=m.receiveShadow=true;group.add(m);}for(const geo of geos)geo.dispose();}
  for(const item of lanterns){item.mesh.updateWorldMatrix(true,false);const m=item.mesh.matrixWorld.clone();group.add(item.mesh);m.decompose(item.mesh.position,item.mesh.quaternion,item.mesh.scale);item.baseY=item.mesh.position.y;}
  // Discard the construction graph after batching to keep GPU resources bounded.
  houses.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
  scene?.add(group);
  return {group,lights,lanterns};
}
