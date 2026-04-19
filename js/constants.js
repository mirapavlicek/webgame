// ====== CONSTANTS ======
const TW=64,TH=32;
// MAP je záměrně `let`, protože se mění při koupi expanze mapy (viz actions.js → expandMap)
let MAP=40;
const MAP_INITIAL=40;        // výchozí velikost (pro výpočet ceny expanze jako multiplikátor)
const MAP_MAX=120;           // strop — velikost nad 120 začíná drtit rendering
const MO=['ledna','února','března','dubna','května','června','července','srpna','září','října','listopadu','prosince'];

const TECHS=[
  {name:'ADSL',speed:20,year:2000,cost:0},
  {name:'VDSL2',speed:50,year:2006,cost:180000},
  {name:'FTTH 100M',speed:100,year:2010,cost:650000},
  {name:'FTTH 1G',speed:1000,year:2014,cost:2200000},
  {name:'XGS-PON 10G',speed:10000,year:2020,cost:7500000},
  {name:'25G PON',speed:25000,year:2025,cost:18000000},
];

// Building types with BW usage behavior + customer sensitivity
const BTYPES={
  house:     {name:'Rodinný dům',clr:'#43a047',h:16,units:[1,4],pop:[2,5],demand:.60,icon:'🏠',tPref:0,growth:.02,bwRatio:.55,priceSens:.85,qualSens:.15},
  rowhouse:  {name:'Řadový dům',clr:'#66bb6a',h:18,units:[2,6],pop:[4,12],demand:.65,icon:'🏘️',tPref:0,growth:.03,bwRatio:.60,priceSens:.80,qualSens:.20},
  panel:     {name:'Panelák',clr:'#1e88e5',h:34,units:[20,80],pop:[40,200],demand:.85,icon:'🏢',tPref:1,growth:.01,bwRatio:.70,priceSens:.70,qualSens:.30},
  skyscraper:{name:'Mrakodrap',clr:'#1565c0',h:52,units:[50,200],pop:[100,500],demand:.90,icon:'🏙️',tPref:2,growth:.005,bwRatio:.80,priceSens:.50,qualSens:.50},
  shop:      {name:'Obchod',clr:'#ff9800',h:14,units:[1,3],pop:[2,8],demand:.50,icon:'🏪',tPref:0,growth:.01,bwRatio:.65,priceSens:.60,qualSens:.40},
  bigcorp:   {name:'Velká firma',clr:'#7b1fa2',h:32,units:[10,50],pop:[20,150],demand:.95,icon:'🏬',tPref:3,growth:.01,bwRatio:1.2,priceSens:.15,qualSens:.85},
  factory:   {name:'Průmysl',clr:'#6d4c41',h:22,units:[5,20],pop:[10,60],demand:.55,icon:'🏭',tPref:1,growth:.005,bwRatio:.90,priceSens:.30,qualSens:.70},
  public:    {name:'Veřejná',clr:'#e91e63',h:26,units:[5,30],pop:[10,80],demand:.80,icon:'🏫',tPref:2,growth:.01,bwRatio:.75,priceSens:.40,qualSens:.60},
};

// Specialized business tenants — buildings can spawn these demanding extra BW + revenue
const BIZ_TENANTS=[
  {id:'biz_hosting',name:'Hosting firma',icon:'🖥️',bwMbps:500,revMonth:4999,
    reqConn:['conn_fiber1g','conn_fiber10g','conn_fiber25g'],reqSvc:['eq_server'],
    types:['bigcorp','skyscraper'],chance:.08,desc:'Potřebuje veřejné IP, servery, stabilitu.'},
  {id:'biz_streaming',name:'Streamovací studio',icon:'📹',bwMbps:200,revMonth:2999,
    reqConn:['conn_fiber1g','conn_fiber10g','conn_fiber25g'],reqSvc:[],
    types:['bigcorp','skyscraper','public'],chance:.06,desc:'Živé vysílání, upload-heavy.'},
  {id:'biz_gamedev',name:'Herní studio',icon:'🎮',bwMbps:300,revMonth:3499,
    reqConn:['conn_fiber1g','conn_fiber10g','conn_fiber25g'],reqSvc:['eq_server'],
    types:['bigcorp','skyscraper'],chance:.05,desc:'Build servery, CI/CD, nízká latence.'},
  {id:'biz_bank',name:'Pobočka banky',icon:'🏦',bwMbps:100,revMonth:5999,
    reqConn:['conn_fiber100','conn_fiber1g','conn_fiber10g','conn_fiber25g'],reqSvc:['eq_firewall'],
    types:['bigcorp','skyscraper','shop'],chance:.07,desc:'Dedikovaná linka, VPN, firewall.'},
  {id:'biz_medical',name:'Lékařská ordinace',icon:'⚕️',bwMbps:80,revMonth:1999,
    reqConn:['conn_fiber100','conn_fiber1g','conn_fiber10g','conn_fiber25g'],reqSvc:[],
    types:['public','skyscraper'],chance:.08,desc:'Telemedicína, DICOM přenosy.'},
  {id:'biz_startup',name:'IT startup',icon:'🚀',bwMbps:250,revMonth:2499,
    reqConn:['conn_fiber1g','conn_fiber10g','conn_fiber25g'],reqSvc:[],
    types:['bigcorp','skyscraper','shop'],chance:.10,desc:'Cloud-heavy, potřebuje upload.'},
  {id:'biz_school',name:'Online škola',icon:'🎓',bwMbps:150,revMonth:1499,
    reqConn:['conn_fiber100','conn_fiber1g','conn_fiber10g','conn_fiber25g'],reqSvc:[],
    types:['public'],chance:.10,desc:'Videokonference, e-learning platformy.'},
  {id:'biz_isp_reseller',name:'ISP reseller',icon:'📡',bwMbps:1000,revMonth:8999,
    reqConn:['conn_fiber10g','conn_fiber25g'],reqSvc:['eq_server','eq_firewall'],
    types:['bigcorp'],chance:.03,desc:'Přeprodává konektivitu dál. Masivní BW.'},
  {id:'biz_cctv',name:'Bezpečnostní centrum',icon:'📷',bwMbps:120,revMonth:1999,
    reqConn:['conn_fiber100','conn_fiber1g','conn_fiber10g','conn_fiber25g'],reqSvc:[],
    types:['bigcorp','factory','public'],chance:.07,desc:'IP kamery, NVR storage, monitoring.'},
  {id:'biz_datacenter',name:'Firemní serverovna',icon:'🗄️',bwMbps:2000,revMonth:14999,
    reqConn:['conn_fiber10g','conn_fiber25g'],reqSvc:['eq_server','eq_firewall','eq_ups'],
    types:['bigcorp','factory'],chance:.02,desc:'Vlastní rack v budově. Extrémní BW + požadavky.'},
];

// Connection types
const CONN_T={
  conn_isdn:{name:'ISDN',cost:400,maxBW:1,icon:'☎️',minTech:0,mCost:15,reqEq:[]},
  conn_coax:{name:'Koaxiál',cost:1200,maxBW:10,icon:'📺',minTech:0,mCost:22,reqEq:[]},
  conn_adsl:{name:'ADSL',cost:2000,maxBW:20,icon:'📞',minTech:0,mCost:30,reqEq:[]},
  conn_vdsl:{name:'VDSL',cost:5000,maxBW:50,icon:'📡',minTech:1,mCost:50,reqEq:[]},
  conn_fiber100:{name:'Optika 100M',cost:12000,maxBW:100,icon:'💠',minTech:2,mCost:80,reqEq:['eq_server']},
  conn_fiber1g:{name:'Optika 1G',cost:25000,maxBW:1000,icon:'💎',minTech:3,mCost:120,reqEq:['eq_server']},
  conn_fiber10g:{name:'Optika 10G',cost:80000,maxBW:10000,icon:'⚡',minTech:4,mCost:200,reqEq:['eq_server','eq_firewall']},
  conn_fiber25g:{name:'Optika 25G',cost:200000,maxBW:25000,icon:'🔥',minTech:5,mCost:500,reqEq:['eq_server','eq_firewall','eq_backup']},
  conn_wifi:{name:'WiFi',cost:3500,maxBW:50,icon:'📶',minTech:1,mCost:40,reqEq:['eq_wifiap']},
  // Wireless / tower connections (auto-assigned by tower type)
  conn_lte:{name:'LTE',cost:0,maxBW:75,icon:'📱',minTech:1,mCost:0,reqEq:[]},
  conn_lte_a:{name:'LTE-A',cost:0,maxBW:300,icon:'📱',minTech:2,mCost:0,reqEq:[]},
  conn_5g:{name:'5G',cost:0,maxBW:2000,icon:'📶',minTech:3,mCost:0,reqEq:[]},
  conn_5g_mmw:{name:'5G mmWave',cost:0,maxBW:20000,icon:'⚡',minTech:4,mCost:0,reqEq:[]},
};

