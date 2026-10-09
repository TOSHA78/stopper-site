// VRAKK — 3D (hero + конфигуратор). Загружается после первого взаимодействия или через 5 с после load.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $=id=>document.getElementById(id);
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const isMobile=()=>innerWidth<820;
const fmt=n=>n.toLocaleString('ru-RU').replace(/\u00a0/g,' ');

const VAR={
 '6p':{hd:'drilled',R:.19,size:380,disc:'380 мм',dim:'Ø 380 мм',pist:'Поршни Ø36 / 41 / 45 мм',pistN:'6 поршней Ø36/41/45 мм',body:'цельный корпус (моноблок), эмаль',kp:['6','поршней в суппорте','380','диаметр диска'],mass:'11,8 кг',sizes:[355,380],label:'Суппорт 6 поршней'},
 '4p':{hd:'ds',R:.165,size:330,disc:'330 мм',dim:'Ø 330 мм',pist:'Поршни Ø44 мм',pistN:'4 поршня Ø44 мм',body:'внешняя половина корпуса, эмаль',kp:['4','поршня в суппорте','330','диаметр диска'],mass:'9,6 кг',sizes:[330,355],label:'Суппорт 4 поршня'},
};
// third-party brands: approximate look of our own 3D model, prices approximate; no partnership implied
const BRANDS={
 brembo:{n:'Brembo',d:'серия GT',m:{'4p':'GT, 4 поршня','6p':'GT, 6 поршней'},p:{'4p':260000,'6p':380000},colors:['red','black','yellow','silver'],fin:'gloss'},
 ap:{n:'AP Racing',d:'Radi-CAL',m:{'4p':'CP9440, 4 поршня','6p':'CP9660, 6 поршней'},p:{'4p':190000,'6p':280000},colors:['gold','red','black'],fin:'anod'},
 alcon:{n:'Alcon',d:'серия RC',m:{'4p':'RC4, 4 поршня','6p':'RC6, 6 поршней'},p:{'4p':230000,'6p':330000},colors:['black','red'],fin:'gloss'},
 wilwood:{n:'Wilwood',d:'серия DynaPro',m:{'4p':'DynaPro, 4 поршня','6p':'DynaPro 6A, 6 поршней'},p:{'4p':110000,'6p':160000},colors:['red','black'],fin:'powder'},
};
const PADS={
 city:{n:'Hawk HPS',t:'Для города',temp:'до 400 °C',use:'тихие, мало пыли, хорошо работают холодными',p:0,fr:0x5f5a55,frR:.92,bk:0x3a3d42},
 active:{n:'EBC Yellowstuff',t:'Для активной езды',temp:'до 600 °C',use:'город + серпантин и редкий трек-день',p:7000,fr:0x3a352f,frR:.86,bk:0xc9a227},
 track:{n:'Ferodo DS2500',t:'Трек-дни',temp:'до 650 °C',use:'быстрая дорога и трек, стабильны при нагреве',p:16000,fr:0x24211f,frR:.8,bk:0x1d4fa8},
 race:{n:'Pagid RS29',t:'Трек и гонки',temp:'до 750 °C',use:'максимум сцепления, нужен прогрев, шумнее на улице',p:26000,fr:0x141416,frR:.72,bk:0xd8d9db},
};
const DISCS={plain:{n:'гладкий',use:'тихий, максимальная площадь трения',p:0},drilled:{n:'перфорированный',use:'отводит газы, быстрее остывает',p:6000},
             slotted:{n:'с насечками',use:'очищает колодку, стабильное торможение',p:6000},ds:{n:'перфорация + насечки',use:'баланс охлаждения и очистки',p:10000}};
const COLORS={gold:{n:'золотой',hex:0xc89b2c,p:0,met:true},red:{n:'красный',hex:0xc8102e,p:0},yellow:{n:'жёлтый',hex:0xf2b800,p:4900},black:{n:'чёрный',hex:0x141417,p:0},blue:{n:'синий',hex:0x1f4fbf,p:4900},
 silver:{n:'серебристый',hex:0xb9bdc3,p:6900,met:true},anogrey:{n:'серый анодированный',hex:0x5d636c,p:0,met:true}};
// downloaded real-geometry calipers (Sketchfab, CC BY 4.0) — normalised to our disc frame in Blender
const REAL={
 'brembo-6p':{t:'FREE - Brake Caliper Brembo',a:'Unity Fan',u:'https://sketchfab.com/3d-models/free-brake-caliper-brembo-39980ecb6a474ba38b1cf8e7df411a56'},
 'brembo-4p':{t:'6- Lug Brake Rotor and Brembo brake calipers',a:'DRIVER-FIRE',u:'https://sketchfab.com/3d-models/ef37be6ddce44f49b6f616145c1e16af'},
 'monoblock-6p':{t:'BRAKE CALLIPER',a:'VR DESIGNER',u:'https://sketchfab.com/3d-models/brake-calliper-b18ea04df4504172a70a4b32d72818a2'},
 'monoblock-4p':{t:'BRAKE CALLIPER',a:'VR DESIGNER',u:'https://sketchfab.com/3d-models/brake-calliper-0934bfa92bf44b1fbf4bbb5ce5e4c85b'},
 'wilwood-4p':{t:'SPOON CAR CALIPER',a:'ijiklvn',u:'https://sketchfab.com/3d-models/spoon-car-caliper-ad511e42db72421a9fa0b7b177833f93'}};
