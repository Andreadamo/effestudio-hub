const CFG=window.PUL_CFG||{};const DEMO=!CFG.SUPABASE_URL;
const MODE=document.body.dataset.mode||"admin";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ls={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}}};
const pad=n=>String(n).padStart(2,"0");
const iso=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parse=s=>{const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return iso(d)};
const dow=s=>(parse(s).getDay()+6)%7; // 0=lun
const today=()=>iso(new Date());
const monday=s=>addDays(s,-dow(s));
const mins=t=>{const[h,m]=String(t||"0:0").split(":").map(Number);return h*60+(m||0)};
const GG=["lun","mar","mer","gio","ven","sab","dom"];
const fmtL=s=>parse(s).toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"});
const fmtS=s=>GG[dow(s)]+" "+parse(s).getDate()+"/"+(parse(s).getMonth()+1);
const first=n=>String(n||"").split(" ")[0];

/* ---------- regole ---------- */
const ITEMS={
  inc_std:[["saponi","Saponi riempiti"],["carta","Carta mani rimessa"],["bagno","Bagno pulito"],["cestini","Cestini controllati / svuotati"],["desk","Desk in ordine"]],
  inc_imp:[["saponi","Saponi riempiti"],["carta","Carta mani rimessa"]],
  chi:[["docce","Docce controllate"],["asciutto","Spogliatoi asciugati"],["desk","Desk in ordine"]],
  ape:[["spogliatoi","Spogliatoi in ordine"],["docce","Docce asciutte"],["desk","Desk in ordine"]]
};
const SALA=[["ok","Sala ok"],["pulita","Pulita da me"],["segnalata","Da pulire (segnalo)"]];
const ROLE={ape:{n:"Apertura",s:"Verifica chiusura di ieri",ic:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'},
  inc:{n:"Incaricato del giorno",s:"Spogliatoi, cestini, desk, sala",ic:'<path d="M3 21h18M6 21V10l6-6 6 6v11M10 21v-5h4v5"/>'},
  chi:{n:"Controllo serale",s:"Verifica incaricato + docce",ic:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>'}};
const FESTIVI=["2026-11-01","2026-12-08","2026-12-25","2026-12-26","2027-01-01","2027-01-06","2027-04-05","2027-04-25","2027-05-01","2027-06-02","2027-08-15"];

/* ---------- stato ---------- */
const S={tab:MODE==="staff"?"staff":"oggi",day:today(),week:monday(today()),me:ls.get("pul-me")||"",admin:MODE==="admin"&&DEMO,
  cfg:{start:"",freq:1,multa:5,people:[]},impresa:[],logs:[],multe:[],swaps:[],trainers:[],slots:[],absences:[],open:null};

/* ---------- dati demo ---------- */
function demoData(){
  const P=["Andrea D'Amore","Leonardo Masoni","Luca Fierabracci","Alessandro de Cunzolo","Erika Bartolini","Giovanni Zaccheo","Francesco Moretti","Simone Causarano","Davide Piccinini","Ismael Sakho"];
  S.cfg={start:addDays(monday(today()),-7),freq:1,multa:5,people:P.map(n=>({name:n,always:n==="Andrea D'Amore"}))};
  S.trainers=P.slice(1).map((n,i)=>({id:"t"+i,name:n}));
  const T=n=>S.trainers.find(t=>t.name.startsWith(n)).id;
  const w=[[0,"Davide","07:00","13:00"],[0,"Erika","09:00","13:00"],[0,"Giovanni","15:00","21:00"],[0,"Simone","17:00","21:00"],
    [1,"Ismael","07:00","13:00"],[1,"Erika","15:00","19:00"],[1,"Francesco","15:00","21:00"],[1,"Luca","18:00","21:00"],
    [2,"Davide","07:00","13:00"],[2,"Giovanni","09:00","12:00"],[2,"Simone","15:00","21:00"],[2,"Leonardo","18:00","21:00"],
    [3,"Ismael","07:00","13:00"],[3,"Erika","09:00","13:00"],[3,"Francesco","15:00","21:00"],[3,"Alessandro","18:00","21:00"],
    [4,"Giovanni","07:00","13:00"],[4,"Simone","09:00","13:00"],[4,"Ismael","17:00","20:00"],[4,"Davide","15:00","21:00"],
    [5,"Erika","09:00","13:00"]];
  S.slots=w.map((x,i)=>({id:"s"+i,day:x[0],trainerId:T(x[1]),start:x[2],end:x[3],site:CFG.SEDE||"Cecina Center",validFrom:"2026-01-01",validTo:""}));
  S.absences=[];
  const m=today().slice(0,7);S.impresa=[3,6,11,17,20,26].map(d=>m+"-"+pad(d));
  const ds=workDays(S.cfg.start,addDays(today(),-1));
  ds.forEach((d,i)=>{const a=assign(d);if(!a)return;
    const it=itemsInc(d);const ok=Object.fromEntries(it.map(x=>[x[0],true]));
    S.logs.push({id:"l"+i+"a",date:d,role:"inc",person:a.inc,items:ok,sala:"ok",ts:d+"T11:2"+i%10});
    const ver=Object.fromEntries(it.map(x=>[x[0],"ok"]));if(i===2)ver.cestini="ko";
    S.logs.push({id:"l"+i+"c",date:d,role:"chi",person:a.chi,items:{docce:true,asciutto:true,desk:true},verify:ver,note:i===2?"Cestino bagno uomini pieno":"",ts:d+"T21:05"});
    if(i!==4){const n=nextWork(d);if(n<=today())S.logs.push({id:"l"+i+"o",date:n,role:"ape",person:(assign(n)||{}).ape,verify:{spogliatoi:"ok",docce:"ok",desk:"ok"},ref:d,ts:n+"T07:10"})};
  });
  rebuildMulte();
}

/* ---------- calendario: chi è in palestra (da Orari Trainer) ---------- */
const isOff=d=>dow(d)>4||FESTIVI.includes(d);
const isImp=d=>S.impresa.includes(d);
function workDays(a,b){const o=[];for(let d=a;d<=b;d=addDays(d,1))if(!isOff(d))o.push(d);return o}
function nextWork(d){let x=addDays(d,1);while(isOff(x))x=addDays(x,1);return x}
function prevWork(d){let x=addDays(d,-1);while(isOff(x))x=addDays(x,-1);return x}
const tName=id=>(S.trainers.find(t=>t.id===id)||{}).name||"";
function slotOn(s,d){return !s.deleted&&Number(s.day)===dow(d)&&(!s.validFrom||s.validFrom<=d)&&(!s.validTo||d<=s.validTo)&&(!CFG.SEDE||!s.site||s.site===CFG.SEDE)}
function shifts(d){return S.slots.filter(s=>slotOn(s,d)).map(s=>{
  const a=S.absences.find(x=>!x.deleted&&x.trainerId===s.trainerId&&x.from<=d&&d<=x.to&&(x.allDay!==false&&x.allDay!=="FALSE"||(mins(x.start)<mins(s.end)&&mins(s.start)<mins(x.end))));
  const id=a?a.subId:s.trainerId;return id?{name:tName(id),start:s.start,end:s.end}:null}).filter(Boolean)}
const person=n=>S.cfg.people.find(p=>p.name===n);
function inRota(n){const p=person(n);return p&&!p.off}
const CACHE={},TALLY={};
// giorno lavorativo precedente (>= inizio rotazione) o null
function prevRot(d){if(!S.cfg.start||d<=S.cfg.start)return null;let x=addDays(d,-1);while(x>=S.cfg.start&&isOff(x))x=addDays(x,-1);return x>=S.cfg.start?x:null}
function pick(cands,t){const order=S.cfg.people.map(p=>p.name);return cands.slice().sort((a,b)=>(t.cnt[a]||0)-(t.cnt[b]||0)||(t.last[a]||"").localeCompare(t.last[b]||"")||order.indexOf(a)-order.indexOf(b))[0]||""}
const T0=()=>({cnt:{},last:{}});
const bump=(t,n,d)=>{const o={cnt:{...t.cnt},last:{...t.last}};if(n){o.cnt[n]=(o.cnt[n]||0)+1;o.last[n]=d}return o};
function assign(d){
  if(isOff(d)||!S.cfg.start||d<S.cfg.start)return null;
  if(CACHE[d])return CACHE[d];
  if(!S.slots.length&&S.turniDb){const t=S.turniDb[d];return t?(CACHE[d]={date:d,ape:t.ape||"",chi:t.chi||"",inc:t.inc||"",apeT:"",chiT:"",imp:isImp(d)}):null}
  // conteggi fino al giorno prima (calcolati una volta, in ordine)
  let p=prevRot(d),tl={inc:T0(),ape:T0(),chi:T0(),idx:-1};
  if(p){const chain=[];let q=p;while(q&&!TALLY[q]){chain.push(q);q=prevRot(q)}for(let i=chain.length-1;i>=0;i--)assign(chain[i]);tl=TALLY[p]}
  const idx=tl.idx+1,prevChi=p?(CACHE[p]||{}).chi:"";
  const sh=shifts(d).filter(x=>inRota(x.name));
  const sw=k=>(S.swaps.find(x=>x.date===d&&x.role===k)||{}).person;
  const names=f=>[...new Set(sh.filter(f).map(x=>x.name))];
  // controllo serale: a rotazione tra chi è in sede la sera (turno che finisce dopo le 19:30)
  let ev=names(x=>mins(x.end)>=mins(S.cfg.sera||"19:30"));if(!ev.length)ev=names(x=>mins(x.end)===Math.max(...sh.map(y=>mins(y.end))));
  const chi=sw("chi")||pick(ev,tl.chi);
  // apertura: a rotazione tra chi inizia entro le 10:00, mai chi ha chiuso la sera prima (non controlla sé stesso)
  let mo=names(x=>mins(x.start)<=mins(S.cfg.mattina||"10:00"));if(!mo.length)mo=names(x=>mins(x.start)===Math.min(...sh.map(y=>mins(y.start))));
  const mo2=mo.filter(n=>n!==prevChi);
  const ape=sw("ape")||pick(mo2.length?mo2:mo,tl.ape);
  // incaricato: tra chi è in sede, mai chi fa il controllo serale; chi ne ha fatti meno passa prima
  let inc=sw("inc")||"";
  const active=S.cfg.freq<2||idx%S.cfg.freq===0;
  if(!inc&&active){
    const here=new Set(sh.map(x=>x.name));S.cfg.people.forEach(p=>{if(p.always&&!p.off)here.add(p.name)});
    const c=[...here].filter(inRota),c2=c.filter(n=>n!==chi);
    inc=pick(c2.length?c2:c,tl.inc);
  }
  const ninc=active?inc:"";
  TALLY[d]={inc:bump(tl.inc,ninc,d),ape:bump(tl.ape,ape,d),chi:bump(tl.chi,chi,d),idx};
  const sOf=n=>sh.filter(x=>x.name===n);
  return CACHE[d]={date:d,ape,chi,inc:ninc,apeT:(sOf(ape).map(x=>x.start).sort()[0])||"",chiT:(sOf(chi).map(x=>x.end).sort().pop())||"",imp:isImp(d)};
}
function clearCalc(){for(const k in CACHE)delete CACHE[k];for(const k in TALLY)delete TALLY[k]}
const itemsInc=d=>isImp(d)?ITEMS.inc_imp:ITEMS.inc_std;
const logOf=(d,r)=>S.logs.filter(l=>l.date===d&&l.role===r).sort((a,b)=>b.ts.localeCompare(a.ts))[0];

/* ---------- multe ---------- */
function rebuildMulte(){
  const keep=S.multe.filter(m=>m.manual||m.stato!=="da confermare");const auto=[];
  const add=(date,p,motivo,key,forget)=>{if(!p)return;const old=S.multe.find(m=>m.key===key);auto.push(old||{key,date,person:p,motivo,importo:S.cfg.multa,stato:"da confermare",forget})};
  workDays(S.cfg.start||today(),addDays(today(),-1)).forEach(d=>{
    const a=assign(d);if(!a)return;const it=itemsInc(d),c=logOf(d,"chi"),li=logOf(d,"inc");
    if(a.inc&&!li)add(d,a.inc,"Incaricato: nessuna registrazione","n-inc-"+d,1);
    else if(li&&li.late)add(d,li.person||a.inc,"Incaricato: registrato dopo le "+(S.cfg.deadline||"18:00"),"late-inc-"+d,1);
    if(c&&c.verify)it.forEach(([k,l])=>{if(c.verify[k]==="ko")add(d,(li&&li.person)||a.inc,"Non fatto (controllo serale): "+l,"ko-inc-"+d+k)});
    if(a.chi&&!c)add(d,a.chi,"Controllo serale: nessuna registrazione","n-chi-"+d,1);
    const o=S.logs.find(l=>l.role==="ape"&&l.ref===d);
    if(o&&o.verify)ITEMS.ape.forEach(([k,l])=>{if(o.verify[k]==="ko")add(d,(c&&c.person)||a.chi,"Non fatto (controllo apertura): "+l,"ko-chi-"+d+k)});
  });
  // tolleranza: le prime N dimenticanze/ritardi del mese per persona non si pagano
  const tol=+(S.cfg.tolleranza??1),used={};
  auto.sort((x,y)=>x.date.localeCompare(y.date)).forEach(m=>{if(!m.forget||m.manual)return;const k=m.person+m.date.slice(0,7);used[k]=(used[k]||0)+1;
    if(used[k]<=tol){m.stato="annullata";m.importo=0;if(!/tolleranza/.test(m.motivo))m.motivo+=" · tolleranza ("+used[k]+"ª del mese)"}});
  const keys=new Set(keep.map(m=>m.key));S.multe=keep.concat(auto.filter(m=>!keys.has(m.key)));
}

/* ---------- vista OGGI ---------- */
function statusOf(d,r){const l=logOf(d,r);if(l)return{c:"ok",t:"✓ "+(l.ts.slice(11,16)||"fatto")};return d<today()?{c:"ko",t:"Non fatto"}:{c:"wait",t:"Da fare"}}
function viewOggi(){
  const d=S.day,a=assign(d);
  let h=`<div class="day"><h2>${esc(fmtL(d))}</h2><div class="nav"><button id="d-prev">‹</button><button id="d-today">Oggi</button><button id="d-next">›</button></div></div>`;
  if(!a){return h+`<div class="panel"><span class="badge b-off">${!isOff(d)&&S.cfg.start&&d<S.cfg.start?"Prima dell'avvio ("+esc(fmtS(S.cfg.start))+")":"Chiuso / festivo"}</span><span class="note">Nessun turno previsto.</span></div>`}
  h+=`<div class="row">${a.imp?'<span class="badge b-imp">Impresa pulizie · solo saponi e carta</span>':'<span class="badge b-std">Giorno standard</span>'}${S.cfg.freq>1?'<span class="badge b-std">Frequenza ogni '+S.cfg.freq+' gg</span>':""}</div>`;
  const prev=prevWork(d),pc=logOf(prev,"chi");
  const ko=S.multe.filter(m=>m.date===prev&&m.stato!=="annullata");
  if(ko.length&&d===today())h+=`<div class="alert ko">Ieri: ${ko.map(m=>esc(first(m.person))+" · "+esc(m.motivo)).join("<br>")}</div>`;
  const cards=[["ape",a.ape,a.apeT?"dalle "+a.apeT:""],["inc",a.inc,a.inc?"durante il giorno":"oggi nessun incaricato"],["chi",a.chi,a.chiT?"fino alle "+a.chiT:""]];
  if(MODE==="admin")return h+dettaglio(d,a);
  h+=cards.map(([r,who,when])=>{
    if(r==="inc"&&!who)return"";
    const st=statusOf(d,r),mine=who&&who===S.me,open=S.open?S.open===r:mine&&!logOf(d,r);
    return`<div class="card ${mine?"mine":""}"><div class="card-h" data-open="${r}"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ROLE[r].ic}</svg></div>
      <div class="tx"><b>${ROLE[r].n}</b><span class="who">${esc(who||"— nessuno in orario")}</span> <span>${esc(when)}</span></div><span class="badge b-${st.c==="ok"?"ok":st.c==="ko"?"ko":"wait"}">${st.t}</span></div>
      ${open?`<div class="card-b">${form(r,d,a,who)}</div>`:""}</div>`}).join("");
  return h;
}
function form(r,d,a,who){
  const l=logOf(d,r)||{},it=l.items||{},vf=l.verify||{};
  const chk=list=>list.map(([k,t])=>`<label class="chk ${it[k]?"on":""}"><input type="checkbox" data-k="${k}" ${it[k]?"checked":""}>${esc(t)}</label>`).join("");
  const fotoBtn=(k,req)=>`<label class="foto ${req?"req":""}" data-fk="${k}" ${req&&vf[k]!=="ko"?"hidden":""}><input type="file" accept="image/*" capture="environment" hidden><span>📷 ${req?"Foto obbligatoria":"Aggiungi foto (facoltativa)"}</span><img alt="" hidden></label>`;
  const ver=(list,title,ref)=>`<div class="lbl">${title}</div>`+list.map(([k,t])=>`<div class="ver"><span class="l">${esc(t)}</span><div class="seg"><button class="ok" data-v="${k}" data-val="ok" aria-pressed="${vf[k]==="ok"}" aria-label="Fatto">✓</button><button class="ko" data-v="${k}" data-val="ko" aria-pressed="${vf[k]==="ko"}" aria-label="Non fatto">✗</button></div></div>${fotoBtn(k,1)}`).join("")+(ref?`<span class="note">${ref}</span>`:"");
  let h="";
  if(r==="inc"){const late=d===today()&&nowHM()>(S.cfg.deadline||"18:00");h+=`<div class="alert ${late?"ko":"info"}">${late?"Scadenza delle "+esc(S.cfg.deadline||"18:00")+" passata: registra comunque, risulterà in ritardo.":"Da registrare entro le "+esc(S.cfg.deadline||"18:00")+"."}</div>`;h+=chk(itemsInc(d));if(!a.imp)h+=fotoBtn("bagno",0);if(!a.imp)h+=`<div class="lbl">Sala</div><div class="radio">${SALA.map(([k,t])=>`<button data-sala="${k}" aria-pressed="${l.sala===k}">${t}</button>`).join("")}</div>`}
  if(r==="chi"){h+=ver(itemsInc(d),"Verifica incaricato · "+esc(first(a.inc)||"—"),"✗ = non fatto → foto obbligatoria e multa all'incaricato");h+=`<div class="lbl">Chiusura</div>`+chk(ITEMS.chi)}
  if(r==="ape"){const p=prevWork(d),pa=assign(p)||{};h+=ver(ITEMS.ape,"Verifica chiusura di "+fmtS(p)+" · "+esc(first(pa.chi)||"—"),"✗ = non fatto → foto obbligatoria e multa a chi ha fatto il controllo serale")}
  h+=`<textarea class="f-note" placeholder="Note (cosa manca, cosa hai segnalato…)">${esc(l.note||"")}</textarea>`;
  h+=`<button class="primary f-save" data-r="${r}">${l.id?"Aggiorna registrazione":"Registra"}${who&&S.me&&who!==S.me?" (cambio turno)":""}</button>`;
  if(who&&S.me&&who!==S.me)h+=`<span class="note">Sei registrato come ${esc(S.me)}: il turno passa a te.</span>`;
  return h;
}
function bindForm(){
  document.querySelectorAll(".card-b").forEach(b=>{b.addEventListener("input",()=>S.dirty=true);b.addEventListener("click",e=>{if(e.target.closest("[data-v],[data-sala]"))S.dirty=true})});
  document.querySelectorAll(".chk input").forEach(i=>i.onchange=()=>i.parentElement.classList.toggle("on",i.checked));
  document.querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{b.parentElement.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b));
    const f=b.closest(".card-b").querySelector(`.foto[data-fk="${b.dataset.v}"]`);if(f)f.hidden=b.dataset.val!=="ko"});
  document.querySelectorAll(".foto input").forEach(i=>i.onchange=async()=>{const f=i.files[0];if(!f)return;const lab=i.closest(".foto");lab.querySelector("span").textContent="⏳ Preparo la foto…";
    try{const data=await shrink(f);lab.dataset.img=data;const im=lab.querySelector("img");im.src=data;im.hidden=false;lab.querySelector("span").textContent="📷 Foto pronta · tocca per cambiarla";lab.classList.add("done")}
    catch(e){lab.querySelector("span").textContent="📷 Foto non leggibile, riprova"}});
  document.querySelectorAll("[data-sala]").forEach(b=>b.onclick=()=>{b.parentElement.querySelectorAll("[data-sala]").forEach(x=>x.setAttribute("aria-pressed",x===b))});
  document.querySelectorAll(".f-save").forEach(b=>b.onclick=()=>save(b.dataset.r,b.closest(".card-b")));
}
async function save(r,box){
  if(!S.me||(!DEMO&&!tok())){pickMe();return}
  const d=MODE==="staff"?today():S.day,a=assign(d),items={},verify={},photos=[];
  box.querySelectorAll(".chk input").forEach(i=>items[i.dataset.k]=i.checked);
  box.querySelectorAll("[data-v][aria-pressed=true]").forEach(b=>verify[b.dataset.v]=b.dataset.val);
  const need=r==="chi"?itemsInc(d).length:r==="ape"?ITEMS.ape.length:0;
  if(Object.keys(verify).length<need){toast("Segna ✓ o ✗ su ogni voce");return}
  for(const[k,v]of Object.entries(verify))if(v==="ko"){const f=box.querySelector(`.foto[data-fk="${k}"]`);if(!f||!f.dataset.img){toast("Serve la foto per ogni ✗");f&&f.scrollIntoView({block:"center"});return}}
  box.querySelectorAll(".foto[data-img]").forEach(f=>{if(!f.hidden)photos.push({key:f.dataset.fk,data:f.dataset.img})});
  const sala=(box.querySelector("[data-sala][aria-pressed=true]")||{}).dataset?.sala||"";
  const who=r==="inc"?a.inc:r==="chi"?a.chi:a.ape,take=who!==S.me;
  if(take){S.swaps=S.swaps.filter(x=>!(x.date===d&&x.role===r));S.swaps.push({date:d,role:r,person:S.me});clearCalc()}
  const old=logOf(d,r);
  const rec={id:(old||{}).id||"l"+Date.now(),date:d,role:r,person:S.me,items,verify,sala,note:box.querySelector(".f-note").value.trim(),
    ts:(old&&old.ts)||d+"T"+nowHM(),ref:r==="ape"?prevWork(d):"",late:old?old.late:(r==="inc"&&nowHM()>(S.cfg.deadline||"18:00")),foto:photos.map(p=>p.key)};
  S.logs=S.logs.filter(l=>l.id!==rec.id).concat(rec);
  S.dirty=false;rebuildMulte();S.open=null;S.cover=null;
  toast(Object.values(verify).includes("ko")?"Registrato · ✗ segnalato":"Registrato ✓");render();
  queuePush(rec,take,photos);
}
const nowHM=()=>pad(new Date().getHours())+":"+pad(new Date().getMinutes());
// foto ridotta (lato lungo 900px, JPEG) per non pesare su rete e database
function shrink(file){return new Promise((ok,ko)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{const k=Math.min(1,900/Math.max(im.width,im.height)),c=document.createElement("canvas");c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext("2d").drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);let q=.7,out=c.toDataURL("image/jpeg",q);while(out.length>280000&&q>.3){q-=.1;out=c.toDataURL("image/jpeg",q)}ok(out)};im.onerror=ko;im.src=u})}