// Tariffs — share:1 = garantovaná rychlost, share:N = sdíleno 1:N (levnější, ale N lidí sdílí linku)
const DEF_TARIFFS=[
  // Nejlevnější — pro ISDN a Koax přípojky
  {name:'ISDN Mini',speed:1,price:99,active:true,minTech:0,reqEq:[],cat:'fixed',share:1,
    desc:'1 Mbps garantovaně. Vhodné pro vesnice a chaty s ISDN linkou.'},
  {name:'ISDN Mini sdíl.',speed:1,price:39,active:false,minTech:0,reqEq:[],cat:'fixed',share:10,
    desc:'1 Mbps sdíleno 10 zákazníky. Levné, ale pomalé.'},
  {name:'Koax 10',speed:10,price:229,active:false,minTech:0,reqEq:[],cat:'fixed',share:1,
    desc:'10 Mbps garantovaně přes koax. Ideální pro sídliště.'},
  {name:'Koax 10 sdíl.',speed:10,price:99,active:false,minTech:0,reqEq:[],cat:'fixed',share:10,
    desc:'10 Mbps sdíleno 1:10. Nejlevnější rychlý tarif.'},
  // Fixed line tariffs
  {name:'Start 20',speed:20,price:249,active:true,minTech:0,reqEq:[],cat:'fixed',share:1},
  {name:'Start 20 sdíl.',speed:20,price:129,active:false,minTech:0,reqEq:[],cat:'fixed',share:10,
    desc:'Start 20 sdíleno 1:10 — levnější, ale limitovaná skutečná rychlost.'},
  {name:'Basic 50',speed:50,price:349,active:true,minTech:1,reqEq:[],cat:'fixed',share:1},
  {name:'Basic 50 sdíl.',speed:50,price:179,active:false,minTech:1,reqEq:[],cat:'fixed',share:10,
    desc:'Basic 50 sdíleno 1:10.'},
  {name:'Standard 100',speed:100,price:449,active:false,minTech:2,reqEq:['eq_server'],cat:'fixed',share:1},
  {name:'Standard 100 sdíl.',speed:100,price:239,active:false,minTech:2,reqEq:['eq_server'],cat:'fixed',share:10,
    desc:'Standard 100 sdíleno 1:10.'},
  {name:'Premium 250',speed:250,price:599,active:false,minTech:2,reqEq:['eq_server'],cat:'fixed',share:1},
  {name:'Business 500',speed:500,price:899,active:false,minTech:3,reqEq:['eq_server','eq_firewall'],cat:'fixed',share:1},
  {name:'Ultra 1G',speed:1000,price:1399,active:false,minTech:3,reqEq:['eq_server','eq_firewall'],cat:'fixed',share:1},
  {name:'Enterprise 5G',speed:5000,price:4999,active:false,minTech:4,reqEq:['eq_server','eq_firewall','eq_backup'],cat:'fixed'},
  {name:'Fiber 10G',speed:10000,price:8999,active:false,minTech:4,reqEq:['eq_server','eq_firewall','eq_backup'],cat:'fixed'},
  {name:'Fiber 25G',speed:25000,price:19999,active:false,minTech:5,reqEq:['eq_server','eq_firewall','eq_backup'],cat:'fixed',
    desc:'25G PON přípojka. Absolutní špička pro korporáty.'},
  // Mobile / 5G tariffs
  {name:'LTE Základ',speed:30,price:299,active:false,minTech:1,reqEq:[],cat:'mobile',icon:'📱',
    desc:'Mobilní data přes LTE. Základní pokrytí.'},
  {name:'LTE Plus',speed:75,price:449,active:false,minTech:1,reqEq:[],cat:'mobile',icon:'📱',
    desc:'LTE-A s carrier aggregation. Rychlejší, stabilnější.'},
  {name:'5G Start',speed:300,price:599,active:false,minTech:3,reqEq:['eq_server'],cat:'mobile',icon:'📶',
    desc:'Základní 5G tarif. Střední pásmo 3.5 GHz.'},
  {name:'5G Standard',speed:700,price:899,active:false,minTech:3,reqEq:['eq_server'],cat:'mobile',icon:'📶',
    desc:'5G SA s nízkou latencí. Network slicing.'},
  {name:'5G Business',speed:1200,price:1499,active:false,minTech:3,reqEq:['eq_server','eq_firewall'],cat:'mobile',icon:'📶',
    desc:'Firemní 5G s garantovanou šířkou pásma.'},
  {name:'5G Ultra',speed:4000,price:2499,active:false,minTech:4,reqEq:['eq_server','eq_firewall'],cat:'mobile',icon:'⚡',
    desc:'5G mmWave. Extrémní rychlost v centru města.'},
  {name:'5G FWA Home',speed:500,price:699,active:false,minTech:3,reqEq:['eq_server'],cat:'fwa',icon:'🏠',
    desc:'Fixed Wireless Access — náhrada optiky pro domácnosti.'},
  {name:'5G FWA Business',speed:2000,price:1899,active:false,minTech:4,reqEq:['eq_server','eq_firewall'],cat:'fwa',icon:'🏢',
    desc:'FWA pro firmy. Gigabitová rychlost bez kabelu.'},
];

const DC_T={
  // maxCooling — kolik `eq_cooling` jednotek lze max. nainstalovat (každá dává +4 sloty).
  // Limit brání nekonečnému růstu malých DC přes cooling stacking.
  dc_small:{name:'Malé DC',cost:80000,mCost:5000,slots:4,baseBW:100,color:'#f59e0b',h:22,maxCooling:1},
  dc_medium:{name:'Střední DC',cost:250000,mCost:15000,slots:12,baseBW:1000,color:'#f97316',h:32,maxCooling:2},
  dc_large:{name:'Velké DC',cost:800000,mCost:40000,slots:32,baseBW:10000,color:'#ef4444',h:42,maxCooling:4},
};

const BW_UPGRADES=[
  {name:'+100 Mbps transit',bw:100,cost:15000,mCost:3000},
  {name:'+500 Mbps transit',bw:500,cost:50000,mCost:8000},
  {name:'+1 Gbps transit',bw:1000,cost:120000,mCost:15000},
  {name:'+10 Gbps transit',bw:10000,cost:500000,mCost:40000},
  {name:'+100 Gbps transit',bw:100000,cost:2000000,mCost:120000},
  {name:'+400 Gbps transit',bw:400000,cost:6000000,mCost:350000},
  {name:'+800 Gbps transit',bw:800000,cost:12000000,mCost:600000},
];

const EQ={
  eq_router:{name:'Router SOHO',cost:8000,mCost:300,eff:'cap',val:5,icon:'📡',connCap:5,desc:'Malý router pro začátek. 5 přípojek.'},
  eq_router_mid:{name:'Router Pro',cost:22000,mCost:700,eff:'cap',val:15,icon:'📡',connCap:15,desc:'Středový router. 15 přípojek.'},
  eq_router_big:{name:'Router Core',cost:55000,mCost:1500,eff:'cap',val:40,icon:'📡',connCap:40,desc:'Páteřní router. 40 přípojek.'},
  eq_router_edge:{name:'Edge Router',cost:120000,mCost:3500,eff:'cap',val:100,icon:'📡',connCap:100,desc:'Carrier-grade. 100 přípojek.'},
  eq_switch24:{name:'Switch 24p',cost:8000,mCost:200,eff:'ports',val:24,icon:'🔀',desc:'24 portů pro přípojky, BW uplinky a věže.'},
  eq_switch48:{name:'Switch 48p',cost:14000,mCost:350,eff:'ports',val:48,icon:'🔀',desc:'48 portů. Více přípojek, větší síť.'},
  eq_server:{name:'Server',cost:35000,mCost:800,eff:'quality',val:10,icon:'🖥️'},
  eq_firewall:{name:'Firewall Basic',cost:25000,mCost:600,eff:'security',val:15,icon:'🛡️',fwTier:1,ddosBlock:.3},
  eq_firewall_pro:{name:'Firewall Pro',cost:65000,mCost:1500,eff:'security',val:25,icon:'🛡️',fwTier:2,ddosBlock:.6},
  eq_firewall_ent:{name:'Firewall Enterprise',cost:150000,mCost:3500,eff:'security',val:40,icon:'🔰',fwTier:3,ddosBlock:.9},
  eq_ups:{name:'UPS',cost:18000,mCost:300,eff:'reliable',val:20,icon:'🔋'},
  eq_monitoring:{name:'NMS',cost:12000,mCost:400,eff:'repair',val:25,icon:'📊'},
  eq_cooling:{name:'Chlazení',cost:20000,mCost:500,eff:'cooling',val:4,icon:'❄️'},
  eq_backup:{name:'Backup',cost:40000,mCost:600,eff:'backup',val:10,icon:'💾'},
  eq_wifiap:{name:'WiFi AP Ctrl',cost:22000,mCost:450,eff:'wifi',val:30,icon:'📶'},
  eq_voip:{name:'VoIP GW',cost:28000,mCost:500,eff:'voip',val:0,icon:'📞'},
  eq_iptv:{name:'IPTV Srv',cost:55000,mCost:1200,eff:'iptv',val:0,icon:'📺'},
  eq_storage:{name:'Diskové pole',cost:65000,mCost:1500,eff:'storage',val:50,icon:'💿',storageTB:10},
  eq_storage_big:{name:'Enterprise storage',cost:180000,mCost:4000,eff:'storage',val:100,icon:'🗄️',storageTB:50},
  eq_cloudnode:{name:'Cloud uzel',cost:95000,mCost:2500,eff:'cloud',val:0,icon:'☁️',vCPU:32,ramGB:128},
  eq_cloudnode_big:{name:'Cloud cluster',cost:280000,mCost:7000,eff:'cloud',val:0,icon:'🌩️',vCPU:128,ramGB:512},
  eq_bgprouter:{name:'BGP router',cost:45000,mCost:1000,eff:'routing',val:0,icon:'🔀',bgpCap:100000,desc:'Sdílí BW mezi propojenými DC. Max 100 Gbps na router.'},
  eq_loadbalancer:{name:'Load balancer',cost:35000,mCost:800,eff:'lb',val:0,icon:'⚖️',desc:'Aktivně rozděluje provoz mezi paralelní trasy do DC podle volné kapacity. Omezuje potřebu stackování.'},
};

