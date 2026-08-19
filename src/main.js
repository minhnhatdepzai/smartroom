import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import anime from 'animejs';
import * as CANNON from 'cannon-es';
import { buildStudent, buildTeacher, teacherAnchor, setCharacterQuality } from './characters.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PRODUCT_URL = 'https://properly-pursuable-compile.ngrok-free.dev/';
const HUMAN_MODEL_URL = '/assets/michelle.glb';
const INTRO_KEY = 'eduvision-intro-seen';

$$('[data-product-link]').forEach((link) => { link.href = PRODUCT_URL; });

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
let introFailSafe = 0;
let introSeen = false;
try { introSeen = sessionStorage.getItem(INTRO_KEY) === '1'; } catch { /* storage can be blocked */ }
const INTRO_TIMELINE_DURATION = 6.55;
const INTRO_DURATION = reducedMotion ? .3 : 3.25;
const INTRO_TIME_SCALE = INTRO_TIMELINE_DURATION / INTRO_DURATION;

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
  const elapsed=(now-introStart)/1000;
  const t=elapsed*INTRO_TIME_SCALE;
  const p=clamp(elapsed/INTRO_DURATION);
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

  if(elapsed<INTRO_DURATION) introRaf=requestAnimationFrame(introTick);
  else finishIntro();
}

function startIntro(){
  if(introSeen){ finishIntro(); return; }
  introStart=performance.now();
  introRaf=requestAnimationFrame(introTick);
}
function finishIntro(){
  if(introFinished) return;
  introFinished=true;
  cancelAnimationFrame(introRaf);
  clearTimeout(introFailSafe);
  try { sessionStorage.setItem(INTRO_KEY,'1'); } catch { /* storage can be blocked */ }
  document.body.classList.add('site-ready');
  document.body.classList.remove('intro-lock');
  intro.style.transition = reducedMotion ? 'none' : 'opacity .9s cubic-bezier(.16,1,.3,1)';
  requestAnimationFrame(() => { intro.style.opacity = '0'; });
  setTimeout(() => intro.remove(), reducedMotion ? 0 : 950);
}
skipIntro.addEventListener('click',finishIntro);

introFailSafe=setTimeout(finishIntro,reducedMotion?600:4600);
Promise.all([logoMain.decode().catch(()=>{}),...ghosts.map(g=>g.decode().catch(()=>{}))]).then(startIntro,finishIntro);

// -----------------------------------------------------------------------------
// WebGL world
// -----------------------------------------------------------------------------
const canvas = $('#webgl');
const mobileLayout=()=>innerWidth<=900;
const deviceMemory=navigator.deviceMemory||8;
const logicalCores=navigator.hardwareConcurrency||8;
const preliminaryLowEnd=(mobileLayout()&&deviceMemory<=4)||logicalCores<=4;
const renderer = new THREE.WebGLRenderer({canvas,antialias:!preliminaryLowEnd,alpha:false,powerPreference:'high-performance',precision:'highp'});
const gl=renderer.getContext();
const debugRendererInfo=gl.getExtension('WEBGL_debug_renderer_info');
const gpuName=(debugRendererInfo?gl.getParameter(debugRendererInfo.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)||'').toLowerCase();
const strongGPU=/rtx|radeon rx|apple m[1-9]|arc\(tm\)|geforce gtx 1[6-9]/.test(gpuName);
const weakGPU=/swiftshader|llvmpipe|mali-[tg][0-5]|adreno \(tm\) [3-5]|intel\(r\) hd graphics/.test(gpuName);
const qualityTier=preliminaryLowEnd||weakGPU?'low':strongGPU||(!mobileLayout()&&deviceMemory>=8&&logicalCores>=8&&renderer.capabilities.maxTextureSize>=8192)?'high':'medium';
const maximumPixelRatio=qualityTier==='high'?2:qualityTier==='medium'?1.45:1;
const maxAnisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),qualityTier==='high'?16:qualityTier==='medium'?8:2);
let adaptivePixelRatio=Math.min(devicePixelRatio||1,maximumPixelRatio);
renderer.setPixelRatio(adaptivePixelRatio);
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=qualityTier==='low'?1.16:1.22;
renderer.shadowMap.enabled=qualityTier!=='low';
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate=true;
canvas.dataset.quality=qualityTier;
// Nhân vật cache hình học nên phải chốt mức chi tiết trước khi dựng.
setCharacterQuality(qualityTier);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050b12);
scene.fog = new THREE.FogExp2(0x050b12,.032);
const camera = new THREE.PerspectiveCamera(mobileLayout()?52:42,innerWidth/innerHeight,.1,120);
camera.position.set(0,5.1,14.5);
const cameraTarget = new THREE.Vector3(0,1.45,-.6);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.64,.72,.78);
bloom.enabled=qualityTier!=='low';
composer.addPass(bloom);

const hemi = new THREE.HemisphereLight(0xe0f6ff,0x17212a,1.42);
scene.add(hemi);
const keyLight = new THREE.DirectionalLight(0xdaf8ff,3.05);
keyLight.position.set(-5,8,5); keyLight.castShadow=true;
const shadowResolution=qualityTier==='high'?2048:1024;
keyLight.shadow.mapSize.set(shadowResolution,shadowResolution);
keyLight.shadow.camera.near=.5; keyLight.shadow.camera.far=30;
keyLight.shadow.camera.left=-11; keyLight.shadow.camera.right=11; keyLight.shadow.camera.top=11; keyLight.shadow.camera.bottom=-11;
keyLight.shadow.bias=-.00035; keyLight.shadow.normalBias=.025; scene.add(keyLight);
const violetLight = new THREE.PointLight(0x8f4fff,8,24,2); violetLight.position.set(7,3,-1); scene.add(violetLight);
const cyanLight = new THREE.PointLight(0x37e9db,7,22,2); cyanLight.position.set(-6,3,2); scene.add(cyanLight);
const warmLight = new THREE.PointLight(0xffd3a0,0,20,2); warmLight.position.set(-3,4,-2); scene.add(warmLight);
const classroomFill=new THREE.DirectionalLight(0xfff3df,1.65); classroomFill.position.set(5,6,8); scene.add(classroomFill);
const selectedCharacterLight=new THREE.PointLight(0x9affed,0,7,2); scene.add(selectedCharacterLight);
const selectedCharacterBeam=mesh(new THREE.CylinderGeometry(.34,.56,3.1,24,1,true),new THREE.MeshBasicMaterial({color:0x62f3e4,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending})); selectedCharacterBeam.castShadow=false; selectedCharacterBeam.receiveShadow=false; scene.add(selectedCharacterBeam);

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
function earthBoardTexture(){
  const c=document.createElement('canvas'); c.width=1400; c.height=660; const x=c.getContext('2d');
  const bg=x.createLinearGradient(0,0,c.width,c.height); bg.addColorStop(0,'#061b2b'); bg.addColorStop(.56,'#08223a'); bg.addColorStop(1,'#140c31'); x.fillStyle=bg; x.fillRect(0,0,c.width,c.height);
  x.strokeStyle='rgba(126,221,255,.12)'; x.lineWidth=2;
  for(let i=0;i<c.width;i+=90){x.beginPath();x.moveTo(i,0);x.lineTo(i,c.height);x.stroke();}
  for(let i=0;i<c.height;i+=74){x.beginPath();x.moveTo(0,i);x.lineTo(c.width,i);x.stroke();}
  const glow=x.createRadialGradient(920,320,10,920,320,250); glow.addColorStop(0,'rgba(68,210,255,.34)'); glow.addColorStop(1,'rgba(68,210,255,0)'); x.fillStyle=glow; x.fillRect(620,20,600,600);
  x.fillStyle='rgba(231,251,255,.95)'; x.font='600 52px system-ui'; x.fillText('TRÁI ĐẤT · HỆ SINH THÁI ĐỘNG',76,108);
  x.fillStyle='rgba(121,229,255,.76)'; x.font='28px system-ui'; x.fillText('MÔ HÌNH NHIỀU LỚP · KHÍ QUYỂN · KHÍ HẬU · ĐÊM / NGÀY',78,156);
  x.strokeStyle='rgba(106,231,255,.62)'; x.lineWidth=5; x.beginPath(); x.arc(930,350,176,0,Math.PI*2); x.stroke();
  x.strokeStyle='rgba(138,117,255,.52)'; x.lineWidth=3; x.beginPath(); x.ellipse(930,350,258,82,-.18,0,Math.PI*2); x.stroke();
  x.fillStyle='rgba(108,219,246,.2)'; x.beginPath(); x.arc(930,350,168,0,Math.PI*2); x.fill();
  x.fillStyle='rgba(213,245,255,.72)'; x.font='24px system-ui'; x.fillText('Mây & khí quyển',1110,282); x.fillText('Ánh sáng đô thị',1095,432);
  const texture=new THREE.CanvasTexture(c); texture.colorSpace=THREE.SRGBColorSpace; return texture;
}

// Global particle field
const pCount=qualityTier==='low'?180:qualityTier==='medium'?380:680, pPos=new Float32Array(pCount*3);
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
const windowGlow=new THREE.PointLight(0xc7edff,5.2,15,2); windowGlow.position.set(7.7,3.2,1.8); classroom.add(windowGlow);
for(let i=0;i<3;i++){
  const z=-3.5+i*3.55;
  classroom.add(mesh(new THREE.PlaneGeometry(2.55,3.35),windowMat,[8.34,3.35,z],[0,-Math.PI/2,0]));
  classroom.add(mesh(new THREE.BoxGeometry(.08,3.58,2.78),trimMat,[8.27,3.35,z]));
  classroom.add(mesh(new THREE.BoxGeometry(.11,.08,2.68),trimMat,[8.22,3.35,z]));
}

