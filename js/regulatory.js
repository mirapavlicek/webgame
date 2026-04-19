// ====== REGULATORY SHOCKS ======
// v0.3.0 — náhodné regulační události. "Opatrně" — max 1 událost za 3 roky,
// hráč má vždy možnost reagovat (compliance / appeal / delay).
//
// Typy událostí:
//   ctu_pricing     — ČTÚ kontrola cenové regulace. Donutí snížit ceny tarifů pro residential
//                     na ~3 roky, nebo zaplatit pokutu za nesoulad.
//   nis2_audit      — NIS2 compliance audit. Musí být eq_firewall ve všech DC +
//                     cybersec staff, jinak pokuta a poškozená reputace.
//   gdpr_breach     — GDPR incident. Pokuta závisí na počtu zákazníků; eq_backup sníží riziko.
//   spectrum_fee    — ČTÚ aukce spektra. Pokud provozuješ 5G věže, zaplatíš jednorázový poplatek.
//
// Události jsou navrženy tak, aby dávaly hráči smysluplné rozhodnutí a nebyly
// frustrující náhodné tragédie. Vždy lze reagovat, a důsledek je viditelný.

const REGULATORY_MIN_MONTHS_BETWEEN = 30; // min 2.5 roku mezi událostmi
const REGULATORY_CHANCE_M = 0.015;        // ~18 % roční šance kontroly (když kvalifikace OK)

const REGULATORY_EVENTS = {
  ctu_pricing: {
    name:'ČTÚ: Cenová regulace', icon:'🏛️',
    minYear:2010, minCustomers:500,
    description:'ČTÚ provedlo cenovou analýzu maloobchodního trhu a zjistilo, že máte dominantní postavení. Nařizuje dočasné snížení cen tarifů pro domácnosti o 15 % na 36 měsíců, nebo pokutu 1 200 000 Kč.',
    options:[
      {id:'comply', label:'Přijmout regulaci', effect:'ceny -15 % na 36 měs (residential)'},
      {id:'appeal', label:'Odvolat se (právníci)', effect:'zaplatit 300 000 Kč + 50/50 šance na úspěch'},
      {id:'fine', label:'Ignorovat & zaplatit', effect:'pokuta 1 200 000 Kč'},
    ]
  },
  nis2_audit: {
    name:'NIS2: Cybersec audit', icon:'🛡️',
    minYear:2024, minCustomers:300,
    description:'Podle směrnice NIS2 jste důležitým subjektem a musíte mít firewall v každém DC + cybersec tým. Audit je za 6 měsíců. Neúspěch = pokuta 10 mil. Kč + poškození reputace.',
    options:[
      {id:'comply', label:'Dobrovolná příprava', effect:'vyžaduje eq_firewall ve všech DC (zkontrolováno za 6 měs)'},
      {id:'consultant', label:'Najmout konzultanta', effect:'zaplatit 600 000 Kč, audit projde automaticky'},
      {id:'ignore', label:'Ignorovat', effect:'riskujete pokutu 10 mil. Kč + churn'},
    ]
  },
  gdpr_breach: {
    name:'GDPR: Datový incident', icon:'🔐',
    minYear:2018, minCustomers:200,
    description:'Unikly osobní údaje některých zákazníků (podrobnosti anonymizované). ÚOOÚ otevřel vyšetřování. Pokuta závisí na okolnostech — budete spolupracovat?',
    options:[
      {id:'cooperate', label:'Plná spolupráce', effect:'pokuta = 0.5 % roční tržby, mírný pokles sat'},
      {id:'minimize', label:'Minimalizovat škodu', effect:'zaplatit PR firmě 400 000 Kč, menší pokles sat'},
      {id:'deny', label:'Popřít rozsah', effect:'pokuta = 4 % roční tržby (max 20M €)'},
    ]
  },
  spectrum_fee: {
    name:'ČTÚ: Spektrum aukce', icon:'📡',
    minYear:2015, minCustomers:100,
    description:'ČTÚ vyhlásilo aukci spektra pro 5G/LTE. Pokud chcete pokračovat s bezdrátovými službami, je třeba zaplatit licenční poplatek. Jinak věže přestanou fungovat za 3 měsíce.',
    options:[
      {id:'bid_hi', label:'Plná licence (5G+LTE)', effect:'zaplatit 1 500 000 Kč, všechny věže OK na 10 let'},
      {id:'bid_lo', label:'Minimální (jen LTE)', effect:'zaplatit 500 000 Kč, 5G věže vypnuty'},
      {id:'skip',  label:'Nezúčastnit se', effect:'za 3 měs všechny věže offline (zákazníci odejdou)'},
    ]
  },
};