const CAB_T={
  cable_copper:{name:'Měděný',cost:1500,mCost:15,maxBW:100,clr:'#d97706',w:2,tier:0},
  cable_fiber:{name:'Optický 1G',cost:4000,mCost:30,maxBW:1000,clr:'#22d3ee',w:2.5,tier:1},
  cable_fiber10:{name:'Optika 10G',cost:15000,mCost:100,maxBW:10000,clr:'#06b6d4',w:3,tier:2},
  cable_backbone:{name:'Páteřní 100G',cost:40000,mCost:250,maxBW:100000,clr:'#a855f7',w:4,tier:3},
  cable_400g:{name:'Páteřní 400G',cost:120000,mCost:800,maxBW:400000,clr:'#c084fc',w:5,tier:4},
  cable_800g:{name:'Páteřní 800G',cost:300000,mCost:2000,maxBW:800000,clr:'#e879f9',w:6,tier:5},
};

const WIFI_T={
  wifi_small:{name:'WiFi AP 2.4GHz',cost:8000,mCost:200,range:3,maxBW:50,maxClients:20,icon:'📶',color:'#22d3ee'},
  wifi_medium:{name:'WiFi AP 5GHz',cost:18000,mCost:400,range:4,maxBW:300,maxClients:50,icon:'📡',color:'#06b6d4'},
  wifi_large:{name:'WiFi Sektorový',cost:35000,mCost:800,range:6,maxBW:500,maxClients:100,icon:'🗼',color:'#a855f7'},
};

// Junction / field load-balancer — placeable node on roads that forwards and actively
// distributes packets across branching cable segments. At a tile where 2+ cable
// paths meet, a junction switches routing from "proportional to static capacity"
// to "weighted by current free capacity" (active balancing).
const JUNCTION_T={
  junction_lb:{name:'Polní Load Balancer',cost:28000,mCost:350,icon:'⚖️',color:'#a78bfa',
    desc:'Aktivní rozdělovač provozu na odbočce sítě. Váží zátěž podle volné kapacity, ne jen podle max. kapacity kabelu.'},
  junction_switch:{name:'Polní přepínač',cost:12000,mCost:150,icon:'🔀',color:'#38bdf8',
    desc:'Pasivní přepínač pro rozbočení. Slouží jako anchor, ale rozděluje staticky.'},
};

const SERVICES=[
  {id:'svc_iptv',name:'IPTV televize',icon:'📺',cost:180000,mCost:8000,revPerCust:89,reqEq:['eq_server','eq_iptv'],
    desc:'Televizní služba přes internet. Domácnosti milují, firmy nezajímá.',extraBW:5,
    adopt:{house:.40,rowhouse:.45,panel:.55,skyscraper:.35,shop:.05,bigcorp:.02,factory:.01,public:.20}},
  {id:'svc_voip',name:'VoIP telefon',icon:'📞',cost:80000,mCost:3000,revPerCust:149,reqEq:['eq_server','eq_voip'],
    desc:'Internetová telefonie. Firmy a veřejné budovy hlavní zákazníci.',extraBW:1,
    adopt:{house:.15,rowhouse:.15,panel:.10,skyscraper:.25,shop:.30,bigcorp:.70,factory:.45,public:.60}},
  {id:'svc_vpn',name:'VPN služba',icon:'🔐',cost:120000,mCost:5000,revPerCust:199,reqEq:['eq_server','eq_firewall'],
    desc:'Bezpečné připojení. Firmy a korporace hlavní odběratelé.',extraBW:2,
    adopt:{house:.08,rowhouse:.08,panel:.05,skyscraper:.15,shop:.10,bigcorp:.65,factory:.40,public:.30}},
  {id:'svc_cloud',name:'Cloud úložiště',icon:'☁️',cost:250000,mCost:12000,revPerCust:129,reqEq:['eq_server','eq_backup'],
    desc:'Cloudové úložiště a zálohy. Populární u všech.',extraBW:3,
    adopt:{house:.20,rowhouse:.22,panel:.18,skyscraper:.30,shop:.15,bigcorp:.60,factory:.25,public:.40}},
  {id:'svc_hosting',name:'Web hosting',icon:'🌐',cost:150000,mCost:6000,revPerCust:299,reqEq:['eq_server','eq_ups'],
    desc:'Webový hosting a domény. Hlavně obchody a firmy.',extraBW:4,
    adopt:{house:.03,rowhouse:.03,panel:.02,skyscraper:.10,shop:.35,bigcorp:.50,factory:.15,public:.25}},
  {id:'svc_security',name:'Kyber bezpečnost',icon:'🛡️',cost:200000,mCost:10000,revPerCust:349,reqEq:['eq_server','eq_firewall','eq_monitoring'],
    desc:'Pokročilá ochrana sítě. Firmy platí nejvíc.',extraBW:1,
    adopt:{house:.05,rowhouse:.05,panel:.03,skyscraper:.20,shop:.12,bigcorp:.75,factory:.35,public:.45}},
  {id:'svc_iot',name:'IoT platforma',icon:'🔗',cost:100000,mCost:4000,revPerCust:79,reqEq:['eq_server'],
    desc:'IoT management pro chytré budovy a průmysl.',extraBW:1,
    adopt:{house:.10,rowhouse:.08,panel:.05,skyscraper:.30,shop:.05,bigcorp:.20,factory:.55,public:.15}},
  {id:'svc_gaming',name:'Gaming boost',icon:'🎮',cost:90000,mCost:5000,revPerCust:99,reqEq:['eq_server'],
    desc:'Nízká latence pro gamery. Paneláky a mrakodrapy s mladou populací.',extraBW:2,
    adopt:{house:.12,rowhouse:.15,panel:.30,skyscraper:.25,shop:.02,bigcorp:.01,factory:.01,public:.05}},
  // --- Nové B2B služby ---
  {id:'svc_dedicated',name:'Dedikovaná linka',icon:'🔗',cost:200000,mCost:8000,revPerCust:499,reqEq:['eq_server','eq_firewall','eq_bgprouter'],
    desc:'Garantovaná rychlost a SLA. Hlavně firmy a průmysl.',extraBW:10,
    adopt:{house:.01,rowhouse:.01,panel:.02,skyscraper:.15,shop:.08,bigcorp:.80,factory:.55,public:.30}},
  {id:'svc_publicip',name:'Veřejné IP adresy',icon:'🌍',cost:80000,mCost:3000,revPerCust:149,reqEq:['eq_bgprouter'],
    desc:'Statická veřejná IP. Servery, firmy, hráči.',extraBW:0,
    adopt:{house:.05,rowhouse:.05,panel:.08,skyscraper:.20,shop:.25,bigcorp:.70,factory:.40,public:.35}},
  {id:'svc_cloudvps',name:'Cloud VPS',icon:'🌩️',cost:350000,mCost:15000,revPerCust:599,reqEq:['eq_server','eq_cloudnode','eq_storage'],
    desc:'Virtuální servery v cloudu. Premium pro velké firmy.',extraBW:8,
    adopt:{house:.02,rowhouse:.02,panel:.03,skyscraper:.12,shop:.15,bigcorp:.65,factory:.30,public:.25}},
  {id:'svc_cloudstorage',name:'Cloud úložiště Pro',icon:'📦',cost:180000,mCost:8000,revPerCust:249,reqEq:['eq_server','eq_storage','eq_backup'],
    desc:'Zálohované cloudové úložiště s verzováním. Populární u firem.',extraBW:5,
    adopt:{house:.08,rowhouse:.08,panel:.06,skyscraper:.18,shop:.20,bigcorp:.55,factory:.25,public:.35}},
  {id:'svc_colocation',name:'Colocation',icon:'🏗️',cost:300000,mCost:12000,revPerCust:899,reqEq:['eq_server','eq_ups','eq_cooling','eq_bgprouter'],
    desc:'Pronájem racku v DC. Pouze velké firmy a mrakodrapy.',extraBW:15,
    adopt:{house:0,rowhouse:0,panel:0,skyscraper:.10,shop:.02,bigcorp:.50,factory:.15,public:.08}},
  {id:'svc_managed',name:'Managed services',icon:'🛠️',cost:250000,mCost:10000,revPerCust:399,reqEq:['eq_server','eq_monitoring','eq_firewall'],
    desc:'Správa IT infrastruktury pro firmy. Vysoká marže.',extraBW:3,
    adopt:{house:0,rowhouse:0,panel:.01,skyscraper:.08,shop:.12,bigcorp:.60,factory:.35,public:.20}},
  {id:'svc_cdn',name:'CDN služba',icon:'🚀',cost:400000,mCost:18000,revPerCust:199,reqEq:['eq_server','eq_cloudnode','eq_loadbalancer'],
    desc:'Content delivery network. Snižuje latenci pro všechny.',extraBW:-2,
    adopt:{house:.10,rowhouse:.10,panel:.15,skyscraper:.25,shop:.30,bigcorp:.45,factory:.10,public:.20}},
];