const screenMat=standard(0x101722,{roughness:.28,metalness:.4,emissive:0x0d8694,emissiveIntensity:.45});
const screen=mesh(new THREE.BoxGeometry(8.15,4.25,.22),screenMat,[0,3.2,-6.92]); classroom.add(screen);
const screenInner=mesh(new THREE.PlaneGeometry(7.65,3.72),new THREE.MeshBasicMaterial({map:boardTexture(),transparent:true,opacity:.96}),[0,3.2,-6.795]); classroom.add(screenInner);
const earthScreenMaterial=new THREE.MeshBasicMaterial({map:earthBoardTexture(),transparent:true,opacity:0,depthWrite:false});
const earthScreen=mesh(new THREE.PlaneGeometry(7.65,3.72),earthScreenMaterial,[0,3.2,-6.782]); earthScreen.renderOrder=2; classroom.add(earthScreen);
const boardLed=new THREE.PointLight(0x54d7e5,1.8,7,2); boardLed.position.set(0,3.1,-6.15); classroom.add(boardLed);

const desks=[]; const students=[]; const seats=[]; const halos=[];
const deskTopMat=standard(0x8a6043,{roughness:.48,metalness:.05});
const legMat=standard(0x182127,{roughness:.38,metalness:.65});
const bookMat=standard(0x306f89,{roughness:.7});
// -----------------------------------------------------------------------------
// Nhân vật lớp học — dựng bằng code trong src/characters.js: thân và đầu là mặt
// loft liền (không còn khớp cầu), tay chân là ống đi theo đường cong, da/vải/tóc
// dùng MeshPhysicalMaterial với normal map sinh theo thủ tục. Chỉnh dáng người,
// tóc, trang phục và tỉ lệ cơ thể ở file đó.
// -----------------------------------------------------------------------------

const humanLoader=new GLTFLoader();
const rigUpperWorld=new THREE.Vector3();
const rigLowerWorld=new THREE.Vector3();
const rigCurrentDirection=new THREE.Vector3();
const rigTargetDirection=new THREE.Vector3();
const rigWorldDelta=new THREE.Quaternion();
const rigUpperWorldQuaternion=new THREE.Quaternion();
const rigParentWorldQuaternion=new THREE.Quaternion();
function storeRigRestPose(bones){
  Object.values(bones).filter(Boolean).forEach((bone)=>{
    bone.userData.restPosition=bone.position.clone();
    bone.userData.restQuaternion=bone.quaternion.clone();
    bone.userData.restRotation=bone.rotation.clone();
  });
}
function resetRigPose(bones){
  Object.values(bones||{}).filter(Boolean).forEach((bone)=>{
    if(bone.userData.restPosition) bone.position.copy(bone.userData.restPosition);
    if(bone.userData.restQuaternion) bone.quaternion.copy(bone.userData.restQuaternion);
    else if(bone.userData.restRotation) bone.rotation.copy(bone.userData.restRotation);
  });
}
function orientRigLimb(root,upper,lower,targetDirection){
  if(!upper||!lower) return;
  root.updateMatrixWorld(true);
  upper.getWorldPosition(rigUpperWorld);
  lower.getWorldPosition(rigLowerWorld);
  rigCurrentDirection.copy(rigLowerWorld).sub(rigUpperWorld).normalize();
  rigWorldDelta.setFromUnitVectors(rigCurrentDirection,targetDirection);
  upper.getWorldQuaternion(rigUpperWorldQuaternion);
  rigWorldDelta.multiply(rigUpperWorldQuaternion);
  upper.parent.getWorldQuaternion(rigParentWorldQuaternion).invert();
  upper.quaternion.copy(rigParentWorldQuaternion.multiply(rigWorldDelta)).normalize();
  root.updateMatrixWorld(true);
}
function aimRigLimbDown(model,upper,lower,sideSign){
  if(!upper||!lower) return;
  model.updateMatrixWorld(true);
  upper.getWorldPosition(rigUpperWorld);
  lower.getWorldPosition(rigLowerWorld);
  rigCurrentDirection.copy(rigLowerWorld).sub(rigUpperWorld).normalize();
  const outward=Math.sign(rigCurrentDirection.x)||sideSign;
  rigTargetDirection.set(outward*.17,-.982,rigCurrentDirection.z*.055).normalize();
  orientRigLimb(model,upper,lower,rigTargetDirection);
}
function createTeacherCharacter(gltf){
  const model=gltf.scene;
  model.name='MichelleTeacher';

  // TPose chỉ được dùng làm mốc rig tĩnh. SambaDance tuyệt đối không được phát.
  const tPose=gltf.animations.find((clip)=>clip.name==='TPose');
  if(tPose){
    const mixer=new THREE.AnimationMixer(model);
    const action=mixer.clipAction(tPose);
    action.play();
    mixer.setTime(Math.min(.05,tPose.duration));
    action.paused=true;
    model.userData.referenceMixer=mixer;
  }

  model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model);
  const size=bounds.getSize(new THREE.Vector3());
  const scale=2.14/Math.max(size.y,.001);
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);
  bounds.setFromObject(model);
  const center=bounds.getCenter(new THREE.Vector3());
  model.position.x-=center.x;
  model.position.z-=center.z;
  model.position.y-=bounds.min.y;

  model.traverse((object)=>{
    if(!object.isMesh) return;
    object.castShadow=qualityTier!=='low';
    object.receiveShadow=true;
    object.frustumCulled=false;
    if(object.isSkinnedMesh) object.normalizeSkinWeights();
    const source=Array.isArray(object.material)?object.material:[object.material];
    const materials=source.map((material)=>{
      const next=material.clone();
      next.metalness=0;
      next.roughness=Math.max(.56,next.roughness??.56);
      next.envMapIntensity=.72;
      if(next.map){ next.map.colorSpace=THREE.SRGBColorSpace; next.map.anisotropy=maxAnisotropy; }
      if(next.normalMap) next.normalMap.anisotropy=maxAnisotropy;
      next.needsUpdate=true;
      return next;
    });
    object.material=Array.isArray(object.material)?materials:materials[0];
  });

  // GLTFLoader làm sạch dấu ':' trong tên node, nên tra rig bằng tên chuẩn hóa
  // thay vì phụ thuộc nguyên văn tên Mixamo trong file nguồn.
  const rigNodes=new Map();
  model.traverse((object)=>{
    const normalized=object.name.replace(/[^a-z0-9]/gi,'').toLowerCase();
    if(normalized) rigNodes.set(normalized,object);
  });
  const get=(name)=>rigNodes.get(`mixamorig${name}`.toLowerCase());
  const bones={
    hips:get('Hips'),spine:get('Spine1')||get('Spine'),chest:get('Spine2'),neck:get('Neck'),head:get('Head'),
    leftArm:get('LeftArm'),leftForeArm:get('LeftForeArm'),leftHand:get('LeftHand'),
    rightArm:get('RightArm'),rightForeArm:get('RightForeArm'),rightHand:get('RightHand')
  };
  // Chuyển T-pose thành tư thế đứng trung tính bằng hướng xương trong world
  // space. Cách này không phụ thuộc trục Euler do phần mềm xuất GLB lựa chọn.
  aimRigLimbDown(model,bones.leftArm,bones.leftForeArm,-1);
  aimRigLimbDown(model,bones.rightArm,bones.rightForeArm,1);
  if(bones.leftForeArm) bones.leftForeArm.rotation.x-=.10;
  if(bones.rightForeArm) bones.rightForeArm.rotation.x+=.12;
  if(bones.hips) bones.hips.rotation.z+=.012;
  storeRigRestPose(bones);
  model.userData.bones=bones;
  return model;
}
async function loadHumanCharacter(teacherRoot,fallback){
  try{
    const gltf=await humanLoader.loadAsync(HUMAN_MODEL_URL);
    const model=createTeacherCharacter(gltf);
    teacherRoot.remove(fallback);
    teacherRoot.add(model);
    teacherRoot.userData.bones=model.userData.bones;
    teacherRoot.userData.characterMode='gltf';
    canvas.dataset.teacherModel='ready';
  }catch(error){
    teacherRoot.userData.characterMode='procedural-fallback';
    teacherRoot.userData.modelError=error instanceof Error?error.message:String(error);
    canvas.dataset.teacherModel='fallback';
  }
}