const BRAND_MODEL={brembo:{'6p':'brembo-6p','4p':'brembo-4p'},ap:{'6p':'monoblock-6p','4p':'monoblock-4p'},alcon:{'6p':'monoblock-6p','4p':'monoblock-4p'},wilwood:{'6p':'monoblock-6p','4p':'wilwood-4p'}};
const realCache={}; const loadReal=k=>realCache[k]||(realCache[k]=new Promise((res,rej)=>gl.load(`assets/real/${k}.glb?r=7`,g=>res(g.scene),undefined,rej)));
const CAL_PARTS=['CaliperBody','CaliperHalf','Piston_','Pad_','PadPin','PadSpring','Bleed','Fitting','Bracket','Bolt_'];
const isCalPart=n=>CAL_PARTS.some(p=>n.startsWith(p));
window.__BRANDS=BRANDS;
// caliper sits radially at 12 o'clock: centred on the disc plane, bridge just over the disc edge, bleed screws up
const SIZEP={330:0,355:8000,380:0};
const PRESETS={city:{brand:'wilwood',cal:'4p',pads:'city',disc:'plain',color:'red',size:330,name:'Комплект для города'},
 active:{brand:'ap',cal:'6p',pads:'active',disc:'ds',color:'red',size:380,name:'Для активной езды'},
 track:{brand:'brembo',cal:'6p',pads:'track',disc:'ds',color:'red',size:380,name:'Для трека'}};
const LABEL={RealCaliper:'Суппорт',CaliperHalf:'Внутренняя половина корпуса',Bolt_A:'Стяжной болт корпуса',Disc_:'Тормозной диск',Hat:'Колокол (центр диска)',CaliperBody:'Корпус суппорта',Piston_:'Поршень',Pad_:'Тормозная колодка',Bracket:'Кронштейн крепления',
 Bolt_M:'Болт крепления',PadPin:'Палец колодок',PadSpring:'Пружина колодок',Bleed:'Штуцеры прокачки',Fitting:'Подвод тормозной жидкости'};
const labelOf=n=>{const k=Object.keys(LABEL).find(k=>n.startsWith(k));return k?LABEL[k]:n};

// ---------- shared loading
const draco=new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/libs/draco/gltf/');
const gl=new GLTFLoader().setDRACOLoader(draco);
const loaderEl=$('loader'); const prog={};
const showProg=()=>{if(loaderEl&&loaderEl.isConnected)loaderEl.textContent='Загрузка 3D-модели · '+Math.round(((prog['6p']||0)*.6+(prog.h||0)*.4)*100)+'%'};
const loadGLB=(v,quiet)=>new Promise((res,rej)=>gl.load(`assets/brake-${v}.glb?r=v3c`,res,x=>{if(!quiet&&x.total){prog[v]=x.loaded/x.total;showProg()}},rej));
const loadHDR=()=>new Promise((res,rej)=>new RGBELoader().load('assets/studio_1k.hdr',t=>{prog.h=1;showProg();res(t)},undefined,rej));
function makeRenderer(canvas){
  const r=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
  r.setPixelRatio(Math.min(devicePixelRatio,2)); r.toneMapping=THREE.NeutralToneMapping; r.toneMappingExposure=1.0;
  r.outputColorSpace=THREE.SRGBColorSpace; r.shadowMap.enabled=true; r.shadowMap.type=THREE.PCFSoftShadowMap; return r;
}
function studio(scene,renderer,hdr){
  const pm=new THREE.PMREMGenerator(renderer); hdr.mapping=THREE.EquirectangularReflectionMapping;
  scene.environment=pm.fromEquirectangular(hdr).texture; scene.environmentIntensity=.85; scene.environmentRotation=new THREE.Euler(0,1.9,0);
  const key=new THREE.DirectionalLight(0xfff4ea,2.4); key.position.set(-1.4,2.2,1.6); key.castShadow=true;
  key.shadow.mapSize.set(1024,1024); Object.assign(key.shadow.camera,{left:-.7,right:.7,top:.7,bottom:-.7,near:.5,far:6}); key.shadow.bias=-.0004; key.shadow.normalBias=.002; key.shadow.radius=4;
  const rim=new THREE.DirectionalLight(0x9fe9ff,1.6); rim.position.set(2.2,.8,-2);
  const rim2=new THREE.DirectionalLight(0xffd7c2,.6); rim2.position.set(-2.4,.2,-1.8);
  scene.add(key,rim,rim2); return key;
}
function ground(R){
  const g=new THREE.Group();
  const sh=new THREE.Mesh(new THREE.PlaneGeometry(3,3),new THREE.ShadowMaterial({opacity:.45})); sh.rotation.x=-Math.PI/2; sh.receiveShadow=true; g.add(sh);
  const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');const gr=x.createRadialGradient(128,128,0,128,128,128);
  gr.addColorStop(0,'rgba(0,0,0,.85)');gr.addColorStop(.5,'rgba(0,0,0,.35)');gr.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gr;x.fillRect(0,0,256,256);
  const blob=new THREE.Mesh(new THREE.PlaneGeometry(R*2.3,R*1.1),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));
  blob.rotation.x=-Math.PI/2; blob.position.y=.0005; g.add(blob); g.userData={sh,blob}; return g;
}
// emissive heat map for discs (planar UVs: centre .5,.5, radius .5 = disc OD)
const heatTex=(()=>{const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');const g=x.createRadialGradient(256,256,0,256,256,256);
  g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.55,'rgba(0,0,0,1)');g.addColorStop(.66,'rgb(90,12,0)');g.addColorStop(.8,'rgb(255,96,18)');g.addColorStop(.92,'rgb(230,60,8)');g.addColorStop(1,'rgb(50,6,0)');
  x.fillStyle=g;x.fillRect(0,0,512,512);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t})();