/* ---------- AMMINISTRAZIONE: dettaglio giorno (chi pulisce cosa ha fatto, chi controlla) ---------- */
const V=v=>v==="ok"?'<span class="badge b-ok">✓ fatto</span>':v==="ko"?'<span class="badge b-ko">✗ non fatto</span>':'<span class="note">—</span>';
const F=v=>v===true?'<span class="badge b-ok">✓ fatto</span>':v===false?'<span class="badge b-ko">✗ non fatto</span>':'<span class="note">—</span>';
const fotoLink=l=>l&&l.foto&&l.foto.length?` <button class="btn sm" data-foto="${esc(l.id)}">📷 ${l.foto.length} foto</button>`:"";
const who=(l,n)=>l?`<b>${esc(l.person||n)}</b> <span class="note">· ${esc(l.date!==S.day?fmtS(l.date)+" ":"")}${esc(l.ts.slice(11,16))}${l.person!==n&&n?" · al posto di "+esc(first(n)):""}</span>${l.late?' <span class="badge b-ko">in ritardo</span>':""}${fotoLink(l)}`:`<b>${esc(n||"—")}</b> <span class="badge ${S.day<today()?"b-ko":"b-wait"}">${S.day<today()?"non registrato":"in attesa"}</span>`;
function dettaglio(d,a){
  const li=logOf(d,"inc"),lc=logOf(d,"chi"),nx=nextWork(d),lo=S.logs.find(l=>l.role==="ape"&&l.ref===d),an=assign(nx)||{};
  const it=itemsInc(d),ii=(li||{}).items||{},cv=(lc||{}).verify||{};
  let h="";
  if(a.inc)h+=`<div class="panel"><h3>Incaricato del giorno</h3><div>${who(li,a.inc)}</div><div><span class="note">Controllato da</span> ${who(lc,a.chi)}</div>
    <table><thead><tr><th>Voce</th><th>Incaricato</th><th>Controllo</th></tr></thead><tbody>${it.map(([k,t])=>`<tr><td>${esc(t)}</td><td>${li?F(ii[k]):F()}</td><td>${V(cv[k])}</td></tr>`).join("")}
    ${a.imp?"":`<tr><td>Sala</td><td colspan="2">${li&&li.sala?esc((SALA.find(x=>x[0]===li.sala)||[])[1]||li.sala):"—"}</td></tr>`}</tbody></table>${li&&li.note?`<span class="note">Note incaricato: ${esc(li.note)}</span>`:""}${lc&&lc.note?`<span class="note">Note controllo: ${esc(lc.note)}</span>`:""}</div>`;
  const ci=(lc||{}).items||{},ov=(lo||{}).verify||{};
  h+=`<div class="panel"><h3>Controllo serale</h3><div>${who(lc,a.chi)}</div><div><span class="note">Controllata all'apertura del ${fmtS(nx)} da</span> ${lo?who(lo,an.ape):`<b>${esc(an.ape||"—")}</b> <span class="badge ${nx<=today()&&nx<today()?"b-ko":"b-wait"}">${nx<today()?"non registrato":"in attesa"}</span>`}</div>
    <table><thead><tr><th>Chiusura</th><th></th></tr></thead><tbody>${ITEMS.chi.map(([k,t])=>`<tr><td>${esc(t)}</td><td>${lc?F(ci[k]):F()}</td></tr>`).join("")}</tbody></table>
    <table><thead><tr><th>Controllo apertura</th><th></th></tr></thead><tbody>${ITEMS.ape.map(([k,t])=>`<tr><td>${esc(t)}</td><td>${V(ov[k])}</td></tr>`).join("")}</tbody></table>${lo&&lo.note?`<span class="note">Note apertura: ${esc(lo.note)}</span>`:""}</div>`;
  const mm=S.multe.filter(m=>m.date===d&&m.stato!=="annullata");
  if(mm.length)h+=`<div class="alert ko">${mm.map(m=>esc(first(m.person))+" · "+esc(m.motivo)+" · € "+esc(m.importo)+" ("+esc(m.stato)+")").join("<br>")}</div>`;
  return h;
}

