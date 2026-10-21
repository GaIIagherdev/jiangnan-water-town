import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The crossing and its moored awning boat are modeled in world units.
export function createBridgeAndBoat({scene,random=Math.random}) {
  const group=new THREE.Group(); group.name='stone-bridge-and-boat'; scene.add(group);
  const batches=new Map();
  function batch(geometry,material,position=[0,0,0],rotation=[0,0,0],scale=[1,1,1]) {
    const m=new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...scale));
    const g=(geometry.index?geometry.toNonIndexed():geometry.clone()).applyMatrix4(m); if(!batches.has(material))batches.set(material,[]);batches.get(material).push(g);
  }
  const stoneCanvas=document.createElement('canvas');stoneCanvas.width=stoneCanvas.height=512;
  const ctx=stoneCanvas.getContext('2d');ctx.fillStyle='#a0a498';ctx.fillRect(0,0,512,512);
  for(let i=0;i<20000;i++) {const v=85+random()*105;ctx.fillStyle=`rgba(${v|0},${v+5|0},${v-5|0},${.025+random()*.11})`;const size=.4+random()*8;ctx.fillRect(random()*512,random()*512,size,size*.4);}
  for(let i=0;i<160;i++){ctx.fillStyle=`rgba(55,78,43,${random()*.09})`;ctx.beginPath();ctx.ellipse(random()*512,random()*512,4+random()*25,2+random()*6,random()*3,0,Math.PI*2);ctx.fill();}
  const stoneTexture=new THREE.CanvasTexture(stoneCanvas);stoneTexture.colorSpace=THREE.SRGBColorSpace;stoneTexture.wrapS=stoneTexture.wrapT=THREE.RepeatWrapping;stoneTexture.repeat.set(.5,.5);stoneTexture.anisotropy=4;
  const stone=new THREE.MeshStandardMaterial({color:0x9da397,map:stoneTexture,bumpMap:stoneTexture,bumpScale:.065,roughness:1});
  const stoneAlt=new THREE.MeshStandardMaterial({color:0x959b8f,map:stoneTexture,bumpMap:stoneTexture,bumpScale:.045,roughness:1});
  const coping=new THREE.MeshStandardMaterial({color:0xb3b6a4,map:stoneTexture,roughness:.92,bumpMap:stoneTexture,bumpScale:.025});
  const darkMortar=new THREE.LineBasicMaterial({color:0x354238,transparent:true,opacity:.5});
  const wood=new THREE.MeshStandardMaterial({color:0x392b20,roughness:.65});
  const woodLight=new THREE.MeshStandardMaterial({color:0x6c5136,roughness:.72});
  const woodDark=new THREE.MeshStandardMaterial({color:0x211e18,roughness:.82});
  const moss=new THREE.MeshStandardMaterial({color:0x42503b,roughness:1});
  const box=new THREE.BoxGeometry(1,1,1);
  const top=x=>.75+2.95*Math.cos(x/7.1*Math.PI/2);
  const underside=x=>-.12+2.90*Math.sqrt(Math.max(0,1-(x/6.3)**2));
  const arch=new THREE.Shape();arch.moveTo(-7.1,-.22);
  for(let i=0;i<=80;i++){const x=-7.1+i*14.2/80;arch.lineTo(x,top(x));}
  arch.lineTo(7.1,-.22);arch.lineTo(6.3,-.22);
  for(let i=0;i<=80;i++){const x=6.3-i*12.6/80;arch.lineTo(x,underside(x));}
  arch.lineTo(-6.3,-.22);arch.closePath();
  const archGeo=new THREE.ExtrudeGeometry(arch,{depth:2.7,bevelEnabled:false,curveSegments:32});
  batch(archGeo,stone,[0,0,-2.35]);
  // Wedge-cut voussoirs make the arch construction legible from both sides.
  for(const faceZ of [-2.39,.35]){
    for(let i=0;i<29;i++){
      const a=i/29*Math.PI+.004,b=(i+1)/29*Math.PI-.004;
      const s=new THREE.Shape();s.moveTo(6.3*Math.cos(a),-.12+2.9*Math.sin(a));
      s.lineTo(6.65*Math.cos(a),-.12+3.28*Math.sin(a));
      for(let j=1;j<=3;j++){const t=a+(b-a)*j/3;s.lineTo(6.65*Math.cos(t),-.12+3.28*Math.sin(t));}
      s.lineTo(6.3*Math.cos(b),-.12+2.9*Math.sin(b));
      for(let j=1;j<=3;j++){const t=b-(b-a)*j/3;s.lineTo(6.3*Math.cos(t),-.12+2.9*Math.sin(t));}s.closePath();
      batch(new THREE.ExtrudeGeometry(s,{depth:.045,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.008,bevelThickness:.008}),i%4===0?stoneAlt:coping,[0,0,faceZ]);
    }
  }
  // Shallow stone stairs rise evenly to the crown.
  for(let i=0;i<42;i++){
    const x0=-7.1+i*14.2/42,x1=-7.1+(i+1)*14.2/42,x=(x0+x1)/2;
    const y=Math.max(top(x0),top(x1));
    batch(box,i%7===0?stoneAlt:coping,[x,y-.025,-1],[0,0,0],[x1-x0-.012,.095,2.65]);
  }
  // Each parapet has a continuous low plinth, carved pillars and curved handrails.
  for(const z of [-2.22,.22]){
    const p=new THREE.Shape();
    for(let i=0;i<=80;i++){const x=-7.1+i*14.2/80;(i?p.lineTo(x,top(x)+.23):p.moveTo(x,top(x)+.23));}
    for(let i=80;i>=0;i--){const x=-7.1+i*14.2/80;p.lineTo(x,top(x)+.045);}p.closePath();
    batch(new THREE.ExtrudeGeometry(p,{depth:.18,bevelEnabled:false}),stoneAlt,[0,0,z-.09]);
    const pts=[];for(let i=0;i<=60;i++){const x=-7.1+i*14.2/60;pts.push(new THREE.Vector3(x,top(x)+.94,z));}
    batch(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),96,.074,5,false),coping);
    for(let i=0;i<=20;i++){
      const x=-7.1+i*14.2/20,y=top(x);
      batch(box,stoneAlt,[x,y+.5,z],[0,0,0],[.145,.82,.17]);
      batch(box,coping,[x,y+.12,z],[0,0,0],[.23,.17,.25]);
      batch(box,coping,[x,y+.96,z],[0,0,0],[.23,.12,.25]);
      batch(new THREE.SphereGeometry(.11,6,4),stone,[x,y+1.075,z],[0,0,0],[1,.84,1]);
    }
  }
  // Masonry joints follow only the spandrel, preserving the open arch.
  const joints=[];
  for(const z of [-2.396,.404]){
    for(let y=.22;y<3.65;y+=.31){
      let last=null;
      for(let x=-7.05;x<7.08;x+=.04){
        const inside=y<top(x)-.07 && (Math.abs(x)>6.65 || y>-.12+3.28*Math.sqrt(Math.max(0,1-(x/6.65)**2))+.025);
        if(inside&&last!==null)joints.push(last,y,z,x,y,z);last=inside?x:null;
      }
    }
    for(let row=0;row<11;row++){
      const y0=.22+row*.31,y1=y0+.31;
      for(let x=-7+(row%2)*.46;x<7;x+=.92){
        if(y1<top(x)-.05&&(Math.abs(x)>6.65||y0>-.12+3.28*Math.sqrt(Math.max(0,1-(x/6.65)**2))+.04))joints.push(x,y0,z,x,y1,z);
      }
    }
  }
  const jg=new THREE.BufferGeometry();jg.setAttribute('position',new THREE.Float32BufferAttribute(joints,3));group.add(new THREE.LineSegments(jg,darkMortar));
  // Moss clings to damp abutments and bridge feet.
  for(const side of [-1,1]){
    for(let k=0;k<18;k++){
      const x=side*(6.35+random()*.7),z=-2.41+random()*2.85;
      batch(new THREE.IcosahedronGeometry(.11+random()*.1,0),moss,[x,.18+random()*.18,z],[0,random()*3,0],[1,.4,1]);
    }
    for(let n=0;n<3;n++)batch(box,stone,[side*(7.25+n*.36),.56-n*.025,-1],[0,0,0],[.45,.17,2.85]);
  }
  for(const [mat,geos] of batches){const mesh=new THREE.Mesh(mergeGeometries(geos,false),mat);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);for(const g of geos)g.dispose();}batches.clear();

  // A traditional covered skiff: a narrow, curved open hull with raised ends.
  const boat=new THREE.Group();boat.name='moored-wupeng-boat';boat.position.set(-3.25,.16,8);boat.rotation.y=-.13;group.add(boat);
  const boatBatch=new Map();
  function addB(geo,mat,pos=[0,0,0],rot=[0,0,0],scale=[1,1,1]){
    const g=(geo.index?geo.toNonIndexed():geo.clone()).applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...pos),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),new THREE.Vector3(...scale)));if(!boatBatch.has(mat))boatBatch.set(mat,[]);boatBatch.get(mat).push(g);
  }
  function hullWidth(t){return Math.pow(Math.max(0,1-t*t),.66)*.86+.012;}
  function hullTop(t){return .31+.36*Math.pow(Math.abs(t),3);}
  function hullBottom(t){return -.25+.64*Math.pow(Math.abs(t),3);}
  // Continuous clinker-built strips along the curved sides.
  for(const side of [-1,1]){
    for(let band=0;band<5;band++){
      const vertices=[],uv=[],indices=[];
      for(let j=0;j<=48;j++){
        const t=-1+j/24,z=t*2.65,w=hullWidth(t),bottom=hullBottom(t),topY=hullTop(t);
        for(let e=0;e<2;e++){
          const r=(band+e)/5;vertices.push(side*w*(.55+.45*r),bottom+(topY-bottom)*r,z);uv.push(j/6,r);
        }
      }
      for(let j=0;j<48;j++){const a=j*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
      const stripMat=band%2===0?wood:woodLight;stripMat.side=THREE.DoubleSide;addB(g,stripMat);
    }
    const rim=[];for(let j=0;j<=48;j++){const t=-1+j/24;rim.push(new THREE.Vector3(side*hullWidth(t),hullTop(t)+.025,t*2.65));}
    addB(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim),64,.045,6,false),woodDark);
    const inner=[];for(let j=0;j<=48;j++){const t=-1+j/24;inner.push(new THREE.Vector3(side*hullWidth(t)*.87,hullTop(t)-.09,t*2.65));}
    addB(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(inner),64,.025,5,false),woodLight);
  }
  for(let i=0;i<25;i++){
    const z=-2.2+i*.182,t=z/2.65,width=hullWidth(t)*1.7;
    addB(box,i%4===0?wood:woodLight,[0,.06+.24*Math.abs(t)**4,z],[0,0,0],[width,.07,.17]);
  }
  for(const z of [-1.9,1.15,1.8])addB(box,woodDark,[0,.27,z],[0,0,0],[hullWidth(z/2.65)*1.9,.085,.23]);
  // Woven bamboo canopy, warm and softly weathered.
  const bambooCanvas=document.createElement('canvas');bambooCanvas.width=256;bambooCanvas.height=256;const bc=bambooCanvas.getContext('2d');
  bc.fillStyle='#97825a';bc.fillRect(0,0,256,256);
  for(let y=0;y<256;y+=4){bc.fillStyle=`rgba(49,40,24,${.13+random()*.12})`;bc.fillRect(0,y,256,1);}
  for(let x=0;x<256;x+=12){bc.fillStyle='rgba(49,40,24,.18)';bc.fillRect(x,0,1,256);}
  for(let i=0;i<1200;i++){bc.fillStyle=`rgba(206,189,135,${random()*.12})`;bc.fillRect(random()*256,random()*256,1+random()*9,1);}
  const bambooMap=new THREE.CanvasTexture(bambooCanvas);bambooMap.colorSpace=THREE.SRGBColorSpace;bambooMap.wrapS=bambooMap.wrapT=THREE.RepeatWrapping;bambooMap.repeat.set(2,2);bambooMap.anisotropy=4;
  const bamboo=new THREE.MeshStandardMaterial({color:0xc5b891,map:bambooMap,side:THREE.DoubleSide,roughness:.96,bumpMap:bambooMap,bumpScale:.03});
  const canopyPos=[],canopyUV=[],canopyIdx=[];
  for(let j=0;j<=24;j++){
    const theta=j/24*Math.PI;
    for(let k=0;k<2;k++){canopyPos.push(Math.cos(theta)*.79,.39+Math.sin(theta)*.93,-1.45+k*2.25);canopyUV.push(j/24,k);}
  }
  for(let j=0;j<24;j++){const a=j*2;canopyIdx.push(a,a+2,a+1,a+1,a+2,a+3);}
  const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.Float32BufferAttribute(canopyPos,3));cg.setAttribute('uv',new THREE.Float32BufferAttribute(canopyUV,2));cg.setIndex(canopyIdx);cg.computeVertexNormals();addB(cg,bamboo);
  for(let i=0;i<=9;i++){
    const z=-1.47+i*2.29/9,ps=[];for(let j=0;j<=24;j++){const theta=j/24*Math.PI;ps.push(new THREE.Vector3(Math.cos(theta)*.803,.39+Math.sin(theta)*.946,z));}
    addB(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ps),32,i===0||i===9?.035:.012,5,false),i===0||i===9?woodDark:woodLight);
  }
  for(const side of [-1,1])addB(box,woodDark,[side*.77,.39,-.325],[0,0,0],[.065,.07,2.4]);
  // Long sweep oar laid diagonally across the stern.
  const oarA=new THREE.Vector3(-.57,.41,1.25),oarB=new THREE.Vector3(1.24,.49,3.4),od=new THREE.Vector3().subVectors(oarB,oarA);
  const oarMesh=new THREE.Mesh(new THREE.CylinderGeometry(.025,.033,od.length(),6),woodLight);oarMesh.position.copy(oarA).add(oarB).multiplyScalar(.5);oarMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),od.clone().normalize());boat.add(oarMesh);
  const blade=new THREE.Mesh(new THREE.BoxGeometry(.18,.035,.65),woodLight);blade.position.copy(oarB);blade.rotation.y=.69;boat.add(blade);
  // A single paper lantern on the bow lights the planks and water.
  addB(new THREE.CylinderGeometry(.022,.024,.88,6),woodDark,[-.52,.79,1.46]);
  addB(new THREE.CylinderGeometry(.021,.021,.38,6),woodDark,[-.36,1.23,1.46],[0,0,Math.PI/2]);
  const lanternMat=new THREE.MeshStandardMaterial({color:0xffc27a,emissive:0xff8a27,emissiveIntensity:2.5,roughness:.65});
  const lantern=new THREE.Mesh(new THREE.SphereGeometry(.16,16,12),lanternMat);lantern.scale.set(1,1.3,1);lantern.position.set(-.21,1.03,1.46);boat.add(lantern);
  const lanternRibMat=new THREE.MeshStandardMaterial({color:0x5c3c21,roughness:.8});
  addB(new THREE.CylinderGeometry(.09,.09,.04,10),lanternRibMat,[-.21,1.25,1.46]);addB(new THREE.CylinderGeometry(.085,.085,.05,10),lanternRibMat,[-.21,.81,1.46]);
  const glow=new THREE.PointLight(0xffad57,9,4.2,2);glow.position.set(-.21,1.03,1.46);boat.add(glow);
  for(const [mat,geos] of boatBatch){const mesh=new THREE.Mesh(mergeGeometries(geos,false),mat);mesh.castShadow=true;mesh.receiveShadow=true;boat.add(mesh);for(const g of geos)g.dispose();}
  // Coiled rope at the foredeck.
  const ropeMat=new THREE.MeshStandardMaterial({color:0x8b805b,roughness:1});
  const ropePts=[];for(let i=0;i<160;i++){const a=i/159*Math.PI*8,r=.08+i/159*.14;ropePts.push(new THREE.Vector3(.28+Math.cos(a)*r,.12+Math.sin(a*.8)*.008,1.6+Math.sin(a)*r));}
  boat.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ropePts),160,.013,4,false),ropeMat));
  const moorPts=[new THREE.Vector3(-3.9,.36,9.8),new THREE.Vector3(-4.8,.22,10.2),new THREE.Vector3(-6.12,.67,10.5)];
  group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(moorPts),24,.018,4,false),ropeMat));
  const moorPost=new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,.76,7),woodDark);moorPost.position.set(-6.12,.82,10.5);moorPost.castShadow=true;group.add(moorPost);
  // A quiet passer-by gives the stone crossing a human scale.
  const figure=new THREE.Group();figure.position.set(-1.7,top(-1.7)+.075,-.75);figure.rotation.y=.28;group.add(figure);
  const cloth=new THREE.MeshStandardMaterial({color:0x343f3c,roughness:1});
  const darkCloth=new THREE.MeshStandardMaterial({color:0x252d2b,roughness:1});
  const skin=new THREE.MeshStandardMaterial({color:0xb59c7a,roughness:1});
  const hair=new THREE.MeshStandardMaterial({color:0x20201b,roughness:.85});
  function figurePart(geo,mat,pos,scale=[1,1,1]){const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;figure.add(m);return m;}
  figurePart(new THREE.CylinderGeometry(.14,.21,.72,8),cloth,[0,.82,0],[1,1,.68]);
  figurePart(new THREE.CylinderGeometry(.068,.045,.48,6),darkCloth,[-.075,.26,0]);
  figurePart(new THREE.CylinderGeometry(.068,.045,.48,6),darkCloth,[.075,.26,.015]);
  figurePart(new THREE.SphereGeometry(.075,6,4),darkCloth,[-.075,.05,.025],[.8,.65,1.5]);
  figurePart(new THREE.SphereGeometry(.075,6,4),darkCloth,[.075,.05,.045],[.8,.65,1.5]);
  figurePart(new THREE.SphereGeometry(.115,10,8),skin,[0,1.31,0],[.86,1.12,.9]);
  figurePart(new THREE.SphereGeometry(.111,10,8),hair,[0,1.365,-.023],[.9,.65,1]);
  const arm=figurePart(new THREE.CylinderGeometry(.058,.045,.37,6),cloth,[.19,1.04,.06]);arm.rotation.z=.7;
  figurePart(new THREE.SphereGeometry(.038,8,5),skin,[.29,1.15,.06]);
  figurePart(new THREE.CylinderGeometry(.012,.012,1.2,6),woodDark,[.29,1.25,.06]);
  const umbrellaMat=new THREE.MeshStandardMaterial({color:0xb39259,side:THREE.DoubleSide,roughness:.95});
  const up=[],ui=[],uuv=[];
  for(let ring=0;ring<3;ring++){
    const r=[.001,.34,.62][ring],y=[1.89,1.82,1.66][ring];
    for(let k=0;k<=24;k++){const a=k/24*Math.PI*2;up.push(.29+Math.cos(a)*r,y,.06+Math.sin(a)*r);uuv.push(k/24,ring/2);}
  }
  for(let r=0;r<2;r++)for(let k=0;k<24;k++){const a=r*25+k;ui.push(a,a+25,a+1,a+1,a+25,a+26);}
  const ug=new THREE.BufferGeometry();ug.setAttribute('position',new THREE.Float32BufferAttribute(up,3));ug.setAttribute('uv',new THREE.Float32BufferAttribute(uuv,2));ug.setIndex(ui);ug.computeVertexNormals();figurePart(ug,umbrellaMat,[0,0,0]);
  const ribLines=[];for(let k=0;k<12;k++){const a=k/12*Math.PI*2;ribLines.push(.29,1.885,.06,.29+Math.cos(a)*.34,1.815,.06+Math.sin(a)*.34,.29+Math.cos(a)*.34,1.815,.06+Math.sin(a)*.34,.29+Math.cos(a)*.62,1.655,.06+Math.sin(a)*.62);}
  const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(ribLines,3));figure.add(new THREE.LineSegments(rg,new THREE.LineBasicMaterial({color:0x756748})));
  function update(time){boat.position.y=.16+Math.sin(time*.62)*.024;boat.rotation.z=Math.sin(time*.47)*.009;boat.rotation.x=Math.sin(time*.36+.8)*.008;}
  return {group,boat,update};
}
