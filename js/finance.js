// ====== FINANCIAL SYSTEM ======
// Loans, credit rating, quarterly reports, tax, inflation

// Credit rating tiers — higher rating = lower APR available
const CREDIT_TIERS=[
  {id:'AAA',min:95,apr:0.035,label:'Výjimečné'},
  {id:'AA', min:85,apr:0.045,label:'Vynikající'},
  {id:'A',  min:70,apr:0.055,label:'Dobré'},
  {id:'BBB',min:55,apr:0.07, label:'Uspokojivé'},
  {id:'BB', min:40,apr:0.09, label:'Nižší'},
  {id:'B',  min:25,apr:0.12, label:'Rizikové'},
  {id:'CCC',min:10,apr:0.16, label:'Vysoce rizikové'},
  {id:'D',  min:0, apr:0.22, label:'Junk'},
];

// Loan products available to player
const LOAN_PRODUCTS=[
  {id:'short',   name:'💵 Krátkodobý úvěr',  termMonths:12, multiplier:1.0, minAmount:50000,  maxAmount:500000,  description:'1 rok, rychlé splacení'},
  {id:'medium',  name:'💰 Střednědobý úvěr', termMonths:36, multiplier:1.15,minAmount:100000, maxAmount:2000000, description:'3 roky, mírně vyšší úrok'},
  {id:'long',    name:'🏦 Dlouhodobý úvěr',  termMonths:84, multiplier:1.3, minAmount:500000, maxAmount:10000000,description:'7 let, velké sumy'},
  {id:'emergency',name:'🚨 Nouzový úvěr',    termMonths:24, multiplier:1.9, minAmount:20000,  maxAmount:300000,  description:'Vždy schváleno, ale drahé'},
];

// Quarterly tax rate (profit-based)
const CORPORATE_TAX_RATE=0.19; // 19% CZ corporate tax
const VAT_RATE=0.21;           // VAT on services — modeled as a small haircut

// Compute credit score (0-100) from cash, profit history, debt ratio, age, rating history
function calcCreditScore(){
  if(!G)return 50;
  let score=50;
  // Cash position
  if(G.cash>2000000)score+=20;
  else if(G.cash>500000)score+=12;
  else if(G.cash>100000)score+=5;
  else if(G.cash<0)score-=25;
  else if(G.cash<-100000)score-=40;

  // Profit consistency
  if(G.stats&&G.stats.hist&&G.stats.hist.length>=3){
    const recent=G.stats.hist.slice(-6);
    let posMonths=0;
    for(const r of recent)if((r.i||0)-(r.e||0)>0)posMonths++;
    score+=(posMonths-3)*4; // ±12 range
  }

  // Debt ratio (total outstanding loans vs monthly revenue)
  const debt=(G.loans||[]).reduce((s,l)=>s+l.remaining,0);
  const monthlyRev=G.stats?.inc||1;
  const debtMonths=debt/Math.max(1,monthlyRev);
  if(debtMonths>48)score-=25;
  else if(debtMonths>24)score-=15;
  else if(debtMonths>12)score-=7;
  else if(debtMonths<3)score+=5;

  // Years in business
  const years=Math.max(0,G.date.y-2005);
  score+=Math.min(10,years);

  // Rating bonuses
  if(G.companyRating>=4)score+=5;
  if(G.companyRating===5)score+=5;

  // Recent payment defaults
  const defaults=(G.loans||[]).filter(l=>l.defaultCount>0).length;
  score-=defaults*8;

  return Math.max(0,Math.min(100,Math.round(score)));
}

function updateCreditRating(){
  const s=calcCreditScore();
  let tier=CREDIT_TIERS[CREDIT_TIERS.length-1];
  for(const t of CREDIT_TIERS)if(s>=t.min){tier=t;break;}
  G.creditRating=tier.id;
  return tier;
}

function getCreditTier(){
  return CREDIT_TIERS.find(t=>t.id===G.creditRating)||CREDIT_TIERS[3];
}

// Player takes a loan
function takeLoan(productId,amount){
  const prod=LOAN_PRODUCTS.find(p=>p.id===productId);
  if(!prod){notify('❌ Neznámý produkt úvěru!','bad');return;}
  amount=Math.max(prod.minAmount,Math.min(prod.maxAmount,Math.round(amount)));
  const tier=getCreditTier();
  // Emergency loan always approved, else must meet rating threshold
  if(productId!=='emergency'){
    const ratingIdx=CREDIT_TIERS.findIndex(t=>t.id===tier.id);
    if(productId==='long'&&ratingIdx>=5){notify('❌ Vaše úvěrové hodnocení ('+tier.id+') nestačí na dlouhodobý úvěr!','bad');return;}
    if(productId==='medium'&&ratingIdx>=6){notify('❌ Úvěrové hodnocení ('+tier.id+') nestačí!','bad');return;}
    // Check debt load
    const currentDebt=(G.loans||[]).reduce((s,l)=>s+l.remaining,0);
    const revMonth=G.stats?.inc||1;
    if(currentDebt+amount>revMonth*60){notify('❌ Banka odmítla: přílišná zadluženost!','bad');return;}
  }

  const apr=tier.apr*prod.multiplier;
  const monthlyR=apr/12;
  // Annuity formula
  const payment=monthlyR>0
    ?amount*(monthlyR*Math.pow(1+monthlyR,prod.termMonths))/(Math.pow(1+monthlyR,prod.termMonths)-1)
    :amount/prod.termMonths;
  const loan={
    id:'L'+Date.now().toString(36),
    product:productId,
    principal:amount,
    remaining:amount,
    monthlyPayment:Math.round(payment),
    apr,
    termMonths:prod.termMonths,
    remainingMonths:prod.termMonths,
    startY:G.date.y,startM:G.date.m,
    defaultCount:0,
  };
  G.loans.push(loan);
  G.cash+=amount;
  notify(`💰 Úvěr ${fmtKc(amount)} přijat — splátka ${fmtKc(loan.monthlyPayment)}/měs po ${prod.termMonths} měs`,'good');
  updateCreditRating();
  updUI();
}

