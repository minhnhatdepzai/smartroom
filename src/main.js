import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import anime from 'animejs';
import * as CANNON from 'cannon-es';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// -----------------------------------------------------------------------------
// Cinematic intro — adapted from the V2 intro, then transitions into the WebGL.
// -----------------------------------------------------------------------------
const intro = $('#intro');
const logoShell = $('#logoShell');
const logoMain = $('#logoMain');
const logoAura = $('#logoAura');
const logoShine = $('#logoShine');
const ghostLayer = $('#ghostLayer');
const introFlash = $('#introFlash');
const introScanline = $('#introScanline');
const introTagline = $('#introTagline');
const enterLine = $('#enterLine');
const introProgress = $('#introProgress');
const skipIntro = $('#skipIntro');
const cyanGlow = $('.intro-glow--cyan');
const violetGlow = $('.intro-glow--violet');
const rings = $$('.orbit-ring');
const comets = $$('.comet');
const echoes = $$('.logo--echo');
const introCanvas = $('#introParticles');
const introCtx = introCanvas.getContext('2d');
const wordmark = $('#wordmark');

for (const ch of 'EduVision AI') {
  const s = document.createElement('span');
  if (ch === ' ') s.className = 'space';
  else { s.className = 'char'; s.textContent = ch; }
  wordmark.appendChild(s);
}
const chars = $$('.wordmark .char');
const ghosts = [];
for (let i = 0; i < 8; i++) {
  const g = document.createElement('img');
  g.src = '/assets/logo-icon.png';
  g.alt = '';
  g.className = 'ghost';
  ghostLayer.appendChild(g);
  ghosts.push(g);
}

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, v) => clamp((v - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const easeOutExpo = (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
const easeInOutCubic = (t) => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
const easeOutBack = (t) => { const c1=1.70158,c3=c1+1; return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2); };

let introParticles = [];
let introRaf = 0;
let introStart = 0;
let introFinished = false;
const INTRO_DURATION = reducedMotion ? .3 : 6.55;

function resizeIntroCanvas() {
  const dpr = Math.min(devicePixelRatio || 1, 1.6);
  introCanvas.width = Math.floor(innerWidth*dpr);
  introCanvas.height = Math.floor(innerHeight*dpr);
  introCanvas.style.width = innerWidth+'px';
  introCanvas.style.height = innerHeight+'px';
  introCtx.setTransform(dpr,0,0,dpr,0,0);
  introParticles = Array.from({length:Math.min(300,Math.floor(innerWidth*innerHeight/5600))},()=>({
    x:Math.random()*innerWidth,y:Math.random()*innerHeight,z:Math.random(),s:.2+Math.random(),a:.05+Math.random()*.22,v:.03+Math.random()*.15
  }));
}
resizeIntroCanvas();

function drawIntroParticles(t) {
  introCtx.clearRect(0,0,innerWidth,innerHeight);
  const cx=innerWidth/2,cy=innerHeight*.43;
  for (const p of introParticles) {
    const drift=t*(5+p.z*7);
    let y=(p.y-drift*p.v)%innerHeight; if(y<0)y+=innerHeight;
    const d=Math.hypot(p.x-cx,y-cy);
    const near=clamp(1-d/Math.min(innerWidth,innerHeight)*.95);
    introCtx.beginPath();
    introCtx.fillStyle=`rgba(${120+Math.floor(p.z*70)},${180+Math.floor(p.z*55)},255,${p.a*(.35+near)})`;
    introCtx.arc(p.x,y,p.s*(.7+p.z),0,Math.PI*2);
    introCtx.fill();
  }
}

function introTick(now) {
  const t=(now-introStart)/1000;
  const p=clamp(t/INTRO_DURATION);
  introProgress.style.transform=`scaleX(${p})`;
  drawIntroParticles(t);

  if (reducedMotion) {
    logoMain.style.opacity='1';
    logoMain.style.transform='scale(1)';
    chars.forEach(c=>{c.style.opacity='1';c.style.transform='none';c.style.filter='none';});
    introTagline.style.opacity='1';
    finishIntro();
    return;
  }

  const bgP=smooth(invLerp(.05,1.25,t));
  cyanGlow.style.opacity=String(.42*bgP); violetGlow.style.opacity=String(.34*bgP);
  cyanGlow.style.transform=`scale(${lerp(.65,1,bgP)})`; violetGlow.style.transform=`scale(${lerp(.65,1,bgP)})`;

  const ringP=easeOutExpo(invLerp(.25,1.25,t));
  rings.forEach((r,i)=>{
    r.style.opacity=String((.12+i*.04)*ringP);
    const rot=t*(i%2?-95:110)+i*48;
    if(i===1) r.style.transform=`translate(-50%,-50%) rotateX(72deg) rotateZ(${12+rot}deg) scale(${lerp(.72,1,ringP)})`;
    else if(i===2) r.style.transform=`translate(-50%,-50%) rotateZ(${63+rot}deg) scale(${lerp(.72,1,ringP)})`;
    else r.style.transform=`translate(-50%,-50%) rotateZ(${-13+rot}deg) scale(${lerp(.72,1,ringP)})`;
  });

  const swarmP=invLerp(.45,2.8,t), collapse=smooth(invLerp(1.72,2.82,t)), orbitScale=1-.83*collapse;
  ghosts.forEach((g,i)=>{
    const phase=i/ghosts.length*Math.PI*2;
    const turns=2.55+(i%3)*.23;
    const angle=phase+swarmP*Math.PI*2*turns*(i%2?-1:1);
    const rx=(190+(i%3)*34)*orbitScale, ry=(72+(i%2)*44)*orbitScale;
    const localIn=easeOutExpo(invLerp(.45+i*.032,1.03+i*.024,t));
    const localOut=1-smooth(invLerp(2.24,2.84,t));
    const op=.56*localIn*localOut;
    const sc=lerp(.34,.68,swarmP)*lerp(1,.48,collapse);
    g.style.opacity=String(op);
    g.style.filter=`blur(${lerp(8,1.1,swarmP)}px) saturate(1.8) brightness(${lerp(1.8,1.25,swarmP)}) drop-shadow(0 0 ${lerp(28,10,swarmP)}px rgba(${i%2?'183,69,255':'72,231,240'},.55))`;
    g.style.transform=`translate(calc(-50% + ${Math.cos(angle)*rx}px),calc(-50% + ${Math.sin(angle)*ry}px)) rotateZ(${angle*180/Math.PI*1.3+i*33}deg) rotateY(${Math.sin(angle)*55}deg) scale(${sc})`;
  });

  comets.forEach((c,i)=>{
    const cp=invLerp(.55+i*.08,2.48,t);
    const op=.75*easeOutExpo(invLerp(.55+i*.08,.95+i*.08,t))*(1-smooth(invLerp(2.1,2.54,t)));
    const a=cp*Math.PI*2*(2.1+i*.25)+i*2.2;
    const rx=205-collapse*160+i*18, ry=85-collapse*60+i*12;
    c.style.opacity=String(op);
    c.style.transform=`translate(calc(-50% + ${Math.cos(a)*rx}px),calc(-50% + ${Math.sin(a)*ry}px)) rotateZ(${a*180/Math.PI+180}deg)`;
  });

  const logoIn=easeOutExpo(invLerp(1.32,3.02,t));
  const settle=easeOutBack(invLerp(2.28,3.28,t));
  const scale=logoIn<.70?lerp(.04,.73,easeOutExpo(logoIn/.70)):lerp(.73,1,settle);
  const yRot=lerp(-720,0,easeInOutCubic(invLerp(1.34,3.05,t)));
  const zRot=lerp(-150,0,easeOutExpo(invLerp(1.34,3.05,t)));
  const xRot=Math.sin(invLerp(1.34,3.05,t)*Math.PI)*-18;
  logoMain.style.opacity=String(clamp(invLerp(1.38,1.78,t)));
  logoMain.style.transform=`translateZ(30px) scale(${scale}) rotateX(${xRot}deg) rotateY(${yRot}deg) rotateZ(${zRot}deg)`;
  logoMain.style.filter=`blur(${lerp(18,0,easeOutExpo(invLerp(1.42,2.72,t)))}px) saturate(${lerp(1.65,1.07,logoIn)}) brightness(${lerp(1.75,1.03,logoIn)}) drop-shadow(0 0 ${lerp(54,22,logoIn)}px rgba(72,217,255,${lerp(.58,.18,logoIn)}))`;
  const auraP=smooth(invLerp(1.42,3.15,t));
  logoAura.style.opacity=String(.95*auraP*(1-.45*smooth(invLerp(3,4.2,t))));
  logoAura.style.transform=`scale(${lerp(.2,1.18,easeOutExpo(auraP))})`;

  const impact2=clamp(1-Math.abs(clamp((t-2.83)/.34,-1,1)));
  echoes[0].style.opacity=String(.42*impact2); echoes[0].style.transform=`scale(${1+.2*(1-impact2)}) rotateZ(${-8*(1-impact2)}deg)`;
  echoes[1].style.opacity=String(.26*impact2); echoes[1].style.transform=`scale(${1+.34*(1-impact2)}) rotateZ(${12*(1-impact2)}deg)`;
  introFlash.style.opacity=String(.48*clamp(1-Math.abs((t-2.84)/.22)));

  const shineP=smooth(invLerp(3.02,3.85,t));
  logoShine.style.opacity=String((1-smooth(invLerp(3.66,3.94,t)))*.98);
  logoShine.style.backgroundPosition=`${lerp(135,-42,shineP)}% 0`;
  const scanP=smooth(invLerp(3,4.35,t));
  introScanline.style.opacity=String(.62*(1-Math.abs(scanP-.5)*2));
  introScanline.style.transform=`translateX(${lerp(-5,140,scanP)}vw) skewX(-16deg)`;

  chars.forEach((c,i)=>{
    const cp=easeOutExpo(invLerp(3.4+i*.065,4.12+i*.065,t));
    c.style.opacity=String(cp);
    c.style.transform=`translateY(${lerp(34,0,cp)}px) rotateX(${lerp(-70,0,cp)}deg) scale(${lerp(.92,1,cp)})`;
    c.style.filter=`blur(${lerp(11,0,cp)}px)`;
  });
  const tagP=easeOutExpo(invLerp(4.55,5.25,t));
  introTagline.style.opacity=String(.96*tagP);
  introTagline.style.transform=`translateY(${lerp(14,0,tagP)}px)`;
  enterLine.style.opacity=String(.8*easeOutExpo(invLerp(5.15,5.72,t))*(1-smooth(invLerp(6.05,6.5,t))));

  // Portal transition: the logo grows until the camera feels like it passes through it.
  const portal=smooth(invLerp(5.55,6.5,t));
  if(portal>0){
    logoShell.style.transform=`translate3d(0,${lerp(0,-8,portal)}vh,0) scale(${lerp(1,4.8,portal)}) rotateZ(${lerp(0,4,portal)}deg)`;
    wordmark.style.opacity=String(1-portal*1.15);
    introTagline.style.opacity=String((1-portal)*.8);
    intro.style.backgroundColor=`rgba(1,2,4,${1-portal})`;
  }

  if(t<INTRO_DURATION) introRaf=requestAnimationFrame(introTick);
  else finishIntro();
}

function startIntro(){ introStart=performance.now(); introRaf=requestAnimationFrame(introTick); }
function finishIntro(){
  if(introFinished) return;
  introFinished=true;
  cancelAnimationFrame(introRaf);
  document.body.classList.add('site-ready');
  document.body.classList.remove('intro-lock');
  intro.style.transition = reducedMotion ? 'none' : 'opacity .9s cubic-bezier(.16,1,.3,1)';
  requestAnimationFrame(() => { intro.style.opacity = '0'; });
  setTimeout(() => intro.remove(), reducedMotion ? 0 : 950);
}
skipIntro.addEventListener('click',finishIntro);

Promise.all([logoMain.decode().catch(()=>{}),...ghosts.map(g=>g.decode().catch(()=>{}))]).then(startIntro);

// -----------------------------------------------------------------------------
// WebGL world
// -----------------------------------------------------------------------------
const canvas = $('#webgl');
const renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=.92;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020408);
scene.fog = new THREE.FogExp2(0x020408,.037);
const camera = new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,120);
camera.position.set(0,5.1,14.5);
const cameraTarget = new THREE.Vector3(0,1.45,-.6);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.64,.72,.78);
composer.addPass(bloom);