// ---------- HERO (pinned exploded view)
const canvas=$('gl'), stage=$('stage');
let renderer; try{ renderer=makeRenderer(canvas);}catch(e){ $('fallback').style.display='flex'; loaderEl&&loaderEl.remove(); throw e; }
const scene=new THREE.Scene(); const camera=new THREE.PerspectiveCamera(28,1,.01,50);
const root=new THREE.Group(), model=new THREE.Group(); root.add(model); scene.add(root);
function cline(a,b){const g=new THREE.BufferGeometry().setFromPoints([a,b]);const l=new THREE.Line(g,new THREE.LineDashedMaterial({color:0x00e5ff,dashSize:.03,gapSize:.012,transparent:true,opacity:.3}));l.computeLineDistances();return l}
const axes=[cline(new THREE.Vector3(0,0,-.75),new THREE.Vector3(0,0,.75)),cline(new THREE.Vector3(0,-.3,0),new THREE.Vector3(0,.85,0)),cline(new THREE.Vector3(-.3,0,0),new THREE.Vector3(.3,0,0))];
axes.forEach(a=>model.add(a));
// choreography: path = list of segment end offsets (three.js: y up, +z outboard); f = follow caliper body; spin = turns while moving
const SPEC={
 PadPin:{p:[[0,0,.17],[0,.30,.22]],t:[.02,.30]}, PadSpring:{p:[[0,.24,0]],t:[.12,.34]},
 Bolt_M:{p:[[0,-.05,0],[0,-.22,0]],t:[.04,.36],spin:5}, Bolt_A:{p:[[0,0,-.14],[0,.06,-.30]],t:[.04,.36],spin:4,ax:'z'},
 Pad_Outer:{p:[[0,.19,0],[0,.24,.22]],t:[.20,.54]}, Pad_Inner:{p:[[0,.19,0],[0,.24,-.22]],t:[.22,.56]},
 Bracket:{p:[[0,-.04,-.16],[0,-.12,-.30]],t:[.30,.60]},
 CaliperBody:{p:[[0,.21,0]],t:[.38,.68]}, CaliperHalf:{p:[[0,.21,0],[0,.24,-.16]],t:[.38,.72]},
 Bleed:{p:[[0,.07,0]],t:[.62,.80],f:1}, Fitting:{p:[[-.04,.03,-.07]],t:[.62,.80],f:1},
 Piston_O:{p:[[0,0,.07],[0,-.01,.12]],t:[.62,.92],f:1,xs:.25}, Piston_I:{p:[[0,0,-.07],[0,-.01,-.12]],t:[.64,.94],f:'CaliperHalf',xs:.25},
 Hat:{p:[[0,0,.18],[0,-.02,.34]],t:[.50,.86]}, Disc_:{p:[[0,-.03,.05]],t:[.50,.86]}};
const H={cur:'6p',groups:{},parts:{},by:{},gnd:null,disc:null};
const edgeMat=new THREE.LineBasicMaterial({color:0x00e5ff,transparent:true,opacity:0});
function calls(v){const V=VAR[v];return[
 {k:'Disc_'+V.hd,n:'01',h:'Тормозной диск '+V.disc,p:'вентилируемый, с рёбрами внутри'},
 {k:'Hat',n:'02',h:'Колокол (центр диска)',p:'алюминий, плавающее крепление'},
 {k:'CaliperBody',n:'03',h:V.label,p:V.body},
 {k:'CaliperHalf',n:'04',h:'Внутренняя половина',p:'стягивается с внешней болтами'},
 {k:'Piston_O2',n:'05',h:'Поршни',p:V.pist.replace('Поршни ','сталь, ')},
 {k:'Pad_Outer',n:'06',h:'Тормозные колодки',p:'стальная основа + фрикционная накладка'},
 {k:'Bolt_A2',n:'07',h:'Стяжные болты',p:'держат мост корпуса над диском'},
 {k:'PadPin1',n:'08',h:'Пальцы колодок',p:'держат колодки, вынимаются первыми'}].filter(c=>!H.by[v]||H.by[v][c.k]).map((c,i)=>({...c,n:String(i+1).padStart(2,'0')}))}
let CALL=[];
function buildCallouts(){
  const w=$('callouts'); w.innerHTML=''; CALL=calls(H.cur);
  CALL.forEach(c=>{const d=document.createElement('div');d.className='co';d.innerHTML=`<div class="n mono">${c.n} ——</div><b class="cot">${c.h}</b><p class="mono">${c.p}</p>`;w.appendChild(d);c.el=d});
  $('legend').innerHTML=CALL.map(c=>`<div><b>${c.n}</b>${c.h.replace(/ \d+ мм$/,'')}</div>`).join('');
  const V=VAR[H.cur]; $('kP').textContent=V.kp[0];$('kPd').textContent=V.kp[1];$('kD').textContent=V.kp[2];$('kDd').textContent=V.kp[3];
  $('tbCode').textContent=V.label.replace('Суппорт ',''); $('tbDisc').textContent=V.disc;
  { const t=`Суппорт на ${V.kp[0]==='6'?'6 поршней':'4 поршня'}, вентилируемый диск ${V.size}\u00a0мм и плавающий колокол.`; if($('introTxt').textContent!==t) $('introTxt').textContent=t; } $('tbMass').textContent=V.mass;
}
function setHeroVariant(v){ if(!H.groups[v]){ document.querySelectorAll('#vtoggle button').forEach(b=>b.classList.toggle('on',b.dataset.v===v)); ensure4p().then(()=>setHeroVariant(v)).catch(e=>console.error(e)); return; }
  H.cur=v; for(const k in H.groups) H.groups[k].visible=(k===v);
  document.querySelectorAll('#vtoggle button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  buildCallouts(); if(H.gnd){H.gnd.position.y=-VAR[v].R-.001;} last=-1; }
$('vtoggle').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;setHeroVariant(b.dataset.v); if(window.CFG) CFG.set({cal:b.dataset.v});});

