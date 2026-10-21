import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A shared, material-batched kit. Clones borrow geometry and textures from this owner.
export function createGameAssets() {
  let state = 731109;
  const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  const textures = [];
  function texture(kind) {
    const canvas=document.createElement('canvas'); canvas.width=canvas.height=256;
    const c=canvas.getContext('2d');
    const colors={wall:'#d3d0bb',roof:'#485950',wood:'#7c6348',stone:'#9a9f8d',bamboo:'#aaa079'};
    c.fillStyle=colors[kind]; c.fillRect(0,0,256,256);
    for(let i=0;i<7000;i++){c.fillStyle=`rgba(${kind==='wall'?'51,62,47':'22,30,22'},${random()*.10})`;c.fillRect(random()*256,random()*256,1+random()*3,1+random()*3);}
    if(kind==='wall'){
      const wash=c.createLinearGradient(0,0,0,256);wash.addColorStop(0,'rgba(40,60,43,.26)');wash.addColorStop(.25,'rgba(40,60,43,0)');wash.addColorStop(.72,'rgba(40,60,43,0)');wash.addColorStop(1,'rgba(40,60,43,.34)');c.fillStyle=wash;c.fillRect(0,0,256,256);
      for(let i=0;i<45;i++){c.fillStyle=`rgba(64,77,52,${random()*.08})`;c.fillRect(random()*256,random()*256,1+random()*4,15+random()*60);}
    } else if(kind==='roof'){
      for(let y=0;y<256;y+=32){c.fillStyle='rgba(10,22,19,.42)';c.fillRect(0,y,256,2);c.fillStyle='rgba(191,200,164,.14)';c.fillRect(0,y+2,256,1);}
      for(let x=0;x<256;x+=22){c.fillStyle='rgba(5,16,12,.20)';c.fillRect(x,0,1,256);}
    } else if(kind==='wood'||kind==='bamboo'){
      for(let x=0;x<256;x+=kind==='wood'?3:8){c.strokeStyle=`rgba(30,28,15,${.05+random()*.15})`;c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+4,80,x-3,150,x,256);c.stroke();}
      if(kind==='bamboo')for(let y=0;y<256;y+=12){c.fillStyle='rgba(45,40,23,.12)';c.fillRect(0,y,256,1);}
    } else {
      for(let row=0;row<8;row++){const y=row*32; c.fillStyle='rgba(31,48,33,.23)';c.fillRect(0,y,256,1);for(let x=(row%2)*32;x<256;x+=64)c.fillRect(x,y,1,32);}
    }
    const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;textures.push(t);return t;
  }
  const wallMap=texture('wall'),roofMap=texture('roof'),woodMap=texture('wood'),stoneMap=texture('stone'),bambooMap=texture('bamboo');
  const standard=(options)=>new THREE.MeshStandardMaterial({roughness:.92,...options});
  const materials={
    plaster:standard({color:0xf0eddc,map:wallMap}),
    roof:standard({color:0x65776e,map:roofMap,roughness:.78}),
    wood:standard({color:0x554435,map:woodMap}),
    stone:standard({color:0xa3ac9b,map:stoneMap,bumpMap:stoneMap,bumpScale:.035}),
    quay:standard({color:0x9aab9c,map:stoneMap}),
    ground:standard({color:0x5b7257,map:stoneMap}),
    leaf:standard({color:0x738d4d,side:THREE.DoubleSide}),
    willowLeaf:standard({color:0x729b78,roughness:.86,side:THREE.DoubleSide}),
    bamboo:standard({color:0x758d51}),
    canopy:standard({color:0xbca477,map:bambooMap,side:THREE.DoubleSide}),
    glow:standard({color:0xffd092,emissive:0xffa13c,emissiveIntensity:1.4,roughness:.6}),
    glass:standard({color:0x263f35,roughness:.45}),
    cloth:standard({color:0x557c78}),
    dark:standard({color:0x253532}),
    skin:standard({color:0xcbb28d}),
    pearl:standard({color:0xc6e5cf,emissive:0x559b77,emissiveIntensity:.5,metalness:.15}),
  };
  const unitBox=new THREE.BoxGeometry(1,1,1);
  const identity=new THREE.Matrix4();
  const templates={houses:[]};
  const allGeometry=new Set([unitBox]);
  function builder(){
    const batches=new Map();
    function put(geometry,material,p=[0,0,0],r=[0,0,0],s=[1,1,1]){
      const g=(geometry.index?geometry.toNonIndexed():geometry.clone());
      g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p),new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),new THREE.Vector3(...s)));
      for(const key of Object.keys(g.attributes))if(!['position','normal','uv'].includes(key))g.deleteAttribute(key);
      if(!g.attributes.normal)g.computeVertexNormals();
      if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
      if(!batches.has(material))batches.set(material,[]);batches.get(material).push(g);
      if(geometry!==unitBox)allGeometry.add(geometry);
    }
    function box(mat,p,s,r=[0,0,0]){put(unitBox,mat,p,r,s);}
    function tube(points,radius,mat,segments=6,sides=4){put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments,radius,sides,false),mat);}
    function finish(name){const group=new THREE.Group();group.name=name;for(const [mat,gs]of batches){const g=mergeGeometries(gs,false);gs.forEach(x=>x.dispose());allGeometry.add(g);const m=new THREE.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;group.add(m);}return group;}
    return{put,box,tube,finish};
  }
  function roof(b,w,d,y,lift=1.12){
    const hw=w/2+.36,hd=d/2+.37;
    const ry=(u,x)=>y+lift*(1-u)+.26*u*u*u+.12*Math.pow(Math.abs(x)/hw,8)*u;
    for(const side of[-1,1]){
      const p=[],uv=[],ids=[],nx=6,nz=8;
      for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const u=j/nz,x=(i/nx-.5)*hw*2;p.push(x,ry(u,x),u*hd*side);uv.push(i/nx*2,u);}
      for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,c=a+nx+1;side>0?ids.push(a,c,a+1,a+1,c,c+1):ids.push(a,a+1,c,a+1,c+1,c);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ids);g.computeVertexNormals();b.put(g,materials.roof);
      const count=Math.round(w/.24);
      for(let i=0;i<=count;i++){const x=-hw+i/count*hw*2,points=[];for(let j=0;j<=5;j++){const u=j/5;points.push([x,ry(u,x)+.022,u*hd*side]);}b.tube(points,.021,materials.roof,5,3);}
      const eave=[];for(let i=0;i<=7;i++){const x=-hw+i/7*hw*2;eave.push([x,ry(1,x)+.015,hd*side]);}b.tube(eave,.065,materials.roof,8,4);
      for(const sign of[-1,1]){const points=[];for(let j=0;j<=5;j++){const u=j/5;points.push([sign*hw,ry(u,sign*hw),u*hd*side]);}b.tube(points,.054,materials.roof,6,4);}
      b.box(materials.wood,[0,y+.08,side*(d/2+.12)],[w+.45,.10,.28]);
    }
    const ridge=[];for(let i=0;i<=8;i++){const x=(i/8-.5)*(w+.9);ridge.push([x,y+lift+.08+.17*Math.pow(Math.abs(i/8-.5)*2,8),0]);}b.tube(ridge,.075,materials.roof,12,5);
    for(const sign of[-1,1]){
      const shape=new THREE.Shape();shape.moveTo(-d/2,0);shape.lineTo(d/2,0);shape.lineTo(0,lift);shape.closePath();
      b.put(new THREE.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:false}),materials.plaster,[sign*w/2,y,0],[0,Math.PI/2,0]);
    }
  }
  function window(b,x,y,z,w=.85,h=1.05,lit=true,rot=0){
    const tr=new THREE.Matrix4().makeRotationY(rot);const center=new THREE.Vector3(x,y,z);
    const box=(mat,p,s)=>{const pos=new THREE.Vector3(...p).applyMatrix4(tr).add(center);b.box(mat,pos.toArray(),s,[0,rot,0]);};
    box(materials.wood,[0,0,0],[w+.13,h+.13,.10]);box(lit?materials.glow:materials.glass,[0,0,.06],[w,h,.025]);
    for(let i=0;i<=4;i++)box(materials.wood,[-w/2+w*i/4,0,.083],[.028,h,.025]);
    for(let i=0;i<=4;i++)box(materials.wood,[0,-h/2+h*i/4,.083],[w,.028,.025]);
    box(materials.wood,[0,-h/2-.09,.08],[w+.25,.10,.18]);
  }
  function lantern(b,x,y,z,size=.18){
    b.put(new THREE.SphereGeometry(size,8,6),materials.glow,[x,y,z],[0,0,0],[1,1.35,1]);
    b.box(materials.wood,[x,y+size*1.8,z],[.021,size,.021]);
    for(const sign of[-1,1])b.put(new THREE.CylinderGeometry(size*.6,size*.6,.035,8),materials.wood,[x,y+sign*size*1.25,z]);
    b.box(materials.glow,[x,y-size*1.65,z],[.016,size*.55,.016]);
  }
  for(let kind=0;kind<6;kind++){
    const b=builder(),w=[4.7,5.0,4.6,5.2,4.8,5.1][kind],d=[4.5,4.6,4.8,4.4,4.9,4.6][kind],h=kind%3===1?5.1:3.25+kind*.09;
    b.box(materials.stone,[0,.18,0],[w+.1,.36,d+.1]);b.box(materials.plaster,[0,(h+.34)/2,0],[w,h-.34,d]);
    const front=d/2;
    for(const x of[-w/2+.08,w/2-.08])b.box(materials.wood,[x,h/2,front+.04],[.11,h,.11]);
    b.box(materials.wood,[0,h-.08,front+.05],[w,.12,.12]);
    b.box(materials.wood,[0,1.22,front+.06],[.91,1.85,.12]);
    for(let k=0;k<5;k++)b.box(materials.roof,[-.36+k*.18,1.22,front+.13],[.018,1.79,.02]);
    b.put(new THREE.SphereGeometry(.025,6,4),materials.canopy,[.26,1.2,front+.16]);
    for(const sign of[-1,1])window(b,sign*w*.31,1.65,front+.05,.83,1.05,(kind+sign)%3!==0);
    if(h>4.5){b.box(materials.wood,[0,2.65,front+.04],[w,.13,.13]);for(const x of[-w*.3,0,w*.3])window(b,x,3.65,front+.05,.84,1.1,kind%2===1);}
    for(const sign of[-1,1]){
      window(b,sign*(w/2+.015),1.7,d*.12,.83,1.02,kind%2===0,sign*Math.PI/2);
      if(h>4.5)window(b,sign*(w/2+.015),3.65,-d*.14,.76,1.0,kind%2!==0,sign*Math.PI/2);
      b.box(materials.roof,[sign*(w/2+.025),h+.36,0],[.025,.19,.25]);
      b.box(materials.wood,[sign*(w/2+.035),h-.09,0],[.07,.10,d]);
    }
    for(let n=0;n<2;n++)b.box(materials.stone,[0,.08+n*.12,front+.4-n*.11],[1.22,.14,.34]);
    roof(b,w,d,h,1.03+(kind%3)*.08);
    if(kind===0||kind===3){
      const y=2.46,z=front+.36; b.box(materials.roof,[0,y,z],[w-.1,.12,.73],[.13,0,0]);
      for(const x of[-w/2+.22,w/2-.22])b.box(materials.wood,[x,y/2,z+.23],[.09,y,.09]);
      b.box(materials.wood,[0,y-.09,z+.25],[w-.3,.10,.08]);
    }
    if(kind===1){b.box(materials.wood,[0,2.66,front+.32],[w,.13,.65]);for(let x=-w/2+.2;x<w/2;x+=.45)b.box(materials.wood,[x,3.0,front+.59],[.045,.65,.045]);b.box(materials.wood,[0,3.34,front+.59],[w,.07,.07]);}
    lantern(b,-w*.32,2.5,front+.37,.17);
    if(kind%2===0)lantern(b,w*.32,2.5,front+.37,.17);
    const group=b.finish(`home-${kind}`);group.userData.footprint={halfX:w/2+.12,halfZ:d/2+.75};templates.houses.push(group);
  }

  // A real open stone arch, with jointed wedge stones and light balustrades.
  {
    const b=builder(),top=x=>.6+2.4*Math.cos(x/6.6*Math.PI/2),under=x=>-.12+2.35*Math.sqrt(Math.max(0,1-(x/5.8)**2));
    const s=new THREE.Shape();s.moveTo(-6.6,-.25);for(let i=0;i<=40;i++){const x=-6.6+i*13.2/40;s.lineTo(x,top(x));}s.lineTo(6.6,-.25);s.lineTo(5.8,-.25);for(let i=0;i<=40;i++){const x=5.8-i*11.6/40;s.lineTo(x,under(x));}s.lineTo(-5.8,-.25);s.closePath();
    b.put(new THREE.ExtrudeGeometry(s,{depth:2.6,bevelEnabled:false}),materials.stone,[0,0,-1.3]);
    for(const side of[-1,1]){
      for(let i=0;i<22;i++){const a=i/22*Math.PI+.005,c=(i+1)/22*Math.PI-.005;const q=new THREE.Shape();q.moveTo(5.8*Math.cos(a),-.12+2.35*Math.sin(a));q.lineTo(6.14*Math.cos(a),-.12+2.69*Math.sin(a));q.lineTo(6.14*Math.cos(c),-.12+2.69*Math.sin(c));q.lineTo(5.8*Math.cos(c),-.12+2.35*Math.sin(c));q.closePath();b.put(new THREE.ExtrudeGeometry(q,{depth:.038,bevelEnabled:false}),materials.quay,[0,0,side*1.302-(side<0?.038:0)]);}
      const rail=[];for(let i=0;i<=32;i++){const x=-6.6+i*13.2/32;rail.push([x,top(x)+.81,side*1.20]);}b.tube(rail,.055,materials.quay,40,4);
      for(let i=0;i<=16;i++){const x=-6.6+i*13.2/16,y=top(x);b.box(materials.stone,[x,y+.4,side*1.20],[.13,.8,.16]);b.box(materials.quay,[x,y+.84,side*1.20],[.22,.09,.23]);}
    }
    for(let i=0;i<36;i++){const x0=-6.6+i*13.2/36,x1=x0+13.2/36;b.box(materials.quay,[(x0+x1)/2,Math.max(top(x0),top(x1))-.02,0],[x1-x0-.014,.065,2.55]);}
    templates.bridge=b.finish('stone-arch');
  }

  // Broad jade leaf sprays keep the hanging willow silhouette readable at a distance.
  {
    const b=builder();
    function limb(a,c,r1,r2){const pa=new THREE.Vector3(...a),pc=new THREE.Vector3(...c),v=pc.clone().sub(pa),p=pa.clone().add(pc).multiplyScalar(.5);const g=new THREE.CylinderGeometry(r2,r1,v.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));b.put(g,materials.wood,p.toArray());}
    limb([0,0,0],[-.12,2.2,.06],.28,.16);limb([-.12,2.2,.06],[.18,3.9,0],.16,.06);
    const leaf=new THREE.BufferGeometry();leaf.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.09,-.12,.018,0,-.28,0,.09,-.12,.018],3));leaf.setAttribute('uv',new THREE.Float32BufferAttribute([.5,0,0,.4,.5,1,1,.4],2));leaf.setIndex([0,1,2,0,2,3]);leaf.computeVertexNormals();
    for(let branch=0;branch<11;branch++){
      const a=branch/11*Math.PI*2,reach=2.15+random()*.65,y=3.7+random()*1.05;
      const tip=[Math.cos(a)*reach,y-.3,Math.sin(a)*reach];
      b.tube([[.1,2.8,0],[Math.cos(a)*reach*.55,y+.28,Math.sin(a)*reach*.55],tip],.035,materials.wood,6,4);
      // Open clusters around the upper branches soften the crown without solid foliage shells.
      for(let spray=0;spray<4;spray++){
        const t=.32+spray*.18,cx=Math.cos(a)*reach*t,cz=Math.sin(a)*reach*t,cy=3.35+(y-3.35)*t+.38*Math.sin(t*Math.PI);
        for(let k=0;k<16;k++){
          const angle=k/16*Math.PI*2+random()*.35,radius=.12+random()*.40;
          b.put(leaf,materials.willowLeaf,[cx+Math.cos(angle)*radius,cy+(random()-.4)*.32,cz+Math.sin(angle)*radius],[(random()-.5)*.8,angle,.55+random()*.9],[.9+random()*.35,1.1+random()*.5,1]);
        }
      }
      for(let sprig=0;sprig<6;sprig++){
        const sx=tip[0]+(random()-.5)*1.25,sz=tip[2]+(random()-.5)*1.25,sy=y+random()*.4,length=1.5+random()*1.6,lean=(random()-.5)*.5;
        b.tube([[sx,sy,sz],[sx+lean,sy-length*.55,sz+.10],[sx+lean*.6,sy-length,sz+.12]],.007,materials.wood,4,3);
        for(let n=0;n<14;n++){const t=n/13,px=sx+Math.sin(t*Math.PI)*lean,py=sy-t*length,pz=sz+t*.12;for(const sign of[-1,1])b.put(leaf,materials.willowLeaf,[px,py,pz],[.1,random()*6.28,sign*(.4+random()*.55)],[.65+random()*.4,.7+random()*.6,1]);}
      }
    }
    templates.willow=b.finish('weeping-willow');
  }
  {
    const b=builder();
    for(let stalk=0;stalk<7;stalk++){
      const x=(random()-.5)*1.7,z=(random()-.5)*1.7,h=3.2+random()*2.2;
      b.put(new THREE.CylinderGeometry(.035,.05,h,5),materials.bamboo,[x,h/2,z]);
      for(let y=.4;y<h;y+=.48)b.put(new THREE.CylinderGeometry(.055,.055,.04,5),materials.leaf,[x,y,z]);
      for(let y=h*.5;y<h;y+=.55)for(const sign of[-1,1]){
        const p=[x+sign*.5,y+.15,z+.1];b.tube([[x,y,z],p],.012,materials.bamboo,2,3);
        for(let j=0;j<6;j++){const g=new THREE.PlaneGeometry(.12,.6);b.put(g,materials.leaf,[p[0]+(random()-.5)*.75,y+(random()-.5)*.4,p[2]+(random()-.5)*.5],[0,random()*6.28,sign*.7],[1,1,1]);}
      }
    }
    templates.bamboo=b.finish('bamboo-grove');
  }
  {const b=builder();b.put(new THREE.DodecahedronGeometry(.65,0),materials.stone,[0,.2,0],[.12,.5,.1],[1,.7,.8]);templates.rock=b.finish('moss-stone');}
  {const b=builder();b.put(new THREE.CylinderGeometry(.32,.28,.06,12),materials.leaf,[0,.035,0]);for(let i=0;i<7;i++){const a=i/7*Math.PI*2;b.put(new THREE.SphereGeometry(.12,5,4),materials.glow,[Math.sin(a)*.09,.13,Math.cos(a)*.09],[.6*Math.cos(a),0,.6*Math.sin(a)],[.55,1,.5]);}templates.lotus=b.finish('lotus');}
  {const b=builder();b.box(materials.wood,[0,1.3,0],[.08,2.6,.08]);b.box(materials.wood,[.22,2.6,0],[.55,.07,.07]);lantern(b,.4,2.27,0,.2);templates.lantern=b.finish('wayside-lantern');}

  // Player boat. The forward deck remains open for the traveler.
  function makeBoat(){
    const b=builder(),length=1.85;
    const width=t=>.72*Math.pow(Math.max(0,1-t*t),.65)+.015;
    for(const side of[-1,1]){
      const p=[],uv=[],idx=[];
      for(let i=0;i<=28;i++){const t=-1+i/14,w=width(t),bottom=-.15+.44*Math.pow(Math.abs(t),3),top=.26+.32*Math.pow(Math.abs(t),3);p.push(side*w*.6,bottom,t*length,side*w,top,t*length);uv.push(i/8,0,i/8,1);}
      for(let i=0;i<28;i++){const a=i*2;side>0?idx.push(a,a+1,a+2,a+1,a+3,a+2):idx.push(a,a+2,a+1,a+1,a+2,a+3);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();b.put(g,materials.wood);
      const rim=[];for(let i=0;i<=28;i++){const t=-1+i/14;rim.push([side*width(t),.28+.32*Math.pow(Math.abs(t),3),t*length]);}b.tube(rim,.035,materials.canopy,28,4);
    }
    for(let i=0;i<20;i++){const z=-1.65+i*.17;b.box(materials.wood,[0,.04,z],[width(z/length)*1.73,.06,.16]);}
    for(const z of[-1.2,.5,1.2])b.box(materials.canopy,[0,.28,z],[width(z/length)*1.85,.065,.20]);
    const p=[],uv=[],ids=[];for(let i=0;i<=14;i++){const a=i/14*Math.PI;for(let j=0;j<2;j++){p.push(Math.cos(a)*.69,.31+Math.sin(a)*.79,-1.3+j*1.48);uv.push(i/14,j);}}
    for(let i=0;i<14;i++){const a=i*2;ids.push(a,a+2,a+1,a+1,a+2,a+3);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ids);g.computeVertexNormals();b.put(g,materials.canopy);
    for(let k=0;k<6;k++){const z=-1.31+k*.3,ps=[];for(let i=0;i<=12;i++){const a=i/12*Math.PI;ps.push([Math.cos(a)*.7,.31+Math.sin(a)*.8,z]);}b.tube(ps,.021,materials.wood,12,4);}
    b.box(materials.wood,[-.43,.75,1.2],[.025,.9,.025]);b.box(materials.wood,[-.28,1.18,1.2],[.34,.028,.028]);lantern(b,-.13,.98,1.2,.135);
    const group=b.finish('traveler-boat');group.userData.deck={x:0,y:.30,z:.85};return group;
  }
  templates.boat=makeBoat();

  function traveler(){
    const group=new THREE.Group();group.name='wanderer';const legs=[],arms=[];
    function add(parent,g,m,p,s=[1,1,1]){allGeometry.add(g);const mesh=new THREE.Mesh(g,m);mesh.position.set(...p);mesh.scale.set(...s);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
    add(group,new THREE.CylinderGeometry(.19,.29,.69,9),materials.cloth,[0,1.02,0],[1,1,.75]);
    add(group,new THREE.CylinderGeometry(.25,.22,.09,9),materials.canopy,[0,.76,0],[1,1,.74]);
    for(const sign of[-1,1]){
      const leg=new THREE.Group();leg.position.set(sign*.12,.74,0);group.add(leg);legs.push(leg);
      add(leg,new THREE.CylinderGeometry(.075,.06,.64,7),materials.dark,[0,-.31,0]);add(leg,new THREE.SphereGeometry(.09,7,5),materials.dark,[0,-.65,.055],[.9,.65,1.6]);
      const arm=new THREE.Group();arm.position.set(sign*.24,1.28,0);group.add(arm);arms.push(arm);
      add(arm,new THREE.CylinderGeometry(.085,.065,.49,7),materials.cloth,[0,-.21,0]);add(arm,new THREE.SphereGeometry(.059,7,5),materials.skin,[0,-.48,0]);
    }
    add(group,new THREE.CylinderGeometry(.075,.08,.13,8),materials.skin,[0,1.43,0]);
    add(group,new THREE.SphereGeometry(.17,12,8),materials.skin,[0,1.59,0],[.88,1,.88]);
    add(group,new THREE.SphereGeometry(.173,10,6),materials.dark,[0,1.65,-.023],[.9,.7,.9]);
    add(group,new THREE.ConeGeometry(.40,.19,16),materials.canopy,[0,1.78,0]);
    add(group,new THREE.CylinderGeometry(.41,.4,.025,16),materials.canopy,[0,1.686,0]);
    // A rolled blanket and small woven satchel give the explorer a readable silhouette.
    add(group,new THREE.CylinderGeometry(.13,.13,.43,8),materials.canopy,[0,1.05,-.24]).rotation.z=Math.PI/2;
    add(group,new THREE.BoxGeometry(.25,.32,.13),materials.wood,[.27,.82,-.08]);
    const scarf=add(group,new THREE.BoxGeometry(.1,.55,.025),materials.canopy,[-.09,1.06,.18]);scarf.rotation.z=-.12;
    return{group,legs,arms};
  }
  const collectibles=[];
  for(let type=0;type<6;type++){
    const b=builder();
    if(type===0){b.put(new THREE.SphereGeometry(.18,8,6),materials.glow,[0,.18,0],[0,0,0],[1,1.3,1]);b.box(materials.wood,[0,.44,0],[.03,.12,.03]);}
    if(type===1){for(let i=0;i<5;i++){const a=i/5*Math.PI*2;b.put(new THREE.SphereGeometry(.13,7,5),materials.pearl,[Math.cos(a)*.11,.18,Math.sin(a)*.11],[0,a,.5],[.65,1.4,.5]);}}
    if(type===2){b.put(new THREE.CylinderGeometry(.14,.22,.25,10),materials.pearl,[0,.13,0]);b.put(new THREE.TorusGeometry(.13,.018,5,10),materials.wood,[.18,.16,0],[0,Math.PI/2,0]);}
    if(type===3){b.box(materials.canopy,[0,.17,0],[.35,.11,.26]);for(const x of[-.19,.19])b.put(new THREE.CylinderGeometry(.045,.045,.30,6),materials.wood,[x,.17,0],[Math.PI/2,0,0]);}
    if(type===4){b.put(new THREE.ConeGeometry(.22,.2,10),materials.canopy,[0,.25,0]);b.box(materials.wood,[0,.1,0],[.02,.25,.02]);}
    if(type===5){b.put(new THREE.OctahedronGeometry(.2,0),materials.pearl,[0,.2,0],[0,0,.4],[.75,1.3,.75]);}
    collectibles.push(b.finish(`keepsake-${type}`));
  }
  const clone=object=>object.clone(true);
  return{
    templates,materials,
    house:kind=>clone(templates.houses[((kind||0)%6+6)%6]),
    willow:()=>clone(templates.willow),bamboo:()=>clone(templates.bamboo),bridge:()=>clone(templates.bridge),
    prop:kind=>clone(templates[kind]||templates.rock),boat:()=>clone(templates.boat),traveler,
    collectible:type=>clone(collectibles[((type||0)%6+6)%6]),
    dispose(){for(const g of allGeometry)g.dispose();for(const m of Object.values(materials))m.dispose();textures.forEach(t=>t.dispose());},
  };
}
