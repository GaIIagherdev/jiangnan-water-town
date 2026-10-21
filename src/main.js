import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Water } from 'three/addons/objects/Water.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createVillage } from './architecture.js';
import { createNature } from './nature.js';
import { createBridgeAndBoat } from './bridge.js';

const host = document.getElementById('world');
let seed = 1107;
function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
const clamp=THREE.MathUtils.clamp;
const mobile=matchMedia('(max-width:650px)').matches;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});}catch(e){document.getElementById('fallback').hidden=false;throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.5:1.8));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.15;
renderer.outputColorSpace=THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
renderer.domElement.setAttribute('aria-label','江南水乡。拖动旋转视角，滚轮缩放，点击水面产生涟漪。');
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x75908d);
scene.fog=new THREE.FogExp2(0x789390,0.013);
const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.2,450);
const startPos=new THREE.Vector3(2.8,8,30.5),startTarget=new THREE.Vector3(0,2,-8);
camera.position.copy(startPos);
const controls=new OrbitControls(camera,renderer.domElement);
controls.target.copy(startTarget);controls.enableDamping=true;controls.dampingFactor=.045;
controls.enablePan=false;controls.minDistance=25;controls.maxDistance=65;
controls.minPolarAngle=.75;controls.maxPolarAngle=1.39;
controls.minAzimuthAngle=-.65;controls.maxAzimuthAngle=.72;
controls.rotateSpeed=.38;controls.zoomSpeed=.55;controls.update();
const hemi=new THREE.HemisphereLight(0xb8d5d1,0x454b30,2.5);scene.add(hemi);
const ambient=new THREE.AmbientLight(0x708d91,.4);scene.add(ambient);
const sun=new THREE.DirectionalLight(0xffd9a2,3.3);sun.position.set(-17,27,12);sun.target.position.set(0,0,-4);scene.add(sun,sun.target);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-45;sun.shadow.camera.right=45;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;sun.shadow.camera.near=1;sun.shadow.camera.far=120;sun.shadow.bias=-.00015;sun.shadow.normalBias=.025;sun.shadow.radius=3;
const fill=new THREE.DirectionalLight(0x96d1dd,.65);fill.position.set(28,12,24);scene.add(fill);

// A continuous painted atmosphere, with distant warm haze below a cool sky.
const skyUniforms={time:{value:0},top:{value:new THREE.Color(0x294a57)},mid:{value:new THREE.Color(0x839b98)},horizon:{value:new THREE.Color(0xe6c99e)}};
const sky=new THREE.Mesh(new THREE.SphereGeometry(220,40,24),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:skyUniforms,vertexShader:`varying vec3 vWorld;void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vWorld;uniform vec3 top;uniform vec3 mid;uniform vec3 horizon;uniform float time;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float f=0.,a=.5;for(int i=0;i<5;i++){f+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.48;}return f;}
void main(){vec3 dir=normalize(vWorld);float h=dir.y;vec3 c=mix(horizon,mid,smoothstep(-.04,.28,h));c=mix(c,top,smoothstep(.17,.95,h));vec2 p=dir.xz/(max(h+.28,.1));p=p*vec2(1.5,4.)+vec2(time*.001,0.);float n=fbm(p*3.);float cloud=smoothstep(.40,.72,n)*smoothstep(.02,.18,h)*(1.-smoothstep(.55,.88,h));c=mix(c,mix(mid,horizon,.45)*1.1,cloud*.36);gl_FragColor=vec4(c,1.);}` }));scene.add(sky);
function radialTexture(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.13,'rgba(255,255,255,.8)');g.addColorStop(.4,'rgba(255,255,255,.14)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);}
const glowTex=radialTexture();
function moonTexture(){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#fff9e9';x.fillRect(0,0,256,256);for(let i=0;i<180;i++){const px=random()*256,py=random()*256,r=2+random()*16;const g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,`rgba(123,139,129,${.04+random()*.12})`);g.addColorStop(.7,'rgba(150,154,136,.03)');g.addColorStop(1,'rgba(150,154,136,0)');x.fillStyle=g;x.beginPath();x.arc(px,py,r,0,Math.PI*2);x.fill();}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
const moon=new THREE.Mesh(new THREE.SphereGeometry(2.25,32,24),new THREE.MeshBasicMaterial({color:0xffe8bd,map:moonTexture(),fog:false}));moon.position.set(-28,24,-100);scene.add(moon);
const moonGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xf7d0a0,transparent:true,opacity:.34,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));moonGlow.position.copy(moon.position);moonGlow.scale.set(22,22,1);scene.add(moonGlow);