let P=0,Ps=0,last=-1;
const svg=$('lines'); const v3=new THREE.Vector3();
function onResize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();svg.setAttribute('viewBox',`0 0 ${w} ${h}`)}
addEventListener('resize',()=>{onResize();last=-1});
function proj(obj,local){ v3.copy(local); obj.localToWorld(v3); v3.project(camera); return [(v3.x+1)/2*stage.clientWidth,(1-v3.y)/2*stage.clientHeight]; }
const _b=new THREE.Box3(), _c=new THREE.Vector3();
function worldCenterScreen(o){ _b.setFromObject(o); _b.getCenter(_c); _c.project(camera); return [(_c.x+1)/2*stage.clientWidth,(1-_c.y)/2*stage.clientHeight]; }
function explodeAmount(p){ return Math.min(clamp((p-.06)/.56), 1-clamp((p-.80)/.14)); }
const tmp=new THREE.Vector3(); const ZAX=new THREE.Vector3(0,0,1);
function pathAt(path,k,out){ out.set(0,0,0); if(k<=0) return out; const n=path.length, f=k*n, i=Math.min(n-1,Math.floor(f)), u=ease(f-i);
  const a=i?path[i-1]:[0,0,0], b=path[i]; return out.set(a[0]+(b[0]-a[0])*u, a[1]+(b[1]-a[1])*u, a[2]+(b[2]-a[2])*u); }
// ---- braking demo state
const DEMO={on:false,t0:0,ang:0,heat:0,clamp:0,zoom:0};
function demoStep(now){
  if(!DEMO.on) return false; const t=DEMO.fix!=null?DEMO.fix:(now-DEMO.t0)/1000;
  const spd=t<.9?1:Math.max(0,1-ease(clamp((t-.9)/2.8)));            // wheel speed 1..0
  DEMO.ang+=spd*.22;
  DEMO.clamp=t<.45?-clamp(t/.45):t<.9?-1+2*ease(clamp((t-.45)/.45)):t<6.2?1:1-clamp((t-6.2)/.6);    // -1 retracted .. 1 clamped
  DEMO.heat=t<.9?0:t<3.8?ease(clamp((t-.9)/2.9)):Math.max(0,1-clamp((t-3.8)/4.5));
  DEMO.zoom=t<.6?ease(t/.6):t<7?1:1-clamp((t-7)/1.2);
  const kmh=Math.round(200*spd), deg=Math.round(60+640*DEMO.heat);
  $('brakeHud').innerHTML=`<b>${kmh}</b> км/ч &nbsp;·&nbsp; диск <b>${deg}</b> °C`;
  if(t>8.6){DEMO.on=false;DEMO.heat=0;DEMO.clamp=0;DEMO.zoom=0;$('brakeHud').classList.remove('on');$('brakeBtn').classList.remove('on');applyHeat(0);}
  return true;
}
function applyHeat(h){ const g=H.groups[H.cur]; if(!g) return; const d=H.by[H.cur]['Disc_'+VAR[H.cur].hd]; if(!d) return;
  d.traverse(m=>{ if(m.isMesh){ const mt=m.material; if(!mt.userData.heat){ mt.emissiveMap=heatTex; mt.userData.heat=1; mt.needsUpdate=true; }
    mt.emissive.setRGB(1,.55+.35*h,.25+.3*h); mt.emissiveIntensity=h*h*1.5; } }); }
$('brakeBtn').addEventListener('click',()=>{ if(DEMO.on) return; const r=$('hero').getBoundingClientRect(); if(r.top<-30){ scrollTo({top:scrollY+r.top,behavior:'instant'}); P=Ps=0; }
  DEMO.on=true; DEMO.t0=performance.now(); $('brakeHud').classList.add('on'); $('brakeBtn').classList.add('on'); });
// ---- hover highlight
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2(); let hovered=null;
function partOf(obj){ const g=H.groups[H.cur]; while(obj&&obj.parent&&obj.parent!==g) obj=obj.parent; return obj&&obj.parent===g?obj:null; }
function setHL(o,on){ if(!o) return; o.traverse(m=>{ if(m.isMesh&&m.material&&m.material.emissive&&!m.material.userData.heat){ m.material.emissive.setHex(on?0x00a8c0:0); m.material.emissiveIntensity=on?.55:1; } }); }
stage.addEventListener('pointermove',e=>{ if(isMobile()||!H.groups[H.cur]) return; const r=canvas.getBoundingClientRect(); ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
  ray.setFromCamera(ndc,camera); const hit=ray.intersectObject(H.groups[H.cur],true).find(h=>h.object.isMesh&&h.object.visible); const p=hit?partOf(hit.object):null;
  if(p!==hovered){ setHL(hovered,false); hovered=p; setHL(hovered,true); last=-1; }
  const tip=$('tip'); if(p){ tip.textContent=labelOf(p.name); tip.style.left=(e.clientX-r.left+16)+'px'; tip.style.top=(e.clientY-r.top+12)+'px'; tip.classList.add('on'); } else tip.classList.remove('on'); });
stage.addEventListener('pointerleave',()=>{ setHL(hovered,false); hovered=null; $('tip').classList.remove('on'); last=-1; });