const hemi = new THREE.HemisphereLight(0xbfe9ff,0x071019,.8);
scene.add(hemi);
const keyLight = new THREE.DirectionalLight(0xb8f5ff,2.15);
keyLight.position.set(-5,8,5); keyLight.castShadow=true; scene.add(keyLight);
const violetLight = new THREE.PointLight(0x8f4fff,16,24,2); violetLight.position.set(7,3,-1); scene.add(violetLight);
const cyanLight = new THREE.PointLight(0x37e9db,13,22,2); cyanLight.position.set(-6,3,2); scene.add(cyanLight);
const warmLight = new THREE.PointLight(0xffd3a0,0,20,2); warmLight.position.set(-3,4,-2); scene.add(warmLight);

function standard(color, opts={}) {
  return new THREE.MeshStandardMaterial({color,roughness:opts.roughness??.56,metalness:opts.metalness??.16,transparent:opts.transparent??false,opacity:opts.opacity??1,emissive:opts.emissive??0x000000,emissiveIntensity:opts.emissiveIntensity??0});
}
function mesh(geometry,material,position=[0,0,0],rotation=[0,0,0]){
  const m=new THREE.Mesh(geometry,material); m.position.set(...position); m.rotation.set(...rotation); m.castShadow=true; m.receiveShadow=true; return m;
}
function rememberOpacity(group){ group.traverse(o=>{ if(o.material){ const mats=Array.isArray(o.material)?o.material:[o.material]; mats.forEach(m=>{m.transparent=true;m.userData.baseOpacity=m.opacity;}); }}); }
function setGroupOpacity(group,value){ group.traverse(o=>{ if(o.material){ const mats=Array.isArray(o.material)?o.material:[o.material]; mats.forEach(m=>{m.opacity=(m.userData.baseOpacity??1)*value; m.transparent=true;}); }}); }
function boardTexture(){
  const c=document.createElement('canvas'); c.width=1400; c.height=660;
  const x=c.getContext('2d');
  x.fillStyle='#071a22'; x.fillRect(0,0,c.width,c.height);
  const g=x.createLinearGradient(0,0,c.width,c.height); g.addColorStop(0,'rgba(54,222,210,.17)'); g.addColorStop(1,'rgba(65,111,235,.04)'); x.fillStyle=g; x.fillRect(0,0,c.width,c.height);
  x.strokeStyle='rgba(160,242,238,.13)'; x.lineWidth=2;
  for(let i=80;i<c.width;i+=120){ x.beginPath(); x.moveTo(i,0); x.lineTo(i,c.height); x.stroke(); }
  for(let i=78;i<c.height;i+=92){ x.beginPath(); x.moveTo(0,i); x.lineTo(c.width,i); x.stroke(); }
  x.fillStyle='rgba(218,255,251,.94)'; x.font='600 52px system-ui'; x.fillText('CẤU TRÚC TẾ BÀO THỰC VẬT',82,112);
  x.fillStyle='rgba(133,240,227,.72)'; x.font='28px system-ui'; x.fillText('MÔ PHỎNG 3D TƯƠNG TÁC · SINH HỌC 10',84,158);
  x.strokeStyle='rgba(80,232,216,.7)'; x.lineWidth=7; x.beginPath(); x.ellipse(830,360,260,174,-.12,0,Math.PI*2); x.stroke();
  x.fillStyle='rgba(55,199,130,.16)'; x.beginPath(); x.ellipse(830,360,250,164,-.12,0,Math.PI*2); x.fill();
  x.fillStyle='#b380e8'; x.beginPath(); x.arc(805,350,68,0,Math.PI*2); x.fill();
  x.fillStyle='#7045a9'; x.beginPath(); x.arc(805,350,28,0,Math.PI*2); x.fill();
  x.fillStyle='#55c8a5';
  [[650,300,34,16],[968,390,42,18],[700,438,31,14],[1010,284,36,15]].forEach(v=>{x.beginPath();x.ellipse(...v,.35,0,Math.PI*2);x.fill();});
  x.strokeStyle='rgba(220,255,247,.65)'; x.lineWidth=2; x.beginPath(); x.moveTo(873,315); x.lineTo(1115,235); x.stroke();
  x.fillStyle='rgba(225,249,251,.8)'; x.font='25px system-ui'; x.fillText('Nhân tế bào',1125,239); x.fillText('Lục lạp',1125,404);
  x.beginPath(); x.moveTo(986,390); x.lineTo(1115,398); x.stroke();
  const texture=new THREE.CanvasTexture(c); texture.colorSpace=THREE.SRGBColorSpace; return texture;
}

// Global particle field
const pCount=620, pPos=new Float32Array(pCount*3);
for(let i=0;i<pCount;i++){ pPos[i*3]=(Math.random()-.5)*48; pPos[i*3+1]=Math.random()*16-2; pPos[i*3+2]=(Math.random()-.5)*42; }
const pGeo=new THREE.BufferGeometry(); pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));
const pMat=new THREE.PointsMaterial({color:0x85dfff,size:.025,transparent:true,opacity:.34,depthWrite:false,blending:THREE.AdditiveBlending});
const starField=new THREE.Points(pGeo,pMat); scene.add(starField);