// IP address blocks
const IP_BLOCKS=[
  {name:'/24 blok (256 IP)',ips:256,cost:50000,mCost:2000,icon:'🌍'},
  {name:'/22 blok (1024 IP)',ips:1024,cost:150000,mCost:6000,icon:'🌐'},
  {name:'/20 blok (4096 IP)',ips:4096,cost:400000,mCost:15000,icon:'🗺️'},
  {name:'/16 blok (65536 IP)',ips:65536,cost:1500000,mCost:40000,icon:'🌏'},
];

// Cloud resource pricing (per unit per month)
// price  = co zaplatí zákazník (list price za jedno "právo" obsluhovat jeden segment typ-zákazník)
// mCost  = co to stojí ISP měsíčně (power, chlazení, SW licence, opotřebení, bandwidth peering)
//          ~18-22% z price je realistický poměr v on-prem/colo modelu
const CLOUD_PRICING={
  vps_small:{name:'VPS Small',vCPU:1,ramGB:2,storageTB:0.05,price:299,mCost:60,icon:'💻',cat:'vps',bwMbps:10},
  vps_medium:{name:'VPS Medium',vCPU:2,ramGB:4,storageTB:0.1,price:599,mCost:115,icon:'🖥️',cat:'vps',bwMbps:25},
  vps_large:{name:'VPS Large',vCPU:4,ramGB:8,storageTB:0.25,price:1199,mCost:230,icon:'🖥️',cat:'vps',bwMbps:50},
  vps_xlarge:{name:'VPS XLarge',vCPU:8,ramGB:16,storageTB:0.5,price:2399,mCost:450,icon:'⚡',cat:'vps',bwMbps:100},
  vps_gpu:{name:'GPU VPS',vCPU:8,ramGB:32,storageTB:0.5,price:5999,mCost:1900,icon:'🎮',cat:'vps',bwMbps:100,reqEq:['eq_cloudnode_big'],desc:'GPU pro AI/ML, rendering. Vyšší marže ale drahý power.'},
  k8s_small:{name:'K8s Cluster S',vCPU:4,ramGB:8,storageTB:0.1,price:1499,mCost:300,icon:'🐳',cat:'k8s',bwMbps:50,reqEq:['eq_cloudnode'],desc:'Managed Kubernetes – 3 nody'},
  k8s_large:{name:'K8s Cluster L',vCPU:16,ramGB:64,storageTB:0.5,price:5999,mCost:1250,icon:'🐳',cat:'k8s',bwMbps:200,reqEq:['eq_cloudnode_big'],desc:'Managed Kubernetes – 9 nodů'},
  dbaas_pg:{name:'PostgreSQL DB',vCPU:2,ramGB:4,storageTB:0.1,price:899,mCost:170,icon:'🗃️',cat:'db',bwMbps:15,reqEq:['eq_server'],desc:'Managed databáze s replikací'},
  dbaas_pg_ha:{name:'PostgreSQL HA',vCPU:4,ramGB:16,storageTB:0.5,price:2999,mCost:650,icon:'🗃️',cat:'db',bwMbps:30,reqEq:['eq_server','eq_backup'],desc:'HA cluster s failoverem'},
  s3_100:{name:'Object Storage 100GB',storageTB:0.1,price:49,mCost:8,icon:'📁',cat:'s3',bwMbps:5,desc:'S3-kompatibilní úložiště'},
  s3_1t:{name:'Object Storage 1TB',storageTB:1,price:349,mCost:65,icon:'📁',cat:'s3',bwMbps:20},
  s3_10t:{name:'Object Storage 10TB',storageTB:10,price:2499,mCost:520,icon:'📁',cat:'s3',bwMbps:80},
  storage_basic:{name:'Block Storage 1TB',storageTB:1,price:199,mCost:35,icon:'💿',cat:'block',bwMbps:10},
  storage_premium:{name:'Block SSD 5TB',storageTB:5,price:799,mCost:160,icon:'🗄️',cat:'block',bwMbps:30},
  storage_enterprise:{name:'Block NVMe 20TB',storageTB:20,price:2499,mCost:540,icon:'📦',cat:'block',bwMbps:80},
};

// SLA tiers for cloud products
const SLA_TIERS=[
  {id:'sla_basic',name:'Basic 99.5%',uptime:.995,priceMult:1.0,penaltyPct:0,reqEq:[],desc:'Bez garance, best-effort'},
  {id:'sla_standard',name:'Standard 99.9%',uptime:.999,priceMult:1.25,penaltyPct:.10,reqEq:['eq_ups'],desc:'3-nines, penále 10% při výpadku'},
  {id:'sla_premium',name:'Premium 99.95%',uptime:.9995,priceMult:1.5,penaltyPct:.25,reqEq:['eq_ups','eq_backup'],desc:'Vyšší dostupnost, replikace záloh'},
  {id:'sla_enterprise',name:'Enterprise 99.99%',uptime:.9999,priceMult:2.0,penaltyPct:.50,reqEq:['eq_ups','eq_backup','eq_monitoring'],desc:'4-nines, multi-DC replikace, 50% penále'},
];

// Cloud customer segments — who orders cloud services and how much
const CLOUD_SEGMENTS=[
  {id:'seg_startup',name:'Startupy',icon:'🚀',demand:{vps:.35,k8s:.10,db:.20,s3:.15,block:.05},
    growthBase:.08,churnBase:.04,priceSens:1.3,slaPref:'sla_basic',
    desc:'Cenově citliví, rychlý růst, často odcházejí'},
  {id:'seg_smb',name:'Malé firmy',icon:'🏪',demand:{vps:.25,k8s:.05,db:.25,s3:.20,block:.15},
    growthBase:.06,churnBase:.025,priceSens:1.1,slaPref:'sla_standard',
    desc:'Stabilní, preferují standard SLA'},
  {id:'seg_enterprise',name:'Korporáty',icon:'🏢',demand:{vps:.15,k8s:.25,db:.15,s3:.10,block:.10},
    growthBase:.03,churnBase:.01,priceSens:0.7,slaPref:'sla_premium',
    desc:'Nízký churn, vyžadují kvalitu a SLA'},
  {id:'seg_devops',name:'DevOps týmy',icon:'👩‍💻',demand:{vps:.10,k8s:.40,db:.15,s3:.10,block:.05},
    growthBase:.07,churnBase:.03,priceSens:1.0,slaPref:'sla_standard',
    desc:'K8s nadšenci, střední cenová citlivost'},
  {id:'seg_media',name:'Média & AI',icon:'🎬',demand:{vps:.10,k8s:.15,db:.05,s3:.30,block:.15},
    growthBase:.05,churnBase:.02,priceSens:0.8,slaPref:'sla_premium',
    desc:'Velké storage, GPU pro AI, nízká cenová citlivost'},
];

const UPGRADES=[
  // Marketing
  {id:'marketing1',name:'Online marketing',cost:30000,desc:'+20% růst zákazníků',eff:{custGrowth:.2},cat:'marketing',icon:'📢'},
  {id:'marketing2',name:'TV reklama',cost:120000,desc:'+40% růst zákazníků',eff:{custGrowth:.4},req:'marketing1',cat:'marketing',icon:'📺'},
  {id:'marketing3',name:'Sponzoring akcí',cost:250000,desc:'+60% růst zákazníků',eff:{custGrowth:.6},req:'marketing2',cat:'marketing',icon:'🏆'},
  // Podpora
  {id:'support1',name:'Help desk',cost:25000,desc:'+10 spokojenost',eff:{satBonus:10},cat:'support',icon:'📞'},
  {id:'support2',name:'24/7 podpora',cost:80000,desc:'+20 spokojenost',eff:{satBonus:20},req:'support1',cat:'support',icon:'🕐'},
  {id:'support3',name:'Premium SLA',cost:200000,desc:'+15 spokojenost firem, +příjmy',eff:{satBonus:15,slaRev:50},req:'support2',cat:'support',icon:'⭐'},
  // Značka
  {id:'brand1',name:'Branding',cost:15000,desc:'+10% poptávka',eff:{demandBoost:.1},cat:'brand',icon:'🎨'},
  {id:'brand2',name:'Věrnostní program',cost:60000,desc:'-30% odchod zákazníků',eff:{churnRed:.3},req:'brand1',cat:'brand',icon:'💎'},
  // Provoz
  {id:'auto1',name:'Automatizace',cost:60000,desc:'-15% provozní náklady',eff:{costRed:.15},cat:'ops',icon:'🤖'},
  {id:'auto2',name:'AI diagnostika',cost:180000,desc:'-40% výpadků, +opravy',eff:{outageRed:.4},req:'auto1',cat:'ops',icon:'🧠'},
  // Síť
  {id:'peering1',name:'Peering',cost:200000,desc:'Lepší konektivita, kvalita',eff:{qualBonus:15},cat:'network',icon:'🔗'},
  {id:'wholesale1',name:'Velkoobchod BW',cost:150000,desc:'-20% náklady na BW',eff:{bwCostRed:.2},req:'peering1',cat:'network',icon:'📦'},
  {id:'cdncache1',name:'CDN Cache',cost:300000,desc:'-25% BW spotřeba',eff:{bwSave:.25},req:'peering1',cat:'network',icon:'💨'},
  // Expanze
  {id:'expansion1',name:'Regionální licence',cost:500000,desc:'Připojení více budov na DC',eff:{dcCapBoost:.5},cat:'expansion',icon:'📄'},
  {id:'expansion2',name:'Městské partnerství',cost:800000,desc:'+poptávka veřejných budov',eff:{publicDemand:.4},req:'expansion1',cat:'expansion',icon:'🏛️'},
];