function update(){
  if(!H.groups[H.cur]) return;
  const w=stage.clientWidth,h=stage.clientHeight,mob=isMobile(); const E=explodeAmount(Ps), e=ease(E);
  const intro=$('intro'); const io_=clamp(1-Ps/.10); intro.style.opacity=io_; intro.style.transform=(mob?'':'translateY(-46%) ')+`translateX(${-40*(1-io_)}px)`; intro.style.pointerEvents=io_>.3?'auto':'none';
  $('outro').style.opacity=clamp((Ps-.9)/.06);
  { const lg=$('legend'); const lo=mob?clamp((E-.04)/.14):1; lg.style.opacity=lo; lg.style.visibility=lo<.02?'hidden':'visible'; }
  const lift=mob? .36*(1-clamp(Ps/.12))+.07*e : 0;
  const dist=(mob?2.6:1.55)+e*(mob?1.3:.82)-DEMO.zoom*(mob?.5:.32);
  camera.position.set(0,.18+e*.25-lift-DEMO.zoom*.04,dist); camera.lookAt(0,.08+e*.14-lift+DEMO.zoom*.04,0);
  root.position.x=mob?0:.18*(1-clamp(Ps/.12))*(Ps<.5?1:0);
  root.rotation.y=-0.66+e*.04+DEMO.zoom*.12; root.rotation.x=.10+e*.12;
  const parts=H.parts[H.cur]; const offs={};
  for(const nm of ['CaliperBody','CaliperHalf']){ const b=parts.find(p=>p.o.name===nm); if(b){ const s=b.s; offs[nm]=pathAt(s.p,clamp((E-s.t[0])/(s.t[1]-s.t[0])),new THREE.Vector3()); } }
  const bodyOff=offs.CaliperBody||new THREE.Vector3();
  const cl=DEMO.clamp*.0035;
  for(const p of parts){ const s=p.s, k=clamp((E-s.t[0])/(s.t[1]-s.t[0])); pathAt(s.p,k,tmp); if(s.xs) tmp.x+=p.base.x*s.xs*ease(k)*3;
    p.o.position.copy(p.base).add(tmp); if(s.f) p.o.position.add((s.f!==1&&offs[s.f])||bodyOff);
    if(s.spin){ if(s.ax==='z') p.o.rotation.z=p.rz0+ease(k)*s.spin*Math.PI*2; else p.o.rotation.y=p.r0+ease(k)*s.spin*Math.PI*2; }
    if(DEMO.on&&E<.02){ const n=p.o.name; const sg=n.endsWith('Outer')||n.startsWith('Piston_O')?-1:n.endsWith('Inner')||n.startsWith('Piston_I')?1:0; if(sg&&(n.startsWith('Pad_')||n.startsWith('Piston_'))) p.o.position.z+=sg*cl*(n.startsWith('Pad_')?1:1); } }
  const by=H.by[H.cur]; const dk=by['Disc_'+VAR[H.cur].hd]; dk.rotation.z=-Ps*2.2-DEMO.ang; by.Hat.rotation.z=-Ps*2.2-DEMO.ang;
  edgeMat.opacity=e*.32; axes.forEach(a=>a.material.opacity=.12+e*.45);
  if(H.gnd){H.gnd.userData.sh.material.opacity=.45*(1-e); H.gnd.userData.blob.material.opacity=.9*(1-e);}
  renderer.render(scene,camera);
  $('pbar').style.width=(Ps*100)+'%'; $('pval').textContent=Math.round(e*100)+'%';
  $('phaseTxt').textContent=DEMO.on?'Тест торможения':Ps>.9?'Узел снова собран':e<.02?'Собранный узел':e<.98?'Разборка · '+Math.round(e*100)+'%':'Разобранный вид';
  let out=''; const items=[];
  CALL.forEach((c,i)=>{const o=by[c.k]; if(!o) return; const show=E>.18+i*(.48/Math.max(1,CALL.length-1)); c.el.classList.toggle('on',show); const [x,y]=worldCenterScreen(o); items.push({c,x,y,show});});
  if(mob){ items.forEach(t=>{ if(!t.show) return; out+=`<circle cx="${t.x}" cy="${t.y}" r="9" fill="#05010f" stroke="#00e5ff"/><text x="${t.x}" y="${t.y+3.5}" text-anchor="middle" font-family="Manrope" font-size="9" fill="#00e5ff">${t.c.n}</text>`; }); }
  const L=mob?[]:items.filter(t=>t.x<w*.5), R=mob?[]:items.filter(t=>t.x>=w*.5);
  const place=(arr,side)=>{ arr.sort((a,b)=>a.y-b.y); const top=h*.17,bot=side==='r'&&w>1100?h*.74:h*.86; const n=arr.length;
    arr.forEach((t,i)=>{ const ly=n===1?(top+bot)/2:top+(bot-top)*(i/(n-1)); const lx=side==='l'?56:w-306;
      t.c.el.className='co '+side+(t.show?' on':''); t.c.el.style.left=lx+'px'; t.c.el.style.top=(ly-14)+'px'; if(!t.show) return;
      const ex=side==='l'?lx+260:lx-10, el=side==='l'?ex+40:ex-40;
      out+=`<polyline points="${ex},${ly} ${el},${ly} ${t.x},${t.y}" fill="none" stroke="#00e5ff" stroke-opacity=".55"/><circle cx="${t.x}" cy="${t.y}" r="3.5" fill="#05010f" stroke="#00e5ff"/><circle cx="${t.x}" cy="${t.y}" r="1.2" fill="#00e5ff"/><line x1="${ex}" y1="${ly-6}" x2="${ex}" y2="${ly+6}" stroke="#00e5ff" stroke-opacity=".8"/>`; }); };
  place(L,'l'); place(R,'r');
  if(E>.55){ const V=VAR[H.cur], d=dk, par=d.parent, c0=d.position.clone();
    const a=proj(par,c0.clone().add(new THREE.Vector3(0,V.R,0))), b=proj(par,c0.clone().add(new THREE.Vector3(0,-V.R,0)));
    const cc=proj(par,c0), tp=proj(par,c0.clone().add(new THREE.Vector3(V.R,0,0)));
    const ang=Math.atan2(b[1]-a[1],b[0]-a[0]), nx=Math.sin(ang), ny=Math.cos(ang), off=Math.abs(tp[0]-cc[0])+34, op=clamp((E-.55)/.3);
    const A=[a[0]+nx*off,a[1]+ny*off],B=[b[0]+nx*off,b[1]+ny*off];
    const ar=(p,dir)=>{const s=9,ca=Math.cos(ang)*dir,sa=Math.sin(ang)*dir;return `${p[0]},${p[1]} ${p[0]+s*ca-3*sa},${p[1]+s*sa+3*ca} ${p[0]+s*ca+3*sa},${p[1]+s*sa-3*ca}`};
    const mx=(A[0]+B[0])/2,my=(A[1]+B[1])/2, rot=ang*180/Math.PI+(Math.abs(ang)>Math.PI/2-.01?180:0);
    out+=`<g opacity="${op}"><line x1="${a[0]}" y1="${a[1]}" x2="${A[0]+nx*8}" y2="${A[1]+ny*8}" stroke="#00e5ff" stroke-opacity=".45"/><line x1="${b[0]}" y1="${b[1]}" x2="${B[0]+nx*8}" y2="${B[1]+ny*8}" stroke="#00e5ff" stroke-opacity=".45"/><line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="#00e5ff"/><polygon points="${ar(A,1)}" fill="#00e5ff"/><polygon points="${ar(B,-1)}" fill="#00e5ff"/><text class="dimtxt" x="${mx}" y="${my-8}" text-anchor="middle" transform="rotate(${rot} ${mx} ${my})">${V.dim}</text></g>`; }
  svg.innerHTML=out;
}
function readP(){const r=$('hero').getBoundingClientRect();P=clamp(-r.top/(r.height-innerHeight));}
function tick(now){ let dirty=false; const d=P-Ps; if(Math.abs(d)>1e-4){ Ps+=d*.14; dirty=true; } else if(Ps!==P){ Ps=P; dirty=true; }
  if(demoStep(now)){ applyHeat(DEMO.heat); dirty=true; }
  if(dirty||last<0){ last=1; update(); } }

