(() => {
  // ===== Viewport fit / phone scale =====
  const phone=document.getElementById('phone');
  function fit(){ const s=Math.min(innerWidth/390, innerHeight/700); phone.style.transform=`scale(${s})`; }
  addEventListener('resize', fit, {passive:true}); fit();

  // ===== Canvas setup =====
  const cvs=document.getElementById('game'), ctx=cvs.getContext('2d',{alpha:true});
  ctx.imageSmoothingEnabled=false; const W=390, H=540;
  function setup(){ const dpr=Math.max(1,devicePixelRatio||1); cvs.width=W*dpr; cvs.height=H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }
  setup(); addEventListener('resize', setup, {passive:true});

  const overlay=document.getElementById('overlay'), loading=document.getElementById('loading'), gameover=document.getElementById('gameover');

  // ===== BGM control =====
  const bgm = document.getElementById('bgm');
  function playBGM(){
    try{
      bgm.currentTime = 0;
      // iOS/Safari 対策：ユーザー操作（タップ）を起点に呼ばれる
      bgm.play().catch(()=>{/* サイレント失敗でOK */});
    }catch(e){}
  }
  function stopBGM(){
    try{
      bgm.pause();
      bgm.currentTime = 0;
    }catch(e){}
  }

  // ===== Utilities: image loader =====
  function load(src){ return new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=src; }); }

  // ===== Load all assets then boot =====
  Promise.all([
    load('sora.png'), load('mob.png'),
    load('corn.png'), load('contena.png'), load('gomi.png'),
    load('tora.png'),
    load('tsubasa.png'), load('en.png'), load('mranp.png'),
    load('viran.png'), load('tama.png'), load('viran op.png'),
    load('VR.png').catch(()=>null), load('orange.png').catch(()=>null),
    load('pink.png').catch(()=>null), load('chi.png').catch(()=>null),
    load('green.png').catch(()=>null), load('redblue.png').catch(()=>null),
  ]).then(([IMG_BG, IMG_GR, IMG_CO, IMG_CT, IMG_GO, IMG_TR, IMG_TS, IMG_EN, IMG_LP, IMG_VI, IMG_TM, IMG_LOGO, IMG_VR, IMG_OR, IMG_PINK, IMG_CHI, IMG_GREEN, IMG_RB])=>{

    // ===== Skins map =====
    const SKINS = { VR:IMG_VR, orange:IMG_OR, pink:IMG_PINK, chi:IMG_CHI, green:IMG_GREEN, redblue:IMG_RB };

    // ===== Pixel helpers =====
    const Px = {
      topTrim(img){ const w=img.naturalWidth,h=img.naturalHeight,c=document.createElement('canvas'); c.width=w;c.height=h;
        const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(img,0,0);
        const d=g.getImageData(0,0,w,h).data,TH=12;
        for(let y=0;y<h;y++){ for(let x=0;x<w;x++){ if(d[(y*w+x)*4+3]>TH) return {trimTop:y,contentH:h-y}; } }
        return {trimTop:0,contentH:h};
      },
      bottomTrim(img){ const w=img.naturalWidth,h=img.naturalHeight,c=document.createElement('canvas'); c.width=w;c.height=h;
        const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(img,0,0);
        const d=g.getImageData(0,0,w,h).data,TH=12;
        for(let y=h-1;y>=0;y--){ for(let x=0;x<w;x++){ if(d[(y*w+x)*4+3]>TH) return {bottomTrim:h-1-y,h}; } }
        return {bottomTrim:0,h};
      },
      tightRect(img){ const w=img.naturalWidth,h=img.naturalHeight,c=document.createElement('canvas'); c.width=w;c.height=h;
        const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(img,0,0);
        const d=g.getImageData(0,0,w,h).data,TH=12; let minX=w,minY=h,maxX=-1,maxY=-1;
        for(let y=0;y<h;y++){ for(let x=0;x<w;x++){ if(d[(y*w+x)*4+3]>TH){ if(x<minX)minX=x;if(y<minY)minY=y;if(x>maxX)maxX=x;if(y>maxY)maxY=y; } } }
        if(maxX<0) return {sx:0,sy:0,sw:w,sh:h}; return {sx:minX,sy:minY,sw:maxX-minX+1,sh:maxY-minY+1};
      }
    };

    // ===== Background =====
    const BG = (()=> {
      const scaleY = H / IMG_BG.naturalHeight;
      const tileW  = IMG_BG.naturalWidth * scaleY;
      function draw(offsetX){
        let ox = offsetX % tileW; if (ox>0) ox -= tileW;
        for(let x=ox; x<W; x+=tileW){
          ctx.drawImage(IMG_BG, 0, 0, IMG_BG.naturalWidth, IMG_BG.naturalHeight,
                        Math.floor(x), 0, Math.ceil(tileW), H);
        }
      }
      return { draw };
    })();

    // ===== Ground =====
    const GR = (()=> {
      const t=Px.topTrim(IMG_GR);
      const drawH=Math.max(48, Math.min(160, t.contentH));
      const srcY=t.trimTop, srcH=IMG_GR.naturalHeight - t.trimTop;
      const scaleY = drawH / srcH;
      const tileW  = IMG_GR.naturalWidth * scaleY;
      const y      = Math.floor(H - drawH);
      function floorY(){ return y; }
      function draw(offsetX){
        let ox = offsetX % tileW; if(ox>0) ox -= tileW;
        for(let x=ox;x<W;x+=tileW){
          ctx.drawImage(IMG_GR,0,srcY,IMG_GR.naturalWidth,srcH,
                        Math.floor(x), y, Math.ceil(tileW), drawH);
        }
      }
      return { draw, floorY, drawH };
    })();

    // ===== Player =====
    function makePlayer(img){
      if(!img){ const c=document.createElement('canvas'); c.width=c.height=1; const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,1,1); img=c; }
      const b=Px.bottomTrim(img); const feetFrac=b.h?(b.bottomTrim/b.h):0;
      return { x:40, y:GR.floorY(), prevBottom:GR.floorY(), vy:0, w:48, h:48, jumps:2, maxJumps:2, img, feetFrac, lives:2 };
    }
    let player=null;

    // ===== Trims =====
    const cornTrim=Px.tightRect(IMG_CO), contTrim=Px.tightRect(IMG_CT), gomiTrim=Px.tightRect(IMG_GO), toraTrim=Px.tightRect(IMG_TR);

    // ===== Obstacles =====
    const obstacles=[];
    function makeCorn(atX){
      const fy=GR.floorY(); const targetH=Math.round(GR.drawH*0.29);
      const s=targetH/cornTrim.sh; const w=Math.round(cornTrim.sw*s),h=Math.round(cornTrim.sh*s);
      return {x:atX,y:fy-h,w,h,img:IMG_CO,trim:cornTrim,type:'corn'};
    }
    function makeContSet(atX){
      const fy=GR.floorY(); const targetH=Math.round(GR.drawH*0.48);
      const s=targetH/contTrim.sh; const w=Math.round(contTrim.sw*s),h=Math.round(contTrim.sh*s);
      const n=2+Math.floor(Math.random()*2); const gap=2, arr=[];
      for(let i=0;i<n;i++){arr.push({x:atX+i*(w+gap),y:fy-h,w,h,img:IMG_CT,trim:contTrim,type:'contena'});}
      return arr;
    }
    function makeGomi(atX){
      const fy=GR.floorY(); const targetH=Math.round(GR.drawH*0.31);
      const s=targetH/gomiTrim.sh; const w=Math.round(gomiTrim.sw*s),h=Math.round(gomiTrim.sh*s);
      return {x:atX,y:fy-h,w,h,img:IMG_GO,trim:gomiTrim,type:'gomi',phase:Math.random()*Math.PI*2,amp:3.0,rotAmp:0.06};
    }
    function makeTora(atX){
      const fy=GR.floorY(); const targetH=Math.round(GR.drawH*0.26);
      const s=targetH/toraTrim.sh; const w=Math.round(toraTrim.sw*s),h=Math.round(toraTrim.sh*s);
      return {x:atX,y:fy-h,w,h,img:IMG_TR,trim:toraTrim,type:'tora'};
    }

    // ===== Items =====
    const trimTS=Px.tightRect(IMG_TS), trimEN=Px.tightRect(IMG_EN), trimLP=Px.tightRect(IMG_LP);
    const items=[];
    function makeFloating(img,trim,type, atX, targetH=36){
      const baseY=Math.round(H*0.28+Math.random()*H*0.18);
      const s=targetH/trim.sh; const w=Math.round(trim.sw*s),h=Math.round(trim.sh*s);
      return {x:atX,y:baseY,baseY,w,h,img,trim,type,phase:Math.random()*Math.PI*2,amp:6.5};
    }
    function makeTsubasa(atX){return makeFloating(IMG_TS,trimTS,'tsubasa',atX,36)}
    function makeEngine(atX){return makeFloating(IMG_EN,trimEN,'engine',atX,36)}
    function makeLamp(atX){return makeFloating(IMG_LP,trimLP,'lamp',atX,34)}

    // ===== Villain & Fireballs =====
    const viTrim=Px.tightRect(IMG_VI), tmTrim=Px.tightRect(IMG_TM);
    let villain=null; const fireballs=[];
    const LOGO={state:'idle',t:0};
    function triggerLogo(){LOGO.state='fadein';LOGO.t=0;}
    function drawLogo(dt){
      if(LOGO.state==='idle') return; LOGO.t+=dt; let a=0,s=1;
      if(LOGO.state==='fadein'){ const t=Math.min(1,LOGO.t/1.0); a=t; s=1; if(LOGO.t>=1.0){LOGO.state='burst';LOGO.t=0;} }
      else if(LOGO.state==='burst'){ const t=Math.min(1,LOGO.t/0.4); a=1-t; s=1+0.6*t; if(LOGO.t>=0.4){LOGO.state='idle';LOGO.t=0;} }
      const iw=Math.min(IMG_LOGO.naturalWidth,260); const scale=(iw/IMG_LOGO.naturalWidth)*s;
      const w=IMG_LOGO.naturalWidth*scale, h=IMG_LOGO.naturalHeight*scale;
      ctx.save(); ctx.globalAlpha=a; ctx.drawImage(IMG_LOGO,Math.floor((W-w)/2),Math.floor((H-h)/2-40),Math.floor(w),Math.floor(h)); ctx.restore();
    }
    function spawnVillain(){
      const targetH=Math.round(GR.drawH*0.70); const s=targetH/viTrim.sh; const w=Math.round(viTrim.sw*s),h=Math.round(viTrim.sh*s);
      villain={phase:'enter',x:Math.min(W-90,W*0.72),y:-h,w,h,vy:60,targetY:Math.round(H*0.22),timer:0,dropsLeft:5+Math.floor(Math.random()*4),dropCd:0};
      triggerLogo(); firstVillainOccurred=true;
    }
    function endVillain(){villain=null;}
    function spawnFireball(){
      if(!villain) return; const targetH=48; const s=targetH/tmTrim.sh; const w=Math.round(tmTrim.sw*s),h=Math.round(tmTrim.sh*s);
      const dropX=(W-100)+Math.random()*70; const vx=-70, vy=220+Math.random()*90;
      fireballs.push({x:dropX-w/2,y:villain.y+villain.h*0.6,w,h,vx,vy,landed:false});
    }

    // ===== Spawn management =====
    let nextAllowedDist=220, nextItemDist=650;
    const startVillainGapM=150+Math.random()*50; let nextVillainM=startVillainGapM; let firstVillainOccurred=false;
    const minGap=90, spawnMargin=40;
    function rightmostFutureX(list){ let r=W+spawnMargin; for(const o of list){ r=Math.max(r, o.x+(o.w||0)); } return r; }

    function trySpawn(totalDist){
      const meters=totalDist*0.02;
      if(!villain && meters>=nextVillainM){ spawnVillain(); nextVillainM=meters+150+Math.random()*50; }
      const villainActive=!!villain;

      if(totalDist>=nextAllowedDist){
        const startX=Math.max(W+spawnMargin, Math.max(rightmostFutureX(obstacles), rightmostFutureX(items))+minGap);
        if(!firstVillainOccurred){
          const k=(Math.random()<0.55)?'corn':'contena';
          if(k==='corn'){ obstacles.push(makeCorn(startX)); nextAllowedDist=totalDist+200+Math.random()*120; }
          else{ const set=makeContSet(startX); obstacles.push(...set);
                const setW=(set[set.length-1].x+set[set.length-1].w)-set[0].x;
                nextAllowedDist=totalDist+Math.max(260,setW)+180+Math.random()*120; }
        }else if(villainActive){
          const k=(Math.random()<0.6)?'corn':'gomi';
          obstacles.push(k==='corn'?makeCorn(startX):makeGomi(startX));
          nextAllowedDist=totalDist+420+Math.random()*360;
        }else{
          const r=Math.random();
          const k = r<0.38?'corn':(r<0.63?'contena':(r<0.83?'gomi':'tora'));
          if(k==='corn'){ obstacles.push(makeCorn(startX)); nextAllowedDist=totalDist+160+Math.random()*160; }
          else if(k==='contena'){ const set=makeContSet(startX); obstacles.push(...set);
            const setW=(set[set.length-1].x+set[set.length-1].w)-set[0].x;
            nextAllowedDist=totalDist+Math.max(240,setW)+160+Math.random()*120; }
          else if(k==='gomi'){ obstacles.push(makeGomi(startX)); nextAllowedDist=totalDist+180+Math.random()*160; }
          else { obstacles.push(makeTora(startX)); nextAllowedDist=totalDist+170+Math.random()*160; }
        }
      }
      if(totalDist>=nextItemDist && !villain){
        const startX=Math.max(W+spawnMargin, Math.max(rightmostFutureX(obstacles), rightmostFutureX(items))+minGap);
        const r=Math.random(); if(r<0.2) items.push(makeLamp(startX)); else if(r<0.6) items.push(makeTsubasa(startX)); else items.push(makeEngine(startX));
        nextItemDist=totalDist+900+Math.random()*700;
      }
    }

    // ===== Physics / speed =====
    const GRAV=1500, JUMP=540, BURST_DUR=1.6, CHARGE_RATE=28, KM=0.072;
    const BASE_KMH=20, ENGINE_KMH=30, BOOST_KMH=60;
    const BASE=Math.round(BASE_KMH/KM), ENGINE=Math.round(ENGINE_KMH/KM), BOOST_MAX=Math.round(BOOST_KMH/KM);
    const BOOST_JUMP_MUL=1.35;

    let speed=BASE, dist=0, bgOff=0, grOff=0;
    let boostCharge=100, burstActive=false, burstTimer=0;
    let engineTime=0, wingsTime=0;
    let gameOver=false;

    // ===== HUD / UI =====
    const elDist=document.getElementById('dist'), elSpeed=document.getElementById('speed'),
          elJump=document.getElementById('jump'), elBoostPct=document.getElementById('boostPct');
    const wingsPill=document.getElementById('wings'), wingsLeftEl=document.getElementById('wingsLeft');
    const enginePill=document.getElementById('engine'), engineLeftEl=document.getElementById('engineLeft');
    const btnJump=document.getElementById('btnJump'), btnBoost=document.getElementById('btnBoost');
    const slotEls=[document.getElementById('slot0'), document.getElementById('slot1')];
    const slots=[null,null];

    // （※ 以前のJSによる #btnBoost 追加スタイル注入は CSS へ移行済み）

    // ===== Last chance overlay =====
    const lastChanceOverlay=document.createElement('div');
    Object.assign(lastChanceOverlay.style,{position:'absolute',inset:'56px 0 112px',display:'none',alignItems:'center',justifyContent:'center',zIndex:'60',background:'rgba(0,0,0,0.4)',color:'#fff',textAlign:'center',font:'bold 42px/1 system-ui'});
    lastChanceOverlay.textContent='ラストチャンス！';
    document.getElementById('phone').appendChild(lastChanceOverlay);
    let recovering=false;

    function showLastChance(cb){ recovering=true; lastChanceOverlay.style.display='flex'; setTimeout(()=>{lastChanceOverlay.style.display='none'; recovering=false; cb&&cb();},2000); }

    function firstEmptySlot(){ return slots.findIndex(s=>!s); }
    function updateSlotsUI(){
      slots.forEach((s,idx)=>{
        const el=slotEls[idx];
        el.classList.toggle('empty',!s);
        [...el.querySelectorAll('img,.badge')].forEach(n=>n.remove());
        const btn=el.querySelector('button'); btn.onclick=null;
        if(s){
          const img=document.createElement('img'); img.src=s.icon; img.alt=s.type; el.appendChild(img);
          const badge=document.createElement('div'); badge.className='badge'; badge.textContent='USE'; el.appendChild(badge);
          btn.onclick=()=>useSlot(idx);
        }
      });
    }
    function setWings(active){ if(active){ wingsTime=5.0; player.maxJumps=4; player.jumps=Math.max(player.jumps,4); wingsPill.style.display='inline-block'; } else { wingsTime=0; player.maxJumps=2; player.jumps=Math.min(player.jumps,2); wingsPill.style.display='none'; } }
    function setEngine(active){ if(active){ engineTime=10.0; enginePill.style.display='inline-block'; } else { engineTime=0; enginePill.style.display='none'; } }

    // ===== Sparkles (lamp effect) =====
    const sparkles=[];
    function spawnSparkles(x,y){ for(let i=0;i<18;i++){ const ang=Math.random()*Math.PI*2, spd=60+Math.random()*140; sparkles.push({x,y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,t:0,life:0.6}); } }

    function useSlot(idx){
      const it=slots[idx]; if(!it) return;
      if(it.type==='tsubasa') setWings(true);
      if(it.type==='engine')  setEngine(true);
      if(it.type==='lamp'){
        let best=null,bestD=1e9,cx=player.x+player.w/2,cy=player.y-player.h/2;
        for(const o of obstacles){ const ox=o.x+o.w/2,oy=o.y+o.h/2; const d=Math.hypot(ox-cx,oy-cy); if(d<bestD){bestD=d;best=o;} }
        if(best){ spawnSparkles(best.x+best.w/2,best.y+best.h/2); const i=obstacles.indexOf(best); if(i>=0) obstacles.splice(i,1); }
      }
      slots[idx]=null; updateSlotsUI();
    }

    function updateHUD(){
      elDist.textContent=`距離 ${Math.floor(dist*0.02)} m`;
      elSpeed.textContent=`速度 ${Math.round(speed*0.072)} km/h`;
      elJump.textContent=`ジャンプ ${player?player.jumps:2}`;
      elBoostPct.textContent=`${Math.round(boostCharge)}%`;
      if(boostCharge>=100 && !burstActive){ btnBoost.textContent='BOOST!'; btnBoost.classList.remove('muted'); } else { btnBoost.textContent='充電中'; btnBoost.classList.add('muted'); }
      if(wingsTime>0){ wingsLeftEl.textContent=`${wingsTime.toFixed(1)}s`; }
      if(engineTime>0){ engineLeftEl.textContent=`${engineTime.toFixed(1)}s`; }
    }

    function doJump(){ if(player && !gameOver && !recovering && player.jumps>0){ const j=burstActive?JUMP*BOOST_JUMP_MUL:JUMP; player.vy=-j; player.jumps--; updateHUD(); } }
    btnJump.onpointerdown=e=>{ e.preventDefault(); doJump(); };
    addEventListener('keydown',e=>{
      if(e.code==='Space'||e.code==='ArrowUp'){ doJump(); }
      if(e.code==='KeyB'){ if(!burstActive && boostCharge>=100 && !gameOver && !recovering){ burstActive=true; burstTimer=BURST_DUR; boostCharge=0; updateHUD(); } }
      if(e.code==='Digit1'){ useSlot(0); } if(e.code==='Digit2'){ useSlot(1); }
    });
    btnBoost.onclick=e=>{ e.preventDefault(); if(gameOver||recovering) return; if(!burstActive && boostCharge>=100){ burstActive=true; burstTimer=BURST_DUR; boostCharge=0; updateHUD(); } };

    document.getElementById('retryBtn').onclick=()=>{ 
      // リトライはユーザー操作なのでBGM再開OK
      resetGame(); 
      playBGM();
    };

    // ===== Collisions =====
    function hitConeRelax(px,py,pw,ph, c){
      const bh=c.h,bw=c.w;
      const lower={x:c.x,y:c.y+bh*0.45,w:bw*0.92,h:bh*0.55};
      const upper={x:c.x+bw*0.34,y:c.y+bh*0.06,w:bw*0.32,h:bh*0.22};
      const A=(px<lower.x+lower.w&&px+pw>lower.x&&py<lower.y+lower.h&&py+ph>lower.y);
      const B=(px<upper.x+upper.w&&px+pw>upper.x&&py<upper.y+upper.h&&py+ph>upper.y);
      return A||B;
    }
    function hitSideLenient(px,py,pw,ph,o){
      const shrink=0.82; const w=o.w*shrink,h=o.h*0.9;
      const x=o.x+(o.w-w)/2,y=o.y+(o.h-h);
      return (px<x+w&&px+pw>x&&py<y+h&&py+ph>y);
    }

    function resetGame(){
      gameOver=false; dist=0; bgOff=grOff=0;
      obstacles.length=0; items.length=0; fireballs.length=0; villain=null; sparkles.length=0;
      nextAllowedDist=220; nextItemDist=650; nextVillainM=startVillainGapM; LOGO.state='idle'; LOGO.t=0; firstVillainOccurred=false;
      if(player){ player.y=GR.floorY(); player.prevBottom=player.y; player.vy=0; player.jumps=2; player.maxJumps=2; player.lives=2; }
      boostCharge=100; burstActive=false; burstTimer=0; setWings(false); setEngine(false);
      slots[0]=slots[1]=null; updateSlotsUI(); gameover.style.display='none'; recovering=false;
    }

    // ===== Main loop =====
    let prev=0, running=false;
    function start(){ if(running) return; running=true; prev=performance.now(); updateSlotsUI(); updateHUD(); requestAnimationFrame(loop); }
    function loop(t){
      const dt=Math.min(0.033,(t-prev)/1000); prev=t;

      if(recovering){
        drawFrame(0);
        requestAnimationFrame(loop); return;
      }

      // timers
      if(wingsTime>0){ wingsTime-=dt; if(wingsTime<=0) setWings(false); }
      if(engineTime>0){ engineTime-=dt; if(engineTime<=0) setEngine(false); }

      // speed（ブースト 60→20 に減衰 / エンジン 30 / 通常 20）
      if(!gameOver){
        if(burstActive){ const frac=Math.max(0,burstTimer/BURST_DUR); speed=BASE+(BOOST_MAX-BASE)*frac; burstTimer-=dt; if(burstTimer<=0) burstActive=false; }
        else if(engineTime>0) speed=ENGINE; else { speed=BASE; boostCharge=Math.min(100,boostCharge+CHARGE_RATE*dt); }
      }

      // physics
      if(player && !gameOver){
        player.prevBottom=player.y;
        player.vy+=1500*dt; player.y+=player.vy*dt;
        const fy=GR.floorY(); if(player.y>fy){ player.y=fy; player.vy=0; player.jumps=player.maxJumps; }
      }

      // progress
      if(!gameOver){
        dist+=speed*dt; bgOff-=speed*0.20*dt; grOff-=speed*1.00*dt;
        trySpawn(dist);

        // scroll & cleanup
        for(let i=obstacles.length-1;i>=0;i--){ const o=obstacles[i]; o.x-=speed*dt; if(o.phase!=null) o.phase+=dt*1.2; if(o.x+o.w<-40) obstacles.splice(i,1); }
        for(let i=items.length-1;i>=0;i--){ const it=items[i]; it.x-=speed*dt; it.y=it.baseY+Math.sin(it.phase)*it.amp; it.phase+=dt*1.5; if(it.x+it.w<-40) items.splice(i,1); }

        // Villain
        if(villain){
          const minLead=140; villain.x-=speed*dt; const desired=player.x+minLead; if(villain.x<desired) villain.x=desired; villain.x=Math.min(villain.x,W-90);
          if(villain.phase==='enter'){ villain.y+=villain.vy*dt; if(villain.y>=villain.targetY){villain.y=villain.targetY; villain.phase='attack'; villain.timer=0; villain.dropCd=0;} }
          else if(villain.phase==='attack'){ villain.timer+=dt; villain.y=villain.targetY+Math.sin(villain.timer*1.3)*6; villain.dropCd-=dt;
            if(villain.dropCd<=0 && villain.dropsLeft>0){ spawnFireball(); villain.dropsLeft--; villain.dropCd=1.0+Math.random(); }
            if(villain.dropsLeft<=0 && fireballs.length===0){ villain.phase='exit'; villain.vy=-50; } }
          else if(villain.phase==='exit'){ villain.y+=villain.vy*dt; if(villain.y+villain.h<-20) endVillain(); }
        }

        // Fireballs
        for(let i=fireballs.length-1;i>=0;i--){
          const f=fireballs[i];
          f.x+=(f.vx-speed)*dt;
          if(!f.landed){
            f.y+=f.vy*dt;
            const gy=GR.floorY(); if(f.y+f.h>=gy){f.y=gy-f.h; f.vy=0; f.vx=0; f.landed=true;}
          }
          if(f.x+f.w<-60) fireballs.splice(i,1);
        }

        // sparkles
        for(let i=sparkles.length-1;i>=0;i--){ const p=sparkles[i]; p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=0.96; p.vy*=0.96; if(p.t>=p.life) sparkles.splice(i,1); }
      }

      drawFrame(dt);
      requestAnimationFrame(loop);
    }

    function drawFrame(dt){
      ctx.clearRect(0,0,W,H);
      BG.draw(bgOff); GR.draw(grOff);

      // Obstacles
      obstacles.forEach(o=>{
        if(o.type==='gomi'){
          const dx=Math.sin(o.phase)*o.amp; const cx=Math.floor(o.x+o.w/2+dx), cy=Math.floor(o.y+o.h/2);
          ctx.save(); ctx.translate(cx,cy); ctx.rotate(Math.sin(o.phase)*o.rotAmp);
          ctx.drawImage(o.img,o.trim?.sx||0,o.trim?.sy||0,o.trim?.sw||o.w,o.trim?.sh||o.h,Math.floor(-o.w/2),Math.floor(-o.h/2),o.w,o.h); ctx.restore();
        }else{
          ctx.drawImage(o.img,o.trim.sx,o.trim.sy,o.trim.sw,o.trim.sh,Math.floor(o.x),Math.floor(o.y),o.w,o.h);
        }
      });

      // Items
      items.forEach(it=>{
        ctx.drawImage(it.img,it.trim.sx,it.trim.sy,it.trim.sw,it.trim.sh,Math.floor(it.x),Math.floor(it.y),it.w,it.h);
      });

      // Villain / Fireballs
      if(villain){
        ctx.drawImage(IMG_VI,viTrim.sx,viTrim.sy,viTrim.sw,viTrim.sh,Math.floor(villain.x),Math.floor(villain.y),villain.w,villain.h);
      }
      fireballs.forEach(f=>{
        ctx.drawImage(IMG_TM,tmTrim.sx,tmTrim.sy,tmTrim.sw,tmTrim.sh,Math.floor(f.x),Math.floor(f.y),f.w,f.h);
      });

      // Sparkles
      sparkles.forEach(p=>{
        const a=1-(p.t/p.life); ctx.save(); ctx.globalAlpha=Math.max(0,a);
        ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(p.x,p.y,2.2,0,Math.PI*2); ctx.fill(); ctx.restore();
      });

      // Player + pickups + collisions
      if(player){
        const feetPush=Math.floor(player.h*player.feetFrac); const px=Math.floor(player.x), py=Math.floor(player.y-player.h+feetPush);
        ctx.drawImage(player.img,px,py,player.w,player.h);

        if(!gameOver && !recovering){
          // Item pickup
          for(let i=items.length-1;i>=0;i--){
            const it=items[i];
            const aabb=(px<it.x+it.w&&px+player.w>it.x&&py<it.y+it.h&&py+player.h>it.y);
            if(aabb){
              const sidx=firstEmptySlot();
              if(sidx>=0){
                const icon=it.type==='tsubasa'?'tsubasa.png':(it.type==='engine'?'en.png':'mranp.png');
                slots[sidx]={type:it.type,icon}; items.splice(i,1); updateSlotsUI();
              }
            }
          }

          // Obstacles collision
          const currBottom=player.y, prevBottom=player.prevBottom;
          for(let i=0;i<obstacles.length;i++){
            const o=obstacles[i];
            const aabb=(px<o.x+o.w&&px+player.w>o.x&&py<o.y+o.h&&py+player.h>o.y);
            if(!aabb) continue;

            if(o.type==='corn'){
              if(hitConeRelax(px,py,player.w,player.h,o)) { handleDamage(i); break; }
            }else if(o.type==='contena'){
              const top=o.y, comingDown=player.vy>=0, crossed=(prevBottom<=top+10)&&(currBottom>=top-10);
              const overlapXWide=(px+player.w>o.x-16)&&(px<o.x+o.w+16);
              if(comingDown && crossed && overlapXWide){ player.y=top; player.vy=0; player.jumps=player.maxJumps; }
              else { handleDamage(i); break; }
            }else if(o.type==='tora'){
              const top=o.y, comingDown=player.vy>=0, crossed=(prevBottom<=top+10)&&(currBottom>=top-10);
              if(comingDown && crossed){ player.y=top; player.vy=-JUMP*1.55; player.jumps=Math.max(player.jumps,player.maxJumps-1); }
              else if(hitSideLenient(px,py,player.w,player.h,o)){ handleDamage(i); break; }
            }else{ // gomi
              handleDamage(i); break;
            }
          }

          // Fireball collision
          for(let i=0;i<fireballs.length;i++){
            const f=fireballs[i];
            const aabb=(px<f.x+f.w&&px+player.w>f.x&&py<f.y+f.h&&py+player.h>f.y);
            if(aabb){ handleDamage(); break; }
          }
        }
      }

      drawLogo(dt||0);
      updateHUD();
    }

    function handleDamage(obIdx){
      if(gameOver||recovering) return;
      if(player.lives===undefined) player.lives=2;

      // 1回目はラストチャンス、2回目でゲームオーバー
      if(player.lives>1){
        player.lives--;
        if(obIdx!=null&&obIdx>=0&&obIdx<obstacles.length){
          const o=obstacles[obIdx]; // 直前の障害物は消す
          spawnSparkles(o.x+o.w/2,o.y+o.h/2);
          obstacles.splice(obIdx,1);
        }
        showLastChance(()=>{ player.y=-120; player.vy=220; player.jumps=player.maxJumps; });
        return;
      }else{
        gameOver=true; 
        gameover.style.display='grid';
        // ▼ ゲームオーバー時にBGM停止
        stopBGM();
        // ▲
      }
    }

    // ===== Start flow (character select -> start) =====
    loading.style.display='none';
    overlay.style.display='grid';

    overlay.addEventListener('click', e=>{
      const c=e.target.closest('.choice'); if(!c) return;
      const key=c.dataset.char;
      const img = (SKINS && SKINS[key]) || IMG_VR || IMG_OR;
      player=makePlayer(img);
      overlay.style.display='none';
      // ユーザータップ直後にBGM開始
      playBGM();
      start();
    });

    // ===== Prevent page scroll (except UI) =====
    ['touchstart','touchmove','gesturestart'].forEach(ev=>{
      document.addEventListener(ev,e=>{ if(e.target.closest('button,.choice'))return; e.preventDefault(); },{passive:false});
    });

  }).catch(err=>{
    console.error(err);
    document.querySelector('#loading .bubble').textContent='画像の読み込みに失敗しました。ファイル名と配置を確認してください。';
  });
})();