for(let row=0;row<3;row++){
  for(let col=0;col<4;col++){
    const x=(col-1.5)*3.45+(row%2?.35:0); const z=3.4-row*3.1;
    const dg=new THREE.Group();
    dg.add(mesh(new THREE.BoxGeometry(2.45,.16,1.18),deskTopMat,[0,.98,0]));
    dg.add(mesh(new THREE.BoxGeometry(2.12,.12,.16),standard(0x704a34,{roughness:.54}),[0,.88,.44]));
    [-.96,.96].forEach(lx=>[-.43,.43].forEach(lz=>dg.add(mesh(new THREE.BoxGeometry(.09,.96,.09),legMat,[lx,.48,lz]))));
    if((row+col)%2===0) dg.add(mesh(new THREE.BoxGeometry(.44,.055,.32),bookMat,[-.47,1.1,-.12],[0,(col%3-.5)*.35,0]));
    dg.position.set(x,0,z); classroom.add(dg); desks.push(dg);

    // Ghế hạ xuống cho đúng tỉ lệ với mặt bàn 1.06: mặt ngồi .63, lưng ghế chỉ
    // cao tới 1.25 nên vai, khăn quàng và đầu học sinh không bị che.
    const chair=new THREE.Group();
    chair.add(mesh(new THREE.BoxGeometry(.82,.09,.72),standard(0x263a43,{roughness:.52,metalness:.23}),[0,.585,.35]));
    chair.add(mesh(new THREE.BoxGeometry(.82,.6,.09),standard(0x263a43,{roughness:.52,metalness:.23}),[0,.95,.66]));
    [-.31,.31].forEach(lx=>[-.22,.54].forEach(lz=>chair.add(mesh(new THREE.BoxGeometry(.06,.6,.06),legMat,[lx,.3,lz]))));
    chair.position.set(x,0,z+.34); chair.rotation.y=(col%2?-.035:.035); classroom.add(chair); seats.push(chair);

    const index=row*4+col;
    const seatZ=z+.34;
    // Góc quay cần thiết để nhìn thẳng vào cô giáo, giới hạn ở ~57° để học
    // sinh không bị vặn người khỏi bàn.
    const aim=clamp(Math.atan2(-(teacherAnchor.x-x),-(teacherAnchor.z-seatZ)),-1,1);
    const {group:sg,bones}=buildStudent(index,aim);
    sg.position.set(x,0,seatZ);
    sg.rotation.y+=(col%2?-.035:.035);
    sg.userData={baseY:0,phase:row*1.7+col*.84,bones};
    classroom.add(sg); students.push(sg);

    const haloMat=new THREE.MeshBasicMaterial({color:0x55efe1,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
    haloMat.userData.baseOpacity=1;
    const halo=mesh(new THREE.TorusGeometry(.52,.014,8,64),haloMat,[x,2.12,seatZ],[Math.PI/2,0,0]); halo.scale.set(1,.58,1); classroom.add(halo); halos.push(halo);
  }
}

// ---------------------------------------------------------------------------
// Giáo viên dùng Michelle GLB làm visual chính. Bản procedural chỉ xuất hiện
// trong lúc tải hoặc khi asset lỗi, còn root bên ngoài được giữ ổn định để
// raycast/drag/return-home không phải đăng ký lại.
// ---------------------------------------------------------------------------
const teacher=new THREE.Group();
const teacherFallback=buildTeacher();
teacherFallback.rotation.y=Math.PI;
teacher.add(teacherFallback);
teacher.userData.bones=teacherFallback.userData.bones;
teacher.userData.characterMode='loading';
teacher.position.set(-2.75,0,-4.15); classroom.add(teacher);
loadHumanCharacter(teacher,teacherFallback);
const podium=mesh(new THREE.BoxGeometry(1.35,1.05,.75),standard(0x513a2c,{roughness:.48,metalness:.16}),[-4.65,.52,-4.6]); classroom.add(podium);

// Ánh sáng nhân vật tách khỏi neon UI: key ấm từ bảng, fill trung tính và rim
// xanh rất nhẹ để da/vải đọc tự nhiên mà vẫn hòa vào không gian công nghệ.
const teacherKeyLight=new THREE.SpotLight(0xffead2,qualityTier==='low'?2.2:3.8,10,Math.PI*.22,.72,1.35);
teacherKeyLight.position.set(-.5,5.1,-1.0); teacherKeyLight.target=teacher; teacherKeyLight.castShadow=qualityTier==='high'; classroom.add(teacherKeyLight);
const teacherRimLight=new THREE.PointLight(0x9ddfff,qualityTier==='low'?.7:1.35,6.5,2);
teacherRimLight.position.set(-3.6,3.1,-6.1); classroom.add(teacherRimLight);

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

// Mô hình tế bào thực vật 3D nổi giữa lớp, xuất hiện ở phân cảnh bài giảng.
// Tế bào thực vật có vách xenlulozơ nên hình hộp chứ không phải hình cầu, và
// không bào trung tâm chiếm phần lớn thể tích, đẩy nhân ép sát về một bên.
const solar=new THREE.Group(); scene.add(solar); solar.position.set(.8,3.28,-3.5); solar.scale.setScalar(.001);
function roundedBox(width,height,depth,radius,segments=4){
  const shape=new THREE.Shape();
  const w=width/2-radius,h=height/2-radius;
  shape.moveTo(-w-radius,-h);
  shape.lineTo(-w-radius,h); shape.quadraticCurveTo(-w-radius,h+radius,-w,h+radius);
  shape.lineTo(w,h+radius); shape.quadraticCurveTo(w+radius,h+radius,w+radius,h);
  shape.lineTo(w+radius,-h); shape.quadraticCurveTo(w+radius,-h-radius,w,-h-radius);
  shape.lineTo(-w,-h-radius); shape.quadraticCurveTo(-w-radius,-h-radius,-w-radius,-h);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:depth-radius*2,bevelEnabled:true,bevelThickness:radius,bevelSize:radius,bevelSegments:segments,curveSegments:segments*2});
  geometry.translate(0,0,-(depth-radius*2)/2); geometry.computeVertexNormals(); return geometry;
}
// Vách tế bào (cứng, dày) và màng sinh chất nằm sát bên trong.
// Không dùng transmission ở đây: lớp kính mờ sẽ làm cả bào quan bên trong biến
// mất, đúng lỗi bản trước — vách chỉ cần trong suốt để nhìn xuyên vào tế bào.
const cellWall=mesh(roundedBox(3.34,2.58,2.4,.2),new THREE.MeshStandardMaterial({color:0x9ff0bb,roughness:.45,metalness:.04,transparent:true,opacity:.13,emissive:0x2f7d52,emissiveIntensity:.42,side:THREE.DoubleSide,depthWrite:false})); solar.add(cellWall);
const cellShell=mesh(new THREE.BoxGeometry(3.36,2.6,2.42),new THREE.MeshBasicMaterial({color:0x7dfbb4,wireframe:true,transparent:true,opacity:.34,blending:THREE.AdditiveBlending})); solar.add(cellShell);
const cellMembrane=mesh(roundedBox(3.06,2.34,2.16,.18),new THREE.MeshStandardMaterial({color:0x4be7b1,roughness:.2,transparent:true,opacity:.12,emissive:0x148a6c,emissiveIntensity:.5,side:THREE.DoubleSide,depthWrite:false})); solar.add(cellMembrane);
// Không bào trung tâm — khối lớn nhất trong tế bào thực vật.
const vacuole=mesh(new THREE.SphereGeometry(.94,36,30),new THREE.MeshStandardMaterial({color:0x63c4f2,transparent:true,opacity:.3,roughness:.18,emissive:0x1d6ea8,emissiveIntensity:.5,depthWrite:false}),[.18,.02,0]); vacuole.scale.set(1.12,.94,.86); solar.add(vacuole);
// Nhân tế bào bị không bào ép sát vách, kèm hạch nhân bên trong.
const nucleus=mesh(new THREE.SphereGeometry(.46,40,34),new THREE.MeshStandardMaterial({color:0xb373ed,roughness:.24,emissive:0x6234a2,emissiveIntensity:1.35}),[-1.08,.36,.28]); solar.add(nucleus);
const nucleolus=mesh(new THREE.SphereGeometry(.17,24,20),new THREE.MeshStandardMaterial({color:0xf0a8ff,roughness:.18,emissive:0xa548c5,emissiveIntensity:1.5}),[-1.14,.42,.46]); solar.add(nucleolus);
const modelBase=mesh(new THREE.CylinderGeometry(2.05,2.4,.075,72),new THREE.MeshBasicMaterial({color:0x4ce8d3,transparent:true,opacity:.16,blending:THREE.AdditiveBlending}),[0,-1.78,0]); solar.add(modelBase);
const solarLight=new THREE.PointLight(0x55efc7,7,12,2); solar.add(solarLight);
// Lục lạp: hình hạt đậu dẹt màu diệp lục, trôi chậm trong tế bào chất chứ
// không quay theo quỹ đạo tròn như hành tinh (đó là lý do bản cũ trông giống
// mô hình hệ mặt trời thay vì một tế bào).
const organelles=[];
const chloroplastGeometry=new THREE.SphereGeometry(.19,20,14);
const chloroplastMat=new THREE.MeshStandardMaterial({color:0x37c46a,roughness:.34,emissive:0x1d7a3f,emissiveIntensity:.62});
const grana=new THREE.MeshStandardMaterial({color:0x1c8f4c,roughness:.5,emissive:0x0f5c30,emissiveIntensity:.5});
[[-.85,-.55,.62],[.42,.86,.58],[1.02,-.62,.5],[-.5,.84,-.62],[.86,.5,-.66],[-1.0,-.2,-.5],[.2,-.88,-.44],[-.28,-.78,.74]].forEach((position,index)=>{
  const chloroplast=new THREE.Group();
  const body=mesh(chloroplastGeometry,chloroplastMat); body.scale.set(1.5,.62,1); chloroplast.add(body);
  for(let s=-1;s<=1;s++) chloroplast.add(mesh(new THREE.CylinderGeometry(.052,.052,.052,10),grana,[s*.12,0,0]));
  chloroplast.position.set(...position);
  chloroplast.rotation.set(index*.7,index*1.1,index*.5);
  chloroplast.userData={home:new THREE.Vector3(...position),speed:.35+index*.06,phase:index*1.9};
  solar.add(chloroplast); organelles.push(chloroplast);
});
// Ti thể — hạt nhỏ hình que, giúp phân biệt với lục lạp.
const mitochondriaMat=new THREE.MeshStandardMaterial({color:0xe98a6a,roughness:.38,emissive:0x9c4128,emissiveIntensity:.55});
[[.72,-.2,.78],[-.66,.6,.7],[.5,-.72,-.78],[-.9,-.66,-.2]].forEach((position,index)=>{
  const mitochondrion=mesh(new THREE.CapsuleGeometry(.062,.13,4,10),mitochondriaMat,position,[index*.9,index*.6,index*1.3]);
  mitochondrion.userData={home:new THREE.Vector3(...position),speed:.5+index*.08,phase:index*2.3};
  solar.add(mitochondrion); organelles.push(mitochondrion);
});
// Nhãn chú thích bay theo từng bộ phận — đây là thứ biến khối hình trừu tượng
// thành học liệu đọc được. Nhãn luôn quay mặt về camera và có đường chỉ dẫn.
function labelTexture(text){
  const canvas=document.createElement('canvas'),scale=2;
  const context=canvas.getContext('2d');
  context.font=`600 ${28*scale}px "Be Vietnam Pro", system-ui, sans-serif`;
  const width=Math.ceil(context.measureText(text).width)+52*scale,height=64*scale;
  canvas.width=width; canvas.height=height;
  const x=canvas.getContext('2d');
  x.font=`600 ${28*scale}px "Be Vietnam Pro", system-ui, sans-serif`;
  x.textBaseline='middle';
  const radius=height/2;
  x.beginPath();
  x.moveTo(radius,0); x.lineTo(width-radius,0); x.arc(width-radius,radius,radius,-Math.PI/2,Math.PI/2);
  x.lineTo(radius,height); x.arc(radius,radius,radius,Math.PI/2,-Math.PI/2); x.closePath();
  x.fillStyle='rgba(4,14,20,.82)'; x.fill();
  x.lineWidth=2*scale; x.strokeStyle='rgba(126,247,224,.55)'; x.stroke();
  x.fillStyle='rgba(233,253,250,.97)'; x.fillText(text,26*scale,height/2+2*scale);
  const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace; texture.anisotropy=maxAnisotropy;
  return {texture,aspect:width/height};
}
const modelLabels=[];
function addModelLabel(text,anchor,offset){
  const {texture,aspect}=labelTexture(text);
  // sizeAttenuation:false giữ nhãn ở cùng một cỡ chữ trên màn hình dù camera lùi
  // xa hay lại gần — nếu để nhãn co theo phối cảnh thì ở cảnh toàn chúng chồng
  // lên nhau và không đọc được.
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,opacity:0,depthTest:false,depthWrite:false,sizeAttenuation:false}));
  const height=.046; sprite.scale.set(height*aspect,height,1);
  const target=new THREE.Vector3(...anchor).add(new THREE.Vector3(...offset));
  sprite.position.copy(target); sprite.renderOrder=6; solar.add(sprite);
  const lineGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...anchor),target]);
  const line=new THREE.Line(lineGeometry,new THREE.LineBasicMaterial({color:0x8bfff1,transparent:true,opacity:0,depthTest:false,blending:THREE.AdditiveBlending}));
  line.renderOrder=5; solar.add(line);
  const dot=mesh(new THREE.SphereGeometry(.035,10,8),new THREE.MeshBasicMaterial({color:0xb8fff6,transparent:true,opacity:0,depthTest:false}),anchor);
  dot.renderOrder=5; solar.add(dot);
  modelLabels.push({sprite,line,dot});
}
addModelLabel('Vách tế bào',[1.67,1.29,0],[1.15,.85,.5]);
addModelLabel('Nhân tế bào',[-1.08,.36,.28],[-1.35,1.25,.55]);
addModelLabel('Không bào',[.18,.02,.78],[1.5,-1.15,.85]);
addModelLabel('Lục lạp',[-.85,-.55,.62],[-1.45,-.95,.7]);