// ---------- CONFIGURATOR
function makeConfigurator(gltfs,hdr){
  const cv=$('cfgGl'), box=cv.parentElement; const r=makeRenderer(cv); const sc=new THREE.Scene(); studio(sc,r,hdr);
  const cam=new THREE.PerspectiveCamera(30,1,.01,30); cam.position.set(-.6,.3,1.16);
  const ctl=new OrbitControls(cam,cv); ctl.target.set(0,.06,0); ctl.enableDamping=true; ctl.dampingFactor=.08; ctl.enablePan=false;
  ctl.minDistance=.75; ctl.maxDistance=2.2; ctl.minPolarAngle=.5; ctl.maxPolarAngle=1.75; ctl.autoRotate=true; ctl.autoRotateSpeed=.7;
  const G={}, mats={}, pads={}, discs={};
  // both piston variants use the full disc range (plain / drilled / slotted / both) — the 4-piston set gets it scaled to 330 mm
  for(const v of ['6p','4p']){ const g=gltfs['6p'].scene.clone(true); if(v==='4p') g.scale.setScalar(VAR['4p'].R/VAR['6p'].R); g.traverse(m=>{ if(m.isMesh){ m.material=m.material.clone(); m.castShadow=m.receiveShadow=true; } });
    mats[v]={paint:[],fr:[],bk:[],logo:[]}; discs[v]={}; pads[v]=[];
    g.traverse(m=>{ if(m.isMesh){ const n=m.material.name; if(n==='Caliper_Paint')mats[v].paint.push(m.material); if(n==='Pad_Friction')mats[v].fr.push(m.material); if(n==='Pad_Backing')mats[v].bk.push(m.material); if(n==='Logo_Paint')mats[v].logo.push(m.material);} });
    g.children.forEach(o=>{ if(o.name.startsWith('Disc_')) discs[v][o.name.slice(5)]=o; if(o.name.startsWith('Pad_')) pads[v].push({o,base:o.position.clone(),s:o.name==='Pad_Outer'?1:-1}); });
    g.children.forEach(o=>{ if(isCalPart(o.name)) o.visible=false; });
    const holder=new THREE.Group(); holder.add(g); holder.userData.g=g; holder.userData.real={}; const gnd=ground(VAR[v].R); gnd.position.y=-VAR[v].R-.001; holder.add(gnd); holder.rotation.y=.22;
    sc.add(holder); G[v]=holder; }
  const st={brand:'brembo',cal:'6p',color:'red',pads:'active',disc:'drilled',size:380}; let peek=0, peekT=0, visible=false, dirty=true;
  function resize(){const w=cv.clientWidth,h=cv.clientHeight;r.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix(); const d=w<600?1.75:1.3; cam.position.sub(ctl.target).setLength(d).add(ctl.target); dirty=true}
  addEventListener('resize',resize); resize();
  ctl.addEventListener('start',()=>{ctl.autoRotate=false}); ctl.addEventListener('change',()=>dirty=true);
  new IntersectionObserver(es=>es.forEach(e=>visible=e.isIntersecting),{threshold:.05}).observe(box);
  function renderOptions(){ const B=BRANDS[st.brand];
    if(!B.colors.includes(st.color)) st.color=B.colors[0];
    if(!VAR[st.cal].sizes.includes(st.size)) st.size=VAR[st.cal].sizes[VAR[st.cal].sizes.length-1];
    $('cfgColors').innerHTML=B.colors.map(c=>`<button data-v="${c}" style="--c:#${COLORS[c].hex.toString(16).padStart(6,'0')}"><i></i>${COLORS[c].n[0].toUpperCase()+COLORS[c].n.slice(1)}</button>`).join('');
    $('cfgSizes').innerHTML=VAR[st.cal].sizes.map(s=>`<button data-v="${s}">${s} мм<small>${SIZEP[s]?'+'+fmt(SIZEP[s])+' ₽':'базовый'}</small></button>`).join('');
    $('m4').textContent=B.m['4p']; $('m6').textContent=B.m['6p']; }
  function showReal(){ const key=BRAND_MODEL[st.brand][st.cal], h=G[st.cal];
    for(const v in G) for(const k in G[v].userData.real) G[v].userData.real[k].visible=(v===st.cal&&k===key);
    if(!h.userData.real[key]){ loadReal(key).then(sc0=>{ if(h.userData.real[key]) return; const o=sc0.clone(true); o.name='RealCaliper';
        o.traverse(m=>{ if(m.isMesh){ m.material=m.material.clone(); m.castShadow=m.receiveShadow=true; } }); h.add(o); h.userData.real[key]=o; apply(); }).catch(e=>console.error(e)); }
    $('cfgLoad').style.display=h.userData.real[key]?'none':'flex'; const R=REAL[key]; $('cfgModel').innerHTML=`3D-модель: «${R.t}» — ${R.a}, <a href="${R.u}" target="_blank" rel="noopener">Sketchfab</a>, CC BY 4.0`;
    return h.userData.real[key]; }
  function apply(){
    renderOptions(); const B=BRANDS[st.brand], C=COLORS[st.color]; const real=showReal();
    if(real) real.traverse(m=>{ if(m.isMesh&&m.material.name.startsWith('Pad_Backing')){ m.material.color.setHex(PADS[st.pads].bk); m.material.metalness=.3; m.material.roughness=.45; }
      if(m.isMesh&&m.material.name.startsWith('Pad_Friction')){ m.material.color.setHex(PADS[st.pads].fr); m.material.roughness=PADS[st.pads].frR; } });
    if(real) real.traverse(m=>{ if(m.isMesh&&m.material.name.startsWith('Caliper_Paint')){ const mt=m.material; mt.color.setHex(C.hex); mt.metalness=C.met?.75:B.fin==='anod'?.35:0; mt.roughness=C.met?.3:B.fin==='powder'?.48:B.fin==='anod'?.36:st.color==='black'?.36:.28; if('clearcoat' in mt) mt.clearcoat=B.fin==='gloss'?1:.3; } });
    for(const v in G){ G[v].visible=(v===st.cal); for(const k in discs[v]) discs[v][k].visible=(k===st.disc);
      mats[v].paint.forEach(m=>{m.color.setHex(C.hex); m.metalness=C.met?.75:B.fin==='anod'?.35:.0; m.roughness=C.met?.32:B.fin==='powder'?.48:B.fin==='anod'?.36:st.color==='black'?.38:.3;
        if('clearcoat' in m) m.clearcoat=B.fin==='gloss'?1:B.fin==='anod'?.25:.4; });
      mats[v].logo.forEach(m=>{ if(B.logo){m.color.setHex(0xf2f2f2);m.roughness=.4;m.metalness=0;} else {m.color.setHex(C.hex);m.roughness=mats[v].paint[0]?.roughness??.3;m.metalness=mats[v].paint[0]?.metalness??0;} });
      mats[v].fr.forEach(m=>{m.color.setHex(PADS[st.pads].fr); m.roughness=PADS[st.pads].frR;});
      mats[v].bk.forEach(m=>{m.color.setHex(PADS[st.pads].bk); m.metalness=.3; m.roughness=.45;}); }
    document.querySelectorAll('.panel [data-k]').forEach(g=>g.querySelectorAll('button').forEach(b=>b.classList.toggle('on',String(b.dataset.v)===String(st[g.dataset.k]))));
    const V=VAR[st.cal], Pd=PADS[st.pads], Dc=DISCS[st.disc];
    const price=B.p[st.cal]+Pd.p+Dc.p+C.p+(SIZEP[st.size]||0)-(st.cal==='6p'&&st.size===355?8000:0);
    const tier=Object.values(PRESETS).find(p=>p.brand===st.brand&&p.cal===st.cal&&p.pads===st.pads&&p.disc===st.disc&&p.size===st.size)||null;
    const name=`${B.n} ${B.m[st.cal]}`;
    $('cfgName').textContent=name; $('cfgTier').textContent=tier?`= ${tier.name.toUpperCase()}`:''; $('cfgTier').style.display=tier?'':'none';
    $('cfgCode').textContent=`${B.n} · ${st.size} мм · ${Pd.n}`; const PR=window.__promo&&window.__promo(), fin=PR?Math.round(price*(1-PR.pct/100)/100)*100:price; $('cfgPrice').textContent='≈ '+fmt(fin)+' ₽'; $('cfgOld').innerHTML=PR?`<s>≈ ${fmt(price)} ₽</s> <em>−${PR.pct} % · ${PR.code}</em>`:''; $('cfgPrice').classList.toggle('disc',!!PR);
    $('cfgBrandNote').textContent=B.d; $('cfgCalNote').textContent=C.p?`особый цвет +${fmt(C.p)} ₽`:(B.fin==='anod'?'анодирование':'эмаль + лак');
    $('cfgPadNote').textContent=Pd.t+' · '+Pd.temp; $('cfgDiscNote').textContent=Dc.use;
    $('cfgSpec').innerHTML=`<dt>Суппорт</dt><dd>${name} · ${C.n}</dd><dt>Диск</dt><dd>${st.size} мм · ${Dc.n}</dd><dt>Колодки</dt><dd>${Pd.n} — ${Pd.use}</dd><dt>Поршни</dt><dd>${V.pistN}</dd><dt>Колёса</dt><dd>от ${st.size>=380?'19':st.size>=355?'18':'17'}″</dd>`;
    $('cfgHint').textContent=peekT>performance.now()?'КОЛОДКИ ВЫДВИНУТЫ ДЛЯ ОСМОТРА':'\u00a0';
    window.__cfg={...st,price,name}; { const k=document.getElementById('form').kit; if(k) k.placeholder=`${B.n} ${B.m[st.cal].replace(/, \d поршн.*$/,'')} · ${st.size} мм`; } window.__cfgDesc={promo:PR?PR.code:'',pct:PR?PR.pct:0,final:fin,brand:B.n,series:B.m[st.cal].replace(/, \d поршн.*$/,''),pist:V.pistN,disc:`${st.size} мм, ${Dc.n}`,pads:`${Pd.n} (${Pd.t.toLowerCase()})`,color:C.n,price}; dirty=true; document.dispatchEvent(new Event('vrakk:cfg'));
  }
  function set(o,src){ for(const k in o) st[k]=k==='size'?+o[k]:o[k]; apply(); }
  document.querySelector('.panel').addEventListener('click',e=>{const b=e.target.closest('[data-k] button'); if(!b) return; const k=b.closest('[data-k]').dataset.k;
    set(k==='brand'?{brand:b.dataset.v,color:BRANDS[b.dataset.v].colors[0]}:{[k]:b.dataset.v},k); if(k==='cal'&&H.cur!==b.dataset.v) setHeroVariant(b.dataset.v);});
  $('cfgOrder').addEventListener('click',()=>{const f=$('form'); const c=window.__cfg; f.kit.value=`${c.name} · ${COLORS[c.color].n} · диск ${c.size} мм ${DISCS[c.disc].n} · колодки ${PADS[c.pads].n} · ≈ ${fmt(c.price)} ₽/ось (примерно)`;
    $('cta').scrollIntoView({behavior:'smooth'}); setTimeout(()=>f.name.focus({preventScroll:true}),700);});
  document.querySelectorAll('[data-preset]').forEach(a=>a.addEventListener('click',()=>{const p=PRESETS[a.dataset.preset]; set({brand:p.brand,cal:p.cal,pads:p.pads,disc:p.disc,color:p.color,size:p.size}); setHeroVariant(p.cal);}));
  const enc=()=>`#k=${[st.brand,st.cal,st.color,st.pads,st.disc,st.size].join('.')}`+(window.__fitCar?`&car=${encodeURIComponent(window.__fitCar)}`:'')+(window.__vin?`&vin=${window.__vin}`:'');
  window.__shareLink=()=>location.origin+location.pathname.replace(/index\.html$/,'')+enc(); window.__kitLink=()=>location.origin+location.pathname.replace(/index\.html$/,'')+`#k=${[st.brand,st.cal,st.color,st.pads,st.disc,st.size].join('.')}`;
  $('cfgShare').addEventListener('click',async()=>{ const u=window.__shareLink(); history.replaceState(null,'',enc()); const ok=await window.__copy(u); window.__toast(ok?'Ссылка на комплект скопирована':'Ссылка: '+u); });
  $('cfgTg').addEventListener('click',()=>document.getElementById('tgSend').click());
  { const m=/#k=([^&]+)/.exec(location.hash); if(m){ const [brand,cal,color,pads,disc,size]=decodeURIComponent(m[1]).split('.');
      if(BRANDS[brand]&&VAR[cal]){ Object.assign(st,{brand,cal}); if(COLORS[color]) st.color=color; if(PADS[pads]) st.pads=pads; if(DISCS[disc]) st.disc=disc; if(+size) st.size=+size; }
      const c=/car=([^&]+)/.exec(location.hash), v=/vin=([^&]+)/.exec(location.hash); if(c){ window.__fitCar=decodeURIComponent(c[1]); $('form').car.value=window.__fitCar; } if(v) window.__vin=v[1];
      setTimeout(()=>{ document.getElementById('configurator').scrollIntoView({behavior:'instant'}); if(H.cur!==st.cal) setHeroVariant(st.cal); },300); } }
  apply();
  (function loop(){ requestAnimationFrame(loop); if(!visible) return;
    const now=performance.now(), target=now<peekT?1:0; const np=peek+(target-peek)*.08; if(Math.abs(np-peek)>1e-4){peek=np;dirty=true;} else peek=target;
    if(peekT && now>peekT && $('cfgHint').textContent!=='\u00a0'){ $('cfgHint').textContent='\u00a0'; }
    for(const p of pads[st.cal]){ p.o.position.copy(p.base); p.o.position.y+=ease(peek)*.085; p.o.position.z+=p.s*ease(peek)*.03; }
    if(ctl.autoRotate) dirty=true; ctl.update();
    if(dirty){ r.render(sc,cam); dirty=false; } })();
  return {set,G,st,cam,ctl,render:()=>{dirty=true}};
}