const OUTAGE_CAUSES=['Výpadek elektřiny','Selhání hardwaru','Porucha chlazení','Síťový útok'];

// 5G/LTE towers (placed on roads like WiFi but much bigger range)
const TOWER_T={
  // === LTE / 4G ===
  tower_lte:{name:'LTE 800MHz',cost:55000,mCost:1800,range:10,maxBW:75,maxClients:120,icon:'📡',color:'#f59e0b',minTech:1,
    band:'800MHz',gen:'4G',desc:'Široký dosah, nízká rychlost. Vhodné na předměstí.'},
  tower_lte_a:{name:'LTE-A 1800MHz',cost:95000,mCost:3200,range:7,maxBW:300,maxClients:250,icon:'📡',color:'#eab308',minTech:2,
    band:'1800MHz',gen:'4G+',desc:'Carrier aggregation — vyšší rychlost, menší dosah.'},
  // === 5G NSA (Non-Standalone, needs LTE anchor) ===
  tower_5g_nsa:{name:'5G NSA 3.5GHz',cost:180000,mCost:6000,range:5,maxBW:1200,maxClients:400,icon:'🗼',color:'#ef4444',minTech:3,
    band:'3.5GHz (n78)',gen:'5G NSA',desc:'Střední pásmo, dobrý poměr dosah/rychlost. Vyžaduje LTE kotvu.',reqAnchor:'4G'},
  // === 5G SA (Standalone) ===
  tower_5g_sa:{name:'5G SA 3.5GHz',cost:280000,mCost:9000,range:5,maxBW:2000,maxClients:600,icon:'🗼',color:'#dc2626',minTech:3,
    band:'3.5GHz (n78)',gen:'5G SA',desc:'Plně autonomní 5G. Nízká latence, network slicing.'},
  tower_5g_700:{name:'5G 700MHz',cost:220000,mCost:7000,range:12,maxBW:500,maxClients:800,icon:'🗼',color:'#f97316',minTech:3,
    band:'700MHz (n28)',gen:'5G',desc:'Široký dosah pro venkov. Nižší rychlost, ale masivní pokrytí.'},
  // === 5G Small Cell (ultra-dense) ===
  tower_5g_small:{name:'5G Small Cell',cost:85000,mCost:3500,range:2,maxBW:1500,maxClients:200,icon:'📶',color:'#10b981',minTech:3,
    band:'3.7GHz (n77)',gen:'5G SC',desc:'Mikro buňka na lampy/budovy. Malý dosah, ale obrovská hustota. Levné nasazení.',small:true},
  tower_5g_dense:{name:'5G DAS Indoor',cost:150000,mCost:5500,range:1,maxBW:3000,maxClients:500,icon:'📶',color:'#059669',minTech:3,
    band:'3.5GHz (n78)',gen:'5G DAS',desc:'Distributed Antenna System pro budovy, stadiony, metro. 1 dlaždice, 500 klientů.',small:true},
  // === 5G Sektorový (massive MIMO, 3×3 oblast, obrovská kapacita) ===
  tower_5g_sector:{name:'5G Sektor 64T64R',cost:420000,mCost:14000,range:3,maxBW:4000,maxClients:1000,icon:'📡',color:'#0ea5e9',minTech:3,
    band:'3.5GHz (n78)',gen:'5G mMIMO',desc:'Massive MIMO 64×64. Pokryje 3×3 dlaždic s kapacitou 1000 klientů. Ideální pro sídliště.',sector:true},
  tower_5g_sector_plus:{name:'5G Sektor 128T128R',cost:680000,mCost:22000,range:4,maxBW:8000,maxClients:1500,icon:'📡',color:'#0284c7',minTech:4,
    band:'3.5GHz (n78)',gen:'5G mMIMO+',desc:'Massive MIMO 128×128 s beamforming. 4 dlaždice dosah, 1500 klientů. Prémiové řešení pro města.',sector:true},
  // === 5G mmWave ===
  tower_5g_mmw:{name:'5G mmWave 26GHz',cost:350000,mCost:12000,range:2,maxBW:8000,maxClients:300,icon:'⚡',color:'#a855f7',minTech:4,
    band:'26GHz (n258)',gen:'5G mmW',desc:'Ultra-rychlé, ale velmi krátký dosah. Ideální pro centra/stadiony.'},
  tower_5g_mmw60:{name:'5G mmWave 60GHz',cost:450000,mCost:15000,range:1,maxBW:20000,maxClients:150,icon:'⚡',color:'#7c3aed',minTech:5,
    band:'60GHz (n259)',gen:'5G mmW+',desc:'Extrémní rychlost pro FWA. Dosah jen 1 dlaždice, vyžaduje přímou viditelnost.'},
};

// Employee types
const STAFF_T={
  tech:{name:'Technik',cost:35000,icon:'🔧',desc:'Opravuje výpadky rychleji, -20% doba výpadku',eff:'repair'},
  support:{name:'Support agent',cost:28000,icon:'🎧',desc:'+5 spokojenost, lepší zákaznická podpora',eff:'support'},
  sales:{name:'Obchodník',cost:40000,icon:'💼',desc:'+15% růst zákazníků',eff:'sales'},
  noc:{name:'NOC operátor',cost:45000,icon:'📊',desc:'Prevence výpadků +25%, monitoring',eff:'noc'},
  dev:{name:'Vývojář',cost:55000,icon:'💻',desc:'Automatizace, lepší služby +sat',eff:'dev'},
};

// IXP Peering exchange
const IXP={name:'NIX.CZ Peering',cost:500000,mCost:15000,bwBonus:2000,latencyBonus:20,qualBonus:.12};

// Dark fiber leasing
const DARK_FIBER={costPerSeg:2000,revenuePerSeg:800}; // monthly revenue for unused fiber

// Achievements
const ACHIEVEMENTS=[
  {id:'ach_first_dc',name:'První datovka',desc:'Postav první DC',icon:'🏢',check:g=>g.dcs.length>=1},
  {id:'ach_first_conn',name:'Online!',desc:'Připoj prvního zákazníka',icon:'🔌',check:g=>{for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=g.map[y][x].bld;if(b&&b.customers>0)return true;}return false;}},
  {id:'ach_100cust',name:'Stovka',desc:'Dosáhni 100 zákazníků',icon:'💯',check:g=>g.stats.cust>=100},
  {id:'ach_500cust',name:'Půl tisíce',desc:'Dosáhni 500 zákazníků',icon:'🎯',check:g=>g.stats.cust>=500},
  {id:'ach_1000cust',name:'Tisícovka',desc:'Dosáhni 1000 zákazníků',icon:'🏆',check:g=>g.stats.cust>=1000},
  {id:'ach_profit',name:'V zisku!',desc:'Měsíční zisk nad 0',icon:'💰',check:g=>g.stats.inc-g.stats.exp>0},
  {id:'ach_bigprofit',name:'Korporát',desc:'Měsíční zisk nad 500k',icon:'🤑',check:g=>g.stats.inc-g.stats.exp>500000},
  {id:'ach_millionaire',name:'Milionář',desc:'Hotovost nad 1M Kč',icon:'💎',check:g=>g.cash>1000000},
  {id:'ach_10m',name:'Magnát',desc:'Hotovost nad 10M Kč',icon:'👑',check:g=>g.cash>10000000},
  {id:'ach_fiber',name:'Fiberman',desc:'Polož 50+ optických kabelů',icon:'💠',check:g=>g.cables.filter(c=>c.t.includes('fiber')).length>=50},
  {id:'ach_allsvc',name:'Plný servis',desc:'Aktivuj všechny základní služby',icon:'📦',check:g=>(g.services||[]).length>=8},
  {id:'ach_5star',name:'5 hvězd',desc:'Průměrná spokojenost nad 90%',icon:'⭐',check:g=>{let s=0,n=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=g.map[y][x].bld;if(b&&b.connected){s+=b.sat;n++;}}return n>10&&s/n>90;}},
  {id:'ach_cloud',name:'Cloud provider',desc:'Provozuj 10+ cloud instancí',icon:'☁️',check:g=>(g.cloudInstances||[]).reduce((s,c)=>s+c.count,0)>=10},
  {id:'ach_survive',name:'Přeživší',desc:'Přežij výpadek bez ztráty zákazníků',icon:'🛡️',check:g=>(g.survivedOutage||false)},
  {id:'ach_tower',name:'Mobilní operátor',desc:'Postav první 5G vysílač',icon:'🗼',check:g=>(g.towers||[]).some(t=>t.type.includes('5g'))},
  {id:'ach_ixp',name:'Peering master',desc:'Připoj se k IXP',icon:'🔗',check:g=>(g.hasIXP||false)},
];