function stoneTexture(){const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');ctx.fillStyle='#909383';ctx.fillRect(0,0,512,512);for(let i=0;i<35000;i++){const a=.01+random()*.075;ctx.fillStyle=random()>.47?`rgba(32,43,31,${a})`:`rgba(236,226,195,${a})`;const s=random()*5+.5;ctx.fillRect(random()*512,random()*512,s,s);}for(let i=0;i<120;i++){ctx.strokeStyle=`rgba(51,64,43,${random()*.12})`;ctx.lineWidth=random()*2;const x=random()*512,y=random()*512;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*45-22,y+random()*45-22);ctx.stroke();}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;return t;}
const stoneTex=stoneTexture();
const groundmat=new THREE.MeshStandardMaterial({color:0x52604b,roughness:1,map:stoneTex});
const quaymat=new THREE.MeshStandardMaterial({color:0x979b89,roughness:.95,map:stoneTex});
const wallmat=new THREE.MeshStandardMaterial({color:0x697b69,roughness:.98,map:stoneTex});
for(const side of[-1,1]){const land=new THREE.Mesh(new THREE.BoxGeometry(93,2.5,220),groundmat);land.position.set(side*52.5,-.72,-35);land.receiveShadow=true;scene.add(land);const quay=new THREE.Mesh(new THREE.BoxGeometry(2.5,.26,124),quaymat);quay.position.set(side*7.15,.5,-22);quay.receiveShadow=true;scene.add(quay);}
const dummy=new THREE.Object3D();
const wallBlocks=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.66,1.52),wallmat,320);
let wi=0;for(const side of[-1,1])for(let row=0;row<2;row++)for(let i=0;i<80;i++){dummy.position.set(side*6.13,-.37+row*.63,-80+i*1.55+(row%2)*.7);dummy.scale.set(.62+random()*.06,.9+random()*.08,1);dummy.rotation.set(0,(random()-.5)*.015,0);dummy.updateMatrix();wallBlocks.setMatrixAt(wi++,dummy.matrix);wallBlocks.setColorAt(wi-1,new THREE.Color().setHSL(.15+random()*.03,.08+random()*.12,.30+random()*.17));}wallBlocks.receiveShadow=true;wallBlocks.castShadow=true;scene.add(wallBlocks);
const paving=new THREE.InstancedMesh(new THREE.BoxGeometry(1.15,.035,1.38),quaymat,320);let pi=0;for(const side of[-1,1])for(let col=0;col<2;col++)for(let i=0;i<80;i++){dummy.position.set(side*(6.58+col*1.18),.655,-80+i*1.48+col*.4);dummy.scale.set(.96,1,.96);dummy.rotation.set(0,random()*.025,0);dummy.updateMatrix();paving.setMatrixAt(pi++,dummy.matrix);paving.setColorAt(pi-1,new THREE.Color().setHSL(.13,.055,.62+random()*.16));}paving.receiveShadow=true;scene.add(paving);
// Wet stone stairs descend to the canal in the spaces between the houses.
for(const [side,z]of[[-1,6],[1,-12],[-1,-17],[1,20]])for(let k=0;k<6;k++){const step=new THREE.Mesh(new THREE.BoxGeometry(.55,.2,2.3),quaymat);step.position.set(side*(5.65+k*.46),-.32+k*.17,z);step.receiveShadow=true;step.castShadow=true;scene.add(step);}