// Lớp học: vật liệu, ánh sáng và đạo cụ được dựng theo tỷ lệ một phòng học thật.
const classroom = new THREE.Group(); scene.add(classroom);
const floorMat=standard(0x25282b,{roughness:.48,metalness:.05});
const floor=mesh(new THREE.BoxGeometry(17,.22,16),floorMat,[0,-.18,0]); classroom.add(floor);
const floorGrid=new THREE.GridHelper(17,26,0x574c42,0x302c28); floorGrid.position.y=-.055; floorGrid.material.opacity=.22; floorGrid.material.transparent=true; classroom.add(floorGrid);
const backWall=mesh(new THREE.BoxGeometry(17,6,.18),standard(0x152129,{roughness:.9}),[0,2.85,-7.1]); classroom.add(backWall);
const sideL=mesh(new THREE.BoxGeometry(.16,6,16),standard(0x121c22,{roughness:.9}),[-8.45,2.85,0]); classroom.add(sideL);
const sideR=sideL.clone(); sideR.position.x=8.45; classroom.add(sideR);

// Gờ tường và các dải đèn trần làm phòng học có chiều sâu hơn.
const trimMat=standard(0x34414a,{roughness:.38,metalness:.32});
classroom.add(mesh(new THREE.BoxGeometry(16.75,.14,.16),trimMat,[0,.92,-6.96]));
classroom.add(mesh(new THREE.BoxGeometry(16.75,.12,.18),trimMat,[0,5.55,-6.96]));
const ceilingMat=standard(0x19252c,{roughness:.8});
for(let z=-4.8;z<=4.8;z+=3.2){
  classroom.add(mesh(new THREE.BoxGeometry(15.9,.1,2.55),ceilingMat,[0,5.66,z]));
  const lightPanel=mesh(new THREE.BoxGeometry(3.1,.045,.62),new THREE.MeshStandardMaterial({color:0xeef9ff,emissive:0xb8efff,emissiveIntensity:1.55,roughness:.35}),[0,5.57,z]);
  classroom.add(lightPanel);
  const ceilingLight=new THREE.PointLight(0xccefff,1.8,8,2); ceilingLight.position.set(0,5.25,z); classroom.add(ceilingLight);
}

// Cửa sổ lớn ở tường phải; màu ấm khiến không gian giống một buổi học ban ngày.
const windowMat=new THREE.MeshBasicMaterial({color:0x80c9e7,transparent:true,opacity:.25,side:THREE.DoubleSide});
const windowGlow=new THREE.PointLight(0xa9def5,3.6,13,2); windowGlow.position.set(7.7,3.2,1.8); classroom.add(windowGlow);
for(let i=0;i<3;i++){
  const z=-3.5+i*3.55;
  classroom.add(mesh(new THREE.PlaneGeometry(2.55,3.35),windowMat,[8.34,3.35,z],[0,-Math.PI/2,0]));
  classroom.add(mesh(new THREE.BoxGeometry(.08,3.58,2.78),trimMat,[8.27,3.35,z]));
  classroom.add(mesh(new THREE.BoxGeometry(.11,.08,2.68),trimMat,[8.22,3.35,z]));
}

const screenMat=standard(0x101722,{roughness:.28,metalness:.4,emissive:0x0d8694,emissiveIntensity:.45});
const screen=mesh(new THREE.BoxGeometry(8.15,4.25,.22),screenMat,[0,3.2,-6.92]); classroom.add(screen);
const screenInner=mesh(new THREE.PlaneGeometry(7.65,3.72),new THREE.MeshBasicMaterial({map:boardTexture(),transparent:true,opacity:.96}),[0,3.2,-6.795]); classroom.add(screenInner);
const boardLed=new THREE.PointLight(0x54d7e5,1.8,7,2); boardLed.position.set(0,3.1,-6.15); classroom.add(boardLed);