/* ---------- STAFF: solo i miei check ---------- */
function viewStaff(){
  const d=today(),a=assign(d);
  if(!S.me)return`<div class="panel"><span class="note">Scegli il tuo nome in alto per vedere i tuoi compiti.</span></div>`;
  let h=`<div class="day"><h2>${esc(fmtL(d))}</h2>${a&&a.imp?'<span class="badge b-imp">Impresa · solo saponi e carta</span>':""}</div>`;
  const tm=nextWork(d),b=assign(tm);
  if(b){const rr=["inc","ape","chi"].filter(r=>b[r]===S.me);if(rr.length)h+=`<div class="alert info">🔔 ${tm===addDays(d,1)?"Domani":esc(fmtL(tm))} sei di turno: <b>${rr.map(r=>ROLE[r].n).join(" + ")}</b>${b.imp&&rr.includes("inc")?" · giorno impresa, solo saponi e carta":""}</div>`}
  const mine=a?["inc","chi","ape"].filter(r=>a[r]===S.me):[];
  if(S.cover&&a&&!mine.includes(S.cover))mine.push(S.cover);
  const lab={inc:"Sei l'incaricato del giorno",chi:"Controllo serale: verifica l'incaricato",ape:"Apertura: controlla come è stato lasciato ieri sera"};
  if(!a)h+=`<div class="panel"><span class="note">${!isOff(d)&&S.cfg.start&&d<S.cfg.start?"I turni pulizie partono da "+esc(fmtL(S.cfg.start))+".":"Oggi palestra chiusa: nessun turno."}</span></div>`;
  else if(!mine.length)h+=`<div class="panel"><b>Oggi nessun compito pulizie per te 👍</b><span class="note">Se sostituisci un collega usa "Copro un collega" qui sotto.</span></div>`;
  mine.forEach(r=>{const l=logOf(d,r),st=statusOf(d,r),orig=a[r];
    h+=`<div class="card mine"><div class="card-h"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ROLE[r].ic}</svg></div>
      <div class="tx"><b>${r===S.cover&&orig!==S.me?"Copri "+esc(first(orig))+" · "+ROLE[r].n:lab[r]}</b><span>${r==="inc"?(a.imp?"Saponi e carta":"Spogliatoi, cestini, desk, sala")+" · entro le "+esc(S.cfg.deadline||"18:00"):r==="chi"?"Verifica di "+esc(first(a.inc)||"—")+" + docce e desk":"Verifica di "+esc(first((assign(prevWork(d))||{}).chi)||"—")}</span></div><span class="badge b-${st.c==="ok"?"ok":"wait"}">${st.t}</span></div>
      <div class="card-b">${form(r,d,a,S.me)}</div></div>`});
  if(a){const others=["inc","chi","ape"].filter(r=>a[r]&&a[r]!==S.me&&r!==S.cover);
    if(others.length)h+=`<div class="panel"><h3>Copro un collega</h3><div class="radio">${others.map(r=>`<button data-cover="${r}">${ROLE[r].n} · ${esc(first(a[r]))}</button>`).join("")}</div></div>`}
  const nx=[];for(let x=addDays(d,1);x<=addDays(d,28)&&nx.length<6;x=addDays(x,1)){const b=assign(x);if(b)["ape","inc","chi"].forEach(r=>{if(b[r]===S.me)nx.push([x,r])})}
  h+=`<div class="panel"><h3>I tuoi prossimi turni</h3>${nx.length?`<table><tbody>${nx.map(([x,r])=>`<tr><td>${fmtS(x)}</td><td>${ROLE[r].n}${r==="inc"&&isImp(x)?' <span class="badge b-imp">Impresa</span>':""}</td></tr>`).join("")}</tbody></table>`:'<span class="note">Nessun turno nelle prossime 4 settimane.</span>'}</div>`;
  h+=pushBox();
  return h;
}