// Contracts/Missions
const CONTRACTS=[
  // ===== EARLY GAME =====
  {id:'ct_first10',name:'První zákazníci',desc:'Získej prvních 10 zákazníků',reward:30000,icon:'👋',cat:'early',
    check:g=>g.stats.cust>=10,months:6},
  {id:'ct_firstdc',name:'Síťový základ',desc:'Postav DC a připoj 3 budovy',reward:50000,icon:'🏗️',cat:'early',
    check:g=>{let n=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=g.map[y][x].bld;if(b&&b.connected)n++;}return g.dcs.length>0&&n>=3;},months:6},
  {id:'ct_hospital',name:'Nemocnice online',desc:'Připoj 3 veřejné budovy',reward:150000,icon:'🏥',cat:'early',
    check:g=>{let n=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=g.map[y][x].bld;if(b&&b.type==='public'&&b.connected)n++;}return n>=3;},months:6},
  {id:'ct_shops',name:'Obchodní čtvrť',desc:'Připoj 5 obchodů',reward:80000,icon:'🏪',cat:'early',
    check:g=>{let n=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=g.map[y][x].bld;if(b&&b.type==='shop'&&b.connected)n++;}return n>=5;},months:8},
  {id:'ct_houses20',name:'Rodinné sídliště',desc:'Připoj 10 rodinných domů',reward:60000,icon:'🏠',cat:'early',
    check:g=>{let n=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=g.map[y][x].bld;if(b&&b.type==='house'&&b.connected)n++;}return n>=10;},months:8},

  // ===== GROWTH =====
  {id:'ct_panel100',name:'Panelákový internet',desc:'100 zákazníků v panelácích',reward:100000,icon:'🏢',cat:'growth',
    check:g=>{let n=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=g.map[y][x].bld;if(b&&b.type==='panel'&&b.connected)n+=b.customers;}return n>=100;},months:12},
  {id:'ct_cust200',name:'200 klubu',desc:'Dosáhni 200 zákazníků',reward:120000,icon:'📈',cat:'growth',
    check:g=>g.stats.cust>=200,months:12},
  {id:'ct_cust500',name:'Půl tisícovky',desc:'500 zákazníků celkem',reward:250000,icon:'🎯',cat:'growth',
    check:g=>g.stats.cust>=500,months:18},
  {id:'ct_business',name:'Firemní síť',desc:'Připoj 5 velkých firem',reward:200000,icon:'🏬',cat:'growth',
    check:g=>{let n=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=g.map[y][x].bld;if(b&&b.type==='bigcorp'&&b.connected)n++;}return n>=5;},months:12},
  {id:'ct_factory',name:'Průmyslové připojení',desc:'Připoj 3 průmyslové budovy',reward:120000,icon:'🏭',cat:'growth',
    check:g=>{let n=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=g.map[y][x].bld;if(b&&b.type==='factory'&&b.connected)n++;}return n>=3;},months:10},

  // ===== TECHNOLOGY =====
  {id:'ct_speed',name:'Gigabitové město',desc:'1 Gbps tarif s 50+ zákazníky',reward:300000,icon:'⚡',cat:'tech',
    check:g=>{for(let ti=0;ti<g.tariffs.length;ti++){const t=g.tariffs[ti];if(t.active&&t.speed>=1000){let c=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=g.map[y][x].bld;if(b&&b.tariffDist&&b.tariffDist[ti])c+=b.tariffDist[ti];}if(c>=50)return true;}}return false;},months:18},
  {id:'ct_fiber50',name:'Optická revoluce',desc:'50 budov s optickou přípojkou',reward:350000,icon:'💎',cat:'tech',
    check:g=>{let n=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=g.map[y][x].bld;if(b&&b.connected&&b.connType&&b.connType.includes('fiber'))n++;}return n>=50;},months:18},
  {id:'ct_10g5',name:'10G klub',desc:'5 budov s 10G přípojkou',reward:500000,icon:'🔥',cat:'tech',
    check:g=>{let n=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=g.map[y][x].bld;if(b&&b.connected&&(b.connType==='conn_fiber10g'||b.connType==='conn_fiber25g'))n++;}return n>=5;},months:18},
  {id:'ct_tower5g',name:'5G pokrytí',desc:'Postav 3 věže 5G',reward:400000,icon:'📶',cat:'tech',
    check:g=>(g.towers||[]).filter(t=>t.type&&t.type.includes('5g')).length>=3,months:12},
  {id:'ct_sector',name:'Massive MIMO',desc:'Postav sektorový vysílač',reward:300000,icon:'📡',cat:'tech',
    check:g=>(g.towers||[]).some(t=>TOWER_T[t.type]&&TOWER_T[t.type].sector),months:12},

  // ===== INFRASTRUCTURE =====
  {id:'ct_dc2',name:'Redundance',desc:'Vlastni 2 datová centra',reward:200000,icon:'🏢',cat:'infra',
    check:g=>g.dcs.length>=2,months:18},
  {id:'ct_dc3',name:'Síťový triumvirát',desc:'Vlastni 3 datová centra',reward:500000,icon:'🏗️',cat:'infra',
    check:g=>g.dcs.length>=3,months:24},
  {id:'ct_bgp',name:'BGP peering',desc:'Vytvoř BGP peering mezi 2 DC',reward:250000,icon:'🔀',cat:'infra',
    check:g=>(g.bgpPeerings||[]).filter(p=>p.active).length>=1,months:12},
  {id:'ct_backbone',name:'Páteřní síť',desc:'Polož 10 segmentů páteřního kabelu (100G+)',reward:350000,icon:'🌐',cat:'infra',
    check:g=>g.cables.filter(c=>CAB_T[c.t]&&CAB_T[c.t].tier>=3).length>=10,months:18},
  {id:'ct_ixp',name:'IXP připojení',desc:'Připoj se k IXP',reward:400000,icon:'🌍',cat:'infra',
    check:g=>g.hasIXP===true,months:24},

  // ===== QUALITY =====
  {id:'ct_coverage',name:'Plné pokrytí',desc:'Pokrytí nad 70%',reward:250000,icon:'📡',cat:'quality',
    check:g=>{let t=0,c=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=g.map[y][x].bld;if(b){t++;if(b.connected)c++;}}return t>0&&c/t>.7;},months:24},
  {id:'ct_coverage90',name:'Téměř všude',desc:'Pokrytí nad 90%',reward:600000,icon:'🗺️',cat:'quality',
    check:g=>{let t=0,c=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=g.map[y][x].bld;if(b){t++;if(b.connected)c++;}}return t>0&&c/t>.9;},months:30},
  {id:'ct_sat90',name:'Spokojené město',desc:'Průměrná spokojenost nad 85%',reward:200000,icon:'😊',cat:'quality',
    check:g=>{let s=0,n=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=g.map[y][x].bld;if(b&&b.connected){s+=b.sat;n++;}}return n>20&&s/n>85;},months:12},
  {id:'ct_sat95',name:'Excelentní služby',desc:'Průměrná spokojenost nad 93%',reward:450000,icon:'🌟',cat:'quality',
    check:g=>{let s=0,n=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=g.map[y][x].bld;if(b&&b.connected){s+=b.sat;n++;}}return n>50&&s/n>93;},months:18},

  // ===== CLOUD / SERVICES =====
  {id:'ct_cloud10',name:'Cloud provider',desc:'10 cloudových zákazníků',reward:200000,icon:'☁️',cat:'cloud',
    check:g=>{let total=0;for(const seg in(g.cloudCustomers||{}))total+=(g.cloudCustomers[seg].count||0);return total>=10;},months:12},
  {id:'ct_cloud50',name:'Cloud boom',desc:'50 cloudových zákazníků',reward:500000,icon:'🌩️',cat:'cloud',
    check:g=>{let total=0;for(const seg in(g.cloudCustomers||{}))total+=(g.cloudCustomers[seg].count||0);return total>=50;},months:18},
  {id:'ct_svc3',name:'Multi-service',desc:'Aktivuj 3 různé služby',reward:180000,icon:'📺',cat:'cloud',
    check:g=>(g.services||[]).length>=3,months:12},
  {id:'ct_svc_all',name:'Full stack',desc:'Aktivuj všech 8+ služeb',reward:600000,icon:'🛠️',cat:'cloud',
    check:g=>(g.services||[]).length>=8,months:24},
  {id:'ct_sla_ent',name:'Enterprise SLA',desc:'Nastav Enterprise 99.99% SLA',reward:350000,icon:'📋',cat:'cloud',
    check:g=>g.cloudSLA==='sla_enterprise',months:12},

  // ===== REVENUE / ENDGAME =====
  {id:'ct_rev500k',name:'Půl milionu měsíčně',desc:'Měsíční příjem 500 000 Kč',reward:300000,icon:'💰',cat:'revenue',
    check:g=>g.stats.inc>=500000,months:18},
  {id:'ct_rev2m',name:'Dva miliony',desc:'Měsíční příjem 2 000 000 Kč',reward:800000,icon:'💎',cat:'revenue',
    check:g=>g.stats.inc>=2000000,months:24},
  {id:'ct_rev5m',name:'Pětimilionář',desc:'Měsíční příjem 5 000 000 Kč',reward:2000000,icon:'🏆',cat:'revenue',
    check:g=>g.stats.inc>=5000000,months:30},
  {id:'ct_cust1000',name:'Tisícovka',desc:'1000 zákazníků celkem',reward:500000,icon:'🎉',cat:'revenue',
    check:g=>g.stats.cust>=1000,months:24},
  {id:'ct_cust5000',name:'Mega ISP',desc:'5000 zákazníků celkem',reward:2000000,icon:'🚀',cat:'revenue',
    check:g=>g.stats.cust>=5000,months:36},
  {id:'ct_ipo',name:'Na burze!',desc:'Proveď IPO',reward:1000000,icon:'📈',cat:'revenue',
    check:g=>g.ipoCompleted===true,months:36},
  {id:'ct_rating5',name:'Pětihvězdičkový ISP',desc:'Dosáhni hodnocení 5 hvězd',reward:400000,icon:'⭐',cat:'revenue',
    check:g=>g.companyRating>=5,months:24},
];

