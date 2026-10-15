const $=s=>document.querySelector(s);
const fmt=n=>n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e3?(n/1e3).toFixed(1)+'K':String(Math.round(n));
const money=n=>'$'+Math.round(n).toLocaleString();
let seed=11;const rnd=()=>(seed=seed*16807%2147483647)/2147483647;

// ---- Demo data (swap for real API calls: YouTube, TikTok, Meta, Stripe, Shopify) ----
const views=Array.from({length:90},(_,i)=>Math.round((150e3+i*1800)*(1+.18*Math.sin(i*2*Math.PI/7))*(.85+rnd()*.3)+(rnd()>.93?220e3:0)));
const S={live:3120,followers:[
 {n:'YouTube',f:1240000,d:.9,c:'#e5484d'},{n:'TikTok',f:482000,d:2.4,c:'#16b5a8'},
 {n:'Instagram',f:356000,d:1.3,c:'#c13fb8'},{n:'X',f:98000,d:.2,c:'#6b7a90'}],
 deals:[{b:'Nova Energy',t:'Sponsorship',v:12000,s:'Paid'},{b:'Kite Mobile',t:'Brand deal',v:8500,s:'Signed'},
 {b:'Oakline Desks',t:'Affiliate',v:3200,s:'Paid'},{b:'Pixel & Pine',t:'Sponsorship',v:15000,s:'Negotiating'},{b:'Lumen Audio',t:'Brand deal',v:6000,s:'Pitched'}],
 ads:[{n:'TikTok Ads',sp:4210,rv:11800},{n:'Facebook Ads',sp:3120,rv:7400},{n:'Instagram Ads',sp:2480,rv:6900}],
 shop:[{n:'Studio Hoodie',u:212,p:58},{n:'Sticker Pack',u:640,p:9},{n:'Editing Presets',u:388,p:24},{n:'Creator Playbook (ebook)',u:154,p:39}],
 adsense:18400};
const paidDeals=()=>S.deals.filter(d=>d.s==='Paid').reduce((a,d)=>a+d.v,0);
const shopTotal=()=>S.shop.reduce((a,p)=>a+p.u*p.p,0);
const earn=()=>S.adsense+paidDeals()+shopTotal();
const totF=()=>S.followers.reduce((a,p)=>a+p.f,0);

