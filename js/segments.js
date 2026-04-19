// ====== CUSTOMER SEGMENTATION ======
// v0.3.0 — rozdělení zákazníků podle typu budovy do obchodních segmentů.
//
// Segmenty a jejich charakteristika:
//   residential   — běžná domácnost. Cenově velmi citliví, malá marže, snadno mění ISP.
//   soho          — malá firma / živnostník. Kombinace HP/firemních požadavků, stabilní.
//   smb           — střední firma. ARPU 2–3× větší, vyžaduje spolehlivost.
//   enterprise    — velký podnik. Nejvyšší ARPU, přísné SLA, dlouhý prodejní cyklus.
//   government    — státní / veřejný sektor. Platí stabilně, vyžaduje compliance.
//
// Každý segment má svůj charakter:
//   - priceSensitivity: 0..1 — jak moc cena ovlivní rozhodnutí
//   - qualitySensitivity: 0..1 — jak moc spokojenost ovlivní churn
//   - churnBaseM: základní měsíční churn (0..1) při spokojenosti ~100%
//   - arpuMult: násobek oproti tabulkové ceně tarifu (pro B2B je vyšší)
//   - slaFloor: minimum satisfaction pod kterým segment rychle odchází
//   - label, color, icon

const SEGMENTS = {
  residential: {
    label:'Domácnosti',icon:'🏠',color:'#3fb950',
    priceSensitivity:0.80, qualitySensitivity:0.20,
    churnBaseM:0.015, arpuMult:1.00, slaFloor:35,
    desc:'Cenově citliví zákazníci, nižší ARPU, ale velký objem.'
  },
  soho: {
    label:'SOHO (živnostníci)',icon:'🏪',color:'#22d3ee',
    priceSensitivity:0.60, qualitySensitivity:0.40,
    churnBaseM:0.010, arpuMult:1.35, slaFloor:50,
    desc:'Malá firma nebo OSVČ. Stabilnější, vyšší ochota platit za kvalitu.'
  },
  smb: {
    label:'SMB (střední firma)',icon:'🏬',color:'#fbbf24',
    priceSensitivity:0.35, qualitySensitivity:0.65,
    churnBaseM:0.008, arpuMult:2.20, slaFloor:60,
    desc:'10–250 zaměstnanců. Vyžaduje spolehlivost, VPN, často telefonii.'
  },
  enterprise: {
    label:'Enterprise',icon:'🏦',color:'#c084fc',
    priceSensitivity:0.15, qualitySensitivity:0.85,
    churnBaseM:0.005, arpuMult:3.50, slaFloor:72,
    desc:'Korporátní klient. Velmi vysoké ARPU, dlouhé kontrakty, nekompromisní SLA.'
  },
  government: {
    label:'Státní sektor',icon:'🏛️',color:'#e91e63',
    priceSensitivity:0.45, qualitySensitivity:0.55,
    churnBaseM:0.003, arpuMult:2.00, slaFloor:55,
    desc:'Dlouhodobé kontrakty, compliance (NIS2, GDPR), pomalý proces, ale platí včas.'
  },
};

// Mapování BTYPES → segment
const BTYPE_TO_SEGMENT = {
  house:      'residential',
  rowhouse:   'residential',
  panel:      'residential',
  skyscraper: 'smb',         // MDU mix, ale primárně vyšší poptávka, často SMB kanceláře
  shop:       'soho',
  bigcorp:    'enterprise',
  factory:    'enterprise',
  public:     'government',
};

// Získat segment podle BTYPES (vrátí 'residential' pokud neznámý)
function getBldSegment(b){
  if(!b) return 'residential';
  return BTYPE_TO_SEGMENT[b.type] || 'residential';
}

// Získat násobek ARPU na základě segmentu — používá se v calcBldRevenue
function segmentArpuMult(bldType){
  const seg = BTYPE_TO_SEGMENT[bldType];
  return (seg && SEGMENTS[seg]) ? SEGMENTS[seg].arpuMult : 1.0;
}

// Agregace: customer/revenue/count napříč mapou per segment
function getSegmentStats(){
  if(!G || !G.map) return null;
  const out = {};
  for(const segId in SEGMENTS){
    out[segId] = {customers:0, buildings:0, revenueM:0, avgSat:0, satCount:0};
  }
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const b = G.map[y][x].bld;
    if(!b || !b.connected) continue;
    const seg = getBldSegment(b);
    if(!out[seg]) continue;
    out[seg].buildings++;
    out[seg].customers += b.customers || 0;
    if(typeof calcBldRevenue==='function'){
      out[seg].revenueM += calcBldRevenue(b) || 0;
    }
    if(b.sat!=null){
      out[seg].avgSat += b.sat * (b.customers||1);
      out[seg].satCount += (b.customers||1);
    }
  }
  // Average satisfaction weighted by customers
  for(const segId in out){
    const s = out[segId];
    s.avgSat = s.satCount>0 ? s.avgSat/s.satCount : 0;
    s.arpu = s.customers>0 ? Math.round(s.revenueM/s.customers) : 0;
  }
  return out;
}

