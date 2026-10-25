(() => {
  'use strict';
  const STORE = 'hoppy-phase1-v1';
  const DB_NAME = 'hoppy-photos-v1';
  const statuses = ['気になる','内見予定','内見済','本命','見送り'];
  const kinds = ['新築戸建','中古戸建','新築マンション','中古マンション','土地','その他'];
  const raters = ['husband','wife'];
  const raterLabel = { husband: '夫', wife: '妻' };
  const digits = new Intl.NumberFormat('ja-JP');
  const fpYen = value => digits.format(Math.round((Number(value)||0)*10000))+'円';
  const fpYenNumber = value => Math.round((Number(value)||0)*10000);
  const app = document.getElementById('app');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => n === '' || n == null ? '未登録' : digits.format(Number(n)) + '万円';
  const num = v => v === '' || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null;
  const truncate = (s,n) => String(s || '').length > n ? String(s).slice(0,n - 1) + '…' : String(s || '');
  const dots = (index,count) => '<div class="dots" aria-label="' + (index+1) + ' / ' + count + 'ページ">' + Array.from({length:Math.min(count,5)},(_,i)=>'<span class="dot ' + (i===Math.round(index*(Math.min(count,5)-1)/Math.max(1,count-1))?'active':'') + '"></span>').join('') + '</div>';
  const rowsPerPage = () => window.matchMedia('(max-height: 650px)').matches ? 4 : 5;
  const initialCriteria = ['価格','耐久性（構造・耐震・築年数）','立地（駅距離・通勤）','広さ・間取り','日当たり','周辺環境（スーパー・病院）','子育て環境（学校・公園）','維持費（税・管理費等）','災害リスク','資産価値'].map((name,i)=>({id:'standard-'+i,name,weight:2,auto:null}));
  const blankProperty = () => ({id:uid(),name:'',url:'',address:'',price:'',kind:kinds[0],age:'',area:'',layout:'',station:'',status:statuses[0],manufacturer:'',meetings:[],tags:[],notes:{good:[''],bad:['']},questions:[],photos:[],created:Date.now()});
  const defaultPlan = () => ({
    husbandAge:27,wifeAge:29,children:2,firstChildYear:2028,birthInterval:3,
    husbandMonthly:26,wifeMonthly:25,husbandBonus:120,wifeBonus:20,wifeReduced:12.5,
    husbandBonusMonth1:6,husbandBonusMonth2:12,wifeBonusMonth1:6,wifeBonusMonth2:12,
    cashSavings:300,support:0,livingMonthly:20,rentMonthly:8.2,carMonthly:1.18,
    propertyPrice:4400,propertyId:'',purchaseYear:2028,purchaseMonth:1,downPayment:0,interest:1.5,loanYears:35,
    housingOngoing:2.5,weddingYear:2027,weddingCost:350,honeymoonCost:98,
    nisaMonthly:3,highSchool:'public',university:'public',simulateUntil:2045,hasRun:0,
    utilitiesMonthly:0,foodMonthly:0,managementMonthly:0,commonFeeMonthly:0,parkingMonthly:0,
    electricityMonthly:0,gasMonthly:0,waterBiMonthly:0,
    telecomMonthly:0,transportMonthly:0,subscriptionsMonthly:0,leisureMonthly:0,
    lifeInsuranceMonthly:0,medicalInsuranceMonthly:0,carInsuranceMonthly:0,medicalMonthly:0,
    carMaintenanceMonthly:0,otherLoanMonthly:0,otherLoanEndYear:0,childInsuranceMonthly:0,
    childLivingMonthly:0,daycareMonthly:0,childBenefitMonthly:0,childEducationInsuranceMonthly:0,
    annualTax:0,carTaxAnnual:0,travelAnnual:0,annualEvents:0,homeInsuranceAnnual:0,
    otherSavingsMonthly:0,otherInvestMonthly:0,nisaBalance:0,investBalance:0,returnAnnual:0,carLoanEndYear:0,
    cashBufferMonthly:3,freeSpendingMonthly:0,expenses:[],events:[]
  });
  const defaults = () => ({version:2,properties:[],criteria:initialCriteria,scores:{},selected:[],filter:{query:'',tag:'',sort:'new',status:''},plan:defaultPlan(),planHistory:[],studyNotes:[],homeCriteriaMemo:''});
  let state;
  try { const raw = localStorage.getItem(STORE); state = raw ? normalize(JSON.parse(raw)) : defaults(); }
  catch (_) { state = defaults(); }
  let ui = {tab:'property',propertyId:null,propertyPage:0,photoIndex:0,noteKind:'good',noteIndex:0,questionPage:0,homePage:0,meetingIndex:0,meetingNoteIndex:0,meetingDraft:null,comparePage:0,rater:'overall',overlay:'',formStep:0,propertyFormPage:0,draft:null,simStep:0,simSubPage:0,simResultPage:1,fpChartPage:0,fpBreakdownAnnual:'living',fpBreakdownMonthly:'living',fpBreakdownOpen:null,fpEditingRow:null,fpHistoryLive:true,fpIncomePeriod:'year',fpIncomeMonth:1,fpCashMonth:1,fpMonthView:'pie',fpAssetPeriod:'year',fpAssetMonth:1,fpHistoryPage:0,fpHistoryId:null,fpHistoryOpen:false,fpCalcPage:0,fpAdvicePage:0,fpIssuePage:0,fpLedgerPage:0,fpHomePage:0,fpYear:new Date().getFullYear(),simChoice:'custom',studyMode:'notes',studyPage:0,studySummaryPage:0,studyDraft:null,studyEditId:null,studyDigestPage:0,memoScope:'individual',memoPropertyId:'',axisEdit:false,memoPage:0,memoSwipeKey:null,listPage:0,criteriaPage:0,criterionId:null,scoreProperty:null,scoreCriterion:null,scoreRater:'husband',lock:0,toast:null};
  let photoUrl = null,photoToken = 0,toastTimer = null;
  if(state.plan.hasRun){ui.simStep=7;ui.simResultPage=1;ui.fpYear=new Date().getFullYear();}
  function normalize(s) {
    if (!s || !Array.isArray(s.properties) || !Array.isArray(s.criteria)) throw Error('形式が違います');
    const out = defaults();
    out.properties = s.properties.filter(p=>p && typeof p.id==='string').map(p=>({...blankProperty(),...p,notes:{good:Array.isArray(p.notes?.good)?p.notes.good:[''],bad:Array.isArray(p.notes?.bad)?p.notes.bad:['']},questions:Array.isArray(p.questions)?p.questions:[],meetings:Array.isArray(p.meetings)?p.meetings.filter(m=>m && typeof m.id==='string').map(m=>({id:m.id,at:typeof m.at==='string'?m.at:'',maker:String(m.maker||''),type:m.type==='内見'?'内見':'打ち合わせ',notes:Array.isArray(m.notes)&&m.notes.length?m.notes.map(x=>String(x).slice(0,220)):['']})):[],photos:Array.isArray(p.photos)?p.photos:[],tags:Array.isArray(p.tags)?p.tags:[]}));
    out.criteria = s.criteria.filter(c=>c && typeof c.id==='string' && typeof c.name==='string').map(c=>({...c,weight:Math.min(3,Math.max(1,Number(c.weight)||1))}));
    out.scores = s.scores && typeof s.scores==='object' ? s.scores : {};
    out.selected = Array.isArray(s.selected)?s.selected.filter(id=>out.properties.some(p=>p.id===id)).slice(0,3):[];
    out.filter = {...out.filter,...s.filter};
    const normalizeExpenses=xs=>Array.isArray(xs)?xs.slice(0,35).filter(x=>x&&typeof x.id==='string').map(x=>({
      id:String(x.id).slice(0,80),name:String(x.name||'追加支出').slice(0,50),
      amount:Math.min(10000,Math.max(0,Number(x.amount)||0)),
      cycle:x.cycle==='year'?'year':'month',
      start:Math.max(0,Math.floor(Number(x.start)||0)),
      end:Math.max(0,Math.floor(Number(x.end)||0))
    })):[];
    const normalizeEvents=xs=>Array.isArray(xs)?xs.slice(0,30).filter(x=>x&&typeof x.id==='string').map(x=>({
      id:String(x.id).slice(0,80),name:String(x.name||'イベント').slice(0,50),
      amount:Math.min(100000,Math.max(0,Number(x.amount)||0)),
      year:Math.max(0,Math.min(2100,Math.floor(Number(x.year)||0))),
      month:Math.max(0,Math.min(12,Math.floor(Number(x.month)||0))),
      type:x.type==='income'?'income':'expense',
      kind:['wedding','honeymoon'].includes(x.kind)?x.kind:'custom'
    })):[];
    const normalizePlan=raw=>{
      const plan=defaultPlan();
      if(raw&&typeof raw==='object')for(const key of Object.keys(plan)){
        if(key in raw&&(typeof raw[key]==='string'||typeof raw[key]==='number'))plan[key]=raw[key];
      }
      plan.expenses=normalizeExpenses(raw?.expenses);
      plan.events=normalizeEvents(raw?.events);
      return plan;
    };
    out.homeCriteriaMemo=String(s.homeCriteriaMemo||'').slice(0,4000);
    out.plan=normalizePlan(s.plan);
    out.planHistory=Array.isArray(s.planHistory)?s.planHistory.slice(0,24).filter(x=>
      x&&typeof x.id==='string'&&x.plan&&typeof x.plan==='object'
    ).map(x=>({id:String(x.id).slice(0,80),created:Number(x.created)||0,plan:normalizePlan(x.plan)})):[];
    if(out.plan.hasRun&&!out.planHistory.length)
      out.planHistory=[{id:'legacy-first-result',created:0,plan:normalizePlan(out.plan)}];
    out.studyNotes = Array.isArray(s.studyNotes)?s.studyNotes.filter(n=>n&&typeof n.id==='string').slice(0,300).map(n=>({
      id:n.id,title:String(n.title||'家の学び').slice(0,65),text:String(n.text||'').slice(0,7000),originalText:String(n.originalText||n.text||'').slice(0,2500),
      propertyId:typeof n.propertyId==='string'?n.propertyId:'',created:Number(n.created)||Date.now()
    })):[];

    return out;
  }
  function save() { try {localStorage.setItem(STORE,JSON.stringify(state));} catch (_) {message('保存容量に達しました。バックアップを作成してください。');} }
  function message(text) {ui.toast=text;renderToast();clearTimeout(toastTimer);toastTimer=setTimeout(()=>{ui.toast=null;renderToast();},2700);}
  function renderToast(){let old=app.querySelector('.toast');if(old)old.remove();if(ui.toast)app.insertAdjacentHTML('beforeend','<div class="toast" role="status">'+esc(ui.toast)+'</div>');}
  const propById = id => state.properties.find(p=>p.id===id);
  const curProp = () => {const visible=visibleProperties(); return propById(ui.propertyId) || visible[0] || null;};
  function visibleProperties(){
    let ps=state.properties.filter(p=>(p.name+' '+p.address+' '+(p.manufacturer||'')+' '+p.tags.join(' ')).toLowerCase().includes((state.filter.query||'').toLowerCase()) && (!state.filter.tag || p.tags.includes(state.filter.tag)) && (!state.filter.status || p.status===state.filter.status));
    if(state.filter.sort==='price')ps.sort((a,b)=>(num(a.price)??Infinity)-(num(b.price)??Infinity));
    else if(state.filter.sort==='name')ps.sort((a,b)=>a.name.localeCompare(b.name,'ja'));
    else ps.sort((a,b)=>b.created-a.created);
    return ps;
  }
  function selectedProperties(){return state.selected.map(propById).filter(Boolean).slice(0,3);}
  function step(action){if(Date.now()<ui.lock)return;ui.lock=Date.now()+(ui.tab==='sim'&&ui.simStep>=7?60:(reduced.matches?100:450));action();render();}
  function closeOverlay(){step(()=>{ui.overlay='';ui.draft=null;});}
  function openOverlay(kind, setup){step(()=>{ui.overlay=kind;if(setup)setup();});}
  function chooseTab(tab){step(()=>{ui.tab=tab;ui.overlay='';ui.fpBreakdownOpen=null;ui.draft=null;if(tab==='sim'&&state.plan.hasRun){ui.simStep=7;ui.simResultPage=1;ui.fpYear=simNowYear();ui.fpHistoryLive=true;ui.fpHistoryOpen=false;ui.fpHistoryId=state.planHistory[0]?.id||null;}});}
  function tabIcon(key){
    const paths={property:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',compare:'<path d="M12 3v18M5 7h14M7 7l-4 7h8L7 7Zm10 0-4 7h8l-4-7ZM4 18h16"/>',sim:'<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M8 6.5h8M8 11h2m4 0h2M8 15h2m4 0h2M8 19h2m4 0h2"/>',schedule:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 10h18"/>',memo:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'};
    return '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[key]+'</svg>';
  }
  function toolbar(title){
    const count=state.properties.filter(p=>p.status!=='見送り').length;
    return '<header class="top modern-top"><div class="brand-block"><span class="brand-symbol" aria-hidden="true">'+tabIcon('property')+'</span><div class="brand"><h1>'+esc(ui.tab==='property'?'ほっぽさん':title)+'</h1><span class="eyebrow">HOME PLANNER</span></div></div><div class="header-actions">'+(ui.tab==='property'?'<span class="header-count">♥ <b>'+count+'件</b></span>':'')+'<button class="iconbtn settings-gear" data-act="settings" aria-label="バックアップ・設定">⚙</button></div></header>';
  }
  function render(){
    if(!app)return;
    const titles={property:'ほっぽさん',compare:'比較',sim:'FPプラン',schedule:'予定',memo:'メモ'};
    const nav=[['property','物件'],['compare','比較'],['sim','FP'],['schedule','予定'],['memo','メモ']];
    // Keep the underlying screen mounted while a full-screen view is open.
    // Rebuilding it on every dialog/page change causes the home screen to flash
    // behind the opening overlay and needlessly reloads photo thumbnails.
    const liveMain=app.querySelector('main.main');
    const liveHeader=app.querySelector('header.top');
    const liveNav=app.querySelector('nav.bottom');
    if(ui.overlay && liveMain && liveHeader && liveNav && liveNav.querySelector('[data-act="tab"][data-value="'+ui.tab+'"].active')){
      const current=app.querySelector('.full');
      if(current)current.outerHTML=overlay();
      else app.insertAdjacentHTML('beforeend',overlay());
      renderToast();hydratePhotos();
      return;
    }
    const oldFP=ui.tab==='sim'?app.querySelector('.fp-month-report, .fp-pie-panel'):null;
    const oldFPKind=oldFP?.classList?.contains('fp-month-report')?'monthly':oldFP?'annual':null;
    const oldFPScroll=oldFP?.scrollTop||0;
    const body=ui.tab==='property'?propertyScreen():ui.tab==='compare'?compareScreen():ui.tab==='sim'?simulationScreen():ui.tab==='memo'?memoScreen():pendingScreen();
    app.innerHTML=toolbar(titles[ui.tab])+'<main class="main">'+body+'</main><nav class="bottom" aria-label="メインメニュー">'+nav.map(([key,name])=>'<button class="tab '+(ui.tab===key?'active':'')+'" data-act="tab" data-value="'+key+'" aria-current="'+(ui.tab===key?'page':'false')+'"><span class="nav-icon">'+tabIcon(key)+'</span><span class="tab-label">'+name+'</span></button>').join('')+'</nav>'+(ui.overlay?overlay(): '');
    // Changing month/year or a value must not snap a scrolled breakdown
    // back to the start of the FP report.
    if(oldFPKind){
      const nextFP=app.querySelector(oldFPKind==='monthly'?'.fp-month-report':'.fp-pie-panel');
      if(nextFP)nextFP.scrollTop=oldFPScroll;
    }
    renderToast();hydratePhotos();
  }
  function empty(icon,title,desc,action,label){return '<section class="panel grow empty"><div class="big">'+icon+'</div><h2 class="section-title">'+esc(title)+'</h2><p>'+esc(desc)+'</p>'+ (action?'<button class="btn primary" data-act="'+action+'">'+esc(label)+'</button>':'')+'</section>';}
  function navPager(index,total,act){return '<div class="pager"><button class="page-arrow" data-act="'+act+'" data-value="-1" '+(total<2?'disabled':'')+' aria-label="前へ">‹</button><div class="counter">'+(total?index+1:0)+' / '+total+'</div>'+dots(index,Math.max(total,1))+'<button class="page-arrow" data-act="'+act+'" data-value="1" '+(total<2?'disabled':'')+' aria-label="次へ">›</button></div>';}
  const homePageSize=()=>window.matchMedia('(max-height: 710px)').matches?2:window.matchMedia('(max-height: 910px)').matches?3:4;
  function propertyCard(p){
    const now=Date.now(),ms=(p.meetings||[]).filter(m=>m.at);
    const future=ms.filter(m=>new Date(m.at).getTime()>=now).sort((a,b)=>a.at.localeCompare(b.at))[0];
    const latest=future||ms.slice().sort((a,b)=>b.at.localeCompare(a.at))[0];
    const date=latest?latest.at.slice(5,7).replace(/^0/,'')+'/'+latest.at.slice(8,10).replace(/^0/,''):'未登録';
    const tag=p.status==='本命'?'favorite':p.status==='内見予定'?'planned':'';
    const eventType=latest?(latest.type==='内見'?'内見':'打合せ'):'';
    const thumb=p.photos?.length?'<img data-photo="'+esc(p.photos[0])+'" alt="" loading="lazy">':'<span class="property-img-fallback" aria-hidden="true">'+tabIcon('property')+'</span>';
    const name=esc(p.name||'名称未設定'),maker=esc(p.manufacturer||'メーカー未登録');
    const fpCheck=state.plan.hasRun&&num(p.price)!==null?fpRating(Number(p.price)):null;
    const fpDot=fpCheck?'<i class="fp-card-dot '+fpBadgeClass(fpCheck.level)+'" title="FP判定：'+esc(fpCheck.label)+'"></i>':'';
    return '<button class="property-list-card" data-act="home-open" data-value="'+esc(p.id)+'" aria-label="'+name+'の詳細を開く"><span class="property-thumb">'+thumb+'</span><span class="property-card-body"><span class="property-first-row"><strong class="property-list-name" title="'+name+'">'+name+'</strong><span class="property-list-maker" title="'+maker+'">'+maker+'</span><span class="property-state '+tag+'">'+esc(p.status)+'</span></span><span class="property-second-row"><span class="prop-price">'+fpDot+(num(p.price)!==null?digits.format(p.price)+'万':'価格未登録')+'</span><span class="prop-station">'+(num(p.station)!==null?'徒歩'+digits.format(p.station)+'分':'駅徒歩 −')+'</span><span class="prop-meeting">'+(latest?(future?eventType+' ':'済 ')+date:'予定なし')+'</span></span></span><span class="property-chevron" aria-hidden="true">›</span></button>';
  }
  function homeResults(){
    const ps=visibleProperties(),perPage=homePageSize(),total=Math.max(1,Math.ceil(ps.length/perPage));
    ui.homePage=Math.min(ui.homePage,total-1);
    const page=ps.slice(ui.homePage*perPage,(ui.homePage+1)*perPage);
    const chips=[['','すべて'],['気になる','気になる'],['内見予定','内見予定'],['本命','本命']];
    const textScope=state.properties.filter(p=>(p.name+' '+p.address+' '+(p.manufacturer||'')+' '+p.tags.join(' ')).toLowerCase().includes((state.filter.query||'').toLowerCase())&&(!state.filter.tag||p.tags.includes(state.filter.tag)));
    return '<div class="home-summary"><div class="home-summary-label"><strong>'+ps.length+'件</strong><span>比較中の物件</span></div><button class="summary-action" data-act="home-compare">比較する <span aria-hidden="true">→</span></button></div>'+
      '<div class="status-chip-row" role="group" aria-label="検討状況で絞り込み">'+chips.map(([v,label])=>'<button class="status-chip '+((state.filter.status||'')===v?'is-active':'')+'" data-act="home-status" data-value="'+esc(v)+'">'+label+' <span>'+(v?textScope.filter(p=>p.status===v).length:textScope.length)+'</span></button>').join('')+'</div>'+
      '<div class="property-list swipe-zone">'+(page.length?page.map(propertyCard).join(''):'<div class="home-no-match"><strong>該当する物件がありません</strong><span>検索や絞り込みを変更してください</span><button class="btn" data-act="filter-clear">条件をリセット</button></div>')+'</div>'+
      (total>1?navPager(ui.homePage,total,'home-page'):'<div class="home-page-single" aria-label="1ページ目"></div>');
  }
  function propertyScreen(){
    return '<section class="screen home-screen"><div class="home-search-row"><label class="home-search-box"><span class="search-icon" aria-hidden="true">⌕</span><input data-home-query type="search" autocomplete="off" enterkeyhint="search" placeholder="エリア・駅・物件名で検索" aria-label="物件を検索" value="'+esc(state.filter.query||'')+'"></label><button class="home-filter-btn" data-act="search">☷ <span>絞り込み</span></button></div><button class="home-add-btn" data-act="add-property"><span aria-hidden="true">＋</span> 物件を追加</button><div class="home-results">'+homeResults()+'</div>'+(state.properties.length===0?'<button class="home-sample-link" data-act="seed">サンプル3件で試す</button>':'')+'</section>';
  }
  function detailScreen(){
    let p=curProp();if(!p)return '';
    const heads=['基本','打合せ','メモ','写真'];
    let content='';
    if(ui.propertyPage===0){
      const items=[['住所',p.address],['価格',fmt(p.price)],['種別',p.kind],['築年数',p.age===''?'未登録':p.age+'年'],['面積',p.area===''?'未登録':p.area+'㎡'],['間取り',p.layout],['駅徒歩',p.station===''?'未登録':p.station+'分'],['メーカー',p.manufacturer]];
      content='<div class="panel detail grow swipe-zone"><div class="info-grid grow">'+items.map(([a,b])=>'<div class="info-box"><span>'+a+'</span><strong>'+esc(b||'未登録')+'</strong></div>').join('')+'</div><div class="toolbar"><button class="btn flex1" data-act="edit-property">情報を編集</button>'+(p.url?'<button class="btn flex1" data-act="external" data-value="'+esc(p.url)+'">物件サイトを見る</button>':'')+'</div></div>';
    }else if(ui.propertyPage===1){
      content=meetingsScreen(p);
    }else if(ui.propertyPage===2){
      let notes=p.notes[ui.noteKind]||[''];ui.noteIndex=Math.min(ui.noteIndex,Math.max(0,notes.length-1));
      if(ui.noteKind==='questions'){
        const start=ui.questionPage*4;const subset=p.questions.slice(start,start+4);
        content='<div class="panel detail grow swipe-zone"><div class="notes-title"><span class="kicker">営業担当に聞くこと</span><span class="meta">'+p.questions.length+' 件</span></div><div class="question-list">'+(subset.length?subset.map(q=>'<div class="question-row '+(q.done?'done':'')+'"><button class="checkbtn" data-act="question-toggle" data-value="'+esc(q.id)+'" aria-label="確認済みを切替">'+(q.done?'✓':'○')+'</button><span>'+esc(q.text)+'</span></div>').join(''):'<div class="empty grow"><p>聞きたいことを登録しましょう。</p></div>')+'</div>'+navPager(Math.min(ui.questionPage,Math.max(0,Math.ceil(p.questions.length/4)-1)),Math.max(1,Math.ceil(p.questions.length/4)),'question-nav')+'<button class="btn primary wide" data-act="add-question">＋ 質問を追加</button></div>';
      } else {
        const note=notes[ui.noteIndex]||'';
        content='<div class="panel detail grow swipe-zone"><div class="notes-title"><span class="kicker">'+(ui.noteKind==='good'?'よかった点':'気になる点')+'</span><span class="meta">'+note.length+' / 220文字</span></div><textarea class="note-text" data-note="'+ui.noteKind+'" maxlength="220" placeholder="ここにメモを書きます。1ページ220文字まで。">'+esc(note)+'</textarea><div class="note-actions"><button class="btn compact" data-act="note-nav" data-value="-1" '+(ui.noteIndex===0?'disabled':'')+'>‹</button><span class="meta">'+(ui.noteIndex+1)+' / '+notes.length+'</span><button class="btn compact" data-act="note-nav" data-value="1" '+(ui.noteIndex===notes.length-1?'disabled':'')+'>›</button><button class="btn compact primary" data-act="note-add">＋</button></div></div>';
      }
    }else if(ui.propertyPage===3){
      let n=p.photos.length;ui.photoIndex=Math.min(ui.photoIndex,Math.max(0,n-1));
      content='<div class="panel detail grow swipe-zone"><div class="photo-frame">'+(n?'<img data-photo="'+esc(p.photos[ui.photoIndex])+'" alt="物件写真 '+(ui.photoIndex+1)+'">':'<div class="photo-empty">▧<p>写真はまだありません</p><p>複数枚を端末に保存できます</p></div>')+'</div>'+navPager(ui.photoIndex,n,'photo-nav')+'<div class="toolbar"><label class="btn primary flex1" for="photo-upload">＋ 写真を追加</label><input id="photo-upload" class="sr-only" type="file" accept="image/*" multiple>'+(n?'<button class="btn danger" data-act="photo-delete">写真を削除</button>':'')+'</div></div>';
    }
    return '<div class="full"><header class="full-header"><button class="btn compact" data-act="detail-close">‹ 戻る</button><strong>'+esc(p.name)+'</strong><button class="btn compact" data-act="edit-property">編集</button></header><div class="full-body screen"><div class="segment">'+heads.map((x,i)=>'<button data-act="detail-page" data-value="'+i+'" class="'+(i===ui.propertyPage?'active':'')+'">'+x+'</button>').join('')+'</div>'+(ui.propertyPage===2?'<div class="segment"><button class="'+(ui.noteKind==='good'?'active':'')+'" data-act="note-kind" data-value="good">よかった</button><button class="'+(ui.noteKind==='bad'?'active':'')+'" data-act="note-kind" data-value="bad">気になる</button><button class="'+(ui.noteKind==='questions'?'active':'')+'" data-act="note-kind" data-value="questions">質問</button></div>':'')+content+'</div></div>';
  }
  function formatMeetingDate(value){
    if(!value)return '日時未設定';
    const match=String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if(!match)return '日時未設定';
    return match[1]+'/'+match[2]+'/'+match[3]+' '+match[4]+':'+match[5];
  }
  function meetingsScreen(p){
    const ms=p.meetings||[];
    ui.meetingIndex=Math.max(0,Math.min(ui.meetingIndex,Math.max(0,ms.length-1)));
    if(!ms.length)return '<div class="panel detail grow meeting-panel"><div class="empty grow meeting-empty"><span class="kicker">MEETING JOURNAL</span><h2 class="section-title">打ち合わせの記録</h2><p>日時とメーカー、聞いた内容を物件ごとに残せます。</p><button class="btn primary" data-act="meeting-add">＋ 打ち合わせを登録</button></div></div>';
    const m=ms[ui.meetingIndex], notes=m.notes||[''];
    ui.meetingNoteIndex=Math.min(ui.meetingNoteIndex,Math.max(0,notes.length-1));
    return '<div class="panel detail grow meeting-panel swipe-zone"><div class="meeting-record-head"><div class="meeting-date-block"><span class="micro-label">'+esc(m.type==='内見'?'内見日時':'打ち合わせ日時')+'</span><strong>'+esc(formatMeetingDate(m.at))+'</strong><span>'+esc(m.maker||p.manufacturer||'メーカー未登録')+'</span></div><div class="row"><button class="btn compact" data-act="meeting-edit">編集</button></div></div>'+
      '<div class="meeting-notepad"><div class="notes-title"><span class="kicker">打ち合わせメモ</span><span class="meta">'+(ui.meetingNoteIndex+1)+' / '+notes.length+'ページ</span></div><textarea class="note-text meeting-note" data-meeting-note maxlength="220" placeholder="担当者の説明、次回聞くこと、見積もりの内容などを記録">'+esc(notes[ui.meetingNoteIndex]||'')+'</textarea>'+
      '<div class="meeting-note-actions"><button class="btn compact" data-act="meeting-note-nav" data-value="-1" '+(ui.meetingNoteIndex===0?'disabled':'')+'>‹</button><button class="btn compact" data-act="meeting-note-nav" data-value="1" '+(ui.meetingNoteIndex===notes.length-1?'disabled':'')+'>›</button><button class="btn compact" data-act="meeting-note-add">＋ ページ</button><button class="btn compact danger" data-act="meeting-note-delete" '+(notes.length===1?'disabled':'')+'>削除</button></div></div>'+
      '<div class="meeting-nav"><button class="btn compact" data-act="meeting-nav" data-value="-1" '+(ui.meetingIndex===0?'disabled':'')+'>‹ 前の記録</button><span class="meta">'+(ui.meetingIndex+1)+' / '+ms.length+'件</span><button class="btn compact" data-act="meeting-nav" data-value="1" '+(ui.meetingIndex===ms.length-1?'disabled':'')+'>次の記録 ›</button></div><button class="btn primary wide" data-act="meeting-add">＋ 打ち合わせを追加</button></div>';
  }
  function meetingForm(){
    const m=ui.meetingDraft;
    const preview=(m.notes&&m.notes[0])||'';
    return modalFrame(m._new?'予定・打ち合わせを登録':'予定・打ち合わせを編集','<div class="panel detail grow meeting-form"><div><span class="kicker">VISIT & MEETING</span><p class="subtle">予定とメーカー、メモをまとめて記録します。</p></div><div class="field"><label for="meeting-type">種類</label><select id="meeting-type" data-meeting-model="type"><option value="打ち合わせ" '+((m.type||'打ち合わせ')==='打ち合わせ'?'selected':'')+'>打ち合わせ</option><option value="内見" '+(m.type==='内見'?'selected':'')+'>内見</option></select></div><div class="field"><label for="meeting-at">日時</label><input id="meeting-at" type="datetime-local" data-meeting-model="at" value="'+esc(m.at)+'"></div><div class="field"><label for="meeting-maker">メーカー・担当会社</label><input id="meeting-maker" type="text" data-meeting-model="maker" maxlength="70" value="'+esc(m.maker||'')+'" placeholder="例: ヘーベルハウス"></div><div class="field grow"><label for="meeting-memo">打ち合わせメモ（1ページ目）</label><textarea id="meeting-memo" class="meeting-form-note" data-meeting-model="memo" maxlength="220" placeholder="話した内容、聞きたいこと、次回までの宿題">'+esc(preview)+'</textarea></div><p class="subtle">長いメモは保存後にページ追加できます。</p></div><div class="form-foot"><button class="btn flex1" data-act="meeting-cancel">戻る</button><button class="btn primary flex1" data-act="meeting-save">保存する</button></div>');
  }
  function propertyForm(){
    const p=ui.draft;
    const field=(label,key,type,extra)=>'<div class="field onepage-field"><label for="form-'+key+'">'+label+'</label><input id="form-'+key+'" data-model="'+key+'" type="'+(type||'text')+'" value="'+esc(p[key]??'')+'" '+(extra||'')+'></div>';
    const select=(label,key,opts)=>'<div class="field onepage-field"><label for="form-'+key+'">'+label+'</label><select id="form-'+key+'" data-model="'+key+'">'+opts.map(x=>'<option '+(p[key]===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></div>';
    const fields=[
      field('物件名 *','name','text','maxlength="70" required placeholder="○○の家"'),
      field('住宅メーカー','manufacturer','text','maxlength="70" placeholder="ヘーベルハウス"'),
      field('価格（万円）','price','number','min="0" step="1" inputmode="numeric" placeholder="4400"'),
      select('種別','kind',kinds),
      field('築年数','age','number','min="0" step="1" inputmode="numeric" placeholder="0"'),
      field('広さ（㎡）','area','number','min="0" step="0.1" inputmode="decimal" placeholder="100"'),
      field('間取り','layout','text','maxlength="50" placeholder="3LDK"'),
      field('駅徒歩（分）','station','number','min="0" step="1" inputmode="numeric" placeholder="12"'),
      select('検討状況','status',statuses),
      '<div class="field onepage-field"><label for="form-tags">タグ</label><input id="form-tags" data-model="tags" value="'+esc(p.tags.join(', '))+'" placeholder="駅近, 南向き" maxlength="160"></div>',
      field('住所','address','text','maxlength="120" placeholder="愛知県…"'),
      field('物件URL','url','url','placeholder="https://..."')
    ];
    const page=Math.max(0,Math.min(2,ui.propertyFormPage||0));
    return modalFrame(p._new?'物件を追加':'基本情報を編集',
      fpPageNav(3,page,'property-form-page',['基本情報','物件条件','その他'])+
      '<div class="property-editor"><div class="property-fields" role="group" aria-label="基本情報を分けて入力">'+fields.slice(page*4,page*4+4).join('')+'</div></div>'+
      '<div class="property-editor-actions"><button class="btn flex1" data-act="form-cancel">キャンセル</button><button class="btn primary flex1" data-act="form-save">まとめて保存</button></div>'+
      (!p._new?'<button class="property-delete-inline" data-act="property-delete">この物件を削除</button>':'')
    );
  }
  function modalFrame(title,content){return '<div class="full"><header class="full-header"><button class="btn compact" data-act="overlay-close">×</button><strong>'+esc(title)+'</strong><span style="width:44px"></span></header><section class="full-body swipe-zone">'+content+'</section></div>';}
  function listScreen(){
    let ps=visibleProperties(),n=Math.max(1,Math.ceil(ps.length/4));ui.listPage=Math.min(ui.listPage,n-1);
    let cells=ps.slice(ui.listPage*4,ui.listPage*4+4);
    return modalFrame('物件一覧','<div class="row between"><span class="subtle">'+ps.length+'件の物件</span><button class="btn compact" data-act="search">⌕ 絞り込み</button></div>'+(cells.length?'<div class="grid4">'+cells.map(p=>'<button class="grid-tile" data-act="list-pick" data-value="'+esc(p.id)+'"><span class="pill status">'+esc(p.status)+'</span><strong>'+esc(p.name)+'</strong><span>'+esc(truncate(p.manufacturer||p.address,20))+'</span><strong>'+esc(fmt(p.price))+'</strong></button>').join('')+'</div>':empty('⌕','該当する物件がありません','条件を変えて検索してください。'))+navPager(ui.listPage,n,'list-nav')+'<button class="btn primary wide" data-act="add-property">＋ 物件を登録</button>');
  }
  function searchScreen(){
    const allTags=[...new Set(state.properties.flatMap(p=>p.tags))].sort();
    const f=state.filter;
    return modalFrame('検索と並び替え','<div class="panel detail grow"><div class="field"><label>キーワード</label><input data-filter="query" value="'+esc(f.query||'')+'" placeholder="名前・住所・タグで検索"></div><div class="field"><label>タグ</label><select data-filter="tag"><option value="">すべて</option>'+allTags.map(tag=>'<option value="'+esc(tag)+'" '+(f.tag===tag?'selected':'')+'>'+esc(tag)+'</option>').join('')+'</select></div><div class="field"><label>検討状況</label><select data-filter="status"><option value="">すべて</option>'+statuses.map(x=>'<option value="'+esc(x)+'" '+(f.status===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></div><div class="field"><label>並び順</label><select data-filter="sort"><option value="new" '+(f.sort==='new'?'selected':'')+'>新しい順</option><option value="price" '+(f.sort==='price'?'selected':'')+'>価格の低い順</option><option value="name" '+(f.sort==='name'?'selected':'')+'>物件名順</option></select></div></div><div class="form-foot"><button class="btn flex1" data-act="filter-clear">解除</button><button class="btn primary flex1" data-act="filter-apply">この条件で表示</button></div>');
  }
  function settingsScreen(){
    return modalFrame('バックアップ・設定','<div class="panel detail grow"><div><span class="kicker">DATA</span><h2 class="section-title">大切な記録を守る</h2><p class="subtle">データはこの端末のブラウザに保存されます。端末変更・ブラウザのデータ消去に備えてバックアップしてください。</p></div><button class="btn primary wide" data-act="export">JSONをエクスポート（写真を含む）</button><label class="btn wide" for="json-import">JSONをインポート（現在のデータを置換）</label><input id="json-import" class="sr-only" type="file" accept="application/json,.json"><div class="info-box"><span>保存方式</span><strong>物件・採点: localStorage</strong><strong>写真: IndexedDB</strong></div><p class="subtle">現段階は端末ごとの個別保存です。夫婦共同編集・自動同期・通知は後続フェーズで対応します。</p></div>');
  }
  function compareScreen(){
    const ps=selectedProperties(),n=Math.ceil(state.criteria.length/rowsPerPage())+1;
    ui.comparePage=Math.min(ui.comparePage,n-1);
    const ranking=ui.comparePage===n-1;
    return '<section class="screen compare-screen"><div class="toolbar between"><div><span class="kicker">HOME COMPARE</span><h2 class="section-title">'+(ranking?'総合ランキング':'物件をくらべる')+'</h2></div><div class="row"><button class="btn compact" data-act="choose-properties">物件選択</button><button class="btn compact" data-act="criteria">項目</button></div></div>'+
      (!ps.length?empty('◎','比較したい物件を選ぶ','最大3件まで横並びで採点できます。','choose-properties','物件を選ぶ'):ranking?rankingScreen(ps):comparisonTable(ps))+
      '<div class="row between"><span class="meta">'+(ranking?'項目ごとの重要度を反映':'○ 2点 / △ 1点 / × 0点')+'</span><span class="meta">'+(ui.comparePage+1)+' / '+n+'ページ</span></div>'+
      navPager(ui.comparePage,n,'compare-nav')+'</section>';
  }
  function comparisonTable(ps){
    const items=state.criteria.slice(ui.comparePage*rowsPerPage(),ui.comparePage*rowsPerPage()+rowsPerPage());
    const head='<div class="compare-row"><div class="compare-cell topic">比較項目</div>'+Array.from({length:3},(_,i)=>'<div class="compare-cell heading" '+(ps[i]?'title="'+esc(ps[i].name)+'"':'')+'>'+esc(truncate(ps[i]?.name||'未選択',5))+'</div>').join('')+'</div>';
    const rows=Array.from({length:rowsPerPage()},(_,i)=>{
      const c=items[i];if(!c)return '<div class="compare-row"><div class="compare-cell placeholder"></div>'+Array.from({length:3},()=>'<div class="compare-cell placeholder"></div>').join('')+'</div>';
      return '<div class="compare-row"><div class="compare-cell topic" title="'+esc(c.name)+'">'+esc(c.name.split(/[（(]/)[0])+'<small>★'+c.weight+'</small></div>'+
      Array.from({length:3},(_,k)=>{
        const p=ps[k];if(!p)return '<div class="compare-cell placeholder">–</div>';
        const result=effective(p,c,'overall');
        return '<button class="compare-cell rating" data-act="rating" data-property="'+esc(p.id)+'" data-criterion="'+esc(c.id)+'"><span class="rating-face '+faceClass(result.value)+'">'+mark(result.value)+'</span><span class="rating-small">'+(result.auto?'自動':'評価する')+'</span></button>';
      }).join('')+'</div>';
    }).join('');
    return '<div class="panel detail grow swipe-zone"><div class="compare-table">'+head+rows+'</div></div>';
  }
  function mark(n){return n===2?'○':n===1?'△':n===0?'×':'−';}
  function faceClass(n){return n===2?'yes':n===1?'mid':n===0?'no':'';}
  function effective(p,c,who){
    const saved=state.scores[p.id]?.[c.id]||{};
    let manual=saved[who];
    if(who==='overall' && ![0,1,2].includes(manual)){
      const legacy=['husband','wife'].map(k=>saved[k]).filter(n=>[0,1,2].includes(n));
      if(legacy.length)manual=Math.round(legacy.reduce((a,b)=>a+b,0)/legacy.length);
    }
    if([0,1,2].includes(manual))return {value:manual,auto:false};
    if(c.auto && ['price','age','area','station'].includes(c.auto.field)){
      const v=num(p[c.auto.field]),good=num(c.auto.good),mid=num(c.auto.mid);
      if(v!==null&&good!==null&&mid!==null&&good>=0&&mid>=0){
        return {value:c.auto.dir==='high'?(v>=good?2:v>=mid?1:0):(v<=good?2:v<=mid?1:0),auto:true};
      }
    }
    return {value:null,auto:false};
  }
  function scoreSummary(p,who){
    let sum=0,covered=0,total=0;
    state.criteria.forEach(c=>{let w=Number(c.weight)||1;total+=w*2;let s=effective(p,c,who).value;if(s!==null){sum+=s*w;covered++;}});
    return {sum,covered,total};
  }
  function rankingScreen(ps){
    const results=ps.map(p=>{const score=scoreSummary(p,'overall');return {p,pts:score.sum,max:score.total,count:score.covered};})
      .sort((a,b)=>(b.count?b.pts/b.max:-1)-(a.count?a.pts/a.max:-1));
    return '<div class="panel rank-panel swipe-zone">'+results.map((r,i)=>
      '<div class="rank-row '+(i===0&&r.count?'winner':'')+'"><div class="rank-num">'+(r.count?i+1:'–')+'</div><div><div class="rank-name">'+esc(r.p.name)+'</div><span class="meta">'+r.count+'項目を評価済み</span></div><div class="rank-score">'+(r.count?r.pts+'点<small> / '+r.max+'点</small>':'未採点')+'</div></div>'
    ).join('')+'<p class="subtle">重要度で加重した得点です。未採点は0点扱いです。</p></div>';
  }
  function choosePropertiesScreen(){
    let ps=state.properties,n=Math.max(1,Math.ceil(ps.length/4));ui.listPage=Math.min(ui.listPage,n-1);
    return modalFrame('比較する物件（最大3件）','<div class="panel detail grow"><p class="subtle">'+state.selected.length+' / 3件を選択中。選ぶと比較表に表示します。</p><div class="criteria-list">'+ps.slice(ui.listPage*4,ui.listPage*4+4).map(p=>'<button class="criteria-line" data-act="select-property" data-value="'+esc(p.id)+'"><span class="pill">'+(state.selected.includes(p.id)?'✓ 選択中':'○ 選択')+'</span><strong>'+esc(p.name)+'</strong></button>').join('')+'</div>'+navPager(ui.listPage,n,'list-nav')+'</div><button class="btn primary wide" data-act="overlay-close">比較へ戻る</button>');
  }
  function criteriaScreen(){
    const n=Math.max(1,Math.ceil(state.criteria.length/5));ui.criteriaPage=Math.min(ui.criteriaPage,n-1);
    return modalFrame('比較項目を管理','<div class="panel detail grow"><p class="subtle">項目名を押すと詳細・自動評価を編集できます。★は重要度、矢印は表示順です。</p><div class="criteria-list">'+state.criteria.slice(ui.criteriaPage*5,ui.criteriaPage*5+5).map(c=>'<div class="criteria-line"><button class="btn compact flex1" data-act="criterion-edit" data-value="'+esc(c.id)+'" style="justify-content:flex-start;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(truncate(c.name,16))+'</button><button class="btn compact" data-act="criterion-weight" data-value="'+esc(c.id)+'">★'+c.weight+'</button><button class="btn compact" data-act="criterion-move" data-value="'+esc(c.id)+':-1" aria-label="上へ">↑</button><button class="btn compact" data-act="criterion-move" data-value="'+esc(c.id)+':1" aria-label="下へ">↓</button></div>').join('')+'</div>'+navPager(ui.criteriaPage,n,'criteria-nav')+'</div><button class="btn primary wide" data-act="criterion-add">＋ 比較項目を追加</button>');
  }
  function criterionForm(){
    const c=ui.draft,stepN=ui.formStep;const a=c.auto||{field:'',good:'',mid:'',dir:'low'};
    let body=stepN===0?'<div class="field"><label>比較項目名</label><input data-criterion-model="name" maxlength="65" value="'+esc(c.name)+'"></div><div class="field"><label>重要度</label><select data-criterion-model="weight"><option value="1" '+(c.weight===1?'selected':'')+'>★ 1</option><option value="2" '+(c.weight===2?'selected':'')+'>★★ 2</option><option value="3" '+(c.weight===3?'selected':'')+'>★★★ 3</option></select></div>':
      '<p class="subtle">数値基準を設定すると物件情報から自動判定します。空欄なら手動採点です。</p><div class="field"><label>自動判定する値</label><select data-auto="field"><option value="">自動判定しない</option>'+[['price','価格（万円）'],['age','築年数（年）'],['area','面積（㎡）'],['station','駅徒歩（分）']].map(([v,l])=>'<option value="'+v+'" '+(a.field===v?'selected':'')+'>'+l+'</option>').join('')+'</select></div><div class="field"><label>良い数値の方向</label><select data-auto="dir"><option value="low" '+(a.dir==='low'?'selected':'')+'>小さい方が良い（価格・徒歩等）</option><option value="high" '+(a.dir==='high'?'selected':'')+'>大きい方が良い（面積等）</option></select></div><div class="form-grid"><div class="field"><label>○ の基準</label><input type="number" min="0" step="0.1" data-auto="good" value="'+esc(a.good)+'" placeholder="例: 3500"></div><div class="field"><label>△ の基準</label><input type="number" min="0" step="0.1" data-auto="mid" value="'+esc(a.mid)+'" placeholder="例: 4500"></div></div>';
    return modalFrame('比較項目の編集','<div class="panel detail grow form-view"><span class="kicker">STEP '+(stepN+1)+' / 2</span>'+body+'</div><div class="form-foot"><button class="btn flex1" data-act="criterion-back">'+(stepN?'戻る':'キャンセル')+'</button><button class="btn primary flex1" data-act="criterion-next">'+(stepN?'保存':'次へ')+'</button></div>'+(stepN===0 && !c._new?'<button class="btn danger wide" data-act="criterion-delete">この比較項目を削除</button>':''));
  }
  function ratingScreen(){
    const p=propById(ui.scoreProperty),c=state.criteria.find(x=>x.id===ui.scoreCriterion);
    if(!p||!c)return '';
    const current=effective(p,c,'overall');
    return modalFrame('評価する','<div class="panel detail grow form-view"><div><span class="kicker">'+esc(c.name)+'</span><h2 class="section-title">'+esc(p.name)+'</h2></div>'+
      '<p class="subtle">現在：'+mark(current.value)+(current.auto?'（自動判定）':'')+'　評価を選んでください。</p>'+
      '<button class="btn wide gold" data-act="score-set" data-value="2">○　よい（2点）</button>'+
      '<button class="btn wide" data-act="score-set" data-value="1">△　ふつう（1点）</button>'+
      '<button class="btn wide" data-act="score-set" data-value="0">×　気になる（0点）</button>'+
      '<button class="btn wide" data-act="score-set" data-value="clear">評価を解除（自動判定）</button></div>');
  }
  function questionForm(){return modalFrame('営業担当に聞くこと','<div class="panel detail grow form-view"><div class="field"><label>質問（120文字まで）</label><textarea data-question-input maxlength="120" placeholder="例: 長期保証の適用条件は？"></textarea></div><p class="subtle">内見時に確認する質問をリストで管理できます。</p></div><button class="btn primary wide" data-act="question-save">質問を保存</button>');}
  const simNowYear=()=>new Date().getFullYear();
  const yen=(v,d=0)=>Number.isFinite(v)?Number(v).toLocaleString('ja-JP',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';
  const safeNum=(v,fallback=0)=>Number.isFinite(Number(v))?Math.max(0,Number(v)):fallback;
  const mortgageMonthly=(price,down,rate,years)=>{
    const principal=Math.max(0,safeNum(price)-safeNum(down));
    const months=Math.max(12,Math.round(safeNum(years,35)*12));
    const mr=safeNum(rate)/1200;
    return mr===0?principal/months:principal*mr/(1-Math.pow(1+mr,-months));
  };
  const nField=(label,key,unit,placeholder)=>{
    const money=unit.startsWith('万円'),shown=money?fpYenNumber(state.plan[key]):state.plan[key];
    return '<label class="sim-field"><span>'+esc(label)+'</span><span class="sim-input-wrap"><input type="number" data-sim="'+key+
      '" '+(money?'data-sim-yen="true" ':'')+'value="'+esc(shown)+'" min="'+(key==='returnAnnual'?-20:0)+
      '" '+(key==='returnAnnual'?'max="20"':'')+' step="'+(money?'1':'any')+'" inputmode="'+(money?'numeric':'decimal')+
      '" placeholder="'+esc(placeholder||'')+'"><em>'+esc(unit.replace('万円','円'))+'</em></span></label>';
  };
  const sSelect=(label,key,opts)=>'<label class="sim-field"><span>'+esc(label)+'</span><select data-sim="'+key+'">'+opts.map(([value,title])=>'<option value="'+esc(value)+'" '+(String(state.plan[key])===String(value)?'selected':'')+'>'+esc(title)+'</option>').join('')+'</select></label>';

  const simQuestions=[
    ['家族のこれから','年齢と、お子さまの予定を入力'],
    ['収入・働き方','夫婦の手取りと賞与、時短後の収入'],
    ['毎月の家計','生活費・保険・通信・車などの支出'],
    ['子育てと教育','子どもの保険・保育料・生活費'],
    ['住まいとローン','購入価格、頭金、金利、維持費'],
    ['NISAと貯金','現在の資産と毎月の積立を分けて管理'],
    ['年払いと特別支出','税金・旅行・結婚式・追加費用']
  ];
  function fpSection(label,subtitle){return '<div class="fp-form-heading"><strong>'+esc(label)+'</strong>'+(subtitle?'<span>'+esc(subtitle)+'</span>':'')+'</div>';}
  function fpCompactPage(title,fields,hint='',extra=''){
    return {title,html:'<div class="fp-compact-inner"><div class="fp-compact-title">'+esc(title)+'</div>'+
      '<div class="sim-grid">'+fields.join('')+'</div>'+
      (hint?'<p class="fp-field-hint">'+esc(hint)+'</p>':'')+extra+'</div>'};
  }
  function fpExtraEditor(index){
    const expenses=state.plan.expenses||[],start=index*2,items=expenses.slice(start,start+2);
    return '<div class="fp-extra-section"><div class="fp-extra-head"><strong>自由に追加する支出</strong>'+
      '<button class="btn compact" data-act="fp-expense-add" '+(expenses.length>=35?'disabled':'')+'>＋ 追加</button></div>'+
      (items.length?items.map(x=>'<div class="fp-extra-row"><div class="fp-extra-top"><input aria-label="費目" data-fp-id="'+esc(x.id)+'" data-fp-key="name" maxlength="50" value="'+esc(x.name)+'" placeholder="支出名"><button class="fp-extra-remove" data-act="fp-expense-delete" data-value="'+esc(x.id)+'">削除</button></div><div class="fp-extra-values">'+
      '<label>金額（円）<input data-fp-id="'+esc(x.id)+'" data-fp-key="amount" data-fp-yen="true" type="number" min="0" max="100000000" step="1" inputmode="numeric" value="'+fpYenNumber(x.amount)+'"></label>'+
      '<label>周期<select data-fp-id="'+esc(x.id)+'" data-fp-key="cycle"><option value="month" '+(x.cycle==='month'?'selected':'')+'>毎月</option><option value="year" '+(x.cycle==='year'?'selected':'')+'>毎年</option></select></label>'+
      '<label>開始年<input data-fp-id="'+esc(x.id)+'" data-fp-key="start" type="number" min="0" max="2100" value="'+(x.start||'')+'" placeholder="指定なし"></label>'+
      '<label>終了年<input data-fp-id="'+esc(x.id)+'" data-fp-key="end" type="number" min="0" max="2100" value="'+(x.end||'')+'" placeholder="指定なし"></label></div></div>').join(''):
      '<p class="fp-extra-empty">＋ 追加から、習い事・学資保険・仕送りなどを登録できます。</p>')+
      '<p class="fp-field-hint">追加した費用はFPの予算・年間収支に反映されます。</p></div>';
  }
  function fpEventEditor(index){
    const items=(state.plan.events||[]).slice(index*2,index*2+2),total=state.plan.events.length;
    const choices='<div class="fp-event-presets">'+
      '<button data-act="fp-event-add" data-value="wedding">＋ 結婚式</button>'+
      '<button data-act="fp-event-add" data-value="honeymoon">＋ 新婚旅行</button>'+
      '<button data-act="fp-event-add" data-value="custom">＋ その他</button></div>';
    const cards=items.map(x=>'<div class="fp-event-card">'+
      '<div class="fp-event-title"><input data-event-id="'+esc(x.id)+'" data-event-key="name" aria-label="イベント名" maxlength="50" value="'+esc(x.name)+'">'+
      '<button data-act="fp-event-delete" data-value="'+esc(x.id)+'" aria-label="イベントを削除">×</button></div>'+
      '<div class="fp-event-fields"><label>発生年<input data-event-id="'+esc(x.id)+'" data-event-key="year" type="number" min="2020" max="2100" step="1" value="'+esc(x.year)+'"></label>'+
      '<label>金額（円）<input data-event-id="'+esc(x.id)+'" data-event-key="amount" data-fp-yen="true" type="number" min="0" step="1" inputmode="numeric" value="'+fpYenNumber(x.amount)+'"></label>'+
      '<label>発生月<input data-event-id="'+esc(x.id)+'" data-event-key="month" type="number" min="0" max="12" step="1" value="'+esc(x.month||0)+'"></label>'+ 
      '<label>収支<select data-event-id="'+esc(x.id)+'" data-event-key="type"><option value="expense" '+(x.type==='expense'?'selected':'')+'>支出 −</option>'+
      '<option value="income" '+(x.type==='income'?'selected':'')+'>収入 ＋</option></select></label></div></div>').join('');
    return '<div class="fp-event-editor"><div class="fp-compact-title">予定イベント｜'+total+'件</div>'+choices+
      (cards||'<div class="fp-event-empty">結婚式・新婚旅行などを登録。発生年の現金残高に反映します。</div>')+
      '<p class="fp-field-hint">月が0なら発生月未指定。月別収入では12か月で均等割りする概算です。結婚式・旅行の二重計上は防止します。</p></div>';
  }
  function fpWizardPages(i){
    const p=state.plan;
    const f=(title,key,unit='万円/月')=>nField(title,key,unit);
    const pages=[];
    if(i===0)pages.push(fpCompactPage('家族のこれから',[
      f('夫の年齢','husbandAge','歳'),f('妻の年齢','wifeAge','歳'),
      sSelect('子どもの人数','children',[[0,'予定なし'],[1,'1人'],[2,'2人'],[3,'3人']]),
      f('第1子の予定年','firstChildYear','年'),f('きょうだいの年齢差','birthInterval','年'),
      f('妻の時短中の月手取り','wifeReduced','万円/月')
    ]));
    if(i===1){
      pages.push(fpCompactPage('収入と給付金',[
        f('夫・月手取り','husbandMonthly'),f('妻・月手取り','wifeMonthly'),
        f('夫・年間賞与','husbandBonus','万円/年'),f('妻・年間賞与','wifeBonus','万円/年'),
        f('子ども関連の給付金','childBenefitMonthly','万円/人月')
      ],'子ども関連の給付金は受給条件の自動判定を行いません。'));
      pages.push(fpCompactPage('賞与の支給月',[
        f('夫・賞与①','husbandBonusMonth1','月'),f('夫・賞与②','husbandBonusMonth2','月'),
        f('妻・賞与①','wifeBonusMonth1','月'),f('妻・賞与②','wifeBonusMonth2','月')
      ],'年間賞与を2回均等配分。1回だけなら②を0に設定。両方0の場合は12月に一括計上します。'));
    }
    if(i===2){
      pages.push(fpCompactPage('食費・家賃の内訳',[
        f('食費','foodMonthly'),f('家賃（賃料）','rentMonthly'),
        f('管理費','managementMonthly'),f('共益費','commonFeeMonthly'),
        f('駐車場代','parkingMonthly')
      ],'家賃は賃料のみ入力。管理費・共益費・駐車場の二重計上に注意してください。'));
      pages.push(fpCompactPage('電気・ガス・水道',[
        f('電気代','electricityMonthly'),f('ガス代','gasMonthly'),
        f('水道（2か月の請求額）','waterBiMonthly','万円/2か月')
      ],'水道は2か月ごとの請求額を入力。月平均＝÷2、年間＝×6。',safeNum(p.utilitiesMonthly)>0?
        '<div class="fp-legacy-note">旧・光熱費合算 '+fpYen(p.utilitiesMonthly)+'/月。上の内訳を入力すると合算額の代わりに使います。<button data-act="fp-legacy-utilities-clear">旧合算を削除</button></div>':''));
      pages.push(fpCompactPage('毎日の支払い',[
        f('その他の生活費','livingMonthly'),f('自由費','freeSpendingMonthly'),f('通信・スマホ','telecomMonthly'),
        f('交通・ガソリン','transportMonthly'),f('サブスク','subscriptionsMonthly'),
        f('外食・レジャー','leisureMonthly'),f('通院・薬代','medicalMonthly'),
        f('車維持・車検積立','carMaintenanceMonthly')
      ],'その他の生活費に食費・外食などを重複して含めないでください。'));
      pages.push(fpCompactPage('保険・ローン',[
        f('夫婦の生命保険','lifeInsuranceMonthly'),f('医療・がん保険','medicalInsuranceMonthly'),
        f('自動車保険','carInsuranceMonthly'),f('自動車ローン','carMonthly'),
        f('車ローン終了年','carLoanEndYear','年'),
        f('その他のローン','otherLoanMonthly'),f('他ローン終了年','otherLoanEndYear','年')
      ],'ローン終了年が0の場合は支払いが続く設定です。'));
    }
    if(i===3)pages.push(fpCompactPage('子育てと教育費',[
      f('子どもの保険（1人）','childInsuranceMonthly'),
      f('生活・衣服・習い事（1人）','childLivingMonthly'),
      f('保育料・幼稚園（1人）','daycareMonthly'),
      f('学資保険（1人）','childEducationInsuranceMonthly'),
      sSelect('高校','highSchool',[['public','公立'],['private','私立']]),
      sSelect('大学','university',[['public','国公立'],['private','私立']])
    ],'学資保険は誕生〜17歳まで人数分計上。満期金は自動加算しません（別途登録）。'));
    if(i===4){
      const options=[['','価格を直接入力'],...state.properties.filter(x=>num(x.price)!==null).map(x=>[x.id,truncate(x.name,17)+' / '+fpYen(x.price)])];
      pages.push(fpCompactPage('購入予定',[
        sSelect('登録物件から選択','propertyId',options),
        f('購入予定価格','propertyPrice','万円'),f('購入予定年','purchaseYear','年'),
        sSelect('購入予定月','purchaseMonth',Array.from({length:12},(_,i)=>[i+1,(i+1)+'月'])),
        f('頭金','downPayment','万円')
      ],'指定した購入月までは家賃、購入月から住宅ローン＋維持費に切り替えます。購入諸費用は物件価格の7％で仮計算。'));
      pages.push(fpCompactPage('住宅ローン・維持費',[
        f('金利（仮定）','interest','％'),f('返済期間','loanYears','年'),
        f('固定資産税・修繕等','housingOngoing'),
        f('住宅火災保険','homeInsuranceAnnual','万円/年')
      ],'税金・修繕費と火災保険は重複入力しないでください。'));
    }
    if(i===5){
      pages.push(fpCompactPage('現在の貯金と資産',[
        f('現在の普通預金など','cashSavings','万円'),
        f('今後受け取る援助','support','万円'),
        f('現在のNISA評価額','nisaBalance','万円'),
        f('その他投資の残高','investBalance','万円')
      ]));
      pages.push(fpCompactPage('毎月の貯蓄・積立',[
        f('毎月NISAへ積立','nisaMonthly'),
        f('その他投資の積立','otherInvestMonthly'),
        f('現金貯金目標','otherSavingsMonthly'),
        f('運用利回り（仮定）','returnAnnual','％/年'),
        f('毎月の余裕費','cashBufferMonthly')
      ],'NISA積立は支出ではなく現金から投資資産への振替です。'));
    }
    if(i===6){
      pages.push(fpCompactPage('年払いの支出',[
        f('自動車税・年払い','carTaxAnnual','万円/年'),
        f('旅行・帰省','travelAnnual','万円/年'),
        f('手取りに含まれない税金','annualTax','万円/年'),
        f('冠婚葬祭・家電','annualEvents','万円/年')
      ]));
      pages.push(fpCompactPage('結婚式・特別支出',[
        f('結婚式支払年','weddingYear','年'),
        ...(p.events.some(x=>x.kind==='wedding')?[]:[f('結婚式自己負担','weddingCost','万円')]),
        ...(p.events.some(x=>x.kind==='honeymoon')?[]:[f('新婚旅行費','honeymoonCost','万円')]),
        f('試算終了年','simulateUntil','年')
      ],'イベント登録済みの結婚式・旅行費用は「イベント登録」で編集。以前の入力と二重に加算しません。'));
      const eventsCount=Math.max(1,Math.ceil((p.events||[]).length/2));
      for(let n=0;n<eventsCount;n++)pages.push({title:'イベント登録 '+(n+1)+' / '+eventsCount,html:fpEventEditor(n)});
      const count=Math.max(1,Math.ceil(p.expenses.length/2));
      for(let n=0;n<count;n++)pages.push({title:'自由に追加 '+(n+1)+' / '+count,html:fpExtraEditor(n)});
    }
    return pages;
  }
  function fpPageNav(count,current,action,labels=null){
    if(count<=1)return '';
    return '<div class="fp-page-nav" aria-label="表示ページを選択">'+
      (count<=4?Array.from({length:count},(_,n)=>
        '<button data-act="'+action+'" data-value="'+n+'" class="'+(n===current?'active':'')+'">'+
        esc(labels?.[n]||String(n+1))+'</button>').join(''):
        '<button data-act="'+action+'" data-value="'+Math.max(0,current-1)+'" '+(!current?'disabled':'')+'>‹ 前</button>'+
        '<span>'+Number(current+1)+' / '+count+'</span>'+
        '<button data-act="'+action+'" data-value="'+Math.min(count-1,current+1)+'" '+(current===count-1?'disabled':'')+'>次 ›</button>')+
      '</div>';
  }
  function fpHistoryScreen(){
    const list=state.planHistory||[],pageSize=3,total=Math.max(1,Math.ceil(list.length/pageSize));
    ui.fpHistoryPage=Math.max(0,Math.min(total-1,ui.fpHistoryPage||0));
    const page=list.slice(ui.fpHistoryPage*pageSize,(ui.fpHistoryPage+1)*pageSize);
    const cards=page.map((x,i)=>'<button class="fp-history-item" data-act="fp-history-select" data-value="'+esc(x.id)+'">'+
      '<span><strong>'+esc(fpHistoryDate(x))+'</strong><small>物件価格 '+fpYen(Number(x.plan.propertyPrice)||0)+'・'+yen(Number(x.plan.loanYears)||35,0)+'年ローン</small></span>'+
      '<b>'+(x.id===(fpLatestSnapshot()?.id)?'表示中':'表示 ›')+'</b></button>').join('');
    return '<section class="screen sim-screen fp-result-screen fp-history-screen">'+
      '<div class="sim-intro"><span class="kicker">FP • HISTORY / r10</span><button class="btn compact" data-act="fp-history-close">閉じる ×</button></div>'+
      '<h2 class="sim-result-title">過去の診断結果</h2>'+
      '<p class="fp-r-help">条件を保存した時点の結果を確認できます。過去の入力条件は変更されません。</p>'+
      '<div class="fp-history-items grow">'+cards+'</div>'+
      fpPageNav(total,ui.fpHistoryPage,'fp-history-page')+
      '<div class="fp-bottom-actions"><button class="btn" data-act="fp-history-close">結果へ戻る</button>'+
      '<button class="btn primary" data-act="sim-restart">＋ 新しい診断</button></div></section>';
  }
  function simulationScreen(){
    const i=ui.simStep;
    if(i>=7){
      if(ui.fpHistoryOpen)return fpHistoryScreen();
      const snap=fpLatestSnapshot();
      if(!snap||ui.fpHistoryLive)return simulationResultsScreen();
      const workingPlan=state.plan;
      try{state.plan=snap.plan;return simulationResultsScreen(snap);}
      finally{state.plan=workingPlan;}
    }
    const p=state.plan,pages=fpWizardPages(i);
    ui.simSubPage=Math.max(0,Math.min(pages.length-1,Number(ui.simSubPage)||0));
    const n=ui.simSubPage;
    const labels=i===2?['食費・住居','水道光熱','日常費','保険等']:i===4?['購入','維持費']:i===5?['資産','積立']:null;
    return '<section class="screen sim-screen fp-wizard-screen"><div class="sim-intro"><span class="kicker">FP • LIFE SIMULATOR / r15</span>'+
      (p.hasRun?'<button class="fp-recall-btn" data-act="fp-view-budget">前回の診断を見る ↗</button>':'<span class="sim-progress-text">'+(i+1)+' / 7</span>')+
      '</div><div class="sim-progress">'+Array.from({length:7},(_,x)=>'<span class="'+(x<=i?'filled':'')+'"></span>').join('')+'</div>'+
      '<div class="sim-question"><h2>'+simQuestions[i][0]+'</h2><p>'+simQuestions[i][1]+'</p></div>'+
      fpPageNav(pages.length,n,'fp-form-page',labels)+
      '<div class="panel sim-form grow fp-wizard-body">'+pages[n].html+'</div>'+
      '<div class="sim-footer"><button class="btn" data-act="sim-back" '+(i===0?'disabled':'')+'>前の質問</button>'+
      '<button class="btn primary" data-act="sim-next">'+(i===6?'診断する':'次の質問 →')+'</button></div></section>';
  }
  function educationAnnual(age,p){
    if(age<6 || age>=22)return 0; // preschool is modeled separately as daycare
    if(age<12)return 34;
    if(age<15)return 55;
    if(age<18)return p.highSchool==='private'?135:60;
    return p.university==='private'?185:125;
  }
  const fpDetailCategories=[
    ['foodMonthly','食費'],['electricityMonthly','電気'],['gasMonthly','ガス'],['waterBiMonthly','水道（2か月ごと）'],
    ['livingMonthly','その他の生活費'],['telecomMonthly','通信'],['transportMonthly','交通'],
    ['subscriptionsMonthly','サブスク'],['leisureMonthly','レジャー'],['lifeInsuranceMonthly','生命保険'],
    ['medicalInsuranceMonthly','医療保険'],['carInsuranceMonthly','自動車保険'],
    ['medicalMonthly','医療費'],['carMaintenanceMonthly','車維持費']
  ];
  function fpChildCounts(year){
    const p=state.plan,kids=Math.min(3,Math.round(safeNum(p.children)));
    let preschool=0,living=0,insured=0,educationInsured=0;
    for(let k=0;k<kids;k++){
      const age=year-(safeNum(p.firstChildYear)+k*Math.max(1,safeNum(p.birthInterval,3)));
      if(age>=0&&age<6)preschool++;
      if(age>=0&&age<18)living++;
      if(age>=0&&age<23)insured++;
      if(age>=0&&age<18)educationInsured++;
    }
    return {preschool,living,insured,educationInsured};
  }
  function fpEventsForYear(year){
    const p=state.plan,yearly=(p.events||[]).filter(x=>x.year===year),
      hasWedding=(p.events||[]).some(x=>x.kind==='wedding'),
      hasHoneymoon=(p.events||[]).some(x=>x.kind==='honeymoon');
    const fallback=[];
    if(year===safeNum(p.weddingYear)){
      if(!hasWedding&&safeNum(p.weddingCost))fallback.push({id:'legacy-wedding',name:'結婚式',amount:safeNum(p.weddingCost),type:'expense'});
      if(!hasHoneymoon&&safeNum(p.honeymoonCost))fallback.push({id:'legacy-honeymoon',name:'新婚旅行',amount:safeNum(p.honeymoonCost),type:'expense'});
    }
    return [...yearly,...fallback];
  }
  function fpEventsAnnual(year,type='expense'){
    return fpEventsForYear(year).filter(x=>x.type===type).reduce((sum,x)=>sum+safeNum(x.amount),0);
  }
  function fpRecordHistory(){
    const copy=JSON.parse(JSON.stringify(state.plan));
    copy.hasRun=1;
    const entry={id:uid(),created:Date.now(),plan:copy};
    state.planHistory=[entry,...(state.planHistory||[])].slice(0,24);
    ui.fpHistoryId=entry.id;ui.fpHistoryOpen=false;ui.fpHistoryPage=0;ui.fpHistoryLive=true;
  }
  function fpLatestSnapshot(){
    const list=state.planHistory||[];
    return list.find(x=>x.id===ui.fpHistoryId)||list[0]||null;
  }
  function fpHistoryDate(snapshot){
    if(!snapshot?.created)return '旧診断（保存日時不明）';
    const stamp=new Date(snapshot.created);
    return Number.isFinite(stamp.getTime())?stamp.toLocaleString('ja-JP',{
      year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'
    }):'旧診断（日時不明）';
  }
  function fpCustomAnnual(year){
    return (state.plan.expenses||[]).reduce((sum,x)=>{
      if(x.start&&year<x.start)return sum;
      if(x.end&&year>x.end)return sum;
      return sum+safeNum(x.amount)*(x.cycle==='year'?1:12);
    },0);
  }
  const fpRentMonthly=p=>['rentMonthly','managementMonthly','commonFeeMonthly','parkingMonthly'].reduce((sum,key)=>sum+safeNum(p[key]),0);
  function fpBaseMonthly(year){
    const p=state.plan,parts=fpDetailCategories.map(([key,label])=>({key,label,value:key==='waterBiMonthly'?safeNum(p[key])/2:safeNum(p[key])}));
    parts.push({key:'freeSpendingMonthly',label:'自由費',value:safeNum(p.freeSpendingMonthly)});
    // Before separate utility fields existed, a single amount was stored. Count either the old total or the new breakdown, never both.
    if(!['electricityMonthly','gasMonthly','waterBiMonthly'].some(key=>safeNum(p[key])>0) && safeNum(p.utilitiesMonthly)>0)
      parts.push({key:'utilitiesMonthly',label:'旧・光熱費合計',value:safeNum(p.utilitiesMonthly)});
    if(!safeNum(p.carLoanEndYear)||year<=safeNum(p.carLoanEndYear))parts.push({key:'carMonthly',label:'車ローン',value:safeNum(p.carMonthly)});
    if(!safeNum(p.otherLoanEndYear)||year<=safeNum(p.otherLoanEndYear)){
      parts.push({key:'otherLoanMonthly',label:'その他のローン',value:safeNum(p.otherLoanMonthly)});
    }
    const count=fpChildCounts(year);
    parts.push({key:'childInsuranceMonthly',label:'子どもの保険',value:count.insured*safeNum(p.childInsuranceMonthly)});
    parts.push({key:'childEducationInsuranceMonthly',label:'学資保険',value:count.educationInsured*safeNum(p.childEducationInsuranceMonthly)});
    parts.push({key:'childLivingMonthly',label:'子どもの生活費',value:count.living*safeNum(p.childLivingMonthly)});
    parts.push({key:'daycareMonthly',label:'保育料・幼稚園',value:count.preschool*safeNum(p.daycareMonthly)});
    return parts;
  }
  const fpIncomeCategories=[
    ['husbandPay','夫の給与'],['wifePay','妻の給与'],
    ['husbandBonus','夫の賞与'],['wifeBonus','妻の賞与'],
    ['childBenefits','子どもの給付金'],['eventIncome','臨時収入・その他']
  ];
  function fpMonthlyIncome(year,month){
    const p=state.plan,m=Math.round(Number(month)||1);
    const kids=Math.min(3,Math.round(safeNum(p.children)));
    const afterBirth=kids>0&&year>=safeNum(p.firstChildYear);
    const wife=afterBirth?(year===safeNum(p.firstChildYear)?
      Math.min(safeNum(p.wifeMonthly),10):safeNum(p.wifeReduced)):safeNum(p.wifeMonthly);
    const bonusPay=(amount,m1,m2)=>{
      const months=[m1,m2].map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=12);
      const used=months.length?months:[12];
      return used.filter(n=>n===m).length/used.length*safeNum(amount);
    };
    const eventIncome=(p.events||[]).filter(x=>x.type==='income'&&x.year===year)
      .reduce((sum,x)=>sum+(!x.month?safeNum(x.amount)/12:(x.month===m?safeNum(x.amount):0)),0);
    const fields={
      husbandPay:safeNum(p.husbandMonthly),
      wifePay:wife,
      husbandBonus:bonusPay(p.husbandBonus,p.husbandBonusMonth1,p.husbandBonusMonth2),
      wifeBonus:afterBirth?0:bonusPay(p.wifeBonus,p.wifeBonusMonth1,p.wifeBonusMonth2),
      childBenefits:fpChildCounts(year).living*safeNum(p.childBenefitMonthly),
      eventIncome
    };
    const total=Object.values(fields).reduce((sum,x)=>sum+x,0);
    return {year,month:m,fields,total};
  }
  function fpYearlyIncome(year){
    const months=Array.from({length:12},(_,i)=>fpMonthlyIncome(year,i+1));
    const fields=Object.fromEntries(fpIncomeCategories.map(([key])=>[
      key,months.reduce((sum,x)=>sum+x.fields[key],0)
    ]));
    return {year,months,fields,total:months.reduce((sum,x)=>sum+x.total,0)};
  }
  // Origination month affects both annual balances and cashflow within a year.
  function fpPurchaseMonth(){
    return Math.max(1,Math.min(12,Math.round(Number(state.plan.purchaseMonth)||1)));
  }
  function fpOwnsHomeAt(year,month){
    const purchaseYear=Math.round(safeNum(state.plan.purchaseYear,simNowYear()+2));
    return year>purchaseYear || (year===purchaseYear && month>=fpPurchaseMonth());
  }
  function fpAmortization(price,rateShift=0){
    const p=state.plan,years=Math.max(1,Math.round(safeNum(p.loanYears,35))),
      start=Math.round(safeNum(p.purchaseYear,simNowYear()+2)),startMonth=fpPurchaseMonth(),
      principal=Math.max(0,safeNum(price)-safeNum(p.downPayment)),
      interestRate=safeNum(p.interest)+rateShift,rate=interestRate/1200,
      payment=mortgageMonthly(price,p.downPayment,interestRate,years);
    let balance=principal;
    const months=[],yearsMap=new Map();
    for(let i=0;i<years*12&&balance>1e-9;i++){
      const index=startMonth-1+i,year=start+Math.floor(index/12),month=index%12+1;
      const interest=balance*rate;
      const principalPaid=Math.min(balance,Math.max(0,payment-interest));
      const paid=principalPaid+interest;
      balance=Math.max(0,balance-principalPaid);
      const entry={year,month,balance,interest,principalPaid,payment:paid};
      months.push(entry);
      if(!yearsMap.has(year))yearsMap.set(year,{year,balance:0,interest:0,principalPaid:0,payment:0});
      const row=yearsMap.get(year);
      row.balance=balance;row.interest+=interest;row.principalPaid+=principalPaid;row.payment+=paid;
    }
    const points=[{year:start-1,balance:principal,interest:0,principalPaid:0,payment:0},
      ...Array.from(yearsMap.values()).sort((a,b)=>a.year-b.year)];
    return {points,months,principal,monthly:payment,rate:interestRate,years,start,startMonth};
  }
  function modelYears(price,buy){
    const p=state.plan,start=simNowYear(),
      end=Math.max(start+9,Math.min(start+30,safeNum(p.simulateUntil,start+19))),
      purchaseYear=Math.round(safeNum(p.purchaseYear,start+2)),
      purchaseMonth=fpPurchaseMonth(),
      amort=fpAmortization(price),payment=amort.monthly;
    const loanByYear=new Map(amort.points.map(x=>[x.year,x]));
    const loanByMonth=new Map(amort.months.map(x=>[x.year+'-'+x.month,x.payment]));
    let cash=safeNum(p.cashSavings)+safeNum(p.support);
    let nisa=safeNum(p.nisaBalance),otherInvest=safeNum(p.investBalance);
    let investedContributions=0;
    const points=[],kids=Math.min(3,Math.round(safeNum(p.children)));
    const annualGrowth=1+Math.min(.2,Math.max(-.2,Number(p.returnAnnual)||0)/100);
    for(let year=start;year<=end;year++){
      const children=fpChildCounts(year);
      const income=fpYearlyIncome(year).total;
      const monthlyParts=fpBaseMonthly(year);
      const loan=buy&&year>=purchaseYear?loanByYear.get(year):null;
      const housingMonths=Array.from({length:12},(_,index)=>{
        const month=index+1;
        if(!buy||year<purchaseYear||(year===purchaseYear&&month<purchaseMonth))
          return fpRentMonthly(p);
        return (loanByMonth.get(year+'-'+month)||0)+safeNum(p.housingOngoing);
      });
      const ownedMonths=buy?(year>purchaseYear?12:year===purchaseYear?13-purchaseMonth:0):0;
      const rentMonths=12-ownedMonths;
      const housingLoan=buy?(loan?.payment||0):0;
      const housingMaintenance=ownedMonths*safeNum(p.housingOngoing);
      const housingRent=rentMonths*fpRentMonthly(p);
      const housing=housingMonths.reduce((sum,x)=>sum+x,0)/12;
      const monthly=monthlyParts.reduce((sum,x)=>sum+x.value,0)+housing;
      const annualFixed=safeNum(p.annualTax)+safeNum(p.carTaxAnnual)+safeNum(p.travelAnnual)+
        safeNum(p.annualEvents)+(ownedMonths>0?safeNum(p.homeInsuranceAnnual):0)+fpCustomAnnual(year);
      let school=0,birth=0;
      for(let child=0;child<kids;child++){
        const age=year-(safeNum(p.firstChildYear)+child*Math.max(1,safeNum(p.birthInterval,3)));
        if(age===0)birth+=50;
        school+=educationAnnual(age,p);
      }
      const upfront=buy&&year===purchaseYear?safeNum(p.downPayment)+safeNum(price)*.07:0;
      const events=fpEventsAnnual(year,'expense');
      const expenses=monthly*12+annualFixed+school+birth+upfront+events;
      const nisaAdd=12*safeNum(p.nisaMonthly),otherAdd=12*safeNum(p.otherInvestMonthly);
      const investing=nisaAdd+otherAdd;
      cash+=income-expenses-investing;
      nisa=Math.max(0,(nisa+nisaAdd)*annualGrowth);
      otherInvest=Math.max(0,(otherInvest+otherAdd)*annualGrowth);
      investedContributions+=investing;
      const invested=nisa+otherInvest;
      points.push({year,cash,invested,nisa,otherInvest,total:cash+invested,
        incomes:income,expenses,investing,netCash:income-expenses-investing,
        monthly,school,birth,annualFixed,upfront,events,housing,housingMonths,
        housingLoan,housingMaintenance,housingRent,ownedMonths,rentMonths,
        education:school,monthlyParts,children,contributions:investedContributions,
        loanBalance:loan?.balance||0,loanPrincipal:loan?.principalPaid||0,loanInterest:loan?.interest||0});
    }
    return {points,monthly:payment,purchaseYear,purchaseMonth,ending:points.at(-1).cash,
      min:Math.min(...points.map(x=>x.cash)),nisa,otherInvest};
  }
  function fpDecisionYear(){
    const p=state.plan,kids=Math.min(3,Math.round(safeNum(p.children)));
    const lastBirth=safeNum(p.firstChildYear)+Math.max(0,kids-1)*Math.max(1,safeNum(p.birthInterval,3));
    return Math.max(simNowYear(),safeNum(p.purchaseYear,simNowYear()+2),kids?lastBirth:0);
  }
  function fpAnnualExtras(year,buy=true){
    const p=state.plan;
    return safeNum(p.annualTax)+safeNum(p.carTaxAnnual)+safeNum(p.travelAnnual)+
      safeNum(p.annualEvents)+fpCustomAnnual(year)+(buy?safeNum(p.homeInsuranceAnnual):0);
  }
  function fpSpendingMonthly(year){
    return fpBaseMonthly(year).reduce((sum,x)=>sum+x.value,0)+fpAnnualExtras(year,true)/12;
  }
  function fpForecast(price,extraInterest=0){
    const p=state.plan,cost=Math.max(0,safeNum(price));
    const rate=Math.max(0,safeNum(p.interest)+extraInterest);
    const payment=mortgageMonthly(cost,p.downPayment,rate,p.loanYears);
    const income=safeNum(p.husbandMonthly)+(safeNum(p.children)>0
      ?Math.min(safeNum(p.wifeMonthly),safeNum(p.wifeReduced)):safeNum(p.wifeMonthly));
    const housing=payment+safeNum(p.housingOngoing);
    const ratio=income>0?housing/income:Infinity;
    const recurring=fpSpendingMonthly(fpDecisionYear());
    const investing=safeNum(p.nisaMonthly)+safeNum(p.otherInvestMonthly);
    const spendable=income-recurring-investing-housing;
    const upfront=safeNum(p.downPayment)+cost*.07;
    const remaining=safeNum(p.cashSavings)+safeNum(p.support)-upfront;
    const reserve=6*(recurring+housing);
    return {price:cost,rate,payment,income,housing,ratio,spendable,upfront,remaining,reserve,recurring,investing};
  }
  function fpBudget(){
    const p=state.plan,monthlyIncome=fpForecast(0).income;
    const spending=fpSpendingMonthly(fpDecisionYear());
    const investing=safeNum(p.nisaMonthly)+safeNum(p.otherInvestMonthly);
    const cap=Math.min(monthlyIncome*.25,monthlyIncome-spending-investing-safeNum(p.cashBufferMonthly)-safeNum(p.otherSavingsMonthly));
    const loanPayment=Math.max(0,cap-safeNum(p.housingOngoing));
    const term=Math.max(12,Math.round(safeNum(p.loanYears,35)*12));
    const loanCap=rate=>{
      const r=Math.max(0,rate)/1200;
      return r===0?loanPayment*term:loanPayment*(1-Math.pow(1+r,-term))/r;
    };
    const amount=Math.max(0,Math.floor((loanCap(safeNum(p.interest))+safeNum(p.downPayment))/50)*50);
    const stressAmount=Math.max(0,Math.floor((loanCap(safeNum(p.interest)+1)+safeNum(p.downPayment))/50)*50);
    return {amount,stressAmount,monthlyIncome,housingLimit:monthlyIncome*.25,loanPayment,spending,investing,referenceYear:fpDecisionYear()};
  }
  function fpRating(price){
    const info=fpForecast(price),budget=fpBudget(),stressed=fpForecast(price,1);
    let level='good',label='予算内',reason='住居費と日常の支払いが将来の手取りの範囲内です。';
    if(!Number.isFinite(info.ratio)||info.ratio>.30||price>budget.amount*1.2){
      level='bad';label='予算超過';reason='将来の手取りに対して住居費や生活費の負担が大きくなっています。';
    }else if(info.ratio>.25||price>budget.amount){
      level='warn';label='慎重に';reason='保険・子育て・NISAを含めた参考予算を超えています。';
    }
    if(info.spendable<safeNum(state.plan.cashBufferMonthly)+safeNum(state.plan.otherSavingsMonthly)&&level==='good'){
      level='warn';label='家計確認';reason='毎月の保険・子育て・積立を引くと、余裕費が不足します。';
    }
    if(info.remaining<0&&level==='good'){
      level='warn';label='資金確認';reason='月々は目安内ですが、頭金・購入諸費用の現金が不足します。';
    }
    return {...info,budget,stressed,level,label,reason,monthlyDelta:stressed.payment-info.payment};
  }
  // Values in the FP model are in 10,000-yen units. Never silently interpret
  // unexpectedly large inputs as yen or overwrite the user's stored records.
  // Instead, point directly to the field that needs confirmation.
  function fpPlanWarnings(){
    const p=state.plan,problems=[];
    const groups=[
      {step:1,page:0,limit:150,keys:[['husbandMonthly','夫の月手取り'],['wifeMonthly','妻の月手取り'],['wifeReduced','妻の時短手取り']]},
      {step:1,page:0,limit:2000,keys:[['husbandBonus','夫の年間賞与'],['wifeBonus','妻の年間賞与']]},
      {step:2,page:0,limit:100,keys:[['foodMonthly','食費'],['rentMonthly','家賃'],['managementMonthly','管理費'],['commonFeeMonthly','共益費'],['parkingMonthly','駐車場代']]},
      {step:2,page:1,limit:100,keys:[['electricityMonthly','電気代'],['gasMonthly','ガス代'],['waterBiMonthly','水道代（2か月分）']]},
      {step:2,page:2,limit:100,keys:[['livingMonthly','その他生活費'],['freeSpendingMonthly','自由費'],['telecomMonthly','通信費'],['transportMonthly','交通費'],['subscriptionsMonthly','サブスク'],['leisureMonthly','外食・レジャー'],['medicalMonthly','医療費'],['carMaintenanceMonthly','車維持費']]},
      {step:2,page:3,limit:100,keys:[['lifeInsuranceMonthly','生命保険'],['medicalInsuranceMonthly','医療保険'],['carInsuranceMonthly','自動車保険'],['carMonthly','自動車ローン'],['otherLoanMonthly','その他ローン']]},
      {step:3,page:0,limit:100,keys:[['childInsuranceMonthly','子どもの保険'],['childEducationInsuranceMonthly','学資保険'],['childLivingMonthly','子どもの生活費'],['daycareMonthly','保育料']]},
      {step:4,page:1,limit:100,keys:[['housingOngoing','固定資産税・修繕費']]},
      {step:5,page:1,limit:100,keys:[['nisaMonthly','NISA積立'],['otherInvestMonthly','その他の投資'],['otherSavingsMonthly','現金貯金目標'],['cashBufferMonthly','余裕費']]},
      {step:6,page:0,limit:1200,keys:[['annualTax','年払い税金'],['carTaxAnnual','自動車税'],['travelAnnual','旅行・帰省'],['annualEvents','年内イベント']]},
      {step:6,page:1,limit:3000,keys:[['weddingCost','結婚式自己負担'],['honeymoonCost','新婚旅行費']]},
      {step:4,page:0,limit:100000,keys:[['propertyPrice','物件価格'],['downPayment','頭金']]},
      {step:5,page:0,limit:100000,keys:[['cashSavings','預貯金'],['support','援助'],['nisaBalance','NISA評価額'],['investBalance','その他投資残高']]}
    ];
    for(const group of groups)for(const [key,label] of group.keys){
      const v=Number(p[key]);
      if(!Number.isFinite(v)||v<0 || v>group.limit)
        problems.push({label,amount:p[key],unit:group.step===6?'万円/年':'万円',step:group.step,page:group.page});
    }
    for(const [key,label] of [['husbandBonusMonth1','夫の賞与①支給月'],['husbandBonusMonth2','夫の賞与②支給月'],['wifeBonusMonth1','妻の賞与①支給月'],['wifeBonusMonth2','妻の賞与②支給月']]){
      const m=Number(p[key]);if(!Number.isInteger(m)||m<0||m>12)
        problems.push({label,amount:p[key],unit:'月（0～12）',step:1,page:1});
    }
    // Historical single-field utilities are used only until the split fields are populated.
    if(!['electricityMonthly','gasMonthly','waterBiMonthly'].some(k=>safeNum(p[k])>0)&&safeNum(p.utilitiesMonthly)>100)
      problems.push({label:'旧・光熱費合算',amount:p.utilitiesMonthly,unit:'万円/月',step:2,page:1});
    if(!Number.isFinite(Number(p.loanYears))||Number(p.loanYears)<1||Number(p.loanYears)>50)
      problems.push({label:'住宅ローン返済期間',amount:p.loanYears,unit:'年',step:4,page:1});
    if(!Number.isFinite(Number(p.interest))||Number(p.interest)<0||Number(p.interest)>20)
      problems.push({label:'金利',amount:p.interest,unit:'%',step:4,page:1});
    for(let i=0;i<(p.expenses||[]).length;i++){
      const x=p.expenses[i],limit=x.cycle==='year'?1200:100;
      if(!Number.isFinite(Number(x.amount))||Number(x.amount)<0||Number(x.amount)>limit)
        problems.push({label:x.name||'追加支出',amount:x.amount,unit:x.cycle==='year'?'万円/年':'万円/月',step:6,page:2+Math.max(1,Math.ceil((p.events||[]).length/2))+Math.floor(i/2)});
    }
    for(let i=0;i<(p.events||[]).length;i++){
      const event=p.events[i];
      if(!Number.isFinite(Number(event.amount))||Number(event.amount)<0||Number(event.amount)>5000||
        !Number.isInteger(Number(event.year))||event.year<2020||event.year>2100)
        problems.push({label:event.name||'イベント',amount:event.amount,unit:'万円',step:6,page:2+Math.floor(i/2)});
    }
    return problems;
  }
  function fpLoanSummary(price){
    const p=state.plan;
    if(!Number.isFinite(Number(p.loanYears))||Number(p.loanYears)<1||Number(p.loanYears)>50||
      !Number.isFinite(Number(p.interest))||Number(p.interest)<0||Number(p.interest)>20)
      return '<div class="fp-repayment-card"><div class="fp-repayment-eyebrow">住宅ローンの返済額</div>'+
        '<div class="fp-repayment-terms">金利・返済年数を確認してください</div></div>';
    const years=Math.max(1,Math.min(50,safeNum(p.loanYears,35))),
      principal=Math.max(0,safeNum(price)-safeNum(p.downPayment)),
      rate=safeNum(p.interest),payment=mortgageMonthly(price,p.downPayment,rate,years);
    return '<div class="fp-repayment-card">'+
      '<div class="fp-repayment-eyebrow">住宅ローンの毎月返済（元利均等）</div>'+
      '<div class="fp-repayment-value">'+fpYen(payment)+'<span>/ 月</span></div>'+
      '<div class="fp-repayment-terms">借入 '+fpYen(principal)+'　｜　'+yen(years,0)+'年ローン　｜　年利 '+yen(rate,2)+'%</div>'+
      '<div class="fp-repayment-detail"><span>住居維持費を加えると</span><strong>'+fpYen(payment+safeNum(p.housingOngoing))+' / 月</strong></div>'+
      '<div class="fp-repayment-detail"><span>ローン総返済額</span><strong>'+fpYen(payment*years*12)+'</strong></div>'+
      '<div class="fp-repayment-note">ボーナス返済なし・金利一定。固定資産税・火災保険などは別途。</div></div>';
  }
  function fpBadgeClass(level){return level==='good'?'fp-good':level==='warn'?'fp-warn':'fp-bad';}
  function fpRatingRow(p){
    const price=num(p.price);
    if(price===null)return '<div class="fp-home-row"><span class="fp-home-name">'+esc(p.name)+'</span><span class="fp-home-badge fp-neutral">価格未登録</span></div>';
    const check=fpRating(price);
    return '<button class="fp-home-row" data-act="fp-open-home" data-value="'+esc(p.id)+'"><span class="fp-home-name">'+esc(p.name)+'</span><span class="fp-home-price">'+fpYen(price)+'</span><span class="fp-home-badge '+fpBadgeClass(check.level)+'">'+check.label+'</span><span class="fp-chevron">›</span></button>';
  }
  function simGraph(series){
    const all=series.flatMap(x=>x.data.points.map(p=>p[x.key||'cash'])),low=Math.min(0,...all),high=Math.max(100,...all);
    const graphWidth=316,left=8,right=324,top=20,bottom=176,diff=Math.max(1,high-low);
    const y=n=>top+(high-n)/diff*(bottom-top);
    const first=series[0].data.points[0].year,last=series[0].data.points.at(-1).year;
    const x=year=>left+(year-first)/Math.max(1,last-first)*graphWidth;
    const horizontal=[0,.25,.5,.75,1].map(f=>{const val=high-f*diff;return '<line x1="'+left+'" y1="'+(top+f*(bottom-top))+'" x2="'+right+'" y2="'+(top+f*(bottom-top))+'" stroke="#e3e6df" stroke-width="1"/><text x="8" y="'+(top+f*(bottom-top)-3)+'" font-size="8" fill="#86908a">'+yen(val)+'</text>';}).join('');
    const curves=series.map(item=>{
      const coords=item.data.points.map((p,i)=>(i?'L':'M')+x(p.year).toFixed(1)+','+y(p[item.key||'cash']).toFixed(1)).join(' ');
      return '<path d="'+coords+'" fill="none" stroke="'+item.color+'" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    }).join('');
    return '<svg class="sim-chart" viewBox="0 0 332 203" role="img" aria-label="年ごとの現金貯金と投資資産の残高推移">'+horizontal+
      '<line x1="'+left+'" y1="'+y(0)+'" x2="'+right+'" y2="'+y(0)+'" stroke="#bd7e76" stroke-dasharray="4 3" stroke-width="1.3"/>'+curves+
      '<text x="8" y="195" font-size="9" fill="#76837a">'+first+'</text><text x="145" y="195" font-size="9" fill="#76837a">'+Math.round((first+last)/2)+'</text><text x="300" y="195" font-size="9" fill="#76837a">'+last+'</text></svg>';
  }
  function fpYearSelect(model){
    const points=model.points;
    if(!ui.fpYear||!points.some(x=>x.year===ui.fpYear))ui.fpYear=Math.max(points[0].year,Math.min(points.at(-1).year,simNowYear()));
    return '<label class="fp-year-select"><span>表示する年</span><select data-fp-year aria-label="収支を表示する年">'+points.map(x=>'<option value="'+x.year+'" '+(x.year===ui.fpYear?'selected':'')+'>'+x.year+'年</option>').join('')+'</select></label>';
  }
  function fpExpenseDetails(point,buy){
    const p=state.plan,year=point.year;
    const result=[
      ...point.monthlyParts.map(x=>({label:x.label,amount:x.value*12})),
      ...(buy?fpPieBreakdownRows(point,null,'housing').map(x=>({label:x.label,amount:x.amount})):[
        ['rentMonthly','家賃'],['managementMonthly','管理費'],['commonFeeMonthly','共益費'],['parkingMonthly','駐車場']
      ].map(([key,label])=>({label,amount:safeNum(p[key])*12}))),
      {label:'学校・大学の費用',amount:point.school},
      {label:'出産関連',amount:point.birth},
      {label:'自動車税など年払い',amount:safeNum(p.carTaxAnnual)},
      {label:'旅行・帰省',amount:safeNum(p.travelAnnual)},
      {label:'その他の税金',amount:safeNum(p.annualTax)},
      {label:'年内イベント・家電',amount:safeNum(p.annualEvents)},
      {label:'火災保険',amount:buy&&point.ownedMonths>0?safeNum(p.homeInsuranceAnnual):0}
    ];
    for(const x of p.expenses||[]){
      if((x.start&&year<x.start)||(x.end&&year>x.end))continue;
      result.push({label:x.name,amount:safeNum(x.amount)*(x.cycle==='year'?1:12)});
    }
    result.push({label:'頭金・購入諸費用',amount:point.upfront});
    for(const event of fpEventsForYear(year))if(event.type==='expense')result.push({label:event.name,amount:safeNum(event.amount)});
    return result.filter(x=>x.amount>0).sort((a,b)=>b.amount-a.amount);
  }
  function fpMetric(label,value){
    return '<div class="fp-r-metric"><span>'+esc(label)+'</span><strong>'+value+'</strong></div>';
  }
  function fpMonthlyLedger(point){
    const p=state.plan,inc=fpYearlyIncome(point.year).months,expenseEvents=fpEventsForYear(point.year)
      .filter(x=>x.type==='expense'),living=point.monthly-point.housing,
      otherAnnual=point.annualFixed+point.school+point.birth,
      investNisa=safeNum(p.nisaMonthly),investOther=safeNum(p.otherInvestMonthly);
    // Annual-only expenses without a known payment month are smoothed over 12 months.
    // Purchase costs are placed in the selected purchase month.
    const opening=point.cash-point.netCash;
    let cash=opening;
    const months=inc.map((entry,i)=>{
      const month=i+1;
      const eventExpenses=expenseEvents.reduce((sum,x)=>sum+(
        x.month>=1&&x.month<=12?(x.month===month?safeNum(x.amount):0):safeNum(x.amount)/12
      ),0);
      const housing=point.housingMonths?.[i]??point.housing;
      const purchase=month===fpPurchaseMonth()?point.upfront:0;
      const annualBudget=otherAnnual/12;
      const nonHousing=living+annualBudget;
      const spending=nonHousing+housing+eventExpenses+purchase;
      const investing=investNisa+investOther;
      const net=entry.total-spending-investing;
      const openingCash=cash;
      cash+=net;
      return {year:point.year,month,income:entry.total,household:living,housing,
        annualBudget,eventExpenses,purchase,spending,nisaAdd:investNisa,otherAdd:investOther,
        investing,net,openingCash,endingCash:cash,details:entry.fields};
    });
    return {year:point.year,opening,months,ending:cash};
  }
  function fpAssetsForYear(model,year){
    const p=state.plan,point=model.points.find(x=>x.year===year)||model.points[0],
      prev=model.points.find(x=>x.year===point.year-1);
    const opening=prev||{
      cash:safeNum(p.cashSavings)+safeNum(p.support),
      nisa:safeNum(p.nisaBalance),otherInvest:safeNum(p.investBalance)
    };
    return {point,opening,cashChange:point.cash-opening.cash,
      nisaChange:point.nisa-opening.nisa,otherChange:point.otherInvest-opening.otherInvest};
  }
  function fpMonthlyAssets(model,year,month){
    const p=state.plan,asset=fpAssetsForYear(model,year),
      m=Math.max(1,Math.min(12,Math.round(Number(month)||1))),
      flows=fpMonthlyLedger(asset.point).months,
      growth=Math.min(.2,Math.max(-.2,Number(p.returnAnnual)||0)/100);
    // Interpolation is a display approximation. At m=12, this exactly matches
    // the existing annual formula (opening + 12 months of contributions) × (1+return).
    const nisa=Math.max(0,(asset.opening.nisa+m*safeNum(p.nisaMonthly))*(1+growth*m/12));
    const otherInvest=Math.max(0,(asset.opening.otherInvest+m*safeNum(p.otherInvestMonthly))*(1+growth*m/12));
    const cash=flows[m-1].endingCash;
    return {year,month:m,cash,nisa,otherInvest,total:cash+nisa+otherInvest,
      cashChange:cash-asset.opening.cash,nisaChange:nisa-asset.opening.nisa,
      otherChange:otherInvest-asset.opening.otherInvest};
  }
  function fpYearPoint(model){
    return model.points.find(x=>x.year===ui.fpYear)||model.points.find(x=>x.year===simNowYear())||model.points[0];
  }
  function fpChartCanvas(points,keys,mode){
    // Responsive SVG generated locally: no external chart library or connection is needed.
    const W=326,H=172,left=29,right=318,top=12,bottom=144;
    const values=points.flatMap(p=>keys.map(k=>Number(p[k])||0));
    const min=mode==='line'?Math.min(0,...values):0;
    const max=Math.max(min+1,...values,0);
    const scale=Math.max(1,max-min);
    const yy=v=>bottom-(v-min)/scale*(bottom-top);
    const xx=i=>left+(i/Math.max(1,points.length-1))*(right-left);
    const grid=[0,.5,1].map(fr=>{
      const v=min+scale*fr,y=yy(v);
      return '<line x1="'+left+'" y1="'+y+'" x2="'+right+'" y2="'+y+'" stroke="#e6ebed" stroke-width=".8"/>'+
        '<text x="2" y="'+(y+3)+'" font-size="8" fill="#8b97a1">'+yen(v,0)+'</text>';
    }).join('');
    const ticks=points.filter((p,i)=>i===0||i===points.length-1||i%5===0).map(p=>{
      const i=points.indexOf(p);
      return '<text x="'+xx(i)+'" y="165" text-anchor="middle" font-size="8" fill="#7c8793">'+p.year+'</text>';
    }).join('');
    const marks=keys.map((key,k)=>{
      const color=['#1876d1','#89a9bd','#f59b6d'][k]||'#667';
      if(mode==='bar'){
        const width=Math.max(2,Math.min(6,210/Math.max(1,points.length))),shift=k===0?-width/2:width/2;
        return points.map((p,i)=>{
          const v=Math.max(0,Number(p[key])||0),y=yy(v);
          return '<rect x="'+(xx(i)+shift-width/2).toFixed(2)+'" y="'+y.toFixed(2)+'" width="'+width.toFixed(2)+'" height="'+Math.max(0,bottom-y).toFixed(2)+'" rx="1" fill="'+color+'"/>';
        }).join('');
      }
      const path=points.map((p,i)=>(i?'L':'M')+xx(i).toFixed(1)+','+yy(Number(p[key])||0).toFixed(1)).join(' ');
      return '<path d="'+path+'" fill="none" stroke="'+color+'" stroke-width="'+(k===0?2.4:1.8)+'" stroke-linejoin="round" stroke-linecap="round"/>';
    }).join('');
    const zero=(min<0&&mode==='line')?'<line x1="'+left+'" x2="'+right+'" y1="'+yy(0)+'" y2="'+yy(0)+'" stroke="#d35959" stroke-width="1.2" stroke-dasharray="3 3"/>':'';
    return '<svg class="fp-r-chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+(mode==='line'?'年ごとの推移':'各年の比較')+'">'+grid+zero+marks+ticks+'</svg>';
  }
  function fpChartLegend(items){
    return '<div class="fp-r-legend">'+items.map((name,i)=>
      '<span><i style="background:'+['#1876d1','#89a9bd','#f59b6d'][i]+'"></i>'+esc(name)+'</span>').join('')+'</div>';
  }
  function fpIncomeAllocation(point){
    const income=Math.max(0,point.incomes),housing=Math.max(0,point.housing*12),
      educationEvents=Math.max(0,point.school+point.events+point.upfront),
      living=Math.max(0,point.expenses-housing-educationEvents),
      investing=Math.max(0,point.investing),
      spent=Math.max(0,point.expenses+investing),
      remaining=Math.max(0,income-spent),
      over=Math.max(0,spent-income);
    const items=[
      {id:'living',label:'生活費・保険等',amount:living,color:'#6b9eaf'},
      {id:'housing',label:'住居費',amount:housing,color:'#2767ae'},
      {id:'education',label:'教育・イベント',amount:educationEvents,color:'#d9a164'},
      {id:'investing',label:'NISAなどの積立',amount:investing,color:'#729477'},
      {id:'remaining',label:'現金に残る分',amount:remaining,color:'#d5dde2'}
    ];
    return {income,spent,over,items,percent:income?spent/income*100:null,
      expensePercent:income?point.expenses/income*100:null,
      investingPercent:income?investing/income*100:null};
  }

  // Every detail amount uses the same model assumptions and unit (10,000 yen)
  // as the parent annual or monthly pie slice. Edits change the source fields,
  // never an allocated or derived amount, to keep subsequent forecasts consistent.
  function fpPieBreakdownRows(point,month,category){
    const p=state.plan,year=point.year,annual=!month,scale=annual?12:1,rows=[];
    const add=(label,amount,options={})=>{
      const amountValue=Math.max(0,Number(amount)||0);
      if(amountValue>1e-8)rows.push({label,amount:amountValue,...options});
    };
    const annualPart=amount=>annual?amount:amount/12;
    const monthlyPart=amount=>amount*scale;
    const activeHousing=point.ownedMonths>0;
    if(category==='living'){
      for(const item of point.monthlyParts){
        add(item.label,monthlyPart(item.value),{field:item.key,
          unit:item.key==='waterBiMonthly'?'万円/2か月':'万円/月',
          editStep:item.key.startsWith('child')||item.key==='daycareMonthly'?'3:0':'2:0'});
      }
      const annualFields=[
        ['annualTax','その他の税金'],['carTaxAnnual','自動車税'],['travelAnnual','旅行・帰省'],
        ['annualEvents','年内イベント・家電']
      ];
      if(activeHousing)annualFields.push(['homeInsuranceAnnual','火災保険']);
      for(const [field,label] of annualFields)
        add(label,annualPart(safeNum(p[field])),{field,unit:'万円/年',editStep:'6:0'});
      for(const item of p.expenses||[]){
        if((item.start&&year<item.start)||(item.end&&year>item.end))continue;
        add(item.name,annualPart(safeNum(item.amount)*(item.cycle==='year'?1:12)),
          {expenseId:item.id,value:safeNum(item.amount),unit:item.cycle==='year'?'万円/年':'万円/月'});
      }
      if(annual)add('出産関連',point.birth,{editStep:'3:0'});
      else{
        add('学校・大学の費用（月割）',annualPart(point.school),{editStep:'3:0'});
        add('出産関連（月割）',annualPart(point.birth),{editStep:'3:0'});
      }
    }else if(category==='housing'){
      const monthsRent=annual?point.rentMonths:(fpOwnsHomeAt(year,month.month)?0:1);
      const monthsOwned=annual?point.ownedMonths:(fpOwnsHomeAt(year,month.month)?1:0);
      if(monthsRent){
        for(const [field,label] of [['rentMonthly','家賃'],['managementMonthly','管理費'],
          ['commonFeeMonthly','共益費'],['parkingMonthly','駐車場']]){
          add(label,safeNum(p[field])*monthsRent,{field,unit:'万円/月',editStep:'2:0'});
        }
      }
      if(monthsOwned){
        const loanAmount=annual?point.housingLoan:
          Math.max(0,(point.housingMonths?.[month.month-1]??point.housing)-safeNum(p.housingOngoing));
        add('住宅ローン返済',loanAmount,{editStep:'4:1'});
        add('住宅維持費',safeNum(p.housingOngoing)*monthsOwned,
          {field:'housingOngoing',unit:'万円/月',editStep:'4:1'});
      }
    }else if(category==='education'){
      if(annual)add('学校・大学の費用',point.school,{editStep:'3:0'});
      if(annual || month.month===fpPurchaseMonth())add('頭金・住宅購入諸費用',point.upfront,{editStep:'4:0'});
      for(const item of fpEventsForYear(year)){
        if(item.type!=='expense')continue;
        const eventAmount=annual?safeNum(item.amount):
          (item.month>=1&&item.month<=12?(item.month===month.month?safeNum(item.amount):0):safeNum(item.amount)/12);
        add(item.name,eventAmount,item.id.startsWith('legacy-')?
          {editStep:'6:1'}:{eventId:item.id,value:safeNum(item.amount),unit:'万円/回'});
      }
    }else if(category==='investing'){
      add('NISA積立',monthlyPart(safeNum(p.nisaMonthly)),{field:'nisaMonthly',unit:'万円/月',editStep:'5:1'});
      add('その他の投資積立',monthlyPart(safeNum(p.otherInvestMonthly)),
        {field:'otherInvestMonthly',unit:'万円/月',editStep:'5:1'});
    }else if(category==='remaining'){
      const net=Math.max(0,annual?point.netCash:month.net),
        goal=monthlyPart(safeNum(p.otherSavingsMonthly));
      if(goal>0){
        add('確保できる現金貯金',Math.min(net,goal));
        add('貯金目標を除いた残額',Math.max(0,net-goal));
      }else add('現金として残る分',net);
    }
    return rows;
  }
  function fpPieBreakdownPanel(point,month,items,selectedKey){
    const item=items.find(x=>x.id===selectedKey)||items[0],annual=!month;
    if(!item)return '';
    const period=annual?'annual':'monthly',
      rows=fpPieBreakdownRows(point,month,item.id),
      income=annual?point.incomes:month.income,
      percentage=income>0?(item.amount/income*100):null,
      density=rows.length>24?' two-columns three-columns':rows.length>9?' two-columns':'';
    const entries=rows.map(row=>{
      const type=row.field?'field':row.expenseId?'expense':row.eventId?'event':'',
        key=row.field||row.expenseId||row.eventId||'',editable=!!type,
        tag=editable?'button':'div',
        attributes=editable?' type="button" data-act="fp-row-edit" data-period="'+period+
          '" data-value="'+type+'|'+esc(key)+'" aria-label="'+esc(row.label)+'を編集"':'';
      return '<'+tag+attributes+' class="fp-breakdown-row"><span class="fp-row-label">'+esc(row.label)+
        '</span><strong>'+fpYen(row.amount)+'</strong></'+tag+'>';
    }).join('');
    const selected=ui.fpEditingRow?.period===period&&ui.fpEditingRow?.category===item.id?
      rows.find(row=>ui.fpEditingRow.key===(row.field?'field|'+row.field:row.expenseId?'expense|'+row.expenseId:row.eventId?'event|'+row.eventId:'')):null;
    let edit='';
    if(selected){
      const type=selected.field?'field':selected.expenseId?'expense':'event',
        attr=type==='field'?'data-fp-breakdown-field':type==='expense'?'data-fp-breakdown-expense':'data-fp-breakdown-event',
        key=selected.field||selected.expenseId||selected.eventId,
        amount=type==='field'?state.plan[key]:type==='expense'?
          state.plan.expenses.find(x=>x.id===key)?.amount:state.plan.events.find(x=>x.id===key)?.amount,
        unit=String(selected.unit||'万円').replaceAll('万円','円');
      edit='<div class="fp-inline-edit"><label><span>'+esc(selected.label)+'（'+esc(unit)+'）</span>'+
        '<input type="number" min="0" max="1000000000" step="1" inputmode="numeric" '+attr+
        '="'+esc(key)+'" value="'+fpYenNumber(amount)+'" aria-label="'+esc(selected.label)+'の金額（円）"></label>'+
        '<button type="button" data-act="fp-edit-close">閉じる</button></div>';
    }
    return '<section class="fp-breakdown-panel" data-fp-inline-breakdown aria-label="'+esc(item.label)+'の内訳">'+
      '<div class="fp-breakdown-title"><span>'+esc(item.label)+'の内訳</span>'+
      '<strong>'+fpYen(item.amount)+'</strong>'+
      '<small>収入比 '+(percentage===null?'—':yen(percentage,1)+'%')+'　・　'+rows.length+'項目</small></div>'+
      '<div class="fp-breakdown-list'+density+'">'+
      (entries||'<p class="fp-breakdown-empty">金額が登録された項目はありません。</p>')+
      '</div>'+edit+'</section>';
  }
  function fpPiePick(item,period,active){
    return '<button type="button" class="fp-pie-pick '+(active===item.id?'selected':'')+
      '" data-act="fp-breakdown-select" data-period="'+period+'" data-value="'+item.id+
      '" aria-pressed="'+(active===item.id?'true':'false')+'">'+
      '<i style="background:'+item.color+'"></i><span>'+esc(item.label)+'</span>'+
      '<strong>'+fpYen(item.amount)+'</strong></button>';
  }

  // Selecting a pie segment changes only the detail card and selected visuals.
  // The scrollable report, year/month selection, and navigation stay mounted.
  function fpRefreshSelectedBreakdown(period,selectedCategory){
    const host=app.querySelector(period==='annual'?'.fp-pie-panel':'.fp-month-report');
    const panel=host?.querySelector?.('.fp-breakdown-panel');
    if(!panel){render();return;}
    const previousScroll=host.scrollTop;
    // Historical results use a stored snapshot; never calculate an archived
    // chart with the latest editable plan when changing categories.
    const workingPlan=state.plan;
    try{
      if(!ui.fpHistoryLive){
        const snapshot=fpLatestSnapshot();
        if(snapshot)state.plan=snapshot.plan;
      }
      const point=ui.fpRenderedPeriod===period?ui.fpRenderedPoint:
        fpYearPoint(modelYears(safeNum(state.plan.propertyPrice),true));
      const month=period==='monthly'?(ui.fpRenderedPeriod==='monthly'&&ui.fpRenderedMonth?
        ui.fpRenderedMonth:fpMonthlyLedger(point).months[Math.min(11,Math.max(0,(ui.fpCashMonth||1)-1))]):null;
      const allocation=month?fpMonthlyAllocation(month):fpIncomeAllocation(point);
      panel.outerHTML=fpPieBreakdownPanel(point,month,allocation.items,selectedCategory);
    }finally{
      state.plan=workingPlan;
    }
    for(const el of host.querySelectorAll('[data-act="fp-breakdown-select"]')){
      if(el.dataset.period!==period)continue;
      const selected=el.dataset.value===selectedCategory;
      if(el.classList?.contains('fp-pie-pick')){
        el.classList.toggle('selected',selected);
        el.setAttribute('aria-pressed',String(selected));
      }
      if(el.classList?.contains('fp-pie-arc')){
        el.setAttribute('stroke-width',String((period==='annual'?29:28)+(selected?5:0)));
      }
    }
    host.scrollTop=previousScroll;
  }
  function fpPieArcs(items,total,radius,strokeWidth,period,active){
    const circ=2*Math.PI*radius;let offset=0;
    return items.filter(x=>x.amount>0).map(item=>{
      const length=Math.min(circ,item.amount/total*circ);
      const part='<circle cx="105" cy="105" r="'+radius+'" fill="none" stroke="'+item.color+
        '" stroke-width="'+(active===item.id?strokeWidth+5:strokeWidth)+'" stroke-dasharray="'+
        length.toFixed(4)+' '+Math.max(0,circ-length).toFixed(4)+'" stroke-dashoffset="'+
        (-offset).toFixed(4)+'" transform="rotate(-90 105 105)" role="button" tabindex="0"'+
        ' data-act="fp-breakdown-select" data-period="'+period+'" data-value="'+item.id+
        '" aria-label="'+esc(item.label)+'の内訳を表示" class="fp-pie-arc"/>';
      offset+=length;return part;
    }).join('');
  }

  function fpPieChart(point){
    ui.fpRenderedPoint=point;ui.fpRenderedMonth=null;ui.fpRenderedPeriod='annual';
    const data=fpIncomeAllocation(point),total=Math.max(1,data.income,data.spent),
      chosen=ui.fpBreakdownAnnual||'living';
    const arcs=fpPieArcs(data.items,total,68,29,'annual',chosen);
    const percent=data.expensePercent===null?'—':yen(data.expensePercent,1)+'%';
    const outflowPercent=data.percent===null?'—':yen(data.percent,1)+'%';
    return '<div class="fp-pie-figure"><svg viewBox="0 0 210 210" class="fp-pie-chart" role="img" aria-label="年間手取りに対する支出率：'+esc(percent)+'">'+
      '<circle cx="105" cy="105" r="68" fill="none" stroke="#ecf0f2" stroke-width="29"/>'+
      arcs+'<text x="105" y="100" text-anchor="middle" font-size="26" font-weight="800" fill="#283a4b">'+esc(percent)+'</text>'+
      '<text x="105" y="124" text-anchor="middle" font-size="11" fill="#758391">支出率（積立を除く）</text></svg>'+
      '<div class="fp-pie-key">'+data.items.map(x=>fpPiePick(x,'annual',chosen)).join('')+'</div></div>'+
      '<div class="fp-pie-totals"><span>年間手取り＋給付金 <strong>'+fpYen(data.income)+'</strong></span>'+
      '<span>年間支出＋投資積立 <strong>'+fpYen(data.spent)+'</strong></span></div>'+
      fpPieBreakdownPanel(point,null,data.items,chosen);
  }
  function fpChartData(price,current,rent){
    const mortgage=fpAmortization(price),option=ui.fpChartPage||0,
      choice=Math.max(0,Math.min(3,option));
    if(choice===3){
      const selected=fpYearPoint(current);
      return '<div class="fp-r-body grow fp-pie-panel"><div class="fp-pie-panel-head"><strong class="fp-r-subhead">収入に対する支出割合・'+selected.year+'年</strong>'+
         '<span class="fp-breakdown-hint">色をタップすると下の内訳が切り替わります</span></div>'+
         fpPieChart(selected)+'</div>';
    }
    if(choice===0){
      const joined=current.points.map((p,i)=>({year:p.year,house:p.cash,rent:rent.points[i]?.cash??0}));
      const selected=fpYearPoint(current),other=rent.points.find(x=>x.year===selected.year);
      return '<div class="fp-r-body grow"><strong class="fp-r-subhead">購入後の現金残高</strong>'+
        fpChartCanvas(joined,['house','rent'],'line')+fpChartLegend(['購入後','賃貸を継続'])+
        '<div class="fp-r-compact-stats">'+fpMetric('選択年の現金残高',fpYen(selected.cash))+
        fpMetric('賃貸との差額',fpYen(selected.cash-(other?.cash||0)))+'</div>'+
        '<p class="fp-r-help">予測は各年末の現金。赤い点線＝残高0。持ち家の売却価値は含みません。</p></div>';
    }
    if(choice===1){
      const joined=current.points.map(x=>({year:x.year,income:x.incomes,spent:x.expenses+x.investing}));
      const selected=fpYearPoint(current);
      return '<div class="fp-r-body grow"><strong class="fp-r-subhead">年間の収入と支出＋投資積立</strong>'+
        fpChartCanvas(joined,['income','spent'],'bar')+fpChartLegend(['手取り・給付','支出＋積立'])+
        '<div class="fp-r-compact-stats">'+fpMetric('選択年の年間収入',fpYen(selected.incomes))+
        fpMetric('選択年の現金増減',fpYen(selected.netCash))+'</div>'+
        '<p class="fp-r-help">現金増減＝収入−支出−NISA等の積立。積立は消費支出とは区別。</p></div>';
    }
    const pts=mortgage.points.map(x=>({year:x.year,balance:x.balance}));
    const currentLoan=mortgage.points.find(x=>x.year===ui.fpYear)||mortgage.points.find(x=>x.year===mortgage.start)||mortgage.points[0];
    return '<div class="fp-r-body grow"><strong class="fp-r-subhead">ローン残債・元金と利息</strong>'+
      fpChartCanvas(pts,['balance'],'line')+fpChartLegend(['ローン残債'])+
      '<div class="fp-r-compact-stats">'+fpMetric('選択年末の残債',fpYen(currentLoan.balance))+
      fpMetric('選択年の元金／利息',yen(currentLoan.principalPaid,0)+' / '+fpYen(currentLoan.interest))+'</div>'+
      '<p class="fp-r-help">元利均等、当初金利が期間中一定の場合の返済予定。繰上返済なし。</p></div>';
  }
  function fpCalcRows(rows){
    return '<div class="fp-r-rows">'+rows.map(([label,value])=>
      '<div><span>'+esc(label)+'</span><strong>'+value+'</strong></div>').join('')+'</div>';
  }
  function fpMonthlyAllocation(month){
    const income=Math.max(0,month.income),living=Math.max(0,month.household+month.annualBudget),
      housing=Math.max(0,month.housing),events=Math.max(0,month.eventExpenses+month.purchase),
      investing=Math.max(0,month.investing),spent=Math.max(0,month.spending),
      totalOutflow=spent+investing,remaining=Math.max(0,month.net),over=Math.max(0,-month.net);
    return {income,spent,investing,remaining,over,total:Math.max(1,income,totalOutflow),
      percent:income>0?spent/income*100:null,items:[
        {id:'living',label:'生活・教育費',amount:living,color:'#6b9eaf'},
        {id:'housing',label:'住宅費',amount:housing,color:'#2767ae'},
        {id:'education',label:'イベント・購入費',amount:events,color:'#d9a164'},
        {id:'investing',label:'NISA等の積立',amount:investing,color:'#729477'},
        {id:'remaining',label:'現金に残る分',amount:remaining,color:'#d5dde2'}
      ]};
  }

  function fpMonthlyPie(month,point){
    point=point||modelYears(safeNum(state.plan.propertyPrice),true).points.find(x=>x.year===month.year);
    ui.fpRenderedPoint=point;ui.fpRenderedMonth=month;ui.fpRenderedPeriod='monthly';
    const data=fpMonthlyAllocation(month),chosen=ui.fpBreakdownMonthly||'living',
      percent=data.percent===null?'—':yen(data.percent,1)+'%';
    return '<div class="fp-month-pie" data-fp-month-pie>'+
      '<svg viewBox="0 0 210 210" class="fp-month-donut" role="img" aria-label="'+
         month.year+'年'+month.month+'月の手取り収入に対する支出割合：'+esc(percent)+'">'+
      '<circle cx="105" cy="105" r="67" stroke="#ecf0f2" stroke-width="28" fill="none"/>'+
      fpPieArcs(data.items,data.total,67,28,'monthly',chosen)+
      '<text x="105" y="101" text-anchor="middle" font-size="28" font-weight="800" fill="#283a4b">'+esc(percent)+'</text>'+
      '<text x="105" y="122" text-anchor="middle" font-size="10" fill="#758391">月の支出率</text></svg>'+
      '<div class="fp-month-pie-legend">'+data.items.map(x=>fpPiePick(x,'monthly',chosen)).join('')+'</div></div>'+
      fpPieBreakdownPanel(point,month,data.items,chosen)+
      (data.percent===null?'<p class="fp-month-pie-note">手取り収入が0円のため、支出率は算出できません。</p>':'');
  }
  function fpMonthlyReport(model){
    const point=fpYearPoint(model),ledger=fpMonthlyLedger(point),
      month=Math.min(12,Math.max(1,ui.fpCashMonth||1)),selected=ledger.months[month-1],
      maxNet=Math.max(1,...ledger.months.map(x=>Math.abs(x.net))),
      isPie=ui.fpMonthView!=='detail';
    const bars='<div class="fp-month-nav" role="group" aria-label="月ごとの収支">'+
      ledger.months.map(x=>{
        const signed=x.net>=0?'plus':'minus';
        return '<button data-act="fp-cash-month" data-value="'+x.month+'" class="'+(x.month===month?'active':'')+
          '" aria-label="'+x.month+'月 '+(x.net<0?'赤字':'黒字')+fpYen(Math.abs(x.net))+'">'+
          '<span class="fp-month-bar '+signed+'" style="height:'+Math.max(4,Math.abs(x.net)/maxNet*32).toFixed(1)+'px"></span>'+
          '<small>'+x.month+'</small></button>';
      }).join('')+'</div>';
    const row=(label,value)=>'<div class="fp-cash-row"><span>'+esc(label)+'</span><strong>'+fpYen(value)+'</strong></div>';
    const p=state.plan,goal=safeNum(p.otherSavingsMonthly),
      available=selected.net-goal,goalLabel=goal>0?(available>=0?'貯金目標まで確保可':'貯金目標まで不足'):'目標を設定できます';
    const quick= '<div class="fp-month-quick" aria-label="自由費と貯金目標">'+
      [['freeSpendingMonthly','自由費'],['otherSavingsMonthly','現金貯金目標']].map(([key,label])=>
        '<label><span>'+label+'</span><div class="fp-month-quick-input">'+
        '<input type="number" min="0" max="100000000" step="1" inputmode="numeric" data-fp-quick-key="'+key+
        '" value="'+fpYenNumber(p[key])+'" aria-label="'+label+'（円/月）"><small>円/月</small></div></label>'
      ).join('')+'</div>';
    return '<div class="fp-month-report grow">'+fpYearSelect(model)+
      '<div class="fp-month-head"><span class="fp-breakdown-hint">項目を選ぶと下に内訳を表示</span>'+
        '<div class="fp-month-switch" role="group" aria-label="月収支の表示形式">'+
          '<button data-act="fp-month-view" data-value="pie" class="'+(isPie?'active':'')+'">円グラフ</button>'+
          '<button data-act="fp-month-view" data-value="detail" class="'+(!isPie?'active':'')+'">明細</button></div></div>'+bars+
      '<div class="fp-month-hero"><div><span>'+point.year+'年 '+month+'月の現金収支</span>'+
        '<strong class="'+(selected.net<0?'negative':'')+'">'+(selected.net>=0?'+':'')+fpYen(selected.net)+'</strong></div>'+
        '<div><span>この月末の現金</span><strong>'+fpYen(selected.endingCash)+'</strong></div></div>'+
      '<div class="fp-month-summary">'+
        '<span>手取り <b>'+fpYen(selected.income)+'</b></span>'+
        '<span>支出 <b>'+fpYen(selected.spending)+'</b></span>'+
        '<span>投資積立 <b>'+fpYen(selected.investing)+'</b></span></div>'+
      quick+
      (isPie?fpMonthlyPie(selected,point):'<div class="fp-cash-rows">'+
        row('生活費・保険など',selected.household)+
        row('住宅費',selected.housing)+
        row('年払い・教育費の月割',selected.annualBudget)+
        row('イベント・住宅購入費',selected.eventExpenses+selected.purchase)+
        row('NISA / その他投資',selected.nisaAdd+selected.otherAdd)+'</div>')+
      '<p class="fp-r-help">'+goalLabel+'。現金貯金目標は支出に加えず、月末に残る現金と比較します。</p></div>';
  }
  function fpAssetsReport(model){
    const point=fpYearPoint(model),period=ui.fpAssetPeriod==='month'?'month':'year',
      monthly=period==='month',month=Math.max(1,Math.min(12,ui.fpAssetMonth||1)),
      yearAsset=fpAssetsForYear(model,point.year),
      monthlyAsset=monthly?fpMonthlyAssets(model,point.year,month):null;
    const selected=monthly?monthlyAsset:yearAsset.point;
    const series=model.points.map(x=>({year:x.year,cash:x.cash,nisa:x.nisa,invest:x.otherInvest}));
    const item=(label,balance,diff)=>'<div class="fp-asset-tile"><span>'+esc(label)+'</span>'+
      '<strong>'+fpYen(balance)+'</strong>'+
      '<small class="'+(diff<0?'negative':'')+'">'+(monthly?'年初から ':'前年から ')+(diff>=0?'+':'')+fpYen(diff)+'</small></div>';
    return '<div class="fp-assets-report grow">'+
      '<div class="fp-assets-toolbar">'+fpYearSelect(model)+
      '<div class="fp-income-toggle"><button data-act="fp-asset-period" data-value="year" class="'+(!monthly?'active':'')+'">年末</button>'+
      '<button data-act="fp-asset-period" data-value="month" class="'+(monthly?'active':'')+'">月末</button></div></div>'+
      (monthly?'<div class="fp-assets-months">'+Array.from({length:12},(_,i)=>'<button data-act="fp-asset-month" data-value="'+(i+1)+'" class="'+(month===i+1?'active':'')+'">'+(i+1)+'</button>').join('')+'</div>':'')+
      '<strong class="fp-r-subhead">'+point.year+'年'+(monthly?' '+month+'月末':' 年末')+'の金融資産・増減</strong>'+
      (monthly?'<div class="fp-assets-subline">年内の月末評価額は想定利回りから計算した概算です</div>':'')+
      fpChartCanvas(series,['cash','nisa','invest'],'line')+
      fpChartLegend(['現金','NISA','その他投資'])+
      '<div class="fp-assets-grid">'+
        item('現金預金',selected.cash,monthly?monthlyAsset.cashChange:yearAsset.cashChange)+
        item('NISA評価額',selected.nisa,monthly?monthlyAsset.nisaChange:yearAsset.nisaChange)+
        item('その他の株式・投資',selected.otherInvest,monthly?monthlyAsset.otherChange:yearAsset.otherChange)+
        '<div class="fp-asset-tile total"><span>金融資産の合計</span><strong>'+fpYen(selected.total)+'</strong>'+
        '<small>現金＋NISA＋その他投資</small></div></div>'+
      '<p class="fp-r-help">NISAの積立 '+fpYen(safeNum(state.plan.nisaMonthly))+'/月、その他投資 '+fpYen(safeNum(state.plan.otherInvestMonthly))+
        '/月。折れ線は年末残高。投資の月末評価額は年率の仮定から近似計算、時価実績ではありません。住宅価値とローン残債は含みません。</p></div>';
  }
  function fpIncomeReport(model){
    const point=fpYearPoint(model),income=fpYearlyIncome(point.year),
      monthly=ui.fpIncomePeriod==='month',m=Math.max(1,Math.min(12,ui.fpIncomeMonth||1)),
      record=monthly?income.months[m-1]:income;
    const rows=fpIncomeCategories.map(([key,label])=>({
      label,amount:record.fields[key]||0,
      fraction:record.total?100*(record.fields[key]||0)/record.total:0
    }));
    const max=Math.max(1,...income.months.map(x=>x.total));
    const bars='<div class="fp-income-timeline" role="group" aria-label="月を選択">'+income.months.map((x,i)=>{
      const month=i+1,height=Math.max(5,x.total/max*46);
      return '<button type="button" data-act="fp-income-month" data-value="'+month+'" class="'+(monthly&&month===m?'selected':'')+
        '" title="'+month+'月 '+fpYen(x.total)+'" aria-label="'+month+'月の収入 '+fpYen(x.total)+'">'+
        '<span style="height:'+height.toFixed(1)+'px"></span><small>'+month+'</small></button>';
    }).join('')+'</div>';
    return '<div class="fp-income-report grow">'+
      '<div class="fp-income-toolbar">'+fpYearSelect(model)+
        '<div class="fp-income-toggle" role="group" aria-label="収入を年または月で表示">'+
        '<button data-act="fp-income-period" data-value="year" class="'+(!monthly?'active':'')+'">年単位</button>'+
        '<button data-act="fp-income-period" data-value="month" class="'+(monthly?'active':'')+'">月単位</button></div></div>'+
      (monthly?bars:'')+
      '<div class="fp-income-total"><span>'+point.year+'年'+(monthly?' '+m+'月':' 年間')+'の手取り収入</span>'+
        '<strong>'+fpYen(record.total)+'</strong></div>'+
      '<div class="fp-income-lines">'+rows.map(x=>
        '<div class="fp-income-line"><span>'+esc(x.label)+'</span><strong>'+fpYen(x.amount)+'</strong>'+
        '<div class="fp-income-track"><i style="width:'+Math.max(0,Math.min(100,x.fraction)).toFixed(2)+'%"></i></div></div>'
      ).join('')+'</div>'+
      '<p class="fp-r-help">'+(monthly?
        '月別は年間モデルを配分した予測。給与・給付金は毎月一定、賞与は登録月、イベント収入は発生月に計上。月未指定のイベントは均等配分。':
        '年間収入＝夫婦の手取り給与×12＋賞与＋子どもの給付金＋臨時収入。賞与額は入力した年間合計。')+
        ' 妻の収入減少・給付金は登録条件による概算です。</p></div>';
  }
  function fpCalculationData(price,current){
    const p=state.plan,point=fpYearPoint(current),mode=ui.fpCalcPage||0,loan=fpAmortization(price);
    if(mode===0){
      const previous=current.points.find(x=>x.year===point.year-1);
      const opening=previous?previous.cash:safeNum(p.cashSavings)+safeNum(p.support);
      return '<div class="fp-r-body grow">'+fpYearSelect(current)+
        fpCalcRows([
          ['期首現金残高',fpYen(opening)],['年間手取り＋給付',fpYen(point.incomes)],
          ['生活費・住居費・特別支出', '− '+fpYen(point.expenses)],
          ['NISA等への投資積立','− '+fpYen(point.investing)],
          ['年間の現金増減',fpYen(point.netCash)],
          ['期末現金残高',fpYen(point.cash)]
        ])+
        '<p class="fp-r-help">期末現金＝期首現金＋年間収入−年間支出−年間投資積立。預貯金・NISA評価額は別々に計算。</p></div>';
    }
    if(mode===1){
      const n=loan.years*12,r=loan.rate/1200;
      return '<div class="fp-r-body grow">'+fpCalcRows([
        ['物件価格',fpYen(price)],['頭金',fpYen(safeNum(p.downPayment))],
        ['借入元金',fpYen(loan.principal)],['返済期間',loan.years+'年 × 12か月'],
        ['想定金利',yen(loan.rate,2)+'％/年'],['ローン月額',fpYen(loan.monthly)],
        ['ローン総返済',fpYen(loan.monthly*n)]
      ])+
        '<p class="fp-r-help">元利均等：月額＝元金×月利÷{1−(1＋月利)^−回数}。月利＝年利÷1200。金利0％なら元金÷回数。</p></div>';
    }
    if(mode===2){
      const items=fpExpenseDetails(point,true);
      const pageSize=window.matchMedia('(max-height:720px)').matches?4:6;
      const count=Math.max(1,Math.ceil(items.length/pageSize));
      ui.fpLedgerPage=Math.min(count-1,ui.fpLedgerPage);
      return '<div class="fp-r-body grow">'+fpYearSelect(current)+
        '<strong class="fp-r-subhead">年間の支出明細｜'+items.length+'項目</strong>'+
        fpCalcRows(items.slice(ui.fpLedgerPage*pageSize,(ui.fpLedgerPage+1)*pageSize)
          .map(x=>[x.label,fpYen(x.amount)]))+
        fpPageNav(count,ui.fpLedgerPage,'fp-ledger-page')+
        '<p class="fp-r-help">水道は2か月額×6回。住居費は購入前が家賃、購入後がローン＋維持費。追加支出も反映。</p></div>';
    }
    return '<div class="fp-r-body grow"><strong class="fp-r-subhead">計算の前提・参照先</strong>'+
      '<div class="fp-r-assumptions">'+
      '<div><b>収入</b><span>月の手取り×12＋賞与。出産年は妻の月収を最大100,000円、以降は時短収入を仮定。妻賞与は出産年以降0と仮置き。</span></div>'+
      '<div><b>住宅</b><span>指定した購入年月からローン返済に切替。購入時諸費用は物件価格の7％、固定資産税・修繕等は入力値で計算。</span></div>'+
      '<div><b>教育・運用</b><span>教育費は独自の固定概算。保育料、保険、NISAは入力値。税優遇・物価上昇は自動計算せず、運用利回りは仮定。</span></div>'+
      '<div><b>銀行審査</b><span>額面年収の登録がないため総返済負担率は判定しません。手取り比率とは別の指標です。</span></div></div>'+
      '<div class="fp-r-source-links"><a href="https://www.fsa.go.jp/policy/nisa2/lifeplan-simulator/index.html" target="_blank" rel="noopener noreferrer">金融庁｜ライフプランの前提 ↗</a>'+
      '<a href="https://www.flat35.com/loan/lineup/flat35/conditions/index.html" target="_blank" rel="noopener noreferrer">フラット35｜申込条件 ↗</a>'+
      '<a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1210.htm" target="_blank" rel="noopener noreferrer">国税庁｜住宅ローン控除 ↗</a></div></div>';
  }
  function fpAdviceData(price,current){
    const p=state.plan,rating=fpRating(price),budget=fpBudget(),amort=fpAmortization(price);
    const messages=[],negative=current.points.find(x=>x.cash<0),shortfall=budget.amount-price;
    const push=(level,title,detail)=>messages.push({level,title,detail});
    if(negative)push('bad','資金不足を見込む年：'+negative.year+'年',
      '年末現金が'+fpYen(negative.cash)+'。教育費・住宅購入費・収入変化などの時期を再確認してください。');
    else push('good','期間中の年末現金はプラス',
      '年末残高の最小値は'+fpYen(current.min)+'。ただし月中の資金不足はこの年次モデルでは判定できません。');
    if(rating.remaining<rating.reserve)push('bad','購入時の生活防衛資金を確認',
      '諸費用と頭金後の現金 '+fpYen(rating.remaining)+'に対し、6か月分の目安は '+fpYen(rating.reserve)+'（独自目安）。');
    else push('good','生活防衛資金は参考目安以上',
      '諸費用と頭金後の現金は'+fpYen(rating.remaining)+'。半年分の生活費との比較です。');
    if(shortfall<0)push('warn','想定価格が参考予算を超過',
      '約'+fpYen(Math.abs(shortfall))+'上回ります。物件価格・積立額・返済期間の組合せを再試算してください。');
    else push('good','購入価格は参考予算の範囲内',
      '参考予算との差は'+fpYen(shortfall)+'。審査通過や将来の安全を保証する判定ではありません。');
    const shocks=[0.5,1,2].map(shift=>({shift,increase:fpAmortization(price,shift).monthly-amort.monthly}));
    push(shocks[1].increase>1.5?'warn':'note','金利上昇時の返済増加',
      shocks.map(x=>'＋'+x.shift+'%：月＋'+fpYen(x.increase)).join('／')+'。借入時から一定金利とした比較で、実際の変動金利の改定額ではありません。');
    if(safeNum(p.children)>0)push('note','育児期の収入を慎重に評価',
      '出産年は妻の月手取り最大100,000円、翌年以降は時短手取り'+fpYen(safeNum(p.wifeReduced))+'・妻賞与0円と仮定。実際の育休給付等は要確認。');
    if(safeNum(p.carLoanEndYear)>=simNowYear())push('note','車ローン完済前後で再比較',
      '車ローンは'+p.carLoanEndYear+'年まで年末基準で計上。購入年と返済終了時期を比較してください。');
    push('note','審査基準と家計判定は別',
      '額面年収が未入力のためフラット35の返済負担率基準は未判定。表示する手取り負担率はアプリ独自の目安です。');
    push('note','未計上の税優遇と将来変動',
      '住宅ローン控除は要件で異なるため未計上。物価、金利変更、購入月、教育費の進路差なども確認してください。');
    return messages;
  }
  function fpAdviceScreen(price,current){
    const items=fpAdviceData(price,current),size=3,count=Math.ceil(items.length/size);
    ui.fpAdvicePage=Math.min(count-1,ui.fpAdvicePage||0);
    const portion=items.slice(ui.fpAdvicePage*size,(ui.fpAdvicePage+1)*size);
    return '<div class="fp-r-body grow"><strong class="fp-r-subhead">家計診断・改善ポイント</strong>'+
      '<div class="fp-r-advice-list">'+portion.map(x=>
        '<div class="fp-r-advice '+x.level+'"><strong>'+esc(x.title)+'</strong><p>'+esc(x.detail)+'</p></div>').join('')+'</div>'+
      fpPageNav(count,ui.fpAdvicePage,'fp-advice-page')+
      '<p class="fp-r-help">公的資料を参照した計算上の助言です。安全の保証や金融機関の事前審査ではありません。</p></div>';
  }
  function simulationResultsScreen(snapshot){
    const p=state.plan,price=safeNum(p.propertyPrice),current=modelYears(price,true),rent=modelYears(price,false),
      budget=fpBudget(),rating=fpRating(price),warnings=fpPlanWarnings(),
      page=Math.min(6,Math.max(0,ui.simResultPage||0));
    const heading=['購入後の家計','月ごとの収支','現金と投資資産','年収支','収入の内訳','計算根拠','アドバイス'][page];
    const intro='<div class="sim-intro"><span class="kicker">FP • LIFE PLAN / r15</span>'+
      '<div class="fp-result-quick"><button class="btn compact" data-act="fp-history-open">履歴</button>'+ 
      '<button class="btn compact" data-act="fp-edit-events">イベント＋</button>'+
      '<button class="btn compact" data-act="sim-restart">編集 ↗</button></div></div>';
    if(warnings.length){
      const size=3,count=Math.max(1,Math.ceil(warnings.length/size));
      ui.fpIssuePage=Math.min(count-1,ui.fpIssuePage||0);
      const visible=warnings.slice(ui.fpIssuePage*size,(ui.fpIssuePage+1)*size);
      return '<section class="screen sim-screen fp-result-screen">'+intro+
        '<h2 class="sim-result-title">入力した金額を確認してください</h2>'+
        fpLoanSummary(price)+
        '<div class="fp-validation-panel grow"><strong>金額の入力単位は「円」です</strong>'+
        '<p>異常に大きい金額が含まれる可能性があります。入力内容は自動変更していません。</p>'+
        '<div class="fp-validation-list">'+visible.map(x=>
          '<button data-act="fp-fix-input" data-value="'+x.step+':'+x.page+'">'+esc(x.label)+
          '<strong>'+fpYen(x.amount)+'　›</strong></button>').join('')+'</div>'+
        fpPageNav(count,ui.fpIssuePage,'fp-issue-page')+'</div>'+
        '<div class="fp-bottom-actions"><button class="btn" data-act="sim-restart">最初から見直す</button>'+
        '<button class="btn primary" data-act="fp-fix-input" data-value="'+warnings[0].step+':'+warnings[0].page+'">該当項目を修正 →</button></div></section>';
    }
    const tabs='<div class="fp-result-nav">'+['まとめ','月収支','資産','年収支','収入','計算','助言'].map((label,i)=>
      '<button data-act="fp-result-tab" data-value="'+i+'" class="'+(page===i?'active':'')+'">'+label+'</button>').join('')+'</div>';
    let content='';
    if(page===0){
      const end=current.points.at(-1),min=current.points.reduce((a,b)=>a.cash<b.cash?a:b);
      const output=rating.budget.amount===0?'返済可能予算は0円の計算。生活費や入力項目を確認してください。':
        (rating.reason||'');
      const negative=current.points.find(x=>x.cash<0);
      content='<div class="fp-r-summary grow">'+
        fpLoanSummary(price)+
        '<div class="fp-r-summary-strip"><span>参考の購入予算</span><strong>'+fpYen(budget.amount)+'</strong>'+
        '<small>金利＋1％なら '+fpYen(budget.stressAmount)+'が目安</small></div>'+
        '<div class="fp-r-verdict"><div><span>物件の予算評価</span><b class="'+fpBadgeClass(rating.level)+'">'+rating.label+'</b></div>'+
        '<p>'+esc(output)+'</p></div>'+
        '<div class="fp-r-compact-stats">'+
        fpMetric('月々の住居費',fpYen(rating.housing))+
        fpMetric('手取り負担率',yen(rating.ratio*100,1)+'％')+
        fpMetric('毎月の現金貯金の余力',fpYen(rating.spendable))+
        fpMetric('年末現金の最小値',fpYen(min.cash)+' ('+min.year+'年)')+'</div>'+
        '<button class="fp-pie-shortcut" data-act="fp-pie-open"><span class="fp-pie-mini" style="--pie-sweep:'+Math.min(100,Math.max(0,fpIncomeAllocation(fpYearPoint(current)).expensePercent||0))+'%"></span><span>収入に対する支出の割合</span><b>'+(fpIncomeAllocation(fpYearPoint(current)).expensePercent===null?'—':yen(fpIncomeAllocation(fpYearPoint(current)).expensePercent,1)+'%')+' ›</b></button>'+
        '<p class="fp-r-help">'+(negative?'注意：'+negative.year+'年に年末現金がマイナスになる試算です。':'この期間は年末現金のマイナスがありません。')+
        ' 手取り比率は家計の参考値で、融資審査基準とは異なります。</p></div>';
    }else if(page===1){
      content=fpMonthlyReport(current);
    }else if(page===2){
      content=fpAssetsReport(current);
    }else if(page===3){
      const chartPage=Math.max(0,Math.min(3,ui.fpChartPage||0));
      content='<div class="fp-r-chart-page grow">'+
        fpPageNav(4,chartPage,'fp-chart-page',['現金','年間収支','ローン','円グラフ'])+
        fpYearSelect(current)+fpChartData(price,current,rent)+'</div>';
    }else if(page===4){
      content=fpIncomeReport(current);
    }else if(page===5){
      const calcPage=Math.max(0,Math.min(3,ui.fpCalcPage||0));
      content='<div class="fp-r-calc-page grow">'+
        fpPageNav(4,calcPage,'fp-calc-page',['収支式','ローン','支出明細','前提'])+
        fpCalculationData(price,current)+'</div>';
    }else content=fpAdviceScreen(price,current);
    return '<section class="screen sim-screen fp-result-screen fp-report-screen '+((page===1||page===3&&ui.fpChartPage===3)?'fp-focus':'')+'">'+intro+
      '<h2 class="sim-result-title">'+heading+'</h2>'+(snapshot?'<div class="fp-snapshot-label">'+esc(fpHistoryDate(snapshot))+'</div>':'')+tabs+content+
      '<div class="fp-bottom-actions"><button class="btn" data-act="sim-restart">↶ 条件を見直す</button>'+
      '<button class="btn primary" data-act="fp-result-next">'+(page===6?'まとめへ戻る':'次へ →')+'</button></div></section>';
  }
    const studyCategories=[
    ['費用・住宅ローン',/費用|万円|円|金利|ローン|予算|頭金|税|維持費|値引|価格|銀行|返済/],
    ['性能・構造',/耐震|断熱|気密|構造|基礎|鉄骨|木造|耐久|劣化|性能|窓|結露|省エネ/],
    ['土地・暮らし',/土地|立地|駅|通勤|学校|治安|公園|道路|日当たり|日照|災害|洪水|浸水/],
    ['契約・保証',/保証|契約|アフター|修繕|引渡|申込|キャンセル|点検|補償|担当|営業/],
    ['確認しておくこと',/確認|質問|聞く|不明|注意|気になる|疑問|比較|必要/]
  ];

  // The memo hub includes new notes and already-saved property notes without migrating or losing them.
  function memoEntries(){
    const result=[];
    for(const note of state.studyNotes){
      if(!String(note.text||'').trim())continue;
      const pid=note.propertyId||'',p=propById(pid);
      result.push({key:'study~'+note.id,title:note.title||'自由メモ',content:note.text,kind:'note',
        propertyId:pid,propertyName:p?.name||'共通メモ',date:note.created||0,editable:true});
    }
    for(const p of state.properties){
      for(const [kind,label] of [['good','◎ よかった点'],['bad','△ 気になる点']]){
        for(let i=0;i<(p.notes?.[kind]||[]).length;i++){
          const content=p.notes[kind][i];
          if(!String(content||'').trim())continue;
          result.push({key:'property~'+p.id+'~'+kind+'~'+i,title:label,kind:'legacy',
            content,propertyId:p.id,propertyName:p.name,date:p.created||0,editable:true});
        }
      }
      for(const q of p.questions||[]){
        if(!String(q.text||'').trim())continue;
        result.push({key:'question~'+p.id+'~'+q.id,title:'？ 質問・確認事項',kind:'question',
          content:q.text,propertyId:p.id,propertyName:p.name,date:p.created||0,editable:true});
      }
      for(const m of p.meetings||[]){
        (m.notes||[]).forEach((content,i)=>{
          if(!String(content||'').trim())return;
          result.push({key:'meeting~'+p.id+'~'+m.id+'~'+i,title:(m.type==='内見'?'◇ 内見':'▣ 打ち合わせ')+'メモ',
            kind:'meeting',content,propertyId:p.id,propertyName:p.name,
            date:m.at?new Date(m.at).getTime()||0:0,editable:true});
        });
      }
    }
    return result.sort((a,b)=>b.date-a.date || a.title.localeCompare(b.title,'ja'));
  }
  function memoCard(entry){
    const tag=entry.kind==='note'?'✎ 自由':entry.kind==='meeting'?'▣ 記録':entry.kind==='question'?'？ 質問':'⌂ 物件';
    const preview=entry.content.replace(/【[^】]+】/g,'').replace(/[\n\r]+/g,'  ').replace(/^[・□\s]+/,'').trim();
    const shown=ui.memoSwipeKey===entry.key;
    return '<div class="memo-swipe-wrap" data-memo-key="'+esc(entry.key)+'">'+
      '<button class="memo-swipe-delete" data-act="memo-remove" data-value="'+esc(entry.key)+'" aria-label="このメモを削除">削除</button>'+
      '<button class="memo-card '+(shown?'swiped':'')+'" data-act="memo-open" data-value="'+esc(entry.key)+'" aria-label="'+esc(entry.title)+'を開く">'+
      '<span class="memo-card-top"><span class="memo-icon">▤</span><strong class="memo-title">'+esc(entry.title)+'</strong><span class="memo-chip">'+tag+'</span><span class="memo-chevron">›</span></span>'+
      '<span class="memo-property">⌂ '+esc(entry.propertyName)+'</span>'+
      '<span class="memo-preview">'+esc(preview||'本文なし')+'</span></button></div>';
  }
  function homeSelectionAxis(){
    const content=String(state.homeCriteriaMemo||''),preview=content.replace(/\s+/g,' ').trim();
    return '<section class="home-axis-card" aria-label="家選びで譲れない判断軸">'+
      '<div class="home-axis-header"><div><span class="home-axis-kicker">HOUSE CHECKPOINTS</span>'+
      '<strong>家選びで忘れたくないこと</strong></div>'+
      '<button type="button" data-act="home-axis-toggle" aria-expanded="'+(ui.axisEdit?'true':'false')+'">'+
      (ui.axisEdit?'閉じる':'編集')+'</button></div>'+
      (ui.axisEdit?'<label class="home-axis-edit"><span>優先順位・譲れない条件・不安な点</span>'+
      '<textarea data-home-axis-memo rows="4" maxlength="4000" placeholder="例：予算上限、通勤、地盤・災害リスク、断熱、周辺環境、将来の売却しやすさ">'+esc(content)+'</textarea>'+
      '<small>入力中に端末へ自動保存。家探し全体の共通メモです。</small></label>':
      '<p class="home-axis-preview">'+esc(preview?truncate(preview,135):
      '予算・通勤・耐震・断熱・災害リスクなど、判断軸をここに残す')+'</p>')+'</section>';
  }
  function memoScreen(){
    if(ui.memoScope==='individual' && !state.properties.some(p=>p.id===ui.memoPropertyId)){
      ui.memoPropertyId=state.properties[0]?.id||'';
    }
    const all=memoEntries(),specific=ui.memoScope==='individual';
    const filtered=specific?all.filter(x=>x.propertyId===ui.memoPropertyId):all;
    const count=Math.max(1,Math.ceil(filtered.length/3));
    ui.memoPage=Math.min(ui.memoPage,count-1);
    const part=filtered.slice(ui.memoPage*3,ui.memoPage*3+3);
    const selector=specific?'<label class="memo-property-pick"><span>物件</span><select data-memo-property aria-label="表示する物件">'+
      state.properties.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===ui.memoPropertyId?'selected':'')+'>'+esc(p.name)+'</option>').join('')+
      '</select></label>':'<div class="memo-all-count">▤ '+filtered.length+'件のメモを一覧表示</div>';
    return '<section class="screen memo-screen"><div class="memo-heading"><div><span class="kicker">HOME NOTES</span><h2>メモ</h2></div><button class="btn primary memo-new" data-act="study-add">＋ 新しいメモ</button></div>'+
      '<div class="memo-scope-switch" role="group" aria-label="メモの表示方法">'+
      '<button data-act="memo-scope" data-value="individual" class="'+(specific?'active':'')+'">⌂ 個別のメモ</button>'+
      '<button data-act="memo-scope" data-value="all" class="'+(!specific?'active':'')+'">▤ すべてのメモ</button></div>'+
      selector+homeSelectionAxis()+
      '<div class="memo-cards grow">'+(part.length?part.map(memoCard).join(''):
      '<div class="memo-empty"><span>✎</span><strong>まだメモがありません</strong><p>気づきや疑問を残しましょう</p><button class="btn primary" data-act="study-add">＋ メモを追加</button></div>')+'</div>'+
      (count>1?navPager(ui.memoPage,count,'memo-page'):'<div class="memo-count">'+filtered.length+' 件のメモ</div>')+
      '<button class="memo-digest-btn" data-act="study-summarize">✦ '+(specific?'この物件のメモを整理':'全メモをまとめて整理')+' <span>›</span></button>'+
      '<p class="memo-footnote">← 左にスワイプで削除　・　自動整理はオフライン対応</p></section>';
  }
  function memoRemove(key){
    const [type,pid,arg,index]=String(key).split('~');
    if(type==='study'){
      const n=state.studyNotes.find(x=>x.id===pid);if(!n)return false;
      state.studyNotes=state.studyNotes.filter(x=>x.id!==pid);
    }else{
      const p=propById(pid);if(!p)return false;
      if(type==='property'){
        const notes=p.notes?.[arg];if(!notes||!Number.isInteger(Number(index)))return false;
        if(notes.length===1)notes[0]='';else notes.splice(Number(index),1);
      }else if(type==='question'){
        p.questions=p.questions.filter(q=>q.id!==arg);
      }else if(type==='meeting'){
        const meeting=p.meetings.find(m=>m.id===arg);if(!meeting)return false;
        if(meeting.notes.length===1)meeting.notes[0]='';else meeting.notes.splice(Number(index),1);
      }else return false;
    }
    ui.memoSwipeKey=null;ui.memoPage=0;save();
    return true;
  }
  function memoOpen(key){
    const [kind,pid,arg,index]=String(key).split('~');
    ui.memoSwipeKey=null;
    if(kind==='study'){
      const note=state.studyNotes.find(n=>n.id===pid);if(!note)return;
      ui.studyEditId=note.id;
      ui.studyDraft={title:note.title,text:note.text,propertyId:note.propertyId||'',originalText:note.originalText||note.text,beforeFix:null};
      ui.overlay='study-form';
      return;
    }
    const p=propById(pid);if(!p)return;
    ui.propertyId=p.id;
    ui.propertyPage=kind==='meeting'?1:2;
    ui.overlay='detail';
    if(kind==='property'){ui.noteKind=arg;ui.noteIndex=Number(index);}
    if(kind==='question'){ui.noteKind='questions';ui.questionPage=Math.max(0,Math.floor(p.questions.findIndex(q=>q.id===arg)/4));}
    if(kind==='meeting'){ui.meetingIndex=Math.max(0,p.meetings.findIndex(m=>m.id===arg));ui.meetingNoteIndex=Number(index);}
  }
    function studyNormalizeLine(str){
    let text=String(str||'').replace(/[０-９Ａ-Ｚａ-ｚ]/g,c=>String.fromCharCode(c.charCodeAt(0)-65248))
      .replace(/\u3000/g,' ').replace(/[ \t]{2,}/g,' ').replace(/([ぁ-ゟァ-ヿ一-龥]) +(?=[ぁ-ゟァ-ヿ一-龥])/g,'$1').trim();
    const spelling=[
      [/シュミレーション/g,'シミュレーション'],
      [/シュミレート/g,'シミュレート'],
      [/アフターサビス/g,'アフターサービス'],
      [/シロアリ対策\s*について/g,'シロアリ対策について'],
      [/メーカ(?=[^ー]|$)/g,'メーカー']
    ];
    // Keep financial numbers, quotes, technical terms and negations intact.
    for(const [a,b] of spelling)text=text.replace(a,b);
    return text.replace(/[。]{2,}/g,'。').replace(/[、]{2,}/g,'、').replace(/\s+([、。！？?])/g,'$1');
  }
  function studyRawItems(text){
    return String(text||'').replace(/\r\n?/g,'\n')
      .split(/[\n]+|(?<=[。！？?!])(?=[^。！？?!])/)
      .map(x=>studyNormalizeLine(x.replace(/^[\s◆◈⌂✓✔□？!※・●◉▶\-]+/g,'').replace(/^【[^】]+】\s*/g,'')))
      .filter(Boolean).slice(0,80);
  }
  function studyCategory(sentence){
    const question=/[?？]$|何を|いくら|どうして|どうする|確認したい|要確認|次回聞|質問|不明|未確認/;
    const attention=/注意|懸念|心配|不安|リスク|高すぎ|デメリット|困る|問題|追加費用|難しい/;
    if(question.test(sentence))return 'questions';
    if(attention.test(sentence))return 'caution';
    if(/金利|ローン|返済|費用|万円|円|見積|頭金|資金|値引|諸費用|税金/.test(sentence))return 'money';
    if(/耐震|断熱|気密|性能|構造|鉄骨|木造|窓|結露|基礎|長期優良|ZEH|省エネ|換気/.test(sentence))return 'performance';
    if(/土地|駅|通勤|学校|日当たり|日照|周辺|道路|ハザード|災害|浸水|立地|間取り/.test(sentence))return 'land';
    if(/保証|契約|アフター|点検|引き渡し|引渡|工事|営業|担当/.test(sentence))return 'contract';
    return 'other';
  }
  const studyGroups=[
    ['money','◈ お金・住宅ローン'],
    ['performance','⌂ 性能・家づくり'],
    ['land','◇ 土地・暮らし'],
    ['contract','▣ 契約・保証'],
    ['questions','？ 次回の確認事項'],
    ['caution','！ 注意・気になる点'],
    ['other','✦ その他の学び']
  ];
  function studyEndPunctuation(sentence){
    const t=sentence.trim().replace(/[。]+$/,'').trim();
    if(!t)return '';
    if(/[！!？?]$/.test(t))return t.replace(/[?]$/,'？').replace(/[!]$/,'！');
    return t+'。';
  }
  function organizeStudyText(input){
    const sentences=studyRawItems(input);
    const seen=new Set(),groups=new Map(studyGroups.map(([key])=>[key,[]]));
    for(let sentence of sentences){
      sentence=studyEndPunctuation(sentence);
      if(!sentence||seen.has(sentence))continue;
      seen.add(sentence);
      groups.get(studyCategory(sentence)).push(sentence);
    }
    const sections=[];
    for(const [key,label] of studyGroups){
      const list=groups.get(key);
      if(list?.length)sections.push('【'+label+'】\n'+list.map(x=>(key==='questions'?'□ ':'・ ')+x).join('\n'));
    }
    return sections.join('\n\n');
  }
  function studySummaryItems(){
    const result=[],seen=new Set();
    const entries=memoEntries().filter(e=>ui.tab!=='memo'||ui.memoScope!=='individual'||e.propertyId===ui.memoPropertyId);
    for(const note of entries){
      const sentences=studyRawItems(note.kind==='note'?(state.studyNotes.find(n=>n.id===note.key.split('~')[1])?.originalText||note.content):note.content);
      for(let text of sentences){
        text=studyEndPunctuation(text);
        if(!text||seen.has(text))continue;seen.add(text);
        result.push({category:studyCategory(text),text,source:note.propertyName+' / '+note.title,id:note.key});
        if(result.length>=400)break;
      }
      if(result.length>=400)break;
    }
    return result.sort((a,b)=>studyGroups.findIndex(x=>x[0]===a.category)-studyGroups.findIndex(x=>x[0]===b.category));
  }
  function studyDigestScreen(){
    const items=studySummaryItems(),pageSize=3,total=Math.max(1,Math.ceil(items.length/pageSize));
    ui.studyDigestPage=Math.min(ui.studyDigestPage,total-1);
    const visible=items.slice(ui.studyDigestPage*pageSize,(ui.studyDigestPage+1)*pageSize);
    const cards=visible.map(item=>{
      const label=studyGroups.find(x=>x[0]===item.category)?.[1]||'✦ その他';
      return '<article class="digest-item"><span class="digest-label">'+esc(label)+'</span><p>'+esc(item.text)+'</p><span class="digest-origin">↳ '+esc(truncate(item.source,28))+'</span></article>';
    }).join('');
    return modalFrame('✦ メモのまとめ',
      '<div class="study-digest-top"><div><span class="kicker">HOME KNOWLEDGE</span><h2>メモをすっきり整理</h2></div><button class="btn compact" data-act="study-digest-copy">⧉ コピー</button></div>'+
      '<p class="study-hint">全部のメモから重複を省き、テーマごとに分類しました。</p>'+
      '<div class="digest-list grow">'+(cards||'<div class="empty grow"><p>メモを追加すると、ここに要点が表示されます。</p></div>')+'</div>'+
      (total>1?navPager(ui.studyDigestPage,total,'study-digest-page'):'<span class="study-counter">'+items.length+' 件のポイント</span>')+
      '<button class="btn primary wide" data-act="study-digest-back">← メモ一覧へ</button>'+
      '<p class="study-disclaimer">※ オフラインで利用できる文章整形と分類です。意味を推測するAI校正ではありません。</p>');
  }
  function studyScreen(){
    const items=state.studyNotes,total=Math.max(1,Math.ceil(items.length/3));
    ui.studyPage=Math.min(ui.studyPage,total-1);
    const page=items.slice(ui.studyPage*3,(ui.studyPage+1)*3);
    const cards=page.map(n=>'<article class="study-note-card"><div class="study-note-head"><span class="study-note-icon">▤</span><strong>'+esc(n.title)+'</strong><button class="btn compact study-fix-btn" data-act="study-quick-fix" data-value="'+esc(n.id)+'">✦ 修正</button><button class="btn compact danger" data-act="study-delete" data-value="'+esc(n.id)+'" aria-label="メモを削除">×</button></div><p>'+esc(truncate(n.text,105))+'</p><small class="study-source-foot">↳ タップで文章を整えられます</small></article>').join('');
    return modalFrame('家の学び',
      '<div class="study-toolbar"><div><span class="kicker">◈ HOME KNOWLEDGE</span><p class="subtle">家づくりの知識を、見やすく記録。</p></div><button class="btn primary" data-act="study-add">＋ メモ</button></div>'+
      '<div class="study-note-list grow">'+(cards||'<div class="study-no-notes"><span>⌂</span><strong>家の学びを残しましょう</strong><p>疑問や気づきを自由に書いてください。</p><button class="btn primary" data-act="study-add">＋ 最初のメモを書く</button></div>')+'</div>'+
      (total>1?navPager(ui.studyPage,total,'study-page'):'<span class="study-counter">'+items.length+' 件のメモ</span>')+
      '<button class="btn study-summary-action" data-act="study-summarize">✦ すべてのメモを整理 <span>›</span></button>'+
      '<p class="study-disclaimer">✓ メモは端末保存　✓ 整理・修正はオフライン対応</p>');
  }
  function studyForm(){
    const d=ui.studyDraft||{title:'',text:''};
    const hasBackup=typeof d.beforeFix==='string';
    return modalFrame(ui.studyEditId?'メモを編集':'メモを追加',
      '<div class="study-edit-form grow"><label class="field"><span>⌂ 関連する物件</span><select class="memo-property-editor" data-study="propertyId"><option value="">共通メモ（物件なし）</option>'+state.properties.map(p=>'<option value="'+esc(p.id)+'" '+((d.propertyId||'')===p.id?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></label><label class="field"><span>▤ タイトル</span><input data-study="title" maxlength="65" value="'+esc(d.title)+'" placeholder="例：断熱性能について"></label>'+
      '<label class="field grow"><span>✎ メモ本文</span><textarea data-study="text" maxlength="7000" placeholder="例：営業さんに断熱と耐震の話を聞いた。保証の期間も確認したい。">'+esc(d.text)+'</textarea></label>'+
      (hasBackup?'<span class="study-edited-banner">✓ 自動修正しました。保存前に文章を確認してください。</span>':'<span class="study-edit-help">✦ 「修正・整理」で表記を補正し、内容ごとに見出しを付けます。</span>')+
      '<div class="study-fix-actions"><button class="btn study-fix-main" data-act="study-fix">✦ 修正・整理する</button>'+ (hasBackup?'<button class="btn study-undo-btn" data-act="study-undo">↶ 元に戻す</button>':'')+'</div></div>'+
      '<div class="sim-footer"><button class="btn" data-act="study-back">戻る</button><button class="btn primary" data-act="study-save">保存する</button></div>');
  }
  function pendingScreen(){const sim=ui.tab==='sim';return '<section class="screen">'+empty(sim?'∿':'▦',sim?'人生設計はフェーズ2':'スケジュールはフェーズ3',sim?'貯金推移・住宅ローン・教育費をステップ式で追加予定です。':'内見カレンダー・リマインド通知を追加予定です。')+'</section>';}
  function overlay(){return ui.overlay==='detail'?detailScreen():ui.overlay==='form'?propertyForm():ui.overlay==='list'?listScreen():ui.overlay==='search'?searchScreen():ui.overlay==='settings'?settingsScreen():ui.overlay==='choose'?choosePropertiesScreen():ui.overlay==='criteria'?criteriaScreen():ui.overlay==='criterion-form'?criterionForm():ui.overlay==='rating'?ratingScreen():ui.overlay==='question'?questionForm():ui.overlay==='meeting-form'?meetingForm():ui.overlay==='study'?studyScreen():ui.overlay==='study-form'?studyForm():ui.overlay==='study-digest'?studyDigestScreen():'';}
  function moveProperty(d){let ps=visibleProperties(),i=ps.findIndex(p=>p.id===ui.propertyId);if(ps.length){ui.propertyId=ps[(i+d+ps.length)%ps.length].id;ui.photoIndex=0;ui.propertyPage=0;}}
  function moveDetail(d){ui.propertyPage=Math.max(0,Math.min(3,ui.propertyPage+d));}
  function changePage(key,total,d){ui[key]=Math.max(0,Math.min(Math.max(0,total-1),ui[key]+d));}
  function setScore(p,c,who,value){
    state.scores[p]??={};state.scores[p][c]??={};
    if(value===null)delete state.scores[p][c][who];else state.scores[p][c][who]=value;
    save();
  }
  function prepareForm(p){ui.draft=p?JSON.parse(JSON.stringify(p)):{...blankProperty(),_new:true};ui.formStep=0;ui.propertyFormPage=0;ui.overlay='form';}
  function validateProperty(){
    const p=ui.draft;if(!p.name.trim())return '物件名を入力してください';
    if(p.url && !/^https?:\/\/\S+$/i.test(p.url))return 'URLはhttps://またはhttp://で入力してください';
    for(const k of ['price','age','area','station'])if(p[k]!=='' && (num(p[k])===null || Number(p[k])<0))return '数値項目には0以上の数字を入れてください';
    return '';
  }
  function handler(action,button){
    let v=button.dataset.value, p=curProp();
    if(action==='tab')return chooseTab(v);
    if(action==='home-axis-toggle')return step(()=>{ui.axisEdit=!ui.axisEdit;});
    if(action==='memo-scope')return step(()=>{ui.memoScope=v;ui.memoPage=0;ui.memoSwipeKey=null;});
    if(action==='memo-page')return step(()=>changePage('memoPage',Math.max(1,Math.ceil((ui.memoScope==='individual'?memoEntries().filter(x=>x.propertyId===ui.memoPropertyId):memoEntries()).length/3)),Number(v)));
    if(action==='memo-open')return step(()=>memoOpen(v));
    if(action==='memo-remove'){
      if(!confirm('このメモを削除しますか？'))return;
      return step(()=>{if(memoRemove(v))message('メモを削除しました');});
    }
    if(action==='study-open')return chooseTab('memo');
    if(action==='study-page')return step(()=>changePage('studyPage',Math.max(1,Math.ceil(state.studyNotes.length/3)),Number(v)));
    if(action==='study-digest-page')return step(()=>changePage('studyDigestPage',Math.max(1,Math.ceil(studySummaryItems().length/3)),Number(v)));
    if(action==='study-digest-back')return step(()=>{ui.overlay=ui.tab==='memo'?'':'study';});
    if(action==='study-add')return openOverlay('study-form',()=>{ui.studyEditId=null;ui.studyDraft={title:'',text:'',propertyId:ui.tab==='memo'&&ui.memoScope==='individual'?ui.memoPropertyId:'',originalText:'',beforeFix:null};});
    if(action==='study-edit')return openOverlay('study-form',()=>{
      const note=state.studyNotes.find(n=>n.id===v);if(!note)return;
      ui.studyEditId=v;ui.studyDraft={title:note.title,text:note.text,propertyId:note.propertyId||'',originalText:note.originalText||note.text,beforeFix:null};
    });
    if(action==='study-quick-fix')return openOverlay('study-form',()=>{
      const note=state.studyNotes.find(n=>n.id===v);if(!note)return;
      const original=note.originalText||note.text;
      ui.studyEditId=v;ui.studyDraft={
        title:note.title,text:organizeStudyText(original),propertyId:note.propertyId||'',originalText:original,beforeFix:note.text
      };
    });
    if(action==='study-fix'){
      const draft=ui.studyDraft;if(!draft?.text?.trim())return message('まずメモを入力してください');
      const cleaned=organizeStudyText(draft.text);
      if(!cleaned)return message('整理できる文章がありません');
      return step(()=>{
        if(draft.beforeFix===null || draft.beforeFix===undefined)draft.beforeFix=draft.text;
        if(!draft.originalText)draft.originalText=draft.text;
        draft.text=cleaned;
        message('✦ 文章を整理しました。内容を確認して保存してください');
      });
    }
    if(action==='study-undo')return step(()=>{
      const draft=ui.studyDraft;
      if(draft&&typeof draft.beforeFix==='string'){draft.text=draft.beforeFix;draft.beforeFix=null;}
    });
    if(action==='study-back')return step(()=>{ui.overlay=ui.tab==='memo'?'':'study';ui.studyDraft=null;ui.studyEditId=null;});
    if(action==='study-save'){
      const draft=ui.studyDraft;if(!draft?.text?.trim())return message('学んだ内容を書いてください');
      return step(()=>{
        const title=draft.title.trim()||'家の学び';
        const original=String(typeof draft.beforeFix==='string'?(draft.originalText||draft.beforeFix):draft.text).slice(0,2500);
        if(ui.studyEditId){
          const previous=state.studyNotes.find(x=>x.id===ui.studyEditId);
          if(previous){previous.title=title;previous.text=draft.text.trim().slice(0,7000);previous.originalText=original;previous.propertyId=draft.propertyId||'';}
        }else state.studyNotes.unshift({id:uid(),title,text:draft.text.trim().slice(0,7000),originalText:original,propertyId:draft.propertyId||'',created:Date.now()});
        ui.studyPage=0;ui.memoPage=0;ui.studyDraft=null;ui.studyEditId=null;ui.overlay=ui.tab==='memo'?'':'study';save();message('✓ メモを保存しました');
      });
    }
    if(action==='study-delete'){
      if(!confirm('この学びメモを削除しますか？'))return;
      return step(()=>{state.studyNotes=state.studyNotes.filter(n=>n.id!==v);ui.studyPage=0;save();});
    }
    if(action==='study-summarize')return step(()=>{
      if(!memoEntries().length)return message('先にメモを登録してください');
      ui.studyDigestPage=0;ui.overlay='study-digest';
    });
    if(action==='study-digest-copy'){
      const textToCopy=studyGroups.map(([key,label])=>{
        const matches=studySummaryItems().filter(x=>x.category===key);
        return matches.length?'【'+label+'】\n'+matches.map(x=>'・'+x.text+' ('+x.source+')').join('\n'):'';
      }).filter(Boolean).join('\n\n');
      if(navigator.clipboard?.writeText){
        navigator.clipboard.writeText(textToCopy).then(()=>message('✓ 学びをコピーしました')).catch(()=>message('コピーできませんでした。端末の設定を確認してください'));
      }else message('この環境ではコピーできません');
      return;
    }
    if(action==='fp-form-page')return step(()=>{ui.simSubPage=Math.max(0,Math.min(fpWizardPages(ui.simStep).length-1,Number(v)||0));});
    if(action==='fp-ledger-page')return step(()=>{ui.fpLedgerPage=Math.max(0,Number(v)||0);});
    if(action==='fp-issue-page')return step(()=>{ui.fpIssuePage=Math.max(0,Number(v)||0);});
    if(action==='fp-fix-input')return step(()=>{const [screen,page]=String(v).split(':').map(Number);ui.simStep=Math.max(0,Math.min(6,screen||0));ui.simSubPage=Math.max(0,page||0);ui.fpIssuePage=0;});
    if(action==='fp-home-page')return step(()=>{ui.fpHomePage=Math.max(0,Number(v)||0);});
    if(action==='fp-chart-page')return step(()=>{ui.fpBreakdownOpen=null;ui.fpChartPage=Math.max(0,Math.min(3,Number(v)||0));});
    if(action==='fp-calc-page')return step(()=>{ui.fpCalcPage=Math.max(0,Math.min(3,Number(v)||0));ui.fpLedgerPage=0;});
    if(action==='fp-advice-page')return step(()=>{ui.fpAdvicePage=Math.max(0,Number(v)||0);});
    if(action==='sim-next')return step(()=>{if(ui.simStep===6){state.plan.hasRun=1;fpRecordHistory();}ui.simStep=Math.min(7,ui.simStep+1);ui.simSubPage=0;ui.simResultPage=1;ui.fpYear=simNowYear();ui.fpHistoryLive=true;ui.fpIssuePage=0;save();});
    if(action==='sim-back')return step(()=>{ui.simStep=Math.max(0,ui.simStep-1);ui.simSubPage=0;});
    if(action==='sim-restart')return step(()=>{ui.fpBreakdownOpen=null;ui.simStep=0;ui.simSubPage=0;ui.simResultPage=1;ui.fpHistoryOpen=false;});
    if(action==='sim-result-page')return step(()=>changePage('simResultPage',7,Number(v)));
    if(action==='fp-history-open')return step(()=>{ui.fpHistoryOpen=true;ui.fpHistoryPage=0;});
    if(action==='fp-history-close')return step(()=>{ui.fpHistoryOpen=false;});
    if(action==='fp-history-page')return step(()=>{ui.fpHistoryPage=Math.max(0,Number(v)||0);});
    if(action==='fp-history-select')return step(()=>{
      if(state.planHistory.some(x=>x.id===v)){ui.fpHistoryId=v;ui.fpHistoryOpen=false;ui.fpHistoryLive=false;ui.simResultPage=1;ui.fpYear=simNowYear();}
    });
    if(action==='fp-history-latest')return step(()=>{ui.fpHistoryId=state.planHistory[0]?.id||null;ui.fpHistoryOpen=false;ui.fpHistoryLive=true;ui.simResultPage=1;ui.fpYear=simNowYear();});
    if(action==='fp-edit-events')return step(()=>{ui.fpHistoryOpen=false;ui.simStep=6;ui.simSubPage=2;});
    if(action==='fp-pie-open')return step(()=>{ui.simResultPage=3;ui.fpChartPage=3;});
    if(action==='fp-result-tab')return step(()=>{ui.fpBreakdownOpen=null;ui.simResultPage=Math.min(6,Math.max(0,Number(v)||0));ui.fpLedgerPage=0;ui.fpAdvicePage=0;});
    if(action==='fp-cash-month')return step(()=>{ui.fpBreakdownOpen=null;ui.fpCashMonth=Math.min(12,Math.max(1,Number(v)||1));});
    if(action==='fp-month-view')return step(()=>{ui.fpMonthView=v==='detail'?'detail':'pie';});
    if(action==='fp-breakdown-select'){
      if(!['living','housing','education','investing','remaining'].includes(v))return;
      const period=button.dataset.period==='annual'?'annual':'monthly';
      if(period==='annual')ui.fpBreakdownAnnual=v;
      else ui.fpBreakdownMonthly=v;
      ui.fpEditingRow=null;
      // Only replace the inline breakdown. Recreating #app triggers the
      // screen entrance animation and resets scroll on every category tap.
      fpRefreshSelectedBreakdown(period,v);
      return;
    }
    if(action==='fp-row-edit'){
      const period=button.dataset.period==='annual'?'annual':'monthly',
        category=period==='annual'?ui.fpBreakdownAnnual:ui.fpBreakdownMonthly;
      ui.fpEditingRow={period,category,key:v};
      fpRefreshSelectedBreakdown(period,category);
      return;
    }
    if(action==='fp-edit-close'){
      const chosen=ui.fpEditingRow;
      ui.fpEditingRow=null;
      if(chosen)fpRefreshSelectedBreakdown(chosen.period,chosen.category);
      return;
    }
    if(action==='fp-breakdown-edit')return step(()=>{
      if(!ui.fpHistoryLive){
        const snap=fpLatestSnapshot();
        if(snap)state.plan=JSON.parse(JSON.stringify(snap.plan));
        ui.fpHistoryLive=true;
      }
      const [screen,page]=String(v).split(':').map(Number);
      ui.fpBreakdownOpen=null;
      ui.simStep=Math.max(0,Math.min(6,screen||0));
      ui.simSubPage=Math.max(0,page||0);
    });
    if(action==='fp-asset-period')return step(()=>{ui.fpAssetPeriod=v==='month'?'month':'year';});
    if(action==='fp-asset-month')return step(()=>{ui.fpAssetMonth=Math.min(12,Math.max(1,Number(v)||1));ui.fpAssetPeriod='month';});
    if(action==='fp-income-period')return step(()=>{ui.fpIncomePeriod=v==='month'?'month':'year';});
    if(action==='fp-income-month')return step(()=>{ui.fpIncomeMonth=Math.max(1,Math.min(12,Number(v)||1));ui.fpIncomePeriod='month';});
    if(action==='fp-legacy-utilities-clear')return step(()=>{state.plan.utilitiesMonthly=0;save();message('旧光熱費の合算額を削除しました');});
    if(action==='fp-event-add'){
      if(state.plan.events.length>=30)return message('イベントは30件までです');
      const kind=['wedding','honeymoon'].includes(v)?v:'custom';
      const existing=kind!=='custom'?state.plan.events.find(x=>x.kind===kind):null;
      if(existing)return step(()=>{ui.simStep=6;ui.simSubPage=2+Math.floor(state.plan.events.indexOf(existing)/2);});
      return step(()=>{
        const year=Math.max(simNowYear(),Math.floor(safeNum(state.plan.weddingYear,simNowYear())));
        const record={id:uid(),name:kind==='wedding'?'結婚式':kind==='honeymoon'?'新婚旅行':'新しいイベント',
          year,month:0,amount:kind==='wedding'?safeNum(state.plan.weddingCost):kind==='honeymoon'?safeNum(state.plan.honeymoonCost):0,
          type:'expense',kind};
        if(kind==='wedding')state.plan.weddingCost=0;
        if(kind==='honeymoon')state.plan.honeymoonCost=0;
        state.plan.events.push(record);
        ui.simStep=6;ui.simSubPage=2+Math.floor((state.plan.events.length-1)/2);
        save();
      });
    }
    if(action==='fp-event-delete'){
      if(!confirm('このイベントを削除しますか？'))return;
      return step(()=>{
        state.plan.events=state.plan.events.filter(x=>x.id!==v);
        ui.simSubPage=Math.min(ui.simSubPage,fpWizardPages(6).length-1);
        save();
      });
    }
    if(action==='fp-expense-add')return step(()=>{if(state.plan.expenses.length>=35)return message('追加支出は35項目までです');state.plan.expenses.push({id:uid(),name:'新しい支出',amount:0,cycle:'month',start:0,end:0});ui.simSubPage=2+Math.max(1,Math.ceil(state.plan.events.length/2))+Math.floor((state.plan.expenses.length-1)/2);save();});
    if(action==='fp-expense-delete'){if(!confirm('この追加支出を削除しますか？'))return;return step(()=>{state.plan.expenses=state.plan.expenses.filter(x=>x.id!==v);ui.simSubPage=Math.min(ui.simSubPage,fpWizardPages(6).length-1);save();});}
    if(action==='fp-result-next')return step(()=>{ui.simResultPage=(ui.simResultPage+1)%7;ui.fpLedgerPage=0;ui.fpAdvicePage=0;});
    if(action==='sim-choice')return step(()=>{ui.simChoice=v;save();});
    if(action==='fp-view-budget')return step(()=>{ui.tab='sim';ui.simStep=7;ui.simResultPage=1;ui.fpYear=simNowYear();ui.fpHistoryLive=true;ui.fpHistoryOpen=false;ui.overlay='';});
    if(action==='fp-open-home')return openOverlay('detail',()=>{ui.propertyId=v;ui.propertyPage=0;});

    if(action==='search')return openOverlay('search');
    if(action==='home-status')return step(()=>{state.filter.status=v;ui.homePage=0;save();});
    if(action==='home-page')return step(()=>changePage('homePage',Math.max(1,Math.ceil(visibleProperties().length/homePageSize())),Number(v)));
    if(action==='home-open')return openOverlay('detail',()=>{ui.propertyId=v;ui.propertyPage=0;ui.noteIndex=0;});
    if(action==='home-compare')return chooseTab('compare');
    if(action==='settings')return openOverlay('settings');
    if(action==='overlay-close')return closeOverlay();
    if(action==='add-property')return openOverlay('form',()=>prepareForm(null));
    if(action==='edit-property')return openOverlay('form',()=>prepareForm(p));
    if(action==='open-meetings')return openOverlay('detail',()=>{ui.propertyPage=1;ui.meetingIndex=0;ui.meetingNoteIndex=0;});
    if(action==='meeting-add')return openOverlay('meeting-form',()=>{ui.meetingDraft={id:uid(),at:'',type:p.status==='内見予定'?'内見':'打ち合わせ',maker:p.manufacturer||'',notes:[''],_new:true};});
    if(action==='meeting-edit')return openOverlay('meeting-form',()=>{ui.meetingDraft={...JSON.parse(JSON.stringify(p.meetings[ui.meetingIndex]))};});
    if(action==='meeting-cancel')return step(()=>{ui.overlay='detail';ui.meetingDraft=null;});
    if(action==='meeting-save'){
      const m=ui.meetingDraft;
      if(!m || !m.at || !Number.isFinite(new Date(m.at).getTime()))return message('打ち合わせ日時を入力してください');
      return step(()=>{
        const record={id:m.id,at:m.at,type:m.type==='内見'?'内見':'打ち合わせ',maker:String(m.maker||'').trim(),notes:m.notes?.length?m.notes:['']};
        const idx=p.meetings.findIndex(x=>x.id===record.id);
        if(idx<0){p.meetings.push(record);ui.meetingIndex=p.meetings.length-1;}
        else{p.meetings[idx]=record;ui.meetingIndex=idx;}
        ui.meetingNoteIndex=0;ui.meetingDraft=null;ui.overlay='detail';ui.propertyPage=1;save();message('打ち合わせを保存しました');
      });
    }
    if(action==='meeting-nav')return step(()=>{changePage('meetingIndex',p.meetings.length,Number(v));ui.meetingNoteIndex=0;});
    if(action==='meeting-note-nav')return step(()=>changePage('meetingNoteIndex',p.meetings[ui.meetingIndex].notes.length,Number(v)));
    if(action==='meeting-note-add')return step(()=>{
      const m=p.meetings[ui.meetingIndex];if(m.notes.length>=20)return message('メモは20ページまでです');
      m.notes.splice(ui.meetingNoteIndex+1,0,'');ui.meetingNoteIndex++;save();
    });
    if(action==='meeting-note-delete'){
      const m=p.meetings[ui.meetingIndex];if(m.notes.length<2)return;
      if(!confirm('このメモページを削除しますか？'))return;
      return step(()=>{m.notes.splice(ui.meetingNoteIndex,1);ui.meetingNoteIndex=Math.max(0,ui.meetingNoteIndex-1);save();});
    }
    if(action==='meeting-delete'){
      if(!confirm('この打ち合わせ記録を削除しますか？'))return;
      return step(()=>{p.meetings.splice(ui.meetingIndex,1);ui.meetingIndex=Math.min(ui.meetingIndex,Math.max(0,p.meetings.length-1));ui.meetingNoteIndex=0;save();message('打ち合わせを削除しました');});
    }
    if(action==='property-nav')return step(()=>moveProperty(Number(v)));
    if(action==='property-list')return openOverlay('list',()=>ui.listPage=0);
    if(action==='list-pick')return step(()=>{ui.propertyId=v;ui.overlay='';ui.tab='property';});
    if(action==='list-nav'){
      let total=ui.overlay==='choose'?Math.ceil(state.properties.length/4):Math.ceil(visibleProperties().length/4);
      return step(()=>changePage('listPage',Math.max(1,total),Number(v)));
    }
    if(action==='property-detail')return openOverlay('detail',()=>{ui.propertyPage=0;ui.noteIndex=0;});
    if(action==='detail-close')return closeOverlay();
    if(action==='detail-page')return step(()=>{ui.propertyPage=Number(v);ui.noteIndex=0;});
    if(action==='note-kind')return step(()=>{ui.noteKind=v;ui.noteIndex=0;ui.questionPage=0;});
    if(action==='note-nav')return step(()=>changePage('noteIndex',p.notes[ui.noteKind].length,Number(v)));
    if(action==='note-add')return step(()=>{if(p.notes[ui.noteKind].length>=30)return message('メモは30ページまでです');p.notes[ui.noteKind].push('');ui.noteIndex=p.notes[ui.noteKind].length-1;save();});
    if(action==='note-delete'){if(p.notes[ui.noteKind].length<2)return; if(!confirm('このメモページを削除しますか？'))return;return step(()=>{p.notes[ui.noteKind].splice(ui.noteIndex,1);ui.noteIndex=Math.max(0,ui.noteIndex-1);save();});}
    if(action==='add-question')return openOverlay('question');
    if(action==='question-save'){
      let el=app.querySelector('[data-question-input]'),t=(el?.value||'').trim();
      if(!t)return message('質問を入力してください');
      return step(()=>{p.questions.push({id:uid(),text:t,done:false});ui.questionPage=Math.floor((p.questions.length-1)/4);ui.overlay='detail';save();});
    }
    if(action==='question-toggle')return step(()=>{let q=p.questions.find(q=>q.id===v);if(q)q.done=!q.done;save();});
    if(action==='question-delete'){if(!confirm('この質問を削除しますか？'))return;return step(()=>{p.questions=p.questions.filter(q=>q.id!==v);ui.questionPage=Math.min(ui.questionPage,Math.max(0,Math.ceil(p.questions.length/4)-1));save();});}
    if(action==='question-nav')return step(()=>changePage('questionPage',Math.max(1,Math.ceil(p.questions.length/4)),Number(v)));
    if(action==='photo-nav')return step(()=>changePage('photoIndex',p.photos.length,Number(v)));
    if(action==='photo-delete'){if(!confirm('この写真を削除しますか？'))return;return step(()=>{let id=p.photos.splice(ui.photoIndex,1)[0];removePhoto(id);ui.photoIndex=Math.max(0,ui.photoIndex-1);save();});}
    if(action==='external'){try{const u=new URL(v);if(!['https:','http:'].includes(u.protocol))throw Error('invalid');window.open(u.href,'_blank','noopener,noreferrer');}catch(_){message('有効なURLではありません');}return;}
    if(action==='property-form-page')return step(()=>{ui.propertyFormPage=Math.max(0,Math.min(2,Number(v)||0));});
    if(action==='form-cancel')return step(()=>{ui.overlay='';ui.draft=null;});
    if(action==='form-save'){
      let error=validateProperty();if(error)return message(error);
      return step(()=>{
        const target={...ui.draft};delete target._new;target.demo=false;const old=propById(target.id);
        if(old)Object.assign(old,target);else state.properties.unshift(target);
        ui.propertyId=target.id;ui.overlay='';ui.tab='property';ui.draft=null;state.filter={query:'',tag:'',sort:'new',status:''};save();message('物件を保存しました');
      });
    }
    if(action==='property-delete'){if(!confirm('この物件と関連する写真・採点を削除しますか？'))return;return step(()=>{const id=ui.draft.id;const previous=propById(id);if(previous)previous.photos.forEach(removePhoto);state.properties=state.properties.filter(x=>x.id!==id);state.selected=state.selected.filter(x=>x!==id);delete state.scores[id];ui.propertyId=null;ui.overlay='';ui.draft=null;save();message('物件を削除しました');});}
    if(action==='filter-apply')return step(()=>{ui.overlay='';ui.propertyId=null;ui.homePage=0;ui.listPage=0;save();});
    if(action==='filter-clear')return step(()=>{state.filter={query:'',tag:'',sort:'new',status:''};ui.overlay='';ui.propertyId=null;save();});
    if(action==='seed'){if(!confirm('操作を試すための架空の物件を3件追加しますか？'))return;return step(()=>{
      [['サンプルA・駅近の家',3800,'新築戸建',8],['サンプルB・ゆったりの家',4200,'中古戸建',18],['サンプルC・街なかの住まい',4600,'新築マンション',5]].forEach(([name,price,kind,station])=>{let x=blankProperty();Object.assign(x,{name,price,kind,station,area:98,layout:'3LDK',status:statuses[0],demo:true});state.properties.push(x);});
      state.selected=state.properties.slice(-3).map(x=>x.id);ui.propertyId=state.selected[0];save();
    });}
    if(action==='choose-properties')return openOverlay('choose',()=>ui.listPage=0);
    if(action==='select-property')return step(()=>{if(state.selected.includes(v))state.selected=state.selected.filter(x=>x!==v);else if(state.selected.length<3)state.selected.push(v);else return message('比較できる物件は最大3件です');save();});
    if(action==='compare-nav')return step(()=>changePage('comparePage',Math.ceil(state.criteria.length/rowsPerPage())+1,Number(v)));
    if(action==='criteria')return openOverlay('criteria',()=>ui.criteriaPage=0);
    if(action==='criteria-nav')return step(()=>changePage('criteriaPage',Math.max(1,Math.ceil(state.criteria.length/5)),Number(v)));
    if(action==='criterion-add')return openOverlay('criterion-form',()=>{ui.formStep=0;ui.draft={id:uid(),name:'',weight:2,auto:null,_new:true};});
    if(action==='criterion-edit')return openOverlay('criterion-form',()=>{ui.formStep=0;ui.draft=JSON.parse(JSON.stringify(state.criteria.find(c=>c.id===v)));});
    if(action==='criterion-weight')return step(()=>{let c=state.criteria.find(c=>c.id===v);c.weight=c.weight%3+1;save();});
    if(action==='criterion-move')return step(()=>{let [id,d]=v.split(':');let idx=state.criteria.findIndex(c=>c.id===id),at=idx+Number(d);if(idx<0||at<0||at>=state.criteria.length)return;let [c]=state.criteria.splice(idx,1);state.criteria.splice(at,0,c);ui.criteriaPage=Math.floor(at/5);save();});
    if(action==='criterion-back')return step(()=>{if(ui.formStep)ui.formStep--;else {ui.overlay='criteria';ui.draft=null;}});
    if(action==='criterion-next'){
      if(ui.formStep===0){if(!ui.draft.name.trim())return message('比較項目名を入力してください');return step(()=>ui.formStep=1);}
      const c=ui.draft;
      if(c.auto && c.auto.field){
        const a=c.auto,g=num(a.good),m=num(a.mid);
        if(g===null||m===null||g<0||m<0)return message('○と△の基準値を入力してください');
        if(a.dir==='low'&&g>m||a.dir==='high'&&g<m)return message('○と△の基準値の大小が逆です');
        c.auto={field:a.field,dir:a.dir||'low',good:g,mid:m};
      }else c.auto=null;
      return step(()=>{let x={...c};delete x._new;let old=state.criteria.find(c=>c.id===x.id);if(old)Object.assign(old,x);else state.criteria.push(x);ui.overlay='criteria';ui.draft=null;save();});
    }
    if(action==='criterion-delete'){if(!confirm('項目と、この項目の全採点を削除しますか？'))return;return step(()=>{const id=ui.draft.id;state.criteria=state.criteria.filter(c=>c.id!==id);Object.values(state.scores).forEach(a=>delete a[id]);ui.overlay='criteria';ui.draft=null;ui.comparePage=0;save();});}
    if(action==='rating')return openOverlay('rating',()=>{ui.scoreProperty=button.dataset.property;ui.scoreCriterion=button.dataset.criterion;ui.scoreRater='overall';});
    if(action==='score-set')return step(()=>{setScore(ui.scoreProperty,ui.scoreCriterion,ui.scoreRater,v==='clear'?null:Number(v));ui.overlay='';});
    if(action==='export')return exportData();
  }
  app.addEventListener('click',e=>{if(Date.now()-lastSwipeAt<350){e.preventDefault();return;}let b=e.target.closest('[data-act]');if(!b || !app.contains(b))return;e.preventDefault();handler(b.dataset.act,b);});
  app.addEventListener('keydown',e=>{
    const circle=e.target.closest?.('.fp-pie-arc');
    if(circle&&(e.key==='Enter'||e.key===' ')){e.preventDefault();handler('fp-breakdown-select',circle);return;}
    if(e.target?.dataset?.homeQuery!==undefined && e.key==='Enter'){e.preventDefault();e.target.blur?.();step(()=>{ui.homePage=0;save();});}});
  app.addEventListener('input',e=>{
    let el=e.target,p=curProp();
    if(el.dataset?.homeAxisMemo!==undefined){state.homeCriteriaMemo=String(el.value).slice(0,4000);save();return;}
    if(el.dataset.model && ui.draft){
      let k=el.dataset.model;ui.draft[k]=k==='tags'?el.value.split(/[,、]/).map(s=>s.trim()).filter(Boolean):el.value;
    }
    if(el.dataset.meetingModel && ui.meetingDraft){const key=el.dataset.meetingModel;if(key==='memo')ui.meetingDraft.notes[0]=el.value;else ui.meetingDraft[key]=el.value;}
    if(el.dataset.homeQuery!==undefined){state.filter.query=el.value;ui.homePage=0;save();const list=app.querySelector('.home-results');if(list){list.innerHTML=homeResults();hydratePhotos();}}
    if(el.dataset.memoProperty!==undefined){ui.memoPropertyId=el.value;ui.memoPage=0;ui.memoSwipeKey=null;render();return;}
    if(el.dataset.study && ui.studyDraft){ui.studyDraft[el.dataset.study]=el.value;}
    if(el.dataset?.fpYear!==undefined){ui.fpYear=Math.floor(Number(el.value)||0);ui.fpLedgerPage=0;render();return;}
    if(el.dataset?.eventId && el.dataset?.eventKey){
      const item=state.plan.events.find(x=>x.id===el.dataset.eventId);
      if(item){
        const k=el.dataset.eventKey,value=el.value;
        if(k==='name')item.name=String(value).slice(0,50);
        if(k==='year')item.year=Math.max(2020,Math.min(2100,Math.floor(Number(value)||simNowYear())));
        if(k==='amount')item.amount=Math.max(0,Number(value)/(el.dataset.fpYen==='true'?10000:1)||0);
        if(k==='month')item.month=Math.max(0,Math.min(12,Math.floor(Number(value)||0)));
        if(k==='type')item.type=value==='income'?'income':'expense';
        save();
      }
      return;
    }
    if(el.dataset?.fpId && el.dataset?.fpKey){
      const entry=state.plan.expenses.find(x=>x.id===el.dataset.fpId);
      if(entry){const k=el.dataset.fpKey;entry[k]=k==='name'?String(el.value).slice(0,50):k==='cycle'?(el.value==='year'?'year':'month'):(k==='amount'?Math.max(0,Math.min(10000,Number(el.value)/(el.dataset.fpYen==='true'?10000:1)||0)):Math.max(0,Math.min(2100,Math.floor(Number(el.value)||0))));save();}
      return;
    }
    if(el.dataset.sim){
      const k=el.dataset.sim, val=el.value;
      state.plan[k]=['propertyId','highSchool','university'].includes(k)?val:
        (val!==''&&Number.isFinite(Number(val))?Number(val)/(el.dataset.simYen==='true'?10000:1):0);
      if(k==='propertyId'){
        const linked=propById(val);
        if(linked && num(linked.price)!==null)state.plan.propertyPrice=Number(linked.price);
        const priceInput=app.querySelector('[data-sim="propertyPrice"]');
        if(priceInput)priceInput.value=priceInput.dataset.simYen==='true'?fpYenNumber(state.plan.propertyPrice):state.plan.propertyPrice;
      }
      save();
    }
    if(el.dataset.filter){state.filter[el.dataset.filter]=el.value;}
    if(el.dataset.criterionModel && ui.draft){let k=el.dataset.criterionModel;ui.draft[k]=k==='weight'?Number(el.value):el.value;}
    if(el.dataset.auto && ui.draft){ui.draft.auto ||= {field:'',dir:'low',good:'',mid:''};ui.draft.auto[el.dataset.auto]=el.value;}
    if(el.hasAttribute('data-meeting-note') && p?.meetings?.[ui.meetingIndex]){
      const m=p.meetings[ui.meetingIndex],idx=ui.meetingNoteIndex;
      if(el.scrollHeight>el.clientHeight+2 && el.value.length>1){
        const value=el.value,caret=el.selectionStart||value.length,split=Math.max(1,Math.min(caret-1,value.length-1));
        if(m.notes.length>=20)return message('メモは20ページまでです');
        m.notes[idx]=value.slice(0,split);
        m.notes.splice(idx+1,0,value.slice(split));
        ui.meetingNoteIndex=idx+1;save();render();
        const next=app.querySelector('[data-meeting-note]');if(next)next.focus();
        return;
      }
      m.notes[idx]=el.value;save();return;
    }
    if(el.dataset.note && p){
      const type=el.dataset.note;
      if(el.scrollHeight>el.clientHeight+2 && el.value.length>1){
        if(p.notes[type].length>=30 && ui.noteIndex>=29){el.value=p.notes[type][ui.noteIndex];return message('メモは最大30ページです');}
        let text=el.value;
        let lo=0,hi=text.length;
        while(lo<hi){const mid=Math.ceil((lo+hi)/2);el.value=text.slice(0,mid);if(el.scrollHeight<=el.clientHeight+2)lo=mid;else hi=mid-1;}
        const split=Math.max(1,Math.min(text.length-1,lo));
        const carry=text.slice(split);
        p.notes[type][ui.noteIndex]=text.slice(0,split);
        const next=ui.noteIndex+1;
        if(p.notes[type].length<=next)p.notes[type].push('');
        let remaining=carry,index=next;
        while(remaining && index<30){
          if(p.notes[type].length<=index)p.notes[type].push('');
          const combined=remaining+p.notes[type][index];
          p.notes[type][index]=combined.slice(0,220);
          remaining=combined.slice(220);index++;
        }
        if(remaining)message('メモが30ページに達しています');
        ui.noteIndex=next;save();render();
        const upcoming=app.querySelector('[data-note]');
        if(upcoming){upcoming.focus();upcoming.setSelectionRange(carry.length,carry.length);}
        return;
      }
      p.notes[type][ui.noteIndex]=el.value;
      let span=app.querySelector('.notes-title .meta');if(span)span.textContent=el.value.length+' / 220文字';
      save();
    }
  });
  app.addEventListener('change',async e=>{
    const el=e.target;
    if(el.dataset?.homeAxisMemo!==undefined){state.homeCriteriaMemo=String(el.value).slice(0,4000);save();return;}
    if(el.dataset?.fpQuickKey!==undefined){
      const key=el.dataset.fpQuickKey;
      if(!['freeSpendingMonthly','otherSavingsMonthly'].includes(key))return;
      const yenValue=Number(el.value);
      if(!Number.isFinite(yenValue)||yenValue<0){render();return;}
      if(!ui.fpHistoryLive){const snap=fpLatestSnapshot();if(snap)state.plan=JSON.parse(JSON.stringify(snap.plan));ui.fpHistoryLive=true;}
      state.plan[key]=Math.min(10000,yenValue/10000);
      save();render();return;
    }
    if(el.dataset?.fpBreakdownField!==undefined || el.dataset?.fpBreakdownExpense!==undefined || el.dataset?.fpBreakdownEvent!==undefined){
      if(!ui.fpHistoryLive){
        const snap=fpLatestSnapshot();
        if(snap)state.plan=JSON.parse(JSON.stringify(snap.plan));
        ui.fpHistoryLive=true;
      }
      const yenValue=Number(el.value);
      if(!Number.isFinite(yenValue)||yenValue<0){message('0以上の円金額を入力してください');render();return;}
      const number=yenValue/10000;
      if(el.dataset.fpBreakdownField!==undefined){
        const allowed=new Set([...fpDetailCategories.map(x=>x[0]),'utilitiesMonthly','carMonthly','otherLoanMonthly',
          'childInsuranceMonthly','childEducationInsuranceMonthly','childLivingMonthly','daycareMonthly',
          'rentMonthly','managementMonthly','commonFeeMonthly','parkingMonthly','housingOngoing',
          'annualTax','carTaxAnnual','travelAnnual','annualEvents','homeInsuranceAnnual','nisaMonthly','otherInvestMonthly','freeSpendingMonthly','otherSavingsMonthly']);
        if(!allowed.has(el.dataset.fpBreakdownField))return;
        state.plan[el.dataset.fpBreakdownField]=Math.min(10000,number);
      }else if(el.dataset.fpBreakdownExpense!==undefined){
        const entry=state.plan.expenses.find(x=>x.id===el.dataset.fpBreakdownExpense);
        if(!entry)return;
        entry.amount=Math.min(10000,number);
      }else{
        const entry=state.plan.events.find(x=>x.id===el.dataset.fpBreakdownEvent);
        if(!entry)return;
        entry.amount=Math.min(100000,number);
      }
      ui.fpEditingRow=null;
      save();render();
      return;
    }
    if(el.dataset?.memoProperty!==undefined){ui.memoPropertyId=el.value;ui.memoPage=0;ui.memoSwipeKey=null;render();return;}
    if(el.dataset?.study && ui.studyDraft){ui.studyDraft[el.dataset.study]=el.value;}
    if(el.dataset?.fpYear!==undefined){ui.fpYear=Math.floor(Number(el.value)||0);ui.fpLedgerPage=0;render();return;}
    if(el.dataset?.eventId && el.dataset?.eventKey){
      const item=state.plan.events.find(x=>x.id===el.dataset.eventId);
      if(item){
        const k=el.dataset.eventKey,value=el.value;
        if(k==='name')item.name=String(value).slice(0,50);
        if(k==='year')item.year=Math.max(2020,Math.min(2100,Math.floor(Number(value)||simNowYear())));
        if(k==='amount')item.amount=Math.max(0,Number(value)/(el.dataset.fpYen==='true'?10000:1)||0);
        if(k==='month')item.month=Math.max(0,Math.min(12,Math.floor(Number(value)||0)));
        if(k==='type')item.type=value==='income'?'income':'expense';
        save();
      }
      return;
    }
    if(el.dataset?.fpId && el.dataset?.fpKey){
      const entry=state.plan.expenses.find(x=>x.id===el.dataset.fpId);
      if(entry){const k=el.dataset.fpKey;entry[k]=k==='name'?String(el.value).slice(0,50):k==='cycle'?(el.value==='year'?'year':'month'):(k==='amount'?Math.max(0,Math.min(10000,Number(el.value)/(el.dataset.fpYen==='true'?10000:1)||0)):Math.max(0,Math.min(2100,Math.floor(Number(el.value)||0))));save();}
      return;
    }
    if(el.dataset?.sim){
      const k=el.dataset.sim,val=el.value;
      state.plan[k]=['propertyId','highSchool','university'].includes(k)?val:
        (val!==''&&Number.isFinite(Number(val))?Number(val)/(el.dataset.simYen==='true'?10000:1):0);
      if(k==='propertyId'){
        const linked=propById(val);
        if(linked&&num(linked.price)!==null)state.plan.propertyPrice=Number(linked.price);
        const priceInput=app.querySelector('[data-sim="propertyPrice"]');
        if(priceInput)priceInput.value=priceInput.dataset.simYen==='true'?fpYenNumber(state.plan.propertyPrice):state.plan.propertyPrice;
      }
      save();
    }
    if(el.id==='photo-upload'){
      let p=curProp();if(!p)return;
      try{for(const f of Array.from(el.files||[]).slice(0,12)){
        if(!f.type.startsWith('image/'))continue;
        if(f.size>20*1024*1024){message('20MB以上の写真は登録できません');continue;}
        let data=await photoData(f),id=uid();await storePhoto({id,data});p.photos.push(id);
      }save();ui.photoIndex=Math.max(0,p.photos.length-1);render();message('写真を保存しました');}
      catch(err){message('写真の保存に失敗しました。容量をご確認ください。');}
    }
    if(el.id==='json-import'&&el.files?.[0]){await importData(el.files[0]);}
  });
  let touch=null, lastSwipeAt=0;
  let memoTouch=null;
  app.addEventListener('touchstart',e=>{
    const item=e.target.closest('.memo-swipe-wrap');
    if(!item || e.target.closest('input,textarea,select')){memoTouch=null;return;}
    memoTouch={key:item.dataset.memoKey,x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY};
  },{passive:true});
  app.addEventListener('touchend',e=>{
    if(!memoTouch)return;
    const current=memoTouch;memoTouch=null;
    const dx=e.changedTouches[0].clientX-current.x;
    const dy=e.changedTouches[0].clientY-current.y;
    if(Math.abs(dx)<48||Math.abs(dy)>Math.abs(dx)*.65)return;
    lastSwipeAt=Date.now();
    if(dx<0)step(()=>{ui.memoSwipeKey=current.key;});
    else step(()=>{ui.memoSwipeKey=null;});
  },{passive:true});

  app.addEventListener('touchstart',e=>{const zone=e.target.closest('.swipe-zone');if(!zone||e.target.closest('input,textarea,select,label')){touch=null;return;}touch={x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY};},{passive:true});
  app.addEventListener('touchend',e=>{
    if(!touch)return;let dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;touch=null;
    if(Math.abs(dx)<55||Math.abs(dy)>Math.abs(dx)*.7)return;
    lastSwipeAt=Date.now();
    const d=dx<0?1:-1;
    if(ui.overlay==='detail'){
      const p=curProp();if(ui.propertyPage===2&&p.photos.length>1)return step(()=>changePage('photoIndex',p.photos.length,d));
      return step(()=>moveDetail(d));
    }
    if(ui.overlay==='list'||ui.overlay==='choose')return step(()=>changePage('listPage',Math.max(1,Math.ceil((ui.overlay==='list'?visibleProperties().length:state.properties.length)/4)),d));
    if(ui.overlay==='criteria')return step(()=>changePage('criteriaPage',Math.max(1,Math.ceil(state.criteria.length/5)),d));
    if(ui.overlay)return;
    if(ui.tab==='property')step(()=>changePage('homePage',Math.max(1,Math.ceil(visibleProperties().length/homePageSize())),d));
    if(ui.tab==='compare')step(()=>changePage('comparePage',Math.ceil(state.criteria.length/rowsPerPage())+1,d));
  },{passive:true});
  let dbPromise;
  function openDB(){
    if(!('indexedDB' in window))return Promise.reject(Error('IndexedDB unsupported'));
    if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>req.result.createObjectStore('photos',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    return dbPromise;
  }
  async function photoJob(mode,obj){const db=await openDB();return new Promise((resolve,reject)=>{let tx=db.transaction('photos',mode==='get'?'readonly':'readwrite'),req=mode==='get'?tx.objectStore('photos').get(obj):mode==='put'?tx.objectStore('photos').put(obj):mode==='delete'?tx.objectStore('photos').delete(obj):tx.objectStore('photos').clear();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  const storePhoto=p=>photoJob('put',p);const getPhoto=id=>photoJob('get',id);const removePhoto=id=>photoJob('delete',id).catch(()=>{});
  async function photoData(file){
    const source=await new Promise((res,rej)=>{let r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(file);});
    return new Promise((resolve,reject)=>{
      const img=new Image();img.onload=()=>{let ratio=Math.min(1,1400/Math.max(img.width,img.height));let canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*ratio));canvas.height=Math.max(1,Math.round(img.height*ratio));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.79));};img.onerror=()=>reject(Error('画像の読み込み失敗'));img.src=source;
    });
  }
  async function hydratePhotos(){
    const token=++photoToken;const imgs=Array.from(app.querySelectorAll('img[data-photo]'));
    for(const img of imgs){try{const record=await getPhoto(img.dataset.photo);if(token!==photoToken)return;if(record?.data)img.src=record.data;}catch(_){}}
  }
  async function exportData(){
    try{
      const photos={};for(let p of state.properties)for(let id of p.photos){const x=await getPhoto(id);if(x?.data)photos[id]=x.data;}
      const payload=JSON.stringify({format:'hoppy-backup',version:1,exportedAt:new Date().toISOString(),state,photos});
      const blob=new Blob([payload],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='hoppy-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);message('バックアップを作成しました');
    }catch(_){message('書き出しに失敗しました');}
  }
  async function importData(file){
    if(file.size>40*1024*1024)return message('40MBを超えるファイルは読み込めません');
    try{
      const json=JSON.parse(await file.text());
      if(json.format!=='hoppy-backup'||!json.state||typeof json.photos!=='object')throw Error('format');
      const next=normalize(json.state);
      if(!confirm('端末にある現在のデータをバックアップ内容で置き換えます。よろしいですか？'))return;
      const required=new Set(next.properties.flatMap(p=>p.photos));
      for(const id of required){if(typeof json.photos[id]!=='string' || !/^data:image\/(jpeg|png|webp);base64,/.test(json.photos[id]))throw Error('missing photo');}
      const obsolete=state.properties.flatMap(p=>p.photos).filter(id=>!required.has(id));
      for(const id of required)await storePhoto({id,data:json.photos[id]});
      state=next;ui.overlay='';ui.propertyId=null;ui.tab='property';save();render();
      obsolete.forEach(removePhoto);
      message('インポートが完了しました');
    }catch(_){message('バックアップを読み込めませんでした');}
  }
  save();render();
  if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