// Pay loan early — remaining balance + 5% fee
function payLoanEarly(loanId){
  const l=(G.loans||[]).find(x=>x.id===loanId);
  if(!l){notify('❌ Úvěr nenalezen!','bad');return;}
  const payoff=Math.round(l.remaining*1.05);
  if(G.cash<payoff){notify('❌ Chybí peníze na předčasné splacení!','bad');return;}
  G.cash-=payoff;
  G.loans=G.loans.filter(x=>x.id!==l.id);
  notify(`✅ Úvěr ${fmtKc(l.principal)} předčasně splacen (+5% poplatek)`,'good');
  updateCreditRating();
  updUI();
}

// Monthly loan tick — deducts payment or records default
function loanMonthlyTick(){
  if(!G.loans||G.loans.length===0)return;
  let totalPaid=0,defaults=0;
  const remaining=[];
  for(const l of G.loans){
    if(G.cash>=l.monthlyPayment){
      G.cash-=l.monthlyPayment;
      totalPaid+=l.monthlyPayment;
      // Principal vs interest split (simplified: reduce by payment minus interest)
      const interest=l.remaining*l.apr/12;
      const principalPaid=Math.max(0,l.monthlyPayment-interest);
      l.remaining=Math.max(0,l.remaining-principalPaid);
      l.remainingMonths--;
      if(l.remainingMonths>0&&l.remaining>0.5)remaining.push(l);
      else notify(`✅ Úvěr ${fmtKc(l.principal)} plně splacen!`,'good');
    } else {
      // Default — add penalty 3% on remaining, rating hit
      const penalty=Math.round(l.remaining*0.03);
      l.remaining+=penalty;
      l.defaultCount=(l.defaultCount||0)+1;
      defaults++;
      notify(`⚠️ Default na úvěru! Penále +${fmtKc(penalty)}, zhoršené hodnocení`,'bad');
      remaining.push(l);
    }
  }
  G.loans=remaining;
  if(defaults>0)updateCreditRating();
}

// Quarterly report — generated at end of quarter
function generateQuarterlyReport(){
  // Include last 3 months of stats
  const recent=(G.stats.hist||[]).slice(-3);
  let qInc=0,qExp=0;
  for(const r of recent){qInc+=r.i||0;qExp+=r.e||0;}
  const qProfit=qInc-qExp;
  const tax=qProfit>0?Math.round(qProfit*CORPORATE_TAX_RATE):0;
  if(tax>0){
    if(G.cash>=tax){G.cash-=tax;notify(`📊 Čtvrtletní daň: ${fmtKc(tax)} odvedena`,'warn');}
    else{
      // Can't pay tax → penalty and rating hit
      const penalty=Math.round(tax*0.1);
      G.cash-=tax+penalty;
      notify(`⚠️ Nedostatek na daň! Pokuta ${fmtKc(penalty)}`,'bad');
      G.creditRating=getCreditTier().id; // will recalc
    }
  }
  const quarter=Math.floor(G.date.m/3)+1;
  const report={
    y:G.date.y,q:quarter,
    inc:qInc,exp:qExp,profit:qProfit,tax,
    cashEnd:G.cash,customers:G.stats.cust,
    rating:G.creditRating,
    loans:(G.loans||[]).length,loanDebt:(G.loans||[]).reduce((s,l)=>s+l.remaining,0),
  };
  G.quarterlyReports.push(report);
  if(G.quarterlyReports.length>24)G.quarterlyReports.shift();
  notify(`📊 Q${quarter}/${G.date.y}: Zisk ${fmtKc(qProfit)} · Rating ${G.creditRating}`,'good');
}

// Yearly inflation — adjusts baseline costs/revenue
function yearlyInflationTick(){
  // Czech inflation mean ~3% with variance
  const inflRate=0.02+Math.random()*0.04; // 2-6%
  G.inflation=(G.inflation||1.0)*(1+inflRate);
  // Apply light drift to tariff prices and monthly costs (flavor + pressure to raise prices)
  notify(`📈 Inflace ${(inflRate*100).toFixed(1)}% — náklady rostou`,'warn');
}

// Helper: get all loan data for UI
function getLoanSummary(){
  const total=(G.loans||[]).reduce((s,l)=>s+l.remaining,0);
  const monthlyBurden=(G.loans||[]).reduce((s,l)=>s+l.monthlyPayment,0);
  return{count:(G.loans||[]).length,total,monthlyBurden};
}

// Main finance monthly tick (called from monthUp)
function financeMonthlyTick(){
  loanMonthlyTick();
  updateCreditRating();
  // Quarterly report at end of Mar/Jun/Sep/Dec
  if(G.date.m===2||G.date.m===5||G.date.m===8||G.date.m===11){
    try{generateQuarterlyReport();}catch(e){console.error('quarterly:',e);}
  }
}

function financeYearlyTick(){
  try{yearlyInflationTick();}catch(e){console.error('inflation:',e);}
}