// ---- Line chart ----
let R=30;
function drawLine(){
  const d=views.slice(-R),W=600,H=200,p=14,mx=Math.max(...d),mn=Math.min(...d);
  const X=i=>p+i*(W-2*p)/(d.length-1),Y=v=>H-p-(v-mn)/(mx-mn||1)*(H-2*p);
  const pts=d.map((v,i)=>X(i).toFixed(1)+','+Y(v).toFixed(1));
  $('#line').innerHTML=`<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--acc)" stop-opacity=".28"/><stop offset="1" stop-color="var(--acc)" stop-opacity="0"/></linearGradient></defs>
  <polygon points="${X(0)},${H} ${pts.join(' ')} ${X(d.length-1)},${H}" fill="url(#g)"/>
  <polyline points="${pts.join(' ')}" fill="none" stroke="var(--acc)" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
  const sum=d.reduce((a,b)=>a+b,0),prev=views.slice(-2*R,-R).reduce((a,b)=>a+b,0);
  if(R===30){$('#kViews').textContent=fmt(sum);const c=(sum/prev-1)*100;$('#kViewsD').innerHTML=`<span class="${c>=0?'up':'dn'}">${c>=0?'▲':'▼'} ${Math.abs(c).toFixed(1)}%</span> vs prior 30d`}
  const svg=$('#line'),tip=$('#tip');
  svg.onpointermove=e=>{const r=svg.getBoundingClientRect(),i=Math.max(0,Math.min(d.length-1,Math.round((e.clientX-r.left)/r.width*(d.length-1))));
    tip.style.opacity=1;tip.textContent=`${d.length-1-i}d ago · ${fmt(d[i])} views`;tip.style.left=Math.min(r.width-130,Math.max(0,e.clientX-r.left-50))+'px';tip.style.top='4px'};
  svg.onpointerleave=()=>tip.style.opacity=0;
}
document.querySelectorAll('#range button').forEach(b=>b.onclick=()=>{R=+b.dataset.r;document.querySelectorAll('#range button').forEach(x=>x.classList.toggle('on',x===b));drawLine()});

// ---- Render sections ----
function renderStatic(){
  const mx=Math.max(...S.followers.map(p=>p.f));
  $('#plat').innerHTML=S.followers.map(p=>`<div class="pl"><span>${p.n}</span><div class="bar"><i style="width:${p.f/mx*100}%;background:${p.c}"></i></div><div class="v"><b>${fmt(p.f)}</b><small class="up">+${p.d}%</small></div></div>`).join('');
  $('#deals').innerHTML=S.deals.map(d=>`<tr><td>${d.b}</td><td>${d.t}</td><td class="r">${money(d.v)}</td><td><span class="chip s-${d.s}">${d.s}</span></td></tr>`).join('');
  $('#pipe').textContent=`${money(S.deals.filter(d=>d.s!=='Paid').reduce((a,d)=>a+d.v,0))} in pipeline`;
  const roas=S.ads.map(a=>a.rv/a.sp),best=Math.max(...roas);
  $('#ads').innerHTML=S.ads.map((a,i)=>`<tr><td>${a.n}</td><td class="r">${money(a.sp)}</td><td class="r">${money(a.rv)}</td><td class="r">${roas[i].toFixed(1)}x</td><td><span class="mini"><i style="width:${roas[i]/best*100}%"></i></span></td></tr>`).join('');
  const sp=S.ads.reduce((a,x)=>a+x.sp,0),rv=S.ads.reduce((a,x)=>a+x.rv,0);$('#kRoas').textContent=(rv/sp).toFixed(1)+'x';
}
function renderLive(){
  $('#liveNow').textContent=Math.round(S.live).toLocaleString();
  $('#kEarn').textContent=money(earn());
  $('#kEarnSub').textContent=`Ads ${money(S.adsense)} · Deals ${money(paidDeals())} · Shop ${money(shopTotal())}`;
  $('#kFol').textContent=fmt(totF());$('#kFolD').innerHTML='<span class="up">▲ 1.4%</span> this month';
  $('#kShop').textContent=money(shopTotal());$('#kShopD').textContent=S.shop.reduce((a,p)=>a+p.u,0)+' orders';
  $('#shop').innerHTML=S.shop.map(p=>`<div class="prod"><div><b>${p.n}</b><small>${p.u} sold · ${money(p.p)} each</small></div><b>${money(p.u*p.p)}</b></div>`).join('');
}
setInterval(()=>{ // simulated live feed
  S.live=Math.max(900,S.live+(rnd()-.45)*90);
  if(rnd()<.6)S.followers[Math.floor(rnd()*4)].f+=Math.floor(rnd()*14)+1;
  if(rnd()<.18){const p=S.shop[Math.floor(rnd()*4)];p.u++;log(`New order: ${p.n}`)}
  if(rnd()<.3)S.adsense+=Math.round(rnd()*25);
  renderLive();
},1800);

// ---- AI agent (simulated) ----
const STEPS={Upload:['Uploading','Processing'],Edit:['Trimming','Captioning','Rendering'],Schedule:['Finding best time','Scheduling'],Organize:['Tagging','Filing'],Share:['Cross-posting','Posting']};
const queue=[
 {t:'Cut 3 Shorts from "Sunday vlog"',k:'Edit',p:62,step:'Captioning'},
 {t:'Schedule "Desk setup 2026" to YouTube + IG',k:'Schedule',p:100,step:'Scheduled · Fri 6:00 PM'},
 {t:'Organize March footage by series',k:'Organize',p:100,step:'Done'}];
function renderQueue(){
  $('#queue').innerHTML=queue.slice().reverse().map(q=>`<li><div>${q.t}</div><div class="pb"><i style="width:${q.p}%"></i></div><div class="meta"><span>${q.step}</span><span>${q.p}%</span></div></li>`).join('');
  $('#agState').textContent=queue.some(q=>q.p<100)?'working':'idle';$('#agState').classList.toggle('work',queue.some(q=>q.p<100));
}
function log(m){const li=document.createElement('li');li.textContent=new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})+'  '+m;$('#log').prepend(li);while($('#log').children.length>20)$('#log').lastChild.remove()}
function run(text){
  text=text.trim();if(!text)return;
  const k=Object.keys(STEPS).find(k=>text.toLowerCase().includes(k.toLowerCase()))||(/cut|trim|clip|caption/i.test(text)?'Edit':/post|publish|cross/i.test(text)?'Share':'Organize');
  const q={t:text,k,p:0,step:STEPS[k][0],i:0};queue.push(q);log(`Started: ${text}`);renderQueue();
  const iv=setInterval(()=>{q.p=Math.min(100,q.p+Math.round(8+rnd()*14));q.i=Math.min(STEPS[k].length-1,Math.floor(q.p/100*STEPS[k].length));q.step=STEPS[k][q.i];
    if(q.p>=100){clearInterval(iv);q.step='Done';log(`Finished: ${text}`)}renderQueue()},700);
}
$('#go').onclick=()=>{run($('#cmd').value);$('#cmd').value=''};
$('#cmd').onkeydown=e=>{if(e.key==='Enter')$('#go').click()};
document.querySelectorAll('#quick button').forEach(b=>b.onclick=()=>{const d={Upload:'Upload latest raw footage to YouTube',Edit:'Edit highlight reel from last stream',Schedule:'Schedule this week\'s posts at peak times',Organize:'Organize asset library by campaign',Share:'Share newest video to TikTok, IG and X'};run(d[b.dataset.q])});

renderStatic();renderLive();drawLine();renderQueue();
log('Connected: YouTube, TikTok, Instagram, X, Shopify (demo)');