const desks=[]; const students=[]; const halos=[];
const deskTopMat=standard(0x8a6043,{roughness:.48,metalness:.05});
const legMat=standard(0x182127,{roughness:.38,metalness:.65});
const bookMat=standard(0x306f89,{roughness:.7});
const clothing=[0x2d6c87,0x754b75,0x354b73,0x7c5b41,0x3f7170,0x553e61];
const skin=[0x8d5f48,0xb77c5f,0x694738,0xd0a182];
for(let row=0;row<3;row++){
  for(let col=0;col<4;col++){
    const x=(col-1.5)*3.45+(row%2?.35:0); const z=3.4-row*3.1;
    const dg=new THREE.Group();
    dg.add(mesh(new THREE.BoxGeometry(2.45,.16,1.18),deskTopMat,[0,.98,0]));
    dg.add(mesh(new THREE.BoxGeometry(2.12,.13,.18),standard(0x704a34,{roughness:.54}),[0,.73,.42]));
    [-.96,.96].forEach(lx=>[-.43,.43].forEach(lz=>dg.add(mesh(new THREE.BoxGeometry(.09,.96,.09),legMat,[lx,.48,lz]))));
    if((row+col)%2===0) dg.add(mesh(new THREE.BoxGeometry(.44,.055,.32),bookMat,[-.47,1.1,-.12],[0,(col%3-.5)*.35,0]));
    dg.position.set(x,0,z); classroom.add(dg); desks.push(dg);

    const sg=new THREE.Group();
    const studentMat=standard(clothing[(row*4+col)%clothing.length],{roughness:.76});
    const headMat=standard(skin[(row+col)%skin.length],{roughness:.84,metalness:0});
    const studentTorso=mesh(new THREE.CapsuleGeometry(.29,.58,7,14),studentMat,[0,1.52,.08]); studentTorso.scale.z=.72; sg.add(studentTorso);
    sg.add(mesh(new THREE.CylinderGeometry(.095,.11,.16,14),headMat,[0,1.98,.02]));
    const studentHead=mesh(new THREE.SphereGeometry(.285,28,24),headMat,[0,2.2,-.02]); studentHead.scale.set(.88,1.08,.91); sg.add(studentHead);
    const hair=mesh(new THREE.SphereGeometry(.294,28,18),standard((row+col)%3===0?0x30221e:0x17171a,{roughness:.95}),[0,2.3,.015]); hair.scale.set(.92,.72,.94); sg.add(hair);
    [-.115,.115].forEach(lx=>sg.add(mesh(new THREE.SphereGeometry(.021,10,10),standard(0x11161a,{roughness:.7}),[lx,2.24,-.268])));
    sg.add(mesh(new THREE.SphereGeometry(.042,12,12),headMat,[0,2.16,-.285]));
    [-.27,.27].forEach(lx=>sg.add(mesh(new THREE.SphereGeometry(.048,12,12),headMat,[lx,2.2,-.01])));
    [-.32,.32].forEach((lx,index)=>{
      const arm=mesh(new THREE.CapsuleGeometry(.075,.5,5,10),studentMat,[lx,1.57,-.13],[-.82,0,index?-.08:.08]); sg.add(arm);
      sg.add(mesh(new THREE.SphereGeometry(.09,14,14),headMat,[lx,1.29,-.43]));
    });
    [-.16,.16].forEach(lx=>{
      sg.add(mesh(new THREE.CapsuleGeometry(.09,.54,5,10),standard(0x222b32,{roughness:.8}),[lx,.65,.16],[.08,0,0]));
      sg.add(mesh(new THREE.BoxGeometry(.18,.1,.32),standard(0x11171d,{roughness:.7}),[lx,.13,-.02]));
    });
    const chair=new THREE.Group();
    chair.add(mesh(new THREE.BoxGeometry(.82,.09,.72),standard(0x263a43,{roughness:.52,metalness:.23}),[0,.78,.35]));
    chair.add(mesh(new THREE.BoxGeometry(.82,.64,.09),standard(0x263a43,{roughness:.52,metalness:.23}),[0,1.14,.66]));
    [-.31,.31].forEach(lx=>[-.22,.54].forEach(lz=>chair.add(mesh(new THREE.BoxGeometry(.06,.74,.06),legMat,[lx,.39,lz]))));
    sg.add(chair);
    sg.position.set(x,0,z+.34); sg.rotation.y=(col%2?-.035:.035); sg.userData={baseY:0,phase:row*1.7+col*.84}; classroom.add(sg); students.push(sg);

    const haloMat=new THREE.MeshBasicMaterial({color:0x55efe1,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
    haloMat.userData.baseOpacity=1;
    const halo=mesh(new THREE.TorusGeometry(.58,.014,8,64),haloMat,[x,2.18,z+.22],[Math.PI/2,0,0]); halo.scale.set(1,.58,1); classroom.add(halo); halos.push(halo);
  }
}

// Teacher
const teacher=new THREE.Group();
const teacherShirt=standard(0xd5e0e4,{roughness:.72});
const teacherSkin=standard(0xb57d61,{roughness:.83});
const teacherPants=standard(0x263447,{roughness:.7});
const teacherTorso=mesh(new THREE.CapsuleGeometry(.36,.86,8,16),teacherShirt,[0,1.72,0]); teacherTorso.scale.z=.72; teacher.add(teacherTorso);
teacher.add(mesh(new THREE.CylinderGeometry(.105,.12,.18,16),teacherSkin,[0,2.21,0]));
const teacherHead=mesh(new THREE.SphereGeometry(.31,32,28),teacherSkin,[0,2.47,0]); teacherHead.scale.set(.88,1.08,.92); teacher.add(teacherHead);
const teacherHair=mesh(new THREE.SphereGeometry(.325,30,22),standard(0x2b1d1d,{roughness:.96}),[0,2.61,-.035]); teacherHair.scale.set(.93,.76,.96); teacher.add(teacherHair);
teacher.add(mesh(new THREE.SphereGeometry(.055,12,12),teacherSkin,[0,2.43,.3]));
[-.12,.12].forEach(lx=>teacher.add(mesh(new THREE.SphereGeometry(.026,10,10),standard(0x101418,{roughness:.8}),[lx,2.52,.275])));
[-.3,.3].forEach(lx=>teacher.add(mesh(new THREE.SphereGeometry(.05,12,12),teacherSkin,[lx,2.47,0])));
[-.18,.18].forEach(lx=>{
  teacher.add(mesh(new THREE.CapsuleGeometry(.115,.7,6,12),teacherPants,[lx,.65,0]));
  teacher.add(mesh(new THREE.BoxGeometry(.24,.12,.42),standard(0x151a20,{roughness:.6}),[lx,.1,.08]));
});
const teacherArm=mesh(new THREE.CapsuleGeometry(.095,.65,4,8),teacherSkin,[.48,1.9,.02],[0,0,-.82]);
const teacherArmLeft=mesh(new THREE.CapsuleGeometry(.095,.65,4,8),teacherSkin,[-.46,1.88,.02],[0,0,.62]);
teacher.add(teacherArm,teacherArmLeft);
teacher.add(mesh(new THREE.SphereGeometry(.11,16,16),teacherSkin,[.71,2.22,.02]));
teacher.add(mesh(new THREE.SphereGeometry(.11,16,16),teacherSkin,[-.68,2.12,.02]));
teacher.userData.arm=teacherArm; teacher.userData.leftArm=teacherArmLeft;
teacher.position.set(-2.75,0,-4.15); teacher.scale.setScalar(1.08); classroom.add(teacher);
const podium=mesh(new THREE.BoxGeometry(1.35,1.05,.75),standard(0x513a2c,{roughness:.48,metalness:.16}),[-4.65,.52,-4.6]); classroom.add(podium);

// Ceiling camera
const classroomCam=new THREE.Group();
const camBody=mesh(new THREE.BoxGeometry(1.15,.64,.82),standard(0x18242d,{roughness:.35,metalness:.6}),[0,0,0]); classroomCam.add(camBody);
const lens=mesh(new THREE.CylinderGeometry(.19,.19,.18,32),standard(0x03090d,{roughness:.1,metalness:.8,emissive:0x1aa6b8,emissiveIntensity:.5}),[0,-.02,.48],[Math.PI/2,0,0]); classroomCam.add(lens);
const lensGlow=new THREE.PointLight(0x41e8e0,2.2,5,2); lensGlow.position.set(0,0,.6); classroomCam.add(lensGlow);
classroomCam.position.set(0,5.15,5.7); classroomCam.rotation.x=-.22; classroom.add(classroomCam);

// Vision scan cone
const scanMat=new THREE.MeshBasicMaterial({color:0x3de9e0,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
scanMat.userData.baseOpacity=.16;
const scanCone=mesh(new THREE.ConeGeometry(5.2,7.8,48,1,true),scanMat,[0,1.7,2.6],[Math.PI,0,0]); scanCone.scale.z=.76; classroom.add(scanCone);
const scanPulseMat=new THREE.MeshBasicMaterial({color:0x9bfff3,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
const scanPulse=mesh(new THREE.RingGeometry(.08,5.2,96),scanPulseMat,[0,.025,1.6],[-Math.PI/2,0,0]); scanPulse.scale.z=.72; classroom.add(scanPulse);

// AI orb near teacher
const agentGroup=new THREE.Group();
const orbMat=new THREE.MeshStandardMaterial({color:0x58efe6,roughness:.16,metalness:.38,emissive:0x2bcabd,emissiveIntensity:2.6});
const orb=mesh(new THREE.SphereGeometry(.43,48,48),orbMat,[0,0,0]); agentGroup.add(orb);
const ringMat=new THREE.MeshBasicMaterial({color:0x8f58ff,transparent:true,opacity:.72,blending:THREE.AdditiveBlending,depthWrite:false});
for(let i=0;i<3;i++){ const r=mesh(new THREE.TorusGeometry(.72+i*.14,.015,8,80),ringMat.clone(),[0,0,0],[Math.PI/2+i*.4,i*.7,0]); agentGroup.add(r); }
const agentLight=new THREE.PointLight(0x40e7df,5.5,7,2); agentGroup.add(agentLight);
agentGroup.position.set(-4.35,3.15,-4.15); agentGroup.scale.setScalar(.001); scene.add(agentGroup);

// Mô hình tế bào 3D nổi giữa lớp, xuất hiện ở phân cảnh bài giảng.
const solar=new THREE.Group(); scene.add(solar); solar.position.set(1.9,2.75,-3.7); solar.scale.setScalar(.001);
const cellMembrane=mesh(new THREE.IcosahedronGeometry(1.52,4),new THREE.MeshPhysicalMaterial({color:0x4be7b1,roughness:.16,metalness:.08,transparent:true,opacity:.18,transmission:.18,emissive:0x167a63,emissiveIntensity:1.25,side:THREE.DoubleSide})); solar.add(cellMembrane);
const cellShell=mesh(new THREE.IcosahedronGeometry(1.63,2),new THREE.MeshBasicMaterial({color:0x5ef1d0,wireframe:true,transparent:true,opacity:.22,blending:THREE.AdditiveBlending})); solar.add(cellShell);
const nucleus=mesh(new THREE.SphereGeometry(.53,40,40),new THREE.MeshStandardMaterial({color:0xb373ed,roughness:.22,emissive:0x6234a2,emissiveIntensity:1.55}),[-.16,.08,.08]); solar.add(nucleus);
const nucleolus=mesh(new THREE.SphereGeometry(.19,28,28),new THREE.MeshStandardMaterial({color:0xf0a8ff,roughness:.18,emissive:0xa548c5,emissiveIntensity:1.6}),[-.28,.13,.36]); solar.add(nucleolus);
const vacuole=mesh(new THREE.SphereGeometry(.62,32,32),new THREE.MeshPhysicalMaterial({color:0x69c7ee,transparent:true,opacity:.18,roughness:.12,transmission:.25}),[.5,-.26,-.2]); vacuole.scale.set(1,.65,.72); solar.add(vacuole);
const modelBase=mesh(new THREE.CylinderGeometry(1.75,2.08,.075,72),new THREE.MeshBasicMaterial({color:0x4ce8d3,transparent:true,opacity:.16,blending:THREE.AdditiveBlending}),[0,-1.85,0]); solar.add(modelBase);
const solarLight=new THREE.PointLight(0x55efc7,7,12,2); solar.add(solarLight);
const planetSpecs=[[.88,.15,0x4be1a6],[1.08,.12,0x5bd5e6],[1.23,.13,0xe9ad5c],[.72,.1,0x69e58d],[1.34,.1,0xb889ff]];
const planets=[];
planetSpecs.forEach((sp,i)=>{
  const organelle=mesh(new THREE.CapsuleGeometry(sp[1]*.6,sp[1]*1.65,5,12),new THREE.MeshStandardMaterial({color:sp[2],roughness:.3,emissive:sp[2],emissiveIntensity:.52}));
  organelle.userData.radius=sp[0]; organelle.userData.speed=.23+i*.07; organelle.userData.phase=i*1.7; solar.add(organelle); planets.push(organelle);
});
let modelUserScale=1;
let modelSpinSpeed=1;
let modelExplode=0;

// Cannon-es tạo chuyển động vật lý cho các vi hạt bên trong mô hình tế bào.
const physicsWorld=new CANNON.World({gravity:new CANNON.Vec3(0,0,0)});
const bioParticles=[];
for(let i=0;i<14;i++){
  const radius=.025+Math.random()*.035;
  const body=new CANNON.Body({mass:.03,shape:new CANNON.Sphere(radius),linearDamping:.015});
  body.position.set((Math.random()-.5)*1.7,(Math.random()-.5)*1.35,(Math.random()-.5)*1.6);
  body.velocity.set((Math.random()-.5)*.26,(Math.random()-.5)*.26,(Math.random()-.5)*.26);
  physicsWorld.addBody(body);
  const visual=mesh(new THREE.SphereGeometry(radius,12,12),new THREE.MeshBasicMaterial({color:i%3===0?0xc39aff:0x7dfff0,transparent:true,opacity:.7,blending:THREE.AdditiveBlending}));
  solar.add(visual); bioParticles.push({body,visual});
}

// Remote control camera showcase group
const remoteRig=new THREE.Group(); scene.add(remoteRig); remoteRig.position.set(3.8,2.7,-.5); remoteRig.scale.setScalar(.001);
const rigBody=mesh(new THREE.CylinderGeometry(1.05,1.15,1.05,48),standard(0x17232c,{roughness:.26,metalness:.68}),[0,0,0]); remoteRig.add(rigBody);
const rigLens=mesh(new THREE.CylinderGeometry(.46,.46,.5,48),standard(0x02070c,{roughness:.08,metalness:.82,emissive:0x153f53,emissiveIntensity:.6}),[0,-.05,.65],[Math.PI/2,0,0]); remoteRig.add(rigLens);
const rigRingMat=new THREE.MeshBasicMaterial({color:0x46ede2,transparent:true,opacity:.3,blending:THREE.AdditiveBlending,depthWrite:false}); rigRingMat.userData.baseOpacity=.3;
for(let i=0;i<3;i++){ const rr=mesh(new THREE.TorusGeometry(1.5+i*.28,.018,8,96),rigRingMat.clone(),[0,0,0],[Math.PI/2,i*.25,0]); remoteRig.add(rr); }

// Digital twin wireframe room
const twin=new THREE.Group(); scene.add(twin); twin.position.set(0,.02,0); twin.scale.setScalar(.985);
const lineMat=new THREE.LineBasicMaterial({color:0x4beee1,transparent:true,opacity:0,blending:THREE.AdditiveBlending}); lineMat.userData.baseOpacity=.55;
function wireBox(w,h,d,x,y,z){ const e=new THREE.EdgesGeometry(new THREE.BoxGeometry(w,h,d)); const l=new THREE.LineSegments(e,lineMat.clone()); l.position.set(x,y,z); twin.add(l); }
wireBox(17,6,16,0,2.85,0);
for(let row=0;row<3;row++) for(let col=0;col<4;col++){ const x=(col-1.5)*3.45+(row%2?.35:0),z=3.4-row*3.1; wireBox(2.45,.16,.86,x,.94,z); }
const twinGrid=new THREE.GridHelper(17,26,0x48ece1,0x163f4c); twinGrid.position.y=.02; twinGrid.material.opacity=0; twinGrid.material.transparent=true; twinGrid.material.userData.baseOpacity=.34; twin.add(twinGrid);
rememberOpacity(twin); setGroupOpacity(twin,0);

// AI core
const core=new THREE.Group(); scene.add(core); core.position.set(0,2,-.3); core.scale.setScalar(.001);
const coreSphere=mesh(new THREE.IcosahedronGeometry(1.1,5),new THREE.MeshStandardMaterial({color:0x5bece2,roughness:.12,metalness:.38,emissive:0x258eaa,emissiveIntensity:2.2})); core.add(coreSphere);
const coreShell=mesh(new THREE.IcosahedronGeometry(1.55,2),new THREE.MeshBasicMaterial({color:0x6e65ff,wireframe:true,transparent:true,opacity:.28,blending:THREE.AdditiveBlending}),[0,0,0]); core.add(coreShell);
const coreLight=new THREE.PointLight(0x56eae1,9,14,2); core.add(coreLight);
const nodePositions=[[-4,2,0],[4,2,0],[-3,-2,1],[3,-2,1],[0,3,-1],[0,-3,-1]];
const coreNodes=[];
nodePositions.forEach((p,i)=>{
  const n=mesh(new THREE.SphereGeometry(.13,18,18),new THREE.MeshBasicMaterial({color:i%2?0xa262ff:0x58ede3,transparent:true,opacity:.9}),p); core.add(n); coreNodes.push(n);
  const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(...p)]);
  const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:i%2?0x7651d8:0x3fb9c5,transparent:true,opacity:.28,blending:THREE.AdditiveBlending})); core.add(line);
});

// Danh sách vật thể có thể chọn và kéo trực tiếp trong cảnh 3D.
const interactables=[];
function registerInteractive(object,name,description,kind='Vật thể 3D'){
  object.userData.interactive=true;
  object.userData.displayName=name;
  object.userData.description=description;
  object.userData.kind=kind;
  object.userData.manualRotationY=0;
  object.userData.initialTransform={
    position:object.position.clone(),
    rotation:object.rotation.clone(),
    scale:object.scale.clone()
  };
  interactables.push(object);
}
registerInteractive(teacher,'Cô giáo Lan','Giáo viên 3D đang dẫn dắt bài học và tương tác với mô hình.','Nhân vật');
students.forEach((student,index)=>registerInteractive(student,`Học sinh ${String(index+1).padStart(2,'0')}`,'Nhân vật học sinh trong lớp. Kéo để thay đổi chỗ ngồi hoặc bố cục lớp học.','Nhân vật'));
desks.forEach((desk,index)=>registerInteractive(desk,`Bàn học ${String(index+1).padStart(2,'0')}`,'Bàn học có thể được sắp xếp lại cho từng hoạt động nhóm.','Nội thất'));
registerInteractive(podium,'Bục giảng','Bục điều khiển học liệu và thiết bị lớp học.','Nội thất');
registerInteractive(classroomCam,'Camera AI trên trần','Camera quan sát hỗ trợ phân tích không gian lớp học.','Thiết bị');
registerInteractive(screen,'Bảng tương tác','Màn hình bài giảng chính của lớp học.','Thiết bị');
registerInteractive(solar,'Mô hình tế bào thực vật','Mô hình 3D có thể xoay, phóng to và tách lớp cấu tạo.','Học liệu 3D');
registerInteractive(agentGroup,'Trợ lý EduVision','Trợ lý AI tiếp nhận lệnh giọng nói của giáo viên.','Trợ lý AI');
registerInteractive(remoteRig,'Camera PTZ','Camera điều khiển từ xa với khả năng xoay và thu phóng.','Thiết bị');

rememberOpacity(classroom); rememberOpacity(agentGroup); rememberOpacity(solar); rememberOpacity(remoteRig); rememberOpacity(core);

// State objects that GSAP can scrub and feed into material opacity.
const fx={scan:0,twin:0,room:1,agent:0,solar:0,remote:0,core:0,warm:0};
function applyFX(){
  setGroupOpacity(twin,fx.twin);
  scanMat.opacity=.16*fx.scan;
  scanPulseMat.opacity=.32*fx.scan;
  halos.forEach((h,i)=>{ h.material.opacity=fx.scan*(i===5?.9:.28); h.scale.x=1+Math.sin(performance.now()*.002+i)*.03; });
  agentGroup.scale.setScalar(Math.max(.001,fx.agent));
  solar.scale.setScalar(Math.max(.001,fx.solar*modelUserScale));
  remoteRig.scale.setScalar(Math.max(.001,fx.remote));
  core.scale.setScalar(Math.max(.001,fx.core));
  warmLight.intensity=5.6*fx.warm;
  cyanLight.intensity=13*(1-fx.warm*.55);
  violetLight.intensity=16*(1-fx.warm*.65);
}

// -----------------------------------------------------------------------------
// Scroll choreography — dependency-free. Browser scroll drives a damped cinematic
// playhead, then we interpolate between camera / effect keyframes.
// -----------------------------------------------------------------------------
const sceneSections = $$('.scene');
let sectionAnchors = [];
let smoothScrollY = window.scrollY;
let targetScrollY = window.scrollY;
let lastAudibleScene=-1;

function computeAnchors(){
  sectionAnchors = sceneSections.map(section => ({
    section,
    y: section.offsetTop + section.offsetHeight * .5 - innerHeight * .5
  }));
}
computeAnchors();

const keyframes = [
  { id:'hero', cam:[0,3.8,10.2], target:[0,1.7,-1.8], fx:{scan:0,twin:0,agent:0,solar:0,remote:0,core:0,warm:0}, bloom:.78, roomScale:1, roomPos:[0,0,0], scanY:0, scanZ:2.6, screenGlow:.45, rigRot:[0,0,0] },
  { id:'vision', cam:[6.7,5.3,7.6], target:[0,1.25,.1], fx:{scan:1,twin:0,agent:0,solar:0,remote:0,core:0,warm:0}, bloom:.96, roomScale:1, roomPos:[0,0,0], scanY:Math.PI*.34, scanZ:-1.7, screenGlow:.45, rigRot:[0,0,0] },
  { id:'agent', cam:[-6.2,3.55,4.6], target:[-2.1,2.1,-3.7], fx:{scan:0,twin:0,agent:1,solar:0,remote:0,core:0,warm:0}, bloom:1.05, roomScale:1, roomPos:[0,0,0], scanY:0, scanZ:2.6, screenGlow:.7, rigRot:[0,0,0] },
  { id:'simulation', cam:[4.3,3.35,6.9], target:[-.15,2.05,-4.05], fx:{scan:0,twin:0,agent:.02,solar:1,remote:0,core:0,warm:0}, bloom:1.02, roomScale:1, roomPos:[0,0,0], scanY:0, scanZ:2.6, screenGlow:1.35, rigRot:[0,0,0] },
  { id:'control', cam:[7.8,4.35,7.4], target:[3.8,2.7,-.5], fx:{scan:0,twin:0,agent:.1,solar:.05,remote:1,core:0,warm:0}, bloom:.86, roomScale:1, roomPos:[0,0,0], scanY:0, scanZ:2.6, screenGlow:.6, rigRot:[.18,Math.PI*1.5,0] },
  { id:'twin', cam:[8.5,10.8,8.9], target:[0,.2,0], fx:{scan:0,twin:1,agent:0,solar:0,remote:.05,core:0,warm:0}, bloom:.95, roomScale:1, roomPos:[0,0,0], scanY:0, scanZ:2.6, screenGlow:.35, rigRot:[.18,Math.PI*1.5,0] },
  { id:'core', cam:[0,4.6,15.8], target:[0,2,-.3], fx:{scan:0,twin:.12,agent:0,solar:0,remote:0,core:1,warm:0}, bloom:1.32, roomScale:.43, roomPos:[0,-1.15,-2.8], scanY:0, scanZ:2.6, screenGlow:.3, rigRot:[0,0,0] },
  { id:'human', cam:[-4.8,3.1,6.5], target:[-2.5,1.7,-2.8], fx:{scan:0,twin:0,agent:0,solar:0,remote:0,core:.02,warm:1}, bloom:.48, roomScale:1, roomPos:[0,0,0], scanY:0, scanZ:2.6, screenGlow:.28, rigRot:[0,0,0] },
  { id:'cta', cam:[0,5.4,19.5], target:[0,1.8,-2], fx:{scan:0,twin:0,agent:0,solar:0,remote:0,core:0,warm:0}, bloom:.72, roomScale:.3, roomPos:[0,-1.6,-4.5], scanY:0, scanZ:2.6, screenGlow:.18, rigRot:[0,0,0] }
];

function mix(a,b,t){ return a+(b-a)*t; }
function mixArray(a,b,t){ return a.map((v,i)=>mix(v,b[i],t)); }
function mixFX(a,b,t){
  for(const k of Object.keys(fx)) fx[k]=mix(a[k]??0,b[k]??0,t);
}

function scrollSegment(y){
  if(!sectionAnchors.length) return [0,0,0];
  if(y<=sectionAnchors[0].y) return [0,0,0];
  const last=sectionAnchors.length-1;
  if(y>=sectionAnchors[last].y) return [last,last,0];
  for(let i=0;i<last;i++){
    const a=sectionAnchors[i].y,b=sectionAnchors[i+1].y;
    if(y>=a && y<=b){
      const raw=(y-a)/(b-a);
      return [i,i+1,smooth(raw)];
    }
  }
  return [0,0,0];
}

function applyScrollWorld(y){
  const [ia,ib,t]=scrollSegment(y);
  const a=keyframes[ia],b=keyframes[ib];
  const cam=mixArray(a.cam,b.cam,t), tar=mixArray(a.target,b.target,t);
  camera.position.set(...cam); cameraTarget.set(...tar);
  mixFX(a.fx,b.fx,t);
  bloom.strength=mix(a.bloom,b.bloom,t);
  const rs=mix(a.roomScale,b.roomScale,t); classroom.scale.setScalar(rs);
  classroom.position.set(...mixArray(a.roomPos,b.roomPos,t));
  scanCone.rotation.y=mix(a.scanY,b.scanY,t); scanCone.position.z=mix(a.scanZ,b.scanZ,t);
  screenMat.emissiveIntensity=mix(a.screenGlow,b.screenGlow,t);
  const rr=mixArray(a.rigRot,b.rigRot,t); remoteRig.rotation.set(rr[0],rr[1]+(remoteRig.userData.manualRotationY||0),rr[2]);
  floorGrid.material.opacity=mix(ia>=5?.08:.28,ib>=5?.08:.28,t);

  const maxScroll=Math.max(1,document.documentElement.scrollHeight-innerHeight);
  $('#railProgress').style.transform=`scaleY(${clamp(y/maxScroll)})`;
  const active=t>.5?ib:ia;
  const section=sceneSections[active] || sceneSections[0];
  if(section){
    $('#sceneIndex').textContent=section.dataset.index; $('#sceneName').textContent=section.dataset.name;
    if(active!==lastAudibleScene){ playUISound(250+active*38,.18,.035); lastAudibleScene=active; }
  }
}

addEventListener('scroll',()=>{ targetScrollY=window.scrollY; },{passive:true});
$$('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{
  const target=$(link.getAttribute('href'));
  if(!target) return;
  event.preventDefault();
  target.scrollIntoView({behavior:reducedMotion?'auto':'smooth',block:'start'});
  history.replaceState(null,'',link.getAttribute('href'));
}));

