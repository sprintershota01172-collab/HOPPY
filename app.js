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
    nisaMonthly:3,highSchool:'public',university:'public',simulateUntil:2045
  });
  const defaults = () => ({version:2,properties:[],criteria:initialCriteria,scores:{},selected:[],filter:{query:'',tag:'',sort:'new',status:''},plan:defaultPlan(),studyNotes:[]});
  let state;
  try { const raw = localStorage.getItem(STORE); state = raw ? normalize(JSON.parse(raw)) : defaults(); }
  catch (_) { state = defaults(); }
  let ui = {tab:'property',propertyId:null,propertyPage:0,photoIndex:0,noteKind:'good',noteIndex:0,questionPage:0,homePage:0,meetingIndex:0,meetingNoteIndex:0,meetingDraft:null,comparePage:0,rater:'husband',overlay:'',formStep:0,draft:null,simStep:0,simResultPage:0,simChoice:'custom',studyMode:'notes',studyPage:0,studySummaryPage:0,studyDraft:null,studyEditId:null,listPage:0,criteriaPage:0,criterionId:null,scoreProperty:null,scoreCriterion:null,scoreRater:'husband',lock:0,toast:null};
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
    }
    out.studyNotes = Array.isArray(s.studyNotes)?s.studyNotes.filter(n=>n&&typeof n.id==='string').slice(0,300).map(n=>({
      id:n.id,title:String(n.title||'家の学び').slice(0,65),text:String(n.text||'').slice(0,2500),
      created:Number(n.created)||Date.now()
    })):[];

    return out;
  }
  function save() { try {localStorage.setItem(STORE,JSON.stringify(state));} catch (_) {message('保存容量に達しました。バックアップを作成してください。');} }
  function message(text) {ui.toast=text;renderToast();clearTimeout(toastTimer);toastTimer=setTimeout(()=>{ui.toast=null;renderToast();},2700);}
  function renderToast(){let old=app.querySelector('.toast');if(old)old.remove();if(ui.toast)app.insertAdjacentHTML('beforeend','<div class="toast" role="status">'+esc(ui.toast)+'</div>');}
  const propById = id => state.properties.find(p=>p.id===id);
  const curProp = () => {const visible=visibleProperties(); return visible.find(p=>p.id===ui.propertyId) || visible[0] || null;};
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
    const paths={property:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',compare:'<path d="M12 3v18M5 7h14M7 7l-4 7h8L7 7Zm10 0-4 7h8l-4-7ZM4 18h16"/>',sim:'<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M8 6.5h8M8 11h2m4 0h2M8 15h2m4 0h2M8 19h2m4 0h2"/>',schedule:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 10h18"/>'};
    return '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[key]+'</svg>';
  }
  function toolbar(title){
    const count=state.properties.filter(p=>p.status!=='見送り').length;
    return '<header class="top modern-top"><div class="brand-block"><span class="brand-symbol" aria-hidden="true">'+tabIcon('property')+'</span><div class="brand"><h1>'+esc(ui.tab==='property'?'ほっぽさん':title)+'</h1><span class="eyebrow">HOME PLANNER</span></div></div><div class="header-actions">'+(ui.tab==='property'?'<button class="header-learn" data-act="study-open">学び</button><span class="header-count">♥ <b>'+count+'件</b></span>':'')+'<button class="iconbtn settings-gear" data-act="settings" aria-label="バックアップ・設定">⚙</button></div></header>';
  }
  function render(){
    if(!app)return;
    const titles={property:'ほっぽさん',compare:'比較',sim:'シミュレーション',schedule:'予定'};
    const nav=[['property','物件'],['compare','比較'],['sim','シミュ'],['schedule','予定']];
    const body=ui.tab==='property'?propertyScreen():ui.tab==='compare'?compareScreen():ui.tab==='sim'?simulationScreen():pendingScreen();
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
    return '<button class="property-list-card" data-act="home-open" data-value="'+esc(p.id)+'" aria-label="'+name+'の詳細を開く"><span class="property-thumb">'+thumb+'</span><span class="property-card-body"><span class="property-first-row"><strong class="property-list-name" title="'+name+'">'+name+'</strong><span class="property-list-maker" title="'+maker+'">'+maker+'</span><span class="property-state '+tag+'">'+esc(p.status)+'</span></span><span class="property-second-row"><span class="prop-price">'+(num(p.price)!==null?digits.format(p.price)+'万':'価格未登録')+'</span><span class="prop-station">'+(num(p.station)!==null?'徒歩'+digits.format(p.station)+'分':'駅徒歩 −')+'</span><span class="prop-meeting">'+(latest?(future?eventType+' ':'済 ')+date:'予定なし')+'</span></span></span><span class="property-chevron" aria-hidden="true">›</span></button>';
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
        content='<div class="panel detail grow swipe-zone"><div class="notes-title"><span class="kicker">営業担当に聞くこと</span><span class="meta">'+p.questions.length+' 件</span></div><div class="question-list">'+(subset.length?subset.map(q=>'<div class="question-row '+(q.done?'done':'')+'"><button class="checkbtn" data-act="question-toggle" data-value="'+esc(q.id)+'" aria-label="確認済みを切替">'+(q.done?'✓':'○')+'</button><span>'+esc(q.text)+'</span><button class="ellipsis" data-act="question-delete" data-value="'+esc(q.id)+'" aria-label="質問を削除">×</button></div>').join(''):'<div class="empty grow"><p>聞きたいことを登録しましょう。</p></div>')+'</div>'+navPager(Math.min(ui.questionPage,Math.max(0,Math.ceil(p.questions.length/4)-1)),Math.max(1,Math.ceil(p.questions.length/4)),'question-nav')+'<button class="btn primary wide" data-act="add-question">＋ 質問を追加</button></div>';
      } else {
        const note=notes[ui.noteIndex]||'';
        content='<div class="panel detail grow swipe-zone"><div class="notes-title"><span class="kicker">'+(ui.noteKind==='good'?'よかった点':'気になる点')+'</span><span class="meta">'+note.length+' / 220文字</span></div><textarea class="note-text" data-note="'+ui.noteKind+'" maxlength="220" placeholder="ここにメモを書きます。1ページ220文字まで。">'+esc(note)+'</textarea><div class="note-actions"><button class="btn compact" data-act="note-delete" '+(notes.length<2?'disabled':'')+'>削除</button>'+'<button class="btn compact" data-act="note-nav" data-value="-1" '+(ui.noteIndex===0?'disabled':'')+'>‹</button><span class="meta">'+(ui.noteIndex+1)+' / '+notes.length+'</span><button class="btn compact" data-act="note-nav" data-value="1" '+(ui.noteIndex===notes.length-1?'disabled':'')+'>›</button><button class="btn compact primary" data-act="note-add">＋</button></div></div>';
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
    return '<div class="panel detail grow meeting-panel swipe-zone"><div class="meeting-record-head"><div class="meeting-date-block"><span class="micro-label">'+esc(m.type==='内見'?'内見日時':'打ち合わせ日時')+'</span><strong>'+esc(formatMeetingDate(m.at))+'</strong><span>'+esc(m.maker||p.manufacturer||'メーカー未登録')+'</span></div><div class="row"><button class="btn compact" data-act="meeting-edit">編集</button><button class="btn compact" data-act="meeting-delete" aria-label="削除">×</button></div></div>'+
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
    ].join('');
    return modalFrame(p._new?'物件を追加':'基本情報を編集',
      '<div class="property-editor"><div class="property-fields" role="group" aria-label="基本情報をまとめて入力">'+fields+'</div></div>'+
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
    const ps=selectedProperties(),n=Math.ceil(state.criteria.length/rowsPerPage())+1;ui.comparePage=Math.min(ui.comparePage,n-1);const rank=ui.comparePage===n-1;
    return '<section class="screen"><div class="toolbar between"><div><span class="kicker">COMPARE</span><h2 class="section-title">'+(rank?'総合ランキング':'物件をくらべる')+'</h2></div><div class="row"><button class="btn compact" data-act="choose-properties">物件選択</button><button class="btn compact" data-act="criteria">項目</button></div></div><div class="segment"><button data-act="rater" data-value="husband" class="'+(ui.rater==='husband'?'active':'')+'">夫</button><button data-act="rater" data-value="wife" class="'+(ui.rater==='wife'?'active':'')+'">妻</button><button data-act="rater" data-value="both" class="'+(ui.rater==='both'?'active':'')+'">ふたり</button></div>'+(!ps.length?empty('◎','比較したい物件を選ぶ','最大3件まで横並びで採点できます。','choose-properties','物件を選ぶ'):rank?rankingScreen(ps):comparisonTable(ps))+'<div class="row between"><span class="meta">'+(rank?'合計点を表示':'○ 2点 / △ 1点 / × 0点')+'</span><span class="meta">'+(ui.comparePage+1)+' / '+n+'ページ</span></div>'+navPager(ui.comparePage,n,'compare-nav')+'</section>';
  }
  function comparisonTable(ps){
    const items=state.criteria.slice(ui.comparePage*rowsPerPage(),ui.comparePage*rowsPerPage()+rowsPerPage());
    const head='<div class="compare-row"><div class="compare-cell topic">比較項目</div>'+Array.from({length:3},(_,i)=>'<div class="compare-cell heading" '+(ps[i]?'title="'+esc(ps[i].name)+'"':'')+'>'+esc(truncate(ps[i]?.name||'未選択',5))+'</div>').join('')+'</div>';
    const rows=Array.from({length:rowsPerPage()},(_,i)=>{
      const c=items[i]; if(!c)return '<div class="compare-row"><div class="compare-cell placeholder"></div>'+Array.from({length:3},()=>'<div class="compare-cell placeholder"></div>').join('')+'</div>';
      return '<div class="compare-row"><div class="compare-cell topic" title="'+esc(c.name)+'">'+esc(c.name.split(/[（(]/)[0])+'<small>★'+c.weight+'</small></div>'+Array.from({length:3},(_,k)=>{
        let p=ps[k];if(!p)return '<div class="compare-cell placeholder">–</div>';
        if(ui.rater==='both'){
          const h=effective(p,c,'husband'),w=effective(p,c,'wife');
          return '<button class="compare-cell rating" data-act="rating" data-property="'+esc(p.id)+'" data-criterion="'+esc(c.id)+'"><div class="both-ratings">夫 '+mark(h.value)+'<br>妻 '+mark(w.value)+'</div></button>';
        }
        let sc=effective(p,c,ui.rater);
        return '<button class="compare-cell rating" data-act="rating" data-property="'+esc(p.id)+'" data-criterion="'+esc(c.id)+'"><span class="rating-face '+faceClass(sc.value)+'">'+mark(sc.value)+'</span><span class="rating-small">'+(sc.auto?'自動':'採点する')+'</span></button>';
      }).join('')+'</div>';
    }).join('');
    return '<div class="panel detail grow swipe-zone"><div class="compare-table">'+head+rows+'</div></div>';
  }
  function mark(n){return n===2?'○':n===1?'△':n===0?'×':'−';}
  function faceClass(n){return n===2?'yes':n===1?'mid':n===0?'no':'';}
  function effective(p,c,who){
    const manual=state.scores[p.id]?.[c.id]?.[who];
    if(manual===0 || manual===1 || manual===2)return {value:manual,auto:false};
    if(c.auto && ['price','age','area','station'].includes(c.auto.field)){
      let v=num(p[c.auto.field]);let good=num(c.auto.good),mid=num(c.auto.mid);
      if(v!==null && good!==null && mid!==null && good>=0 && mid>=0){
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
    const results=ps.map(p=>{
      const h=scoreSummary(p,'husband'),w=scoreSummary(p,'wife');
      let count=ui.rater==='both'?h.covered+w.covered:ui.rater==='husband'?h.covered:w.covered;
      let pts=ui.rater==='both'?h.sum+w.sum:ui.rater==='husband'?h.sum:w.sum;
      let max=ui.rater==='both'?h.total+w.total:h.total;
      return {p,pts,max,count,h,w};
    }).sort((a,b)=>(b.count>0?b.pts/b.max:-1)-(a.count>0?a.pts/a.max:-1));
    return '<div class="panel rank-panel swipe-zone">'+results.map((r,i)=>'<div class="rank-row '+(i===0&&r.count?'winner':'')+'"><div class="rank-num">'+(r.count>0?i+1:'–')+'</div><div><div class="rank-name">'+esc(r.p.name)+'</div><span class="meta">'+(ui.rater==='both'?'夫 '+r.h.sum+'点 / 妻 '+r.w.sum+'点':r.pts+' / '+r.max+'点 · '+r.count+'項目採点')+'</span></div><div class="rank-score">'+(r.count?r.pts+'点<small> / '+r.max+'点</small>':'未採点')+'</div></div>').join('')+'<p class="subtle">重要度で加重した得点率。未採点は0点扱いで、採点数も確認できます。</p></div>';
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
    const p=propById(ui.scoreProperty),c=state.criteria.find(x=>x.id===ui.scoreCriterion),who=ui.scoreRater;if(!p||!c)return '';
    const s=effective(p,c,who);
    return modalFrame('評価する','<div class="panel detail grow form-view"><div><span class="kicker">'+esc(c.name)+'</span><h2 class="section-title">'+esc(p.name)+'</h2></div><div class="segment"><button class="'+(who==='husband'?'active':'')+'" data-act="score-rater" data-value="husband">夫の採点</button><button class="'+(who==='wife'?'active':'')+'" data-act="score-rater" data-value="wife">妻の採点</button></div><p class="subtle">現在: '+mark(s.value)+(s.auto?'（自動判定）':'')+'。あてはまる評価を選んでください。</p><button class="btn wide gold" data-act="score-set" data-value="2">○　よい（2点）</button><button class="btn wide" data-act="score-set" data-value="1">△　ふつう（1点）</button><button class="btn wide" data-act="score-set" data-value="0">×　気になる（0点）</button><button class="btn wide" data-act="score-set" data-value="clear">採点を解除（自動判定に戻す）</button></div>');
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
  const nField=(label,key,unit,placeholder)=>'<label class="sim-field"><span>'+esc(label)+'</span><span class="sim-input-wrap"><input type="number" data-sim="'+key+'" value="'+esc(state.plan[key])+'" min="0" step="any" inputmode="decimal" placeholder="'+esc(placeholder||'')+'"><em>'+esc(unit)+'</em></span></label>';
  const sSelect=(label,key,opts)=>'<label class="sim-field"><span>'+esc(label)+'</span><select data-sim="'+key+'">'+opts.map(([value,title])=>'<option value="'+esc(value)+'" '+(String(state.plan[key])===String(value)?'selected':'')+'>'+esc(title)+'</option>').join('')+'</select></label>';
  const simQuestions=[
    ['ご家族のこれから','お子さまの予定と働き方を教えてください。'],
    ['世帯の手取り収入','月収と年間ボーナスを入力してください。'],
    ['貯金と暮らしの支出','住宅以外の生活費を目安で入力してください。'],
    ['購入したい住まい','物件を選ぶか、希望価格を入力してください。'],
    ['これからの大きな支出','結婚式や積立予定を入力してください。']
  ];
  function simulationScreen(){
    const i=ui.simStep;
    if(i>=5)return simulationResultsScreen();
    const p=state.plan;
    let body='';
    if(i===0)body='<div class="sim-grid">'+nField('夫の年齢','husbandAge','歳')+nField('妻の年齢','wifeAge','歳')+
      sSelect('子どもの人数','children',[[0,'予定なし'],[1,'1人'],[2,'2人'],[3,'3人']])+
      nField('第1子の予定年','firstChildYear','年')+nField('きょうだいの年齢差','birthInterval','年')+
      nField('妻の時短中の月収','wifeReduced','万円')+'</div>';
    if(i===1)body='<div class="sim-grid">'+nField('夫の手取り月収','husbandMonthly','万円')+nField('妻の手取り月収','wifeMonthly','万円')+
      nField('夫の年間賞与','husbandBonus','万円')+nField('妻の年間賞与','wifeBonus','万円')+'</div>';
    if(i===2)body='<div class="sim-grid">'+nField('今ある貯金','cashSavings','万円')+nField('今後受け取る援助','support','万円')+
      nField('生活費（家賃を除く）','livingMonthly','万円/月')+nField('現在の家賃','rentMonthly','万円/月')+
      nField('車ローン','carMonthly','万円/月')+'</div><p class="sim-hint">すでに貯金へ含めた親の援助は、二重計上しないよう「0」にしてください。</p>';
    if(i===3){
      const options=[['','価格を直接入力'],...state.properties.filter(x=>num(x.price)!==null).map(x=>[x.id,truncate(x.name,17)+' / '+fmt(x.price)])];
      body='<div class="sim-grid">'+sSelect('購入する物件','propertyId',options)+nField('購入価格','propertyPrice','万円')+
        nField('購入予定年','purchaseYear','年')+nField('頭金','downPayment','万円')+
        nField('金利（仮定）','interest','%')+nField('ローン返済期間','loanYears','年')+
        nField('税・修繕等','housingOngoing','万円/月')+'</div><p class="sim-hint">購入諸費用は物件価格の7％を仮定。金利は将来変わる可能性があります。</p>';
    }
    if(i===4)body='<div class="sim-grid">'+nField('結婚式の支払年','weddingYear','年')+nField('結婚式自己負担','weddingCost','万円')+
      nField('新婚旅行費','honeymoonCost','万円')+nField('NISA積立','nisaMonthly','万円/月')+
      sSelect('高校','highSchool',[['public','公立'],['private','私立']])+sSelect('大学','university',[['public','国公立'],['private','私立']])+'</div>';
    return '<section class="screen sim-screen"><div class="sim-intro"><span class="kicker">LIFE SIMULATOR</span><span class="sim-progress-text">'+(i+1)+' / 5</span></div>'+
      '<div class="sim-progress">'+Array.from({length:5},(_,n)=>'<span class="'+(n<=i?'filled':'')+'"></span>').join('')+'</div>'+
      '<div class="sim-question"><h2>'+simQuestions[i][0]+'</h2><p>'+simQuestions[i][1]+'</p></div>'+
      '<div class="panel sim-form grow">'+body+'</div>'+
      '<div class="sim-footer"><button class="btn" data-act="sim-back" '+(i===0?'disabled':'')+'>戻る</button><button class="btn primary" data-act="sim-next">'+(i===4?'自動シミュレート':'次の質問へ →')+'</button></div></section>';
  }
  function educationAnnual(age,p){
    if(age<0||age>22)return 0;
    if(age<3)return 45;
    if(age<6)return 28;
    if(age<12)return 34;
    if(age<15)return 55;
    if(age<18)return p.highSchool==='private'?135:60;
    if(age<22)return p.university==='private'?185:125;
    return 0;
  }
  function modelYears(price,buy){
    const p=state.plan,start=simNowYear(),end=Math.max(start+9,Math.min(start+30,safeNum(p.simulateUntil,start+19))),
      birthYear=safeNum(p.firstChildYear,2028),birthGap=Math.max(1,safeNum(p.birthInterval,3));
    const purchaseYear=safeNum(p.purchaseYear,start+2),weddingYear=safeNum(p.weddingYear,start+1);
    const monthly=mortgageMonthly(price,p.downPayment,p.interest,p.loanYears);
    let cash=safeNum(p.cashSavings)+safeNum(p.support),invested=0;
    const points=[],kids=Math.min(3,Math.round(safeNum(p.children)));
    for(let year=start;year<=end;year++){
      const mother=kids&&year>=birthYear?(year===birthYear?Math.min(safeNum(p.wifeMonthly),10):safeNum(p.wifeReduced)):safeNum(p.wifeMonthly);
      const wifeBonus=kids&&year>=birthYear?0:safeNum(p.wifeBonus);
      const incomes=12*(safeNum(p.husbandMonthly)+mother)+safeNum(p.husbandBonus)+wifeBonus;
      let out=12*(safeNum(p.livingMonthly)+safeNum(p.carMonthly));
      const isOwner=buy&&year>=purchaseYear;
      out+=12*(isOwner?(monthly+safeNum(p.housingOngoing)):safeNum(p.rentMonthly));
      if(buy&&year===purchaseYear)out+=safeNum(p.downPayment)+safeNum(price)*0.07;
      if(year===weddingYear)out+=safeNum(p.weddingCost)+safeNum(p.honeymoonCost);
      for(let child=0;child<kids;child++){
        let age=year-(birthYear+child*birthGap);
        if(age===0)out+=50;
        out+=educationAnnual(age,p);
      }
      const contribution=12*safeNum(p.nisaMonthly);
      cash+=incomes-out-contribution;
      invested+=contribution;
      points.push({year,cash,invested,total:cash+invested});
    }
    return {points,monthly,purchaseYear,ending:points.at(-1).cash,min:Math.min(...points.map(x=>x.cash))};
  }
  function simGraph(series){
    const all=series.flatMap(x=>x.data.points.map(p=>p.cash)),low=Math.min(0,...all),high=Math.max(100,...all);
    const graphWidth=316,left=8,right=324,top=20,bottom=176,diff=Math.max(1,high-low);
    const y=n=>top+(high-n)/diff*(bottom-top);
    const first=series[0].data.points[0].year,last=series[0].data.points.at(-1).year;
    const x=year=>left+(year-first)/Math.max(1,last-first)*graphWidth;
    const horizontal=[0,.25,.5,.75,1].map(f=>{const val=high-f*diff;return '<line x1="'+left+'" y1="'+(top+f*(bottom-top))+'" x2="'+right+'" y2="'+(top+f*(bottom-top))+'" stroke="#e3e6df" stroke-width="1"/><text x="8" y="'+(top+f*(bottom-top)-3)+'" font-size="8" fill="#86908a">'+yen(val)+'</text>';}).join('');
    const curves=series.map(item=>{
      const coords=item.data.points.map((p,i)=>(i?'L':'M')+x(p.year).toFixed(1)+','+y(p.cash).toFixed(1)).join(' ');
      return '<path d="'+coords+'" fill="none" stroke="'+item.color+'" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    }).join('');
    return '<svg class="sim-chart" viewBox="0 0 332 203" role="img" aria-label="年ごとの現金貯金推移をシナリオ別に表示">'+horizontal+
      '<line x1="'+left+'" y1="'+y(0)+'" x2="'+right+'" y2="'+y(0)+'" stroke="#bd7e76" stroke-dasharray="4 3" stroke-width="1.3"/>'+curves+
      '<text x="8" y="195" font-size="9" fill="#76837a">'+first+'</text><text x="145" y="195" font-size="9" fill="#76837a">'+Math.round((first+last)/2)+'</text><text x="300" y="195" font-size="9" fill="#76837a">'+last+'</text></svg>';
  }
  function simulationResultsScreen(){
    const p=state.plan,price=safeNum(p.propertyPrice), selected=propById(p.propertyId);
    const current=modelYears(price,true);
    const rent=modelYears(price,false);
    const second=selectedProperties().find(x=>x.id!==p.propertyId&&num(x.price)!==null);
    const alternate=second?modelYears(safeNum(second.price),true):null;
    const views=[{label:'購入する',color:'#315f76',data:current},{label:'購入しない',color:'#c09378',data:rent}];
    if(alternate)views.push({label:truncate(second.name,12),color:'#66927e',data:alternate});
    const page=ui.simResultPage;
    const monthlyIncome=safeNum(p.husbandMonthly)+((safeNum(p.children)>0)?safeNum(p.wifeReduced):safeNum(p.wifeMonthly));
    const monthlyHousing=current.monthly+safeNum(p.housingOngoing);
    const futureLimit=Math.max(0,monthlyIncome*.25-safeNum(p.housingOngoing));
    const months=Math.max(12,Math.round(safeNum(p.loanYears)*12)),r=safeNum(p.interest)/1200;
    const maxLoan=r===0?futureLimit*months:futureLimit*(1-Math.pow(1+r,-months))/r;
    const maxPrice=Math.max(0,Math.floor((maxLoan+safeNum(p.downPayment))/100)*100);
    const kids=Math.min(3,Math.round(safeNum(p.children)));
    let eduTotal=0;
    for(let k=0;k<kids;k++)for(let age=0;age<22;age++)eduTotal+=educationAnnual(age,p);
    let content='';
    if(page===0){
      const warnings=views.filter(x=>x.data.min<0);
      content='<div class="sim-result-card panel grow"><div class="sim-result-head"><div><span class="kicker">CASH FLOW</span><h3>将来の現金貯金</h3></div><strong>'+yen(current.ending)+'<small>万円</small></strong></div>'+
        simGraph(views)+'<div class="sim-legend">'+views.map(x=>'<span><i style="background:'+x.color+'"></i>'+esc(x.label)+'</span>').join('')+'</div>'+
        '<p class="sim-hint">'+(warnings.length?'注意：'+warnings.map(x=>esc(x.label)).join('・')+'で貯金がマイナスになる年があります。':'表示期間中、現金貯金のマイナスはありません。')+'</p></div>';
    }else if(page===1){
      content='<div class="sim-result-card panel grow"><span class="kicker">HOME BUDGET</span><h3>住宅購入の余裕度</h3><div class="sim-metric"><span>月々ローン返済</span><strong>'+yen(current.monthly,1)+' 万円</strong></div>'+
        '<div class="sim-metric"><span>税・修繕を含む住居費</span><strong>'+yen(monthlyHousing,1)+' 万円</strong></div>'+
        '<div class="sim-metric"><span>将来の月手取りに占める割合</span><strong>'+yen(monthlyIncome?monthlyHousing/monthlyIncome*100:0,1)+' %</strong></div>'+
        '<div class="sim-metric"><span>25％を目安とした購入価格</span><strong>'+yen(maxPrice)+' 万円</strong></div>'+
        '<div class="sim-metric"><span>月の自由費（積立後・概算）</span><strong>'+yen(monthlyIncome-safeNum(p.livingMonthly)-safeNum(p.carMonthly)-safeNum(p.nisaMonthly)-monthlyHousing,1)+' 万円</strong></div>'+
        '<p class="sim-hint">「購入価格の目安」は将来の手取り25％を住居費の上限とした簡易計算で、融資可能額を保証しません。</p></div>';
    }else{
      const annual=kids?eduTotal/Math.max(1,18+safeNum(p.birthInterval)*(kids-1)):0;
      content='<div class="sim-result-card panel grow"><span class="kicker">EDUCATION PLAN</span><h3>教育費の積立目標</h3><div class="sim-hero-number">'+yen(eduTotal)+'<small> 万円</small></div>'+
        '<p class="subtle">子ども'+kids+'人分の幼児期から大学卒業までの教育費モデル（生活費とは別）。</p>'+
        '<div class="sim-metric"><span>高校</span><strong>'+(p.highSchool==='private'?'私立':'公立')+'</strong></div>'+
        '<div class="sim-metric"><span>大学</span><strong>'+(p.university==='private'?'私立':'国公立')+'</strong></div>'+
        '<div class="sim-metric"><span>月々の平均積立目安</span><strong>'+yen(annual/12,1)+' 万円</strong></div>'+
        '<p class="sim-hint">教育費は概算額です。物価・受験費用・下宿・奨学金等は個別に調整が必要です。</p></div>';
    }
    return '<section class="screen sim-screen"><div class="sim-intro"><span class="kicker">YOUR FUTURE</span><button class="btn compact" data-act="sim-restart">質問から編集</button></div><h2 class="sim-result-title">'+['貯金推移','無理のない住まい','教育費の目標'][page]+'</h2>'+content+
      '<div class="sim-footer"><button class="btn" data-act="sim-result-page" data-value="-1" '+(page===0?'disabled':'')+'>戻る</button><span class="sim-progress-text">'+(page+1)+' / 3</span><button class="btn primary" data-act="sim-result-page" data-value="1" '+(page===2?'disabled':'')+'>次へ</button></div></section>';
  }
  const studyCategories=[
    ['費用・住宅ローン',/費用|万円|円|金利|ローン|予算|頭金|税|維持費|値引|価格|銀行|返済/],
    ['性能・構造',/耐震|断熱|気密|構造|基礎|鉄骨|木造|耐久|劣化|性能|窓|結露|省エネ/],
    ['土地・暮らし',/土地|立地|駅|通勤|学校|治安|公園|道路|日当たり|日照|災害|洪水|浸水/],
    ['契約・保証',/保証|契約|アフター|修繕|引渡|申込|キャンセル|点検|補償|担当|営業/],
    ['確認しておくこと',/確認|質問|聞く|不明|注意|気になる|疑問|比較|必要/]
  ];
  function studySummaryItems(){
    const result=[],seen=new Set();
    for(const note of state.studyNotes){
      const sentences=String(note.text||'').split(/[\n。！？!?]+/).map(x=>x.trim()).filter(Boolean);
      for(const sentence of sentences){
        if(seen.has(sentence))continue;seen.add(sentence);
        const cat=studyCategories.find(([name,re])=>re.test(sentence))?.[0]||'その他';
        result.push({category:cat,text:sentence.length>105?sentence.slice(0,104)+'…':sentence,source:note.title,id:note.id});
        if(result.length>=400)return result;
      }
    }
    const order=studyCategories.map(x=>x[0]).concat('その他');
    return result.sort((a,b)=>order.indexOf(a.category)-order.indexOf(b.category));
  }
  function studyScreen(){
    const summary=ui.studyMode==='summary';
    const items=summary?studySummaryItems():state.studyNotes;
    const pageSize=summary?4:3,total=Math.max(1,Math.ceil(items.length/pageSize));
    const key=summary?'studySummaryPage':'studyPage';
    ui[key]=Math.min(ui[key],total-1);
    const visible=items.slice(ui[key]*pageSize,(ui[key]+1)*pageSize);
    const cards=summary?visible.map(item=>'<div class="study-summary-item"><span class="study-category">'+esc(item.category)+'</span><p>'+esc(item.text)+'</p><small>出典：'+esc(item.source)+'</small></div>').join(''):
      visible.map(n=>'<div class="study-note-card"><div class="study-note-head"><strong>'+esc(n.title)+'</strong><button class="btn compact" data-act="study-edit" data-value="'+esc(n.id)+'">編集</button><button class="btn compact danger" data-act="study-delete" data-value="'+esc(n.id)+'">×</button></div><p>'+esc(truncate(n.text,110))+'</p></div>').join('');
    return modalFrame('家の学び','<div class="segment"><button data-act="study-toggle" data-value="notes" class="'+(!summary?'active':'')+'">学びメモ</button><button data-act="study-summarize" class="'+(summary?'active':'')+'">ワンタップ整理</button></div>'+
      '<div class="study-toolbar"><div><span class="kicker">HOME KNOWLEDGE</span><p class="subtle">'+(summary?'内容を分類・抜粋した要点です':'住宅会社で学んだことを残せます')+'</p></div><button class="btn primary" data-act="study-add">＋ 書く</button></div>'+
      '<div class="study-note-list grow">'+(cards||(summary?'<div class="empty grow"><p>まとめるメモがありません</p></div>':'<div class="empty grow"><p>学んだことをメモしましょう</p></div>'))+'</div>'+
      (total>1?navPager(ui[key],total,summary?'study-summary-page':'study-page'):'<span class="sim-progress-text study-counter">'+items.length+'件</span>')+
      (summary?'<p class="study-disclaimer">※ AIによる要約ではなく、端末内でキーワード分類した抜粋です。原文も確認してください。</p>':'<button class="btn soft wide" data-act="study-summarize">記録をワンタップでまとめる</button>'));
  }
  function studyForm(){
    const d=ui.studyDraft||{title:'',text:''};
    return modalFrame(ui.studyEditId?'学びメモを編集':'学びをメモ','<div class="study-edit-form grow"><label class="field"><span>タイトル</span><input data-study="title" maxlength="65" value="'+esc(d.title)+'" placeholder="例：断熱性の違い"></label><label class="field grow"><span>学んだこと</span><textarea data-study="text" maxlength="2500" placeholder="家づくりで聞いた話・疑問・気付きを自由に記録">'+esc(d.text)+'</textarea></label><span class="subtle">メモは端末に保存され、後から追記できます。</span></div><div class="sim-footer"><button class="btn" data-act="study-back">戻る</button><button class="btn primary" data-act="study-save">保存する</button></div>');
  }
  function pendingScreen(){const sim=ui.tab==='sim';return '<section class="screen">'+empty(sim?'∿':'▦',sim?'人生設計はフェーズ2':'スケジュールはフェーズ3',sim?'貯金推移・住宅ローン・教育費をステップ式で追加予定です。':'内見カレンダー・リマインド通知を追加予定です。')+'</section>';}
  function overlay(){return ui.overlay==='detail'?detailScreen():ui.overlay==='form'?propertyForm():ui.overlay==='list'?listScreen():ui.overlay==='search'?searchScreen():ui.overlay==='settings'?settingsScreen():ui.overlay==='choose'?choosePropertiesScreen():ui.overlay==='criteria'?criteriaScreen():ui.overlay==='criterion-form'?criterionForm():ui.overlay==='rating'?ratingScreen():ui.overlay==='question'?questionForm():ui.overlay==='meeting-form'?meetingForm():ui.overlay==='study'?studyScreen():ui.overlay==='study-form'?studyForm():'';}
  function moveProperty(d){let ps=visibleProperties(),i=ps.findIndex(p=>p.id===ui.propertyId);if(ps.length){ui.propertyId=ps[(i+d+ps.length)%ps.length].id;ui.photoIndex=0;ui.propertyPage=0;}}
  function moveDetail(d){ui.propertyPage=Math.max(0,Math.min(3,ui.propertyPage+d));}
  function changePage(key,total,d){ui[key]=Math.max(0,Math.min(Math.max(0,total-1),ui[key]+d));}
  function setScore(p,c,who,value){
    state.scores[p]??={};state.scores[p][c]??={};
    if(value===null)delete state.scores[p][c][who];else state.scores[p][c][who]=value;
    save();
  }
  function prepareForm(p){ui.draft=p?JSON.parse(JSON.stringify(p)):{...blankProperty(),_new:true};ui.formStep=0;ui.overlay='form';}
  function validateProperty(){
    const p=ui.draft;if(!p.name.trim())return '物件名を入力してください';
    if(p.url && !/^https?:\/\/\S+$/i.test(p.url))return 'URLはhttps://またはhttp://で入力してください';
    for(const k of ['price','age','area','station'])if(p[k]!=='' && (num(p[k])===null || Number(p[k])<0))return '数値項目には0以上の数字を入れてください';
    return '';
  }
  function handler(action,button){
    let v=button.dataset.value, p=curProp();
    if(action==='tab')return chooseTab(v);
    if(action==='study-open')return openOverlay('study',()=>{ui.studyMode='notes';ui.studyPage=0;ui.studySummaryPage=0;});
    if(action==='study-toggle')return step(()=>{ui.studyMode=v;ui.studyPage=0;ui.studySummaryPage=0;});
    if(action==='study-page')return step(()=>changePage('studyPage',Math.max(1,Math.ceil(state.studyNotes.length/3)),Number(v)));
    if(action==='study-summary-page')return step(()=>changePage('studySummaryPage',Math.max(1,Math.ceil(studySummaryItems().length/4)),Number(v)));
    if(action==='study-add')return openOverlay('study-form',()=>{ui.studyEditId=null;ui.studyDraft={title:'',text:''};});
    if(action==='study-edit')return openOverlay('study-form',()=>{const note=state.studyNotes.find(n=>n.id===v);if(!note)return;ui.studyEditId=v;ui.studyDraft={title:note.title,text:note.text};});
    if(action==='study-back')return step(()=>{ui.overlay='study';ui.studyDraft=null;ui.studyEditId=null;});
    if(action==='study-save'){
      const n=ui.studyDraft;if(!n?.text?.trim())return message('学んだ内容を書いてください');
      return step(()=>{const title=n.title.trim()||'家の学び';if(ui.studyEditId){
        const old=state.studyNotes.find(x=>x.id===ui.studyEditId);if(old){old.title=title;old.text=n.text.trim();}
      }else state.studyNotes.unshift({id:uid(),title,text:n.text.trim(),created:Date.now()});
      ui.studyPage=0;ui.studyDraft=null;ui.studyEditId=null;ui.overlay='study';save();message('学びメモを保存しました');});
    }
    if(action==='study-delete'){
      if(!confirm('この学びメモを削除しますか？'))return;
      return step(()=>{state.studyNotes=state.studyNotes.filter(n=>n.id!==v);ui.studyPage=0;save();});
    }
    if(action==='study-summarize')return step(()=>{if(!state.studyNotes.length)return message('先にメモを登録してください');ui.studyMode='summary';ui.studySummaryPage=0;});
    if(action==='sim-next')return step(()=>{ui.simStep=Math.min(5,ui.simStep+1);ui.simResultPage=0;save();});
    if(action==='sim-back')return step(()=>{ui.simStep=Math.max(0,ui.simStep-1);});
    if(action==='sim-restart')return step(()=>{ui.simStep=0;ui.simResultPage=0;});
    if(action==='sim-result-page')return step(()=>changePage('simResultPage',3,Number(v)));
    if(action==='sim-choice')return step(()=>{ui.simChoice=v;save();});

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
    if(action==='rater')return step(()=>{ui.rater=v;});
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
    if(action==='rating')return openOverlay('rating',()=>{ui.scoreProperty=button.dataset.property;ui.scoreCriterion=button.dataset.criterion;ui.scoreRater=ui.rater==='both'?'husband':ui.rater;});
    if(action==='score-rater')return step(()=>ui.scoreRater=v);
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
    if(el.dataset.study && ui.studyDraft){ui.studyDraft[el.dataset.study]=el.value;}
    if(el.dataset.sim){
      const k=el.dataset.sim; const val=el.value;
      state.plan[k]=['propertyId','highSchool','university'].includes(k)?val:(val!==''&&Number.isFinite(Number(val))?Number(val):0);
      save();
      if(k==='propertyId'){const p=propById(val);if(p&&Number.isFinite(Number(p.price)))state.plan.propertyPrice=Number(p.price);}
      const priceInput=app.querySelector('[data-sim="propertyPrice"]');
      if(k==='propertyId'&&priceInput)priceInput.value=state.plan.propertyPrice;
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
