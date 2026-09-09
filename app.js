const $=id=>document.getElementById(id),canvas=$("chart"),ctx=canvas.getContext("2d");
const S={rows:[],replay:[],idx:0,timer:null,playing:false,displayBars:100,marks:[],trades:[],position:null,months:new Map(),L:56,R:28};
const BASE="data/";
const pad=n=>String(n).padStart(2,"0");
function parseCSV(t){let a=[];for(const s of t.split(/\r?\n/)){let p=s.trim().split(",");if(p.length<6)continue;let m=p[0].match(/^(\d{4})\.(\d\d)\.(\d\d)$/),q=p[1].match(/^(\d\d):(\d\d)$/);if(!m||!q)continue;let ts=Date.UTC(+m[1],+m[2]-1,+m[3],+q[1],+q[2]),v=p.slice(2,6).map(Number);if(v.some(Number.isNaN))continue;a.push({ts,o:v[0],h:v[1],l:v[2],c:v[3],v:+p[6]||0})}return a}
function mk(ts){let d=new Date(ts);return d.getUTCFullYear()+"-"+pad(d.getUTCMonth()+1)}
function add(k,n){let[y,m]=k.split("-").map(Number);m+=n;y+=Math.floor((m-1)/12);m=(m-1)%12+1;return y+"-"+pad(m)}
function keys(a,b){let r=[];for(let k=a;k<=b;k=add(k,1))r.push(k);return r}
async function month(k){if(S.months.has(k))return S.months.get(k);let r=await fetch(BASE+k+".csv");if(!r.ok)throw Error(k+".csv が見つかりません");let x=parseCSV(await r.text());S.months.set(k,x);return x}
function inputTime(id){let m=$(id).value.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)$/);return m?Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5]):NaN}
function fmt(ts){if(!Number.isFinite(ts))return"—";let d=new Date(ts);return `${d.getUTCFullYear()}/${pad(d.getUTCMonth()+1)}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`}
const price=v=>Number.isFinite(v)?v.toFixed(2):"—";
async function load(){stop();let st=inputTime("startInput"),en=inputTime("endInput");if(!Number.isFinite(st)||!Number.isFinite(en)||en<st)return $("status").textContent="日時を確認してください";try{$("status").textContent="CSV読み込み中...";let all=[];for(let k of keys(add(mk(st),-3),mk(en)))all.push(...await month(k));all.sort((a,b)=>a.ts-b.ts);let u=[],last=-1;for(let r of all)if(r.ts!==last){u.push(r);last=r.ts}S.rows=u;S.replay=u.filter(r=>r.ts>=st&&r.ts<=en);S.idx=0;S.marks=[];S.trades=[];S.position=null;if(!S.replay.length){$("status").textContent="指定期間にM1データがありません";return draw()}$("progress").max=S.replay.length-1;$("firstTime").textContent=fmt(S.replay[0].ts);$("lastTime").textContent=fmt(S.replay.at(-1).ts);$("status").textContent=`${S.replay.length.toLocaleString()}本 / 表示枠${S.displayBars}本`;update();draw()}catch(e){$("status").textContent="読み込み失敗: "+e.message}}
function rows(){
 const real=S.replay.slice(0,S.idx+1).slice(-S.displayBars);
 if(!real.length)return [];
 const missing=S.displayBars-real.length;
 const ref=real[0], dummy=[];
 for(let i=missing;i>0;i--){
   const p=ref.o;
   dummy.push({ts:ref.ts-i*60000,o:p,h:p,l:p,c:p,v:0,dummy:true});
 }
 return dummy.concat(real);
}
function aggregate(a){return a.length?{o:a[0].o,h:Math.max(...a.map(x=>x.h)),l:Math.min(...a.map(x=>x.l)),c:a.at(-1).c}:null}
function levels(ts){let d=new Date(ts),y=d.getUTCFullYear(),m=d.getUTCMonth(),day=d.getUTCDate(),day0=Date.UTC(y,m,day),prev=aggregate(S.rows.filter(r=>{let x=new Date(r.ts);return x.getUTCFullYear()===y&&x.getUTCMonth()===m&&x.getUTCDate()===day-1})),mon=day0-((new Date(day0).getUTCDay()+6)%7)*864e5,w=aggregate(S.rows.filter(r=>r.ts>=mon-7*864e5&&r.ts<mon)),pm=aggregate(S.rows.filter(r=>r.ts>=Date.UTC(y,m-1,1)&&r.ts<Date.UTC(y,m,1)));return{PDH:prev?.h,PDL:prev?.l,PWH:w?.h,PWL:w?.l,PMH:pm?.h,PML:pm?.l}}
function resize(){let d=devicePixelRatio||1,r=canvas.getBoundingClientRect();canvas.width=r.width*d;canvas.height=r.height*d;ctx.setTransform(d,0,0,d,0,0);draw()}
function draw(){
 let w=canvas.clientWidth,h=canvas.clientHeight;
 ctx.clearRect(0,0,w,h);ctx.fillStyle="#0c1014";ctx.fillRect(0,0,w,h);
 for(let i=1;i<7;i++){let y=25+i*(h-65)/7;ctx.strokeStyle="#1b2229";ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
 let a=rows(); if(!a.length)return;
 const real=a.filter(r=>!r.dummy);
 let lo=Math.min(...real.map(r=>r.l)),hi=Math.max(...real.map(r=>r.h)),pa=(hi-lo)*.08||1;
 lo-=pa;hi+=pa;
 let py=v=>h-38-(v-lo)/(hi-lo)*(h-68);
 let plot=w-S.L-S.R,step=plot/S.displayBars,cw=Math.max(2,Math.min(12,step*.68));
 const firstReal=a.findIndex(r=>!r.dummy);
 if(firstReal>0){
   let x=S.L+firstReal*step;
   ctx.save();ctx.strokeStyle="#8a949f";ctx.setLineDash([5,4]);ctx.beginPath();
   ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();ctx.restore();
   ctx.fillStyle="#8a949f";ctx.font="10px system-ui";ctx.fillText("REPLAY START",x+5,16);
 }
 a.forEach((r,i)=>{
   if(r.dummy)return;
   let x=S.L+i*step+step/2;
   if($("candleToggle").checked){
     ctx.strokeStyle=r.c>=r.o?"#d7dde4":"#8e98a4";
     ctx.beginPath();ctx.moveTo(x,py(r.h));ctx.lineTo(x,py(r.l));ctx.stroke();
     ctx.fillStyle=r.c>=r.o?"#d7dde4":"#8e98a4";
     ctx.fillRect(x-cw/2,Math.min(py(r.o),py(r.c)),cw,Math.max(1,Math.abs(py(r.c)-py(r.o))));
   }
 });
 const lastReal=real.at(-1);
 if($("levelToggle").checked&&lastReal){
   for(let [n,v] of Object.entries(levels(lastReal.ts)))if(Number.isFinite(v)){
     let y=py(v);ctx.setLineDash([5,4]);ctx.strokeStyle="#59636e";
     ctx.beginPath();ctx.moveTo(S.L,y);ctx.lineTo(w-S.R,y);ctx.stroke();ctx.setLineDash([]);
     ctx.fillStyle="#aab3bd";ctx.font="11px system-ui";ctx.fillText(n+" "+price(v),4,Math.max(12,y-3));
   }
 }
 S.marks.forEach(m=>{
   let i=a.findIndex(r=>!r.dummy&&r.ts===m);
   if(i>=0){let x=S.L+i*step+step/2;ctx.fillStyle="#f0c85a";ctx.beginPath();ctx.arc(x,py(a[i].h)-12,4,0,Math.PI*2);ctx.fill();}
 });
 if($("indicatorToggle").checked&&real.length>=20){
   let e=real[0].c,k=2/21;ctx.strokeStyle="#d7dde4";ctx.beginPath();
   real.forEach((r,i)=>{e=r.c*k+e*(1-k);let gi=a.indexOf(r),x=S.L+gi*step+step/2;i?ctx.lineTo(x,py(e)):ctx.moveTo(x,py(e));});
   ctx.stroke();
 }
 S.trades.forEach(t=>{
   let i=a.findIndex(r=>!r.dummy&&r.ts===t.time);
   if(i>=0){let x=S.L+i*step+step/2;ctx.fillStyle=t.side==="BUY"?"#49c78a":t.side==="SELL"?"#e36b73":"#e0e5ea";ctx.font="bold 10px system-ui";ctx.textAlign="center";ctx.fillText(t.side,x,t.side==="SELL"?py(a[i].h)-10:py(a[i].l)+18);ctx.textAlign="left";}
 });
}
function update(){let r=S.replay[S.idx];if(!r)return;$("timeLabel").textContent=fmt(r.ts);$("ohlcLabel").textContent=`O ${price(r.o)} H ${price(r.h)} L ${price(r.l)} C ${price(r.c)}`;$("progress").value=S.idx;$("currentPrice").textContent=price(r.c);if(S.position){$("positionState").textContent=S.position.side;$("entryPrice").textContent=price(S.position.price);$("pnl").textContent=(S.position.side==="BUY"?r.c-S.position.price:S.position.price-r.c).toFixed(2)}else{$("positionState").textContent="NO POSITION";$("entryPrice").textContent="—";$("pnl").textContent="—"}}
function stop(){S.playing=false;clearInterval(S.timer);S.timer=null;$("playBtn").textContent="▶ 再生"}
function play(){if(!S.replay.length)return;if(S.idx>=S.replay.length-1)S.idx=0;S.playing=true;$("playBtn").textContent="⏸ 停止";clearInterval(S.timer);S.timer=setInterval(()=>{if(S.idx<S.replay.length-1){S.idx++;update();draw()}else stop()},Math.max(16,1000/+$("speedSelect").value))}
function trade(side){let r=S.replay[S.idx];if(!r||S.position)return;S.position={side,price:r.c};S.trades.push({side,time:r.ts,price:r.c});log();update();draw()}
function exit(){let r=S.replay[S.idx];if(!r||!S.position)return;let p=S.position,pnl=p.side==="BUY"?r.c-p.price:p.price-r.c;S.trades.push({side:"EXIT",time:r.ts,price:r.c,pnl});S.position=null;log();update();draw()}
function log(){$("tradeLog").innerHTML=S.trades.map(t=>`<div>${fmt(t.time)}　${t.side}　${price(t.price)}　${t.pnl==null?"":t.pnl.toFixed(2)}</div>`).join("")}
$("loadBtn").onclick=load;$("playBtn").onclick=()=>S.playing?stop():play();$("stepBtn").onclick=()=>{stop();if(S.idx<S.replay.length-1)S.idx++;update();draw()};$("stepBackBtn").onclick=()=>{stop();if(S.idx>0)S.idx--;update();draw()};$("progress").oninput=e=>{stop();S.idx=+e.target.value;update();draw()};$("buyBtn").onclick=()=>trade("BUY");$("sellBtn").onclick=()=>trade("SELL");$("exitBtn").onclick=exit;$("markBtn").onclick=()=>{let r=S.replay[S.idx];if(r)S.marks.push(r.ts),draw()};$("deleteMarkBtn").onclick=()=>{S.marks.pop();draw()};$("clearMarksBtn").onclick=()=>{S.marks=[];draw()};["candleToggle","levelToggle","indicatorToggle"].forEach(id=>$(id).onchange=draw);onresize=resize;resize();
(function defaults(){
  const now=new Date(), p=n=>String(n).padStart(2,"0");
  $("startInput").value=`${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}T08:00`;
  $("endInput").value=`${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}`;
})();