// Text / glass cards reveal when they enter the viewport.
const revealObserver=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting) entry.target.classList.add('is-visible');
    else if(entry.boundingClientRect.top>innerHeight*.55) entry.target.classList.remove('is-visible');
  });
},{threshold:.12,rootMargin:'0px 0px -8% 0px'});
$$('.reveal').forEach(el=>revealObserver.observe(el));

// Small UI details
const cursorDot=$('#cursorDot');
if(matchMedia('(pointer:fine)').matches){
  addEventListener('pointermove',e=>{cursorDot.style.opacity='.8';cursorDot.style.left=e.clientX+'px';cursorDot.style.top=e.clientY+'px';});
  $$('a').forEach(a=>a.addEventListener('mouseenter',()=>{cursorDot.style.transform='translate(-50%,-50%) scale(3)';}));
  $$('a').forEach(a=>a.addEventListener('mouseleave',()=>{cursorDot.style.transform='translate(-50%,-50%) scale(1)';}));
  $$('.magnetic-btn,.cta-button').forEach(button=>{
    button.addEventListener('pointermove',event=>{
      const rect=button.getBoundingClientRect();
      const x=(event.clientX-rect.left)/rect.width-.5, y=(event.clientY-rect.top)/rect.height-.5;
      button.style.transform=`translate(${x*8}px,${y*6}px)`;
    });
    button.addEventListener('pointerleave',()=>{ button.style.transform=''; });
  });
}