/* ---------- CALENDARIO ---------- */
function viewCal(){
  const w=S.week,days=workDays(w,addDays(w,11));
  const cnt={};S.cfg.people.forEach(p=>cnt[p.name]=0);
  workDays(w,addDays(w,11)).forEach(d=>{const a=assign(d);if(a&&a.inc)cnt[a.inc]=(cnt[a.inc]||0)+1});
  const cell=(d,r,who,t)=>{if(!who)return"<td>—</td>";const st=statusOf(d,r);const dt=d>today()?"none":st.c;return`<td><span class="dot ${dt}"></span>${esc(first(who))}${t?`<span class="s">${t}</span>`:""}</td>`};
  let h=`<div class="day"><h2>Calendario 2 settimane</h2><div class="nav"><button id="w-prev">‹</button><button id="w-today">Oggi</button><button id="w-next">›</button></div></div>
  <div class="panel scroll"><table><thead><tr><th>Giorno</th><th>Apertura</th><th>Incaricato</th><th>Chiusura</th></tr></thead><tbody>`;
  for(let d=w;d<=addDays(w,11);d=addDays(d,1)){
    if(dow(d)>4)continue;const a=assign(d);
    if(!a){h+=`<tr class="off"><td>${fmtS(d)}</td><td colspan="3">Festivo</td></tr>`;continue}
    h+=`<tr class="${d===today()?"today":""}" data-goto="${d}"><td><b>${fmtS(d)}</b>${a.imp?'<span class="s"><span class="badge b-imp">Impresa</span></span>':""}</td>${cell(d,"ape",a.ape,a.apeT)}${cell(d,"inc",a.inc,"")}${cell(d,"chi",a.chi,a.chiT)}</tr>`;
  }
  h+=`</tbody></table></div><div class="row note"><span><span class="dot ok"></span>fatto</span><span><span class="dot ko"></span>non fatto</span><span><span class="dot wait"></span>oggi da fare</span><span><span class="dot none"></span>futuro</span></div>`;
  h+=`<div class="panel"><h3>Turni incaricato nelle 2 settimane</h3><div class="chips">${Object.entries(cnt).map(([n,c])=>`<span class="chip" style="${c?"":"background:var(--crit-soft);color:var(--crit)"}">${esc(first(n))} · ${c}</span>`).join("")}</div>
  <span class="note">Incaricato scelto tra chi è in orario in sede quel giorno (Orari Trainer), a rotazione: chi ne ha fatti meno passa prima. Apertura = primo turno del giorno, chiusura = ultimo.</span></div>`;
  return h;
}

