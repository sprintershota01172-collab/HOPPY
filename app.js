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
  const dots = (index,count) => '<div class="dots" aria-label="' + (index+1) + ' / ' + count + 'ページ">' + Array.from({length:Math.min(count,6)},(_,i)=>'<span class="dot ' + (i===Math.round(index*(Math.min(count,6)-1)/Math.max(1,count-1))?'active':'') + '"></span>').join('') + '</div>';
  const initialCriteria = ['価格','耐久性（構造・耐震・築年数）','立地（駅距離・通勤）','広さ・間取り','日当たり','周辺環境（スーパー・病院）','子育て環境（学校・公園）','維持費（税・管理費等）','災害リスク','資産価値'].map((name,i)=>({id:'standard-'+i,name,weight:2,auto:null}));
  const blankProperty = () => ({id:uid(),name:'',url:'',address:'',price:'',kind:kinds[0],age:'',area:'',layout:'',station:'',status:statuses[0],tags:[],notes:{good:[''],bad:['']},questions:[],photos:[],created:Date.now()});
  const defaults = () => ({version:1,properties:[],criteria:initialCriteria,scores:{},selected:[],filter:{query:'',tag:'',sort:'new'},});
  let state;
  try { const raw = localStorage.getItem(STORE); state = raw ? normalize(JSON.parse(raw)) : defaults(); }
  catch (_) { state = defaults(); }
  let ui = {tab:'property',propertyId:null,propertyPage:0,photoIndex:0,noteKind:'good',noteIndex:0,questionPage:0,comparePage:0,rater:'husband',overlay:'',formStep:0,draft:null,listPage:0,criteriaPage:0,criterionId:null,scoreProperty:null,scoreCriterion:null,scoreRater:'husband',lock:0,toast:null};
  let photoUrl = null,photoToken = 0,toastTimer = null;
  function normalize(s) {
    if (!s || !Array.isArray(s.properties) || !Array.isArray(s.criteria)) throw Error('形式が違います');
    const out = defaults();
    out.properties = s.properties.filter(p=>p && typeof p.id==='string').map(p=>({...blankProperty(),...p,notes:{good:Array.isArray(p.notes?.good)?p.notes.good:[''],bad:Array.isArray(p.notes?.bad)?p.notes.bad:['']},questions:Array.isArray(p.questions)?p.questions:[],photos:Array.isArray(p.photos)?p.photos:[],tags:Array.isArray(p.tags)?p.tags:[]}));
    out.criteria = s.criteria.filter(c=>c && typeof c.id==='string' && typeof c.name==='string').map(c=>({...c,weight:Math.min(3,Math.max(1,Number(c.weight)||1))}));
    out.scores = s.scores && typeof s.scores==='object' ? s.scores : {};
    out.selected = Array.isArray(s.selected)?s.selected.filter(id=>out.properties.some(p=>p.id===id)).slice(0,3):[];
    out.filter = {...out.filter,...s.filter};
    return out;
  }
  function save() { try {localStorage.setItem(STORE,JSON.stringify(state));} catch (_) {message('保存容量に達しました。バックアップを作成してください。');} }
  function message(text) {ui.toast=text;renderToast();clearTimeout(toastTimer);toastTimer=setTimeout(()=>{ui.toast=null;renderToast();},2700);}
  function renderToast(){let old=app.querySelector('.toast');if(old)old.remove();if(ui.toast)app.insertAdjacentHTML('beforeend','<div class="toast" role="status">'+esc(ui.toast)+'</div>');}
  const propById = id => state.properties.find(p=>p.id===id);
  const curProp = () => propById(ui.propertyId) || visibleProperties()[0] || null;
  function visibleProperties(){
    let ps=state.properties.filter(p=>(p.name+' '+p.address+' '+p.tags.join(' ')).toLowerCase().includes((state.filter.query||'').toLowerCase()) && (!state.filter.tag || p.tags.includes(state.filter.tag)));
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
  function toolbar(title,sub){return '<header class="top"><div class="brand"><span class="eyebrow">OUR HOME JOURNAL</span><h1>'+esc(title)+'</h1></div><div class="header-actions"><button class="iconbtn" data-act="search" aria-label="検索・並び替え">⌕</button><button class="iconbtn" data-act="settings" aria-label="バックアップ・設定">⋯</button></div></header>';}
  function render(){
    if(!app)return;
    const titles={property:'ほっぴーくん',compare:'くらべる',sim:'未来を描く',schedule:'これからの予定'};
    const nav=[['property','⌂','物件'],['compare','◎','比較'],['sim','∿','シミュレーション'],['schedule','▦','スケジュール']];
    let body=ui.tab==='property'?propertyScreen():ui.tab==='compare'?compareScreen():pendingScreen();
    app.innerHTML=toolbar(titles[ui.tab])+'<main class="main">'+body+'</main><nav class="bottom" aria-label="メインメニュー">'+nav.map(([key,sym,name])=>'<button class="tab '+(ui.tab===key?'active':'')+'" data-act="tab" data-value="'+key+'" aria-current="'+(ui.tab===key?'page':'false')+'"><span class="sym">'+sym+'</span>'+name+'</button>').join('')+'</nav>'+(ui.overlay?overlay(): '');
    renderToast();hydratePhotos();
  }
  function empty(icon,title,desc,action,label){return '<section class="panel grow empty"><div class="big">'+icon+'</div><h2 class="section-title">'+esc(title)+'</h2><p>'+esc(desc)+'</p>'+ (action?'<button class="btn primary" data-act="'+action+'">'+esc(label)+'</button>':'')+'</section>';}
  function navPager(index,total,act){return '<div class="pager"><button class="page-arrow" data-act="'+act+'" data-value="-1" '+(total<2?'disabled':'')+' aria-label="前へ">‹</button><div class="counter">'+(total?index+1:0)+' / '+total+'</div>'+dots(index,Math.max(total,1))+'<button class="page-arrow" data-act="'+act+'" data-value="1" '+(total<2?'disabled':'')+' aria-label="次へ">›</button></div>';}
  function propertyScreen(){
    let ps=visibleProperties(),p=curProp();if(p)ui.propertyId=p.id;
    if(!p)return '<section class="screen">'+empty('⌂','家探しを、ここから。','物件を登録するとメモや比較を始められます。','add-property','最初の物件を登録')+'<button class="btn soft wide" data-act="seed">サンプル3件で試す</button></section>';
    let pos=ps.findIndex(x=>x.id===p.id);if(pos<0){p=ps[0];ui.propertyId=p.id;pos=0;}
    let image=p.photos.length?'<img data-photo="'+esc(p.photos[0])+'" alt="物件の写真">':'<span class="house-illustration" aria-hidden="true">⌂</span>';
    return '<section class="screen"><div class="toolbar between"><div class="row"><span class="kicker">PROPERTY NOTE</span><span class="pill">'+ps.length+' 件</span></div><div class="row"><button class="btn compact" data-act="property-list">一覧</button><button class="btn primary compact" data-act="add-property">＋ 追加</button></div></div>'+
      '<div class="panel estate grow swipe-zone"><div class="estate-top"><span class="pill status">'+esc(p.status)+'</span><span class="meta">'+(p.demo?'サンプル物件':'物件メモ')+'</span></div><h2 class="estate-name">'+esc(p.name||'名称未設定')+'</h2><div class="estate-hero">'+image+'<div class="hero-label">'+esc(p.kind)+'</div></div><div class="row between"><span class="money">'+(num(p.price)!==null?digits.format(p.price)+'<small> 万円</small>':'価格未登録')+'</span><span class="meta">'+esc(truncate(p.layout||p.area+'㎡',14))+'</span></div><div class="estate-summary"><div class="mini"><span class="meta">住所</span><strong>'+esc(p.address||'未登録')+'</strong></div><div class="mini"><span class="meta">タグ</span><strong>'+esc(p.tags.join('・')||'未登録')+'</strong></div></div><div class="toolbar"><button class="btn primary flex1" data-act="property-detail">詳細・メモを見る</button><button class="btn flex1" data-act="edit-property">編集する</button></div></div>'+navPager(pos,ps.length,'property-nav')+'</section>';
  }
  function detailScreen(){
    let p=curProp();if(!p)return '';
    const heads=['基本情報','メモ','写真'];
    let content='';
    if(ui.propertyPage===0){
      const items=[['住所',p.address],['価格',fmt(p.price)],['種別',p.kind],['築年数',p.age===''?'未登録':p.age+'年'],['面積',p.area===''?'未登録':p.area+'㎡'],['間取り',p.layout],['駅徒歩',p.station===''?'未登録':p.station+'分'],['状態',p.status]];
      content='<div class="panel detail grow swipe-zone"><div class="info-grid grow">'+items.map(([a,b])=>'<div class="info-box"><span>'+a+'</span><strong>'+esc(b||'未登録')+'</strong></div>').join('')+'</div><div class="toolbar"><button class="btn flex1" data-act="edit-property">情報を編集</button>'+(p.url?'<button class="btn flex1" data-act="external" data-value="'+esc(p.url)+'">物件サイトを見る</button>':'')+'</div></div>';
    }else if(ui.propertyPage===1){
      let notes=p.notes[ui.noteKind]||[''];ui.noteIndex=Math.min(ui.noteIndex,Math.max(0,notes.length-1));
      if(ui.noteKind==='questions'){
        const start=ui.questionPage*4;const subset=p.questions.slice(start,start+4);
        content='<div class="panel detail grow swipe-zone"><div class="notes-title"><span class="kicker">営業担当に聞くこと</span><span class="meta">'+p.questions.length+' 件</span></div><div class="question-list">'+(subset.length?subset.map(q=>'<div class="question-row '+(q.done?'done':'')+'"><button class="checkbtn" data-act="question-toggle" data-value="'+esc(q.id)+'" aria-label="確認済みを切替">'+(q.done?'✓':'○')+'</button><span>'+esc(q.text)+'</span><button class="ellipsis" data-act="question-delete" data-value="'+esc(q.id)+'" aria-label="質問を削除">×</button></div>').join(''):'<div class="empty grow"><p>聞きたいことを登録しましょう。</p></div>')+'</div>'+navPager(Math.min(ui.questionPage,Math.max(0,Math.ceil(p.questions.length/4)-1)),Math.max(1,Math.ceil(p.questions.length/4)),'question-nav')+'<button class="btn primary wide" data-act="add-question">＋ 質問を追加</button></div>';
      } else {
        const note=notes[ui.noteIndex]||'';
        content='<div class="panel detail grow swipe-zone"><div class="notes-title"><span class="kicker">'+(ui.noteKind==='good'?'よかった点':'気になる点')+'</span><span class="meta">'+note.length+' / 220文字</span></div><textarea class="note-text" data-note="'+ui.noteKind+'" maxlength="220" placeholder="ここにメモを書きます。1ページ220文字まで。">'+esc(note)+'</textarea><div class="note-actions"><button class="btn compact" data-act="note-delete" '+(notes.length<2?'disabled':'')+'>削除</button>'+'<button class="btn compact" data-act="note-nav" data-value="-1" '+(ui.noteIndex===0?'disabled':'')+'>‹</button><span class="meta">'+(ui.noteIndex+1)+' / '+notes.length+'</span><button class="btn compact" data-act="note-nav" data-value="1" '+(ui.noteIndex===notes.length-1?'disabled':'')+'>›</button><button class="btn compact primary" data-act="note-add">＋</button></div></div>';
      }
    }else{
      let n=p.photos.length;ui.photoIndex=Math.min(ui.photoIndex,Math.max(0,n-1));
      content='<div class="panel detail grow swipe-zone"><div class="photo-frame">'+(n?'<img data-photo="'+esc(p.photos[ui.photoIndex])+'" alt="物件写真 '+(ui.photoIndex+1)+'">':'<div class="photo-empty">▧<p>写真はまだありません</p><p>複数枚を端末に保存できます</p></div>')+'</div>'+navPager(ui.photoIndex,n,'photo-nav')+'<div class="toolbar"><label class="btn primary flex1" for="photo-upload">＋ 写真を追加</label><input id="photo-upload" class="sr-only" type="file" accept="image/*" multiple>'+(n?'<button class="btn danger" data-act="photo-delete">写真を削除</button>':'')+'</div></div>';
    }
    return '<div class="full"><header class="full-header"><button class="btn compact" data-act="detail-close">‹ 戻る</button><strong>'+esc(p.name)+'</strong><button class="btn compact" data-act="edit-property">編集</button></header><div class="full-body screen"><div class="segment">'+heads.map((x,i)=>'<button data-act="detail-page" data-value="'+i+'" class="'+(i===ui.propertyPage?'active':'')+'">'+x+'</button>').join('')+'</div>'+(ui.propertyPage===1?'<div class="segment"><button class="'+(ui.noteKind==='good'?'active':'')+'" data-act="note-kind" data-value="good">よかった</button><button class="'+(ui.noteKind==='bad'?'active':'')+'" data-act="note-kind" data-value="bad">気になる</button><button class="'+(ui.noteKind==='questions'?'active':'')+'" data-act="note-kind" data-value="questions">質問</button></div>':'')+content+'</div></div>';
  }
  function propertyForm(){
    const p=ui.draft;const stepN=ui.formStep;
    const field=(label,key,type,extra)=>'<div class="field"><label for="form-'+key+'">'+label+'</label><input id="form-'+key+'" data-model="'+key+'" type="'+(type||'text')+'" value="'+esc(p[key]??'')+'" '+(extra||'')+'></div>';
    const select=(label,key,opts)=>'<div class="field"><label for="form-'+key+'">'+label+'</label><select id="form-'+key+'" data-model="'+key+'">'+opts.map(x=>'<option '+(p[key]===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></div>';
    let fields='';
    if(stepN===0)fields=field('物件名 *','name','text','maxlength="70" required placeholder="例: ○○の家"')+field('掲載URL','url','url','placeholder="https://..."')+field('住所','address','text','maxlength="120"');
    if(stepN===1)fields=field('物件価格（万円）','price','number','min="0" step="1" inputmode="numeric"')+select('種別','kind',kinds)+field('築年数（年）','age','number','min="0" step="1" inputmode="numeric"');
    if(stepN===2)fields=field('広さ（㎡）','area','number','min="0" step="0.1" inputmode="decimal"')+field('間取り','layout','text','placeholder="例: 3LDK" maxlength="50"')+field('最寄駅まで徒歩（分）','station','number','min="0" step="1" inputmode="numeric"');
    if(stepN===3)fields=select('検討ステータス','status',statuses)+'<div class="field"><label for="form-tags">タグ（カンマ区切り）</label><input id="form-tags" data-model="tags" value="'+esc(p.tags.join(', '))+'" placeholder="例: 駅近, 南向き" maxlength="160"></div>';
    return modalFrame((p._new?'物件を追加':'物件を編集'),'<div class="panel detail grow form-view"><span class="kicker">STEP '+(stepN+1)+' / 4</span>'+fields+'</div><div class="form-foot"><button class="btn flex1" data-act="form-back">'+(stepN?'戻る':'キャンセル')+'</button><button class="btn primary flex1" data-act="form-next">'+(stepN===3?'保存する':'次へ')+'</button></div><p class="step-label">入力内容は端末内に保存されます</p>'+(stepN===3&&!p._new?'<button class="btn danger wide" data-act="property-delete">この物件を削除する</button>':''));
  }
  function modalFrame(title,content){return '<div class="full"><header class="full-header"><button class="btn compact" data-act="overlay-close">×</button><strong>'+esc(title)+'</strong><span style="width:44px"></span></header><section class="full-body">'+content+'</section></div>';}
  function listScreen(){
    let ps=visibleProperties(),n=Math.max(1,Math.ceil(ps.length/4));ui.listPage=Math.min(ui.listPage,n-1);
    let cells=ps.slice(ui.listPage*4,ui.listPage*4+4);
    return modalFrame('物件一覧','<div class="row between"><span class="subtle">'+ps.length+'件の物件</span><button class="btn compact" data-act="search">⌕ 絞り込み</button></div>'+(cells.length?'<div class="grid4">'+cells.map(p=>'<button class="grid-tile" data-act="list-pick" data-value="'+esc(p.id)+'"><span class="pill status">'+esc(p.status)+'</span><strong>'+esc(p.name)+'</strong><span>'+esc(truncate(p.address,20))+'</span><strong>'+esc(fmt(p.price))+'</strong></button>').join('')+'</div>':empty('⌕','該当する物件がありません','条件を変えて検索してください。'))+navPager(ui.listPage,n,'list-nav')+'<button class="btn primary wide" data-act="add-property">＋ 物件を登録</button>');
  }
  function searchScreen(){
    const allTags=[...new Set(state.properties.flatMap(p=>p.tags))].sort();
    const f=state.filter;
    return modalFrame('検索と並び替え','<div class="panel detail grow"><div class="field"><label>キーワード</label><input data-filter="query" value="'+esc(f.query||'')+'" placeholder="名前・住所・タグで検索"></div><div class="field"><label>タグ</label><select data-filter="tag"><option value="">すべて</option>'+allTags.map(tag=>'<option value="'+esc(tag)+'" '+(f.tag===tag?'selected':'')+'>'+esc(tag)+'</option>').join('')+'</select></div><div class="field"><label>並び順</label><select data-filter="sort"><option value="new" '+(f.sort==='new'?'selected':'')+'>新しい順</option><option value="price" '+(f.sort==='price'?'selected':'')+'>価格の低い順</option><option value="name" '+(f.sort==='name'?'selected':'')+'>物件名順</option></select></div></div><div class="form-foot"><button class="btn flex1" data-act="filter-clear">解除</button><button class="btn primary flex1" data-act="filter-apply">この条件で表示</button></div>');
  }
  function settingsScreen(){
    return modalFrame('バックアップ・設定','<div class="panel detail grow"><div><span class="kicker">DATA</span><h2 class="section-title">大切な記録を守る</h2><p class="subtle">データはこの端末のブラウザに保存されます。端末変更・ブラウザのデータ消去に備えてバックアップしてください。</p></div><button class="btn primary wide" data-act="export">JSONをエクスポート（写真を含む）</button><label class="btn wide" for="json-import">JSONをインポート（現在のデータを置換）</label><input id="json-import" class="sr-only" type="file" accept="application/json,.json"><div class="info-box"><span>保存方式</span><strong>物件・採点: localStorage</strong><strong>写真: IndexedDB</strong></div><p class="subtle">現段階は端末ごとの個別保存です。夫婦共同編集・自動同期・通知は後続フェーズで対応します。</p></div>');
  }
  function compareScreen(){
    const ps=selectedProperties(),n=Math.ceil(state.criteria.length/5)+1;ui.comparePage=Math.min(ui.comparePage,n-1);const rank=ui.comparePage===n-1;
    return '<section class="screen"><div class="toolbar between"><div><span class="kicker">COMPARE</span><h2 class="section-title">'+(rank?'総合ランキング':'物件をくらべる')+'</h2></div><div class="row"><button class="btn compact" data-act="choose-properties">物件選択</button><button class="btn compact" data-act="criteria">項目</button></div></div><div class="segment"><button data-act="rater" data-value="husband" class="'+(ui.rater==='husband'?'active':'')+'">夫</button><button data-act="rater" data-value="wife" class="'+(ui.rater==='wife'?'active':'')+'">妻</button><button data-act="rater" data-value="both" class="'+(ui.rater==='both'?'active':'')+'">ふたり</button></div>'+(!ps.length?empty('◎','比較したい物件を選ぶ','最大3件まで横並びで採点できます。','choose-properties','物件を選ぶ'):rank?rankingScreen(ps):comparisonTable(ps))+'<div class="row between"><span class="meta">'+(rank?'合計点を表示':'○ 2点 / △ 1点 / × 0点')+'</span><span class="meta">'+(ui.comparePage+1)+' / '+n+'ページ</span></div>'+navPager(ui.comparePage,n,'compare-nav')+'</section>';
  }
  function comparisonTable(ps){
    const items=state.criteria.slice(ui.comparePage*5,ui.comparePage*5+5);
    const head='<div class="compare-row"><div class="compare-cell topic">比較項目</div>'+Array.from({length:3},(_,i)=>'<div class="compare-cell heading">'+esc(truncate(ps[i]?.name||'未選択',9))+'</div>').join('')+'</div>';
    const rows=Array.from({length:5},(_,i)=>{
      const c=items[i]; if(!c)return '<div class="compare-row"><div class="compare-cell placeholder"></div>'+Array.from({length:3},()=>'<div class="compare-cell placeholder"></div>').join('')+'</div>';
      return '<div class="compare-row"><div class="compare-cell topic">'+esc(c.name)+'<small>★'+c.weight+'</small></div>'+Array.from({length:3},(_,k)=>{
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
    return '<div class="panel rank-panel swipe-zone">'+results.map((r,i)=>'<div class="rank-row"><div class="rank-num">'+(r.count>0?i+1:'–')+'</div><div><div class="rank-name">'+esc(r.p.name)+'</div><span class="meta">'+(ui.rater==='both'?'夫 '+r.h.sum+'点 / 妻 '+r.w.sum+'点':r.count+' / '+state.criteria.length+'項目 採点')+'</span></div><div class="rank-score">'+(r.count?Math.round(r.pts/r.max*100)+'%':'未採点')+'</div></div>').join('')+'<p class="subtle">重要度で加重した得点率。未採点は0点扱いで、採点数も確認できます。</p></div>';
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
  function pendingScreen(){const sim=ui.tab==='sim';return '<section class="screen">'+empty(sim?'∿':'▦',sim?'人生設計はフェーズ2':'スケジュールはフェーズ3',sim?'貯金推移・住宅ローン・教育費をステップ式で追加予定です。':'内見カレンダー・リマインド通知を追加予定です。')+'</section>';}
  function overlay(){return ui.overlay==='detail'?detailScreen():ui.overlay==='form'?propertyForm():ui.overlay==='list'?listScreen():ui.overlay==='search'?searchScreen():ui.overlay==='settings'?settingsScreen():ui.overlay==='choose'?choosePropertiesScreen():ui.overlay==='criteria'?criteriaScreen():ui.overlay==='criterion-form'?criterionForm():ui.overlay==='rating'?ratingScreen():ui.overlay==='question'?questionForm():'';}
  function moveProperty(d){let ps=visibleProperties(),i=ps.findIndex(p=>p.id===ui.propertyId);if(ps.length){ui.propertyId=ps[(i+d+ps.length)%ps.length].id;ui.photoIndex=0;ui.propertyPage=0;}}
  function moveDetail(d){ui.propertyPage=Math.max(0,Math.min(2,ui.propertyPage+d));}
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
    if(action==='search')return openOverlay('search');
    if(action==='settings')return openOverlay('settings');
    if(action==='overlay-close')return closeOverlay();
    if(action==='add-property')return openOverlay('form',()=>prepareForm(null));
    if(action==='edit-property')return openOverlay('form',()=>prepareForm(p));
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
    if(action==='form-back')return step(()=>{if(ui.formStep)ui.formStep--;else {ui.overlay='';ui.draft=null;}});
    if(action==='form-next'){
      if(ui.formStep<3){if(ui.formStep===0&&!ui.draft.name.trim())return message('物件名を入力してください');return step(()=>ui.formStep++);}
      let error=validateProperty();if(error)return message(error);
      return step(()=>{
        const target={...ui.draft};delete target._new;const old=propById(target.id);
        if(old)Object.assign(old,target);else state.properties.unshift(target);
        ui.propertyId=target.id;ui.overlay='';ui.tab='property';ui.draft=null;state.filter={query:'',tag:'',sort:'new'};save();message('物件を保存しました');
      });
    }
    if(action==='property-delete'){if(!confirm('この物件と関連する写真・採点を削除しますか？'))return;return step(()=>{const id=ui.draft.id;const previous=propById(id);if(previous)previous.photos.forEach(removePhoto);state.properties=state.properties.filter(x=>x.id!==id);state.selected=state.selected.filter(x=>x!==id);delete state.scores[id];ui.propertyId=null;ui.overlay='';ui.draft=null;save();message('物件を削除しました');});}
    if(action==='filter-apply')return step(()=>{ui.overlay='';ui.propertyId=null;ui.listPage=0;save();});
    if(action==='filter-clear')return step(()=>{state.filter={query:'',tag:'',sort:'new'};ui.overlay='';ui.propertyId=null;save();});
    if(action==='seed'){if(!confirm('操作を試すための架空の物件を3件追加しますか？'))return;return step(()=>{
      [['サンプルA・駅近の家',3800,'新築戸建',8],['サンプルB・ゆったりの家',4200,'中古戸建',18],['サンプルC・街なかの住まい',4600,'新築マンション',5]].forEach(([name,price,kind,station])=>{let x=blankProperty();Object.assign(x,{name,price,kind,station,area:98,layout:'3LDK',status:statuses[0],demo:true});state.properties.push(x);});
      state.selected=state.properties.slice(-3).map(x=>x.id);ui.propertyId=state.selected[0];save();
    });}
    if(action==='choose-properties')return openOverlay('choose',()=>ui.listPage=0);
    if(action==='select-property')return step(()=>{if(state.selected.includes(v))state.selected=state.selected.filter(x=>x!==v);else if(state.selected.length<3)state.selected.push(v);else return message('比較できる物件は最大3件です');save();});
    if(action==='compare-nav')return step(()=>changePage('comparePage',Math.ceil(state.criteria.length/5)+1,Number(v)));
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
  app.addEventListener('click',e=>{let b=e.target.closest('[data-act]');if(!b || !app.contains(b))return;e.preventDefault();handler(b.dataset.act,b);});
  app.addEventListener('input',e=>{
    let el=e.target,p=curProp();
    if(el.dataset.model && ui.draft){
      let k=el.dataset.model;ui.draft[k]=k==='tags'?el.value.split(/[,、]/).map(s=>s.trim()).filter(Boolean):el.value;
    }
    if(el.dataset.filter){state.filter[el.dataset.filter]=el.value;}
    if(el.dataset.criterionModel && ui.draft){let k=el.dataset.criterionModel;ui.draft[k]=k==='weight'?Number(el.value):el.value;}
    if(el.dataset.auto && ui.draft){ui.draft.auto ||= {field:'',dir:'low',good:'',mid:''};ui.draft.auto[el.dataset.auto]=el.value;}
    if(el.dataset.note && p){
      const type=el.dataset.note;
      if(el.scrollHeight>el.clientHeight+2 && el.value.length>1){
        const caret=el.selectionStart||el.value.length;
        const split=Math.max(1,Math.min(el.value.length-1,caret-1));
        const carry=el.value.slice(split);
        p.notes[type][ui.noteIndex]=el.value.slice(0,split);
        const next=ui.noteIndex+1;
        if(!p.notes[type][next])p.notes[type].splice(next,0,'');
        p.notes[type][next]=(carry+p.notes[type][next]).slice(0,220);
        ui.noteIndex=next;save();render();
        const upcoming=app.querySelector('[data-note]');if(upcoming){upcoming.focus();upcoming.setSelectionRange(carry.length,carry.length);}return;
      }
      p.notes[type][ui.noteIndex]=el.value;let span=app.querySelector('.notes-title .meta');if(span)span.textContent=el.value.length+' / 220文字';save();
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
  let touch=null;
  app.addEventListener('touchstart',e=>{const zone=e.target.closest('.swipe-zone');if(!zone||e.target.closest('input,textarea,select,button,label')){touch=null;return;}touch={x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY};},{passive:true});
  app.addEventListener('touchend',e=>{
    if(!touch)return;let dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;touch=null;
    if(Math.abs(dx)<55||Math.abs(dy)>Math.abs(dx)*.7)return;
    const d=dx<0?1:-1;
    if(ui.overlay==='detail'){
      const p=curProp();if(ui.propertyPage===2&&p.photos.length>1)return step(()=>changePage('photoIndex',p.photos.length,d));
      return step(()=>moveDetail(d));
    }
    if(ui.overlay)return;
    if(ui.tab==='property')step(()=>moveProperty(d));
    if(ui.tab==='compare')step(()=>changePage('comparePage',Math.ceil(state.criteria.length/5)+1,d));
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
      await photoJob('clear');
      for(const [id,data] of Object.entries(json.photos))if(typeof data==='string'&&data.startsWith('data:image/'))await storePhoto({id,data});
      state=next;ui.overlay='';ui.propertyId=null;ui.tab='property';save();render();message('インポートが完了しました');
    }catch(_){message('バックアップを読み込めませんでした');}
  }
  save();render();
  if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