let modelUserScale=1;
let modelSpinSpeed=1;
let modelExplode=0;

// Tia chỉ bài và vòng sân khấu khiến giáo viên thật sự đang thuyết trình,
// thay vì chỉ đứng cạnh mô hình.
const presentationBeamGeometry=new THREE.BufferGeometry();
presentationBeamGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
const presentationBeamMaterial=new THREE.LineBasicMaterial({color:0x8bfff1,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
const presentationBeam=new THREE.Line(presentationBeamGeometry,presentationBeamMaterial); presentationBeam.frustumCulled=false; scene.add(presentationBeam);
const presentationTarget=mesh(new THREE.RingGeometry(.08,.13,32),new THREE.MeshBasicMaterial({color:0xb8fff6,transparent:true,opacity:0,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false})); scene.add(presentationTarget);
const teacherStage=mesh(new THREE.RingGeometry(.62,.68,64),new THREE.MeshBasicMaterial({color:0x51e7db,transparent:true,opacity:0,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}),[-2.75,.025,-4.15],[-Math.PI/2,0,0]); classroom.add(teacherStage);

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

// Trái Đất 3D: bề mặt, địa hình pháp tuyến, ánh đèn ban đêm, mây và khí quyển
// là các lớp riêng nên chuyển động có chiều sâu và vẫn giữ hiệu năng tốt.
const remoteRig=new THREE.Group(); scene.add(remoteRig); remoteRig.position.set(3.8,2.7,-.5); remoteRig.scale.setScalar(.001);
const earthTilt=new THREE.Group(); earthTilt.rotation.z=THREE.MathUtils.degToRad(-23.44); remoteRig.add(earthTilt);
const earthSpin=new THREE.Group(); earthTilt.add(earthSpin);
const earthSegments=qualityTier==='low'?48:qualityTier==='medium'?80:128;
const textureLoader=new THREE.TextureLoader();
const earthDay=textureLoader.load('/assets/earth-day.jpg'); earthDay.colorSpace=THREE.SRGBColorSpace; earthDay.anisotropy=maxAnisotropy;
const earthNormal=textureLoader.load('/assets/earth-normal.jpg'); earthNormal.anisotropy=maxAnisotropy;
const earthSpecular=textureLoader.load('/assets/earth-specular.jpg'); earthSpecular.anisotropy=maxAnisotropy;
const earthNight=textureLoader.load('/assets/earth-night.png'); earthNight.colorSpace=THREE.SRGBColorSpace; earthNight.anisotropy=maxAnisotropy;
const earthGeometry=new THREE.SphereGeometry(1.34,earthSegments,Math.round(earthSegments*.72));
const earthSurface=mesh(earthGeometry,new THREE.MeshPhongMaterial({
  map:earthDay,normalMap:earthNormal,normalScale:new THREE.Vector2(.68,.68),specularMap:earthSpecular,
  specular:new THREE.Color(0x315a73),shininess:7
})); earthSpin.add(earthSurface);
const nightSurface=mesh(new THREE.SphereGeometry(1.344,earthSegments,Math.round(earthSegments*.72)),new THREE.MeshBasicMaterial({
  map:earthNight,transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false
})); earthSpin.add(nightSurface);

function cloudTexture(){
  const canvas=document.createElement('canvas'); canvas.width=qualityTier==='low'?512:1024; canvas.height=canvas.width/2;
  const context=canvas.getContext('2d'); context.clearRect(0,0,canvas.width,canvas.height);
  let seed=87431; const random=()=>((seed=(seed*16807)%2147483647)-1)/2147483646;
  context.filter='blur(10px)'; context.fillStyle='#fff';
  for(let band=0;band<9;band++){
    const baseY=(band+.7)*canvas.height/9+(random()-.5)*canvas.height*.055;
    for(let i=0;i<45;i++){
      const x=random()*canvas.width,y=baseY+(random()-.5)*canvas.height*.09;
      const width=canvas.width*(.02+random()*.09),height=canvas.height*(.01+random()*.045);
      context.globalAlpha=.025+random()*.08; context.beginPath(); context.ellipse(x,y,width,height,random()*.8,0,Math.PI*2); context.fill();
    }
  }
  context.filter='none'; context.globalAlpha=1;
  const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace; texture.anisotropy=maxAnisotropy; return texture;
}
const cloudLayer=mesh(new THREE.SphereGeometry(1.365,earthSegments,Math.round(earthSegments*.72)),new THREE.MeshPhongMaterial({
  map:cloudTexture(),transparent:true,opacity:.34,depthWrite:false,blending:THREE.NormalBlending,side:THREE.DoubleSide
})); earthTilt.add(cloudLayer);
const atmosphere=mesh(new THREE.SphereGeometry(1.49,earthSegments,Math.round(earthSegments*.72)),new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,
  vertexShader:`varying vec3 vNormal; varying vec3 vWorldPosition; void main(){vNormal=normalize(mat3(modelMatrix)*normal); vec4 world=modelMatrix*vec4(position,1.0); vWorldPosition=world.xyz; gl_Position=projectionMatrix*viewMatrix*world;}`,
  fragmentShader:`varying vec3 vNormal; varying vec3 vWorldPosition; void main(){vec3 viewDirection=normalize(cameraPosition-vWorldPosition); float rim=pow(0.72-max(dot(vNormal,viewDirection),0.0),2.7); gl_FragColor=vec4(0.16,0.62,1.0,rim*0.88);}`
})); remoteRig.add(atmosphere);
const moonOrbit=new THREE.Group(); remoteRig.add(moonOrbit);
const moon=mesh(new THREE.SphereGeometry(.21,40,30),new THREE.MeshStandardMaterial({color:0xb8bec4,roughness:.96,metalness:0}),[2.15,.28,0]); moonOrbit.add(moon);
const earthKey=new THREE.DirectionalLight(0xfff5df,1.85); earthKey.position.set(-4,3,5); remoteRig.add(earthKey);
const earthRim=new THREE.PointLight(0x4daaff,3.2,9,2); earthRim.position.set(2.6,1.3,-2.7); remoteRig.add(earthRim);
const orbitLine=mesh(new THREE.TorusGeometry(2.15,.009,8,160),new THREE.MeshBasicMaterial({color:0x75dfff,transparent:true,opacity:.19,blending:THREE.AdditiveBlending,depthWrite:false}),[0,.28,0],[Math.PI/2,0,0]); remoteRig.add(orbitLine);
let earthManualX=0,earthManualY=0,earthZoom=1;

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
registerInteractive(teacher,'Cô giáo Lan','Giáo viên 3D đang dẫn dắt bài học. Kéo lên để nhấc; khi thả, cô sẽ quay lại bục giảng.','Nhân vật');
students.forEach((student,index)=>registerInteractive(student,`Học sinh ${String(index+1).padStart(2,'0')}`,'Giữ rồi kéo ngang hoặc kéo lên để nhấc học sinh. Khi thả, bạn ấy sẽ tự trở về ghế.','Nhân vật'));
desks.forEach((desk,index)=>registerInteractive(desk,`Bàn học ${String(index+1).padStart(2,'0')}`,'Bàn học có thể được sắp xếp lại cho từng hoạt động nhóm.','Nội thất'));
registerInteractive(podium,'Bục giảng','Bục điều khiển học liệu và thiết bị lớp học.','Nội thất');
registerInteractive(classroomCam,'Camera AI trên trần','Camera quan sát hỗ trợ phân tích không gian lớp học.','Thiết bị');
registerInteractive(screen,'Bảng tương tác','Màn hình bài giảng chính của lớp học.','Thiết bị');
registerInteractive(solar,'Mô hình tế bào thực vật','Mô hình 3D có thể xoay, phóng to và tách lớp cấu tạo.','Học liệu 3D');
registerInteractive(agentGroup,'Trợ lý EduVision','Trợ lý AI tiếp nhận lệnh giọng nói của giáo viên.','Trợ lý AI');
registerInteractive(remoteRig,'Trái Đất 3D','Địa cầu nhiều lớp với mây, ánh đèn ban đêm, khí quyển và Mặt Trăng chuyển động độc lập.','Học liệu 3D');