// Contract categories for UI grouping
const CONTRACT_CATS={
  early:{name:'🌱 Start',color:'#3fb950'},
  growth:{name:'📈 Růst',color:'#f59e0b'},
  tech:{name:'⚡ Technologie',color:'#22d3ee'},
  infra:{name:'🏗️ Infrastruktura',color:'#a78bfa'},
  quality:{name:'⭐ Kvalita',color:'#e879f9'},
  cloud:{name:'☁️ Cloud & Služby',color:'#06b6d4'},
  revenue:{name:'💰 Byznys',color:'#f85149'},
  generated:{name:'📋 Zakázky',color:'#f59e0b'},
};

// Procedural contract templates
const CONTRACT_TEMPLATES=[
  {prefix:'Připojení',gen:(g)=>{
    const types=[['house','rodinných domů','🏠'],['panel','paneláků','🏢'],['shop','obchodů','🏪'],['bigcorp','firem','🏬'],['factory','továren','🏭'],['public','veřejných budov','🏫']];
    const[bt,label,icon]=types[Math.floor(Math.random()*types.length)];
    const n=5+Math.floor(Math.random()*15);
    const reward=n*15000+Math.floor(Math.random()*50000);
    return{name:`Připoj ${n} ${label}`,desc:`Připoj ${n} budov typu ${label}`,reward,icon,months:8+Math.floor(n/5)*2,
      checkStr:`let n=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=G.map[y][x].bld;if(b&&b.type==='${bt}'&&b.connected)n++;}return n>=${n};`,targetN:n,targetType:bt};}},
  {prefix:'Zákazníci',gen:(g)=>{
    const base=Math.max(50,g.stats.cust);
    const target=Math.round((base*1.3+Math.random()*base*.5)/10)*10;
    const reward=target*300+Math.floor(Math.random()*100000);
    return{name:`${target} zákazníků`,desc:`Dosáhni ${target} zákazníků celkem`,reward,icon:'👥',months:12+Math.floor(target/200)*2,
      checkStr:`return G.stats.cust>=${target};`,targetN:target};}},
  {prefix:'Spokojenost',gen:(g)=>{
    const minSat=75+Math.floor(Math.random()*18);
    const minBuildings=20+Math.floor(Math.random()*30);
    const reward=minSat*3000+minBuildings*1000;
    return{name:`Spokojenost ${minSat}%`,desc:`Průměrná spokojenost nad ${minSat}% (min ${minBuildings} budov)`,reward,icon:'😊',months:12,
      checkStr:`let s=0,n=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=G.map[y][x].bld;if(b&&b.connected){s+=b.sat;n++;}}return n>=${minBuildings}&&s/n>=${minSat};`,targetN:minSat};}},
  {prefix:'Rychlost',gen:(g)=>{
    const speeds=[100,250,500,1000,5000,10000];
    const speed=speeds[Math.min(speeds.length-1,Math.floor(Math.random()*speeds.length))];
    const custN=10+Math.floor(Math.random()*40);
    const reward=speed*50+custN*5000;
    return{name:`${speed>=1000?speed/1000+'G':speed+'M'} pro ${custN}`,desc:`Tarif ${speed} Mbps s ${custN}+ zákazníky`,reward,icon:'⚡',months:14,
      checkStr:`for(let ti=0;ti<G.tariffs.length;ti++){const t=G.tariffs[ti];if(t.active&&t.speed>=${speed}){let c=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=G.map[y][x].bld;if(b&&b.tariffDist&&b.tariffDist[ti])c+=b.tariffDist[ti];}if(c>=${custN})return true;}}return false;`,targetN:custN};}},
  {prefix:'Pokrytí',gen:(g)=>{
    const pct=50+Math.floor(Math.random()*40);
    const reward=pct*5000;
    return{name:`${pct}% pokrytí`,desc:`Pokrytí budov nad ${pct}%`,reward,icon:'📡',months:12+Math.floor(pct/20)*3,
      checkStr:`let t=0,c=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=G.map[y][x].bld;if(b){t++;if(b.connected)c++;}}return t>0&&c/t>=${pct/100};`,targetN:pct};}},
  {prefix:'Revenue',gen:(g)=>{
    const base=Math.max(100000,g.stats.inc);
    const target=Math.round((base*1.5+Math.random()*base)/10000)*10000;
    const reward=Math.round(target*.4);
    return{name:`Příjem ${fmtKc(target)}/m`,desc:`Měsíční příjem alespoň ${fmtKc(target)}`,reward,icon:'💰',months:14,
      checkStr:`return G.stats.inc>=${target};`,targetN:target};}},
  {prefix:'Cloud',gen:(g)=>{
    const n=5+Math.floor(Math.random()*30);
    const reward=n*20000;
    return{name:`${n} cloud klientů`,desc:`Získej ${n} cloudových zákazníků`,reward,icon:'☁️',months:14,
      checkStr:`let t=0;for(const s in(G.cloudCustomers||{}))t+=(G.cloudCustomers[s].count||0);return t>=${n};`,targetN:n};}},
  {prefix:'Věže',gen:(g)=>{
    const n=2+Math.floor(Math.random()*6);
    const reward=n*80000;
    return{name:`${n} vysílačů`,desc:`Postav alespoň ${n} LTE/5G věží`,reward,icon:'📡',months:12,
      checkStr:`return(G.towers||[]).length>=${n};`,targetN:n};}},
];

// ====== BINDING CONTRACTS (opravdové kontrakty s penále) ======
// Rozdíl proti CONTRACTS/CONTRACT_TEMPLATES (odměny za dosažení):
//  - Mají klienta (B2B dojem)
//  - Vyšší odměnu (protože nesou riziko)
//  - Kratší deadline
//  - Povinné PENÁLE ≥75 % odměny při nesplnění v termínu
const BINDING_CLIENTS=[
  {name:'Moravia Bank',icon:'🏦',sector:'finance'},
  {name:'ČEZ Energetika',icon:'⚡',sector:'utility'},
  {name:'Magistrát města',icon:'🏛️',sector:'gov'},
  {name:'Škoda Industries',icon:'🏭',sector:'industry'},
  {name:'Pražský Developer s.r.o.',icon:'🏗️',sector:'realestate'},
  {name:'Net2Cloud a.s.',icon:'☁️',sector:'cloud'},
  {name:'Masaryk Univerzita',icon:'🎓',sector:'edu'},
  {name:'Nemocnice Motol',icon:'🏥',sector:'health'},
  {name:'Letiště Václava Havla',icon:'✈️',sector:'transport'},
  {name:'Kauf­land ČR',icon:'🛒',sector:'retail'},
  {name:'Red Bull Arena',icon:'🏟️',sector:'event'},
  {name:'Česká televize',icon:'📺',sector:'media'},
  {name:'Policie ČR',icon:'🚔',sector:'gov'},
  {name:'OKD Horníci',icon:'⛏️',sector:'industry'},
];