// Âm thanh tổng hợp bằng Web Audio: nhẹ, không cần tải tệp âm thanh ngoài.
const interactionToggle=$('#interactionToggle');
const soundToggle=$('#soundToggle');
const soundLabel=$('#soundLabel');
let audioContext=null;
let masterGain=null;
let audioEnabled=false;
let ambientStarted=false;

function ensureAudio(){
  if(!audioContext){
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext) return false;
    audioContext=new AudioContext();
    masterGain=audioContext.createGain(); masterGain.gain.value=0; masterGain.connect(audioContext.destination);
  }
  audioContext.resume();
  if(!ambientStarted){
    const padGain=audioContext.createGain(); padGain.gain.value=.035; padGain.connect(masterGain);
    const filter=audioContext.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=420; filter.Q.value=.7; filter.connect(padGain);
    [55,82.5,110].forEach((frequency,index)=>{
      const osc=audioContext.createOscillator(); const gain=audioContext.createGain();
      osc.type=index===1?'triangle':'sine'; osc.frequency.value=frequency; gain.gain.value=index===0?.52:index===1?.25:.12;
      osc.connect(gain).connect(filter); osc.start();
    });
    const lfo=audioContext.createOscillator(),lfoGain=audioContext.createGain();
    lfo.frequency.value=.09; lfoGain.gain.value=.009; lfo.connect(lfoGain).connect(padGain.gain); lfo.start();
    ambientStarted=true;
  }
  return true;
}
function playUISound(frequency=420,duration=.1,volume=.055){
  if(!audioEnabled||!ensureAudio()) return;
  const now=audioContext.currentTime,osc=audioContext.createOscillator(),gain=audioContext.createGain();
  osc.type='sine'; osc.frequency.setValueAtTime(frequency,now); osc.frequency.exponentialRampToValueAtTime(frequency*1.18,now+duration);
  gain.gain.setValueAtTime(.0001,now); gain.gain.exponentialRampToValueAtTime(volume,now+.012); gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
  osc.connect(gain).connect(masterGain); osc.start(now); osc.stop(now+duration+.02);
}
function setAudioEnabled(enabled){
  if(enabled&&!ensureAudio()) return;
  audioEnabled=enabled;
  soundToggle.setAttribute('aria-pressed',String(enabled));
  soundLabel.textContent=enabled?'Không gian đang phát':'Đang tắt';
  if(masterGain){ const now=audioContext.currentTime; masterGain.gain.cancelScheduledValues(now); masterGain.gain.linearRampToValueAtTime(enabled ? .32 : 0,now+.45); }
}
soundToggle.addEventListener('click',()=>setAudioEnabled(!audioEnabled));
interactionToggle.addEventListener('click',()=>{
  const enabled=!document.body.classList.contains('interaction-mode');
  document.body.classList.toggle('interaction-mode',enabled);
  interactionToggle.setAttribute('aria-pressed',String(enabled));
  interactionToggle.querySelector('small').textContent=enabled?'Kéo trực tiếp trên lớp học':'Bấm để kéo vật thể';
  if(!enabled) closeObjectInspector();
  playUISound(enabled?560:320,.13,.065);
});
addEventListener('keydown',event=>{
  if(event.key==='Escape'&&document.body.classList.contains('interaction-mode')) interactionToggle.click();
});
document.addEventListener('pointerdown',event=>{
  const control=event.target.closest('button,a');
  if(!control) return;
  const ripple=document.createElement('i'); ripple.className='click-ripple'; ripple.style.left=`${event.clientX}px`; ripple.style.top=`${event.clientY}px`; document.body.appendChild(ripple);
  ripple.addEventListener('animationend',()=>ripple.remove(),{once:true});
  playUISound(440+Math.random()*90,.085,.045);
});