rememberOpacity(classroom); rememberOpacity(agentGroup); rememberOpacity(solar); rememberOpacity(remoteRig); rememberOpacity(core);

const classroomCharacters=new Set([teacher,...students]);
const characterReturns=new Map();
function isClassroomCharacter(object){ return classroomCharacters.has(object); }
function beginWalkHome(character){
  const home=character.userData.initialTransform.position.clone();
  const start=character.position.clone(); start.y=home.y;
  const distance=start.distanceTo(home);
  if(distance<.04){
    character.position.copy(home); character.rotation.copy(character.userData.initialTransform.rotation); characterReturns.delete(character); return;
  }
  const side=Math.sin(character.userData.phase??2.4)>=0?1:-1;
  const midpoint=start.clone().lerp(home,.5);
  const curve=new THREE.CatmullRomCurve3([
    start,
    start.clone().add(new THREE.Vector3(side*.5,0,-.18)),
    midpoint.add(new THREE.Vector3(side*(.72+Math.min(distance,.9)),0,.32)),
    home.clone()
  ]);
  characterReturns.set(character,{phase:'walk',home,curve,elapsed:0,duration:clamp(.9+distance*.25,1.1,2.8)});
}
function returnCharacterHome(character){
  if(!isClassroomCharacter(character)) return;
  const home=character.userData.initialTransform.position.clone();
  characterReturns.set(character,{phase:'drop',home,velocityY:Math.min(0,(character.position.y-home.y)*-.45)});
  character.userData.isReturning=true;
}
function liftAndRelease(character){
  if(!isClassroomCharacter(character)) return;
  characterReturns.delete(character); anime.remove(character.position);
  const home=character.userData.initialTransform.position;
  anime({targets:character.position,y:Math.max(character.position.y,home.y)+1.55,x:character.position.x+(character===teacher ? .42 : .28),duration:520,easing:'easeOutExpo',complete:()=>{
    playUISound(260,.16,.18); setTimeout(()=>returnCharacterHome(character),260);
  }});
}
function updateCharacterReturns(dt,t){
  characterReturns.forEach((state,character)=>{
    if(state.phase==='drop'){
      state.velocityY-=7.8*dt; character.position.y+=state.velocityY*dt;
      character.rotation.z+=dt*1.15;
      if(character.position.y<=state.home.y){
        character.position.y=state.home.y; character.rotation.z*=.25; playUISound(180,.11,.13); beginWalkHome(character);
      }
      return;
    }
    state.elapsed+=dt;
    const progress=clamp(state.elapsed/state.duration),eased=easeInOutCubic(progress);
    const point=state.curve.getPoint(eased),tangent=state.curve.getTangent(Math.min(.995,eased));
    point.y=state.home.y+Math.abs(Math.sin(progress*Math.PI*6))*.035;
    character.position.copy(point);
    character.rotation.y=THREE.MathUtils.lerp(character.rotation.y,Math.atan2(-tangent.x,-tangent.z),Math.min(1,dt*7));
    character.rotation.z=Math.sin(t*8+(character.userData.phase||0))*.018;
    if(progress>=1){
      character.position.copy(state.home); character.rotation.copy(character.userData.initialTransform.rotation);
      character.userData.isReturning=false; characterReturns.delete(character); playUISound(460,.09,.1);
    }
  });
}