// Šablony opravdových kontraktů (generátor)
// Každá vrací: {name, client, icon, desc, reward, penalty, months, checkStr, targetN, type}
const BINDING_TEMPLATES=[
  // Enterprise optická přípojka
  {key:'enterprise_fiber',gen:(g,client)=>{
    const n=3+Math.floor(Math.random()*8);
    const reward=n*180000+Math.floor(Math.random()*200000);
    const penaltyMult=0.75+Math.random()*0.5;
    const months=6+Math.floor(n/2);
    return{name:`${n}× optická přípojka`,client:client.name,clientIcon:client.icon,
      icon:'💎',desc:`${client.name}: ${n} budov s optickou přípojkou (fiber) do ${months} měsíců.`,
      reward,penalty:Math.round(reward*penaltyMult),months,targetN:n,
      checkStr:`let n=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=G.map[y][x].bld;if(b&&b.connected&&b.connType&&b.connType.includes('fiber'))n++;}return n>=${n};`};
  }},
  // Gigabit business klienti
  {key:'gigabit_business',gen:(g,client)=>{
    const n=8+Math.floor(Math.random()*20);
    const reward=n*28000+150000;
    const penaltyMult=0.80+Math.random()*0.4;
    const months=8+Math.floor(n/8);
    return{name:`Gigabit pro ${n} klientů`,client:client.name,clientIcon:client.icon,
      icon:'⚡',desc:`${client.name}: ${n}+ zákazníků na tarifu ≥1 Gbps do ${months} měs.`,
      reward,penalty:Math.round(reward*penaltyMult),months,targetN:n,
      checkStr:`for(let ti=0;ti<G.tariffs.length;ti++){const t=G.tariffs[ti];if(t.active&&t.speed>=1000){let c=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=G.map[y][x].bld;if(b&&b.tariffDist&&b.tariffDist[ti])c+=b.tariffDist[ti];}if(c>=${n})return true;}}return false;`};
  }},
  // Komunální tendr — veřejné budovy
  {key:'municipal_tender',gen:(g,client)=>{
    const n=4+Math.floor(Math.random()*8);
    const reward=n*120000+200000;
    const penaltyMult=1.0+Math.random()*0.3; // obec to bere vážně
    const months=10+Math.floor(n/2);
    return{name:`Tendr ${n} veřejných budov`,client:client.name,clientIcon:client.icon,
      icon:'🏫',desc:`${client.name}: Připoj ${n} veřejných budov do ${months} měs. Penalizace v zadávacích podmínkách!`,
      reward,penalty:Math.round(reward*penaltyMult),months,targetN:n,
      checkStr:`let n=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=G.map[y][x].bld;if(b&&b.type==='public'&&b.connected)n++;}return n>=${n};`};
  }},
  // Industriální zakázka — továrny
  {key:'industrial',gen:(g,client)=>{
    const n=2+Math.floor(Math.random()*4);
    const reward=n*180000+100000;
    const penaltyMult=0.75+Math.random()*0.35;
    const months=6+n*2;
    return{name:`Průmyslové připojení ${n}×`,client:client.name,clientIcon:client.icon,
      icon:'🏭',desc:`${client.name}: ${n} továren připojených do ${months} měs.`,
      reward,penalty:Math.round(reward*penaltyMult),months,targetN:n,
      checkStr:`let n=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=G.map[y][x].bld;if(b&&b.type==='factory'&&b.connected)n++;}return n>=${n};`};
  }},
  // SLA — dlouhodobá spokojenost
  {key:'sla_satisfaction',gen:(g,client)=>{
    const sat=82+Math.floor(Math.random()*13);
    const minB=30+Math.floor(Math.random()*40);
    const reward=sat*6000+minB*3000+200000;
    const penaltyMult=0.85+Math.random()*0.35;
    const months=10+Math.floor(Math.random()*8);
    return{name:`SLA ${sat}% (${minB}+ budov)`,client:client.name,clientIcon:client.icon,
      icon:'📋',desc:`${client.name}: Udržet spokojenost >${sat}% po ${months} měs. (min ${minB} budov v síti).`,
      reward,penalty:Math.round(reward*penaltyMult),months,targetN:sat,
      checkStr:`let s=0,n=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=G.map[y][x].bld;if(b&&b.connected){s+=b.sat;n++;}}return n>=${minB}&&s/n>=${sat};`};
  }},
  // Cloud B2B zákazníci
  {key:'cloud_clients',gen:(g,client)=>{
    const n=10+Math.floor(Math.random()*30);
    const reward=n*32000+150000;
    const penaltyMult=0.78+Math.random()*0.42;
    const months=8+Math.floor(n/10);
    return{name:`${n} cloud klientů`,client:client.name,clientIcon:client.icon,
      icon:'☁️',desc:`${client.name}: ${n} cloudových zákazníků do ${months} měs.`,
      reward,penalty:Math.round(reward*penaltyMult),months,targetN:n,
      checkStr:`let t=0;for(const s in(G.cloudCustomers||{}))t+=(G.cloudCustomers[s].count||0);return t>=${n};`};
  }},
  // Enterprise SLA tier
  {key:'sla_tier',gen:(g,client)=>{
    const reward=450000+Math.floor(Math.random()*350000);
    const penaltyMult=1.1+Math.random()*0.3;
    const months=8;
    return{name:`Enterprise 99.99% SLA`,client:client.name,clientIcon:client.icon,
      icon:'🛡️',desc:`${client.name}: Aktivuj Enterprise SLA a udrž ji po celou dobu ${months} měs.`,
      reward,penalty:Math.round(reward*penaltyMult),months,targetN:1,
      checkStr:`return G.cloudSLA==='sla_enterprise';`};
  }},
  // 5G pokrytí (event/festival)
  {key:'event_coverage',gen:(g,client)=>{
    const n=2+Math.floor(Math.random()*3);
    const reward=n*200000+150000;
    const penaltyMult=1.0+Math.random()*0.35;
    const months=5+Math.floor(Math.random()*4);
    return{name:`${n}× 5G věž pro event`,client:client.name,clientIcon:client.icon,
      icon:'📶',desc:`${client.name}: ${n} 5G věží do ${months} měs. (zajištění pokrytí).`,
      reward,penalty:Math.round(reward*penaltyMult),months,targetN:n,
      checkStr:`return(G.towers||[]).filter(t=>t.type&&t.type.includes('5g')).length>=${n};`};
  }},
  // Páteřní kapacita
  {key:'backbone_capacity',gen:(g,client)=>{
    const n=5+Math.floor(Math.random()*12);
    const reward=n*40000+300000;
    const penaltyMult=0.85+Math.random()*0.3;
    const months=8+Math.floor(n/3);
    return{name:`Páteř ${n} segmentů`,client:client.name,clientIcon:client.icon,
      icon:'🌐',desc:`${client.name}: ${n} segmentů páteřního kabelu (100G+) do ${months} měs.`,
      reward,penalty:Math.round(reward*penaltyMult),months,targetN:n,
      checkStr:`return G.cables.filter(c=>CAB_T[c.t]&&CAB_T[c.t].tier>=3).length>=${n};`};
  }},
  // Revenue commitment
  {key:'revenue_commit',gen:(g,client)=>{
    const base=Math.max(200000,g.stats.inc);
    const target=Math.round((base*1.4+Math.random()*base*0.6)/10000)*10000;
    const reward=Math.round(target*0.35);
    const penaltyMult=0.80+Math.random()*0.4;
    const months=10;
    return{name:`Příjem ${fmtKc(target)}/m`,client:client.name,clientIcon:client.icon,
      icon:'💰',desc:`${client.name}: Měsíční příjem ≥ ${fmtKc(target)} do ${months} měs.`,
      reward,penalty:Math.round(reward*penaltyMult),months,targetN:target,
      checkStr:`return G.stats.inc>=${target};`};
  }},
  // Pokrytí — expansion
  {key:'coverage_expansion',gen:(g,client)=>{
    const pct=60+Math.floor(Math.random()*30);
    const reward=pct*8000+150000;
    const penaltyMult=0.85+Math.random()*0.35;
    const months=12+Math.floor(pct/25)*3;
    return{name:`Pokrytí ${pct}%`,client:client.name,clientIcon:client.icon,
      icon:'📡',desc:`${client.name}: Připojit ${pct}% budov ve městě do ${months} měs.`,
      reward,penalty:Math.round(reward*penaltyMult),months,targetN:pct,
      checkStr:`let t=0,c=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=G.map[y][x].bld;if(b){t++;if(b.connected)c++;}}return t>0&&c/t>=${pct/100};`};
  }},
  // 10G premium klienti
  {key:'premium_10g',gen:(g,client)=>{
    const n=3+Math.floor(Math.random()*5);
    const reward=n*280000+200000;
    const penaltyMult=0.90+Math.random()*0.35;
    const months=8+n;
    return{name:`${n}× 10G přípojka`,client:client.name,clientIcon:client.icon,
      icon:'🔥',desc:`${client.name}: ${n} budov s 10G/25G přípojkou do ${months} měs.`,
      reward,penalty:Math.round(reward*penaltyMult),months,targetN:n,
      checkStr:`let n=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=G.map[y][x].bld;if(b&&b.connected&&(b.connType==='conn_fiber10g'||b.connType==='conn_fiber25g'))n++;}return n>=${n};`};
  }},
];

// AI Competitor config
const AI_NAMES=['CzechNet','SpeedLine','FiberPlus','NetPower','QuickConnect'];
const AI_COLORS=['#e74c3c','#3498db','#2ecc71','#e67e22','#9b59b6'];

// Multi-city expansion
const CITIES=[
  {id:'city1',name:'Centrum',unlocked:true,cost:0},
  {id:'city2',name:'Předměstí',unlocked:false,cost:2000000,minCust:300},
  {id:'city3',name:'Průmyslová zóna',unlocked:false,cost:5000000,minCust:600},
  {id:'city4',name:'Univerzitní čtvrť',unlocked:false,cost:8000000,minCust:1000},
];

// IPO / Stock market
const IPO={
  minCust:500,minRating:3,minCash:2000000,
  sharePrice:100, // base per customer
  maxShares:100000,
};

// Investor system
const INVESTOR_NAMES=[
  {name:'Jan Novotný Capital',icon:'🏦',style:'conservative',patienceBase:3},
  {name:'Prague Ventures',icon:'💼',style:'aggressive',patienceBase:2},
  {name:'TechFund CZ',icon:'🚀',style:'tech',patienceBase:3},
  {name:'Středoevropský fond',icon:'🏛️',style:'patient',patienceBase:5},
  {name:'Angel Group Praha',icon:'😇',style:'angel',patienceBase:4},
];
const INVESTOR_OFFERS=[
  // debt tier → how much % of company they want for bailout
  {maxDebt:200000,equityPct:10,cashBonus:300000,desc:'Malá injekce'},
  {maxDebt:500000,equityPct:20,cashBonus:700000,desc:'Středná investice'},
  {maxDebt:1000000,equityPct:30,cashBonus:1500000,desc:'Velká záchrana'},
  {maxDebt:3000000,equityPct:45,cashBonus:4000000,desc:'Masivní rekapitalizace'},
  {maxDebt:Infinity,equityPct:51,cashBonus:8000000,desc:'Převzetí majority'},
];