/* ---------- REGISTRO ---------- */
function viewReg(){
  const L=S.logs.slice().sort((a,b)=>b.ts.localeCompare(a.ts)).slice(0,60);
  const done=workDays(addDays(today(),-30)>S.cfg.start?addDays(today(),-30):S.cfg.start,addDays(today(),-1));
  let tot=0,ok=0;done.forEach(d=>{const a=assign(d);if(!a)return;["inc","chi","ape"].forEach(r=>{if(!a[r])return;tot++;if(logOf(d,r))ok++})});
  const kos=S.logs.filter(l=>l.verify&&Object.values(l.verify).includes("ko")).length;
  let h=`<div class="kpis"><div class="kpi"><b>${tot?Math.round(ok/tot*100):0}%</b><span>turni registrati (30 gg)</span></div><div class="kpi"><b>${kos}</b><span>controlli ✗</span></div><div class="kpi"><b>${S.multe.filter(m=>m.stato!=="annullata").length}</b><span>multe</span></div></div>`;
  h+=`<div class="panel scroll"><table><thead><tr><th>Quando</th><th>Turno</th><th>Chi</th><th>Esito</th></tr></thead><tbody>`+L.map(l=>{
    const ko=l.verify&&Object.entries(l.verify).filter(([,v])=>v==="ko").map(([k])=>k);
    const miss=l.items&&Object.entries(l.items).filter(([,v])=>!v).map(([k])=>k);
    return`<tr><td>${fmtS(l.date)}<span class="s">${esc(l.ts.slice(11,16))}</span></td><td>${ROLE[l.role].n}</td><td>${esc(first(l.person))}</td><td>${ko&&ko.length?`<span class="badge b-ko">✗ ${esc(ko.join(", "))}</span>`:miss&&miss.length?`<span class="badge b-wait">manca ${esc(miss.join(", "))}</span>`:'<span class="badge b-ok">✓</span>'}${l.sala&&l.sala!=="ok"?`<span class="s">Sala: ${esc(l.sala)}</span>`:""}${l.note?`<span class="s">${esc(l.note)}</span>`:""}</td></tr>`}).join("")+`</tbody></table></div>`;
  return h;
}