// Vyber vhodnou událost podle kontextu (rok, počet zákazníků, aktivní věže atd.)
function pickRegulatoryEvent(){
  if(!G) return null;
  const cust = G.stats?.cust || 0;
  const has5G = (G.towers||[]).some(t=>t.type&&t.type.includes('5g'));
  const candidates = [];
  for(const id in REGULATORY_EVENTS){
    const ev = REGULATORY_EVENTS[id];
    if(G.date.y < ev.minYear) continue;
    if(cust < ev.minCustomers) continue;
    // spectrum_fee jen pokud máš věže
    if(id==='spectrum_fee' && (G.towers||[]).length===0) continue;
    // Váhy — některé události jsou pravděpodobnější
    let weight = 1;
    if(id==='nis2_audit' && G.date.y>=2024) weight = 2;
    if(id==='gdpr_breach' && cust>1000) weight = 1.5;
    if(id==='spectrum_fee' && has5G) weight = 1.5;
    for(let i=0;i<weight*10;i++) candidates.push(id);
  }
  if(candidates.length===0) return null;
  return candidates[Math.floor(Math.random()*candidates.length)];
}

// Monthly check — spustit regulační událost
function regulatoryMonthlyTick(){
  if(!G) return;
  if(!G.regulatory) G.regulatory = {lastEventM: -9999, activeIssue: null, ctuPricingCap: null, nis2Deadline: null};
  const reg = G.regulatory;
  // Pokud je aktivní vyzva ("activeIssue"), čekáme na rozhodnutí hráče (nespustíme další)
  if(reg.activeIssue) return;
  // Spočítej měsíce od poslední události
  const monthsSince = (G.date.y*12+G.date.m) - (reg.lastEventM||-9999);
  if(monthsSince < REGULATORY_MIN_MONTHS_BETWEEN) {
    // Stále zpracováváme následky předchozí události
    regulatoryProcessAftermath();
    return;
  }
  if(Math.random() >= REGULATORY_CHANCE_M) {
    regulatoryProcessAftermath();
    return;
  }
  const evId = pickRegulatoryEvent();
  if(!evId) return;
  const ev = REGULATORY_EVENTS[evId];
  reg.activeIssue = {
    id: evId,
    raisedY: G.date.y, raisedM: G.date.m,
    deadlineM: 3, // 3 měsíce na rozhodnutí (jinak auto-ignore = nejhorší varianta)
  };
  reg.lastEventM = G.date.y*12+G.date.m;
  try{notify(`${ev.icon} NOVÁ REGULAČNÍ VĚC: ${ev.name} — otevři Mgmt → Regulace`,'bad');}catch(e){}
  // Zvuk alarmu či podobně může hra hrát zde
}

// Zpracovat dlouhodobé efekty (NIS2 deadline, ČTÚ cap expirace, věže offline apod.)
function regulatoryProcessAftermath(){
  if(!G || !G.regulatory) return;
  const reg = G.regulatory;
  const nowM = G.date.y*12+G.date.m;
  // NIS2 deadline
  if(reg.nis2Deadline){
    if(nowM >= reg.nis2Deadline.atM){
      // Zkontroluj firewall ve všech DC
      let missingDC = 0;
      for(const dc of G.dcs||[]){
        if(!(dc.eq||[]).includes('eq_firewall')) missingDC++;
      }
      if(missingDC>0){
        const fine = 10000000;
        G.cash -= fine;
        try{notify(`🛡️ NIS2 audit SELHAL (${missingDC} DC bez firewall): pokuta ${fmtKc(fine)}, reputace −20`,'bad');}catch(e){}
        if(G.cloudReputation!=null) G.cloudReputation = Math.max(0, G.cloudReputation - 20);
      } else {
        try{notify(`✅ NIS2 audit úspěšně dokončen`,'good');}catch(e){}
      }
      reg.nis2Deadline = null;
    }
  }
  // ČTÚ cenová regulace expirace
  if(reg.ctuPricingCap){
    if(nowM >= reg.ctuPricingCap.expiresM){
      try{notify(`📈 ČTÚ cenová regulace skončila — ceny tarifů se mohou vrátit na normál`,'good');}catch(e){}
      reg.ctuPricingCap = null;
    }
  }
  // Spektrum offline — 3 měsíce po odmítnutí
  if(reg.spectrumOfflineAt){
    if(nowM >= reg.spectrumOfflineAt){
      // Smaž věže
      const n = (G.towers||[]).length;
      if(n>0){
        G.towers = [];
        try{notify(`📡 ${n} věží vypnuto — nemáte spektrum licence. Zákazníci odcházejí.`,'bad');}catch(e){}
        if(typeof markCapDirty==='function') markCapDirty();
      }
      reg.spectrumOfflineAt = null;
    }
  }
  // Expirace aktivního issue pokud hráč ignoroval
  if(reg.activeIssue){
    const elapsed = nowM - (reg.activeIssue.raisedY*12+reg.activeIssue.raisedM);
    if(elapsed >= reg.activeIssue.deadlineM){
      // Auto-ignore
      resolveRegulatoryIssue('ignore_default');
    }
  }
}