// Segmentový churn — voláno měsíčně.
// Zákazníci odcházejí pokud spokojenost v dané budově spadne pod segmentové slaFloor.
// Rychleji odchází ti segmenty s vysokou qualitySensitivity.
function segmentMonthlyChurnTick(){
  if(!G || !G.map) return;
  let totalLost = 0;
  const bySegment = {};
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const b = G.map[y][x].bld;
    if(!b || !b.connected || !b.customers) continue;
    const segId = getBldSegment(b);
    const seg = SEGMENTS[segId]; if(!seg) continue;
    const sat = b.sat || 50;
    // Základní churn + penalizace pokud pod slaFloor
    let churnRate = seg.churnBaseM;
    if(sat < seg.slaFloor){
      const deficit = (seg.slaFloor - sat) / 100;
      churnRate += deficit * seg.qualitySensitivity * 0.15;
    }
    // Enterprise ztráta je bolestivější — ztratíme celou firemní smlouvu pokud sat moc dolů
    if(segId==='enterprise' && sat<40 && Math.random()<0.08){
      totalLost += b.customers;
      bySegment[segId] = (bySegment[segId]||0) + b.customers;
      b.customers = 0;
      continue;
    }
    // Normální churn
    if(churnRate>0 && b.customers>0){
      const lost = Math.min(b.customers, Math.floor(b.customers * churnRate + Math.random()));
      if(lost>0){
        b.customers -= lost;
        totalLost += lost;
        bySegment[segId] = (bySegment[segId]||0) + lost;
      }
    }
  }
  if(totalLost > 3){
    const parts = Object.entries(bySegment).map(([sid,n])=>`${SEGMENTS[sid].icon}${n}`).join(' ');
    try{notify(`📉 Churn tento měsíc: ${totalLost} zákazníků (${parts})`,'warn');}catch(e){}
  }
}

// UI: dashboard s breakdownem zákazníků per segment
function segmentDashboardHTML(){
  const stats = getSegmentStats();
  if(!stats) return '';
  const totalCust = Object.values(stats).reduce((s,x)=>s+x.customers,0);
  const totalRev = Object.values(stats).reduce((s,x)=>s+x.revenueM,0);
  let h = `<div style="background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:8px;font-size:10px">`;
  h += `<div style="font-weight:600;color:#e6edf3;margin-bottom:6px">👥 Segmenty zákazníků</div>`;
  if(totalCust===0){
    h += `<div style="color:#484f58;font-size:9px">Žádní zákazníci</div></div>`;
    return h;
  }
  for(const segId in SEGMENTS){
    const seg = SEGMENTS[segId];
    const s = stats[segId];
    if(s.customers===0) continue;
    const pctCust = (s.customers/totalCust*100).toFixed(1);
    const pctRev = totalRev>0?(s.revenueM/totalRev*100).toFixed(1):0;
    const satClr = s.avgSat>=seg.slaFloor?'#3fb950':s.avgSat>=seg.slaFloor-15?'#f59e0b':'#f85149';
    h += `<div style="margin-bottom:5px;padding:4px 6px;background:#0a1018;border-left:3px solid ${seg.color};border-radius:3px">`;
    h += `<div style="display:flex;justify-content:space-between;align-items:center">`;
    h += `<span style="color:${seg.color};font-weight:600">${seg.icon} ${seg.label}</span>`;
    h += `<span style="font-size:9px;color:#8b949e">${s.customers} zák. (${pctCust}%)</span>`;
    h += `</div>`;
    h += `<div style="display:flex;justify-content:space-between;font-size:9px;color:#c9d1d9;margin-top:2px">`;
    h += `<span>ARPU: <b>${fmtKc(s.arpu)}</b></span>`;
    h += `<span>Tržby: <b>${fmtKc(s.revenueM)}</b> (${pctRev}%)</span>`;
    h += `<span>Sat: <b style="color:${satClr}">${s.avgSat.toFixed(0)}%</b></span>`;
    h += `</div>`;
    h += `</div>`;
  }
  h += `<div style="font-size:9px;color:#6e7681;margin-top:4px">B2B segmenty (SMB/Enterprise) mají ARPU 2–3× vyšší, ale přísnější SLA. Pokles pod práh = rychlý churn.</div>`;
  h += `</div>`;
  return h;
}