// Bảng học liệu và trợ lý giọng nói trong phòng dạy 3D.
const lessonFileInput=$('#lessonFileInput');
const fileFeedback=$('#fileFeedback');
const voiceConsole=$('#voiceConsole');
const voiceTrigger=$('#voiceTrigger');
const voiceStatus=$('#voiceStatus');
const normalFileTypes='.pdf,.ppt,.pptx,.doc,.docx,image/*';

function openLessonPicker(imagesOnly=false){
  lessonFileInput.accept=imagesOnly?'image/*':normalFileTypes;
  lessonFileInput.click();
}
$('#openLessonFile').addEventListener('click',()=>openLessonPicker(false));
$('#openLessonImage').addEventListener('click',()=>openLessonPicker(true));
lessonFileInput.addEventListener('change',()=>{
  const file=lessonFileInput.files?.[0];
  if(!file) return;
  fileFeedback.textContent=`Đã mở: ${file.name}`;
  fileFeedback.classList.add('has-file');
  voiceStatus.textContent=`Đã đưa “${file.name}” vào bài giảng.`;
});

function runVoiceCommand(rawCommand){
  const command=rawCommand.toLocaleLowerCase('vi');
  const studentMatch=command.match(/học sinh\s*(\d{1,2})/);
  if(studentMatch){
    const index=clamp(Number(studentMatch[1])-1,0,students.length-1);
    if(!document.body.classList.contains('interaction-mode')) interactionToggle.click();
    selectObject(students[index]);
    voiceStatus.textContent=`Đã chọn học sinh ${String(index+1).padStart(2,'0')}. Bạn có thể nói “sang trái” hoặc kéo trực tiếp.`;
  }else if(command.includes('chọn giáo viên')||command.includes('cô giáo')){
    if(!document.body.classList.contains('interaction-mode')) interactionToggle.click();
    selectObject(teacher); voiceStatus.textContent='Đã chọn cô giáo Lan.';
  }else if(selectedObject&&(command.includes('sang trái')||command.includes('sang phải')||command.includes('tiến lên')||command.includes('lùi lại'))){
    if(command.includes('sang trái')) selectedObject.position.x-=.65;
    if(command.includes('sang phải')) selectedObject.position.x+=.65;
    if(command.includes('tiến lên')) selectedObject.position.z-=.65;
    if(command.includes('lùi lại')) selectedObject.position.z+=.65;
    updateObjectInspector(); voiceStatus.textContent=`Đã di chuyển ${selectedObject.userData.displayName}.`;
  }else if(command.includes('mở tệp')||command.includes('mở file')||command.includes('tài liệu')){
    voiceStatus.textContent='Đã nhận lệnh mở học liệu.';
    openLessonPicker(false);
  }else if(command.includes('hình ảnh')||command.includes('mở ảnh')){
    voiceStatus.textContent='Đang mở thư viện hình ảnh.';
    openLessonPicker(true);
  }else if(command.includes('bắt đầu')||command.includes('mở mô hình')||command.includes('tế bào')){
    modelUserScale=1; modelSpinSpeed=1; modelExplode=0;
    voiceStatus.textContent='Đã mở mô hình tế bào. Bắt đầu bài giảng 3D.';
  }else if(command.includes('phóng to')||command.includes('to lên')){
    modelUserScale=1.28;
    voiceStatus.textContent='Đã phóng to mô hình tế bào.';
  }else if(command.includes('thu nhỏ')||command.includes('nhỏ lại')){
    modelUserScale=.78;
    voiceStatus.textContent='Đã thu nhỏ mô hình tế bào.';
  }else if(command.includes('tách lớp')||command.includes('cấu tạo')){
    modelExplode=modelExplode>.2?0:1;
    voiceStatus.textContent=modelExplode?'Đang tách các thành phần của tế bào.':'Đã đưa mô hình về trạng thái hoàn chỉnh.';
  }else if((command.includes('dừng')||command.includes('ngừng'))&&(command.includes('xoay')||command.includes('quay'))){
    modelSpinSpeed=0;
    voiceStatus.textContent='Đã dừng xoay mô hình.';
  }else if(command.includes('xoay')||command.includes('quay')){
    modelSpinSpeed=modelSpinSpeed>1.5?1:3.2;
    voiceStatus.textContent=modelSpinSpeed>1.5?'Đã tăng tốc độ xoay mô hình.':'Đã đưa tốc độ xoay về bình thường.';
  }else{
    voiceStatus.textContent=`Đã nghe: “${rawCommand}”. Bạn có thể nói “xoay mô hình” hoặc “mở tệp”.`;
  }
}

const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
let recognition=null;
if(SpeechRecognition){
  recognition=new SpeechRecognition();
  recognition.lang='vi-VN'; recognition.interimResults=false; recognition.continuous=false;
  recognition.addEventListener('start',()=>{
    voiceConsole.classList.add('is-listening'); voiceTrigger.setAttribute('aria-pressed','true');
    voiceStatus.textContent='Đang lắng nghe yêu cầu của giáo viên...';
  });
  recognition.addEventListener('result',event=>runVoiceCommand(event.results[0][0].transcript));
  recognition.addEventListener('end',()=>{
    voiceConsole.classList.remove('is-listening'); voiceTrigger.setAttribute('aria-pressed','false');
  });
  recognition.addEventListener('error',event=>{
    voiceStatus.textContent=event.error==='not-allowed'?'Hãy cấp quyền micro để điều khiển bằng giọng nói.':'Chưa nghe rõ, vui lòng thử lại.';
  });
}
voiceTrigger.addEventListener('click',()=>{
  if(!recognition){ voiceStatus.textContent='Trình duyệt này chưa hỗ trợ nhận giọng nói. Bạn vẫn có thể dùng các nút điều khiển.'; return; }
  try{ recognition.start(); }catch{ recognition.stop(); }
});

$$('.model-controls button').forEach((button,index)=>button.addEventListener('click',()=>{
  if(index===0){ modelSpinSpeed=modelSpinSpeed>1.5?1:3.2; voiceStatus.textContent='Đã đổi tốc độ xoay mô hình.'; }
  if(index===1){ modelUserScale=modelUserScale>1.1?.82:1.28; voiceStatus.textContent=modelUserScale>1?'Đã phóng to mô hình.':'Đã đưa mô hình về kích thước vừa.'; }
  if(index===2){ modelExplode=modelExplode>.2?0:1; voiceStatus.textContent=modelExplode?'Đang tách lớp cấu tạo tế bào.':'Đã ghép lại mô hình tế bào.'; }
}));
$$('.mode-switch button').forEach(button=>button.addEventListener('click',()=>{
  $$('.mode-switch button').forEach(item=>item.classList.toggle('is-active',item===button));
}));