// Aplikovat ČTÚ cenovou slevu na residential tarify (volané z calcBldRevenue hookem)
function ctuPricingMultiplier(bldType){
  if(!G || !G.regulatory || !G.regulatory.ctuPricingCap) return 1.0;
  const seg = (typeof BTYPE_TO_SEGMENT!=='undefined') ? BTYPE_TO_SEGMENT[bldType] : null;
  if(seg==='residential') return 0.85; // −15 %
  return 1.0;
}

// Hráčovo rozhodnutí
function resolveRegulatoryIssue(optionId){
  if(!G || !G.regulatory || !G.regulatory.activeIssue) return;
  const reg = G.regulatory;
  const issue = reg.activeIssue;
  const ev = REGULATORY_EVENTS[issue.id];
  if(!ev) { reg.activeIssue = null; return; }
  const nowM = G.date.y*12+G.date.m;
  // ČTÚ pricing
  if(issue.id==='ctu_pricing'){
    if(optionId==='comply'){
      reg.ctuPricingCap = {expiresM: nowM + 36};
      try{notify('🏛️ ČTÚ regulace přijata: ceny residential −15 % na 36 měs','warn');}catch(e){}
    } else if(optionId==='appeal'){
      if(G.cash<300000){ try{notify('❌ Na právníky není cash — automaticky pokuta','bad');}catch(e){} optionId='fine';}
      else {
        G.cash -= 300000;
        if(Math.random()<0.5){
          try{notify('⚖️ Odvolání úspěšné! Regulace zrušena','good');}catch(e){}
        } else {
          reg.ctuPricingCap = {expiresM: nowM + 36};
          try{notify('⚖️ Odvolání neúspěšné — regulace platí','bad');}catch(e){}
        }
      }
    }
    if(optionId==='fine' || optionId==='ignore_default'){
      G.cash -= 1200000;
      try{notify(`🏛️ Pokuta 1.2M Kč zaplacena`,'bad');}catch(e){}
    }
  }
  // NIS2
  else if(issue.id==='nis2_audit'){
    if(optionId==='comply'){
      reg.nis2Deadline = {atM: nowM + 6};
      try{notify('🛡️ NIS2 compliance: máte 6 měs na firewall ve všech DC','warn');}catch(e){}
    } else if(optionId==='consultant'){
      if(G.cash<600000){ try{notify('❌ Na konzultanta není cash — ignoruji','bad');}catch(e){} optionId='ignore';}
      else {
        G.cash -= 600000;
        try{notify('✅ NIS2 konzultant najatý — audit OK','good');}catch(e){}
      }
    }
    if(optionId==='ignore' || optionId==='ignore_default'){
      reg.nis2Deadline = {atM: nowM + 6}; // stejně musí pak projít auditem, jinak pokuta
    }
  }
  // GDPR
  else if(issue.id==='gdpr_breach'){
    const annualRev = (G.stats?.inc||0)*12;
    if(optionId==='cooperate'){
      const fine = Math.round(annualRev*0.005);
      G.cash -= fine;
      try{notify(`🔐 GDPR: spolupráce — pokuta ${fmtKc(fine)} (0.5 % roční tržby)`,'warn');}catch(e){}
      // mild sat dip — 2%
      applySatisfactionDip(2);
    } else if(optionId==='minimize'){
      if(G.cash<400000){ try{notify('❌ Na PR není cash — cooperate fallback','bad');}catch(e){} return resolveRegulatoryIssue('cooperate');}
      G.cash -= 400000;
      applySatisfactionDip(1);
      try{notify('🔐 GDPR: PR firma najata, mírný dopad na reputaci','warn');}catch(e){}
    } else if(optionId==='deny' || optionId==='ignore_default'){
      const fine = Math.round(annualRev*0.04);
      G.cash -= fine;
      applySatisfactionDip(8);
      try{notify(`🔐 GDPR: popření! Pokuta ${fmtKc(fine)} (4 % ročních tržeb)`,'bad');}catch(e){}
    }
  }
  // Spectrum
  else if(issue.id==='spectrum_fee'){
    if(optionId==='bid_hi'){
      if(G.cash<1500000){ try{notify('❌ Nemáš 1.5M Kč — default: bid_lo','bad');}catch(e){} optionId='bid_lo';}
      else {
        G.cash -= 1500000;
        try{notify('📡 Plná spektrum licence koupena','good');}catch(e){}
      }
    }
    if(optionId==='bid_lo'){
      if(G.cash<500000){ try{notify('❌ Nemáš 500k Kč — default: skip','bad');}catch(e){} optionId='skip';}
      else {
        G.cash -= 500000;
        // Vypnout 5G věže (ponechat LTE)
        const before = (G.towers||[]).length;
        G.towers = (G.towers||[]).filter(t=>!(t.type&&t.type.includes('5g')));
        const removed = before - G.towers.length;
        try{notify(`📡 LTE licence ok. ${removed} 5G věží vypnuto.`,'warn');}catch(e){}
        if(typeof markCapDirty==='function') markCapDirty();
      }
    }
    if(optionId==='skip' || optionId==='ignore_default'){
      reg.spectrumOfflineAt = nowM + 3;
      try{notify('📡 Spektrum neobnovit — za 3 měsíce všechny věže offline','bad');}catch(e){}
    }
  }
  reg.activeIssue = null;
  if(typeof updUI==='function') updUI();
}