/* ---------- MULTE: decurtate dal compenso mensile ---------- */
const MESI=["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
const meseL=m=>MESI[+m.slice(5,7)-1]+" "+m.slice(0,4);
function viewMulte(){
  const mese=S.mese||today().slice(0,7);
  const M=S.multe.filter(m=>m.date.slice(0,7)===mese).sort((a,b)=>b.date.localeCompare(a.date));
  const sum=f=>M.filter(f).reduce((s,m)=>s+Number(m.importo||0),0);
  const tot={};M.filter(m=>m.stato==="confermata"||m.stato==="decurtata").forEach(m=>tot[m.person]=(tot[m.person]||0)+Number(m.importo||0));
  let h=`<div class="day"><h2>Multe · ${meseL(mese)}</h2><div class="nav"><button id="m-prev">‹</button><button id="m-next">›</button></div></div>
  <div class="kpis"><div class="kpi"><b>${M.filter(m=>m.stato==="da confermare").length}</b><span>da confermare</span></div><div class="kpi"><b>€ ${sum(m=>m.stato==="confermata")}</b><span>da decurtare dal compenso</span></div><div class="kpi"><b>€ ${sum(m=>m.stato==="decurtata")}</b><span>già decurtate</span></div></div>`;
  h+=`<div class="panel scroll"><table><thead><tr><th>Data</th><th>Chi</th><th>Motivo</th><th>€</th><th>Stato</th></tr></thead><tbody>`+(M.map(m=>`<tr><td>${fmtS(m.date)}</td><td>${esc(first(m.person))}</td><td>${esc(m.motivo)}</td><td>${esc(m.importo)}</td><td>${S.admin?`<select data-multa="${esc(m.key)}">${["da confermare","confermata","decurtata","annullata"].map(x=>`<option ${x===m.stato?"selected":""}>${x}</option>`).join("")}</select>`:`<span class="badge ${m.stato==="decurtata"?"b-ok":m.stato==="annullata"?"b-off":"b-ko"}">${m.stato}</span>`}</td></tr>`).join("")||`<tr><td colspan="5" class="note">Nessuna multa nel mese 👏</td></tr>`)+`</tbody></table></div>`;
  h+=`<div class="panel"><h3>Decurtazione compensi ${meseL(mese)}</h3>${Object.keys(tot).length?`<table><tbody>${Object.entries(tot).sort((a,b)=>b[1]-a[1]).map(([n,v])=>`<tr><td>${esc(n)}</td><td style="text-align:right"><b>− € ${v}</b></td></tr>`).join("")}</tbody></table>`:'<span class="note">Nessuna decurtazione.</span>'}
  ${S.admin&&M.some(m=>m.stato==="confermata")?'<button class="btn" id="m-done">Segna tutte come decurtate</button>':""}</div>`;
  h+=`<span class="note">La multa nasce "da confermare" (✗ al controllo o turno non registrato) → l'amministrazione conferma o annulla → a fine mese viene sottratta dal compenso e segnata "decurtata".</span>`;
  return h;
}

/* ---------- IMPOSTAZIONI ---------- */
function viewSet(){
  if(!S.admin)return`<div class="panel"><span class="note">Solo amministrazione (sblocca dall'HUB).</span></div>`;
  const m=S.day.slice(0,7);
  let h=`<div class="panel"><h3>Giorni impresa di pulizie</h3><span class="note">Inseriscili appena l'impresa li comunica a inizio mese: quei giorni l'incaricato controlla solo saponi e carta.</span>
    <div class="chips">${S.impresa.slice().sort().map(d=>`<span class="chip">${fmtS(d)} <button data-rmimp="${d}" aria-label="Rimuovi">×</button></span>`).join("")||'<span class="note">Nessuna data</span>'}</div>
    <div class="row"><input type="date" id="imp-d" value="${m}-01"><button class="btn" id="imp-add">Aggiungi</button></div></div>`;
  h+=`<div class="panel"><h3>Regole</h3>
    <div class="row"><span style="flex:1">Incaricato</span><select id="c-freq"><option value="1" ${S.cfg.freq==1?"selected":""}>ogni giorno lavorativo</option><option value="2" ${S.cfg.freq==2?"selected":""}>un giorno sì e uno no</option></select></div>
    <div class="row"><span style="flex:1">Importo multa (€)</span><input type="number" id="c-multa" value="${S.cfg.multa}" style="width:90px"></div>
    <div class="row"><span style="flex:1">Data inizio rotazione</span><input type="date" id="c-start" value="${S.cfg.start}"></div>
    <div class="row"><span style="flex:1">Scadenza incaricato</span><input type="time" id="c-dl" value="${esc(S.cfg.deadline||"18:00")}"></div>
    <div class="row"><span style="flex:1">Apertura: chi inizia entro le</span><input type="time" id="c-mat" value="${esc(S.cfg.mattina||"10:00")}"></div>
    <div class="row"><span style="flex:1">Controllo serale: chi finisce dopo le</span><input type="time" id="c-sera" value="${esc(S.cfg.sera||"19:30")}"></div>
    <div class="row"><span style="flex:1">Dimenticanze tollerate al mese</span><input type="number" id="c-tol" min="0" max="5" value="${+(S.cfg.tolleranza??1)}" style="width:90px"></div></div>`;
  h+=`<div class="panel"><h3>Persone in rotazione</h3><span class="note">"Sempre in sede" = non dipende dagli Orari Trainer.</span><table><tbody>${S.cfg.people.map((p,i)=>`<tr><td>${esc(p.name)}</td><td><label><input type="checkbox" data-alw="${i}" ${p.always?"checked":""}> sempre in sede</label></td><td><label><input type="checkbox" data-on="${i}" ${p.off?"":"checked"}> attivo</label></td></tr>`).join("")}</tbody></table></div>`;
  h+=`<button class="primary" id="c-save">Salva impostazioni</button>`;
  h+=`<div class="panel"><h3>PIN personali</h3><span class="note">Ognuno entra in Check Pulizie con il suo PIN: le registrazioni sono firmate. "Nuovo PIN" scollega i telefoni di quella persona.</span><table><tbody>${S.cfg.people.map(p=>{const x=(S.pins||[]).find(q=>q.person===p.name);return`<tr><td>${esc(p.name)}<span class="s">${x?"PIN impostato il "+esc(x.updated):"nessun PIN"}</span></td><td style="text-align:right"><button class="btn" data-newpin="${esc(p.name)}">Nuovo PIN</button></td></tr>`}).join("")}</tbody></table></div>`;
  return h;
}


function confirmBox(b,label){if(b.dataset.arm){delete b.dataset.arm;return true}const t=b.textContent;b.dataset.arm=1;b.textContent=label;setTimeout(()=>{if(b.dataset.arm){delete b.dataset.arm;b.textContent=t}},3000);return false}
async function loadPins(){if(DEMO||!S.admin)return;try{S.pins=await rpc("pul_admin_people",{p_pin:pin()});if(S.tab==="set")softRender()}catch(e){}}
async function showFoto(id){
  $("dlgBody").innerHTML=`<h3>Foto</h3><span class="note">Carico…</span>`;$("dlg").showModal();
  try{const L=S.logs.find(l=>l.id===id)||{};const ph=DEMO?[]:await rpc("pul_admin_foto",{p_pin:pin(),p_log:id});
    const lab=k=>([...ITEMS.inc_std,...ITEMS.ape,["bagno","Bagno pulito"]].find(x=>x[0]===k)||[k,k])[1];
    $("dlgBody").innerHTML=`<h3>Foto · ${esc(first(L.person))} ${L.date?esc(fmtS(L.date)):""}</h3>${ph.map(p=>`<figure style="margin:0"><img src="${p.data}" alt="" style="width:100%;border-radius:8px"><figcaption class="note">${esc(lab(p.key))}</figcaption></figure>`).join("")||'<span class="note">Nessuna foto</span>'}<button class="primary" id="ft-ok">Chiudi</button>`;
    $("ft-ok").onclick=()=>$("dlg").close()}catch(e){$("dlgBody").innerHTML=`<div class="alert ko">${esc(e.message)}</div>`;setTimeout(()=>$("dlg").close(),2000)}
}

/* ---------- GUIDA ---------- */
const G=(t,body)=>`<div class="panel"><h3>${t}</h3>${body}</div>`;
const UL=a=>`<ul class="gl">${a.map(x=>`<li>${x}</li>`).join("")}</ul>`;
function viewGuida(){
  const dl=esc(S.cfg.deadline||"18:00"),se=esc(S.cfg.sera||"19:30"),mo=esc(S.cfg.mattina||"10:00"),tl=+(S.cfg.tolleranza??1);
  const staff=[
    G("1 · Primo accesso",UL(["Tocca il nome in alto, scegli <b>chi sei</b> e inserisci il tuo <b>PIN personale</b> (te lo dà l'amministrazione). Serve una volta sola su questo telefono: ogni registrazione è firmata con il tuo nome.","Tocca <b>Attiva avviso</b> in fondo per ricevere le notifiche.","iPhone: le notifiche funzionano solo se l'HUB è aggiunto alla Home (Safari → Condividi → Aggiungi a Home) e lo apri da lì."])),
    G("2 · I tre compiti",`<table><tbody>
      <tr><td><b>Incaricato del giorno</b><span class="s">lun-ven, a rotazione tra chi è in sede, circa 1 volta ogni 2 settimane</span></td><td>Saponi, carta mani, bagno, cestini, desk, sala. Max 10 minuti, <b>da registrare entro le ${dl}</b>.<span class="s">Giorno impresa: solo saponi e carta.</span></td></tr>
      <tr><td><b>Controllo serale</b><span class="s">a rotazione tra chi è in sede la sera (turno che finisce dopo le ${se}); mai l'incaricato dello stesso giorno</span></td><td>Controlla ✓/✗ ogni compito dell'incaricato, poi docce, asciugatura spogliatoi e desk: tutto pronto per il giorno dopo.</td></tr>
      <tr><td><b>Apertura</b><span class="s">a rotazione tra chi inizia entro le ${mo}; mai chi ha fatto il controllo la sera prima</span></td><td>Controlla ✓/✗ come sono stati lasciati spogliatoi, docce e desk la sera prima.</td></tr></tbody></table>`),
    G("3 · Come registrare",UL(["Apri <b>Check Pulizie</b>: vedi solo i tuoi compiti di oggi.","Incaricato: spunta ogni voce fatta e scegli lo stato della sala. Se vuoi, aggiungi una foto del bagno.","Chi controlla: per ogni voce tocca <b>✓</b> se è fatta, <b>✗</b> se non è fatta. <b>Ogni ✗ richiede una foto</b> (si apre la fotocamera).","Scrivi nelle <b>Note</b> cosa manca o cosa hai segnalato, poi tocca <b>Registra</b>. L'ora la mette il sistema.","Senza rete la registrazione resta sul telefono e parte da sola appena torna la connessione."])),
    G("4 · Promemoria",UL(["Il giorno prima alle 18:00: \"domani sei l'incaricato\".","Alle 16:00, se da incaricato non hai ancora registrato.","Alle 20:30, se il controllo serale non è ancora registrato.","Gli orari valgono d'inverno; con l'ora legale arrivano un'ora dopo."])),
    G("5 · Cambi turno",UL(["Se fai il turno di un collega usa <b>Copro un collega</b>: il turno passa a te e risulta firmato a tuo nome.","Senza registrazione il turno resta a chi era in calendario."])),
    G("6 · Multe",UL(["Una ✗ al controllo crea una multa a chi doveva fare quel compito.",`Turno non registrato o incaricato registrato dopo le ${dl}: ${tl?`${tl===1?"la prima volta nel mese è tollerata":"le prime "+tl+" volte nel mese sono tollerate"}, poi è multa.`:"è multa."}`,"L'amministrazione conferma o annulla ogni multa.","Le multe confermate vengono <b>decurtate dal compenso del mese</b>."])),
    G("Problemi?",UL(["PIN dimenticato o telefono nuovo: chiedi un nuovo PIN all'amministrazione.","Nome sbagliato: tocca il nome in alto e rientra con il tuo PIN.","Non vedi il turno giusto: tocca ⟳ in alto nell'HUB.","Nell'HUB compare <b>Aggiorna</b>: toccalo per avere l'ultima versione."]))
  ];
  const admin=[
    G("Giorno",UL(["Per ogni giorno: chi ha pulito e a che ora (ora del server, non modificabile), chi ha controllato, ✓/✗ voce per voce, note, foto (📷) e multe nate quel giorno.","\"in ritardo\" = incaricato registrato dopo la scadenza.","Frecce ‹ › per cambiare giorno."])),
    G("Calendario",UL(["2 settimane: apertura, incaricato, controllo serale. Pallino verde fatto, rosso non fatto, giallo oggi da fare.","Tocca un giorno per aprirne il dettaglio.",`Turni dagli <b>Orari Trainer</b> (sede Cecina Center), tutti a rotazione: apertura tra chi inizia entro le ${mo}, controllo serale tra chi finisce dopo le ${se}, incaricato tra chi è in sede. Nessuno controlla sé stesso. Se cambiano gli orari, i turni si aggiornano da soli.`])),
    G("Registro",UL(["Ultime registrazioni con esito e note.","% di turni registrati negli ultimi 30 giorni."])),
    G("Multe",UL(["Nascono <b>da confermare</b>: scegli <b>confermata</b> o <b>annullata</b>. Guarda le foto prima di confermare.",`Le dimenticanze tollerate (${tl} al mese a testa) compaiono già annullate, a 0 €.`,"A fine mese togli gli importi dai compensi, poi tocca <b>Segna tutte come decurtate</b>."])),
    G("Impostazioni",UL(["<b>Giorni impresa</b>: inseriscili appena l'impresa li comunica a inizio mese.","<b>Regole</b>: frequenza, importo multa, data inizio, scadenza incaricato, orari per apertura e controllo serale, dimenticanze tollerate.","<b>Persone</b>: \"sempre in sede\" per chi non compare negli Orari Trainer; togli \"attivo\" per escludere qualcuno.","<b>PIN personali</b>: \"Nuovo PIN\" genera un PIN da comunicare (viene mostrato una sola volta) e scollega i vecchi telefoni di quella persona. Tocca due volte per confermare."]))
  ];
  return `<div class="day"><h2>Guida</h2><button class="btn" id="g-back">← Indietro</button></div>`+(MODE==="admin"?`<div class="lbl">Amministrazione</div>`+admin.join("")+`<div class="lbl">Cosa vede lo staff</div>`:"")+staff.join("");
}

/* ---------- render ---------- */
const TABS=[["oggi","Giorno",'<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>'],["cal","Calendario",'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'],["reg","Registro",'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>'],["multe","Multe",'<path d="M17 6.5A7 7 0 1 0 17 17.5M4 10h9M4 14h9"/>'],["set","Impostaz.",'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>']];
function render(){
  S.pendingRender=false;S.dirty=false;
  $("demo").hidden=!DEMO;$("b-me").hidden=MODE==="admin";$("b-me").textContent=S.me?"👤 "+first(S.me):"Chi sei?";
  if(window.self!==window.top)document.querySelector("#hdr>div").hidden=true;
  $("b-guide").textContent=S.guide?"✕ Chiudi":"📖 Guida";
  if(S.guide){document.querySelector(".tabs").hidden=true;$("view").innerHTML=`<div style="display:flex;flex-direction:column;gap:12px">${viewGuida()}</div>`;$("g-back").onclick=()=>{S.guide=false;render();scrollTo(0,0)};return}
  document.querySelector(".tabs").hidden=false;
  if(MODE==="staff"){document.querySelector(".tabs").hidden=true;$("view").innerHTML=`<div style="display:flex;flex-direction:column;gap:12px">${viewStaff()}</div>`;bind();return}
  if(!S.admin){document.querySelector(".tabs").hidden=true;$("view").innerHTML=`<div class="panel"><b>Solo amministrazione</b><span class="note">Serve il PIN amministrazione pulizie.</span><button class="primary" id="b-pin">Inserisci PIN</button></div>`;$("b-pin").onclick=askPin;return}
  $("tabs").innerHTML=TABS.filter(t=>t[0]!=="set"||S.admin).map(([k,n,ic])=>`<button data-tab="${k}" aria-current="${S.tab===k}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ic}</svg>${n}</button>`).join("");
  $("view").innerHTML=`<div style="display:flex;flex-direction:column;gap:12px">${{oggi:viewOggi,cal:viewCal,reg:viewReg,multe:viewMulte,set:viewSet}[S.tab]()}</div>`;
  bind();
}
function bind(){
  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;S.open=null;render();scrollTo(0,0)});
  const on=(id,f)=>{const e=$(id);if(e)e.onclick=f};
  on("d-prev",()=>{S.day=addDays(S.day,-1);S.open=null;render()});on("d-next",()=>{S.day=addDays(S.day,1);S.open=null;render()});on("d-today",()=>{S.day=today();S.open=null;render()});
  on("w-prev",()=>{S.week=addDays(S.week,-14);render()});on("w-next",()=>{S.week=addDays(S.week,14);render()});on("w-today",()=>{S.week=monday(today());render()});
  document.querySelectorAll("[data-open]").forEach(e=>e.onclick=()=>{const r=e.dataset.open;S.open=S.open===r?"_":r;render()});
  document.querySelectorAll("[data-goto]").forEach(e=>e.onclick=()=>{S.day=e.dataset.goto;S.tab="oggi";render()});
  document.querySelectorAll("[data-multa]").forEach(s=>s.onchange=async()=>{const m=S.multe.find(x=>x.key===s.dataset.multa);m.stato=s.value;m.manual=true;await db.save("multe",m);toast("Multa: "+s.value);render()});
  const mm=n=>{const d=parse((S.mese||today().slice(0,7))+"-01");d.setMonth(d.getMonth()+n);S.mese=iso(d).slice(0,7);render()};
  on("m-prev",()=>mm(-1));on("m-next",()=>mm(1));
  on("m-done",async()=>{const mese=S.mese||today().slice(0,7);for(const m of S.multe.filter(x=>x.stato==="confermata"&&x.date.slice(0,7)===mese)){m.stato="decurtata";m.manual=true;await db.save("multe",m)}toast("Decurtazioni registrate");render()});
  document.querySelectorAll("[data-rmimp]").forEach(b=>b.onclick=async()=>{S.impresa=S.impresa.filter(d=>d!==b.dataset.rmimp);await db.del("impresa",b.dataset.rmimp);reset();render()});
  on("imp-add",async()=>{const d=$("imp-d").value;if(!d||S.impresa.includes(d))return;S.impresa.push(d);await db.save("impresa",{date:d});reset();toast("Giorno impresa aggiunto");render()});
  on("c-save",async()=>{S.cfg.freq=+$("c-freq").value;S.cfg.multa=+$("c-multa").value||0;S.cfg.start=$("c-start").value;
    S.cfg.deadline=$("c-dl").value||"18:00";S.cfg.mattina=$("c-mat").value||"10:00";S.cfg.sera=$("c-sera").value||"19:30";S.cfg.tolleranza=+$("c-tol").value||0;
    document.querySelectorAll("[data-alw]").forEach(i=>S.cfg.people[+i.dataset.alw].always=i.checked);
    document.querySelectorAll("[data-on]").forEach(i=>S.cfg.people[+i.dataset.on].off=!i.checked);
    await db.save("config",S.cfg);reset();toast("Impostazioni salvate");render()});
  on("b-push",enablePush);
  document.querySelectorAll("[data-newpin]").forEach(b=>b.onclick=async()=>{const n=b.dataset.newpin;
    if(!confirmBox(b,"Conferma: nuovo PIN"))return;
    try{const np=DEMO?"1234":await rpc("pul_admin_new_pin",{p_pin:pin(),p_person:n});
      $("dlgBody").innerHTML=`<h3>Nuovo PIN</h3><p style="margin:0">${esc(n)}</p><div style="font:800 40px var(--display);letter-spacing:.2em;text-align:center">${esc(np)}</div><span class="note">Comunicalo a ${esc(first(n))}: non verrà più mostrato.</span><button class="primary" id="np-ok">Fatto</button>`;
      $("dlg").showModal();$("np-ok").onclick=()=>{$("dlg").close();loadPins()}}catch(e){toast(e.message)}});
  document.querySelectorAll("[data-foto]").forEach(b=>b.onclick=()=>showFoto(b.dataset.foto));
  document.querySelectorAll("[data-cover]").forEach(b=>b.onclick=()=>{S.cover=b.dataset.cover;render()});
  bindForm();
}
function reset(){clearCalc();rebuildMulte()}
function toast(t){const e=$("toast");e.textContent=t;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>e.hidden=true,2200)}
const tok=()=>ls.get("pul-tok")||"";
function pickMe(){
  $("dlgBody").innerHTML=`<h3>Chi sei?</h3><select id="me-s"><option value="">— scegli —</option>${S.cfg.people.filter(p=>!p.off).map(p=>`<option ${p.name===S.me?"selected":""}>${esc(p.name)}</option>`).join("")}</select>
    ${DEMO?"":`<input id="me-pin" type="password" inputmode="numeric" maxlength="8" autocomplete="off" placeholder="Il tuo PIN personale" style="border:1px solid var(--line);border-radius:8px;padding:12px;font-size:18px;background:var(--surface)"><span class="note">Il PIN te lo dà l'amministrazione. Serve una volta sola su questo telefono.</span>`}
    <div id="me-err" class="alert ko" hidden></div><button class="primary" id="me-ok">Entra</button>`;
  $("dlg").showModal();
  const go=async()=>{const n=$("me-s").value;if(!n)return;const b=$("me-ok");b.disabled=true;b.textContent="Verifico…";
    try{if(!DEMO){const t=await rpc("pul_login",{p_person:n,p_pin:$("me-pin").value.trim()});ls.set("pul-tok",t)}
      S.me=n;ls.set("pul-me",n);if(ls.get("pul-push")!==n)ls.set("pul-push",null);$("dlg").close();S.open=null;S.dirty=false;render();flushQueue()}
    catch(e){$("me-err").textContent=e.message;$("me-err").hidden=false;b.disabled=false;b.textContent="Entra"}};
  $("me-ok").onclick=go;const pi=$("me-pin");if(pi)pi.onkeydown=e=>{if(e.key==="Enter")go()};
}
$("b-me").onclick=pickMe;
$("b-guide").onclick=()=>{S.guide=!S.guide;render();scrollTo(0,0)};

/* ---------- Supabase (funzioni pul_*) ---------- */
const pin=()=>ls.get("pul-pin")||"";
async function rpc(fn,args){
  const r=await fetch(CFG.SUPABASE_URL+"/rest/v1/rpc/"+fn,{method:"POST",headers:{apikey:CFG.SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify(args||{})});
  const t=await r.text();if(!r.ok){let m=t;try{m=JSON.parse(t).message}catch(e){}throw new Error(m)}return t?JSON.parse(t):null}
const db={
  async save(t,row){if(DEMO)return;
    try{
      if(t==="multe")await rpc("pul_admin_save",{p_pin:pin(),kind:"multa",payload:{key:row.key,date:row.date,person:row.person,motivo:row.motivo,importo:row.importo,stato:row.stato}});
      else if(t==="impresa")await rpc("pul_admin_save",{p_pin:pin(),kind:"impresa_add",payload:row});
      else if(t==="config")await rpc("pul_admin_save",{p_pin:pin(),kind:"config",payload:row});
      syncTurni();
    }catch(e){toast("Non salvato: "+e.message);throw e}},
  async del(t,id){if(DEMO)return;if(t==="impresa"){await rpc("pul_admin_save",{p_pin:pin(),kind:"impresa_del",payload:{date:id}});syncTurni()}}
};
const lsj={get:k=>{try{return JSON.parse(localStorage.getItem(k)||"null")}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
function applyOrari(d){S.trainers=d.trainers||[];S.slots=(d.slots||[]).map(s=>({...s,day:Number(s.day)}));S.absences=(d.absences||[]).map(a=>({...a,allDay:a.allDay!=="FALSE"&&a.allDay!==false}))}
async function loadOrari(){
  const r=await fetch(CFG.ORARI_API,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({fn:"api_load",args:[]}),redirect:"follow",cache:"no-store"});
  const j=await r.json();if(j.ok===false)throw new Error(j.error);const d=j.data||j;
  applyOrari(d);lsj.set("pul-orari",{trainers:S.trainers,slots:S.slots,absences:S.absences,at:Date.now()});
}
function applyLoad(d){
  if(d.cfg&&d.cfg.people)S.cfg=Object.assign(S.cfg,d.cfg);
  S.impresa=d.impresa||[];S.swaps=d.swaps||[];
  const mine=(lsj.get("pul-queue")||[]);// registrazioni non ancora inviate restano visibili
  S.logs=(d.logs||[]).map(l=>({...l,ts:l.ts||"",ref:l.ref||""})).filter(l=>!mine.some(q=>q.rec.id===l.id)).concat(mine.map(q=>q.rec));
  if(d.turni){S.turniDb={};d.turni.forEach(t=>{(S.turniDb[t.date]=S.turniDb[t.date]||{})[t.role]=t.person||""})}
}
// 1) dati salvati sul telefono → schermata subito  2) dati freschi in sottofondo
function fromCache(){const d=lsj.get("pul-data"),o=lsj.get("pul-orari");if(!d)return false;applyLoad(d);if(o)applyOrari(o);reset();return true}
async function loadAll(){
  const orari=loadOrari().catch(()=>{if(!S.slots.length)toast("Orari Trainer non raggiungibili")});
  const d=await rpc("pul_load");lsj.set("pul-data",d);applyLoad(d);
  if(MODE==="admin"&&pin()){try{const a=await rpc("pul_admin_load",{p_pin:pin()});S.admin=true;S.multe=(a.multe||[]).map(m=>({...m,importo:Number(m.importo),manual:m.stato!=="da confermare"}));S.pushOn=a.push||[];loadPins()}catch(e){S.admin=false;ls.set("pul-pin",null)}}
  reset();softRender();
  await orari;reset();softRender();syncTurni();
}
// non ridisegna mentre qualcuno sta compilando una checklist
function softRender(){if(S.dirty||document.querySelector("dialog[open]")){S.pendingRender=true;return}render()}
/* ---------- coda invii (registrazione mai persa, anche senza rete) ---------- */
function queuePush(rec,take,photos){const q=(lsj.get("pul-queue")||[]).filter(x=>x.rec.id!==rec.id);q.push({rec,take:!!take,photos:photos||[]});
  try{lsj.set("pul-queue",q)}catch(e){};flushQueue(q)}
let flushing=false;
async function flushQueue(){
  if(DEMO||flushing||!tok())return;const q=lsj.get("pul-queue")||[];if(!q.length)return;flushing=true;
  const drop=id=>lsj.set("pul-queue",(lsj.get("pul-queue")||[]).filter(x=>x.rec.id!==id));
  try{for(const it of q){
      try{const r=await rpc("pul_save_log",{p_token:tok(),rec:it.rec,take:it.take,photos:it.photos});
        const l=S.logs.find(x=>x.id===it.rec.id);if(l){Object.assign(l,{id:r.id,ts:r.ts,late:r.late,person:r.person})}drop(it.rec.id)}
      catch(e){if(/solo i compiti di oggi|non valido/.test(e.message)){drop(it.rec.id);toast("Registrazione scartata: "+e.message)}
        else if(/Accesso scaduto/.test(e.message)){ls.set("pul-tok",null);toast("Inserisci di nuovo il tuo PIN: la registrazione è salvata sul telefono");pickMe();break}
        else throw e}}
    reset();softRender();syncTurni()}
  catch(e){toast("Salvato sul telefono: lo invio appena c'è rete")}
  finally{flushing=false}
}
addEventListener("online",flushQueue);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){flushQueue();if(!DEMO&&Date.now()-(S.loadedAt||0)>5*60*1000){S.loadedAt=Date.now();loadAll().catch(()=>{})}}});
// calendario dei prossimi 21 giorni su Supabase (serve all'avviso del giorno prima)
let syncT=0;function syncTurni(){if(DEMO||!S.slots.length)return;clearTimeout(syncT);syncT=setTimeout(()=>{
  const rows=[];for(let d=today();d<=addDays(today(),21);d=addDays(d,1)){const a=assign(d);if(a)["inc","chi","ape"].forEach(r=>rows.push({date:d,role:r,person:a[r]||"",imp:!!a.imp}))}
  rpc("pul_sync_turni",{rows}).catch(()=>{})},800)}
function askPin(){
  $("dlgBody").innerHTML=`<h3>Monitoraggio Pulizie</h3><p class="note" style="margin:0">PIN amministrazione pulizie.</p><input id="p-pin" type="password" inputmode="numeric" autocomplete="off" style="border:1px solid var(--line);border-radius:8px;padding:12px;font-size:18px;background:var(--surface)"><div id="p-err" class="alert ko" hidden></div><button class="primary" id="p-ok">Entra</button>`;
  $("dlg").showModal();setTimeout(()=>$("p-pin").focus(),50);
  $("p-pin").onkeydown=e=>{if(e.key==="Enter")$("p-ok").click()};
  $("p-ok").onclick=async()=>{const v=$("p-pin").value.trim();$("p-ok").disabled=true;
    try{if(await rpc("pul_admin_check",{p_pin:v})){ls.set("pul-pin",v);$("dlg").close();await loadAll();render()}else throw new Error("PIN non valido")}
    catch(e){$("p-err").textContent=e.message;$("p-err").hidden=false;$("p-ok").disabled=false}};
}

/* ---------- avviso del giorno prima (notifiche push dell'HUB) ---------- */
const b64u=s=>{const p="=".repeat((4-s.length%4)%4),b=atob((s+p).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(b,c=>c.charCodeAt(0))};
function pushState(){
  if(DEMO)return"demo";
  if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window))return/iphone|ipad/i.test(navigator.userAgent)?"ios":"no";
  if(Notification.permission==="denied")return"denied";
  return ls.get("pul-push")===S.me&&Notification.permission==="granted"?"on":"off";
}
async function enablePush(){
  try{
    const perm=await Notification.requestPermission();if(perm!=="granted")throw new Error("Permesso negato");
    const reg=await navigator.serviceWorker.getRegistration("/effestudio-hub/")||await navigator.serviceWorker.ready;
    if(!reg)throw new Error("Apri Check Pulizie dall'HUB installato");
    const key=await rpc("pul_vapid");
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(key)});
    await rpc("pul_push_sub",{p_token:tok(),p_sub:sub.toJSON()});
    ls.set("pul-push",S.me);toast("Avviso attivato 🔔");render();
  }catch(e){toast(e.message||"Notifiche non disponibili")}
}
function pushBox(){
  const st=pushState();if(st==="on"||st==="demo")return st==="demo"?`<div class="panel"><h3>🔔 Avviso del giorno prima</h3><span class="note">Alle 18:00 del giorno prima arriva una notifica se il giorno dopo sei l'incaricato.</span><button class="btn">Attiva avviso</button></div>`:`<span class="note">🔔 Avviso del giorno prima attivo su questo telefono.</span>`;
  const msg={off:"Ricevi una notifica alle 18:00 del giorno prima quando tocca a te.",denied:"Notifiche bloccate: riattivale dalle impostazioni del telefono per l'HUB.",ios:"Su iPhone: Safari → Condividi → Aggiungi a Home, poi apri l'HUB dall'icona e attiva qui.",no:"Questo browser non supporta le notifiche: installa l'HUB."}[st];
  return`<div class="panel"><h3>🔔 Avviso del giorno prima</h3><span class="note">${msg}</span>${st==="off"?'<button class="primary" id="b-push">Attiva avviso</button>':""}</div>`;
}

(async()=>{
  if(DEMO){demoData();render()}
  else{
    const cached=fromCache();if(cached)render();
    S.loadedAt=Date.now();
    try{await loadAll()}catch(e){toast(cached?"Offline: dati dell'ultima apertura":"Errore caricamento: "+e.message)}
    if(!cached)render();flushQueue();
    if(MODE==="staff"&&S.me&&!tok())setTimeout(pickMe,300);
    else if(MODE==="staff"&&tok())rpc("pul_whoami",{p_token:tok()}).then(n=>{if(!n){ls.set("pul-tok",null);pickMe()}else if(n!==S.me){S.me=n;ls.set("pul-me",n);softRender()}}).catch(()=>{});
  }
  if(MODE==="admin"&&!S.admin&&!DEMO)askPin();
  else if(!S.me&&MODE==="staff")setTimeout(pickMe,300);
})();