// Chọn, kéo và chỉnh từng nhân vật/vật thể bằng raycasting của Three.js.
const objectInspector=$('#objectInspector');
const objectName=$('#objectName');
const objectDescription=$('#objectDescription');
const objectPosition=$('#objectPosition');
const raycaster=new THREE.Raycaster();
const pointer=new THREE.Vector2();
const dragPlane=new THREE.Plane();
const dragPoint=new THREE.Vector3();
const dragOffset=new THREE.Vector3();
const worldPosition=new THREE.Vector3();
let selectedObject=null;
let selectionHelper=null;
let draggingObject=false;

function updatePointer(event){
  pointer.x=event.clientX/innerWidth*2-1;
  pointer.y=-(event.clientY/innerHeight)*2+1;
  raycaster.setFromCamera(pointer,camera);
}
function interactiveRoot(object){
  let current=object;
  while(current&&current!==scene){ if(current.userData.interactive) return current; current=current.parent; }
  return null;
}
function updateObjectInspector(){
  if(!selectedObject) return;
  objectName.textContent=selectedObject.userData.displayName;
  objectDescription.textContent=selectedObject.userData.description;
  objectPosition.textContent=`${selectedObject.userData.kind} · X ${selectedObject.position.x.toFixed(2)} · Z ${selectedObject.position.z.toFixed(2)}`;
}
function selectObject(object){
  selectedObject=object;
  if(selectionHelper) scene.remove(selectionHelper);
  selectionHelper=new THREE.BoxHelper(object,0x68fff0);
  selectionHelper.material.transparent=true; selectionHelper.material.opacity=.72; selectionHelper.material.depthTest=false;
  selectionHelper.renderOrder=999; scene.add(selectionHelper);
  objectInspector.classList.add('is-open'); objectInspector.setAttribute('aria-hidden','false'); updateObjectInspector();
  anime.remove(objectInspector);
  anime({targets:objectInspector,opacity:[0,1],translateY:[22,0],scale:[.96,1],duration:480,easing:'easeOutExpo'});
}
function closeObjectInspector(){
  draggingObject=false; document.body.classList.remove('is-dragging-3d');
  if(selectionHelper){ scene.remove(selectionHelper); selectionHelper=null; }
  selectedObject=null;
  anime.remove(objectInspector);
  anime({targets:objectInspector,opacity:0,translateY:18,scale:.97,duration:280,easing:'easeInQuad',complete:()=>{
    objectInspector.classList.remove('is-open'); objectInspector.setAttribute('aria-hidden','true');
  }});
}

canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0) return;
  updatePointer(event);
  const hit=raycaster.intersectObjects(interactables,true).find(item=>interactiveRoot(item.object));
  if(!hit){ closeObjectInspector(); return; }
  const root=interactiveRoot(hit.object); selectObject(root);
  root.getWorldPosition(worldPosition);
  dragPlane.set(new THREE.Vector3(0,1,0),-worldPosition.y);
  if(raycaster.ray.intersectPlane(dragPlane,dragPoint)) dragOffset.copy(dragPoint).sub(worldPosition);
  draggingObject=true; document.body.classList.add('is-dragging-3d'); canvas.setPointerCapture?.(event.pointerId); event.preventDefault();
});
canvas.addEventListener('pointermove',event=>{
  updatePointer(event);
  if(!draggingObject||!selectedObject){
    const hovering=raycaster.intersectObjects(interactables,true).some(item=>interactiveRoot(item.object));
    canvas.style.cursor=hovering?'grab':''; return;
  }
  if(!raycaster.ray.intersectPlane(dragPlane,dragPoint)) return;
  const desiredWorld=dragPoint.sub(dragOffset);
  const localPoint=selectedObject.parent.worldToLocal(desiredWorld.clone());
  selectedObject.position.x=localPoint.x;
  selectedObject.position.z=localPoint.z;
  if(!students.includes(selectedObject)) selectedObject.position.y=localPoint.y;
  updateObjectInspector(); selectionHelper?.update(); event.preventDefault();
});
function endObjectDrag(event){
  if(!draggingObject) return;
  draggingObject=false; document.body.classList.remove('is-dragging-3d'); canvas.releasePointerCapture?.(event.pointerId);
}
canvas.addEventListener('pointerup',endObjectDrag);
canvas.addEventListener('pointercancel',endObjectDrag);
$('#closeInspector').addEventListener('click',closeObjectInspector);
$('#rotateObject').addEventListener('click',()=>{
  if(!selectedObject) return;
  if(selectedObject===teacher||selectedObject===solar||selectedObject===agentGroup||selectedObject===remoteRig){
    anime({targets:selectedObject.userData,manualRotationY:(selectedObject.userData.manualRotationY||0)+Math.PI/2,duration:900,easing:'easeInOutCubic'});
  }else{
    anime({targets:selectedObject.rotation,y:selectedObject.rotation.y+Math.PI/2,duration:900,easing:'easeInOutCubic'});
  }
});
$('#resetObject').addEventListener('click',()=>{
  if(!selectedObject) return;
  const initial=selectedObject.userData.initialTransform;
  selectedObject.userData.manualRotationY=0;
  anime({targets:selectedObject.position,x:initial.position.x,y:initial.position.y,z:initial.position.z,duration:850,easing:'easeOutExpo',update:updateObjectInspector});
  anime({targets:selectedObject.rotation,x:initial.rotation.x,y:initial.rotation.y,z:initial.rotation.z,duration:850,easing:'easeOutExpo'});
});

// -----------------------------------------------------------------------------
// Render loop
// -----------------------------------------------------------------------------
const clock=new THREE.Clock();
function render(){
  const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;
  const damping = reducedMotion ? 1 : .075;
  smoothScrollY += (targetScrollY - smoothScrollY) * damping;
  applyScrollWorld(smoothScrollY);
  starField.rotation.y=t*.005;
  starField.position.y=Math.sin(t*.08)*.14;
  students.forEach((student,i)=>{
    const p=student.userData.phase;
    student.position.y=student.userData.baseY+Math.sin(t*(.6+(i%3)*.07)+p)*.018;
    student.rotation.z=Math.sin(t*.42+p)*.006;
  });
  teacher.rotation.y=(teacher.userData.manualRotationY||0)+Math.sin(t*.32)*.035;
  if(teacher.userData.arm) teacher.userData.arm.rotation.z=-.82+Math.sin(t*.9)*.2;
  if(teacher.userData.leftArm) teacher.userData.leftArm.rotation.z=.62+Math.sin(t*.72+1.4)*.16;
  agentGroup.rotation.y=t*.45+(agentGroup.userData.manualRotationY||0);
  agentGroup.children.forEach((o,i)=>{ if(o.geometry?.type==='TorusGeometry') o.rotation.z=t*(.2+i*.05); });
  planets.forEach(p=>{ const a=t*p.userData.speed*modelSpinSpeed+p.userData.phase,r=p.userData.radius*(1+modelExplode*.38); p.position.set(Math.cos(a)*r,Math.sin(a*.72)*r*.38,Math.sin(a)*r); p.rotation.set(a*.4,a,a*.25); });
  solar.rotation.y=t*.16*modelSpinSpeed+(solar.userData.manualRotationY||0); solar.rotation.x=Math.sin(t*.24)*.08;
  cellShell.rotation.y=-t*.24*modelSpinSpeed; cellShell.rotation.z=t*.12;
  physicsWorld.step(1/60,dt,3);
  bioParticles.forEach(({body,visual})=>{
    if(body.position.lengthSquared()>1.55){
      body.position.scale(.94,body.position);
      body.velocity.x*=-1; body.velocity.y*=-1; body.velocity.z*=-1;
    }
    visual.position.copy(body.position);
  });
  remoteRig.children.forEach((o,i)=>{ if(o.geometry?.type==='TorusGeometry') o.rotation.z=t*(.13+i*.04); });
  core.rotation.y=t*.16; coreShell.rotation.x=t*.1; coreShell.rotation.z=-t*.08;
  coreNodes.forEach((n,i)=>{ const s=1+Math.sin(t*2+i)*.22; n.scale.setScalar(s); });
  if(fx.scan>0){
    scanCone.rotation.z=Math.sin(t*.8)*.08;
    const pulse=(t*.32)%1; scanPulse.scale.setScalar(.35+pulse*.92); scanPulse.scale.z*=.72;
    scanPulseMat.opacity=(1-pulse)*.34*fx.scan;
  }
  applyFX();
  selectionHelper?.update();
  camera.lookAt(cameraTarget);
  composer.render();
  requestAnimationFrame(render);
}
render();

function onResize(){
  resizeIntroCanvas();
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6)); renderer.setSize(innerWidth,innerHeight);
  composer.setSize(innerWidth,innerHeight);
  computeAnchors();
}

addEventListener('resize',onResize);