// State objects that GSAP can scrub and feed into material opacity.
const fx={scan:0,twin:0,room:1,agent:0,solar:0,remote:0,core:0,warm:0};
function applyFX(){
  setGroupOpacity(twin,fx.twin);
  scanMat.opacity=.16*fx.scan;
  scanPulseMat.opacity=.32*fx.scan;
  halos.forEach((h,i)=>{ h.material.opacity=fx.scan*(i===5?.9:.28); h.scale.x=1+Math.sin(performance.now()*.002+i)*.03; });
  agentGroup.scale.setScalar(Math.max(.001,fx.agent));
  solar.scale.setScalar(Math.max(.001,fx.solar*modelUserScale*1.16));
  // Nhãn có cỡ cố định trên màn hình nên không tự nhỏ đi khi mô hình thu về 0;
  // phải tự tắt theo fx.solar, và chỉ hiện khi mô hình đã bung gần hết.
  const labelReveal=smooth(clamp((fx.solar-.55)/.4));
  modelLabels.forEach(({sprite,line,dot})=>{
    sprite.material.opacity=labelReveal*.97;
    line.material.opacity=labelReveal*.6;
    dot.material.opacity=labelReveal*.9;
    sprite.visible=line.visible=dot.visible=labelReveal>.01;
  });
  const earthReveal=fx.remote<=.001 ? .001 : easeOutBack(clamp(fx.remote));
  remoteRig.scale.setScalar(Math.max(.001,earthReveal*earthZoom));
  earthScreenMaterial.opacity=smooth(clamp((fx.remote-.12)/.72))*.92;
  screenInner.material.opacity=.96*(1-smooth(clamp((fx.remote-.08)/.78))*.9);
  presentationBeamMaterial.opacity=fx.solar*.58;
  presentationTarget.material.opacity=fx.solar*.8;
  teacherStage.material.opacity=fx.solar*.32;
  core.scale.setScalar(Math.max(.001,fx.core));
  warmLight.intensity=5.6*fx.warm;
  cyanLight.intensity=7*(1-fx.warm*.55);
  violetLight.intensity=8*(1-fx.warm*.65);
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
let activeSceneIndex=0;

function computeAnchors(){
  sectionAnchors = sceneSections.map(section => ({
    section,
    y: section.offsetTop + section.offsetHeight * .5 - innerHeight * .5
  }));
}
computeAnchors();

const keyframes = [
  { id:'hero', cam:[1.15,3.9,11], target:[-.65,1.82,-2.25], fx:{scan:0,twin:0,agent:0,solar:0,remote:0,core:0,warm:0}, bloom:.68, roomScale:1, roomPos:[0,0,0], scanY:0, scanZ:2.6, screenGlow:.4, rigRot:[0,0,0] },
  { id:'vision', cam:[6.7,5.3,7.6], target:[0,1.25,.1], fx:{scan:1,twin:0,agent:0,solar:0,remote:0,core:0,warm:0}, bloom:.96, roomScale:1, roomPos:[0,0,0], scanY:Math.PI*.34, scanZ:-1.7, screenGlow:.45, rigRot:[0,0,0] },
  { id:'agent', cam:[-6.2,3.55,4.6], target:[-2.1,2.1,-3.7], fx:{scan:0,twin:0,agent:1,solar:0,remote:0,core:0,warm:0}, bloom:1.05, roomScale:1, roomPos:[0,0,0], scanY:0, scanZ:2.6, screenGlow:.7, rigRot:[0,0,0] },
  { id:'simulation', cam:[4.3,3.35,6.9], target:[-.15,2.05,-4.05], fx:{scan:0,twin:0,agent:.02,solar:1,remote:0,core:0,warm:0}, bloom:1.02, roomScale:1, roomPos:[0,0,0], scanY:0, scanZ:2.6, screenGlow:1.35, rigRot:[0,0,0] },
  { id:'control', cam:[7.8,4.35,7.4], target:[3.8,2.7,-.5], fx:{scan:0,twin:0,agent:.1,solar:.05,remote:1,core:0,warm:0}, bloom:.92, roomScale:1, roomPos:[0,0,0], scanY:0, scanZ:2.6, screenGlow:.6, rigRot:[0,0,0] },
  { id:'twin', cam:[8.5,10.8,8.9], target:[0,.2,0], fx:{scan:0,twin:1,agent:0,solar:0,remote:.05,core:0,warm:0}, bloom:.95, roomScale:1, roomPos:[0,0,0], scanY:0, scanZ:2.6, screenGlow:.35, rigRot:[0,0,0] },
  { id:'core', cam:[0,4.6,15.8], target:[0,2,-.3], fx:{scan:0,twin:.12,agent:0,solar:0,remote:0,core:1,warm:0}, bloom:1.32, roomScale:.43, roomPos:[0,-1.15,-2.8], scanY:0, scanZ:2.6, screenGlow:.3, rigRot:[0,0,0] },
  { id:'human', cam:[-4.8,3.1,6.5], target:[-2.5,1.7,-2.8], fx:{scan:0,twin:0,agent:0,solar:0,remote:0,core:.02,warm:1}, bloom:.48, roomScale:1, roomPos:[0,0,0], scanY:0, scanZ:2.6, screenGlow:.28, rigRot:[0,0,0] },
  { id:'cta', cam:[0,5.4,19.5], target:[0,1.8,-2], fx:{scan:0,twin:0,agent:0,solar:0,remote:0,core:0,warm:0}, bloom:.72, roomScale:.3, roomPos:[0,-1.6,-4.5], scanY:0, scanZ:2.6, screenGlow:.18, rigRot:[0,0,0] }
];
const earthCinematicOrigin=new THREE.Vector3(1.9,2.75,-3.7);
const earthCinematicHome=new THREE.Vector3(3.8,2.7,-.5);

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
  if(!(draggingObject&&selectedObject===remoteRig)){
    if(ia===3&&ib===4) remoteRig.position.lerpVectors(earthCinematicOrigin,earthCinematicHome,easeInOutCubic(t));
    else if(ib<=3) remoteRig.position.copy(earthCinematicOrigin);
  }
  floorGrid.material.opacity=mix(ia>=5?.08:.28,ib>=5?.08:.28,t);

  const maxScroll=Math.max(1,document.documentElement.scrollHeight-innerHeight);
  $('#railProgress').style.transform=`scaleY(${clamp(y/maxScroll)})`;
  const active=t>.5?ib:ia;
  activeSceneIndex=active;
  const section=sceneSections[active] || sceneSections[0];
  if(section){
    $('#sceneIndex').textContent=section.dataset.index; $('#sceneName').textContent=section.dataset.name;
    if(active!==lastAudibleScene){ playUISound(250+active*38,.18,.13); lastAudibleScene=active; }
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

let chimeTimer=0;
function ensureAudio(){
  if(!audioContext){
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext) return false;
    audioContext=new AudioContext();
    masterGain=audioContext.createGain(); masterGain.gain.value=0; masterGain.connect(audioContext.destination);
  }
  audioContext.resume();
  if(!ambientStarted){
    // Nền phải nằm trong dải loa laptop và điện thoại tái tạo được. Bản trước
    // đặt cả ba oscillator ở 55–110 Hz và lọc thông thấp tại 420 Hz, đo ra
    // -46 dBFS nên bật lên vẫn không nghe thấy gì.
    const padGain=audioContext.createGain(); padGain.gain.value=.16; padGain.connect(masterGain);
    const filter=audioContext.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=1500; filter.Q.value=.6; filter.connect(padGain);
    // Có cả bồi âm ở 330–440 Hz vì loa điện thoại gần như không phát được dưới
    // 250 Hz; nếu chỉ có trầm thì trên di động vẫn coi như không có tiếng.
    [[110,'sine',.45],[165,'triangle',.24],[220,'sine',.2],[330,'sine',.16],[440,'sine',.09]].forEach(([frequency,type,level])=>{
      const osc=audioContext.createOscillator(); const gain=audioContext.createGain();
      osc.type=type; osc.frequency.value=frequency; gain.gain.value=level;
      osc.connect(gain).connect(filter); osc.start();
    });
    const lfo=audioContext.createOscillator(),lfoGain=audioContext.createGain();
    lfo.frequency.value=.09; lfoGain.gain.value=.035; lfo.connect(lfoGain).connect(padGain.gain); lfo.start();
    scheduleChime();
    ambientStarted=true;
  }
  return true;
}
// Vài nốt chuông thưa trên thang ngũ cung để người dùng nhận ra ngay là có
// tiếng, thay vì chỉ một tiếng ù trầm liên tục.
const chimeScale=[523.25,587.33,659.25,783.99,880];
function scheduleChime(){
  clearTimeout(chimeTimer);
  chimeTimer=setTimeout(()=>{
    if(audioEnabled&&audioContext){
      const now=audioContext.currentTime,frequency=chimeScale[Math.floor(Math.random()*chimeScale.length)];
      [1,2.01].forEach((ratio,index)=>{
        const osc=audioContext.createOscillator(),gain=audioContext.createGain();
        osc.type=index?'sine':'triangle'; osc.frequency.value=frequency*ratio;
        gain.gain.setValueAtTime(.0001,now);
        gain.gain.exponentialRampToValueAtTime(index?.04:.11,now+.02);
        gain.gain.exponentialRampToValueAtTime(.0001,now+2.4);
        osc.connect(gain).connect(masterGain); osc.start(now); osc.stop(now+2.5);
      });
    }
    scheduleChime();
  },3200+Math.random()*3600);
}
function playUISound(frequency=420,duration=.12,volume=.2){
  if(!audioEnabled||!ensureAudio()) return;
  const now=audioContext.currentTime,osc=audioContext.createOscillator(),gain=audioContext.createGain();
  osc.type='triangle'; osc.frequency.setValueAtTime(frequency,now); osc.frequency.exponentialRampToValueAtTime(frequency*1.18,now+duration);
  gain.gain.setValueAtTime(.0001,now); gain.gain.exponentialRampToValueAtTime(volume,now+.012); gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
  osc.connect(gain).connect(masterGain); osc.start(now); osc.stop(now+duration+.02);
}
function setAudioEnabled(enabled){
  if(enabled&&!ensureAudio()) return;
  audioEnabled=enabled;
  soundToggle.setAttribute('aria-pressed',String(enabled));
  soundLabel.textContent=enabled?'Không gian đang phát':'Đang tắt';
  if(masterGain){ const now=audioContext.currentTime; masterGain.gain.cancelScheduledValues(now); masterGain.gain.setValueAtTime(masterGain.gain.value,now); masterGain.gain.linearRampToValueAtTime(enabled ? .55 : 0,now+.45); }
}
soundToggle.addEventListener('click',()=>setAudioEnabled(!audioEnabled));
interactionToggle.addEventListener('click',()=>{
  const enabled=!document.body.classList.contains('interaction-mode');
  document.body.classList.toggle('interaction-mode',enabled);
  interactionToggle.setAttribute('aria-pressed',String(enabled));
  interactionToggle.querySelector('small').textContent=enabled?'Kéo lên để nhấc nhân vật':'Bấm để kéo vật thể';
  if(!enabled) closeObjectInspector();
  playUISound(enabled?560:320,.13,.22);
});
addEventListener('keydown',event=>{
  if(event.key==='Escape'&&document.body.classList.contains('interaction-mode')) interactionToggle.click();
});
document.addEventListener('pointerdown',event=>{
  const control=event.target.closest('button,a');
  if(!control) return;
  const ripple=document.createElement('i'); ripple.className='click-ripple'; ripple.style.left=`${event.clientX}px`; ripple.style.top=`${event.clientY}px`; document.body.appendChild(ripple);
  ripple.addEventListener('animationend',()=>ripple.remove(),{once:true});
  playUISound(440+Math.random()*90,.085,.16);
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
    if(command.includes('nhấc')||command.includes('nâng')) liftAndRelease(students[index]);
    voiceStatus.textContent=command.includes('nhấc')||command.includes('nâng')?`Đã nhấc học sinh ${String(index+1).padStart(2,'0')}; bạn ấy sẽ tự về chỗ.`:`Đã chọn học sinh ${String(index+1).padStart(2,'0')}. Bạn có thể nói “sang trái” hoặc kéo trực tiếp.`;
  }else if(command.includes('chọn giáo viên')||command.includes('cô giáo')){
    if(!document.body.classList.contains('interaction-mode')) interactionToggle.click();
    selectObject(teacher);
    if(command.includes('nhấc')||command.includes('nâng')) liftAndRelease(teacher);
    voiceStatus.textContent=command.includes('nhấc')||command.includes('nâng')?'Đã nhấc cô giáo Lan; cô sẽ quay lại bục giảng.':'Đã chọn cô giáo Lan.';
  }else if(selectedObject&&(command.includes('sang trái')||command.includes('sang phải')||command.includes('tiến lên')||command.includes('lùi lại'))){
    if(command.includes('sang trái')) selectedObject.position.x-=.65;
    if(command.includes('sang phải')) selectedObject.position.x+=.65;
    if(command.includes('tiến lên')) selectedObject.position.z-=.65;
    if(command.includes('lùi lại')) selectedObject.position.z+=.65;
    updateObjectInspector(); voiceStatus.textContent=`Đã di chuyển ${selectedObject.userData.displayName}.`;
  }else if(selectedObject&&isClassroomCharacter(selectedObject)&&(command.includes('thả')||command.includes('về chỗ')||command.includes('quay lại'))){
    returnCharacterHome(selectedObject); voiceStatus.textContent=`${selectedObject.userData.displayName} đang tự tìm đường về vị trí ban đầu.`;
  }else if(command.includes('trái đất')||command.includes('địa cầu')){
    $('#control').scrollIntoView({behavior:reducedMotion?'auto':'smooth',block:'center'});
    if(!document.body.classList.contains('interaction-mode')) interactionToggle.click();
    selectObject(remoteRig);
    if(command.includes('phóng to')||command.includes('to lên')) earthZoom=Math.min(1.35,earthZoom+.18);
    if(command.includes('thu nhỏ')||command.includes('nhỏ lại')) earthZoom=Math.max(.72,earthZoom-.18);
    if(command.includes('trái')) earthManualY-=.45;
    if(command.includes('phải')) earthManualY+=.45;
    if(command.includes('lên')) earthManualX=Math.max(-.75,earthManualX-.24);
    if(command.includes('xuống')) earthManualX=Math.min(.75,earthManualX+.24);
    if(earthZoomControl){ earthZoomControl.value=String(earthZoom); $('#earthZoomValue').textContent=`${Math.round(earthZoom*100)}%`; }
    voiceStatus.textContent='Đã mở Trái Đất 3D và thực hiện lệnh điều khiển.';
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
$$('.pad-grid button').forEach(button=>button.addEventListener('click',()=>{
  const dx=Number(button.dataset.earthX||0),dy=Number(button.dataset.earthY||0);
  if(button.classList.contains('pad-center')){ earthManualX=0; earthManualY=0; }
  else { earthManualX=clamp(earthManualX+dx,-.75,.75); earthManualY+=dy; }
  playUISound(420,0.08,.1);
}));
const earthZoomControl=$('#earthZoom');
earthZoomControl?.addEventListener('input',event=>{
  earthZoom=Number(event.target.value);
  $('#earthZoomValue').textContent=`${Math.round(earthZoom*100)}%`;
});
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
let dragStartClientX=0;
let dragStartClientY=0;
let dragStartLocalY=0;
const dragStartLocalPosition=new THREE.Vector3();

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
  objectPosition.textContent=`${selectedObject.userData.kind} · X ${selectedObject.position.x.toFixed(2)} · Y ${selectedObject.position.y.toFixed(2)} · Z ${selectedObject.position.z.toFixed(2)}`;
}
function selectObject(object){
  selectedObject=object;
  if(selectionHelper) scene.remove(selectionHelper);
  selectionHelper=new THREE.BoxHelper(object,0x68fff0);
  selectionHelper.material.transparent=true; selectionHelper.material.opacity=.72; selectionHelper.material.depthTest=false;
  selectionHelper.renderOrder=999; scene.add(selectionHelper);
  const characterSelected=isClassroomCharacter(object);
  selectedCharacterLight.intensity=characterSelected?5.8:0;
  selectedCharacterBeam.material.opacity=characterSelected ? .065 : 0;
  objectInspector.classList.add('is-open'); objectInspector.setAttribute('aria-hidden','false'); updateObjectInspector();
  anime.remove(objectInspector);
  anime({targets:objectInspector,opacity:[0,1],translateY:[22,0],scale:[.96,1],duration:480,easing:'easeOutExpo'});
}
function closeObjectInspector(){
  draggingObject=false; document.body.classList.remove('is-dragging-3d');
  if(selectionHelper){ scene.remove(selectionHelper); selectionHelper=null; }
  selectedObject=null;
  selectedCharacterLight.intensity=0; selectedCharacterBeam.material.opacity=0;
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
  if(isClassroomCharacter(root)){ characterReturns.delete(root); root.userData.isReturning=false; anime.remove(root.position); }
  root.getWorldPosition(worldPosition);
  dragPlane.set(new THREE.Vector3(0,1,0),-worldPosition.y);
  if(raycaster.ray.intersectPlane(dragPlane,dragPoint)) dragOffset.copy(dragPoint).sub(worldPosition);
  dragStartClientX=event.clientX; dragStartClientY=event.clientY; dragStartLocalY=root.position.y; dragStartLocalPosition.copy(root.position);
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
  if(isClassroomCharacter(selectedObject)){
    const homeY=selectedObject.userData.initialTransform.position.y;
    selectedObject.position.x=clamp(dragStartLocalPosition.x+(event.clientX-dragStartClientX)*.009,-7.6,7.6);
    selectedObject.position.z=dragStartLocalPosition.z;
    selectedObject.position.y=clamp(dragStartLocalY+(dragStartClientY-event.clientY)*.012,homeY,homeY+2.6);
    selectedObject.rotation.z=clamp((event.clientX-dragStartClientX)*-.006,-.28,.28);
  }else selectedObject.position.copy(localPoint);
  updateObjectInspector(); selectionHelper?.update(); event.preventDefault();
});
function endObjectDrag(event){
  if(!draggingObject) return;
  const released=selectedObject;
  draggingObject=false; document.body.classList.remove('is-dragging-3d'); canvas.releasePointerCapture?.(event.pointerId);
  if(isClassroomCharacter(released)) setTimeout(()=>{
    if(!(draggingObject&&selectedObject===released)) returnCharacterHome(released);
  },260);
}
canvas.addEventListener('pointerup',endObjectDrag);
canvas.addEventListener('pointercancel',endObjectDrag);
$('#closeInspector').addEventListener('click',closeObjectInspector);
$('#rotateObject').addEventListener('click',()=>{
  if(!selectedObject) return;
  if(isClassroomCharacter(selectedObject)||selectedObject===solar||selectedObject===agentGroup||selectedObject===remoteRig){
    anime({targets:selectedObject.userData,manualRotationY:(selectedObject.userData.manualRotationY||0)+Math.PI/2,duration:900,easing:'easeInOutCubic'});
  }else{
    anime({targets:selectedObject.rotation,y:selectedObject.rotation.y+Math.PI/2,duration:900,easing:'easeInOutCubic'});
  }
});
$('#liftObject').addEventListener('click',()=>{
  if(!selectedObject) return;
  if(isClassroomCharacter(selectedObject)) liftAndRelease(selectedObject);
  else anime({targets:selectedObject.position,y:selectedObject.position.y+.65,direction:'alternate',duration:700,easing:'easeInOutCubic'});
});
$('#resetObject').addEventListener('click',()=>{
  if(!selectedObject) return;
  if(isClassroomCharacter(selectedObject)){ returnCharacterHome(selectedObject); return; }
  const initial=selectedObject.userData.initialTransform;
  selectedObject.userData.manualRotationY=0;
  anime({targets:selectedObject.position,x:initial.position.x,y:initial.position.y,z:initial.position.z,duration:850,easing:'easeOutExpo',update:updateObjectInspector});
  anime({targets:selectedObject.rotation,x:initial.rotation.x,y:initial.rotation.y,z:initial.rotation.z,duration:850,easing:'easeOutExpo'});
});

// -----------------------------------------------------------------------------
// Render loop
// -----------------------------------------------------------------------------
const clock=new THREE.Clock();
let performanceFrames=0;
let performanceWindowStart=performance.now();
let lastQualityAdjustment=0;
let renderingPaused=document.hidden;
let renderRaf=0;
function applyAdaptiveResolution(nextRatio){
  adaptivePixelRatio=clamp(nextRatio,.72,maximumPixelRatio);
  renderer.setPixelRatio(adaptivePixelRatio); renderer.setSize(innerWidth,innerHeight,false);
  composer.setPixelRatio(adaptivePixelRatio); composer.setSize(innerWidth,innerHeight);
}
function tuneAdaptiveQuality(now){
  performanceFrames++;
  const elapsed=now-performanceWindowStart;
  if(elapsed<2400) return;
  const fps=performanceFrames*1000/elapsed;
  performanceFrames=0; performanceWindowStart=now;
  if(now-lastQualityAdjustment<3200) return;
  if(fps<41){
    if(adaptivePixelRatio>.78) applyAdaptiveResolution(adaptivePixelRatio-.16);
    else { bloom.enabled=false; renderer.shadowMap.enabled=false; }
    lastQualityAdjustment=now;
  }else if(fps>56&&adaptivePixelRatio<maximumPixelRatio-.04){
    applyAdaptiveResolution(adaptivePixelRatio+.1);
    if(qualityTier!=='low') bloom.enabled=true;
    if(qualityTier==='high') renderer.shadowMap.enabled=true;
    lastQualityAdjustment=now;
  }
}
function teacherGestureEnvelope(t){
  const phase=(t+1.4)%13.5;
  if(phase<2.3) return 0;
  if(phase<3.5) return smooth((phase-2.3)/1.2);
  if(phase<6.0) return 1;
  if(phase<7.25) return 1-smooth((phase-6.0)/1.25);
  return 0;
}
function teacherLookEnvelope(t){
  const phase=(t+3.1)%17;
  if(phase<5.2) return 0;
  if(phase<6.1) return smooth((phase-5.2)/.9);
  if(phase<8.3) return 1;
  if(phase<9.4) return 1-smooth((phase-8.3)/1.1);
  return 0;
}
const presentationArmOrigin=new THREE.Vector3();
const presentationArmJoint=new THREE.Vector3();
const presentationModelTarget=new THREE.Vector3();
function updateHumanAnimation(character,t,presenting){
  const bones=character.userData.bones;
  if(!bones) return;
  resetRigPose(bones);
  const gesture=teacherGestureEnvelope(t)*presenting;
  const look=teacherLookEnvelope(t);
  const breathing=Math.sin(t*1.05)*.006;
  if(character.userData.characterMode==='gltf'){
    if(bones.hips) bones.hips.rotation.z+=Math.sin(t*.19)*.008;
    if(bones.spine) bones.spine.rotation.x+=breathing;
    if(bones.chest) bones.chest.rotation.y+=look*.055-gesture*.025;
    if(bones.neck) bones.neck.rotation.y+=look*.07;
    if(bones.head){ bones.head.rotation.y+=look*.12; bones.head.rotation.x-=gesture*.035; }
    if(gesture>.001&&bones.leftArm&&bones.leftForeArm){
      character.updateMatrixWorld(true);
      bones.leftArm.getWorldPosition(presentationArmOrigin);
      bones.leftForeArm.getWorldPosition(presentationArmJoint);
      rigCurrentDirection.copy(presentationArmJoint).sub(presentationArmOrigin).normalize();
      solar.getWorldPosition(presentationModelTarget);
      rigTargetDirection.copy(presentationModelTarget).sub(presentationArmOrigin).normalize();
      rigTargetDirection.z*=.3;
      rigTargetDirection.normalize();
      rigTargetDirection.lerpVectors(rigCurrentDirection,rigTargetDirection,gesture*.64).normalize();
      orientRigLimb(character,bones.leftArm,bones.leftForeArm,rigTargetDirection);
      if(bones.leftHand){
        bones.leftForeArm.getWorldPosition(presentationArmOrigin);
        bones.leftHand.getWorldPosition(presentationArmJoint);
        rigCurrentDirection.copy(presentationArmJoint).sub(presentationArmOrigin).normalize();
        rigTargetDirection.copy(presentationModelTarget).sub(presentationArmOrigin).normalize();
        rigTargetDirection.z*=.35;
        rigTargetDirection.normalize();
        rigTargetDirection.lerpVectors(rigCurrentDirection,rigTargetDirection,gesture*.72).normalize();
        orientRigLimb(character,bones.leftForeArm,bones.leftHand,rigTargetDirection);
      }
    }
    if(bones.rightForeArm) bones.rightForeArm.rotation.x+=gesture*.045;
  }else{
    if(bones.head) bones.head.rotation.y+=look*.12;
    if(bones.spine) bones.spine.rotation.y+=look*.04-gesture*.025;
    if(bones.leftArm){ bones.leftArm.rotation.z-=gesture*.18; bones.leftArm.rotation.x+=gesture*.06; }
    if(bones.rightArm) bones.rightArm.rotation.z+=gesture*.035;
  }
}
function render(){
  renderRaf=0;
  if(renderingPaused) return;
  const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;
  const damping = reducedMotion ? 1 : .075;
  smoothScrollY += (targetScrollY - smoothScrollY) * damping;
  applyScrollWorld(smoothScrollY);
  starField.rotation.y=t*.005;
  starField.position.y=Math.sin(t*.08)*.14;
  students.forEach((student,i)=>{
    const p=student.userData.phase;
    if(!characterReturns.has(student)&&!(draggingObject&&selectedObject===student)){
      const home=student.userData.initialTransform.position;
      student.position.y=home.y+Math.sin(t*(.6+(i%3)*.07)+p)*.012;
      student.rotation.y=student.userData.initialTransform.rotation.y+(student.userData.manualRotationY||0)+Math.sin(t*.22+p)*.018;
      student.rotation.z=Math.sin(t*.42+p)*.005;
      const bones=student.userData.bones;
      if(bones) Object.values(bones).forEach(bone=>{ if(bone.userData.restRotation) bone.rotation.copy(bone.userData.restRotation); });
      if(bones?.head) bones.head.rotation.y+=Math.sin(t*.5+p)*.075;
      if(bones?.spine) bones.spine.rotation.z+=Math.sin(t*.38+p)*.018;
      // Một vài học sinh chủ động giơ tay theo nhịp bài giảng. Học sinh quay mặt
      // về -Z nên tay phải nằm ở +X: xoay dương quanh trục Z là giơ tay lên.
      if(bones?.rightArm&&(i===2||i===7||i===10)){
        const raise=smooth(smooth(clamp((Math.sin(t*.42+p)-.18)*1.7)));
        bones.rightArm.rotation.z+=raise*2.05;
        bones.rightArm.rotation.x-=raise*.24;
      }
    }
  });
  if(!characterReturns.has(teacher)&&!(draggingObject&&selectedObject===teacher)){
    const teacherHome=teacher.userData.initialTransform.position;
    const presenting=clamp(fx.solar+fx.agent*.4);
    const gesture=teacherGestureEnvelope(t)*presenting;
    teacher.position.x=teacherHome.x+gesture*.11+Math.sin(t*.19)*.018;
    teacher.position.z=teacherHome.z-gesture*.025;
    teacher.position.y=teacherHome.y+Math.sin(t*1.05)*.004;
    teacher.rotation.y=teacher.userData.initialTransform.rotation.y+(teacher.userData.manualRotationY||0)+teacherLookEnvelope(t)*.035;
    teacher.rotation.z=Math.sin(t*.19)*.004;
    updateHumanAnimation(teacher,t,presenting);
  }
  updateCharacterReturns(dt,t);
  if(selectedObject&&isClassroomCharacter(selectedObject)){
    selectedObject.getWorldPosition(worldPosition);
    selectedCharacterLight.position.set(worldPosition.x,worldPosition.y+2.25,worldPosition.z+1.1);
    selectedCharacterLight.intensity=draggingObject?7.2:4.8;
    selectedCharacterBeam.position.set(worldPosition.x,worldPosition.y+1.52,worldPosition.z);
    selectedCharacterBeam.material.opacity=draggingObject ? .11 : .052;
    selectedCharacterBeam.scale.y=1+Math.sin(t*3)*.035;
  }

  const beamStart=new THREE.Vector3();
  const presentationHand=teacher.userData.bones?.leftHand;
  if(presentationHand) presentationHand.getWorldPosition(beamStart);
  else { beamStart.set(.54,2.02,.12); teacher.localToWorld(beamStart); }
  const beamEnd=new THREE.Vector3(); solar.getWorldPosition(beamEnd); beamEnd.x-=.22; beamEnd.y+=.28;
  const beamPositions=presentationBeamGeometry.attributes.position;
  beamPositions.setXYZ(0,beamStart.x,beamStart.y,beamStart.z); beamPositions.setXYZ(1,beamEnd.x,beamEnd.y,beamEnd.z); beamPositions.needsUpdate=true;
  presentationTarget.position.copy(beamEnd); presentationTarget.lookAt(camera.position);
  presentationTarget.scale.setScalar(.85+Math.sin(t*3.2)*.18);
  teacherStage.position.x=teacher.position.x; teacherStage.position.z=teacher.position.z;
  teacherStage.scale.setScalar(.92+Math.sin(t*2.1)*.07);
  agentGroup.rotation.y=t*.45+(agentGroup.userData.manualRotationY||0);
  agentGroup.children.forEach((o,i)=>{ if(o.geometry?.type==='TorusGeometry') o.rotation.z=t*(.2+i*.05); });
  // Bào quan trôi quanh vị trí gốc trong tế bào chất (dòng nguyên sinh), và giãn
  // ra khi người dùng bấm "Tách lớp" — không quay quỹ đạo tròn quanh tâm.
  organelles.forEach(organelle=>{
    const {home,speed,phase}=organelle.userData;
    const drift=t*speed*modelSpinSpeed+phase;
    organelle.position.set(
      home.x*(1+modelExplode*.55)+Math.sin(drift)*.075,
      home.y*(1+modelExplode*.55)+Math.sin(drift*.83+1.4)*.06,
      home.z*(1+modelExplode*.55)+Math.cos(drift*.71)*.07
    );
    organelle.rotation.y+=dt*.24*modelSpinSpeed; organelle.rotation.x+=dt*.11*modelSpinSpeed;
  });
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
  earthSpin.rotation.x=earthManualX;
  earthSpin.rotation.y=t*.105+earthManualY;
  cloudLayer.rotation.y=t*.132+earthManualY*.84;
  moonOrbit.rotation.y=-t*.17;
  moon.rotation.y=t*.06;
  orbitLine.rotation.z=Math.sin(t*.18)*.035;
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
  tuneAdaptiveQuality(performance.now());
  renderRaf=requestAnimationFrame(render);
}
function startRenderLoop(){
  if(renderingPaused||renderRaf) return;
  clock.getDelta();
  renderRaf=requestAnimationFrame(render);
}
document.addEventListener('visibilitychange',()=>{
  renderingPaused=document.hidden;
  if(renderingPaused){
    if(renderRaf) cancelAnimationFrame(renderRaf);
    renderRaf=0;
  }else{
    performanceFrames=0;
    performanceWindowStart=performance.now();
    startRenderLoop();
  }
});
startRenderLoop();

function onResize(){
  resizeIntroCanvas();
  camera.aspect=innerWidth/innerHeight; camera.fov=mobileLayout()?52:42; camera.updateProjectionMatrix();
  adaptivePixelRatio=Math.min(devicePixelRatio||1,maximumPixelRatio); applyAdaptiveResolution(adaptivePixelRatio);
  computeAnchors();
}

addEventListener('resize',onResize);
