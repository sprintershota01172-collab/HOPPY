(() => {
  'use strict';
  const STORE = 'hoppy-phase1-v1';
  const DB_NAME = 'hoppy-photos-v1';
  const statuses = ['気になる','内見予定','内見済','本命','見送り'];
  const kinds = ['新築戸建','中古戸建','新築マンション','中古マンション','土地','その他'];
  const raters = ['husband','wife'];
  const raterLabel = { husband: '夫', wife: '妻' };
  const digits = new Intl.NumberFormat('ja-JP');
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
    cashSavings:300,support:0,livingMonthly:20,rentMonthly:8.2,carMonthly:1.18,
    propertyPrice:4400,propertyId:'',purchaseYear:2028,downPayment:0,interest:1.5,loanYears:35,
    housingOngoing:2.5,weddingYear:2027,weddingCost:350,honeymoonCost:98,
    nisaMonthly:3,highSchool:'public',university:'public',simulateUntil:2045,hasRun:0,
    utilitiesMonthly:0,foodMonthly:0,managementMonthly:0,commonFeeMonthly:0,parkingMonthly:0,
    electricityMonthly:0,gasMonthly:0,waterBiMonthly:0,
    telecomMonthly:0,transportMonthly:0,subscriptionsMonthly:0,leisureMonthly:0,
    lifeInsuranceMonthly:0,medicalInsuranceMonthly:0,carInsuranceMonthly:0,medicalMonthly:0,
    carMaintenanceMonthly:0,otherLoanMonthly:0,otherLoanEndYear:0,childInsuranceMonthly:0,
    childLivingMonthly:0,daycareMonthly:0,childBenefitMonthly:0,
    annualTax:0,carTaxAnnual:0,travelAnnual:0,annualEvents:0,homeInsuranceAnnual:0,
    otherSavingsMonthly:0,otherInvestMonthly:0,nisaBalance:0,investBalance:0,returnAnnual:0,carLoanEndYear:0,
    cashBufferMonthly:3,expenses:[]
  });
  const defaults = () => ({version:2,properties:[],criteria:initialCriteria,scores:{},selected:[],filter:{query:'',tag:'',sort:'new',status:''},plan:defaultPlan(),studyNotes:[]});
  let state;
  try { const raw = localStorage.getItem(STORE); state = raw ? normalize(JSON.parse(raw)) : defaults(); }
  catch (_) { state = defaults(); }
  let ui = {tab:'property',propertyId:null,propertyPage:0,photoIndex:0,noteKind:'good',noteIndex:0,questionPage:0,homePage:0,meetingIndex:0,meetingNoteIndex:0,meetingDraft:null,comparePage:0,rater:'overall',overlay:'',formStep:0,propertyFormPage:0,draft:null,simStep:0,simSubPage:0,simResultPage:0,fpLedgerPage:0,fpHomePage:0,fpYear:0,simChoice:'custom',studyMode:'notes',studyPage:0,studySummaryPage:0,studyDraft:null,studyEditId:null,studyDigestPage:0,memoScope:'individual',memoPropertyId:'',memoPage:0,memoSwipeKey:null,listPage:0,criteriaPage:0,criterionId:null,scoreProperty:null,scoreCriterion:null,scoreRater:'husband',lock:0,toast:null};
  let photoUrl = null,photoToken = 0,toastTimer = null;
  function normalize(s) {
    if (!s || !Array.isArray(s.properties) || !Array.isArray(s.criteria)) throw Error('形式が違います');
    const out = defaults();
    out.properties = s.properties.filter(p=>p && typeof p.id==='string').map(p=>({...blankProperty(),...p,notes:{good:Array.isArray(p.notes?.good)?p.notes.good:[''],bad:Array.isArray(p.notes?.bad)?p.notes.bad:['']},questions:Array.isArray(p.questions)?p.questions:[],meetings:Array.isArray(p.meetings)?p.meetings.filter(m=>m && typeof m.id==='string').map(m=>({id:m.id,at:typeof m.at==='string'?m.at:'',maker:String(m.maker||''),type:m.type==='内見'?'内見':'打ち合わせ',notes:Array.isArray(m.notes)&&m.notes.length?m.notes.map(x=>String(x).slice(0,220)):['']})):[],photos:Array.isArray(p.photos)?p.photos:[],tags:Array.isArray(p.tags)?p.tags:[]}));
    out.criteria = s.criteria.filter(c=>c && typeof c.id==='string' && typeof c.name==='string').map(c=>({...c,weight:Math.min(3,Math.max(1,Number(c.weight)||1))}));
    out.scores = s.scores && typeof s.scores==='object' ? s.scores : {};
    out.selected = Array.isArray(s.selected)?s.selected.filter(id=>out.properties.some(p=>p.id===id)).slice(0,3):[];
    out.filter = {...out.filter,...s.filter};
    if(s.plan && typeof s.plan==='object') {
      for(const k of Object.keys(out.plan)) {
        if(k in s.plan && (typeof s.plan[k]==='string'||typeof s.plan[k]==='number'))out.plan[k]=s.plan[k];
      }
      out.plan.expenses=Array.isArray(s.plan.expenses)?s.plan.expenses.slice(0,35).filter(x=>x&&typeof x.id==='string').map(x=>({
        id:String(x.id).slice(0,80),name:String(x.name||'追加支出').slice(0,50),amount:Math.min(10000,Math.max(0,Number(x.amount)||0)),
        cycle:x.cycle==='year'?'year':'month',start:Math.max(0,Math.floor(Number(x.start)||0)),end:Math.max(0,Math.floor(Number(x.end)||0))
      })):[];
    }
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
  function step(action){if(Date.now()<ui.lock)return;ui.lock=Date.now()+(reduced.matches?100:680);action();render();}
  function closeOverlay(){step(()=>{ui.overlay='';ui.draft=null;});}
  function openOverlay(kind, setup){step(()=>{ui.overlay=kind;if(setup)setup();});}
  function chooseTab(tab){step(()=>{ui.tab=tab;ui.overlay='';ui.draft=null;});}
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
    const body=ui.tab==='property'?propertyScreen():ui.tab==='compare'?compareScreen():ui.tab==='sim'?simulationScreen():ui.tab==='memo'?memoScreen():pendingScreen();
    app.innerHTML=toolbar(titles[ui.tab])+'<main class="main">'+body+'</main><nav class="bottom" aria-label="メインメニュー">'+nav.map(([key,name])=>'<button class="tab '+(ui.tab===key?'active':'')+'" data-act="tab" data-value="'+key+'" aria-current="'+(ui.tab===key?'page':'false')+'"><span class="nav-icon">'+tabIcon(key)+'</span><span class="tab-label">'+name+'</span></button>').join('')+'</nav>'+(ui.overlay?overlay(): '');
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
  const nField=(label,key,unit,placeholder)=>'<label class="sim-field"><span>'+esc(label)+'</span><span class="sim-input-wrap"><input type="number" data-sim="'+key+'" value="'+esc(state.plan[key])+'" min="'+(key==='returnAnnual'?-20:0)+'" '+(key==='returnAnnual'?'max="20"':'')+' step="any" inputmode="decimal" placeholder="'+esc(placeholder||'')+'"><em>'+esc(unit)+'</em></span></label>';
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
      '<label>金額（万円）<input data-fp-id="'+esc(x.id)+'" data-fp-key="amount" type="number" min="0" max="10000" step=".1" inputmode="decimal" value="'+esc(x.amount)+'"></label>'+
      '<label>周期<select data-fp-id="'+esc(x.id)+'" data-fp-key="cycle"><option value="month" '+(x.cycle==='month'?'selected':'')+'>毎月</option><option value="year" '+(x.cycle==='year'?'selected':'')+'>毎年</option></select></label>'+
      '<label>開始年<input data-fp-id="'+esc(x.id)+'" data-fp-key="start" type="number" min="0" max="2100" value="'+(x.start||'')+'" placeholder="指定なし"></label>'+
      '<label>終了年<input data-fp-id="'+esc(x.id)+'" data-fp-key="end" type="number" min="0" max="2100" value="'+(x.end||'')+'" placeholder="指定なし"></label></div></div>').join(''):
      '<p class="fp-extra-empty">＋ 追加から、習い事・学資保険・仕送りなどを登録できます。</p>')+
      '<p class="fp-field-hint">追加した費用はFPの予算・年間収支に反映されます。</p></div>';
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
    if(i===1)pages.push(fpCompactPage('収入と給付金',[
      f('夫・月手取り','husbandMonthly'),f('妻・月手取り','wifeMonthly'),
      f('夫・年間賞与','husbandBonus','万円/年'),f('妻・年間賞与','wifeBonus','万円/年'),
      f('子ども関連の給付金','childBenefitMonthly','万円/人月')
    ],'子ども関連の給付金は受給条件の自動判定を行いません。'));
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
        '<div class="fp-legacy-note">旧・光熱費合算 '+yen(p.utilitiesMonthly,2)+'万円/月。上の内訳を入力すると合算額の代わりに使います。<button data-act="fp-legacy-utilities-clear">旧合算を削除</button></div>':''));
      pages.push(fpCompactPage('毎日の支払い',[
        f('その他の生活費','livingMonthly'),f('通信・スマホ','telecomMonthly'),
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
      sSelect('高校','highSchool',[['public','公立'],['private','私立']]),
      sSelect('大学','university',[['public','国公立'],['private','私立']])
    ],'保険0〜22歳、生活費0〜17歳、保育料0〜5歳で計算します。'));
    if(i===4){
      const options=[['','価格を直接入力'],...state.properties.filter(x=>num(x.price)!==null).map(x=>[x.id,truncate(x.name,17)+' / '+fmt(x.price)])];
      pages.push(fpCompactPage('購入予定',[
        sSelect('登録物件から選択','propertyId',options),
        f('購入予定価格','propertyPrice','万円'),f('購入予定年','purchaseYear','年'),
        f('頭金','downPayment','万円')
      ],'購入諸費用は物件価格の7％で仮計算します。'));
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
        f('結婚式自己負担','weddingCost','万円'),
        f('新婚旅行費','honeymoonCost','万円'),
        f('試算終了年','simulateUntil','年')
      ]));
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
  function simulationScreen(){
    const i=ui.simStep;
    if(i>=7)return simulationResultsScreen();
    const p=state.plan,pages=fpWizardPages(i);
    ui.simSubPage=Math.max(0,Math.min(pages.length-1,Number(ui.simSubPage)||0));
    const n=ui.simSubPage;
    const labels=i===2?['食費・住居','水道光熱','日常費','保険等']:i===4?['購入','維持費']:i===5?['資産','積立']:null;
    return '<section class="screen sim-screen fp-wizard-screen"><div class="sim-intro"><span class="kicker">FP • LIFE SIMULATOR / r2</span>'+
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
    let preschool=0,living=0,insured=0;
    for(let k=0;k<kids;k++){
      const age=year-(safeNum(p.firstChildYear)+k*Math.max(1,safeNum(p.birthInterval,3)));
      if(age>=0&&age<6)preschool++;
      if(age>=0&&age<18)living++;
      if(age>=0&&age<23)insured++;
    }
    return {preschool,living,insured};
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
    // Before separate utility fields existed, a single amount was stored. Count either the old total or the new breakdown, never both.
    if(!['electricityMonthly','gasMonthly','waterBiMonthly'].some(key=>safeNum(p[key])>0) && safeNum(p.utilitiesMonthly)>0)
      parts.push({key:'utilitiesMonthly',label:'旧・光熱費合計',value:safeNum(p.utilitiesMonthly)});
    if(!safeNum(p.carLoanEndYear)||year<=safeNum(p.carLoanEndYear))parts.push({key:'carMonthly',label:'車ローン',value:safeNum(p.carMonthly)});
    if(!safeNum(p.otherLoanEndYear)||year<=safeNum(p.otherLoanEndYear)){
      parts.push({key:'otherLoanMonthly',label:'その他のローン',value:safeNum(p.otherLoanMonthly)});
    }
    const count=fpChildCounts(year);
    parts.push({key:'childInsuranceMonthly',label:'子どもの保険',value:count.insured*safeNum(p.childInsuranceMonthly)});
    parts.push({key:'childLivingMonthly',label:'子どもの生活費',value:count.living*safeNum(p.childLivingMonthly)});
    parts.push({key:'daycareMonthly',label:'保育料・幼稚園',value:count.preschool*safeNum(p.daycareMonthly)});
    return parts;
  }
  function modelYears(price,buy){
    const p=state.plan,start=simNowYear(),end=Math.max(start+9,Math.min(start+30,safeNum(p.simulateUntil,start+19))),
      purchaseYear=safeNum(p.purchaseYear,start+2),weddingYear=safeNum(p.weddingYear,start+1),
      payment=mortgageMonthly(price,p.downPayment,p.interest,p.loanYears);
    let cash=safeNum(p.cashSavings)+safeNum(p.support);
    let nisa=safeNum(p.nisaBalance),otherInvest=safeNum(p.investBalance);
    let investedContributions=0;
    const points=[],kids=Math.min(3,Math.round(safeNum(p.children)));
    const annualGrowth=1+Math.min(.2,Math.max(-.2,Number(p.returnAnnual)||0)/100);
    for(let year=start;year<=end;year++){
      const mother=kids&&year>=safeNum(p.firstChildYear)?(year===safeNum(p.firstChildYear)
        ?Math.min(safeNum(p.wifeMonthly),10):safeNum(p.wifeReduced)):safeNum(p.wifeMonthly);
      const wifeBonus=kids&&year>=safeNum(p.firstChildYear)?0:safeNum(p.wifeBonus);
      const children=fpChildCounts(year);
      const income=12*(safeNum(p.husbandMonthly)+mother)+safeNum(p.husbandBonus)+wifeBonus+
        12*children.living*safeNum(p.childBenefitMonthly);
      const monthlyParts=fpBaseMonthly(year);
      const housing=buy&&year>=purchaseYear?payment+safeNum(p.housingOngoing):fpRentMonthly(p);
      const monthly=monthlyParts.reduce((sum,x)=>sum+x.value,0)+housing;
      const annualFixed=safeNum(p.annualTax)+safeNum(p.carTaxAnnual)+safeNum(p.travelAnnual)+
        safeNum(p.annualEvents)+(buy&&year>=purchaseYear?safeNum(p.homeInsuranceAnnual):0)+fpCustomAnnual(year);
      let school=0,birth=0;
      for(let child=0;child<kids;child++){
        const age=year-(safeNum(p.firstChildYear)+child*Math.max(1,safeNum(p.birthInterval,3)));
        if(age===0)birth+=50;
        school+=educationAnnual(age,p);
      }
      const upfront=buy&&year===purchaseYear?safeNum(p.downPayment)+safeNum(price)*.07:0;
      const events=year===weddingYear?safeNum(p.weddingCost)+safeNum(p.honeymoonCost):0;
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
        monthly,school,birth,annualFixed,upfront,events,housing,education:school,
        monthlyParts,children,contributions:investedContributions});
    }
    return {points,monthly:payment,purchaseYear,ending:points.at(-1).cash,
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
  function fpBadgeClass(level){return level==='good'?'fp-good':level==='warn'?'fp-warn':'fp-bad';}
  function fpRatingRow(p){
    const price=num(p.price);
    if(price===null)return '<div class="fp-home-row"><span class="fp-home-name">'+esc(p.name)+'</span><span class="fp-home-badge fp-neutral">価格未登録</span></div>';
    const check=fpRating(price);
    return '<button class="fp-home-row" data-act="fp-open-home" data-value="'+esc(p.id)+'"><span class="fp-home-name">'+esc(p.name)+'</span><span class="fp-home-price">'+yen(price)+'万</span><span class="fp-home-badge '+fpBadgeClass(check.level)+'">'+check.label+'</span><span class="fp-chevron">›</span></button>';
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
    if(!ui.fpYear||!points.some(x=>x.year===ui.fpYear))ui.fpYear=Math.max(points[0].year,Math.min(points.at(-1).year,fpDecisionYear()));
    return '<label class="fp-year-select"><span>表示する年</span><select data-fp-year aria-label="収支を表示する年">'+points.map(x=>'<option value="'+x.year+'" '+(x.year===ui.fpYear?'selected':'')+'>'+x.year+'年</option>').join('')+'</select></label>';
  }
  function fpExpenseDetails(point,buy){
    const p=state.plan,year=point.year;
    const result=[
      ...point.monthlyParts.map(x=>({label:x.label,amount:x.value*12})),
      ...(buy&&year>=safeNum(p.purchaseYear)?[{label:'住宅ローン・維持費',amount:point.housing*12}]:[
        ['rentMonthly','家賃'],['managementMonthly','管理費'],['commonFeeMonthly','共益費'],['parkingMonthly','駐車場']
      ].map(([key,label])=>({label,amount:safeNum(p[key])*12}))),
      {label:'学校・大学の費用',amount:point.school},
      {label:'出産関連',amount:point.birth},
      {label:'自動車税など年払い',amount:safeNum(p.carTaxAnnual)},
      {label:'旅行・帰省',amount:safeNum(p.travelAnnual)},
      {label:'その他の税金',amount:safeNum(p.annualTax)},
      {label:'年内イベント・家電',amount:safeNum(p.annualEvents)},
      {label:'火災保険',amount:buy&&year>=safeNum(p.purchaseYear)?safeNum(p.homeInsuranceAnnual):0}
    ];
    for(const x of p.expenses||[]){
      if((x.start&&year<x.start)||(x.end&&year>x.end))continue;
      result.push({label:x.name,amount:safeNum(x.amount)*(x.cycle==='year'?1:12)});
    }
    result.push({label:'頭金・購入諸費用',amount:point.upfront});
    result.push({label:'結婚式・新婚旅行',amount:point.events});
    return result.filter(x=>x.amount>0).sort((a,b)=>b.amount-a.amount);
  }
  function simulationResultsScreen(){
    const p=state.plan,price=safeNum(p.propertyPrice),linked=propById(p.propertyId);
    const budget=fpBudget(),assessment=fpRating(price),current=modelYears(price,true),rent=modelYears(price,false);
    const page=ui.simResultPage,eduKids=Math.min(3,Math.round(safeNum(p.children)));
    let eduTotal=0;
    for(let k=0;k<eduKids;k++)for(let age=0;age<22;age++)eduTotal+=educationAnnual(age,p);
    const heading=['あなたの住宅予算','支出の内訳','現金とNISAの推移','教育費の準備'][page];
    const intro='<div class="sim-intro"><span class="kicker">FP • LIFE PLAN / r2</span><button class="btn compact" data-act="sim-restart">回答を編集 <span aria-hidden="true">↗</span></button></div>';
    const steps='<div class="fp-result-nav">'+['予算','支出','資産','教育'].map((x,i)=>
      '<button data-act="fp-result-tab" data-value="'+i+'" class="'+(page===i?'active':'')+'">'+x+'</button>').join('')+'</div>';
    let content='';
    if(page===0){
      const homes=state.properties.slice().sort((a,b)=>b.created-a.created);
      const futureWarning=current.min<0?'<div class="fp-alert"><b>！</b>将来の貯金が一時的にマイナスになる年があります。大きな支出の時期も再確認してください。</div>':'';
      const homePages=Math.max(1,Math.ceil(homes.length/2));
      ui.fpHomePage=Math.min(homePages-1,ui.fpHomePage);
      const propertyList=homes.length?'<div class="fp-home-list">'+homes.slice(ui.fpHomePage*2,ui.fpHomePage*2+2).map(fpRatingRow).join('')+'</div>'+
        fpPageNav(homePages,ui.fpHomePage,'fp-home-page'):
        '<div class="fp-no-property">物件を登録すると予算内か自動判定できます。</div>';
      content='<div class="fp-budget-content grow">'+
        '<div class="fp-hero"><span class="fp-eyebrow">返済負担から算出した参考予算</span><div class="fp-hero-number">'+yen(budget.amount)+'<span>万円</span></div><span class="fp-hero-caption">手取り25％＋家計余力・金利 '+yen(budget.amount>=0?assessment.rate:0,1)+'％想定</span>'+
        '<div class="fp-budget-scale"><div class="fp-budget-fill"></div></div><span class="fp-secondary">金利＋1％なら　<strong>'+yen(budget.stressAmount)+'万円</strong>が目安</span></div>'+
        '<div class="fp-now-card"><div class="fp-now-head"><div><span class="fp-eyebrow">検討中の価格</span><strong>'+yen(price)+'万円</strong></div><span class="fp-verdict '+fpBadgeClass(assessment.level)+'">'+assessment.label+'</span></div>'+
        '<p class="fp-diagnostic">'+esc(assessment.reason)+'</p>'+
        '<div class="fp-stat-grid"><div><span>月々の住居費</span><strong>'+yen(assessment.housing,1)+'万</strong></div><div><span>手取り負担率</span><strong>'+yen(assessment.ratio*100,1)+'％</strong></div><div><span>現金貯金の余力</span><strong>'+yen(assessment.spendable,1)+'万</strong></div></div></div>'+
        '<div class="fp-section-head"><strong>物件の予算評価</strong><span>'+homes.length+'件</span></div>'+
        propertyList+
        '<p class="fp-assumption">※ 手取り25％の住居費目安と、毎月の保険・子育て・NISA・現金貯金目標を考慮。銀行の融資可能額ではありません。</p>'+
        futureWarning+'</div>';
    }else if(page===1){
      const point=current.points.find(x=>x.year===ui.fpYear)||current.points.find(x=>x.year===fpDecisionYear())||current.points[0];
      const items=fpExpenseDetails(point,true);
      const total=items.reduce((sum,x)=>sum+x.amount,0);
      const pageSize=window.matchMedia('(max-height:720px)').matches?4:6;
      const count=Math.max(1,Math.ceil(items.length/pageSize));
      ui.fpLedgerPage=Math.min(count-1,ui.fpLedgerPage);
      const visible=items.slice(ui.fpLedgerPage*pageSize,(ui.fpLedgerPage+1)*pageSize);
      content='<div class="fp-breakdown-content grow">'+fpYearSelect(current)+
        '<div class="fp-year-totals"><div><span>手取り・給付金</span><strong>'+yen(point.incomes,0)+'万円</strong></div>'+
        '<div><span>年間支出</span><strong>'+yen(point.expenses,0)+'万円</strong></div>'+
        '<div><span>NISA等の投資積立</span><strong>'+yen(point.investing,0)+'万円</strong></div>'+
        '<div><span>現金貯金の増減</span><strong class="'+(point.netCash<0?'fp-negative':'')+'">'+yen(point.netCash,0)+'万円</strong></div></div>'+
        '<div class="fp-section-head"><strong>年間の支出明細</strong><span>'+items.length+'項目</span></div>'+
        '<div class="fp-expense-rows">'+visible.map(x=>'<div class="fp-expense-line"><span>'+esc(x.label)+'</span><strong>'+yen(x.amount,1)+' 万円</strong></div>').join('')+'</div>'+fpPageNav(count,ui.fpLedgerPage,'fp-ledger-page')+
        '<p class="fp-assumption">年間支出 '+yen(total,1)+' 万円。NISA・その他投資への積立は支出と区別し、現金から投資資産へ振替えます。現金貯金目標も支出には含みません。</p>'+
        '<p class="fp-assumption">※ 年間額は1〜12月の計算です。給与変化・税金・教育費・給付金は入力条件と簡易モデルによります。</p></div>';
    }else if(page===2){
      const now=assessment,stress=assessment.stressed,positive=assessment.remaining>=assessment.reserve;
      const cash=assessment.remaining,need=assessment.reserve;
      const selected=current.points.find(x=>x.year===ui.fpYear)||current.points.find(x=>x.year===fpDecisionYear())||current.points[0];
      const warning=now.remaining<0?'自己資金が不足しています。':!positive?'購入後の生活防衛資金が6か月分を下回る計算です。':'購入直後の生活防衛資金は6か月分を確保できる計算です。';
      content='<div class="fp-cash-content grow">'+fpYearSelect(current)+'<div class="panel fp-finance-card">'+
        '<div class="fp-section-head"><strong>貯金の推移</strong><span>'+current.points[0].year+'–'+current.points.at(-1).year+'</span></div>'+
        simGraph([{label:'現金貯金',color:'#007aff',data:current,key:'cash'},{label:'NISA＋その他投資',color:'#26a369',data:current,key:'invested'},{label:'賃貸時の現金',color:'#b5b9c2',data:rent,key:'cash'}])+
        '<div class="sim-legend"><span><i style="background:#007aff"></i>現金</span><span><i style="background:#26a369"></i>運用資産</span><span><i style="background:#b5b9c2"></i>賃貸時</span></div>'+
        '<p class="sim-hint">'+(current.min<0?'！ 購入するケースで貯金がマイナスになる年があります。':'✓ この試算期間で現金貯金はマイナスになりません。')+'</p></div>'+
        '<div class="fp-asset-summary">'+
        '<div><span>現金貯金</span><strong>'+yen(selected.cash,0)+'万円</strong></div>'+
        '<div><span>NISA</span><strong>'+yen(selected.nisa,0)+'万円</strong></div>'+
        '<div><span>その他投資</span><strong>'+yen(selected.otherInvest,0)+'万円</strong></div>'+
        '<div><span>金融資産合計</span><strong>'+yen(selected.total,0)+'万円</strong></div></div>'+
        '<div class="fp-insight-row"><div class="fp-insight"><span>金利＋1％で</span><strong>月 '+yen(now.monthlyDelta,1)+'万円 増</strong></div><div class="fp-insight"><span>現金の残り</span><strong>'+yen(cash,0)+'万円</strong></div></div>'+
        '<p class="fp-cash-note">'+(positive?'✓':'！')+' '+warning+'（6か月分の目安 '+yen(need,0)+'万円）</p>'+
        '<p class="fp-assumption">税・修繕費は月額一定、教育費は標準的な概算。金利・物価変動や給付金は精密には反映していません。</p></div>';
    }else{
      const years=Math.max(1,18+safeNum(p.birthInterval)*(eduKids-1));
      content='<div class="fp-education-content panel grow"><span class="fp-eyebrow">幼児期〜大学卒業まで</span><div class="fp-education-total">'+yen(eduTotal)+'<small>万円</small></div>'+
        '<span class="fp-education-sub">子ども '+eduKids+' 人分の教育費の概算</span>'+
        '<div class="fp-metric-line"><span>高校</span><strong>'+(p.highSchool==='private'?'私立':'公立')+'</strong></div>'+
        '<div class="fp-metric-line"><span>大学</span><strong>'+(p.university==='private'?'私立':'国公立')+'</strong></div>'+
        '<div class="fp-metric-line"><span>月々の積立目安</span><strong>'+yen(eduTotal/years/12,1)+' 万円</strong></div>'+
        '<div class="fp-metric-line"><span>現在のNISA予定額</span><strong>'+yen(safeNum(p.nisaMonthly),1)+' 万円</strong></div>'+
        '<p class="fp-assumption">※ 教育費は進学先や物価で大きく変わります。教育費積立はNISAの運用益を含まない概算です。</p></div>';
    }
    return '<section class="screen sim-screen fp-result-screen">'+intro+'<h2 class="sim-result-title">'+heading+'</h2>'+steps+content+
      '<div class="fp-bottom-actions"><button class="btn" data-act="sim-restart">↶ 条件を見直す</button><button class="btn primary" data-act="fp-result-next">'+(page===3?'予算に戻る':'次へ →')+'</button></div></section>';
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
      selector+
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
    if(action==='fp-home-page')return step(()=>{ui.fpHomePage=Math.max(0,Number(v)||0);});
    if(action==='sim-next')return step(()=>{if(ui.simStep===6)state.plan.hasRun=1;ui.simStep=Math.min(7,ui.simStep+1);ui.simSubPage=0;ui.simResultPage=0;save();});
    if(action==='sim-back')return step(()=>{ui.simStep=Math.max(0,ui.simStep-1);ui.simSubPage=0;});
    if(action==='sim-restart')return step(()=>{ui.simStep=0;ui.simSubPage=0;ui.simResultPage=0;});
    if(action==='sim-result-page')return step(()=>changePage('simResultPage',4,Number(v)));
    if(action==='fp-result-tab')return step(()=>{ui.simResultPage=Math.min(3,Math.max(0,Number(v)||0));ui.fpLedgerPage=0;ui.fpHomePage=0;});
    if(action==='fp-legacy-utilities-clear')return step(()=>{state.plan.utilitiesMonthly=0;save();message('旧光熱費の合算額を削除しました');});
    if(action==='fp-expense-add')return step(()=>{if(state.plan.expenses.length>=35)return message('追加支出は35項目までです');state.plan.expenses.push({id:uid(),name:'新しい支出',amount:0,cycle:'month',start:0,end:0});ui.simSubPage=2+Math.floor((state.plan.expenses.length-1)/2);save();});
    if(action==='fp-expense-delete'){if(!confirm('この追加支出を削除しますか？'))return;return step(()=>{state.plan.expenses=state.plan.expenses.filter(x=>x.id!==v);ui.simSubPage=Math.min(ui.simSubPage,fpWizardPages(6).length-1);save();});}
    if(action==='fp-result-next')return step(()=>{ui.simResultPage=(ui.simResultPage+1)%4;ui.fpLedgerPage=0;ui.fpHomePage=0;});
    if(action==='sim-choice')return step(()=>{ui.simChoice=v;save();});
    if(action==='fp-view-budget')return step(()=>{ui.tab='sim';ui.simStep=7;ui.simResultPage=0;ui.overlay='';});
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
  app.addEventListener('keydown',e=>{if(e.target?.dataset?.homeQuery!==undefined && e.key==='Enter'){e.preventDefault();e.target.blur?.();step(()=>{ui.homePage=0;save();});}});
  app.addEventListener('input',e=>{
    let el=e.target,p=curProp();
    if(el.dataset.model && ui.draft){
      let k=el.dataset.model;ui.draft[k]=k==='tags'?el.value.split(/[,、]/).map(s=>s.trim()).filter(Boolean):el.value;
    }
    if(el.dataset.meetingModel && ui.meetingDraft){const key=el.dataset.meetingModel;if(key==='memo')ui.meetingDraft.notes[0]=el.value;else ui.meetingDraft[key]=el.value;}
    if(el.dataset.homeQuery!==undefined){state.filter.query=el.value;ui.homePage=0;save();const list=app.querySelector('.home-results');if(list){list.innerHTML=homeResults();hydratePhotos();}}
    if(el.dataset.memoProperty!==undefined){ui.memoPropertyId=el.value;ui.memoPage=0;ui.memoSwipeKey=null;render();return;}
    if(el.dataset.study && ui.studyDraft){ui.studyDraft[el.dataset.study]=el.value;}
    if(el.dataset?.fpYear!==undefined){ui.fpYear=Math.floor(Number(el.value)||0);ui.fpLedgerPage=0;render();return;}
    if(el.dataset?.fpId && el.dataset?.fpKey){
      const entry=state.plan.expenses.find(x=>x.id===el.dataset.fpId);
      if(entry){const k=el.dataset.fpKey;entry[k]=k==='name'?String(el.value).slice(0,50):k==='cycle'?(el.value==='year'?'year':'month'):(k==='amount'?Math.max(0,Math.min(10000,Number(el.value)||0)):Math.max(0,Math.min(2100,Math.floor(Number(el.value)||0))));save();}
      return;
    }
    if(el.dataset.sim){
      const k=el.dataset.sim, val=el.value;
      state.plan[k]=['propertyId','highSchool','university'].includes(k)?val:(val!==''&&Number.isFinite(Number(val))?Number(val):0);
      if(k==='propertyId'){
        const linked=propById(val);
        if(linked && num(linked.price)!==null)state.plan.propertyPrice=Number(linked.price);
        const priceInput=app.querySelector('[data-sim="propertyPrice"]');
        if(priceInput)priceInput.value=state.plan.propertyPrice;
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
    if(el.dataset?.memoProperty!==undefined){ui.memoPropertyId=el.value;ui.memoPage=0;ui.memoSwipeKey=null;render();return;}
    if(el.dataset?.study && ui.studyDraft){ui.studyDraft[el.dataset.study]=el.value;}
    if(el.dataset?.fpYear!==undefined){ui.fpYear=Math.floor(Number(el.value)||0);ui.fpLedgerPage=0;render();return;}
    if(el.dataset?.fpId && el.dataset?.fpKey){
      const entry=state.plan.expenses.find(x=>x.id===el.dataset.fpId);
      if(entry){const k=el.dataset.fpKey;entry[k]=k==='name'?String(el.value).slice(0,50):k==='cycle'?(el.value==='year'?'year':'month'):(k==='amount'?Math.max(0,Math.min(10000,Number(el.value)||0)):Math.max(0,Math.min(2100,Math.floor(Number(el.value)||0))));save();}
      return;
    }
    if(el.dataset?.sim){
      const k=el.dataset.sim,val=el.value;
      state.plan[k]=['propertyId','highSchool','university'].includes(k)?val:(val!==''&&Number.isFinite(Number(val))?Number(val):0);
      if(k==='propertyId'){
        const linked=propById(val);
        if(linked&&num(linked.price)!==null)state.plan.propertyPrice=Number(linked.price);
        const priceInput=app.querySelector('[data-sim="propertyPrice"]');
        if(priceInput)priceInput.value=state.plan.propertyPrice;
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