// Plošný pokles spokojenosti (GDPR incident)
function applySatisfactionDip(percentPts){
  if(!G || !G.map) return;
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const b = G.map[y][x].bld;
    if(b && b.connected && b.sat!=null){
      b.sat = Math.max(10, b.sat - percentPts);
    }
  }
}

// ====== UI ======
function regulatoryPanelHTML(){
  if(!G) return '';
  const reg = G.regulatory || {};
  let h = `<div style="background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:8px">`;
  h += `<div style="font-weight:600;color:#e6edf3;margin-bottom:4px;font-size:10px">🏛️ Regulační stav</div>`;
  if(reg.activeIssue){
    const ev = REGULATORY_EVENTS[reg.activeIssue.id];
    if(ev){
      const elapsed = (G.date.y*12+G.date.m) - (reg.activeIssue.raisedY*12+reg.activeIssue.raisedM);
      const remaining = Math.max(0, reg.activeIssue.deadlineM - elapsed);
      h += `<div style="background:#1a0a0a;border:1px solid #f85149;border-radius:5px;padding:6px;margin-bottom:4px">`;
      h += `<div style="font-size:10px;color:#f85149;font-weight:600">${ev.icon} ${ev.name}</div>`;
      h += `<div style="font-size:9px;color:#e6edf3;margin-top:3px">${ev.description}</div>`;
      h += `<div style="font-size:9px;color:#f59e0b;margin-top:3px">⏰ Rozhodnutí do ${remaining} měs</div>`;
      h += `<div style="margin-top:5px;display:flex;flex-direction:column;gap:3px">`;
      for(const opt of ev.options){
        h += `<button onclick="resolveRegulatoryIssue('${opt.id}')" style="padding:4px 6px;background:#1a1040;border:1px solid #7c3aed;border-radius:4px;color:#a78bfa;cursor:pointer;font-size:9px;text-align:left">`;
        h += `<b>${opt.label}</b> <span style="color:#8b949e">— ${opt.effect}</span>`;
        h += `</button>`;
      }
      h += `</div></div>`;
    }
  }
  // Aktivní efekty
  const active = [];
  if(reg.ctuPricingCap) active.push(`ČTÚ cenovka (residential −15 %) do měsíce ${reg.ctuPricingCap.expiresM%12+1}/${Math.floor(reg.ctuPricingCap.expiresM/12)}`);
  if(reg.nis2Deadline) active.push(`NIS2 audit deadline: ${reg.nis2Deadline.atM%12+1}/${Math.floor(reg.nis2Deadline.atM/12)} (požaduje firewall ve všech DC)`);
  if(reg.spectrumOfflineAt) active.push(`Věže offline za ${Math.max(0, reg.spectrumOfflineAt - (G.date.y*12+G.date.m))} měs (nezaplacené spektrum)`);
  if(active.length>0){
    h += `<div style="font-size:9px;color:#f59e0b;margin-top:4px">Aktivní omezení:<ul style="margin:2px 0 0 14px;padding:0">`;
    for(const a of active) h += `<li>${a}</li>`;
    h += `</ul></div>`;
  }
  if(!reg.activeIssue && active.length===0){
    h += `<div style="font-size:9px;color:#8b949e">Žádné aktivní regulační věci. Regulátor tě zatím nechává být.</div>`;
  }
  h += `</div>`;
  return h;
}