function waterNormals(){const n=256,c=document.createElement('canvas');c.width=c.height=n;const ctx=c.getContext('2d'),im=ctx.createImageData(n,n);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const u=x/n*Math.PI*2,v=y/n*Math.PI*2;const dx=Math.sin(u*4+Math.sin(v*3))*.32+Math.cos(u*13-v*7)*.15+Math.sin(u*29+v*17)*.075;const dy=Math.cos(v*5+Math.sin(u*3))*.32+Math.sin(v*11-u*9)*.15+Math.cos(v*31+u*19)*.07;const m=new THREE.Vector3(dx,dy,1).normalize();const o=(y*n+x)*4;im.data[o]=(m.x*.5+.5)*255;im.data[o+1]=(m.y*.5+.5)*255;im.data[o+2]=(m.z*.5+.5)*255;im.data[o+3]=255;}ctx.putImageData(im,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
const water=new Water(new THREE.PlaneGeometry(240,300),{textureWidth:mobile?768:1536,textureHeight:mobile?768:1536,waterNormals:waterNormals(),sunDirection:sun.position.clone().normalize(),sunColor:0xffe0b0,waterColor:0x173f37,distortionScale:.72,fog:true});
water.rotation.x=-Math.PI/2;water.position.y=.015;water.material.uniforms.size.value=8;
// Fine running ripples sit below broad, slow reflection undulations.
water.material.fragmentShader=water.material.fragmentShader.replace('float rf0 = 0.3;','float rf0 = 0.40;').replace('vec3( 1.5, 1.0, 1.5 )','vec3( 0.48, 1.0, 0.48 )');
scene.add(water);
const village=createVillage({scene,random});
const nature=createNature({scene,random});
const bridge=createBridgeAndBoat({scene,random});
const warmLights=[];scene.traverse(o=>{if(o.isPointLight)warmLights.push({light:o,intensity:o.intensity});if(o.isMesh&&o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{if(m.map)m.map.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);});}});

// Warm scattered motes are sparse, tucked into the water's edge.
const moteCount=90,motePos=new Float32Array(moteCount*3),moteSeed=[];
for(let i=0;i<moteCount;i++){moteSeed.push({x:(random()>.5?1:-1)*(4.2+random()*3.7),y:.6+random()*3.3,z:-26+random()*52,p:random()*Math.PI*2,s:.3+random()*.5});}
const motesGeo=new THREE.BufferGeometry();motesGeo.setAttribute('position',new THREE.BufferAttribute(motePos,3));
const motes=new THREE.Points(motesGeo,new THREE.PointsMaterial({color:0xffdda0,size:.075,map:glowTex,transparent:true,opacity:.75,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(motes);
// Narrow floating leaves establish the scale and current of the canal.
const petals=new THREE.InstancedMesh(new THREE.PlaneGeometry(.12,.055),new THREE.MeshStandardMaterial({color:0xcba571,roughness:.6,side:THREE.DoubleSide}),70);const petalSeed=[];for(let i=0;i<70;i++)petalSeed.push({x:(random()-.5)*10.5,z:random()*85-45,r:random()*Math.PI*2});scene.add(petals);
const ripples=[];const rippleMat=new THREE.MeshBasicMaterial({color:0xb5d7cb,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false});const rippleGeo=new THREE.RingGeometry(.98,1,90);for(let i=0;i<12;i++){const m=new THREE.Mesh(rippleGeo,rippleMat.clone());m.rotation.x=-Math.PI/2;m.visible=false;scene.add(m);ripples.push({mesh:m,start:-100,delay:0});}
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),waterPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-.035),hit=new THREE.Vector3();let pointerDown=null;
renderer.domElement.addEventListener('pointerdown',e=>{pointerDown={x:e.clientX,y:e.clientY,time:performance.now()};});
renderer.domElement.addEventListener('pointerup',e=>{if(reduced||!pointerDown||Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>5)return;pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);if(raycaster.ray.intersectPlane(waterPlane,hit)&&Math.abs(hit.x)<5.8){let n=0;for(const r of ripples)if(totalTime-r.start>5&&n<3){r.mesh.position.copy(hit);r.start=totalTime;r.delay=n*.35;r.mesh.visible=true;n++;}}});