// ---------- boot
// hero variant setup: the real caliper split into its own parts replaces the procedural one
function setupVariant(v,gltf,real){ const g=gltf.scene; H.groups[v]=g; H.parts[v]=[]; H.by[v]={}; g.visible=v===H.cur;
    g.children.filter(o=>isCalPart(o.name)).forEach(o=>g.remove(o));
    real.clone(true).children.slice().forEach(o=>g.add(o));
    g.traverse(m=>{ if(m.isMesh){ m.castShadow=m.receiveShadow=true; m.material=m.material.clone(); } });
    g.children.slice().forEach(o=>{ H.by[v][o.name]=o; if(o.name.startsWith('Disc_')&&o.name!=='Disc_'+VAR[v].hd){o.visible=false;return;}
      const key=Object.keys(SPEC).find(k=>o.name.startsWith(k)); if(!key) return;
      H.parts[v].push({o,base:o.position.clone(),r0:o.rotation.y,rz0:o.rotation.z,s:SPEC[key]});
      if(!isCalPart(o.name)) o.traverse(m=>{ if(m.isMesh && m.geometry.index && m.geometry.index.count<60000){ m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry,38),edgeMat)); } }); });
    model.add(g); }
// the 4-piston hero set is loaded lazily: after first paint (idle) or as soon as the visitor asks for it
let v4P=null; const ensure4p=()=>v4P||(v4P=Promise.all([loadGLB('4p',true),loadReal('monoblock-4p')]).then(([g4,r4])=>{ setupVariant('4p',g4,r4); last=-1; }));
Promise.all([loadGLB('6p'),loadHDR(),loadReal('monoblock-6p')]).then(([g6,hdr,r6])=>{
  try{ window.CFG=makeConfigurator({'6p':g6},hdr); }catch(e){ console.error(e); }
  studio(scene,renderer,hdr);
  setupVariant('6p',g6,r6);
  H.gnd=ground(.19); model.add(H.gnd);
  loaderEl&&loaderEl.remove(); onResize(); setHeroVariant('6p'); readP(); Ps=P; last=-1;
  addEventListener('scroll',readP,{passive:true});
  (function loop(now){ tick(now||performance.now()); requestAnimationFrame(loop); })();
  (window.requestIdleCallback||setTimeout)(()=>ensure4p().catch(e=>console.error(e)),{timeout:4000});
}).catch(err=>{ console.error(err); loaderEl&&loaderEl.remove(); $('fallback').style.display='flex'; });