const renderTarget=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:4});
// A few swallows and low valley vapour make the quiet scene feel inhabited.
const starPos=[];for(let i=0;i<160;i++){const az=random()*Math.PI*2,el=.24+random()*.95;starPos.push(Math.sin(az)*Math.cos(el)*190,Math.sin(el)*190,Math.cos(az)*Math.cos(el)*190);}const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPos,3));const starMat=new THREE.PointsMaterial({color:0xd5e9e1,size:.17,transparent:true,opacity:0,depthWrite:false,fog:false,map:glowTex,blending:THREE.AdditiveBlending});const stars=new THREE.Points(starGeo,starMat);scene.add(stars);
const birds=[];const birdMat=new THREE.MeshBasicMaterial({color:0x344e4d,fog:true,side:THREE.DoubleSide});
const wingGeo=new THREE.BufferGeometry();wingGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.44,.025,-.06,.68,0,-.28,.31,0,-.14],3));wingGeo.setIndex([0,1,3,1,2,3]);wingGeo.computeVertexNormals();
for(let i=0;i<7;i++){const g=new THREE.Group();const l=new THREE.Mesh(wingGeo,birdMat),r=new THREE.Mesh(wingGeo,birdMat);r.scale.x=-1;g.add(l,r);g.position.set(-19+i*2.4,10.5+Math.sin(i*1.3)*.9,-48-i*1.5);g.scale.setScalar(.75);scene.add(g);birds.push({group:g,l,r,x:g.position.x,y:g.position.y,z:g.position.z,phase:i*1.7});}
const vapours=[];
for(let i=0;i<8;i++){const mist=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xc0d6ca,transparent:true,opacity:.08,depthWrite:false,depthTest:true,fog:true}));mist.position.set((random()-.5)*8,.3+random()*.6,-7-i*7);mist.scale.set(13+random()*8,1+random()*.7,1);scene.add(mist);vapours.push({mesh:mist,x:mist.position.x,p:random()*6});}
function updateAtmosphere(t){for(const b of birds){b.group.position.x=b.x+Math.sin(t*.035+b.phase)*3;b.group.position.y=b.y+Math.sin(t*.3+b.phase)*.18;b.l.rotation.z=Math.sin(t*3.8+b.phase)*.35;b.r.rotation.z=-b.l.rotation.z;}for(const v of vapours){v.mesh.position.x=v.x+Math.sin(t*.07+v.p)*1.8;v.mesh.material.opacity=activeMood==='dawn'?.14:.075;}}

const composer=new EffectComposer(renderer,renderTarget);
composer.addPass(new RenderPass(scene,camera));
const ssao=new SSAOPass(scene,camera,innerWidth,innerHeight,16);ssao.kernelRadius=.7;ssao.minDistance=.00015;ssao.maxDistance=.015;composer.addPass(ssao);
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.32,.65,1.02);composer.addPass(bloom);
composer.addPass(new OutputPass());
const finish=new ShaderPass({uniforms:{tDiffuse:{value:null},time:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D tDiffuse;uniform float time;varying vec2 vUv;float rand(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float vig=1.-.24*pow(length((vUv-.5)*vec2(1.,.8)),1.35);c*=vig;c+=(rand(vUv*1300.+fract(time)*100.)-.5)*.012;gl_FragColor=vec4(c,1.);}`});composer.addPass(finish);composer.setSize(innerWidth,innerHeight);
const moods={dusk:{fog:0x6c8c83,density:.010,top:0x274f5a,mid:0x93a8a0,horizon:0xf0c497,key:0xffce8b,keyI:3.8,hemi:0xadcbd0,hemiI:1.8,fill:.75,water:0x173f37,sun:0xffdca0,exposure:1.08,bloom:.32,moon:0xffe8bd,glow:.34,lantern:1,verse:'一水绕人家，半城烟与柳。'},night:{fog:0x274a59,density:.012,top:0x0a1a35,mid:0x375568,horizon:0x789598,key:0xa8cce8,keyI:1.2,hemi:0x8daacb,hemiI:1.6,fill:.23,water:0x14333d,sun:0x99cbe0,exposure:1,bloom:.5,moon:0xe4f5ee,glow:.5,lantern:1.65,verse:'人间灯火暖，一棹入江南。'},dawn:{fog:0xb7c5ba,density:.020,top:0x789ca3,mid:0xc0d0c3,horizon:0xf7deb3,key:0xffe4b9,keyI:3.7,hemi:0xe5ebe0,hemiI:3.1,fill:.65,water:0x51756b,sun:0xfff0d5,exposure:1.25,bloom:.24,moon:0xffeecb,glow:.2,lantern:.45,verse:'一溪新雨后，万物尚含烟。'}};
let targetMood=moods.night,activeMood='night';
function setMood(key){activeMood=key;targetMood=moods[key];document.querySelectorAll('.scene-choice').forEach(b=>{const on=b.dataset.scene===key;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});document.getElementById('verse').textContent=targetMood.verse;}
setMood('night');
document.querySelectorAll('.scene-choice').forEach(b=>b.addEventListener('click',()=>setMood(b.dataset.scene)));
let resetting=false;function reset(){resetting=true;controls.enabled=false;}
document.getElementById('reset').addEventListener('click',reset);document.querySelector('.wordmark').addEventListener('click',e=>{e.preventDefault();reset();});
function immerse(on){document.body.classList.toggle('immersed',on);document.getElementById('immerse').setAttribute('aria-pressed',String(on));}
document.getElementById('immerse').addEventListener('click',()=>immerse(true));document.getElementById('exit-immerse').addEventListener('click',()=>immerse(false));addEventListener('keydown',e=>{if(e.key==='Escape')immerse(false);if(e.code==='KeyR'&&!e.ctrlKey&&!e.metaKey)reset();});
let toastTimer;function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3000);}
function exportImage(width=3840){const aspect=innerWidth/innerHeight;const w=aspect>=1?width:Math.round(width*aspect),h=aspect>=1?Math.round(width/aspect):width;const dpr=renderer.getPixelRatio();renderer.setPixelRatio(1);composer.setPixelRatio(1);renderer.setSize(w,h,false);composer.setSize(w,h);composer.render();const url=renderer.domElement.toDataURL('image/png');renderer.setPixelRatio(dpr);composer.setPixelRatio(dpr);renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);return url;}
function capture(){const url=exportImage();const a=document.createElement('a');a.download=`烟雨江南-${{dusk:'薄暮',night:'月色',dawn:'晨雾'}[activeMood]}.png`;a.href=url;a.click();toast('此刻江南，已藏入画中');}
document.getElementById('save').addEventListener('click',capture);

// An optional synthesized soundscape: filtered stream noise and a distant breath of wind.
let audioContext=null,audioGain=null,audioOn=false;
function createAudio(){const ctx=new(window.AudioContext||window.webkitAudioContext)();const gain=ctx.createGain();gain.gain.value=0;gain.connect(ctx.destination);const len=ctx.sampleRate*12,buf=ctx.createBuffer(2,len,ctx.sampleRate);for(let ch=0;ch<2;ch++){const d=buf.getChannelData(ch);let last=0;for(let i=0;i<len;i++){const w=Math.random()*2-1;last=(last+.025*w)/1.025;d[i]=last*3.7;}}const source=ctx.createBufferSource();source.buffer=buf;source.loop=true;const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1800;source.connect(filter);filter.connect(gain);source.start();const high=ctx.createBiquadFilter();high.type='bandpass';high.frequency.value=640;high.Q.value=.4;const small=ctx.createGain();small.gain.value=.2;source.connect(high);high.connect(small);small.connect(gain);return{ctx,gain};}
document.getElementById('sound').addEventListener('click',async()=>{try{if(!audioContext){const a=createAudio();audioContext=a.ctx;audioGain=a.gain;}await audioContext.resume();audioOn=!audioOn;audioGain.gain.setTargetAtTime(audioOn?.25:0,audioContext.currentTime,.8);document.getElementById('sound').classList.toggle('sound-on',audioOn);document.getElementById('sound').setAttribute('aria-label',audioOn?'关闭溪水环境音':'开启溪水环境音');document.getElementById('sound').setAttribute('aria-pressed',String(audioOn));toast(audioOn?'溪声已起':'溪声已静');}catch(e){toast('当前浏览器暂时无法播放环境音');}});
let totalTime=0,lastTime=performance.now(),frames=0,visible=true;
document.addEventListener('visibilitychange',()=>{visible=!document.hidden;lastTime=performance.now();if(audioContext&&audioOn)audioGain.gain.setTargetAtTime(visible?.25:0,audioContext.currentTime,.4);});
function tweenColor(col,hex,alpha){col.lerp(new THREE.Color(hex),alpha);}
function draw(now){requestAnimationFrame(draw);if(!visible)return;const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;totalTime+=reduced?0:dt;const a=1-Math.exp(-dt*1.8),m=targetMood;
 tweenColor(scene.fog.color,m.fog,a);scene.fog.density=THREE.MathUtils.lerp(scene.fog.density,m.density,a);tweenColor(skyUniforms.top.value,m.top,a);tweenColor(skyUniforms.mid.value,m.mid,a);tweenColor(skyUniforms.horizon.value,m.horizon,a);tweenColor(sun.color,m.key,a);sun.intensity=THREE.MathUtils.lerp(sun.intensity,m.keyI,a);tweenColor(hemi.color,m.hemi,a);hemi.intensity=THREE.MathUtils.lerp(hemi.intensity,m.hemiI,a);fill.intensity=THREE.MathUtils.lerp(fill.intensity,m.fill,a);tweenColor(water.material.uniforms.waterColor.value,m.water,a);tweenColor(water.material.uniforms.sunColor.value,m.sun,a);renderer.toneMappingExposure=THREE.MathUtils.lerp(renderer.toneMappingExposure,m.exposure,a);bloom.strength=THREE.MathUtils.lerp(bloom.strength,m.bloom,a);tweenColor(moon.material.color,m.moon,a);moonGlow.material.opacity=THREE.MathUtils.lerp(moonGlow.material.opacity,m.glow,a);warmLights.forEach(l=>l.light.intensity=THREE.MathUtils.lerp(l.light.intensity,l.intensity*m.lantern,a));
 if(resetting){camera.position.lerp(startPos,.055);controls.target.lerp(startTarget,.055);if(camera.position.distanceTo(startPos)<.02){resetting=false;controls.enabled=true;}}controls.update();
 water.material.uniforms.time.value=totalTime*.18;starMat.opacity=THREE.MathUtils.lerp(starMat.opacity,activeMood==='night'?.65:0,a);nature.update?.(totalTime);bridge.update?.(totalTime);village.lanterns?.forEach(l=>{l.mesh.rotation.z=Math.sin(totalTime*.8+l.phase)*.018;});
 for(let i=0;i<moteCount;i++){const s=moteSeed[i];motePos[i*3]=s.x+Math.sin(totalTime*s.s+s.p)*.35;motePos[i*3+1]=s.y+Math.sin(totalTime*.4+s.p)*.25;motePos[i*3+2]=s.z+Math.cos(totalTime*.24+s.p)*.4;}motesGeo.attributes.position.needsUpdate=true;motes.material.opacity=activeMood==='dawn'?.16:.65;
 for(let i=0;i<70;i++){const s=petalSeed[i];dummy.position.set(s.x+Math.sin(totalTime*.1+i)*.12,.035,(s.z+totalTime*.1+45)%85-45);dummy.rotation.set(-Math.PI/2,0,s.r+Math.sin(totalTime*.2+i)*.3);dummy.scale.setScalar(1);dummy.updateMatrix();petals.setMatrixAt(i,dummy.matrix);}petals.instanceMatrix.needsUpdate=true;
 for(const r of ripples){const t=totalTime-r.start-r.delay;if(t>=0&&t<4.5){r.mesh.visible=true;r.mesh.scale.setScalar(.04+t*.7);r.mesh.material.opacity=.15*(1-t/4.5);}else r.mesh.visible=false;}
 finish.uniforms.time.value=totalTime;skyUniforms.time.value=totalTime;updateAtmosphere(totalTime);composer.render();frames++;if(frames===3){document.body.classList.add('loaded');window.__SCENE_READY__=true;}}
requestAnimationFrame(draw);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);});
window.__JIANGNAN__={scene,camera,renderer,composer,controls,setMood,immerse,reset,get frames(){return frames;},get time(){return totalTime;},capture,exportImage,ssao};
