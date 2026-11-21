(() => {
  'use strict';
  // 地価調べ君：愛知県全域＋多治見周辺の地価ランキング・相場シミュレーター・メーカー図鑑・土地ガイド
  const BUILD = 'r103';
  try { localStorage.setItem('hoppy-last-build', BUILD); } catch (_) {}
  const STORE = 'chika-shirabe-v1';
  // r76以前（家探しノート時代）の保存データ。地価の設定だけ引き継ぎ、元データは消さずに残す。
  const LEGACY_STORE = 'hoppy-phase1-v1';
  const digits = new Intl.NumberFormat('ja-JP');
  const app = document.getElementById('app');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = v => v === '' || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null;
  const dots = (index,count) => '<div class="dots" aria-label="' + (index+1) + ' / ' + count + 'ページ">' + Array.from({length:Math.min(count,5)},(_,i)=>'<span class="dot ' + (i===Math.round(index*(Math.min(count,5)-1)/Math.max(1,count-1))?'active':'') + '"></span>').join('') + '</div>';
  function message(text) {ui.toast=text;renderToast();clearTimeout(toastTimer);toastTimer=setTimeout(()=>{ui.toast=null;renderToast();},2700);}
  function renderToast(){let old=app.querySelector('.toast');if(old)old.remove();if(ui.toast)app.insertAdjacentHTML('beforeend','<div class="toast" role="status">'+esc(ui.toast)+'</div>');}
  function closeOverlay(){step(()=>{ui.overlay='';ui.draft=null;});}
  function openOverlay(kind, setup){step(()=>{ui.overlay=kind;if(setup)setup();});}
  const remoteRelease={latest:null,notice:''};
  function renderReleaseBanner(){
    const existing=app.querySelector('.hoppo-version-banner');
    if(existing)existing.remove();
    if(!remoteRelease.notice)return;
    app.insertAdjacentHTML('beforeend',
      '<div class="hoppo-version-banner" role="status"><span>'+esc(remoteRelease.notice)+'</span>'+
      '<button type="button" data-act="hoppo-hard-refresh">更新する ↗</button>'+
      '<button type="button" data-act="hoppo-update-dismiss" aria-label="閉じる">×</button></div>');
  }
  async function verifyPublishedRelease(){
    if(typeof fetch!=='function')return;
    try{
      const url='./release.json?check='+Date.now();
      const response=await fetch(url,{cache:'no-store'});
      if(!response.ok)return;
      const published=await response.json();
      if(!/^r[0-9]+$/.test(String(published.version||'')))return;
      const loaded=Number(BUILD.slice(1)),live=Number(published.version.slice(1));
      remoteRelease.latest=published.version;
      if(live>loaded){
        remoteRelease.notice='新しい版 '+published.version+' を公開中';
        renderReleaseBanner();
      }
    }catch(_){/* Offline is supported. Keep the existing app available. */}
  }
  function empty(icon,title,desc,action,label){return '<section class="panel grow empty"><div class="big">'+icon+'</div><h2 class="section-title">'+esc(title)+'</h2><p>'+esc(desc)+'</p>'+ (action?'<button class="btn primary" data-act="'+action+'">'+esc(label)+'</button>':'')+'</section>';}
  function navPager(index,total,act){return '<div class="pager"><button class="page-arrow" data-act="'+act+'" data-value="-1" '+(total<2?'disabled':'')+' aria-label="前へ">‹</button><div class="counter">'+(total?index+1:0)+' / '+total+'</div>'+dots(index,Math.max(total,1))+'<button class="page-arrow" data-act="'+act+'" data-value="1" '+(total<2?'disabled':'')+' aria-label="次へ">›</button></div>';}
  function modalFrame(title,content){return '<div class="full"><header class="full-header"><button class="btn compact" data-act="overlay-close">×</button><strong>'+esc(title)+'</strong><span style="width:44px"></span></header><section class="full-body swipe-zone">'+content+'</section></div>';}
  function mark(n){return n===2?'○':n===1?'△':n===0?'×':'−';}
  function faceClass(n){return n===2?'yes':n===1?'mid':n===0?'no':'';}
  function changePage(key,total,d){ui[key]=Math.max(0,Math.min(Math.max(0,total-1),ui[key]+d));}

  function normalize(s){return {version:1,land:landNormalize(s&&s.land)};}
  // 保存データの読み込みは、すべての定義が終わったあと（起動の直前）に行う。
  // ※以前はここで読み込んでいたため、後ろで定義する定数が未定義のままエラーになり、毎回データが初期化されていた（r99まで）。
  let state=null;
  const BACKUP_STORE=STORE+'-backup';
  function loadState(){
    let raw=null;
    try{raw=localStorage.getItem(STORE);}catch(_){}
    try{
      if(raw){state=normalize(JSON.parse(raw));try{localStorage.setItem(BACKUP_STORE,raw);}catch(_){}}
      else{const legacy=localStorage.getItem(LEGACY_STORE);state=normalize(legacy?JSON.parse(legacy):{});}
    }catch(_){
      // 読めなかったデータは消さずに退避しておく
      try{if(raw)localStorage.setItem(STORE+'-broken-'+Date.now(),raw);}catch(__){}
      state=normalize({});
    }
  }
  let ui={tab:'land',overlay:'',lock:0,toast:null,lpPage:0,lpCity:null,lpMakerPage:0,lpGuidePage:0,lpMaker:null,lpCommutePage:0,lpAreaPage:0,lpAreaUse:'res',lpAreaOrder:'desc',lpTown:null,lpWorkResults:null,lpWho:0,lpCmpPage:0,lpWord:'koji',map:null,lpMakerTab:'spec'};
  let toastTimer=null;
  function save(){try{localStorage.setItem(STORE,JSON.stringify(state));}catch(_){message('端末に保存できませんでした');}}
  function step(action){if(Date.now()<ui.lock)return;ui.lock=Date.now()+130;action();render();}
  /* ===== 地価ランキング（r73） =====
     データは GitHub Actions（scripts/fetch-landprice.mjs）が国土交通省 不動産情報ライブラリAPIから集計した
     data/landprice.json を読むだけ。APIキーはアプリに一切置かない。 */
  const LAND_TSUBO=3.305785;
  const LAND_DB='hoppy-landprice-v1';
  const LAND_TOKEN_KEY='hoppy-gh-token';
  const LAND_WORKFLOW='update-landprice.yml';
  const LAND_TYPES=[['price','坪単価'],['yoy','前年比'],['long','5・10年'],['trade','実勢'],['house','中古戸建'],['budget','予算'],['point','地点'],['station','駅']];
  const LAND_FILTERS=[['all','全域（愛知＋岐阜東濃・中濃）'],['fav','★候補だけ'],['nagoya','名古屋市'],['owari','尾張'],['chita','知多'],['nishi','西三河'],['higashi','東三河'],['gifu','岐阜（東濃・中濃）']];
  const LAND_FILTER_REGIONS={nagoya:['名古屋市'],owari:['尾張'],chita:['知多'],nishi:['西三河'],higashi:['東三河'],gifu:['東濃','中濃']};
  const LAND_REGION_ORDER=['名古屋市','尾張','知多','西三河','東三河','東濃','中濃'];
  const LAND_PHASES=[['prep','準備中'],['fetch','取得中'],['apply','反映中'],['done','完了']];
  const LAND_DISCLAIMER='このサービスは、国土交通省不動産情報ライブラリのAPI機能を使用していますが、提供情報の最新性、正確性、完全性等が保証されたものではありません。';
  const LAND_CREDIT='出典：「国土数値情報（地価公示データ・都道府県地価調査データ）」（国土交通省）を加工して作成';
  const landHasTrade=()=>!!(landData&&landData.tradeAvailable!==false&&landData.sources?.trade);
  const landCreditText=()=>LAND_CREDIT+(landHasTrade()?'。取引価格：'+LAND_DISCLAIMER:'');
  const LAND_NOTE='地価公示・地価調査は鑑定評価による標準的な更地価格で、実際の売り出し価格とは異なります';
  let landData=null;
  const landSync={phase:'',startedAt:0,error:'',timer:null};

  // state.land の初期値（defaults() から先に呼ばれるため定数を参照しない）
  function landDefaults(){
    return {type:'price',kind:'all',unit:'tsubo',order:'desc',filter:'all',radius:20,longSpan:5,
      budgetView:'total',pointView:'price',pinFav:1,favorites:[],favTowns:[],
      wishTsubo:50,buildingBudget:2500,manualBudget:0,
      view:'rank',makerSort:'asc',makerType:'all',guideTab:'region',guideScope:'all',sim:landSimDefaults(),commute:landCommuteDefaults(),money:landMoneyDefaults(),size:landSizeDefaults(),find:landFindDefaults(),my:[],seenGuide:0};
  }
  function landNormalize(raw){
    const d=landDefaults(),x=raw&&typeof raw==='object'?raw:{};
    const pick=(k,list)=>list.includes(x[k])?x[k]:d[k];
    const clamp=(k,lo,hi)=>{const n=Number(x[k]);return Number.isFinite(n)?Math.min(hi,Math.max(lo,n)):d[k];};
    return {
      type:pick('type',['price','yoy','long','trade','house','budget','point','station']),
      kind:pick('kind',['koji','chosa','all']),unit:pick('unit',['sqm','tsubo']),order:pick('order',['desc','asc']),
      filter:(v=>typeof v==='string'&&(LAND_FILTERS.some(x=>x[0]===v)||(v.startsWith('line:')&&v.length<40)))(x.filter)?x.filter:'all',
      radius:[10,20,30].includes(Number(x.radius))?Number(x.radius):d.radius,
      longSpan:Number(x.longSpan)===10?10:5,budgetView:pick('budgetView',['total','tsubo']),
      pointView:pick('pointView',['price','chg']),pinFav:x.pinV===2?(x.pinFav===0?0:1):0,pinV:2,
      favorites:Array.isArray(x.favorites)?x.favorites.filter(c=>typeof c==='string'&&/^\d{5}$/.test(c)).slice(0,40):[],
      favTowns:Array.isArray(x.favTowns)?x.favTowns.filter(c=>typeof c==='string'&&/^\d{5}\|.{1,40}$/.test(c)).slice(0,20):[],
      wishTsubo:clamp('wishTsubo',5,500),buildingBudget:clamp('buildingBudget',0,30000),
      manualBudget:clamp('manualBudget',0,100000),
      view:pick('view',['rank','map','compare','sim','maker','guide','commute','advice','find']),makerSort:pick('makerSort',['asc','desc','seis','ins','war']),
      makerType:pick('makerType',['all','全国','愛知','岐阜','鉄骨']),guideTab:pick('guideTab',['region','cond','words']),
      guideScope:pick('guideScope',['all','名古屋市','尾張','知多','西三河','東三河','東濃','中濃']),sim:landSimNormalize(x.sim),commute:landCommuteNormalize(x.commute),money:landMoneyNormalize(x.money),size:landSizeNormalize(x.size),find:landFindNormalize(x.find),my:landMyNormalize(x.my),seenGuide:x.seenGuide?1:0
    };
  }
  function landCriterion(){return {id:'land-value',name:'土地の割安度（相場比）',weight:2,auto:{field:'landValue'}};}

  /* --- 端末内保存（オフラインでも前回データを表示） --- */
  let landDbPromise=null;
  function landDb(){
    if(typeof indexedDB==='undefined')return Promise.reject(Error('IndexedDB unsupported'));
    if(!landDbPromise)landDbPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open(LAND_DB,1);
      req.onupgradeneeded=()=>req.result.createObjectStore('kv');
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    return landDbPromise;
  }
  async function landStore(mode,value){
    const db=await landDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('kv',mode==='get'?'readonly':'readwrite'),store=tx.objectStore('kv');
      const req=mode==='get'?store.get('data'):store.put(value,'data');
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
  }
  const landValid=j=>!!(j&&typeof j==='object'&&Array.isArray(j.cities)&&j.sources);
  const landTime=j=>Date.parse(j?.generatedAt||'')||0;
  function landIsNewer(next,cur){
    if(!landValid(next))return false;
    if(!landValid(cur))return true;
    if(cur.seed&&!next.seed)return true;
    if(next.seed&&!cur.seed)return false;
    return landTime(next)>landTime(cur);
  }
  function landApply(next){
    const prev=landData;landData=next;
    if(!next.seed)landStore('put',next).catch(()=>{});
    landRepaint();
    if(!prev||prev.seed)return next.cities.length;
    const before=new Map(prev.cities.map(c=>[c.code,JSON.stringify(c)]));
    return next.cities.filter(c=>before.get(c.code)!==JSON.stringify(c)).length;
  }
  function landRepaint(){
    if(ui.overlay==='land-settings'||ui.overlay==='form')return;
    if(ui.tab==='land'||String(ui.overlay||'').startsWith('land'))render();
  }
  async function landBoot(){
    if(typeof fetch!=='function')return;
    try{document.addEventListener('visibilitychange',()=>{if(!document.hidden&&landData&&!landBusy())landCheckPublished();});}catch(_){}
    try{const saved=await landStore('get');if(landValid(saved))landData=saved;}catch(_){}
    if(!landData){
      try{const r=await fetch('./data/landprice-seed.json',{cache:'no-cache'});if(r.ok){const j=await r.json();if(landValid(j))landData=j;}}catch(_){}
    }
    if(!state.land.seenGuide&&!ui.overlay){state.land.seenGuide=1;save();ui.overlay='land-howto';ui.lpHowto='';}
    landRepaint();
    landLoadStations();
    landCheckPublished();
  }
  // 公開中の data/landprice.json を確認（起動時・画面復帰時・トークン未設定時の「最新にする」）
  async function landCheckPublished(){
    if(typeof fetch!=='function')return 0;
    try{
      const r=await fetch('./data/landprice.json?t='+Date.now(),{cache:'no-store'});
      if(!r.ok)return 0;
      const j=await r.json();
      if(landIsNewer(j,landData))return landApply(j)||1;
    }catch(_){}
    return 0;
  }

  /* --- 公表スケジュールと「時に応じた更新」 --- */
  function landExpected(now=new Date()){
    const y=now.getFullYear(),md=(now.getMonth()+1)*100+now.getDate();
    const trade=md>=1028?[y,2]:md>=728?[y,1]:md>=428?[y-1,4]:md>=128?[y-1,3]:[y-1,2];
    return {koji:md>=325?y:y-1,chosa:md>=920?y:y-1,trade:trade[0]+'Q'+trade[1]};
  }
  function landStale(){
    if(!landData)return {stale:true,reasons:['データ未取得']};
    const e=landExpected(),s=landData.sources||{},reasons=[];
    if(landData.seed)reasons.push('初期データ');
    if((s.koji?.year||0)<e.koji)reasons.push('地価公示');
    if((s.chosa?.year||0)<e.chosa)reasons.push('地価調査');
    if(landData.tradeAvailable!==false&&!landData.seed&&(!s.trade||String(s.trade.latestPeriod||'')<e.trade))reasons.push('取引価格');
    return {stale:reasons.length>0,reasons};
  }

  /* --- GitHub Actions をボタンから起動 --- */
  function landRepo(){
    let owner='sprintershota01172-collab',repo='HOPPY';
    try{
      const m=location.hostname.match(/^([^.]+)\.github\.io$/i);
      if(m){owner=m[1];const seg=location.pathname.split('/').filter(Boolean)[0];if(seg&&!/\.html?$/i.test(seg))repo=seg;}
    }catch(_){}
    return owner+'/'+repo;
  }
  function landToken(){try{return localStorage.getItem(LAND_TOKEN_KEY)||'';}catch(_){return '';}}
  function landGh(path,opt={}){
    return fetch('https://api.github.com/repos/'+landRepo()+path,{...opt,cache:'no-store',headers:{
      Accept:'application/vnd.github+json',Authorization:'Bearer '+landToken(),'X-GitHub-Api-Version':'2022-11-28',...(opt.headers||{})}});
  }
  function landGhError(status){
    return status===401?'GitHubトークンの期限が切れています。⚙設定から入れ直してください':
      status===403?'トークンの権限が足りません。Actions：Read and write を付けて作り直してください':
      status===404?'リポジトリかワークフローが見つかりません。トークンの対象が HOPPY か確認してください':
      status===422?'ワークフローを起動できませんでした。mainにワークフローがあるか確認してください':
      'GitHubに接続できませんでした（HTTP '+status+'）。少し待ってからもう一度押してください';
  }
  const landBusy=()=>!!landSync.phase&&landSync.phase!=='done'&&landSync.phase!=='error';
  function landSetPhase(phase,error=''){landSync.phase=phase;landSync.error=error;landPaintSync();}
  function landPaintSync(){
    const stamp=app.querySelector('.lp-stamp');if(stamp)stamp.outerHTML=landStampHtml();
    const btn=app.querySelector('.lp-refresh');
    if(btn){btn.classList.toggle('is-busy',landBusy());btn.classList.toggle('lp-glow',!landBusy()&&landStale().stale);}
  }
  async function landRefresh(){
    if(landBusy())return message('更新中です。このままお待ちください');
    if(!landToken()){
      const n=await landCheckPublished();
      message(n?n+'件の市区町村を更新しました':'公開中のデータを読み直しました。自動更新は⚙でGitHubトークンを設定してください');
      return;
    }
    if(typeof navigator!=='undefined'&&navigator.onLine===false)
      return message('オフラインです。通信できる場所でもう一度押してください（前回のデータを表示中）');
    landSync.startedAt=Date.now();clearInterval(landSync.timer);
    landSync.timer=setInterval(()=>{if(landBusy())landPaintSync();},1000);
    landSetPhase('prep');
    try{
      const r=await landGh('/actions/workflows/'+LAND_WORKFLOW+'/dispatches',{method:'POST',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:'main'})});
      if(r.status!==204&&!r.ok)throw Error(landGhError(r.status));
      const since=landSync.startedAt-60000;
      let run=null;
      for(let i=0;i<180;i++){
        await new Promise(res=>setTimeout(res,i?10000:4000));
        const rr=await landGh('/actions/workflows/'+LAND_WORKFLOW+'/runs?event=workflow_dispatch&per_page=1');
        if(!rr.ok)throw Error(landGhError(rr.status));
        const latest=((await rr.json()).workflow_runs||[])[0];
        run=latest&&Date.parse(latest.created_at)>=since?latest:null;
        if(!run){landSetPhase('prep');continue;}
        if(run.status!=='completed'){landSetPhase(run.status==='in_progress'?'fetch':'prep');continue;}
        break;
      }
      if(!run||run.status!=='completed')throw Error('更新に時間がかかっています。しばらくしてから「最新にする」を押してください');
      if(run.conclusion!=='success')throw Error('地価データの取得に失敗しました。GitHubのActions「地価データ更新」のログを確認してください');
      landSetPhase('apply');
      const cr=await landGh('/contents/data/landprice.json?ref=main',{headers:{Accept:'application/vnd.github.raw+json'}});
      if(!cr.ok&&cr.status!==404)throw Error(landGhError(cr.status));
      const next=cr.ok?await cr.json():null;
      const changed=next&&landIsNewer(next,landData)?landApply(next):0;
      landSetPhase('done');
      message(changed?changed+'件の市区町村を更新しました':'新しい公表データはありませんでした（最新の状態です）');
      setTimeout(()=>{if(landSync.phase==='done'){landSync.phase='';landPaintSync();}},5000);
    }catch(err){
      const text=err instanceof TypeError?'通信できませんでした。電波の良い場所でもう一度押してください（前回のデータを表示中）':
        (err?.message||'更新できませんでした。前回のデータを表示しています');
      landSetPhase('error',text);message(text);
      setTimeout(()=>{if(landSync.phase==='error'){landSync.phase='';landPaintSync();}},12000);
    }finally{clearInterval(landSync.timer);}
  }

  /* --- 値の計算・表示 --- */
  const landCity=code=>(landData?.cities||[]).find(c=>c.code===code)||null;
  function landCityIn(c){
    if(!c)return false;
    const f=state.land.filter;
    if(f.startsWith('line:')){const R=landRail(),L=R?.lines.find(l=>'line:'+l.label===f);return L?L.cities.has(c.code):true;}
    if(f==='fav')return state.land.favorites.includes(c.code)||state.land.favTowns.some(k=>k.startsWith(c.code+'|'));
    const regions=LAND_FILTER_REGIONS[f];
    return !regions||regions.includes(c.region);
  }
  function landPointIn(p){
    const c=landCity(p.cityCode);
    if(state.land.filter==='tajimi'&&Number.isFinite(p.lat)&&Number.isFinite(p.lon))
      return landKm(p.lat,p.lon,35.334,137.121)<=state.land.radius;
    return landCityIn(c);
  }
  function landKm(a,b,c,d){
    const r=x=>x*Math.PI/180,h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2;
    return 12742*Math.asin(Math.sqrt(h));
  }
  function landRes(c,kind=state.land.kind){
    const r=c?.residential||{};
    return (kind==='koji'?r.koji:kind==='chosa'?r.chosa:r.all)||{};
  }
  const landFinite=v=>typeof v==='number'&&Number.isFinite(v);
  function landPriceHtml(sqm,{unit=state.land.unit,small=true}={}){
    if(!landFinite(sqm)||sqm<=0)return '—';
    const u=t=>small?'<small>'+t+'</small>':t;
    return unit==='tsubo'?(sqm*LAND_TSUBO/10000).toFixed(1)+u('万円/坪'):digits.format(Math.round(sqm))+u('円/㎡');
  }
  function landMan(yen){
    if(!landFinite(yen)||yen<=0)return '—';
    const man=Math.round(yen/10000);
    if(man>=10000){const oku=Math.floor(man/10000),rest=man%10000;return oku+'億'+(rest?digits.format(rest)+'万円':'円');}
    return digits.format(man)+'万円';
  }
  function landPct(v,d=2){
    if(!landFinite(v))return '—';
    return (v>0?'+':v<0?'−':'±')+Math.abs(v).toFixed(d)+'%';
  }
  const landTone=v=>!landFinite(v)||Math.abs(v)<0.005?'lp-flat':v>0?'lp-up':'lp-down';
  function landTradeLand(t){
    if(t?.landCount>=5&&t.landTsuboMedian)return {v:t.landTsuboMedian,n:t.landCount,label:'',ref:false};
    if(t?.land8?.count>=5&&t.land8.median)return {v:t.land8.median,n:t.land8.count,label:'（2年）',ref:false};
    return {v:t?.landTsuboMedian||null,n:t?.landCount||0,label:'',ref:!!t?.landTsuboMedian};
  }
  function landTradeHouse(t){
    if(t?.houseCount>=5&&t.houseMedian)return {v:t.houseMedian,n:t.houseCount,label:'',ref:false};
    if(t?.house8?.count>=5&&t.house8.median)return {v:t.house8.median,n:t.house8.count,label:'（2年）',ref:false};
    return {v:t?.houseMedian||null,n:t?.houseCount||0,label:'',ref:!!t?.houseMedian};
  }
  function landBudget(){
    const purchase=Number(state.land.manualBudget)||0;
    return {purchase,fromFp:false,land:purchase>0?purchase-(Number(state.land.buildingBudget)||0):null};
  }
  function landBudgetJudge(c){
    const sqm=c?.residential?.all?.avgSqm||c?.residential?.koji?.avgSqm||c?.residential?.chosa?.avgSqm;
    if(!sqm)return null;
    const b=landBudget(),tsubo=sqm*LAND_TSUBO,total=tsubo*state.land.wishTsubo;
    const land=b.land!==null?b.land*10000:null;
    return {tsubo,total,can:land!==null&&land>0?land/tsubo:land!==null?0:null,
      grade:land===null?null:total<=land?2:total<=land*1.1?1:0,land};
  }
  function landShortAddress(address,city){
    let s=String(address||'');
    if(city){s=s.replace(city.pref||'','');const bare=city.name.replace(/^名古屋市/,'');s=s.replace(city.name,'').replace(new RegExp('^名古屋市'),'').replace(bare,'');}
    s=s.replace(/^(愛知県|岐阜県)/,'').trim();
    return s||String(address||'地点');
  }

  /* --- ランキング --- */
  function landCityRow(c,type){
    const L=state.land,r=c.residential||{},res=landRes(c),base={key:c.code,code:c.code,name:c.name,fav:L.favorites.includes(c.code)};
    const where=c.region+(c.pref==='岐阜県'?'（岐阜）':'');
    const pts=res.count?'・'+res.count+'地点':'';
    const yoy=v=>'<span class="'+landTone(v)+'">'+landPct(v)+'</span>';
    if(type==='price')return {...base,value:res.avgSqm,sub:where+pts,ref:res.count>0&&res.count<3,
      main:landPriceHtml(res.avgSqm),extra:yoy(res.chg)};
    if(type==='yoy')return {...base,value:res.chg,sub:where+pts,ref:res.count>0&&res.count<3,
      main:'<span class="'+landTone(res.chg)+'">'+landPct(res.chg)+'</span>',extra:landPriceHtml(res.avgSqm)};
    if(type==='long'){
      const v=L.longSpan===10?r.chg10y:r.chg5y,other=L.longSpan===10?r.chg5y:r.chg10y;
      return {...base,value:v,sub:where+(r.all?.count?'・'+r.all.count+'地点':''),ref:r.all?.count>0&&r.all.count<3,
        main:'<span class="'+landTone(v)+'">'+landPct(v,1)+'</span>',extra:(L.longSpan===10?'5年 ':'10年 ')+landPct(other,1)};
    }
    if(type==='trade'){
      const t=landTradeLand(c.trade),sqm=t.v?t.v/LAND_TSUBO:null,koji=r.all?.avgSqm;
      return {...base,value:sqm,sub:where+'・'+t.n+'件'+t.label,ref:t.ref||t.n>0&&t.n<5,main:landPriceHtml(sqm),
        extra:sqm&&koji?'地価の'+(sqm/koji).toFixed(2)+'倍':''};
    }
    if(type==='house'){
      const h=landTradeHouse(c.trade);
      return {...base,value:h.v,sub:where+'・'+h.n+'件'+h.label,ref:h.ref||h.n>0&&h.n<5,main:landMan(h.v),extra:h.v?'中央値':''};
    }
    if(type==='budget'){
      const j=landBudgetJudge(c);
      if(!j)return {...base,value:null,sub:where,main:'—',extra:''};
      const markHtml=j.grade===null?'':'<span class="lp-grade rating-face '+faceClass(j.grade)+'">'+mark(j.grade)+'</span>';
      return {...base,value:L.budgetView==='tsubo'?j.can:j.total,sub:where+'・'+(j.tsubo/10000).toFixed(1)+'万円/坪',
        main:L.budgetView==='tsubo'?(j.can===null?'—':Math.floor(j.can)+'<small>坪</small>'):landMan(j.total),
        extra:markHtml+(L.budgetView==='tsubo'?L.wishTsubo+'坪 '+landMan(j.total):j.can===null?'予算未設定':'買える'+Math.floor(j.can)+'坪')};
    }
    return null;
  }
  function landRows(){
    const L=state.land,type=L.type;let rows=[];
    if(type==='point'){
      rows=(landData?.points||[]).filter(p=>p.use==='住宅地'&&(L.kind==='all'||p.kind===L.kind)&&landPointIn(p)).map(p=>{
        const c=landCity(p.cityCode),chg=L.pointView==='chg';
        return {key:p.id,code:p.cityCode,noStar:true,value:chg?p.chg:p.priceSqm,name:landShortAddress(p.address,c),
          sub:[c?.name,p.station?p.station+'駅':'',(p.kind==='koji'?'公示 ':'調査 ')+(p.lot||'')].filter(Boolean).join('・'),
          main:chg?'<span class="'+landTone(p.chg)+'">'+landPct(p.chg,1)+'</span>':landPriceHtml(p.priceSqm),
          extra:chg?landPriceHtml(p.priceSqm):'<span class="'+landTone(p.chg)+'">'+landPct(p.chg,1)+'</span>'};
      });
    }else if(type==='station'){
      rows=(landData?.stations||[]).filter(s=>landCityIn(landCity(s.cityCode))).map(s=>({
        key:'st|'+s.name+'|'+s.region,code:s.cityCode,noStar:true,value:s.avgSqm,name:s.name+'駅',
        sub:[landCity(s.cityCode)?.name||s.region,s.count+'地点'].join('・'),ref:s.count<3,
        main:landPriceHtml(s.avgSqm),extra:'<span class="'+landTone(s.chg)+'">'+landPct(s.chg)+'</span>'}));
    }else rows=(landData?.cities||[]).filter(landCityIn).map(c=>landCityRow(c,type)).filter(Boolean);
    const dir=L.order==='asc'?1:-1;
    rows.sort((a,b)=>{
      const av=landFinite(a.value),bv=landFinite(b.value);
      if(av!==bv)return av?-1:1;
      return (av?(a.value-b.value)*dir:0)||a.name.localeCompare(b.name,'ja');
    });
    rows.forEach((r,i)=>{r.rank=landFinite(r.value)?i+1:null;});
    if(L.pinFav&&!['point','station'].includes(type)){
      const fav=new Set(L.favorites);
      rows=[...rows.filter(r=>fav.has(r.code)),...rows.filter(r=>!fav.has(r.code))];
    }
    return rows;
  }
  const landPerPage=()=>{const h=window.innerHeight||800;return h<640?8:h<760?9:10;};

  /* --- 画面 --- */
  function landStampHtml(){
    if(landSync.phase==='error')
      return '<div class="lp-stamp lp-error" role="alert"><span>'+esc(landSync.error)+'</span></div>';
    if(landSync.phase){
      const idx=LAND_PHASES.findIndex(x=>x[0]===landSync.phase),sec=Math.max(0,Math.round((Date.now()-landSync.startedAt)/1000));
      return '<div class="lp-stamp lp-progress" role="status" aria-live="polite">'+
        LAND_PHASES.map(([k,label],i)=>'<span class="'+(i<idx||landSync.phase==='done'?'done':i===idx?'now':'')+'">'+label+'</span>').join('<i aria-hidden="true">›</i>')+
        (landSync.phase==='done'?'':'<em>'+Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0')+'</em>')+'</div>';
    }
    const s=landData?.sources||{},st=landStale(),gen=landData?.generatedAt?new Date(landData.generatedAt):null;
    const when=landData?.seed?'初期データ':gen&&Number.isFinite(gen.getTime())?'最終更新 '+(gen.getMonth()+1)+'/'+gen.getDate():'';
    return '<button class="lp-stamp" data-act="lp-about" aria-label="データ時点と出典">'+
      (st.stale?'<b class="lp-badge">'+(landData?.seed?'初期データ表示中':'新しい地価が公表されたかも')+'</b>':'')+
      '<span>公示 '+(s.koji?.year||'—')+'.1.1・調査 '+(s.chosa?.year||'—')+'.7.1'+(landHasTrade()?'・取引 '+esc(s.trade.latestPeriod):'')+'</span>'+
      '<span class="lp-when">'+esc(when)+'</span></button>';
  }
  function landHeaderHtml(){
    const glow=!landBusy()&&landStale().stale;
    return '<div class="lp-head"><span class="home-visual-title">'+landMascot(landBusy()?'think':'happy',30)+'地価調べ君 <i class="lp-head-sub">'+({rank:'RANKING',map:'MAP',compare:'COMPARE',sim:'SIMULATOR',commute:'COMMUTE',advice:'MONEY',find:'FIND',maker:'MAKERS',guide:'GUIDE'})[state.land.view]+'</i></span><div class="lp-head-actions">'+
      '<button class="lp-icon lp-help-icon" data-act="lp-start" aria-label="使い方" title="使い方">？</button>'+
      '<button class="lp-icon'+(glow?' has-dot':'')+(landBusy()?' is-busy':'')+'" data-act="lp-settings" aria-label="設定・データ更新" title="設定・データ更新">⚙</button></div></div>';
  }
  function landAreaSelect(){
    const f=state.land.filter,label=landLineFilterLabel(f)||(LAND_FILTERS.find(x=>x[0]===f)||LAND_FILTERS[0])[1],R=landRail();
    return '<label class="lp-area-pick'+(f!=='all'?' is-on':'')+'"><span aria-hidden="true">📍</span><b>'+esc(f==='all'?'全域':label)+'</b><i aria-hidden="true">▾</i>'+
      '<select data-lp-area aria-label="エリアを選ぶ"><optgroup label="地域">'+LAND_FILTERS.map(([k,l])=>'<option value="'+k+'"'+(k===f?' selected':'')+'>'+esc(l)+'</option>').join('')+'</optgroup>'+
      (R?'<optgroup label="沿線">'+R.lines.map(L=>'<option value="line:'+esc(L.label)+'"'+('line:'+L.label===f?' selected':'')+'>'+esc(L.label)+'沿線</option>').join('')+'</optgroup>':'')+'</select></label>';
  }
  function landSeg(act,current,opts,cls=''){
    return '<div class="lp-seg '+cls+'" role="group">'+opts.map(([v,l])=>'<button class="'+(String(current)===String(v)?'active':'')+'" data-act="'+act+'" data-value="'+v+'" aria-pressed="'+(String(current)===String(v))+'">'+l+'</button>').join('')+'</div>';
  }
  function landTogglesHtml(){
    const L=state.land,t=L.type,parts=[];
    if(t==='long')parts.push(landSeg('lp-span',L.longSpan,[[5,'5年'],[10,'10年']]));
    if(t==='budget')parts.push(landSeg('lp-budget-view',L.budgetView,[['total','総額'],['tsubo','坪数']]));
    if(t==='point')parts.push(landSeg('lp-point-view',L.pointView,[['price','価格'],['chg','前年比']]));
    if(['price','trade','point','station'].includes(t))parts.push(landSeg('lp-unit',L.unit,[['sqm','㎡'],['tsubo','坪']],t==='point'?'lp-hide-narrow':''));
    parts.push(landSeg('lp-order',L.order,[['desc','高い<span class="lp-long">順</span>'],['asc','安い<span class="lp-long">順</span>']]));
    if(t==='budget'){
      const b=landBudget();
      parts.push('<button class="lp-mini" data-act="lp-settings">'+(b.land!==null?'土地'+digits.format(b.land)+'万':'予算を設定')+'</button>');
    }
    return '<div class="lp-toggles">'+landAreaSelect()+parts.join('')+'</div>';
  }
  function landRowHtml(r,i=0){
    return '<div class="lp-row'+(r.fav?' is-fav':'')+'" style="--i:'+i+'"><button class="lp-row-main" data-act="lp-open" data-value="'+esc(r.code)+'">'+
      '<span class="lp-rank'+(r.rank&&r.rank<=3?' is-top':'')+'">'+(r.rank??'–')+'</span>'+
      '<span class="lp-name"><b>'+esc(r.name)+'</b><small>'+(r.ref?'<i class="lp-ref">参考</i>':'')+esc(r.sub||'')+'</small></span>'+
      '<span class="lp-val"><b>'+r.main+'</b><span class="lp-extra">'+(r.extra||'')+'</span></span></button>'+
      (!r.noStar?'<button class="lp-star'+(r.fav?' on':'')+'" data-act="lp-fav" data-value="'+esc(r.code)+'" aria-label="'+esc(r.name)+'をお気に入り'+(r.fav?'から外す':'に追加')+'">'+(r.fav?'★':'☆')+'</button>':'')+'</div>';
  }
  function landScreen(){
    const L=state.land;
    if(!landData)return '<section class="screen lp-screen">'+landHeaderHtml()+
      empty('◔','地価データを読み込み中','初回は通信が必要です。通信できる場所で開いてください。')+'</section>';
    const noTrade=['trade','house'].includes(L.type)&&!landHasTrade()&&!landData.seed;
    const rows=noTrade?[]:landRows(),per=landPerPage(),total=Math.max(1,Math.ceil(rows.length/per));
    ui.lpPage=Math.max(0,Math.min(ui.lpPage||0,total-1));
    const page=rows.slice(ui.lpPage*per,(ui.lpPage+1)*per);
    const hint=noTrade?'実勢・中古戸建は実際の取引価格（不動産情報ライブラリのAPIキーを登録した場合だけ取得）で表示します。地価公示・地価調査のランキングはキーなしで使えます':
      landData.seed?'初期データは一部の市区町村だけです。「🔄 最新にする」で全市区町村を取得します':'絞り込みを変えてください';
    const group=landGroup(L.view);
    const nav='<nav class="lp-nav" aria-label="画面の切り替え">'+LAND_NAV.map(([k,l,ic])=>'<button class="'+(group===k?'active':'')+'" data-act="lp-nav" data-value="'+k+'" aria-current="'+(group===k?'page':'false')+'"><span aria-hidden="true">'+ic+'</span>'+l+'</button>').join('')+'</nav>';
    const views=group==='calc'?'<div class="lp-sub">'+landSeg('lp-view',L.view,[['find','予算から探す'],['sim','総額を計算'],['commute','通勤'],['advice','返済チェック']],'lp-seg-fill')+'</div>':
      group==='learn'?'<div class="lp-sub">'+landSeg('lp-learn',L.view==='maker'?'maker':L.guideTab,[['maker','メーカー'],['region','地域'],['cond','土地の条件'],['words','用語']],'lp-seg-fill')+'</div>':'';
    if(L.view==='sim')return '<section class="screen lp-screen lp-v-sim">'+landHeaderHtml()+views+landPurpose(L.view)+landSimScreen()+nav+'</section>';
    if(L.view==='maker')return '<section class="screen lp-screen lp-v-maker">'+landHeaderHtml()+views+landPurpose(L.view)+landMakerScreen()+nav+'</section>';
    if(L.view==='guide')return '<section class="screen lp-screen lp-v-guide">'+landHeaderHtml()+views+landPurpose(L.view)+landGuideScreen()+nav+'</section>';
    if(L.view==='map')return '<section class="screen lp-screen lp-v-map">'+landHeaderHtml()+views+landPurpose(L.view)+landMapScreen()+nav+'</section>';
    if(L.view==='compare')return '<section class="screen lp-screen lp-v-compare">'+landHeaderHtml()+views+landPurpose(L.view)+landCompareScreen()+nav+'</section>';
    if(L.view==='find')return '<section class="screen lp-screen lp-v-find">'+landHeaderHtml()+views+landPurpose(L.view)+landFindScreen()+nav+'</section>';
    if(L.view==='advice')return '<section class="screen lp-screen lp-v-advice">'+landHeaderHtml()+views+landPurpose(L.view)+landMoneyScreen()+nav+'</section>';
    if(L.view==='commute')return '<section class="screen lp-screen lp-v-commute">'+landHeaderHtml()+views+landPurpose(L.view)+landCommuteScreen()+nav+'</section>';
    return '<section class="screen lp-screen">'+landHeaderHtml()+views+landPurpose('rank')+landStampHtml()+
      '<div class="lp-types swipe-zone" data-swipe="lp-types" role="tablist" aria-label="ランキングの種類">'+LAND_TYPES.map(([k,l])=>
        '<button role="tab" aria-selected="'+(L.type===k)+'" class="'+(L.type===k?'active':'')+'" data-act="lp-type" data-value="'+k+'">'+(k==='price'&&L.unit==='sqm'?'㎡単価':l)+'</button>').join('')+'</div>'+
      landTogglesHtml()+
      '<div class="lp-list swipe-zone" data-swipe="lp-list" style="--lp-rows:'+per+'">'+
        (page.length&&!noTrade?page.map((r,i)=>landRowHtml(r,i)).join(''):'<div class="lp-empty"><strong>'+(noTrade?'取引価格のデータはありません':'該当するデータがありません')+'</strong><span>'+esc(hint)+'</span></div>')+'</div>'+
      '<div class="lp-foot">'+navPager(ui.lpPage,total,'lp-page')+'</div>'+
      '<button class="lp-source" data-act="lp-about">出典：国土数値情報（国土交通省）ⓘ</button>'+nav+'</section>';
  }
  function landSpark(hist){
    const h=hist.filter(x=>landFinite(x.avgSqm));
    if(h.length<2)return '<div class="lp-spark is-empty"><span>10年の推移は「🔄 最新にする」で取得されます</span></div>';
    const vals=h.map(x=>x.avgSqm),lo=Math.min(...vals),hi=Math.max(...vals),span=hi-lo||1;
    const pts=h.map((x,i)=>[(i/(h.length-1))*296+2,52-((x.avgSqm-lo)/span)*46]);
    const line=pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
    const chg=(vals.at(-1)/vals[0]-1)*100,last=pts.at(-1);
    return '<div class="lp-spark"><svg viewBox="0 0 300 56" preserveAspectRatio="none" role="img" aria-label="'+h[0].year+'年から'+h.at(-1).year+'年の平均価格の推移">'+
      '<polygon points="2,56 '+line+' 298,56" class="lp-spark-fill '+landTone(chg)+'"/>'+
      '<polyline points="'+line+'" class="lp-spark-line '+landTone(chg)+'" vector-effect="non-scaling-stroke"/>'+
      '<circle cx="'+last[0].toFixed(1)+'" cy="'+last[1].toFixed(1)+'" r="2.6" class="lp-spark-dot '+landTone(chg)+'"/></svg>'+
      '<div class="lp-spark-axis"><span>'+h[0].year+' '+landPriceHtml(vals[0],{small:false})+'</span><b class="'+landTone(chg)+'">'+(h.length-1)+'年 '+landPct(chg,1)+'</b><span>'+h.at(-1).year+' '+landPriceHtml(vals.at(-1),{small:false})+'</span></div></div>';
  }
  function landDetailScreen(){
    const c=landCity(ui.lpCity);
    if(!c)return modalFrame('地価',empty('◔','この市区町村のデータがありません','「🔄 最新にする」で全市区町村を取得してください。'));
    const L=state.land,r=c.residential||{},all=r.all||{},fav=L.favorites.includes(c.code);
    const allSqm=all.avgSqm||r.koji?.avgSqm||r.chosa?.avgSqm,allCount=all.count??((r.koji?.count||0)+(r.chosa?.count||0));
    const other=L.unit==='tsubo'?'sqm':'tsubo';
    const tl=landTradeLand(c.trade),th=landTradeHouse(c.trade),j=landBudgetJudge(c);
    const limit=(window.innerHeight||800)<700?3:5;
    const pts=(landData.points||[]).filter(p=>p.cityCode===c.code&&p.use==='住宅地').sort((a,b)=>b.priceSqm-a.priceSqm).slice(0,limit);
    const cell=(title,value,sub,ref)=>'<div class="lp-cell"><span>'+title+(ref?'<i class="lp-ref">参考</i>':'')+'</span><b>'+value+'</b><small>'+sub+'</small></div>';
    const yearNote=s=>s?.year&&s.year!==landData.sources?.chosa?.year?'（'+s.year+'年）':'';
    return '<div class="full lp-detail"><header class="full-header"><button class="btn compact" data-act="overlay-close">‹ 戻る</button><strong>'+esc(c.name)+'</strong>'+
      '<button class="btn compact lp-star'+(fav?' on':'')+'" data-act="lp-fav" data-value="'+esc(c.code)+'" aria-label="お気に入り">'+(fav?'★':'☆')+'</button></header>'+
      '<section class="full-body lp-detail-body">'+
      '<div class="lp-hero"><div class="lp-hero-main"><span>住宅地の平均（公示・調査）'+(allCount>0&&allCount<3?'<i class="lp-ref">参考</i>':'')+'</span>'+
        '<strong>'+landPriceHtml(allSqm)+'</strong><small>'+landPriceHtml(allSqm,{unit:other,small:false})+'・'+(allCount||0)+'地点</small></div>'+
        '<div class="lp-hero-side"><b class="'+landTone(all.chg)+'">前年比 '+landPct(all.chg)+'</b><span>'+esc(c.region+'・'+c.pref)+'</span>'+(landHasWork()&&landCommute(landCentroids().get(c.code))?'<span>通勤 '+esc(landCommuteText(landCommute(landCentroids().get(c.code))))+'</span>':'')+'</div></div>'+
      landSpark(r.history||[])+
      '<div class="lp-cells">'+
        cell('地価公示',landPriceHtml(r.koji?.avgSqm),(r.koji?.count||0)+'地点・<span class="'+landTone(r.koji?.chg)+'">'+landPct(r.koji?.chg)+'</span>',r.koji?.count>0&&r.koji.count<3)+
        cell('地価調査'+yearNote(r.chosa),landPriceHtml(r.chosa?.avgSqm),(r.chosa?.count||0)+'地点・<span class="'+landTone(r.chosa?.chg)+'">'+landPct(r.chosa?.chg)+'</span>',r.chosa?.count>0&&r.chosa.count<3)+
        (landHasTrade()?cell('実勢の土地取引',landPriceHtml(tl.v?tl.v/LAND_TSUBO:null),tl.n+'件'+tl.label+'・中央値',tl.ref||tl.n>0&&tl.n<5):
          cell('住宅地の中央値',landPriceHtml(all.medianSqm),'公示・調査 '+(allCount||0)+'地点',false))+
        cell('商業地（参考）',landPriceHtml(c.commercial?.avgSqm),(c.commercial?.count||0)+'地点・<span class="'+landTone(c.commercial?.chg)+'">'+landPct(c.commercial?.chg)+'</span>',false)+
      '</div>'+
      '<div class="lp-rates"><span>上昇率</span><b class="'+landTone(all.chg)+'">1年 '+landPct(all.chg,1)+'</b><b class="'+landTone(r.chg5y)+'">5年 '+landPct(r.chg5y,1)+'</b><b class="'+landTone(r.chg10y)+'">10年 '+landPct(r.chg10y,1)+'</b>'+(landHasTrade()?'<em>中古戸建 '+landMan(th.v)+'</em>':'')+'</div>'+
      '<div class="lp-points"><button class="lp-points-title" data-act="lp-areas">地点トップ'+limit+'（住宅地）<em>地区ごとの地価を見る ›</em></button>'+(pts.length?pts.map(p=>
        '<div><span>'+esc(landShortAddress(p.address,c))+'<small>'+(p.kind==='koji'?'公示':'調査')+(p.station?'・'+esc(p.station)+'駅':'')+'</small></span><b>'+landPriceHtml(p.priceSqm,{small:false})+'</b><em class="'+landTone(p.chg)+'">'+landPct(p.chg,1)+'</em></div>').join(''):
        '<div class="lp-points-empty">地点データは「🔄 最新にする」で取得されます</div>')+'</div>'+
      (j?'<button class="lp-budget-line" data-act="lp-settings"><span>'+L.wishTsubo+'坪の土地総額</span><b>'+landMan(j.total)+'</b>'+
        (j.grade===null?'<small>予算を設定 ›</small>':'<span class="rating-face '+faceClass(j.grade)+'">'+mark(j.grade)+'</span><small>土地予算 '+digits.format(Math.round(j.land/10000))+'万円・買える'+Math.floor(j.can)+'坪</small>')+'</button>':'')+
      '<div class="lp-detail-actions"><button class="btn primary flex1" data-act="lp-sim-city" data-value="'+esc(c.code)+'">総額を計算</button><button class="btn flex1" data-act="lp-map-city" data-value="'+esc(c.code)+'">地図で見る</button><button class="btn flex1" data-act="lp-word" data-value="koji">公示と調査</button></div>'+
      '<p class="lp-disclaimer">'+esc(landCreditText())+'</p></section></div>';
  }
  function landSettingsScreen(){
    const L=state.land,b=landBudget(),token=landToken();
    const field=(label,key,unit,attrs)=>'<label class="lp-field"><span>'+label+'</span><span class="lp-input"><input type="number" inputmode="decimal" data-lp-setting="'+key+'" value="'+esc(L[key])+'" '+attrs+'><i>'+unit+'</i></span></label>';
    const st=landStale();
    return modalFrame('設定','<div class="panel detail grow lp-settings">'+
      '<div class="lp-set-group"><span class="kicker">地価データ</span>'+landStampHtml()+
        '<button class="btn primary wide lp-refresh'+(landBusy()?' is-busy':'')+'" data-act="lp-refresh"><span class="lp-refresh-icon" aria-hidden="true">🔄</span> 最新の地価にする</button>'+
        (st.stale?'<p class="lp-note">'+esc(st.reasons.join('・'))+'が新しく公表されているかもしれません</p>':'')+'</div>'+
      '<div class="lp-set-group"><span class="kicker">ランキングの表示</span>'+
        '<div class="lp-set-row"><span>使う地価</span>'+landSeg('lp-kind',L.kind,[['all','両方'],['koji','公示'],['chosa','調査']])+'</div>'+
        '<div class="lp-set-row"><span>★候補を先頭に</span>'+landSeg('lp-pin',L.pinFav?'1':'0',[['1','する'],['0','しない']])+'</div></div>'+
      '<div class="lp-set-group"><span class="kicker">予算で買える土地</span>'+
        field('希望坪数','wishTsubo','坪','min="5" max="500" step="1"')+
        field('建物予算','buildingBudget','万円','min="0" max="30000" step="50"')+
        field('家の購入予算（土地＋建物）','manualBudget','万円','min="0" max="100000" step="100"')+
        '<p class="lp-note">'+(b.land!==null?'土地に使える予算＝'+digits.format(b.purchase)+'万円−建物'+digits.format(L.buildingBudget)+'万円＝'+digits.format(b.land)+'万円':'購入予算を入れると、予算ランキングと総額の○△×が出ます')+'</p></div>'+
      '<div class="lp-set-group"><span class="kicker">ワンタップ更新（GitHub）</span>'+
        '<p class="lp-note">'+(token?'✓ トークン設定済み（この端末だけに保存）':'Fine-grained トークン（対象：HOPPYのみ／Actions：Read and write／Contents：Read）を一度だけ入力します')+'</p>'+
        '<div class="lp-token-row"><input type="password" autocomplete="off" autocapitalize="off" spellcheck="false" data-lp-token placeholder="'+(token?'新しいトークンで置き換え':'github_pat_…')+'" aria-label="GitHubトークン">'+
        '<button class="btn compact primary" data-act="lp-token-save">保存</button>'+(token?'<button class="btn compact" data-act="lp-token-clear">削除</button>':'')+'</div></div>'+
      '</div><button class="btn wide" data-act="lp-about">データの時点・出典・算出方法</button>');
  }
  function landAboutScreen(){
    const s=landData?.sources||{},gen=landData?.generatedAt?new Date(landData.generatedAt):null,checks=(landData?.validation||[]).filter(v=>v.actual!=null);
    const period=s.trade?.latestPeriod?String(s.trade.latestPeriod).replace(/(\d{4})Q(\d)/,'$1年第$2四半期'):'未取得（APIキー登録時のみ）';
    const st=landStale();
    return modalFrame('データについて','<div class="panel detail grow lp-about">'+
      '<div class="lp-about-block"><span class="kicker">データ時点</span><p>地価公示 '+(s.koji?.year?s.koji.year+'年1月1日':'—')+'／地価調査 '+(s.chosa?.year?s.chosa.year+'年7月1日':'—')+'／取引 '+esc(period)+'</p>'+
        '<p>最終更新：'+(landData?.seed?'初期データ（公表資料の平均値のみ）':gen?(gen.getMonth()+1)+'月'+gen.getDate()+'日':'—')+(st.stale?'　<b class="lp-badge">'+esc(st.reasons.join('・'))+'が新しくなっている可能性</b>':'')+'</p></div>'+
      '<div class="lp-about-block"><span class="kicker">公表の目安</span><p>地価公示：毎年3月下旬（1月1日時点）／地価調査：9月中旬〜下旬（7月1日時点）。国土数値情報にも同じ時期に掲載され、毎週月曜の朝に自動で取り込みます。</p></div>'+
      '<div class="lp-about-block"><span class="kicker">算出方法</span><p>住宅地の平均＝各地点価格の単純平均。前年比＝継続地点の変動率の平均（公式と同じ）。5年・10年＝同じ地点の過去の価格と比較（当時選定されていない地点は除外）。実勢（APIキー登録時）＝「宅地(土地)」直近4四半期の坪単価の中央値（上下5%除外、5件未満は参考）。坪単価＝㎡単価×3.305785。地点数3未満は「参考」。</p></div>'+
      (checks.length?'<div class="lp-about-block"><span class="kicker">検算（公表値との差）</span><div class="lp-checks">'+checks.slice(0,10).map(v=>'<span>'+esc(v.label.replace(/ \d{4}年 /,' '))+'</span><b class="'+(v.ok?'ok':v.partial?'':'ng')+'">'+(v.diffPct>0?'+':'')+v.diffPct+'%</b>').join('')+'</div></div>':'')+
      '<p class="lp-disclaimer">'+esc(LAND_NOTE)+'。'+esc(landCreditText())+'</p></div>');
  }
  function landAction(action,v){
    if(landV3Action(action,v)!==false)return;
    if(landV4Action(action,v)!==false)return;
    if(landV6Action(action,v)!==false)return;
    if(landV7Action(action,v)!==false)return;
    if(landV14Action(action,v)!==false)return;
    if(landV17Action(action,v)!==false)return;
    if(landV15Action(action,v)!==false)return;
    if(landV13Action(action,v)!==false)return;
    if(landV12Action(action,v)!==false)return;
    if(landV9Action(action,v)!==false)return;
    if(landV10Action(action,v)!==false)return;
    const L=state.land;
    const set=fn=>step(()=>{fn();ui.lpPage=0;ui.lpCommutePage=0;save();});
    if(action==='lp-type')return set(()=>{if(LAND_TYPES.some(x=>x[0]===v))L.type=v;});
    if(action==='lp-filter')return set(()=>{if(v==='tajimi'&&L.filter==='tajimi')L.radius=L.radius>=30?10:L.radius+10;L.filter=v;});
    if(action==='lp-kind')return set(()=>{L.kind=['koji','chosa','all'].includes(v)?v:'all';});
    if(action==='lp-unit')return step(()=>{L.unit=v==='sqm'?'sqm':'tsubo';save();});
    if(action==='lp-order')return set(()=>{L.order=v==='asc'?'asc':'desc';});
    if(action==='lp-span')return set(()=>{L.longSpan=Number(v)===10?10:5;});
    if(action==='lp-budget-view')return set(()=>{L.budgetView=v==='tsubo'?'tsubo':'total';});
    if(action==='lp-point-view')return set(()=>{L.pointView=v==='chg'?'chg':'price';});
    if(action==='lp-pin')return set(()=>{L.pinFav=v==='0'?0:v==='1'?1:(L.pinFav?0:1);});
    if(action==='lp-page'){const total=Math.max(1,Math.ceil(landRows().length/landPerPage()));return step(()=>changePage('lpPage',total,Number(v)));}
    if(action==='lp-fav')return step(()=>{
      const on=L.favorites.includes(v);
      L.favorites=on?L.favorites.filter(x=>x!==v):[...L.favorites,v].slice(-40);save();
      message(on?'お気に入りから外しました':'★候補に追加しました（比較タブで比べられます）');
    });
    if(action==='lp-open')return openOverlay('land-detail',()=>{ui.lpCity=v;});
    if(action==='lp-sim-city')return step(()=>{if(landCity(v))L.sim.city=v;L.view='sim';ui.overlay='';save();});
    if(action==='lp-settings')return openOverlay('land-settings');
    if(action==='lp-about')return openOverlay('land-about');
    if(action==='lp-refresh'){landRefresh();return;}
    if(action==='lp-view')return step(()=>{if(LAND_VIEWS.some(x=>x[0]===v)){L.view=v;if(landGroup(v)==='calc')ui.lastCalc=v;if(landGroup(v)==='learn')ui.lastLearn=v;}save();});
    if(action==='lp-nav')return step(()=>{L.view=v==='calc'?(ui.lastCalc||'find'):v==='learn'?(ui.lastLearn||'maker'):(['rank','map','compare'].includes(v)?v:'rank');save();});
    if(action==='lp-learn')return step(()=>{if(v==='maker')L.view='maker';else{L.view='guide';L.guideTab=['cond','words'].includes(v)?v:'region';ui.lpGuidePage=0;}ui.lastLearn=L.view;save();});
    if(action==='lp-sim-grade')return step(()=>{L.sim.grade=['low','mid','high'].includes(v)?v:'mid';save();});
    if(action==='lp-maker-type')return step(()=>{L.makerType=['all','全国','愛知','岐阜','鉄骨'].includes(v)?v:'all';ui.lpMakerPage=0;save();});
    if(action==='lp-maker-sort')return step(()=>{L.makerSort=v==='desc'?'desc':'asc';ui.lpMakerPage=0;save();});
    if(action==='lp-maker-tab')return step(()=>{ui.lpMakerTab=v==='about'?'about':'spec';});
    if(action==='lp-maker-page'){const total=Math.max(1,Math.ceil(landMakerList().length/Math.max(5,landPerPage()-1)));return step(()=>changePage('lpMakerPage',total,Number(v)));}
    if(action==='lp-maker-open')return openOverlay('land-maker',()=>{ui.lpMaker=v;ui.lpMakerTab='spec';});
    if(action==='lp-maker-sim')return step(()=>{if(landMakerById(v))L.sim.maker=v;L.view='sim';ui.overlay='';save();});
    if(action==='lp-guide-tab')return step(()=>{L.guideTab=['cond','words'].includes(v)?v:'region';ui.lpGuidePage=0;save();});
    if(action==='lp-guide-page')return step(()=>{ui.lpGuidePage=Math.max(0,(ui.lpGuidePage||0)+(Number(v)||0));});
    if(action==='lp-guide-region')return step(()=>{L.filter=LAND_REGION_FILTER[v]||'all';L.view='rank';ui.lpPage=0;save();});
    if(action==='lp-token-save'){
      const el=app.querySelector('[data-lp-token]'),value=String(el?.value||'').trim();
      if(!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(value))return message('トークンの形式が違います（github_pat_ で始まる文字列）');
      try{localStorage.setItem(LAND_TOKEN_KEY,value);}catch(_){return message('この端末に保存できませんでした');}
      return step(()=>{message('トークンを保存しました。「最新にする」で更新できます');});
    }
    if(action==='lp-token-clear'){
      if(!confirm('この端末からGitHubトークンを削除しますか？'))return;
      try{localStorage.removeItem(LAND_TOKEN_KEY);}catch(_){}
      return step(()=>{message('トークンを削除しました');});
    }
  }
  function landSwipe(kind,d){
    if(kind==='lp-find')return landV12Action('lp-find-page',String(d));
    if(kind==='lp-my')return landV13Action('lp-my-page',String(d));
    if(kind==='lp-commute'){const total=Math.max(1,Math.ceil(landCommuteRows().length/Math.max(6,landPerPage()-2)));return step(()=>changePage('lpCommutePage',total,d));}
    if(kind==='lp-maker'){const total=Math.max(1,Math.ceil(landMakerList().length/Math.max(5,landPerPage()-1)));return step(()=>changePage('lpMakerPage',total,d));}
    if(kind==='lp-guide')return step(()=>{ui.lpGuidePage=Math.max(0,(ui.lpGuidePage||0)+d);});
    if(state.land.view!=='rank')return;
    if(kind==='lp-types'){
      const i=LAND_TYPES.findIndex(x=>x[0]===state.land.type),next=LAND_TYPES[(i+d+LAND_TYPES.length)%LAND_TYPES.length][0];
      return step(()=>{state.land.type=next;ui.lpPage=0;save();});
    }
    const total=Math.max(1,Math.ceil(landRows().length/landPerPage()));
    return step(()=>changePage('lpPage',total,d));
  }
  /* --- ハウスメーカー図鑑（2026年11月15日調査。坪単価は建物本体のみの目安） --- */
  const LAND_SRC={
    asuka:['ハウスメーカーの坪単価ランキング【2026年最新】主要18社（2026年7月時点・本体価格ベース）','https://asukafukushikai.com/fudousan/fudousan-housemaker-tsubotanka/'],
    iegatari:['家語 ハウスメーカー坪単価ランキング39社（2026年・見積り実績ベース）','https://iegatari.com/tsubo.html'],
    okayama:['ハウスメーカー坪単価ランキング28社【2026年10月】','https://www.okayama-taikyo.or.jp/column/1880/'],
    crexW:['ハウスメーカー保証期間を20社比較（家づくり比較なび）','https://crexgroup.com/ja/home-building/builder/house-maker-warranty-comparison/'],
    ouchi:['ハウスメーカー24社の保証一覧（2026年1月確認）','https://ouchicanvas.com/column/housemaker/guarantee.html'],
    okayamaW:['【2026年】ハウスメーカー保証ランキング','https://www.okayama-taikyo.or.jp/column/9653/'],
    crex12:['大手ハウスメーカー12社の特徴を一覧で比較','https://crexgroup.com/ja/home-building/builder/major-house-maker-comparison-selection/'],
    crex15:['大手ハウスメーカー15社を徹底比較','https://crexgroup.com/ja/home-building/builder/major-house-maker-comparison-guide/'],
    heroes:['ハウスメーカー坪単価一覧2026年版（マイホームヒーローズ）','https://myhome-heroes.com/articles/housemaker-tsubo-price-2026'],
    allaboutS:['積水ハウスの注文住宅とは？（All About）','https://allabout.co.jp/gm/gc/391783/'],
    allaboutD:['大和ハウス ジーヴォΣ（All About）','https://allabout.co.jp/gm/gc/390608/'],
    oriconY:['ヤマダホームズ（オリコン顧客満足度）','https://life.oricon.co.jp/rank-house-maker/company/sxl/'],
    crexCost:['注文住宅の総額と内訳（本体70〜80%・付帯15〜20%・諸費用5〜10%）','https://crexgroup.com/ja/home-building/cost/custom-home-total-cost-breakdown/'],
    crexAichi:['愛知の注文住宅でおすすめの工務店・ハウスメーカー30選（2025年）','https://crexgroup.com/ja/home-building/region/aichi-custom-home-builders/'],
    crexGifu:['岐阜のおすすめ工務店ランキング20選（2025年。岐阜県の坪単価相場は50万〜90万円程度）','https://crexgroup.com/ja/home-building/region/gifu-builder-ranking-guide/'],
    crex20:['ハウスメーカー坪単価ランキングTOP20（2025年）','https://crexgroup.com/ja/home-building/cost/house-maker-unit-price-ranking/'],
    crex40:['主要ハウスメーカー40社の比較一覧','https://crexgroup.com/ja/home-building/builder/house-maker-list-comparison/'],
    crexSF:['住友不動産の注文住宅の坪単価・評判（家づくり比較なび）','https://crexgroup.com/ja/home-building/builder/sumitomo-fudosan-reviews/'],
    oriconSF:['住友不動産ハウジング（オリコン顧客満足度 2026年 総合11位）','https://life.oricon.co.jp/rank-house-maker/company/sumitomo-rd/'],
    oriconSw:['スウェーデンハウス（オリコン顧客満足度 2026年 総合1位）','https://life.oricon.co.jp/rank-house-maker/company/swedenhouse/'],
    yamato:['ヤマト住建 最長60年保証のお知らせ（2025年1月）','https://yamatojk.co.jp/wordpress/wp-content/uploads/2024/12/release_60years_support.pdf'],
    iezukuri:['ハウスメーカー坪単価ランキング33社（2026年）','https://iezukuri.blog/housemaker-tsubotanka/']
  };
  // low/mid/high＝建物本体の坪単価（万円）。warranty＝構造・防水の初期保証／最長（条件・商品で変わる）
  const LAND_MAKERS=[
    {id:'sekisui',name:'積水ハウス',band:'ハイ',type:'鉄骨',struct:'鉄骨（外壁ダインコンクリート）／木造シャーウッド（陶板外壁ベルバーン）',low:110,mid:130,high:150,
      points:['業界最大手。鉄骨・木造の両方から選べる','自社製の外壁（ダインコンクリート・ベルバーン）で耐久性とデザイン性が高い','初期30年保証、点検とメンテナンスで建物がある限り延長できる'],
      cautions:['坪単価は最上位クラス。値上げが続いている','オプションで総額が大きく上がりやすい'],
      warranty:'初期30年／永年（延長条件あり）',fit:'予算に余裕があり、ブランド・デザイン・長期保証を重視する人',src:['asuka','iegatari','allaboutS','ouchi']},
    {id:'daiwa',name:'大和ハウス',band:'ハイ',type:'鉄骨',struct:'鉄骨 xevoΣ（ジーヴォシグマ）／木造 xevo GranWood',low:95,mid:115,high:135,
      points:['外張り断熱通気外壁で躯体を長持ちさせる','天井高2m72cmの大空間・大開口が得意','戸建てから商業施設まで手がける総合力'],
      cautions:['仕様を上げると大手の中でも高額になりやすい','商品・地域で価格差が大きい'],
      warranty:'初期30年／最長60年（延長条件あり）',fit:'広いリビング・高い天井など開放感を重視する人',src:['asuka','iegatari','crex12','allaboutD']},
    {id:'hebel',name:'ヘーベルハウス',band:'ハイ',type:'鉄骨',struct:'重量鉄骨＋ALCコンクリート「ヘーベル」',low:100,mid:120,high:140,
      points:['ALC外壁で耐火性・耐久性が非常に高い','重量鉄骨で地震に強く、3階建て・都市部の狭小地にも強い','60年間の無料点検など保証・点検が手厚い'],
      cautions:['坪単価は最上位クラス','外観は重厚系で、木の家の雰囲気は出しにくい'],
      warranty:'初期30年／最長60年（60年無料点検）',fit:'耐火・耐震・長く住める丈夫さを最優先する人',src:['asuka','crex12','okayamaW']},
    {id:'sumirin',name:'住友林業',band:'ハイ',type:'木造',struct:'木造ビッグフレーム（BF）構法',low:100,mid:120,high:140,
      points:['太い柱（ビッグコラム）で耐震性と間取りの自由度を両立','良質な木材をふんだんに使った高級感','愛知県の顧客満足度ランキングで上位'],
      cautions:['木造の中では最も高い価格帯','内装の木材グレードで総額が大きく変わる'],
      warranty:'初期30年／最長60年（延長条件あり）',fit:'木の質感・設計の自由度にこだわりたい人',src:['asuka','iegatari','crex15']},
    {id:'heim',name:'セキスイハイム',band:'ミドル上',type:'鉄骨',struct:'鉄骨ユニット工法（木造ユニットもあり）',low:85,mid:100,high:120,
      points:['工場で家の大部分をつくるユニット工法。品質が安定し工期が短い','太陽光発電・蓄電池の提案に強い','初期30年保証'],
      cautions:['ユニットの組み合わせのため間取りの自由度はやや低い','ユニットをクレーンで据え付けるため、道路や敷地の条件を確認'],
      warranty:'初期30年／最長60年（延長条件あり）',fit:'品質の安定・短い工期・太陽光を重視する人',src:['asuka','iegatari','crex15']},
    {id:'panahome',name:'パナソニック ホームズ',band:'ミドル上',type:'鉄骨',struct:'鉄骨（HS構法など）',low:90,mid:105,high:125,
      points:['全館空調など空気環境へのこだわり','汚れが落ちやすい光触媒タイル「キラテック」','パナソニックの設備・家電との連携'],
      cautions:['設備を充実させると高額になりやすい','保証期間は仕様（対象仕様）で変わる'],
      warranty:'構造35年・防水30年（対象仕様）／最長60年',fit:'空気・家事のしやすさ・メンテの少なさを重視する人',src:['asuka','crex12','okayamaW']},
    {id:'toyota',name:'トヨタホーム',band:'ミドル上',type:'鉄骨',struct:'鉄骨ユニット工法',low:80,mid:95,high:110,
      points:['自動車づくりの技術を生かした工場生産で品質が安定','ユニット工法で工期が短い','対象プランは業界最長クラスの初期40年保証'],
      cautions:['間取りはユニットの制約を受ける','40年保証は屋根材（陶器瓦）など条件付き'],
      warranty:'初期40年（対象プラン・陶器瓦の場合。標準30年）／最長60年',fit:'長い保証と品質の安定を重視する人',src:['asuka','iegatari','crexW','ouchi']},
    {id:'misawa',name:'ミサワホーム',band:'ミドル上',type:'木造',struct:'木質パネル接着工法（モノコック）／鉄骨',low:85,mid:100,high:115,
      points:['面で支えるモノコック構造で揺れに強い','大収納空間「蔵のある家」','グッドデザイン賞の受賞が多いシンプルなデザイン'],
      cautions:['パネル構造のため大きな間取り変更（リフォーム）がしにくい','仕様で価格差が大きい'],
      warranty:'初期35年／建物がある限り延長（条件あり）',fit:'収納をたっぷり取りたい、シンプルなデザインが好きな人',src:['asuka','iegatari','crex12','crexW']},
    {id:'mitsui',name:'三井ホーム',band:'ハイ',type:'木造',struct:'木造2×4（プレミアム・モノコック構法）',low:100,mid:120,high:145,
      points:['洋風・エレガントなデザインが得意','全館空調システムが人気','高い耐震・断熱性能'],
      cautions:['坪単価は最上位クラス','初期保証は他の大手より短め（20年・条件あり）'],
      warranty:'初期20年／最長60年（延長条件あり）',fit:'洋風デザインと全館空調の快適さを求める人',src:['asuka','iegatari','crex12','crexW']},
    {id:'ichijo',name:'一条工務店',band:'ミドル',type:'木造',struct:'木造2×6（ツインモノコック構造）',low:70,mid:85,high:100,
      points:['「家は、性能。」断熱・気密がトップクラス','全館床暖房・太陽光などが標準仕様に多い','愛知県の顧客満足度ランキングでも上位'],
      cautions:['設計の自由度は大手より低め（仕様が決まっている）','構造・防水の初期保証は10年（シロアリは30年）'],
      warranty:'初期10年／最長30年（シロアリ30年）',fit:'光熱費・冬の暖かさ・性能のコスパを重視する人',src:['asuka','heroes','crexW']},
    {id:'ai',name:'アイ工務店',band:'ミドル',type:'木造',struct:'木造軸組',low:65,mid:80,high:95,
      points:['1mm単位の自由設計','スキップフロア・吹き抜けなどの空間提案','「適質価格」でコストと性能のバランス型'],
      cautions:['標準仕様とオプションの範囲を確認','保証は初期20年・最長30年'],
      warranty:'初期20年／最長30年',fit:'自由設計で個性的な間取りを予算内で叶えたい人',src:['asuka','crexW']},
    {id:'sumifu',name:'住友不動産',band:'ミドル上',type:'木造',struct:'木造（ウッドパネル工法・2×4・2×6のモノコック構造）',low:65,mid:82,high:100,
      points:['グッドデザイン賞の常連。都会的で洗練されたデザイン（J・URBANなど）','食洗機付きキッチン・Low-E複層ガラス・浴室換気乾燥暖房機など標準設備のグレードが高い','耐震等級3が標準（プランや敷地で異なる場合あり）','商品：J・URBAN／J・RESIDENCE／PREMIANCE／World Design。愛知・岐阜にもモデルハウスあり'],
      cautions:['坪単価はやや高め。こだわるとオプション費用がかさみやすい','規格に近い設計で、間取りの自由度は低めという声','営業担当やアフター対応にばらつきがあるという声','保証延長は10年目・20年目の有料メンテナンスが条件'],
      warranty:'初期10年（最長60年：10年目・20年目に有料メンテナンス）',fit:'デザインと設備の良さを、大手の安心感の中で選びたい人',src:['crexSF','oriconSF','crex15']},
    {id:'yamada',name:'ヤマダホームズ',band:'ミドル',type:'木造',struct:'木造',low:60,mid:78,high:95,
      points:['ヤマダ電機グループ。家具・家電・照明をまとめやすい','住宅設備10年の無料メンテナンス','60年長期保証'],
      cautions:['商品で価格帯の幅が広い','標準仕様を必ず確認'],
      warranty:'最長60年（設備10年）',fit:'家電・家具まで含めて予算をまとめたい人',src:['asuka','okayama','iegatari','oriconY']},
    {id:'tama',name:'タマホーム',band:'ローコスト',type:'木造',struct:'木造軸組（在来工法）',low:50,mid:62,high:75,
      points:['ローコスト住宅の代表格。分かりやすい価格設定','国産材を使った標準仕様','長期優良住宅に対応'],
      cautions:['初期保証は法定どおりの10年','オプションを足すと価格差が縮まる'],
      warranty:'初期10年／最長60年（長期優良住宅の場合）',fit:'土地にお金をかけたい、建物は費用を抑えたい人',src:['asuka','okayama','crexW']},
    {id:'aqura',name:'アキュラホーム',band:'ローコスト',type:'木造',struct:'木造軸組',low:60,mid:72,high:88,
      points:['大空間・大開口の自由設計','コストを抑えた適正価格','構造30年・防水20年の保証'],
      cautions:['仕様で価格帯の幅が広い','標準仕様を確認'],
      warranty:'構造30年・防水20年／延長可',fit:'価格を抑えつつ広い空間をつくりたい人',src:['okayama','heroes','okayamaW']},
    {id:'clever',name:'クレバリーホーム',band:'ローコスト',type:'木造',struct:'木造（プレミアム・ハイブリッド構法）',low:62,mid:72,high:82,
      points:['外壁タイルが標準でメンテナンス費を抑えやすい','耐震性の高い独自構法','フランチャイズで地域の会社が施工'],
      cautions:['施工会社（加盟店）によって対応が違う','保証内容は加盟店ごとに要確認'],
      warranty:'要確認（加盟店による）',fit:'外壁の塗り替え費用を減らしたい人',src:['asuka','okayama']},
    {id:'hinoki',name:'桧家住宅',band:'ミドル',type:'木造',struct:'木造軸組',low:70,mid:80,high:90,
      points:['全館空調「Z空調」で家じゅう快適','コストと設備のバランス型','提案型の商品が多い'],
      cautions:['全館空調は電気代・メンテ費も確認','保証内容は要確認'],
      warranty:'要確認',fit:'全館空調を予算内で入れたい人',src:['asuka','okayama']}
  ];
  // 全国系の追加と、愛知・岐阜の地元工務店（2026年11月15日調査）
  const LAND_LOCAL_CAUTIONS=['施工エリアは会社ごとに限られる（要確認）','保証・アフターの内容は会社ごとに確認'];
  LAND_MAKERS.push(
    {id:'sweden',name:'スウェーデンハウス',band:'ハイ',type:'木造',struct:'木質パネル一体構法',low:90,mid:105,high:120,
      points:['高気密・高断熱と木製サッシの北欧住宅','オリコンの注文住宅ランキングで2026年まで12年連続の総合1位','50年間の無料定期検診'],
      cautions:['坪単価は高め','北欧デザインが基本で、和風・モダンは得意分野外'],warranty:'長期アフターサポート（50年間無料定期検診）',fit:'冬の暖かさと北欧デザインが好きな人',src:['asuka','crex15','okayamaW','oriconSw']},
    {id:'mitsubishi',name:'三菱地所ホーム',band:'ハイ',type:'木造',struct:'木造2×4',low:95,mid:115,high:135,
      points:['注文住宅の完全自由設計','全館空調の提案に強い','都市部の高級住宅に実績'],
      cautions:['坪単価は最上位クラス','展示場が少ない地域がある'],warranty:'要確認',fit:'自由設計と全館空調の快適さを重視する人',src:['asuka','iezukuri']},
    {id:'nihonhouse',name:'日本ハウスHD',band:'ミドル',type:'木造',struct:'木造軸組（檜の構造材）',low:70,mid:85,high:100,
      points:['構造材に檜（ひのき）を使う木の家','制震装置が標準','グッドデザイン賞の受賞あり'],
      cautions:['和の雰囲気が中心','保証内容は要確認'],warranty:'要確認',fit:'国産の檜で和の家を建てたい人',src:['crexAichi','iezukuri']},
    {id:'muji',name:'無印良品の家',band:'ミドル',type:'木造',struct:'木造（SE構法）・木造軸組',low:70,mid:85,high:100,
      points:['シンプルで機能的な無印良品のデザイン','「永く使える、変えられる」がコンセプト','大空間・大きな窓'],
      cautions:['間取りは一室空間が基本','施工は地域の加盟会社'],warranty:'要確認',fit:'シンプルな一室空間の家が好きな人',src:['crex40']},
    {id:'yamato',name:'ヤマト住建',band:'ミドル',type:'木造',struct:'木造',low:65,mid:78,high:90,
      points:['高断熱・高気密と耐震性を両立（ZEH基準が標準）','断熱等級7相当の商品（LEGANTIA）がある','2025年から最長60年保証'],
      cautions:['商品ごとに断熱仕様が違う','東海の展示場数は要確認'],warranty:'初期20年（構造・地盤は30年目まで無償延長）／最長60年',fit:'性能を予算内で高くしたい人',src:['heroes','crex12','yamato']},
    {id:'aiful',name:'アイフルホーム',band:'ローコスト',type:'木造',struct:'木造（テクノスター金物）',low:55,mid:65,high:75,
      points:['LIXILグループのフランチャイズ','子ども目線のキッズデザイン','LIXILの設備を採用しやすい'],
      cautions:['施工は地域の加盟店で対応に差','標準仕様を確認'],warranty:'要確認（加盟店による）',fit:'子育てしやすい家を予算内で建てたい人',src:['crex20','okayama']},
    {id:'universal',name:'ユニバーサルホーム',band:'ローコスト',type:'木造',struct:'木造（ハイパーフレーム構法）',low:55,mid:68,high:80,
      points:['地熱床システム（1階全室床暖房）','ALC外壁材','フランチャイズで地域密着'],
      cautions:['施工は地域の加盟店','初期保証は10年'],warranty:'初期10年',fit:'床暖房付きの家を手頃に建てたい人',src:['crex20','okayama','crexW']},
    {id:'aida',name:'アイダ設計',band:'ローコスト',type:'木造',struct:'木造軸組',low:40,mid:52,high:65,
      points:['坪単価40万円台から建てられる代表的なローコスト住宅','自社一貫の設計・施工','規格プランで価格が分かりやすい'],
      cautions:['標準仕様の確認が必須','オプション追加で価格が上がりやすい'],warranty:'要確認',fit:'建物費用をできるだけ抑えたい人',src:['asuka','okayama']},
    {id:'clasis',name:'クラシスホーム',band:'地元',area:'愛知',hq:'愛知県',type:'木造',struct:'木造',low:60,mid:75,high:90,
      points:['デザインと自由設計で愛知での実績が多い','自社のプレカット工場','愛知県内に複数の展示場'],cautions:LAND_LOCAL_CAUTIONS,warranty:'要確認',fit:'愛知で地元の会社とデザインにこだわりたい人',src:['crexAichi']},
    {id:'rgallery',name:'アールギャラリー（アールプランナー）',band:'地元',area:'愛知',hq:'愛知県',type:'木造',struct:'木造',low:60,mid:75,high:90,
      points:['デザイン住宅を手の届く価格で','耐震等級3・高断熱が標準','自社の建築士が設計'],cautions:LAND_LOCAL_CAUTIONS,warranty:'要確認',fit:'おしゃれなデザインと性能を両方ほしい人',src:['crexAichi']},
    {id:'zensho',name:'善匠',band:'地元',area:'愛知・岐阜',hq:'愛知県（尾張）',type:'木造',struct:'木造',low:60,mid:75,high:90,
      points:['デザイン住宅ブランド「G-Style」','長期優良住宅が標準・耐震等級3','岐阜県でも展開'],cautions:LAND_LOCAL_CAUTIONS,warranty:'要確認（長期優良住宅仕様）',fit:'シンプルモダンなどデザイン重視の人',src:['crexAichi','crexGifu']},
    {id:'niken',name:'ニケンハウジング',band:'地元',area:'愛知',hq:'名古屋市',type:'木造',struct:'木造',low:70,mid:85,high:100,
      points:['建築家とつくる高性能なデザイン住宅','パッシブデザイン','断熱・気密の数値（UA値・C値）を公開'],cautions:LAND_LOCAL_CAUTIONS,warranty:'要確認',fit:'建築家の設計と数字で分かる性能を求める人',src:['crexAichi']},
    {id:'bluehouse',name:'ブルーハウス',band:'地元',area:'愛知',hq:'豊橋市',type:'木造',struct:'木造',low:70,mid:85,high:100,
      points:['性能とデザインの注文住宅','耐震等級3','断熱はHEAT20 G2が標準'],cautions:LAND_LOCAL_CAUTIONS,warranty:'要確認',fit:'東三河で高性能な家を建てたい人',src:['crexAichi']},
    {id:'architecs',name:'アーキテックス',band:'地元',area:'愛知',hq:'一宮市',type:'木造',struct:'木造',low:50,mid:65,high:80,
      points:['規格住宅から完全自由設計まで','箱型の規格住宅「ZERO-CUBE」','尾張エリアの会社'],cautions:LAND_LOCAL_CAUTIONS,warranty:'要確認',fit:'規格住宅で費用を抑えたい人',src:['crexAichi']},
    {id:'okazaki',name:'オカザキホーム',band:'地元',area:'愛知',hq:'岡崎市',type:'木造',struct:'木造（国産ひのき）',low:50,mid:65,high:80,
      points:['国産ひのきの家','60年以上の歴史','西三河の地元工務店'],cautions:LAND_LOCAL_CAUTIONS,warranty:'要確認',fit:'西三河で木の家を手頃に建てたい人',src:['crexAichi']},
    {id:'gyokuzen',name:'玉善',band:'地元',area:'愛知',hq:'名古屋市',type:'木造',struct:'木造',low:60,mid:75,high:90,
      points:['狭い土地の都市型住宅が得意','3階建て・ビルトインガレージ','名古屋市の会社'],cautions:LAND_LOCAL_CAUTIONS,warranty:'要確認',fit:'名古屋市内の狭い土地に建てたい人',src:['crexAichi']},
    {id:'chubujuken',name:'中部住研',band:'地元',area:'愛知',hq:'豊田市',type:'木造',struct:'木造',low:60,mid:75,high:90,
      points:['完全自由設計・フルオーダー','自然素材','三河の地元工務店'],cautions:LAND_LOCAL_CAUTIONS,warranty:'要確認',fit:'自然素材でこだわりの家を建てたい人',src:['crexAichi']},
    {id:'nomura',name:'野村工務店',band:'地元',area:'愛知',hq:'安城市',type:'木造',struct:'木造（SE構法・重量木骨）',low:70,mid:85,high:100,
      points:['「重量木骨の家」（SE構法）','1棟ごとに構造計算','大空間・大開口がつくりやすい'],cautions:LAND_LOCAL_CAUTIONS,warranty:'要確認',fit:'木造で大空間と耐震性を両立したい人',src:['crexAichi']},
    {id:'fujiken',name:'フジケン',band:'地元',area:'愛知',hq:'岡崎市・安城市',type:'木造',struct:'木造',low:50,mid:65,high:80,
      points:['注文住宅と不動産をワンストップ','「F-STYLE」「F-CUBE」','西三河の総合企業'],cautions:LAND_LOCAL_CAUTIONS,warranty:'要確認',fit:'西三河で土地探しから任せたい人',src:['crexAichi']},
    {id:'marunana',name:'丸七ホーム',band:'地元',area:'愛知',hq:'春日井市',type:'木造',struct:'木造（外断熱）',low:70,mid:85,high:100,
      points:['外断熱と自然素材の健康住宅','40年以上の実績','尾張の地元工務店'],cautions:LAND_LOCAL_CAUTIONS,warranty:'要確認',fit:'自然素材と外断熱の快適さを重視する人',src:['crexAichi']},
    {id:'watanabe',name:'渡邊工務店',band:'地元',area:'愛知',hq:'弥富市',type:'木造',struct:'木造（伝統の手刻み）',low:70,mid:85,high:100,
      points:['創業110年以上','天然木・国産材の伝統工法','自社の製材・プレカット工場'],cautions:LAND_LOCAL_CAUTIONS,warranty:'要確認',fit:'伝統的な木の家を建てたい人',src:['crexAichi']},
    {id:'yamaka',name:'ヤマカ木材',band:'地元',area:'岐阜',hq:'岐阜県',type:'木造',struct:'木造（ストロングストラクチャー工法・W断熱）',low:50,mid:70,high:90,est:true,
      points:['創業70年以上の木材のプロ','自社プレカット工場で県産材を活用','W断熱と耐震の独自工法'],cautions:['坪単価は記事に記載なし（岐阜県の相場を仮に表示）'].concat(LAND_LOCAL_CAUTIONS),warranty:'要確認',fit:'岐阜の木材で性能の良い家を建てたい人',src:['crexGifu']},
    {id:'shinwa',name:'新和建設',band:'地元',area:'岐阜',hq:'東濃中心',type:'木造',struct:'木造（伝統的な木造建築）',low:50,mid:70,high:90,est:true,
      points:['東濃ひのきなど地元の木材','自社で大工を育成','東濃エリア中心'],cautions:['坪単価は記事に記載なし（岐阜県の相場を仮に表示）'].concat(LAND_LOCAL_CAUTIONS),warranty:'要確認',fit:'多治見・東濃で地元の大工に建ててほしい人',src:['crexGifu']},
    {id:'hidamari',name:'ひだまりほーむ',band:'地元',area:'岐阜',hq:'岐阜県',type:'木造',struct:'木造（自然素材）',low:50,mid:70,high:90,est:true,
      points:['東濃ひのきなど県産の自然素材','高気密・高断熱に注力','岐阜の気候に合わせた家づくり'],cautions:['坪単価は記事に記載なし（岐阜県の相場を仮に表示）'].concat(LAND_LOCAL_CAUTIONS),warranty:'要確認',fit:'自然素材で暖かい家を建てたい人',src:['crexGifu']}
  );
  for(const m of LAND_MAKERS){m.area=m.area||'全国';}
  const LAND_REGION_NOTES={
    '名古屋市':'2026年の地価公示（住宅地）は+3.1%で、全16区で上昇。都心に近い区ほど高く、郊外の区は手が届きやすい。',
    '尾張':'2026年の地価公示（住宅地）は+1.7%。名古屋に接する東部・北部が高く、西部は比較的手頃。',
    '知多':'2026年の地価公示（住宅地）は+1.2%。名古屋寄りの市が高く、半島の南部は安い。',
    '西三河':'2026年の地価公示（住宅地）は+1.4%。鉄道沿線の市が高い。',
    '東三河':'2026年の地価公示（住宅地）は−0.2%で、県内で唯一の下落。価格は手頃。',
    '東濃':'2026年の地価公示（住宅地）は多治見市+0.3%・瑞浪市+0.4%・恵那市+0.2%。多治見駅に近い音羽町は岐阜県で上昇率2位。',
    '中濃':'2026年の地価公示（住宅地）は美濃加茂市+0.1%。名古屋への通勤圏で、価格は手頃。'
  };
  const LAND_COND_NOTES={
    dist:'駅に近いほど高い。徒歩10分（約800m）が分かれ目の目安。',
    dir:'一般には南道路が日当たりで人気・割高、北道路は割安と言われる。ただし標準地のデータでは差は小さい。',
    corner:'角地は開放感があり、相続税の評価でも加算される。ただし標準地は典型的な土地が選ばれるため例が少なく、データの差は参考。',
    road:'4m未満の道路に面する土地は、建て替え時に道路の中心から2m下がる「セットバック」が必要で、使える面積が減る。',
    zone:'低層住居専用は静かだが店が少ない。中高層・住居地域は便利で高め。',
    area:'広い土地ほど総額が大きくなるため、坪単価は下がりやすい。',
    flag:'旗竿地（細い通路の奥に敷地がある土地）は、近隣の相場より安く買えることが多い。日当たり・車の出し入れ・工事車両の入りやすさを確認。'
  };
  /* ===== 地価調べ君：相場シミュレーター・メーカー図鑑・土地ガイド（r76） ===== */
  const LAND_VIEWS=[['rank','順位'],['map','地図'],['compare','比較'],['sim','相場'],['commute','通勤'],['advice','お金'],['find','予算から探す'],['maker','メーカー'],['guide','土地']];
  const LAND_NAV=[['rank','ランキング','🏆'],['map','地図','🗺️'],['compare','候補','⭐'],['calc','計算','🧮'],['learn','知る','📖']];
  const landGroup=v=>['sim','commute','advice','find'].includes(v)?'calc':['maker','guide'].includes(v)?'learn':v;
  const LAND_EXTRA_RATE=0.25,LAND_COST_RATE=0.10;
  const LAND_REGION_FILTER={'名古屋市':'nagoya','尾張':'owari','知多':'chita','西三河':'nishi','東三河':'higashi','東濃':'gifu','中濃':'gifu'};
  const landDirGroup=d=>!d?null:/南/.test(d)?'南':/北/.test(d)?'北':d==='東'?'東':d==='西'?'西':null;
  const landMedian=xs=>{const v=xs.filter(Number.isFinite).sort((a,b)=>a-b);if(!v.length)return null;const m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2;};
  let landCityAvgCache={data:null,map:null};
  function landResPoints(){return (landData?.points||[]).filter(p=>p.use==='住宅地');}
  function landCityAvgMap(){
    if(landCityAvgCache.data===landData)return landCityAvgCache.map;
    const m=new Map();
    for(const p of landResPoints()){const a=m.get(p.cityCode)||[0,0];a[0]+=p.priceSqm;a[1]++;m.set(p.cityCode,a);}
    landCityAvgCache={data:landData,map:m};
    return m;
  }
  function landSimDefaults(){return {city:'',dist:'any',dir:'any',corner:'any',zone:'any',road:'any',landTsubo:50,floorTsubo:35,maker:'avg',grade:'mid',mode:'cond',budgetMan:5300,landPct:27};}
  function landSimNormalize(x){
    const d=landSimDefaults();x=x&&typeof x==='object'?x:{};
    const pick=(k,list)=>list.includes(String(x[k]))?String(x[k]):d[k];
    const clamp=(k,lo,hi)=>{const n=Number(x[k]);return Number.isFinite(n)?Math.min(hi,Math.max(lo,Math.round(n*10)/10)):d[k];};
    return {city:typeof x.city==='string'&&/^\d{5}$/.test(x.city)?x.city:'',dist:pick('dist',['any','500','1000','2000']),
      dir:pick('dir',['any','南','東','西','北']),corner:pick('corner',['any','yes','no']),
      zone:pick('zone',['any','低層住居','中高層住居','住居']),road:pick('road',['any','4','6']),
      landTsubo:clamp('landTsubo',10,500),floorTsubo:clamp('floorTsubo',10,200),
      maker:typeof x.maker==='string'&&(x.maker==='avg'||/^[a-z]+$/.test(x.maker))?x.maker:'avg',grade:pick('grade',['low','mid','high']),
      mode:pick('mode',['cond','budget']),budgetMan:Math.round(clamp('budgetMan',500,30000)),landPct:Math.round(clamp('landPct',5,70))};
  }
  function landSimCity(){
    const S=state.land.sim;
    return landCity(S.city)||landCity(state.land.favorites[0])||landCity('21204')||(landData?.cities||[])[0]||null;
  }
  function landMakerById(id){return LAND_MAKERS.find(m=>m.id===id)||null;}
  function landMakerAvg(){
    const avg=k=>Math.round(LAND_MAKERS.reduce((a,m)=>a+m[k],0)/LAND_MAKERS.length);
    return {id:'avg',name:LAND_MAKERS.length+'社の平均',low:avg('low'),mid:avg('mid'),high:avg('high')};
  }
  function landSimCalc(){
    const S=state.land.sim,c=landSimCity();
    if(!c)return null;
    const all=landResPoints(),avg=landCityAvgMap();
    const match=p=>(S.dist==='any'||(p.dist!=null&&p.dist<=Number(S.dist)))&&(S.dir==='any'||landDirGroup(p.dir)===S.dir)&&
      (S.corner==='any'||(S.corner==='yes'?p.side===true:p.side===false))&&(S.zone==='any'||p.zone===S.zone)&&
      (S.road==='any'||(p.road!=null&&p.road>=Number(S.road)));
    const filtered=['dist','dir','corner','zone','road'].some(k=>S[k]!=='any');
    const cityPts=all.filter(p=>p.cityCode===c.code);
    const cityMedian=landMedian(cityPts.map(p=>p.priceSqm))||c.residential?.all?.avgSqm||null;
    const ratioOf=pts=>{const r=pts.map(p=>{const a=avg.get(p.cityCode);return a&&a[1]>=3?p.priceSqm/(a[0]/a[1]):null;}).filter(Number.isFinite);return r.length>=3?{r:r.reduce((x,y)=>x+y,0)/r.length,n:r.length}:null;};
    let sqm=cityMedian,how='市区町村の住宅地'+cityPts.length+'地点の中央値',n=cityPts.length,estimated=false;
    if(filtered){
      const hit=cityPts.filter(match);
      if(hit.length>=3){sqm=landMedian(hit.map(p=>p.priceSqm));how='条件に合う'+hit.length+'地点の中央値';n=hit.length;}
      else{
        const cityAvg=avg.get(c.code),base=cityAvg?cityAvg[0]/cityAvg[1]:cityMedian;
        const regionHit=ratioOf(all.filter(p=>landCity(p.cityCode)?.region===c.region&&match(p)));
        const allHit=regionHit||ratioOf(all.filter(match));
        if(allHit&&base){sqm=base*allHit.r;how=(regionHit?c.region:'全域')+'の似た条件'+allHit.n+'地点の傾向から推計';n=allHit.n;estimated=true;}
        else how='条件に合う地点が少ないため、市区町村全体の中央値';
      }
    }
    const maker=S.maker==='avg'?landMakerAvg():(landMakerById(S.maker)||landMakerAvg());
    const unitMan=maker[S.grade]||maker.mid;
    let land,body,extra,cost,total,landCan=null,floorCan=null;
    if(S.mode==='budget'){
      total=S.budgetMan*10000;const net=total/(1+LAND_COST_RATE);cost=total-net;
      land=net*S.landPct/100;const build=net-land;body=build/(1+LAND_EXTRA_RATE);extra=build-body;
      landCan=sqm?land/(sqm*LAND_TSUBO):null;floorCan=body/(unitMan*10000);
    }else{
      land=sqm?sqm*LAND_TSUBO*S.landTsubo:null;
      body=unitMan*10000*S.floorTsubo;extra=body*LAND_EXTRA_RATE;
      cost=((land||0)+body+extra)*LAND_COST_RATE;
      total=(land||0)+body+extra+cost;
    }
    const pct=(land||0)+body+extra>0?(land||0)/((land||0)+body+extra)*100:null;
    const b=landBudget(),budget=b.purchase>0?b.purchase*10000:null;
    const grade=budget===null?null:total<=budget?2:total<=budget*1.1?1:0;
    return {c,sqm,how,n,estimated,maker,unitMan,land,body,extra,cost,total,budget,grade,fromFp:b.fromFp,mode:S.mode,landCan,floorCan,pct};
  }
  function landSelect(key,value,opts,label){
    return '<label class="lp-sim-field"><span>'+label+'</span><select data-lp-sim="'+key+'">'+opts.map(([v,l])=>'<option value="'+esc(v)+'"'+(String(value)===String(v)?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select></label>';
  }
  function landSimScreen(){
    const S=state.land.sim,r=landSimCalc();
    if(!r)return '<div class="lp-empty"><strong>データを読み込み中です</strong></div>';
    const cityOpts=LAND_REGION_ORDER.map(region=>{
      const cs=(landData?.cities||[]).filter(c=>c.region===region);
      return cs.length?'<optgroup label="'+esc(region)+'">'+cs.map(c=>'<option value="'+esc(c.code)+'"'+(c.code===r.c.code?' selected':'')+'>'+esc(c.name)+'</option>').join('')+'</optgroup>':'';
    }).join('');
    const num=(key,label,unit)=>'<label class="lp-sim-field"><span>'+label+'</span><span class="lp-sim-num"><input type="number" inputmode="decimal" min="10" max="500" step="1" data-lp-sim="'+key+'" value="'+esc(S[key])+'"><i>'+unit+'</i></span></label>';
    const makerOpts=[['avg',LAND_MAKERS.length+'社の平均（'+landMakerAvg().low+'〜'+landMakerAvg().high+'万）']].concat(LAND_MAKERS.slice().sort((a,b)=>a.mid-b.mid).map(m=>[m.id,(m.area!=='全国'?'［地元］':'')+m.name+'（'+m.low+'〜'+m.high+'万'+(m.est?'・仮':'')+'）']));
    const bar=(label,v,cls)=>'<div class="lp-sim-row"><span>'+label+'</span><i class="lp-sim-bar '+cls+'" style="--w:'+(r.total?Math.max(2,Math.round(v/r.total*100)):0)+'%"></i><b>'+landMan(v)+'</b></div>';
    const budget=S.mode==='budget';
    const condKeys=['dist','zone','dir','road','corner'],condOn=condKeys.filter(k=>S[k]!=='any').length;
    const condSel={dist:()=>landSelect('dist',S.dist,[['any','指定なし'],['500','500m以内'],['1000','1km以内'],['2000','2km以内']],'駅からの距離'),
      zone:()=>landSelect('zone',S.zone,[['any','指定なし'],['低層住居','低層住居（静か）'],['中高層住居','中高層住居'],['住居','住居地域']],'用途地域'),
      dir:()=>landSelect('dir',S.dir,[['any','指定なし'],['南','南'],['東','東'],['西','西'],['北','北']],'前面道路の向き'),
      road:()=>landSelect('road',S.road,[['any','指定なし'],['4','4m以上'],['6','6m以上']],'前面道路の幅'),
      corner:()=>landSelect('corner',S.corner,[['any','指定なし'],['yes','角地・二方道路'],['no','一方道路']],'角地')};
    const condBlock=ui.lpSimMore?condKeys.map(k=>condSel[k]()).join('')+'<button class="lp-cond-toggle lp-sim-wide" data-act="lp-sim-more">土地の条件をとじる ▴</button>':
      '<button class="lp-cond-toggle lp-sim-wide'+(condOn?' is-on':'')+'" data-act="lp-sim-more">土地の条件（駅・用途地域・道路・角地）：'+(condOn?condOn+'件指定':'指定なし')+' ▾</button>';
    const net=r.total/(1+LAND_COST_RATE),needPct=r.sqm?Math.round(r.sqm*LAND_TSUBO*S.landTsubo/net*100):null;
    const modeSeg='<div class="lp-sub">'+landSeg('lp-sim-mode',S.mode,[['cond','広さから総額を出す'],['budget','予算を土地と建物に分ける']],'lp-seg-fill')+'</div>';
    if(budget)return modeSeg+'<div class="lp-sim">'+
      '<div class="lp-sim-form">'+
        '<label class="lp-sim-field"><span>市区町村</span><select data-lp-sim="city">'+cityOpts+'</select></label>'+
        '<label class="lp-sim-field"><span>総予算（諸費用込み）</span><span class="lp-sim-num"><input type="number" inputmode="numeric" min="500" max="30000" step="100" data-lp-sim="budgetMan" value="'+esc(S.budgetMan)+'"><i>万円</i></span></label>'+
        condBlock+landSizeHint()+
        '<div class="lp-sim-field lp-sim-wide"><span>予算をどう分ける？（東海では土地に約3割が平均）</span><div class="lp-pct-presets">'+[[40,'🚉','場所重視','駅近・便利な所'],[27,'⚖️','ふつう','東海の平均'],[18,'🏠','家重視','広い家・良い会社']].map(([v,ic,t,d])=>'<button class="'+(Math.abs(S.landPct-v)<=2?'active':'')+'" data-act="lp-ratio-fit" data-value="'+v+'"><span>'+ic+'</span><b>'+t+'</b><small>'+d+'</small></button>').join('')+'</div></div>'+
        (ui.lpPctFine?'<label class="lp-sim-field lp-sim-wide lp-pct-fine"><span>細かく調整（土地 '+S.landPct+'%）</span><input class="lp-range-input" type="range" min="5" max="70" step="1" data-lp-sim="landPct" value="'+S.landPct+'" aria-label="土地の割合">'+landRatioBar(S.landPct)+'</label>':'<button class="lp-cond-toggle lp-sim-wide" data-act="lp-pct-fine">いまは 土地'+S.landPct+'%・建物'+(100-S.landPct)+'%　細かく調整する ▾</button>')+
        '<label class="lp-sim-field lp-sim-wide"><span>ハウスメーカー（建物本体の坪単価）</span><select data-lp-sim="maker">'+makerOpts.map(([v,l])=>'<option value="'+esc(v)+'"'+(S.maker===v?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select></label>'+
        '<div class="lp-sim-field lp-sim-wide"><span>仕様のグレード</span>'+landSeg('lp-sim-grade',S.grade,[['low','下限 '+r.maker.low+'万'],['mid','目安 '+r.maker.mid+'万'],['high','上限 '+r.maker.high+'万']],'lp-seg-fill')+'</div>'+
      '</div>'+
      '<div class="lp-sim-result">'+
        '<div class="lp-sim-total"><div><span>この予算で買える・建てられる広さ</span><strong>土地 '+(r.landCan!=null?Math.round(r.landCan):'—')+'<small>坪</small>・建物 '+Math.round(r.floorCan)+'<small>坪</small></strong></div></div>'+landSimMonthly(r.total)+
        '<p class="lp-sim-unit">土地 <b>'+landPriceHtml(r.sqm,{unit:'tsubo',small:false})+'</b>（'+esc(r.how)+(r.estimated?'<i class="lp-ref">推計</i>':'')+'）</p>'+
        bar('土地代（約'+(r.landCan!=null?Math.round(r.landCan):'—')+'坪）',r.land,'land')+
        bar('建物本体（約'+Math.round(r.floorCan)+'坪×'+r.unitMan+'万）',r.body,'body')+
        bar('付帯工事25%＋諸費用10%',r.extra+r.cost,'extra')+
        (()=>{const z=landSizeCalc(),ls=landTb(z.site),fs=landTb(z.floor);return r.landCan!=null&&r.landCan<ls?'<p class="lp-sim-warn">土地が目安（'+ls+'坪）より狭い。割合を上げるか、安いエリアを検討。</p>':r.floorCan<fs-3?'<p class="lp-sim-warn">建物が目安（'+fs+'坪）より狭い。土地の割合を下げるか予算を見直し。</p>':'';})()+
        (needPct!=null&&Math.abs(needPct-S.landPct)>=2&&needPct<=70?'<button class="lp-sim-commute" data-act="lp-ratio-fit" data-value="'+needPct+'">希望の土地'+S.landTsubo+'坪なら土地の割合は'+needPct+'% → 合わせる ›</button>':'')+
      '</div>'+
      '<p class="lp-sim-note">総予算から諸費用10%を引き、残りを土地と建物（本体＋付帯工事25%）に分けて計算。</p></div>';
    return modeSeg+'<div class="lp-sim">'+
      '<div class="lp-sim-form">'+
        '<label class="lp-sim-field"><span>市区町村</span><select data-lp-sim="city">'+cityOpts+'</select></label>'+
        num('landTsubo','土地の広さ','坪')+num('floorTsubo','建物の延床','坪')+landSizeHint()+
        condBlock+
        '<label class="lp-sim-field lp-sim-wide"><span>ハウスメーカー（建物本体の坪単価）</span><select data-lp-sim="maker">'+makerOpts.map(([v,l])=>'<option value="'+esc(v)+'"'+(S.maker===v?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select></label>'+
        '<div class="lp-sim-field lp-sim-wide"><span>仕様のグレード</span>'+landSeg('lp-sim-grade',S.grade,[['low','下限 '+r.maker.low+'万'],['mid','目安 '+r.maker.mid+'万'],['high','上限 '+r.maker.high+'万']],'lp-seg-fill')+'</div>'+
      '</div>'+
      '<div class="lp-sim-result">'+
        '<div class="lp-sim-total"><div><span>総額の目安</span><strong>'+landMan(r.total)+'</strong>'+(r.pct!=null?'<em class="lp-sim-pct">このうち土地は'+Math.round(r.pct)+'%（東海の平均は約'+LAND_TOKAI_PCT+'%）</em>':'')+'</div>'+
          (r.grade===null?'<button class="lp-mini" data-act="lp-settings">予算を設定</button>':'<div class="lp-sim-judge"><span class="rating-face '+faceClass(r.grade)+'">'+mark(r.grade)+'</span><small>'+'予算'+' '+landMan(r.budget)+'</small></div>')+'</div>'+landSimMonthly(r.total)+
        '<p class="lp-sim-unit">土地 <b>'+landPriceHtml(r.sqm,{unit:'tsubo',small:false})+'</b>（'+esc(r.how)+(r.estimated?'<i class="lp-ref">推計</i>':'')+'）</p>'+
        bar('土地代（'+S.landTsubo+'坪）',r.land,'land')+
        bar('建物本体（'+S.floorTsubo+'坪×'+r.unitMan+'万）',r.body,'body')+
        bar('付帯工事25%＋諸費用10%',r.extra+r.cost,'extra')+
        (landHasWork()?(()=>{const cm=landCommute(landCentroids().get(r.c.code));return cm?'<button class="lp-sim-commute" data-act="lp-view" data-value="commute">通勤 '+esc(landCommuteText(cm))+'・'+landYenText(cm.net)+'/月 → '+state.land.commute.years+'年で'+landMan(cm.total)+' ›</button>':'';})():'<button class="lp-sim-commute" data-act="lp-commute-settings">勤務先を入れると通勤費も計算 ›</button>')+
      '</div>'+
      '<p class="lp-sim-note">土地は地価公示・地価調査（鑑定評価の標準価格）。坪単価は各社の比較記事の目安で、見積もりとは異なります。</p></div>';
  }
  /* ===== メーカーの性能・仕様（r83） ===== */
  // s:耐震 d:制震・免震 i:断熱等級 ua:UA値 a:気密測定('all'全棟/'some'測定・公表) h:冷暖房・設備 w:外壁・耐久 k:工期 l:長期優良住宅 y:初期保証(年)
  const LAND_SPEC={
    sekisui:{s:3,d:'制震「シーカス」（鉄骨）',i:6,ua:0.46,w:'ダインコンクリート（鉄骨）／陶版外壁ベルバーン（木造）',l:1},
    daiwa:{s:3,d:'エネルギー吸収型耐力壁「D-NΣQST」',i:6,ua:0.49,w:'外張り断熱通気外壁',l:1},
    hebel:{s:3,d:'制震フレーム「ハイパワードクロス」',i:6,ua:0.46,w:'ALCコンクリート「ヘーベル」：耐火性・耐久性が非常に高い',l:1},
    sumirin:{s:3,d:'地震エネルギー吸収パネル・きづれパネル',i:6,ua:0.41,l:1},
    heim:{s:3,d:'制震「GAIASS（ガイアス）」',i:6,ua:0.35,a:'some',h:'全館空調「快適エアリー」',k:'短い（工場で8割をつくる）',l:1},
    panahome:{s:3,d:'制震「パワテック」',i:6,ua:0.38,h:'全館空調「エアロハス」',w:'光触媒タイル「キラテック」（汚れが落ちやすい）',l:1},
    toyota:{s:3,d:'パワースケルトン・T4システム',i:5,ua:0.52,k:'短い（工場生産）',y:30,l:1},
    misawa:{s:3,d:'制震装置「MGEO（エムジオ）」',i:6,ua:0.48,l:1},
    mitsui:{s:3,d:'制震デバイス「G-WALL」',i:6,ua:0.43,h:'全館空調「スマートブリーズ」',l:1},
    ichijo:{s:3,d:'免震住宅も選べる',i:7,ua:0.25,a:'all',h:'全館床暖房が標準・大容量の太陽光',l:1},
    ai:{s:3,d:'2.5倍耐力壁・剛床',i:6},
    sumifu:{s:3,d:'制震「パワーコラム」（オプション）',i:5,h:'アルミ樹脂複合サッシ＋Low-E複層ガラス、食洗機付きキッチン、浴室換気乾燥暖房機が標準',l:0},
    yamada:{s:3,d:'制震「SxLシグマデバイス」',i:6},
    tama:{s:3,d:'耐力面材・ベタ基礎',i:6,l:1},
    aqura:{i:6,h:'「超断熱の家」の商品あり'},
    clever:{s:3,d:'プレミアム・ハイブリッド構法',i:6,w:'外壁タイルが標準（塗り替えが少ない）'},
    hinoki:{i:6,h:'全館空調「Z空調」・吹付け断熱「アクアフォーム」'},
    sweden:{s:3,d:'制震なしで震度6以上の加振19回でも構造損傷なし（実験）',i:7,ua:0.28,a:'all',w:'木製サッシ・3層ガラス'},
    mitsubishi:{h:'全館空調「エアロテック」'},
    nihonhouse:{d:'制震装置が標準'},
    muji:{d:'SE構法は1棟ごとに構造計算'},
    yamato:{i:7,ua:0.28,h:'断熱等級7相当の商品「LEGANTIA」'},
    universal:{i:6,h:'地熱床システム（1階全室床暖房）',w:'ALC外壁'},
    aiful:{i:6},
    rgallery:{s:3},
    zensho:{s:3,l:1},
    bluehouse:{s:3,i:6},
    niken:{a:'some'},
    nomura:{d:'SE構法で1棟ごとに構造計算'},
    marunana:{h:'外断熱'},
    yamaka:{h:'W断熱（外断熱＋内断熱）'},
    hidamari:{h:'高気密・高断熱に注力'}
  };
  function landSpec(m){
    const x=LAND_SPEC[m.id]||{};
    const w=String(m.warranty||''),mm=w.match(/初期(\d+)年/)||w.match(/構造(\d+)年/);
    const y=x.y??(mm?Number(mm[1]):null);
    return {...x,y,unit:/ユニット/.test(m.struct)};
  }
  // 5段階の目安（不明は null）
  function landSpecScore(m){
    const x=landSpec(m);
    const seis=x.s===3?(x.d&&/制震|免震|吸収|損傷なし/.test(x.d)?5:4):null;
    const ins=x.i===7?5:x.i===6?(x.ua!=null&&x.ua<=0.40?4.5:4):x.i===5?3:null;
    const air=x.a==='all'?5:x.a==='some'?4:null;
    const war=x.y==null?null:x.y>=30?5:x.y>=20?4:3;
    const price=m.mid<=55?5:m.mid<=70?4:m.mid<=85?3:m.mid<=105?2:1;
    return {seis,ins,air,war,price};
  }
  const LAND_SCORE_AXES=[['seis','耐震'],['ins','断熱'],['air','気密'],['war','保証'],['price','価格']];
  function landScoreBars(m){
    const sc=landSpecScore(m);
    const mark=v=>v==null?'—':v>=4.5?'◎+':v>=4?'◎':v>=3?'○':'△';
    return '<div class="lp-score">'+LAND_SCORE_AXES.map(([k,l])=>{const v=sc[k];
      return '<button class="lp-score-tile'+(v==null?' is-na':v>=4?' is-good':'')+'"'+(k==='price'?' data-act="lp-maker-tab" data-value="about"':' data-act="lp-help" data-value="'+(k==='seis'?'seis':k)+'"')+'><span>'+l+(k==='price'?'':' ⓘ')+'</span><b>'+mark(v)+'</b><i><em style="width:'+(v==null?0:v/5*100)+'%"></em></i></button>';}).join('')+'</div>';
  }
  function landSpecRows(m){
    const x=landSpec(m),q='<i class="lp-q">要確認</i>';
    const rows=[
      ['耐震',x.s===3?'等級3＝3段階でいちばん強い（消防署なみ）':q,'seis'],
      ['制震・免震',x.d?esc(x.d):q,'damp'],
      ['断熱',x.i?'等級'+x.i+'＝7段階で'+({7:'いちばん上',6:'上から2番目',5:'上から3番目',4:'最低ライン'})[x.i]+(x.ua!=null?'（UA値'+x.ua.toFixed(2)+'）':''):q,'ins'],
      ['気密',x.a==='all'?'すべての家ですき間を測定':x.a==='some'?'すき間を測定・数値を公表':q,'air'],
      ['構造',esc(m.struct)],
      ['外壁・耐久',x.w?esc(x.w):'<i class="lp-q">特記なし</i>'],
      ['冷暖房・設備',x.h?esc(x.h):'<i class="lp-q">特記なし</i>'],
      ['工期',x.k?esc(x.k):x.unit?'短い（ユニット工法）':'普通（4〜6か月が目安）'],
      ['長期優良住宅',x.l?'対応（税の優遇あり）':q],
      ['保証',esc(m.warranty),'war']
    ];
    return '<div class="lp-spec">'+rows.map(([k,v,h])=>h?'<button class="lp-spec-row" data-act="lp-help" data-value="'+h+'"><span>'+k+' <em>ⓘ</em></span><b>'+v+'</b></button>':'<div class="lp-spec-row"><span>'+k+'</span><b>'+v+'</b></div>').join('')+'</div>';
  }
  function landMakerBadges(m){
    const x=landSpec(m),b=[];
    if(x.s===3)b.push('<i class="lp-bd s">耐震 最高</i>');
    if(x.d&&/制震|免震/.test(x.d))b.push('<i class="lp-bd d">'+(/免震/.test(x.d)?'免震も可':'揺れ吸収')+'</i>');
    if(x.i)b.push('<i class="lp-bd n'+x.i+'">断熱 '+x.i+'/7</i>');
    if(x.a==='all')b.push('<i class="lp-bd a">すき間測定</i>');
    if(x.y)b.push('<i class="lp-bd y">保証'+x.y+'年</i>');
    return b.join('');
  }
  const LAND_MAKER_SORTS=[['asc','坪単価が安い順'],['desc','坪単価が高い順'],['seis','耐震が強い順'],['ins','断熱が高い順'],['war','保証が長い順']];
  function landMakerSortFn(key){
    if(key==='asc'||key==='desc')return (a,b)=>(a.mid-b.mid)*(key==='desc'?-1:1);
    return (a,b)=>{const av=landSpecScore(a)[key],bv=landSpecScore(b)[key];
      if((av==null)!==(bv==null))return av==null?1:-1;
      if(key==='ins'){const ua=x=>landSpec(x).ua??9;return (bv-av)||(ua(a)-ua(b))||a.mid-b.mid;}
      if(key==='war')return (landSpec(b).y||0)-(landSpec(a).y||0)||a.mid-b.mid;
      return (bv??0)-(av??0)||a.mid-b.mid;};
  }
  function landMakerList(){
    const L=state.land;
    let list=LAND_MAKERS.filter(m=>L.makerType==='all'||(L.makerType==='全国'?m.area==='全国':L.makerType==='愛知'?/愛知/.test(m.area):L.makerType==='岐阜'?/岐阜/.test(m.area):L.makerType==='鉄骨'?m.type==='鉄骨':m.type===L.makerType));
    list=list.slice().sort(landMakerSortFn(L.makerSort));
    return list;
  }
  function landMakerScreen(){
    const L=state.land,list=landMakerList(),per=Math.max(5,landPerPage()-1),total=Math.max(1,Math.ceil(list.length/per));
    ui.lpMakerPage=Math.max(0,Math.min(ui.lpMakerPage||0,total-1));
    const page=list.slice(ui.lpMakerPage*per,(ui.lpMakerPage+1)*per);
    const lo=40,hi=160,pos=v=>Math.max(0,Math.min(100,(v-lo)/(hi-lo)*100));
    return '<div class="lp-toggles">'+landSeg('lp-maker-type',L.makerType,[['all','全'+LAND_MAKERS.length],['全国','全国'],['愛知','愛知'],['岐阜','岐阜'],['鉄骨','鉄骨']])+'</div><div class="lp-toggles"><label class="lp-area-pick lp-sort-pick"><span aria-hidden="true">↕</span><b>'+esc((LAND_MAKER_SORTS.find(x=>x[0]===L.makerSort)||LAND_MAKER_SORTS[0])[1])+'</b><i aria-hidden="true">▾</i><select data-lp-maker-sort aria-label="並べ替え">'+LAND_MAKER_SORTS.map(([k,l])=>'<option value="'+k+'"'+(k===L.makerSort?' selected':'')+'>'+l+'</option>').join('')+'</select></label><button class="lp-help-btn" data-act="lp-help" data-value="seis">目印の見方 ⓘ</button></div>'+
      '<div class="lp-list swipe-zone" data-swipe="lp-maker" style="--lp-rows:'+per+'">'+page.map((m,i)=>
        '<div class="lp-row" style="--i:'+i+'"><button class="lp-row-main" data-act="lp-maker-open" data-value="'+m.id+'">'+
        '<span class="lp-maker-band b-'+(m.band==='ハイ'?'hi':m.band==='ミドル上'?'mu':m.band==='ミドル'?'mid':m.band==='地元'?'local':'lo')+'">'+esc(m.band)+'</span>'+
        '<span class="lp-name"><b>'+esc(m.name)+'</b><small class="lp-bds">'+(landMakerBadges(m)||esc(m.hq?'工務店・'+m.hq:m.type))+'</small></span>'+
        '<span class="lp-maker-range"><b>'+(m.est?'<i class="lp-ref">仮</i>':'')+m.low+'〜'+m.high+'<small>万</small></b><i class="lp-range"><em style="left:'+pos(m.low)+'%;right:'+(100-pos(m.high))+'%"></em><u style="left:'+pos(m.mid)+'%"></u></i></span></button></div>').join('')+'</div>'+
      '<div class="lp-foot">'+navPager(ui.lpMakerPage,total,'lp-maker-page')+'</div>'+
      '<button class="lp-source" data-act="lp-help" data-value="ins">右の数字は建物本体の坪単価（万円）。耐震・断熱などの意味は「目印の見方」 ⓘ</button>';
  }
  function landMakerDetail(){
    const m=landMakerById(ui.lpMaker);
    if(!m)return modalFrame('ハウスメーカー',empty('◔','見つかりません',''));
    const floor=state.land.sim.floorTsubo||35;
    const lo=40,hi=160,pos=v=>Math.max(0,Math.min(100,(v-lo)/(hi-lo)*100));
    return '<div class="full lp-detail"><header class="full-header"><button class="btn compact" data-act="overlay-close">‹ 戻る</button><strong>'+esc(m.name)+'</strong><span style="width:44px"></span></header>'+
      '<section class="full-body lp-detail-body">'+
      '<div class="lp-hero"><div class="lp-hero-main"><span>建物本体の坪単価（'+(m.est?'記載なし・岐阜の相場で仮置き':'目安')+'）</span><strong>'+m.low+'〜'+m.high+'<small>万円/坪</small></strong><small>中心 '+m.mid+'万円・'+esc(m.band)+'</small></div>'+
        '<div class="lp-hero-side"><b>'+floor+'坪なら</b><span>'+landMan(m.low*10000*floor)+'〜</span><span>'+landMan(m.high*10000*floor)+'</span></div></div>'+
      '<div class="lp-sub">'+landSeg('lp-maker-tab',ui.lpMakerTab==='about'?'about':'spec',[['spec','性能・仕様'],['about','特徴・注意点']],'lp-seg-fill')+'</div>'+
      (ui.lpMakerTab==='about'?(
      '<div class="lp-maker-scale"><i class="lp-range big"><em style="left:'+pos(m.low)+'%;right:'+(100-pos(m.high))+'%"></em><u style="left:'+pos(m.mid)+'%"></u></i><span><small>40万</small><small>100万</small><small>160万</small></span></div>'+
      '<div class="lp-info-card"><span>構造・工法'+(m.hq?'／本社・エリア':'')+'</span><p>'+esc(m.struct)+(m.hq?'／'+esc(m.hq):'')+'</p></div>'+
      '<div class="lp-info-card"><span>特徴</span><ul>'+m.points.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>'+
      '<div class="lp-info-card warn"><span>注意点</span><ul>'+m.cautions.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>'+
      '<div class="lp-cells"><div class="lp-cell"><span>保証（構造・防水）</span><small class="lp-cell-text">'+esc(m.warranty)+'</small></div><div class="lp-cell"><span>向いている人</span><small class="lp-cell-text">'+esc(m.fit)+'</small></div></div>'):
      landScoreBars(m)+landSpecRows(m))+
      '<div class="lp-detail-actions"><button class="btn primary flex1" data-act="lp-maker-sim" data-value="'+m.id+'">この会社で総額を計算</button></div>'+
      '<p class="lp-disclaimer">出典（2026年11月15日確認）：'+m.src.map(k=>esc(LAND_SRC[k]?.[0]||k)).join('／')+'。性能：CREX「ハウスメーカーUA値ランキング20社」「地震に強いハウスメーカー耐震性ランキング15選」（2025年）・オリコン・各社公表資料。耐震・断熱は代表的な商品の公表値や比較記事の値で、正式な等級は住宅性能評価書で確認。坪単価・保証は商品・地域・条件で変わります。必ず各社の見積もりと保証書で確認してください。</p></section></div>';
  }
  function landGuideScreen(){
    const L=state.land,tab=L.guideTab;
    const head=(tab==='cond'?'<div class="lp-toggles">'+'<label class="lp-guide-scope"><select data-lp-guide-scope aria-label="対象の地域"><option value="all">全域</option>'+LAND_REGION_ORDER.map(r=>'<option value="'+esc(r)+'"'+(L.guideScope===r?' selected':'')+'>'+esc(r)+'</option>').join('')+'</select></label></div>':'');
    const per=(window.innerHeight||800)<700?(tab==='region'?3:2):(tab==='region'?4:3);
    let cards=[];
    if(tab==='words')cards=LAND_WORDS.map(w=>landWordCard(w,false));
    else if(tab==='region'){
      cards=LAND_REGION_ORDER.map(region=>{
        const rg=(landData?.regions||[]).find(r=>r.name===region),cs=(landData?.cities||[]).filter(c=>c.region===region&&c.residential?.all?.avgSqm);
        const sorted=cs.slice().sort((a,b)=>b.residential.all.avgSqm-a.residential.all.avgSqm);
        const avg=rg?.residential?.avgSqm||(cs.length?cs.reduce((a,c)=>a+c.residential.all.avgSqm,0)/cs.length:null);
        return '<button class="lp-guide-card" data-act="lp-guide-region" data-value="'+esc(region)+'"><div class="lp-guide-top"><b>'+esc(region)+'</b><span>'+landPriceHtml(avg,{unit:'tsubo',small:false})+'</span>'+
          '<em class="'+landTone(rg?.residential?.chg)+'">前年比 '+landPct(rg?.residential?.chg,1)+'</em></div>'+
          '<p>'+esc(LAND_REGION_NOTES[region]||'')+'</p>'+
          (sorted.length?'<small>高い：'+esc(sorted.slice(0,3).map(c=>c.name.replace(/^名古屋市/,'')).join('・'))+'　手頃：'+esc(sorted.slice(-3).reverse().map(c=>c.name.replace(/^名古屋市/,'')).join('・'))+'</small>':'')+'</button>';
      });
    }else{
      const scope=L.guideScope==='all'?'all':({'名古屋市':'nagoya','尾張':'owari','知多':'chita','西三河':'nishimikawa','東三河':'higashimikawa','東濃':'tono','中濃':'chuno'})[L.guideScope]||'all';
      const cond=landData?.conditions||{};
      cards=['dist','dir','corner','road','zone','area'].filter(k=>cond[k]).map(k=>{
        const c=cond[k],sc=c.scopes?.[scope]||{},rows=c.order.filter(g=>sc[g]);
        const max=Math.max(10,...rows.map(g=>Math.abs(sc[g].pct)));
        return '<div class="lp-guide-card"><div class="lp-guide-top"><b>'+esc(c.label)+'</b><span class="lp-guide-sub">同じ市区町村の平均との差</span></div>'+
          '<div class="lp-cond-bars">'+(rows.length?rows.map(g=>{const v=sc[g].pct;return '<div><span>'+esc(g)+'</span><i class="lp-cond-bar"><em class="'+(v>=0?'pos':'neg')+'" style="--w:'+Math.round(Math.abs(v)/max*50)+'%"></em></i><b class="'+landTone(v)+'">'+landPct(v,1)+'</b><small>'+sc[g].n+'</small></div>';}).join(''):'<div class="lp-cond-empty">この地域のデータが足りません</div>')+'</div>'+
          '<p>'+esc(LAND_COND_NOTES[k]||'')+'</p></div>';
      });
      cards.push('<div class="lp-guide-card"><div class="lp-guide-top"><b>旗竿地・セットバック</b><span class="lp-guide-sub">データなし（一般的な目安）</span></div><p>'+esc(LAND_COND_NOTES.flag)+'</p><p>'+esc(LAND_COND_NOTES.road)+'</p></div>');
    }
    const total=Math.max(1,Math.ceil(cards.length/per));
    ui.lpGuidePage=Math.max(0,Math.min(ui.lpGuidePage||0,total-1));
    return head+'<div class="lp-guide-list swipe-zone" data-swipe="lp-guide" style="--lp-cards:'+per+'">'+cards.slice(ui.lpGuidePage*per,(ui.lpGuidePage+1)*per).join('')+'</div>'+
      '<div class="lp-foot">'+navPager(ui.lpGuidePage,total,'lp-guide-page')+'</div>'+
      '<button class="lp-source" data-act="lp-about">'+(tab==='words'?'用語は国土交通省・国税庁・建築基準法の説明をもとに要約 ⓘ':tab==='cond'?'標準地（典型的な土地）の比較。個別の土地の価格とは異なります ⓘ':'数値は国土数値情報の集計、文章は県・国の2026年地価公示の発表より ⓘ')+'</button>';
  }

  /* ===== 地区別の地価・通勤コスト（r79） ===== */
  const LAND_WHO=['夫','妻'];
  function landPersonDefaults(i){return {label:i?'妻':'夫',name:'',lat:null,lon:null,mode:'car',days:20,kmPerL:15,gas:164,speed:30,trainPass:0,allowance:0};}
  function landCommuteDefaults(){return {years:30,sort:'time',people:[landPersonDefaults(0),landPersonDefaults(1)]};}
  function landPersonNormalize(x,i){
    const d=landPersonDefaults(i);x=x&&typeof x==='object'?x:{};
    const n=(k,lo,hi)=>{const v=Number(x[k]);return Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):d[k];};
    const lat=Number(x.lat),lon=Number(x.lon),ok=x.lat!=null&&x.lon!=null&&Number.isFinite(lat)&&Number.isFinite(lon)&&lat>20&&lat<50&&lon>120&&lon<155;
    return {label:d.label,name:ok?String(x.name||'勤務先').slice(0,60):'',lat:ok?lat:null,lon:ok?lon:null,
      mode:['car','train','bike'].includes(x.mode)?x.mode:'car',days:n('days',1,31),kmPerL:n('kmPerL',3,60),gas:n('gas',80,300),
      speed:n('speed',10,80),trainPass:n('trainPass',0,200000),allowance:n('allowance',0,200000)};
  }
  function landCommuteNormalize(x){
    x=x&&typeof x==='object'?x:{};
    // r79までの1人分の設定は「夫」に引き継ぐ
    const src=Array.isArray(x.people)?x.people:[x,{}];
    const y=Number(x.years);
    return {years:Number.isFinite(y)?Math.min(50,Math.max(1,y)):30,sort:['time','cost','total'].includes(x.sort)?x.sort:'time',
      people:[landPersonNormalize(src[0],0),landPersonNormalize(src[1],1)]};
  }
  const landPersonSet=P=>Number.isFinite(P?.lat)&&Number.isFinite(P?.lon);
  const landActivePeople=()=>(state.land.commute?.people||[]).filter(landPersonSet);
  const landHasWork=()=>landActivePeople().length>0;
  let landCentroidCache={data:null,map:null};
  function landCentroids(){
    if(landCentroidCache.data===landData)return landCentroidCache.map;
    const m=new Map();
    for(const p of landData?.points||[]){
      if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon))continue;
      const a=m.get(p.cityCode)||[0,0,0];a[0]+=p.lat;a[1]+=p.lon;a[2]++;m.set(p.cityCode,a);
    }
    const out=new Map([...m].map(([k,a])=>[k,{lat:a[0]/a[2],lon:a[1]/a[2]}]));
    landCentroidCache={data:landData,map:out};
    return out;
  }
  // 通勤の目安：直線距離×道のり係数。車は平均速度、電車は駅までの徒歩・待ちを15分として計算
  function landCommuteOne(from,P){
    const km=landKm(from.lat,from.lon,P.lat,P.lon);
    let road,minutes,monthly,estimated=false;
    if(P.mode==='car'){road=km*1.3;minutes=road/P.speed*60+5;monthly=road*2*P.days/P.kmPerL*P.gas;}
    else if(P.mode==='train'){
      road=km*1.25;minutes=15+road/40*60;
      if(P.trainPass>0)monthly=P.trainPass;
      else{const oneWay=150+22*road;monthly=oneWay*2*P.days*0.65;estimated=true;}
    }else{road=km*1.2;minutes=road/15*60;monthly=0;}
    const net=Math.max(0,monthly-P.allowance);
    return {label:P.label,km,road,minutes:Math.round(minutes),monthly,net,estimated};
  }
  function landCommute(from){
    const people=landActivePeople();
    if(!people.length||!from||!Number.isFinite(from.lat))return null;
    const parts=people.map(P=>landCommuteOne(from,P)),years=state.land.commute.years;
    const net=parts.reduce((a,p)=>a+p.net,0);
    return {parts,minutes:parts.reduce((a,p)=>a+p.minutes,0),net,yearly:net*12,total:net*12*years,estimated:parts.some(p=>p.estimated)};
  }
  const landMin=m=>(Math.floor(m/60)?Math.floor(m/60)+'時間':'')+(m%60)+'分';
  function landCommuteText(cm){
    if(!cm)return '';
    if(cm.parts.length===1){const p=cm.parts[0];return p.label+' 片道'+landMin(p.minutes)+'・'+p.road.toFixed(p.road<10?1:0)+'km';}
    return cm.parts.map(p=>p.label+landMin(p.minutes)).join('・');
  }
  function landYenText(yen){
    if(!Number.isFinite(yen))return '—';
    return yen>=100000?landMan(yen):digits.format(Math.round(yen/100)*100)+'円';
  }
  function landPersonDetail(P){
    const mode={car:'車',train:'電車',bike:'自転車'}[P.mode];
    const d=P.mode==='car'?P.kmPerL+'km/L・'+P.gas+'円/L':P.mode==='train'?(P.trainPass>0?'定期'+digits.format(P.trainPass)+'円':'定期代は推計'):'時速15km';
    return mode+'・月'+P.days+'日・'+d+(P.allowance?'・手当'+digits.format(P.allowance)+'円':'');
  }
  function landCommuteSummary(){
    const ps=state.land.commute.people;
    return '<button class="lp-commute-chip" data-act="lp-commute-settings">'+ps.map(P=>
      '<span class="lp-cc-row'+(landPersonSet(P)?'':' is-off')+'"><i>'+P.label+'</i><b>'+esc(landPersonSet(P)?P.name:'未設定')+'</b><small>'+(landPersonSet(P)?esc(landPersonDetail(P)):'')+'</small></span>').join('')+
      '<em>変更 ›</em></button>';
  }
  function landCommuteRows(){
    const C=state.land.commute,cent=landCentroids(),wish=state.land.wishTsubo,two=landActivePeople().length>1;
    const rows=(landData?.cities||[]).filter(landCityIn).map(c=>{
      const cm=landCommute(cent.get(c.code));
      if(!cm)return null;
      const sqm=c.residential?.all?.avgSqm||c.residential?.koji?.avgSqm||c.residential?.chosa?.avgSqm||null;
      const land=sqm?sqm*LAND_TSUBO*wish:null;
      const value=C.sort==='time'?cm.minutes:C.sort==='cost'?cm.net:(land!=null?land+cm.total:null);
      return {key:c.code,code:c.code,name:c.name,fav:state.land.favorites.includes(c.code),value,
        sub:landCommuteText(cm)+'・'+c.region,
        main:C.sort==='time'?cm.minutes+'<small>分'+(two?'（計）':'')+'</small>':C.sort==='cost'?landYenText(cm.net)+'<small>/月</small>':landMan(value),
        extra:C.sort==='total'?'土地'+landMan(land)+'＋通勤'+landMan(cm.total):C.sort==='time'?landYenText(cm.net)+'/月'+(cm.estimated?'（推計）':''):'年'+landYenText(cm.yearly)};
    }).filter(Boolean);
    rows.sort((a,b)=>{const av=landFinite(a.value),bv=landFinite(b.value);if(av!==bv)return av?-1:1;return (av?a.value-b.value:0)||a.name.localeCompare(b.name,'ja');});
    rows.forEach((r,i)=>{r.rank=landFinite(r.value)?i+1:null;});
    return rows;
  }
  function landCommuteScreen(){
    const C=state.land.commute,two=landActivePeople().length>1;
    if(!landHasWork())return '<div class="lp-commute-empty">'+landEmptyArt('normal')+'<strong>夫・妻の勤務先を設定すると、各市区町村からの通勤時間と費用を計算します</strong>'+
      '<span>車なら燃費とガソリン代、電車なら定期代で計算。2人分を合計して、土地代と通勤費を合わせた比較もできます。</span>'+
      '<button class="btn primary wide" data-act="lp-commute-settings">勤務先と通勤方法を設定</button></div>';
    const rows=landCommuteRows(),per=Math.max(5,landPerPage()-3),total=Math.max(1,Math.ceil(rows.length/per));
    ui.lpCommutePage=Math.max(0,Math.min(ui.lpCommutePage||0,total-1));
    const page=rows.slice(ui.lpCommutePage*per,(ui.lpCommutePage+1)*per);
    return landCommuteSummary()+
      '<div class="lp-toggles">'+landAreaSelect()+landSeg('lp-commute-sort',C.sort,[['time','時間'],['cost','費用'],['total','土地＋通勤']],'lp-seg-fill')+'</div>'+
      '<div class="lp-list swipe-zone" data-swipe="lp-commute" style="--lp-rows:'+per+'">'+(page.length?page.map((r,i)=>landRowHtml(r,i)).join(''):'<div class="lp-empty"><strong>該当する市区町村がありません</strong></div>')+'</div>'+
      '<div class="lp-foot">'+navPager(ui.lpCommutePage,total,'lp-commute-page')+'</div>'+
      '<button class="lp-source" data-act="lp-about">直線距離から道のりを推計した目安（渋滞・乗り換えは含みません） ⓘ</button>';
  }
  const landWho=()=>ui.lpWho===1?1:0;
  const landPerson=()=>state.land.commute.people[landWho()];
  function landCommuteSettingsScreen(){
    const C=state.land.commute,P=landPerson();
    const field=(label,key,unit,attrs,val)=>'<label class="lp-field"><span>'+label+'</span><span class="lp-input"><input type="number" inputmode="decimal" data-lp-commute="'+key+'" value="'+esc(val)+'" '+attrs+'><i>'+unit+'</i></span></label>';
    const cityOpts='<option value="">市区町村から選ぶ</option>'+LAND_REGION_ORDER.map(region=>{
      const cs=(landData?.cities||[]).filter(c=>c.region===region);
      return cs.length?'<optgroup label="'+esc(region)+'">'+cs.map(c=>'<option value="'+esc(c.code)+'">'+esc(c.name)+'</option>').join('')+'</optgroup>':'';
    }).join('');
    const modeFields=P.mode==='car'?field('燃費','kmPerL','km/L','min="3" max="60" step="0.5"',P.kmPerL)+field('ガソリン代','gas','円/L','min="80" max="300" step="1"',P.gas)+field('平均の速さ','speed','km/h','min="10" max="80" step="1"',P.speed):
      P.mode==='train'?field('定期代（1か月）','trainPass','円','min="0" max="200000" step="100"',P.trainPass)+'<p class="lp-note">0のままなら距離から推計します（目安）。</p>':'<p class="lp-note">自転車は時速15kmで時間を計算し、費用は0円とします。</p>';
    return modalFrame('勤務先と通勤方法','<div class="panel detail grow lp-settings">'+
      '<div class="lp-who">'+landSeg('lp-who',String(landWho()),C.people.map((p,i)=>[String(i),p.label+(landPersonSet(p)?' ✓':'')]),'lp-seg-fill')+'</div>'+
      '<div class="lp-set-group"><span class="kicker">'+P.label+'の勤務先</span>'+
        '<div class="lp-work-now"><span>'+(landPersonSet(P)?'✓ '+esc(P.name):'まだ設定されていません')+'</span>'+(landPersonSet(P)?'<button class="btn compact" data-act="lp-work-clear">外す</button>':'')+'</div>'+
        '<div class="lp-token-row"><input type="search" data-lp-work-query placeholder="住所・駅・会社の所在地（例：名古屋駅）" aria-label="'+P.label+'の勤務先の住所" enterkeyhint="search"><button class="btn compact primary" data-act="lp-work-search">検索</button></div>'+
        (ui.lpWorkResults?.length?'<div class="lp-work-results">'+ui.lpWorkResults.slice(0,4).map((r,i)=>'<button data-act="lp-work-pick" data-value="'+i+'">'+esc(r.title)+'</button>').join('')+'</div>':'')+
        '<select class="lp-work-city" data-lp-work-city aria-label="市区町村から選ぶ">'+cityOpts+'</select></div>'+
      '<div class="lp-set-group"><span class="kicker">'+P.label+'の通勤方法</span>'+landSeg('lp-commute-mode',P.mode,[['car','車'],['train','電車'],['bike','自転車']],'lp-seg-fill')+
        modeFields+field('出勤日数','days','日/月','min="1" max="31" step="1"',P.days)+field('通勤手当','allowance','円/月','min="0" max="200000" step="100"',P.allowance)+'</div>'+
      '<div class="lp-set-group">'+field('比べる年数（2人共通）','years','年','min="1" max="50" step="1"',C.years)+'</div>'+
      '</div><p class="lp-note lp-commute-note">ガソリン代の初期値は2026年7月の愛知県の平均（163.7円/L）付近。道のりは直線距離の1.3倍（電車1.25倍）で推計。2人分の通勤費は合計します。</p>');
  }
  function landSetPerson(patch){
    const C=state.land.commute,i=landWho();
    const people=C.people.slice();people[i]={...people[i],...patch};
    state.land.commute=landCommuteNormalize({...C,people});
  }
  async function landWorkSearch(q){
    q=String(q||'').trim();
    if(!q)return message('勤務先の住所や駅名を入れてください');
    try{
      const r=await fetch('https://msearch.gsi.go.jp/address-search/AddressSearch?q='+encodeURIComponent(q),{cache:'no-store'});
      if(!r.ok)throw Error('http');
      const list=(await r.json()||[]).filter(x=>Array.isArray(x?.geometry?.coordinates)).map(x=>({title:String(x.properties?.title||q),lon:+x.geometry.coordinates[0],lat:+x.geometry.coordinates[1]}));
      if(!list.length)return message('見つかりませんでした。別の書き方か、市区町村から選んでください');
      ui.lpWorkResults=list;render();
    }catch(_){message('検索できませんでした（通信を確認）。市区町村から選ぶこともできます');}
  }
  function landSetWork(name,lat,lon){
    landSetPerson({name,lat,lon});
    ui.lpWorkResults=null;save();
    message(landPerson().label+'の勤務先を「'+name+'」にしました');
  }

  /* --- 地区（町名）ごとの地価 --- */
  function landTownOf(p,c){
    let s=landShortAddress(p.address,c).replace(/^大字/,'').trim();
    const m=s.match(/^(.+?)(?=[0-9０-９一二三四五六七八九十]+丁目|字|[0-9０-９])/);
    return (m?m[1]:s).replace(/[　\s]+$/,'')||'（地区名なし）';
  }
  function landTowns(c){
    const pts=(landData?.points||[]).filter(p=>p.cityCode===c.code&&p.use===(ui.lpAreaUse==='com'?'商業地':'住宅地'));
    const groups=new Map();
    for(const p of pts){const t=landTownOf(p,c);if(!groups.has(t))groups.set(t,[]);groups.get(t).push(p);}
    return [...groups].map(([name,ps])=>{
      const geo=ps.filter(p=>Number.isFinite(p.lat));
      const center=geo.length?{lat:geo.reduce((a,p)=>a+p.lat,0)/geo.length,lon:geo.reduce((a,p)=>a+p.lon,0)/geo.length}:null;
      const rates=ps.map(p=>p.chg).filter(landFinite);
      return {name,points:ps,avg:ps.reduce((a,p)=>a+p.priceSqm,0)/ps.length,chg:rates.length?rates.reduce((a,b)=>a+b,0)/rates.length:null,
        stations:[...new Set(ps.map(p=>p.station).filter(Boolean))],center,commute:landCommute(center)};
    }).sort((a,b)=>(b.avg-a.avg)*(ui.lpAreaOrder==='asc'?-1:1));
  }
  function landAreaScreen(){
    const c=landCity(ui.lpCity);
    if(!c)return modalFrame('地区ごとの地価',empty('◔','データがありません',''));
    const towns=landTowns(c),per=landPerPage()-1,total=Math.max(1,Math.ceil(towns.length/per));
    ui.lpAreaPage=Math.max(0,Math.min(ui.lpAreaPage||0,total-1));
    const page=towns.slice(ui.lpAreaPage*per,(ui.lpAreaPage+1)*per);
    return '<div class="full lp-detail"><header class="full-header"><button class="btn compact" data-act="lp-back" data-value="land-detail">‹ 戻る</button><strong>'+esc(c.name)+'の地区</strong><span style="width:44px"></span></header>'+
      '<section class="full-body lp-detail-body">'+
      '<div class="lp-toggles">'+landSeg('lp-area-use',ui.lpAreaUse==='com'?'com':'res',[['res','住宅地'],['com','商業地']])+landSeg('lp-area-order',ui.lpAreaOrder==='asc'?'asc':'desc',[['desc','高い順'],['asc','安い順']])+landSeg('lp-unit',state.land.unit,[['sqm','㎡'],['tsubo','坪']])+'</div>'+
      '<div class="lp-list swipe-zone" data-swipe="lp-area" style="--lp-rows:'+per+'">'+(page.length?page.map((t,i)=>
        '<div class="lp-row" style="--i:'+i+'"><button class="lp-row-main" data-act="lp-town" data-value="'+esc(t.name)+'"><span class="lp-rank'+(ui.lpAreaPage*per+i<3?' is-top':'')+'">'+(ui.lpAreaPage*per+i+1)+'</span>'+
        '<span class="lp-name"><b>'+esc(t.name)+'</b><small>'+(t.points.length<3?'<i class="lp-ref">参考</i>':'')+t.points.length+'地点'+(t.stations.length?'・'+esc(t.stations.slice(0,2).join('・'))+'駅':'')+(t.commute?'・通勤'+t.commute.minutes+'分':'')+'</small></span>'+
        '<span class="lp-val"><b>'+landPriceHtml(t.avg)+'</b><span class="lp-extra"><span class="'+landTone(t.chg)+'">'+landPct(t.chg,1)+'</span></span></span></button></div>').join(''):
        '<div class="lp-empty"><strong>この区分の地点がありません</strong></div>')+'</div>'+
      '<div class="lp-foot">'+navPager(ui.lpAreaPage,total,'lp-area-page')+'</div>'+
      '<p class="lp-disclaimer">地区＝地価公示・地価調査の地点の所在地（町名）でまとめたもの。地点がない町は表示されません。</p></section></div>';
  }
  function landTownScreen(){
    const c=landCity(ui.lpCity),t=c&&landTowns(c).find(x=>x.name===ui.lpTown);
    if(!t)return modalFrame('地区',empty('◔','データがありません',''));
    const rows=t.points.slice().sort((a,b)=>b.priceSqm-a.priceSqm).slice(0,(window.innerHeight||800)<700?4:6);
    const roadTxt=p=>[p.dir?p.dir+'道路':'',p.road?p.road+'m':'',p.side?'角地等':''].filter(Boolean).join(' ');
    return '<div class="full lp-detail"><header class="full-header"><button class="btn compact" data-act="lp-back" data-value="land-area">‹ 戻る</button><strong>'+esc(c.name.replace(/^名古屋市/,'')+' '+t.name)+'</strong>'+(()=>{const on=state.land.favTowns.includes(landTownKey(c.code,t.name));return '<button class="btn compact lp-star'+(on?' on':'')+'" data-act="lp-town-fav" aria-label="候補地に'+(on?'入っています':'追加')+'">'+(on?'★':'☆')+'</button>';})()+'</header>'+
      '<section class="full-body lp-detail-body">'+
      '<div class="lp-hero"><div class="lp-hero-main"><span>'+(ui.lpAreaUse==='com'?'商業地':'住宅地')+'の平均（'+t.points.length+'地点）</span><strong>'+landPriceHtml(t.avg)+'</strong><small>'+landPriceHtml(t.avg,{unit:state.land.unit==='tsubo'?'sqm':'tsubo',small:false})+'</small></div>'+
        '<div class="lp-hero-side"><b class="'+landTone(t.chg)+'">前年比 '+landPct(t.chg,1)+'</b>'+(t.commute?'<span>通勤 '+esc(landCommuteText(t.commute))+'</span><span>'+landYenText(t.commute.net)+'/月</span>':'<span>'+esc(c.name)+'</span>')+'</div></div>'+
      '<div class="lp-town-list">'+rows.map(p=>
        '<div class="lp-town-pt"><div><b>'+esc(landShortAddress(p.address,c))+'</b><small>'+(p.kind==='koji'?'地価公示':'地価調査')+(p.lot?' '+esc(p.lot):'')+(p.station?'・'+esc(p.station)+'駅'+(p.dist!=null?' '+(p.dist>=1000?(p.dist/1000).toFixed(1)+'km':p.dist+'m'):''):'')+'</small>'+
        '<small>'+esc([p.zone,roadTxt(p),p.area?Math.round(p.area/LAND_TSUBO)+'坪':''].filter(Boolean).join('・'))+'</small></div>'+
        '<div class="lp-town-val"><b>'+landPriceHtml(p.priceSqm)+'</b><span class="'+landTone(p.chg)+'">'+landPct(p.chg,1)+'</span>'+(p.chg5y!=null?'<small>5年 '+landPct(p.chg5y,1)+'</small>':'')+'</div></div>').join('')+'</div>'+
      '<div class="lp-detail-actions"><button class="btn primary flex1" data-act="lp-sim-city" data-value="'+esc(c.code)+'">総額を計算</button><button class="btn flex1" data-act="lp-map-here">地図で見る</button></div>'+
      '<p class="lp-disclaimer">'+esc(LAND_NOTE)+'。</p></section></div>';
  }
  function landV3Action(action,v){
    const C=state.land.commute;
    if(action==='lp-areas')return openOverlay('land-area',()=>{ui.lpAreaPage=0;});
    if(action==='lp-town')return openOverlay('land-town',()=>{ui.lpTown=v;});
    if(action==='lp-back')return step(()=>{ui.overlay=['land-detail','land-area'].includes(v)?v:'';});
    if(action==='lp-area-use')return step(()=>{ui.lpAreaUse=v==='com'?'com':'res';ui.lpAreaPage=0;});
    if(action==='lp-area-order')return step(()=>{ui.lpAreaOrder=v==='asc'?'asc':'desc';ui.lpAreaPage=0;});
    if(action==='lp-area-page'){const c=landCity(ui.lpCity);const total=c?Math.max(1,Math.ceil(landTowns(c).length/(landPerPage()-1))):1;return step(()=>changePage('lpAreaPage',total,Number(v)));}
    if(action==='lp-commute-settings')return openOverlay('land-commute',()=>{ui.lpWorkResults=null;});
    if(action==='lp-who')return step(()=>{ui.lpWho=v==='1'?1:0;ui.lpWorkResults=null;});
    if(action==='lp-work-clear')return step(()=>{landSetPerson({name:'',lat:null,lon:null});save();});
    if(action==='lp-commute-mode')return step(()=>{landSetPerson({mode:v});save();});
    if(action==='lp-commute-sort')return step(()=>{state.land.commute=landCommuteNormalize({...C,sort:v});ui.lpCommutePage=0;save();});
    if(action==='lp-commute-page'){const total=Math.max(1,Math.ceil(landCommuteRows().length/Math.max(6,landPerPage()-2)));return step(()=>changePage('lpCommutePage',total,Number(v)));}
    if(action==='lp-work-search'){landWorkSearch(app.querySelector('[data-lp-work-query]')?.value);return;}
    if(action==='lp-work-pick'){const r=ui.lpWorkResults?.[Number(v)];if(r)step(()=>landSetWork(r.title,r.lat,r.lon));return;}
    return false;
  }
  /* ===== 用語ガイド・地図・候補地の比較（r81） ===== */
  const LAND_WORDS=[
    {k:'koji',t:'地価公示と地価調査の違い',tag:'いちばん大事',
      d:'どちらも「更地として普通に売買したときの1㎡あたりの価格」を専門家が評価して公表するもので、評価の考え方は同じです。違いは「誰が・いつの時点で・どこを」調べるかです。',
      rows:[['調べる人','国（国土交通省の土地鑑定委員会）','都道府県'],['時点','毎年1月1日','毎年7月1日'],['公表','3月下旬','9月下旬'],['地点','都市計画区域が中心（全国約2.6万地点）','区域外の郊外・山間部も含む（全国約2.1万地点）'],['評価','不動産鑑定士2人以上','不動産鑑定士1人以上']],
      foot:'時点が半年ずれているので、2つを合わせると1年に2回の地価の動きがわかります。このアプリの「両方」は2つの地点をまとめて平均したものです。'},
    {k:'std',t:'標準地・基準地',d:'地価公示で調べる地点を「標準地」、地価調査の地点を「基準地」と呼びます。その地域で形や広さ、道路の付き方がふつうの土地が選ばれます。同じ土地が両方に選ばれていることもあります。'},
    {k:'tsubo',t:'坪単価と㎡単価',d:'1坪＝約3.3㎡（正確には3.305785㎡）。坪単価＝㎡単価×3.3。例えば1㎡あたり3万円なら1坪あたり約9.9万円で、50坪なら約496万円です。'},
    {k:'chg',t:'前年比（変動率）',d:'前の年も調べた同じ地点どうしで、価格が何％変わったかの平均です。新しく選ばれた地点は含みません。プラスは値上がり、マイナスは値下がりです。'},
    {k:'real',t:'実勢価格（実際の取引価格）',d:'実際に売買された価格です。売り手と買い手の事情で上下するので、地価公示より1〜2割高い・安いこともよくあります。国の「不動産情報ライブラリ」で調べられます。'},
    {k:'rosen',t:'路線価（相続税路線価）',d:'相続税・贈与税の計算に使う、道路ごとの1㎡あたりの価格です。国税庁が毎年7月に公表し、地価公示のおよそ8割の水準が目安です。'},
    {k:'kotei',t:'固定資産税評価額',d:'固定資産税を計算するための価格で、市町村が3年ごとに見直します。地価公示のおよそ7割の水準が目安です。'},
    {k:'zone',t:'用途地域',d:'建てられる建物の種類を決めるルールです。「低層住居」は2〜3階建ての家が中心で静か、「中高層住居」はマンションも建つ、「住居」はお店も混ざる、「商業・工業」は住むには騒がしいこともあります。'},
    {k:'ratio',t:'建ぺい率・容積率',d:'建ぺい率は「土地の何％まで建物で覆えるか」、容積率は「土地に対して延べ床面積を何％まで取れるか」です。例：50坪で建ぺい率60％なら1階は30坪まで、容積率100％なら延べ50坪までです。'},
    {k:'road',t:'前面道路と接道義務',d:'家を建てるには、幅4m以上の道路に2m以上接している必要があります。道路が4m未満の場合は、道の中心から2m下がった所までしか使えません（セットバック）。'},
    {k:'corner',t:'角地',d:'2つの道路に接している土地です。日当たりと開放感がよく、建ぺい率が10％増えることもありますが、人目が気になる・塀の費用がかさむ面もあります。'},
    {k:'dir',t:'南道路・北道路',d:'道路がどの方角にあるかです。南道路は日当たりのよい庭とリビングを作りやすく人気があり、価格も少し高めです。北道路は安めで、家の南側に庭を取れます。'},
    {k:'flag',t:'旗竿地',d:'細い通路の奥に敷地がある「旗」の形の土地です。相場より2〜3割安いことが多い反面、車の出し入れや日当たり、工事費に注意が必要です。'},
    {k:'w-seis',t:'耐震等級',d:'地震への強さを3段階で表したもの。等級1が法律の最低限、等級3がその1.5倍でいちばん強い。メーカー詳細の「耐震 ⓘ」で表を見られます。'},
    {k:'w-ins',t:'断熱等級・UA値',d:'熱の逃げにくさを7段階で表したもの。等級4が2025年からの最低ライン、等級7がいちばん上。UA値は小さいほど高性能。メーカー詳細の「断熱 ⓘ」で表を見られます。'},
    {k:'w-air',t:'気密・C値',d:'家のすき間の量。C値が小さいほどすき間が少なく、1.0以下が高気密の目安。家ごとに測らないとわからないので、全棟で測定しているかがポイント。'},
    {k:'size',t:'家と土地の広さの目安',d:'国の目安では、ゆとりある家は「25㎡×人数＋25㎡」（4人で125㎡≒38坪）。土地は2階建てなら建物の1階部分に、車1台あたり約15㎡（約4.5坪）と庭・すき間を足した広さが目安で、4人・車2台なら40坪前後から。「計算」の「広さの目安」で人数や車の台数から計算できます。'},
    {k:'extra',t:'付帯工事費・諸費用',d:'付帯工事費は地盤改良・外構・給排水などで、このアプリでは建物本体の25％で計算しています。諸費用は登記・ローン手数料・火災保険・仲介手数料などで、注文住宅は総額の10％、建売は7.5％で計算しています。'},
    {k:'btsubo',t:'建物の坪単価',d:'建物本体の価格÷延床面積です。会社ごとに含まれる範囲（照明・カーテン・外構など）が違うので、見積もりは総額で比べるのが安全です。'}
  ];
  function landWordCard(w,full){
    return '<div class="lp-guide-card lp-word'+(w.k==='koji'?' is-key':'')+'"><div class="lp-guide-top"><b>'+esc(w.t)+'</b>'+(w.tag?'<span class="lp-word-tag">'+esc(w.tag)+'</span>':'')+'</div>'+
      '<p>'+esc(w.d)+'</p>'+
      (w.rows&&full?'<div class="lp-word-table"><span></span><b>地価公示</b><b>地価調査</b>'+w.rows.map(r=>'<span>'+esc(r[0])+'</span><i>'+esc(r[1])+'</i><i>'+esc(r[2])+'</i>').join('')+'</div>'+(w.foot?'<p>'+esc(w.foot)+'</p>':''):'')+
      (w.rows&&!full?'<button class="lp-word-more" data-act="lp-word" data-value="'+w.k+'">表で比べる ›</button>':'')+'</div>';
  }
  function landWordScreen(){
    const w=LAND_WORDS.find(x=>x.k===ui.lpWord)||LAND_WORDS[0];
    return modalFrame('用語ガイド','<div class="panel detail grow lp-word-full">'+landWordCard(w,true)+'</div>');
  }

  /* --- 地図（地理院タイル） --- */
  const LAND_MAP_TILE='https://cyberjapandata.gsi.go.jp/xyz/pale/';
  const landMapDefault=()=>({lat:35.15,lon:137.05,z:9,use:'res',sel:null});
  const landProj=(lat,lon,z)=>{const s=256*2**z,r=lat*Math.PI/180;return [(lon+180)/360*s,(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*s];};
  const landUnproj=(x,y,z)=>{const s=256*2**z,n=Math.PI-2*Math.PI*y/s;return [180/Math.PI*Math.atan(Math.sinh(n)),x/s*360-180];};
  const LAND_MAP_BANDS=[[10,'〜10万'],[20,'〜20万'],[40,'〜40万'],[80,'〜80万'],[Infinity,'80万〜']];
  const landBand=sqm=>{const t=sqm*LAND_TSUBO/10000;return LAND_MAP_BANDS.findIndex(b=>t<b[0]);};
  function landMapScreen(){
    const M=ui.map||(ui.map=landMapDefault());
    const W=window.innerWidth||390,H=window.innerHeight||800,[cx,cy]=landProj(M.lat,M.lon,M.z),n=2**M.z;
    let tiles='';
    for(let tx=Math.floor((cx-W/2)/256);tx<=Math.floor((cx+W/2)/256);tx++)
      for(let ty=Math.floor((cy-H/2)/256);ty<=Math.floor((cy+H/2)/256);ty++){
        if(ty<0||ty>=n)continue;
        tiles+='<img class="lp-tile" alt="" draggable="false" loading="lazy" onerror="this.remove()" src="'+LAND_MAP_TILE+M.z+'/'+((tx%n)+n)%n+'/'+ty+'.png" style="left:'+Math.round(tx*256-cx)+'px;top:'+Math.round(ty*256-cy)+'px">';
      }
    const use=M.use==='com'?'商業地':'住宅地';
    const ok=new Set((landData?.cities||[]).filter(landCityIn).map(c=>c.code)),pts=(landData?.points||[]).filter(p=>p.use===use&&Number.isFinite(p.lat)&&ok.has(p.cityCode));
    let marks='',count=0;
    for(const p of pts){
      const [x,y]=landProj(p.lat,p.lon,M.z),dx=x-cx,dy=y-cy;
      if(Math.abs(dx)>W/2+20||Math.abs(dy)>H/2+20)continue;
      count++;
      const sel=M.sel===p.id;
      marks+='<button class="lp-mk b'+landBand(p.priceSqm)+(sel?' is-sel':'')+(M.z>=13?' is-big':'')+'" style="left:'+Math.round(dx)+'px;top:'+Math.round(dy)+'px" data-act="lp-map-pt" data-value="'+esc(p.id)+'" aria-label="'+esc(p.address)+'">'+(M.z>=13?(p.priceSqm*LAND_TSUBO/10000).toFixed(p.priceSqm*LAND_TSUBO<1e6?1:0):'')+'</button>';
    }
    for(const P of landActivePeople()){
      const [x,y]=landProj(P.lat,P.lon,M.z);
      marks+='<span class="lp-mk-work'+(P.label==='妻'?' is-wife':'')+'" style="left:'+Math.round(x-cx)+'px;top:'+Math.round(y-cy)+'px">'+P.label+'</span>';
    }
    for(const m of state.land.my){const pt=Number.isFinite(m.lat)?m:landCentroids().get(m.city);if(!pt)continue;
      const [x,y]=landProj(pt.lat,pt.lon,M.z);
      marks+='<button class="lp-mk-my" style="left:'+Math.round(x-cx)+'px;top:'+Math.round(y-cy)+'px" data-act="lp-my-open" data-value="'+esc(m.id)+'" aria-label="登録した土地 '+esc(m.name||m.town||'')+'">★</button>';}
    const p=M.sel&&(landData?.points||[]).find(x=>x.id===M.sel),c=p&&landCity(p.cityCode);
    const card=p?'<div class="lp-map-card"><button class="lp-map-x" data-act="lp-map-close" aria-label="閉じる">×</button>'+
      '<b>'+esc(c?c.name+' '+landShortAddress(p.address,c):p.address)+'</b>'+
      '<small>'+(p.kind==='koji'?'地価公示':'地価調査')+(p.lot?' '+esc(p.lot):'')+(p.station?'・'+esc(p.station)+'駅'+(p.dist!=null?' '+(p.dist>=1000?(p.dist/1000).toFixed(1)+'km':p.dist+'m'):''):'')+(p.zone?'・'+esc(p.zone):'')+'</small>'+
      '<div class="lp-map-card-row"><strong>'+landPriceHtml(p.priceSqm)+'</strong><span class="'+landTone(p.chg)+'">前年比 '+landPct(p.chg,1)+'</span>'+(p.chg5y!=null?'<span class="'+landTone(p.chg5y)+'">5年 '+landPct(p.chg5y,1)+'</span>':'')+'</div>'+
      (c?'<div class="lp-map-card-btns"><button class="btn compact primary" data-act="lp-open" data-value="'+esc(c.code)+'">'+esc(c.name)+'を見る</button><button class="btn compact" data-act="lp-map-town" data-value="'+esc(p.id)+'">この地区</button></div>':'')+'</div>':'';
    return '<div class="lp-toggles">'+landAreaSelect()+landSeg('lp-map-use',M.use,[['res','住宅地'],['com','商業地']])+'</div>'+
      '<div class="lp-map" data-map><div class="lp-map-layer" data-map-layer>'+tiles+marks+'</div>'+
        '<div class="lp-map-zoom"><button data-act="lp-map-zoom" data-value="1" aria-label="拡大">＋</button><button data-act="lp-map-zoom" data-value="-1" aria-label="縮小">−</button><button data-act="lp-map-home" aria-label="全体を表示">⌂</button></div>'+
        '<span class="lp-map-count">'+count+'地点</span>'+(p?'':'<div class="lp-map-legend">'+LAND_MAP_BANDS.map((b,i)=>'<span class="b'+i+'">'+b[1]+'</span>').join('')+'<em>万円/坪</em></div>')+card+
        '<a class="lp-map-attr" href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a></div>';
  }
  function landMapFit(){
    const ok=new Set((landData?.cities||[]).filter(landCityIn).map(c=>c.code));
    const pts=(landData?.points||[]).filter(p=>ok.has(p.cityCode)&&Number.isFinite(p.lat));
    const base={...(ui.map||landMapDefault()),sel:null};
    if(!pts.length||state.land.filter==='all'){ui.map={...landMapDefault(),use:base.use};return;}
    const la=pts.map(p=>p.lat),lo=pts.map(p=>p.lon),[x1,y1]=landProj(Math.max(...la),Math.min(...lo),10),[x2,y2]=landProj(Math.min(...la),Math.max(...lo),10);
    const W=Math.min(window.innerWidth||390,500)-40,H=Math.max(240,(window.innerHeight||800)-300);
    const z=Math.max(7,Math.min(15,Math.floor(10+Math.log2(Math.min(W/Math.max(1,x2-x1),H/Math.max(1,y2-y1))))));
    const [lat,lon]=landUnproj((x1+x2)/2,(y1+y2)/2,10);
    ui.map={...base,lat,lon,z};
  }
  function landMapFocus(lat,lon,z){
    ui.map={...(ui.map||landMapDefault()),lat,lon,z,sel:null};
    state.land.view='map';ui.overlay='';save();
  }
  // 地図のドラッグ・ピンチ（指を離したら描き直す）
  const landDrag={pts:new Map(),sx:0,sy:0,d0:0,dx:0,dy:0,s:1,moved:false,at:0};
  function landMapDown(e){
    const map=e.target.closest?.('[data-map]');if(!map)return;
    landDrag.pts.set(e.pointerId,[e.clientX,e.clientY]);
    if(landDrag.pts.size===1){landDrag.sx=e.clientX;landDrag.sy=e.clientY;landDrag.dx=0;landDrag.dy=0;landDrag.s=1;landDrag.moved=false;}
    if(landDrag.pts.size===2){const [a,b]=[...landDrag.pts.values()];landDrag.d0=Math.hypot(a[0]-b[0],a[1]-b[1])/landDrag.s;}
  }
  function landMapMove(e){
    if(!landDrag.pts.has(e.pointerId))return;
    landDrag.pts.set(e.pointerId,[e.clientX,e.clientY]);
    const layer=app.querySelector('[data-map-layer]');if(!layer)return;
    if(landDrag.pts.size===1){landDrag.dx=e.clientX-landDrag.sx;landDrag.dy=e.clientY-landDrag.sy;}
    else if(landDrag.pts.size===2&&landDrag.d0){const [a,b]=[...landDrag.pts.values()];landDrag.s=Math.max(.25,Math.min(8,Math.hypot(a[0]-b[0],a[1]-b[1])/landDrag.d0));}
    if(!landDrag.moved&&(Math.hypot(landDrag.dx,landDrag.dy)>6||landDrag.s!==1)){landDrag.moved=true;try{app.querySelector('[data-map]').setPointerCapture(e.pointerId);}catch(_){}}
    if(landDrag.moved){e.preventDefault?.();layer.style.transform='translate('+landDrag.dx+'px,'+landDrag.dy+'px) scale('+landDrag.s+')';}
  }
  function landMapUp(e){
    if(!landDrag.pts.has(e.pointerId))return;
    landDrag.pts.delete(e.pointerId);
    if(landDrag.pts.size)return;
    if(!landDrag.moved)return;
    landDrag.at=Date.now();
    const M=ui.map,[cx,cy]=landProj(M.lat,M.lon,M.z),[lat,lon]=landUnproj(cx-landDrag.dx/landDrag.s,cy-landDrag.dy/landDrag.s,M.z);
    const z=Math.max(6,Math.min(17,M.z+Math.round(Math.log2(landDrag.s))));
    ui.map={...M,lat:Math.max(20,Math.min(46,lat)),lon:Math.max(122,Math.min(154,lon)),z};
    render();
  }

  /* --- 候補地の比較 --- */
  const landTownKey=(code,name)=>code+'|'+name;
  function landTownStat(c,name){
    const ps=(landData?.points||[]).filter(p=>p.cityCode===c.code&&p.use==='住宅地'&&landTownOf(p,c)===name);
    if(!ps.length)return null;
    const avg=a=>{a=a.filter(landFinite);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;};
    const geo=ps.filter(p=>Number.isFinite(p.lat));
    return {sqm:avg(ps.map(p=>p.priceSqm)),chg:avg(ps.map(p=>p.chg)),chg5y:avg(ps.map(p=>p.chg5y)),n:ps.length,
      center:geo.length?{lat:avg(geo.map(p=>p.lat)),lon:avg(geo.map(p=>p.lon))}:null,
      station:ps.map(p=>p.station).find(Boolean)||''};
  }
  function landCandidates(){
    const L=state.land,out=[];
    for(const m of L.my){
      const c=landCity(m.city);if(!c)continue;
      out.push({id:'my:'+m.id,kind:'my',my:m,c,name:m.name||(m.town||c.name),sub:c.name+'・登録',sqm:m.price*10000/(m.tsubo*LAND_TSUBO),chg:c.residential?.all?.chg,chg5y:c.residential?.chg5y,n:null,center:Number.isFinite(m.lat)?{lat:m.lat,lon:m.lon}:landCentroids().get(c.code)});
    }
    for(const code of L.favorites){
      const c=landCity(code);if(!c)continue;
      const r=c.residential||{},all=r.all||{};
      out.push({id:code,kind:'city',c,name:c.name,sub:c.region,sqm:all.avgSqm||r.koji?.avgSqm||r.chosa?.avgSqm||null,chg:all.chg,chg5y:r.chg5y,n:all.count||0,center:landCentroids().get(code)});
    }
    for(const key of L.favTowns){
      const [code,name]=key.split('|'),c=landCity(code),s=c&&landTownStat(c,name);
      if(!s)continue;
      out.push({id:key,kind:'town',c,name:name,sub:c.name,sqm:s.sqm,chg:s.chg,chg5y:s.chg5y,n:s.n,center:s.center,station:s.station});
    }
    return out;
  }
  function landTotalFor(sqm){
    const S=state.land.sim,maker=S.maker==='avg'?landMakerAvg():(landMakerById(S.maker)||landMakerAvg());
    const land=landFinite(sqm)?sqm*LAND_TSUBO*S.landTsubo:0,body=(maker[S.grade]||maker.mid)*10000*S.floorTsubo,extra=body*LAND_EXTRA_RATE;
    return {land,total:(land+body+extra)*(1+LAND_COST_RATE)};
  }
  function landCompareScreen(){
    if(ui.lpCandTab!=='cmp')return landMyScreen();
    const cseg='<div class="lp-sub">'+landSeg('lp-cand-tab','cmp',[['my','登録した土地（'+state.land.my.length+'）'],['cmp','くらべる']],'lp-seg-fill')+'</div>';
    return cseg+landCompareInner();
  }
  function landCompareInner(){
    const cands=landCandidates(),C=state.land.commute,S=state.land.sim;
    if(!cands.length)return '<div class="lp-commute-empty">'+landEmptyArt('happy')+'<strong>候補地を比べられます</strong><span>土地を登録するか、ランキングや地区の画面で☆を押すと、ここに並びます。地価・総額・通勤を横に並べて比べられます。</span><button class="btn primary wide" data-act="lp-view" data-value="rank">ランキングから選ぶ</button></div>';
    const per=(window.innerWidth||390)<360?2:3,total=Math.max(1,Math.ceil(cands.length/per));
    ui.lpCmpPage=Math.max(0,Math.min(ui.lpCmpPage||0,total-1));
    const page=cands.slice(ui.lpCmpPage*per,(ui.lpCmpPage+1)*per);
    const rows=cands.map(x=>{const t=x.kind==='my'?(e=>({land:e.land,total:e.total}))(landMyEval(x.my)):landTotalFor(x.sqm),cm=landCommute(x.center);return {x,t,cm,lt:cm?t.land+cm.total:null};});
    const byId=new Map(rows.map(r=>[r.x.id,r]));
    const best=(f,dir=1)=>{const v=rows.map(f).filter(landFinite);return v.length>1?(dir>0?Math.min(...v):Math.max(...v)):null;};
    const metric=(label,f,fmt,dir)=>{const b=dir?best(f,dir):null;return '<span class="lp-cmp-label">'+label+'</span>'+page.map(x=>{const v=f(byId.get(x.id));return '<span class="lp-cmp-cell'+(b!=null&&v===b?' is-best':'')+'">'+fmt(v,byId.get(x.id))+'</span>';}).join('')+(page.length<per?'<span></span>'.repeat(per-page.length):'');};
    const tone=v=>'<b class="'+landTone(v)+'">'+landPct(v,1)+'</b>';
    const two=landActivePeople().length>1;
    return '<div class="lp-cmp" style="--cols:'+per+'">'+
      '<span class="lp-cmp-label lp-cmp-corner">'+cands.length+'件</span>'+page.map(x=>'<div class="lp-cmp-head"><button class="lp-cmp-name" data-act="'+(x.kind==='city'?'lp-open':x.kind==='my'?'lp-my-open':'lp-cmp-town')+'" data-value="'+esc(x.kind==='my'?x.my.id:x.id)+'"><b>'+esc(x.name.replace(/^名古屋市/,''))+'</b><small>'+esc(x.kind==='town'?x.sub.replace(/^名古屋市/,'名古屋 '):x.sub)+(x.kind==='town'?'・地区':'')+'</small></button>'+(x.kind==='my'?'':'<button class="lp-cmp-x" data-act="lp-cmp-remove" data-value="'+esc(x.id)+'" aria-label="'+esc(x.name)+'を候補から外す">×</button>')+'</div>').join('')+(page.length<per?'<span></span>'.repeat(per-page.length):'')+
      metric('坪単価',r=>r.x.sqm,v=>'<b>'+landPriceHtml(v,{unit:'tsubo'})+'</b>',1)+
      metric('前年比',r=>r.x.chg,v=>tone(v))+
      metric('5年の<br>変化',r=>r.x.chg5y,v=>tone(v))+
      metric('土地代',r=>r.t.land||null,(v,r)=>'<b>'+landMan(v)+'</b><small>'+(r.x.kind==='my'?Math.round(r.x.my.tsubo*LAND_TSUBO)+'㎡・広告':S.landTsubo+'坪・目安')+'</small>',1)+
      metric('総額の<br>目安',r=>r.t.total,v=>'<b>'+landMan(v)+'</b>',1)+
      (landHasWork()?
        metric('通勤'+(two?'<br>（2人計）':''),r=>r.cm?.minutes,(v,r)=>v==null?'—':'<b>'+v+'分</b>'+(two?'<small>'+esc(r.cm.parts.map(p=>p.label+p.minutes).join('・'))+'</small>':''),1)+
        metric('通勤費<br>（月）',r=>r.cm?.net,v=>v==null?'—':'<b>'+landYenText(v)+'</b>',1)+
        metric('土地＋<br>通勤'+C.years+'年',r=>r.lt,v=>'<b>'+landMan(v)+'</b>',1):
        '<button class="lp-cmp-commute" data-act="lp-commute-settings">勤務先を入れると通勤時間・費用も比べられます ›</button>')+
      metric('地点数',r=>r.x.n,(v,r)=>v==null?'<small>登録した土地</small>':v+'地点'+(v<3?'<small class="lp-ref">参考</small>':''))+
      '</div>'+
      '<div class="lp-foot">'+navPager(ui.lpCmpPage,total,'lp-cmp-page')+'</div>'+
      '<button class="lp-source" data-act="lp-view" data-value="sim">総額は「相場」の設定（建物'+S.floorTsubo+'坪・メーカー・グレード）で計算。緑はいちばん有利 ⓘ</button>';
  }
  function landV4Action(action,v){
    const L=state.land;
    if(action==='lp-word')return openOverlay('land-word',()=>{ui.lpWord=v;});
    if(action==='lp-map-zoom')return step(()=>{const M=ui.map||landMapDefault();ui.map={...M,z:Math.max(6,Math.min(17,M.z+(Number(v)||0)))};});
    if(action==='lp-map-home')return step(()=>{ui.map={...landMapDefault(),use:ui.map?.use||'res'};});
    if(action==='lp-map-use')return step(()=>{ui.map={...(ui.map||landMapDefault()),use:v==='com'?'com':'res',sel:null};});
    if(action==='lp-map-close')return step(()=>{ui.map={...ui.map,sel:null};});
    if(action==='lp-map-pt'){if(Date.now()-landDrag.at<400)return;return step(()=>{ui.map={...ui.map,sel:ui.map?.sel===v?null:v};});}
    if(action==='lp-map-town'){const p=(landData?.points||[]).find(x=>x.id===v),c=p&&landCity(p.cityCode);if(!c)return;
      return openOverlay('land-town',()=>{ui.lpCity=c.code;ui.lpAreaUse=p.use==='商業地'?'com':'res';ui.lpTown=landTownOf(p,c);});}
    if(action==='lp-map-city'){const c=landCity(v),pt=c&&landCentroids().get(c.code);if(pt)return step(()=>landMapFocus(pt.lat,pt.lon,13));return;}
    if(action==='lp-map-here'){const c=landCity(ui.lpCity),t=c&&landTownStat(c,ui.lpTown);if(t?.center)return step(()=>landMapFocus(t.center.lat,t.center.lon,15));return;}
    if(action==='lp-town-fav')return step(()=>{const k=landTownKey(ui.lpCity,ui.lpTown),on=L.favTowns.includes(k);
      L.favTowns=on?L.favTowns.filter(x=>x!==k):[...L.favTowns,k].slice(-20);save();message(on?'候補から外しました':'候補に追加しました（比較タブ）');});
    if(action==='lp-cmp-remove')return step(()=>{if(v.includes('|'))L.favTowns=L.favTowns.filter(x=>x!==v);else L.favorites=L.favorites.filter(x=>x!==v);save();});
    if(action==='lp-cmp-town'){const [code,name]=String(v).split('|');return openOverlay('land-town',()=>{ui.lpCity=code;ui.lpAreaUse='res';ui.lpTown=name;});}
    if(action==='lp-cmp-page'){const total=Math.max(1,Math.ceil(landCandidates().length/((window.innerWidth||390)<360?2:3)));return step(()=>changePage('lpCmpPage',total,Number(v)));}
    return false;
  }
  /* ===== 土地と建物の比率・お金の診断（r84） ===== */
  // 住宅金融支援機構「2025年度フラット35利用者調査」（2026年7月公表）・土地付注文住宅
  const LAND_STATS={
    year:'2025年度',
    areas:[['全国',5312.9,3737.6,1575.3],['東海圏',5324.6,3871.1,1453.5],['首都圏',6404.3,3814.3,2590.0],['近畿圏',5486.0,3601.7,1884.3],['その他',4750.8,3734.3,1016.5]],
    pref:{'愛知県':5830.4,'岐阜県':4938.6},
    income:742,ratio:7.8,burden:26.4,own:481.1,site:247.1,floorSqm:118.4
  };
  const LAND_TOKAI_PCT=Math.round(1453.5/5324.6*100);
  function landMoneyDefaults(){return {income:0,own:0,rate:1.2,years:35,tab:'me'};}
  function landMoneyNormalize(x){
    const d=landMoneyDefaults();x=x&&typeof x==='object'?x:{};
    const n=(k,lo,hi)=>{const v=Number(x[k]);return Number.isFinite(v)?Math.min(hi,Math.max(lo,Math.round(v*1000)/1000)):d[k];};
    return {income:n('income',0,10000),own:n('own',0,50000),rate:n('rate',0,10),years:n('years',5,50),tab:['stats','calc'].includes(x.tab)?x.tab:'me'};
  }
  const landPay=(loan,rate,years)=>{const r=rate/1200,n=years*12;return loan<=0?0:r?loan*r/(1-Math.pow(1+r,-n)):loan/n;};
  const landPV=(pay,rate,years)=>{const r=rate/1200,n=years*12;return r?pay*(1-Math.pow(1+r,-n))/r:pay*n;};
  function landRatioBar(pct,small){
    pct=Math.max(0,Math.min(100,Math.round(pct)));
    return '<div class="lp-ratio'+(small?' is-small':'')+'"><div class="lp-ratio-bar"><i style="width:'+pct+'%"><b>土地 '+pct+'%</b></i><em><b>建物 '+(100-pct)+'%</b></em><u style="left:'+LAND_TOKAI_PCT+'%" title="東海圏の平均"></u></div>'+
      '<small>▲ 東海圏の平均 土地'+LAND_TOKAI_PCT+':建物'+(100-LAND_TOKAI_PCT)+'（全国 30:70・首都圏 40:60）</small></div>';
  }
  function landMoney(){
    const r=landSimCalc(),M=state.land.money;
    if(!r)return null;
    const total=r.total,cost=r.cost,loan=Math.max(0,total-M.own*10000);
    const pay=landPay(loan,M.rate,M.years),income=M.income*10000;
    const burden=income>0?pay*12/income*100:null,mult=income>0?total/income:null;
    const max25=income>0?landPV(income*0.25/12,M.rate,M.years):null;
    const pay1=landPay(loan,M.rate+1,M.years);
    const pref=r.c.pref,prefAvg=LAND_STATS.pref[pref]?LAND_STATS.pref[pref]*10000:null;
    const pct=r.land&&(r.land+r.body+r.extra)?r.land/(r.land+r.body+r.extra)*100:null;
    const tips=[];
    if(income<=0)tips.push(['info','世帯年収を入れると、返済の負担が重すぎないかを判定します。']);
    else{
      if(burden<=20)tips.push(['good','返済負担率'+burden.toFixed(1)+'%。目安の25%を大きく下回り、ゆとりがあります。']);
      else if(burden<=25.05)tips.push(['good','返済負担率'+burden.toFixed(1)+'%。目安の25%以内です。']);
      else tips.push([burden<=30?'warn':'bad','返済負担率'+burden.toFixed(1)+'%で、目安の25%を超えています。借入を'+landMan(loan-max25)+'減らすと25%に収まります（25%なら借入'+landMan(max25)+'まで）。']);
      tips.push([mult>LAND_STATS.ratio?'warn':'good','年収倍率'+mult.toFixed(1)+'倍。土地付注文住宅を建てた人の平均は'+LAND_STATS.ratio+'倍です。']);
    }
    if(M.rate<3)tips.push(['warn','金利が1%上がると、月々の返済は'+landYenText(pay1-pay)+'増えて'+landYenText(pay1)+'になります（変動金利なら上がる前提で）。']);
    if(M.own*10000<cost)tips.push(['warn','諸費用（'+landMan(cost)+'）は現金で払うのが基本。自己資金'+(M.own?landMan(M.own*10000):'0円')+'では足りません（平均の自己資金は'+landMan(LAND_STATS.own*10000)+'）。']);
    if(prefAvg)tips.push([total>prefAvg*1.2?'warn':'info','総額は'+pref+'の平均'+landMan(prefAvg)+'より'+(total>=prefAvg?landMan(total-prefAvg)+'高い':landMan(prefAvg-total)+'安い')+'水準です。']);
    if(pct!=null){
      if(pct>40)tips.push(['warn','土地が総額の'+Math.round(pct)+'%。東海圏の平均（'+LAND_TOKAI_PCT+'%）より土地に寄っています。建物の性能（断熱・耐震）を削らないよう注意。']);
      else if(pct<15)tips.push(['info','土地が総額の'+Math.round(pct)+'%と少なめ。郊外なら通勤費や車の台数も合わせて考えましょう。']);
      else tips.push(['good','土地と建物の比率は'+Math.round(pct)+':'+(100-Math.round(pct))+'。東海圏の平均（'+LAND_TOKAI_PCT+':'+(100-LAND_TOKAI_PCT)+'）に近いバランスです。']);
    }
    tips.push(['info','地盤改良・外構・引っ越し・家具などで、見積もりから増えることが多いので、総額の5〜10%は予備費に。']);
    return {r,total,cost,loan,pay,burden,mult,max25,pay1,pct,tips};
  }
  function landMoneyScreen(){
    const M=state.land.money,x=landMoney();
    if(!x)return '<div class="lp-empty"><strong>データを読み込み中です</strong></div>';
    const tab=M.tab;
    const head='<div class="lp-sub">'+landSeg('lp-money-tab',tab,[['me','わが家の診断'],['calc','計算の根拠'],['stats','みんなの平均']],'lp-seg-fill')+'</div>';
    if(tab==='calc')return head+landMoneyBasis(x);
    if(tab==='stats'){
      const mx=Math.max(...LAND_STATS.areas.map(a=>a[1]),...Object.values(LAND_STATS.pref),x.total/10000);
      const bar=(label,v,cls,sub)=>'<div class="lp-st-row'+(cls?' '+cls:'')+'"><span>'+label+'</span><i><em style="width:'+(v/mx*100)+'%"></em></i><b>'+digits.format(Math.round(v))+'<small>万</small></b>'+(sub?'<small class="lp-st-sub">'+sub+'</small>':'')+'</div>';
      return head+'<div class="lp-stats">'+
        '<div class="lp-st-card"><span class="kicker">土地を買って注文住宅を建てた総額（平均）</span>'+
          bar('あなた',x.total/10000,'is-me',esc(x.r.c.name))+
          bar('愛知県',LAND_STATS.pref['愛知県'])+bar('岐阜県',LAND_STATS.pref['岐阜県'])+
          LAND_STATS.areas.slice(0,3).map(a=>bar(a[0],a[1],'',''+Math.round(a[3]/a[1]*100)+':'+Math.round(a[2]/a[1]*100))).join('')+'</div>'+
        '<div class="lp-st-grid">'+
          [['世帯年収',LAND_STATS.income+'万円'],['年収倍率',LAND_STATS.ratio+'倍'],['返済負担率',LAND_STATS.burden+'%'],['自己資金',Math.round(LAND_STATS.own)+'万円'],['敷地',Math.round(LAND_STATS.site/LAND_TSUBO)+'坪'],['延床（注文住宅）',Math.round(LAND_STATS.floorSqm/LAND_TSUBO)+'坪']].map(([k,v])=>'<div><span>'+k+'</span><b>'+v+'</b></div>').join('')+'</div>'+
        '<p class="lp-note">出典：住宅金融支援機構「'+LAND_STATS.year+'フラット35利用者調査」（2026年7月公表）。土地付注文住宅の平均（年収倍率・負担率などは全国）。右の数字は土地:建物の比率。</p></div>';
    }
    const f=(label,key,unit,attrs)=>'<label class="lp-sim-field"><span>'+label+'</span><span class="lp-sim-num"><input type="number" inputmode="decimal" data-lp-money="'+key+'" value="'+esc(M[key]||'')+'" placeholder="0" '+attrs+'><i>'+unit+'</i></span></label>';
    const per=(window.innerHeight||800)<700?2:3,tips=x.tips,total=Math.max(1,Math.ceil(tips.length/per));
    ui.lpTipPage=Math.max(0,Math.min(ui.lpTipPage||0,total-1));
    const tile=(k,v,cls)=>'<div class="lp-mo-tile'+(cls?' '+cls:'')+'"><span>'+k+'</span><b>'+v+'</b></div>';
    const bcls=x.burden==null?'':x.burden<=25?'is-good':x.burden<=30?'is-warn':'is-bad';
    return head+
      '<button class="lp-money-src" data-act="lp-go" data-value="sim">総額 <b>'+landMan(x.total)+'</b> は「総額を計算」の結果（'+esc(x.r.c.name)+'） <em>変える ›</em></button>'+
      '<div class="lp-sim-form">'+f('世帯年収（税込）','income','万円','min="0" max="10000" step="10"')+f('自己資金（頭金）','own','万円','min="0" max="50000" step="10"')+
        f('金利','rate','%','min="0" max="10" step="0.05"')+f('返済年数','years','年','min="5" max="50" step="1"')+
        '<div class="lp-sim-field lp-sim-wide">'+landSeg('lp-money-rate',M.rate===1.2?'v':M.rate===3.5?'t':M.rate===3.81?'f':'',[['v','変動 1.2%'],['t','10年固定 3.5%'],['f','全期間 3.81%']],'lp-seg-fill')+'</div></div>'+
      '<div class="lp-mo-tiles">'+tile('総額（'+(x.r.mode==='budget'?'予算':'相場')+'）',landMan(x.total))+tile('借入',landMan(x.loan))+tile('月々の返済',landYenText(x.pay))+
        tile('返済負担率',x.burden==null?'—':x.burden.toFixed(1)+'%',bcls)+'</div>'+
      '<button class="lp-loan-link" data-act="lp-loan-open" data-value="money">利息の合計 '+landMan(landLoanStats(x.loan,M.rate,M.years).interest)+'・金利の種類と比較を見る ›</button>'+
      '<div class="lp-tips">'+tips.slice(ui.lpTipPage*per,(ui.lpTipPage+1)*per).map(([lv,t],i)=>'<div class="lp-tip '+lv+'" style="--i:'+i+'">'+landMascot(({good:'happy',warn:'think',bad:'worry',info:'normal'})[lv],30,false)+'<p>'+esc(t)+'</p></div>').join('')+'</div>'+
      '<div class="lp-foot">'+navPager(ui.lpTipPage,total,'lp-tip-page')+'</div>'+
      '';
  }
  function landV6Action(action,v){
    const L=state.land;
    if(action==='lp-pct-fine')return step(()=>{ui.lpPctFine=!ui.lpPctFine;});
    if(action==='lp-sim-more')return step(()=>{ui.lpSimMore=!ui.lpSimMore;});
    if(action==='lp-sim-mode')return step(()=>{L.sim=landSimNormalize({...L.sim,mode:v});save();});
    if(action==='lp-ratio-fit')return step(()=>{L.sim=landSimNormalize({...L.sim,landPct:Number(v)});save();});
    if(action==='lp-money-tab')return step(()=>{L.money=landMoneyNormalize({...L.money,tab:v});save();});
    if(action==='lp-money-rate')return step(()=>{L.money=landMoneyNormalize({...L.money,rate:v==='f'?3.81:v==='t'?3.5:1.2});save();});
    if(action==='lp-tip-page'){const x=landMoney(),per=(window.innerHeight||800)<700?2:3;return step(()=>changePage('lpTipPage',Math.max(1,Math.ceil((x?.tips.length||1)/per)),Number(v)));}
    return false;
  }
  /* ===== 広さの目安（r85） ===== */
  // 国土交通省「住生活基本計画（全国計画）」の居住面積水準（4人以上・戸建ての目安）と、2025年度フラット35利用者調査の平均
  const LAND_SIZE_STATS={orderFloor:118.4,orderSite:247.1,specFloor:100.4,specSite:131.5};
  function landSizeDefaults(){return {people:4,cars:2,floors:2,garden:'small',bcr:60};}
  function landSizeNormalize(x){
    const d=landSizeDefaults();x=x&&typeof x==='object'?x:{};
    const n=(k,lo,hi)=>{const v=Math.round(Number(x[k]));return Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):d[k];};
    return {people:n('people',1,8),cars:n('cars',0,4),floors:[1,2,3].includes(Number(x.floors))?Number(x.floors):d.floors,
      garden:['none','small','large'].includes(x.garden)?x.garden:d.garden,bcr:[40,50,60,70,80].includes(Number(x.bcr))?Number(x.bcr):d.bcr};
  }
  function landSizeCalc(){
    const Z=state.land.size,p=Z.people;
    const min=p===1?25:10*p+10,city=p===1?40:20*p+15,general=p===1?55:25*p+25;
    const floor=general;                                  // 郊外の戸建ては一般型を目安
    const foot=Z.floors===1?floor:Z.floors===2?floor*0.55:floor*0.4;
    const byBcr=foot/(Z.bcr/100);
    const practical=foot+Z.cars*15+({none:0,small:15,large:40})[Z.garden]+foot*0.3;
    const site=Math.max(byBcr,practical);
    const c=landSimCity(),areas=(landData?.points||[]).filter(x=>x.cityCode===c?.code&&x.use==='住宅地'&&x.area>0).map(x=>x.area);
    const cityLot=areas.length>=3?landMedian(areas):null;
    return {min,city,general,floor,foot,byBcr,practical,site,cityLot,cityName:c?.name||'',n:areas.length};
  }
  const landTb=sqm=>Math.round(sqm/LAND_TSUBO);
  function landSizeScale(items,mark,unit){
    const mx=Math.max(...items.map(x=>x[1]),mark)*1.08;
    return '<div class="lp-scale">'+items.map(([l,v,cls])=>'<div class="lp-scale-row'+(cls?' '+cls:'')+'"><span>'+l+'</span><i><em style="width:'+(v/mx*100)+'%"></em><u style="left:'+(mark/mx*100)+'%"></u></i><b>'+landTb(v)+'<small>坪</small></b></div>').join('')+'</div>';
  }
  function landSizeScreen(){
    const Z=state.land.size,x=landSizeCalc(),S=state.land.sim;
    const seg=(act,cur,opts)=>landSeg(act,String(cur),opts.map(([v,l])=>[String(v),l]),'lp-seg-fill');
    const row=(label,html)=>'<div class="lp-size-row"><span>'+label+'</span>'+html+'</div>';
    return modalFrame('広さの目安','<div class="panel detail grow lp-size">'+
      '<div class="lp-size-form">'+
        row('家族の人数',seg('lp-size-people',Z.people,[[2,'2人'],[3,'3人'],[4,'4人'],[5,'5人'],[6,'6人']]))+
        row('車の台数',seg('lp-size-cars',Z.cars,[[0,'0台'],[1,'1台'],[2,'2台'],[3,'3台']]))+
        row('階数',seg('lp-size-floors',Z.floors,[[2,'2階建て'],[1,'平屋'],[3,'3階建て']]))+
        row('庭',seg('lp-size-garden',Z.garden,[['none','なし'],['small','小さめ'],['large','広め']]))+
        row('建ぺい率',seg('lp-size-bcr',Z.bcr,[[50,'50%'],[60,'60%'],[80,'80%']]))+
      '</div>'+
      '<div class="lp-size-result"><div><span>建物（延床）の目安</span><strong>'+landTb(x.floor)+'<small>坪</small></strong><em>'+Math.round(x.floor)+'㎡・'+Z.people+'人で'+(Z.people>=4?'4LDK':Z.people===3?'3LDK':'2LDK')+'くらい</em></div>'+
        '<div><span>土地の目安</span><strong>'+landTb(x.site)+'<small>坪〜</small></strong><em>'+Math.round(x.site)+'㎡・車'+Z.cars+'台'+(Z.garden!=='none'?'＋庭':'')+'</em></div></div>'+
      landSay(Z.people+'人家族・車'+Z.cars+'台なら、建物<b>'+landTb(x.floor)+'坪</b>・土地<b>'+landTb(x.site)+'坪</b>くらいがゆとりのある目安だよ！','happy','lp-size-say')+
      '<span class="kicker">建物の広さの指標</span>'+
      landSizeScale([['最低限',x.min],['都市の目安',x.city],['ゆとり',x.general,'is-me'],['注文住宅の平均',LAND_SIZE_STATS.orderFloor],['建売の平均',LAND_SIZE_STATS.specFloor]],x.floor)+
      '<span class="kicker">土地の広さの指標</span>'+
      landSizeScale([['あなた',x.site,'is-me'],['建売の平均',LAND_SIZE_STATS.specSite]].concat(x.cityLot?[[x.cityName.replace(/^名古屋市/,'')+'の標準',x.cityLot]]:[]).concat([['注文住宅の平均',LAND_SIZE_STATS.orderSite]]),x.site)+
      '<div class="lp-detail-actions"><button class="btn primary flex1" data-act="lp-size-apply">この広さで'+(state.land.view==='find'?'探す':'総額を計算')+'（土地'+landTb(x.site)+'坪・建物'+landTb(x.floor)+'坪）</button></div>'+
      '<p class="lp-note">建物は国の「住生活基本計画」の居住面積水準（最低限＝10㎡×人数＋10㎡、都市の目安＝20㎡×人数＋15㎡、ゆとり＝25㎡×人数＋25㎡）。土地は建物の1階部分＋車1台15㎡＋庭＋すき間（1階の3割）と、建ぺい率から必要な広さの大きいほう。平均は2025年度フラット35利用者調査（全国。注文住宅の敷地は郊外を含むため広め）、標準は地価公示・地価調査の住宅地の地積の中央値。</p>'+
      '</div>');
  }
  function landSizeHint(){
    const x=landSizeCalc();
    return '<button class="lp-size-hint lp-sim-wide" data-act="lp-size-open">📏 広さの目安：'+state.land.size.people+'人・車'+state.land.size.cars+'台なら 建物'+landTb(x.floor)+'坪・土地'+landTb(x.site)+'坪〜 ›</button>';
  }
  function landV7Action(action,v){
    const L=state.land;
    if(action==='lp-size-open')return openOverlay('land-size');
    if(action==='lp-help'){if(ui.overlay==='land-help')return step(()=>{ui.lpHelp=v;});const back=ui.overlay==='land-maker'?'land-maker':null;return openOverlay('land-help',()=>{ui.lpHelp=v||'seis';ui.lpHelpBack=back;});}
    const map={'lp-size-people':'people','lp-size-cars':'cars','lp-size-floors':'floors','lp-size-garden':'garden','lp-size-bcr':'bcr'};
    if(map[action])return step(()=>{L.size=landSizeNormalize({...L.size,[map[action]]:v});save();});
    if(action==='lp-size-apply'&&L.view==='find')return step(()=>{ui.overlay='';message('この広さで探します');});
    if(action==='lp-size-apply')return step(()=>{const x=landSizeCalc();L.sim=landSimNormalize({...L.sim,mode:'cond',landTsubo:landTb(x.site),floorTsubo:landTb(x.floor)});L.view='sim';ui.overlay='';save();message('土地'+landTb(x.site)+'坪・建物'+landTb(x.floor)+'坪で計算しました');});
    return false;
  }
  /* ===== 性能の見方（r86） ===== */
  const LAND_HELP=[
    {k:'seis',t:'耐震（耐震等級）',d:'地震に対する家の強さを、国の基準で3段階にしたもの。数字が大きいほど強い。',
      lv:[['等級1','建築基準法の最低限。震度6強〜7でもすぐには倒れない'],['等級2','等級1の1.25倍の強さ（学校・病院なみ）'],['等級3','等級1の1.5倍。消防署・警察署なみで、いちばん上']],
      foot:'このアプリの「耐震 等級3」は、その会社が標準としている等級（相当を含む）。正式な等級は契約前に「住宅性能評価書」で確認。'},
    {k:'damp',t:'制震・免震',d:'耐震（家を強くする）に加えて、揺れそのものを小さくする仕組み。',
      lv:[['耐震','柱や壁を強くして揺れに耐える。すべての家の基本'],['制震','壁の中の装置（ダンパー）が揺れを吸収。くり返しの地震で傷みにくい'],['免震','建物と地面の間に装置を入れ、揺れを伝えにくくする。費用は高め']],
      foot:'「制震あり」は、その会社が制震の仕組みを標準またはおすすめとして用意していることを示します。'},
    {k:'ins',t:'断熱（断熱等級）',d:'家から熱が逃げにくいかを、国の基準で7段階にしたもの。数字が大きいほど冬は暖かく夏は涼しく、冷暖房費が安くなる。',
      lv:[['等級4','最低ライン。2025年4月からすべての新築で義務（UA値0.87）'],['等級5','省エネ住宅（ZEH）の水準。2030年に最低ラインになる予定（0.60）'],['等級6','等級4より冷暖房のエネルギーを約3割減らせる水準（0.46）'],['等級7','いちばん上。約4割減らせる水準（0.26）']],
      foot:'UA値は家全体から逃げる熱の量で、小さいほど高性能。（ ）内は愛知県の多くの地域（6地域）の基準値。'},
    {k:'air',t:'気密（すき間の少なさ）',d:'家のすき間の量。C値（床1㎡あたりのすき間の面積）で表し、小さいほどすき間が少なく、断熱や換気がきちんと働く。家ごとに測らないとわからない。',
      lv:[['C値2.0前後','一般的な家の目安'],['C値1.0以下','「高気密」と言える目安'],['C値0.5以下','かなり高い気密']],
      foot:'「気密測定」は、すべての家で引き渡し前にすき間を測っている会社。測定していれば数値を出してもらえます。'},
    {k:'war',t:'保証（初期保証）',d:'引き渡しのあと、柱・基礎などの構造と雨漏りを無料で直してもらえる期間。',
      lv:[['10年','法律で義務。どの会社でも最低10年'],['20年','中堅のメーカーに多い'],['30年以上','大手のメーカーに多い']],
      foot:'「最長60年」などは、有料の点検や補修を受けて延長した場合の最長期間。初期保証の年数で比べるのが公平です。'}
  ];
  const LAND_HELP_MARKS='◎＝とても良い　○＝良い　△＝ふつう　—＝公表なし';
  function landHelpScreen(){
    const h=LAND_HELP.find(x=>x.k===ui.lpHelp)||LAND_HELP[0];
    return modalFrame('性能の見方','<div class="panel detail grow lp-help">'+
      '<div class="lp-sub">'+landSeg('lp-help',h.k,LAND_HELP.map(x=>[x.k,x.t.replace(/（.*$/,'')]),'lp-seg-fill')+'</div>'+
      '<div class="lp-help-card"><div class="lp-help-title">'+landMascot('think',36)+'<b>'+esc(h.t)+'</b></div><p>'+esc(h.d)+'</p>'+
        '<div class="lp-help-lv">'+h.lv.map(([a,b],i)=>'<div style="--i:'+i+'"><span>'+esc(a)+'</span><p>'+esc(b)+'</p></div>').join('')+'</div>'+
        '<p class="lp-help-foot">'+esc(h.foot)+'</p></div>'+
      '<p class="lp-note">'+LAND_HELP_MARKS+'（メーカー詳細の5つの評価）</p></div>');
  }
  /* ===== 予算から探す（r87） ===== */
  function landFindDefaults(){return {budget:5000,landTsubo:0,floorTsubo:0,grade:'mid',tab:'place',sort:'best',mode:'monthly',monthly:12,open:0,step:1,type:'order'};}
  function landFindNormalize(x){
    const d=landFindDefaults();x=x&&typeof x==='object'?x:{};
    const n=(k,lo,hi)=>{const v=Math.round(Number(x[k]));return Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):d[k];};
    return {budget:n('budget',500,30000),landTsubo:n('landTsubo',0,300),floorTsubo:n('floorTsubo',0,150),
      grade:['low','mid','high'].includes(x.grade)?x.grade:'mid',tab:x.tab==='maker'?'maker':'place',sort:['best','room','commute','cheap'].includes(x.sort)?x.sort:'best',
      mode:x.mode==='total'?'total':'monthly',monthly:(v=>Number.isFinite(v)?Math.min(100,Math.max(1,Math.round(v*10)/10)):d.monthly)(Number(x.monthly)),open:x.open?1:0,step:[0,1,2,3,4].includes(Number(x.step))&&x.step!==undefined?Number(x.step):1,type:['order','ready','both'].includes(x.type)?x.type:'order'};
  }
  function landFindBudget(){
    const F=state.land.find,M=state.land.money;
    if(F.mode==='total')return {total:F.budget,loan:Math.max(0,F.budget-M.own),own:M.own};
    const loan=Math.round(landPV(F.monthly*10000,M.rate,M.years)/10000);
    return {total:loan+M.own,loan,own:M.own};
  }
  function landFindSizes(){
    const F=state.land.find,z=landSizeCalc();
    return {land:F.landTsubo||landTb(z.site),floor:F.floorTsubo||landTb(z.floor),auto:!F.landTsubo&&!F.floorTsubo};
  }
  const LAND_FIT=[[100,'大手の上位も','top'],[85,'大手も','big'],[70,'中堅まで','mid'],[55,'ローコスト','low'],[40,'ギリギリ','min']];
  const landFitOf=u=>LAND_FIT.find(f=>u>=f[0])||null;
  function landFindCities(){
    const F=state.land.find,sz=landFindSizes(),net=landFindBudget().total*10000/(1+LAND_COST_RATE),cent=landCentroids();
    return (landData?.cities||[]).filter(landCityIn).map(c=>{
      const sqm=c.residential?.all?.avgSqm||c.residential?.koji?.avgSqm||c.residential?.chosa?.avgSqm;
      if(!sqm)return null;
      const land=sqm*LAND_TSUBO*sz.land,body=(net-land)/(1+LAND_EXTRA_RATE),unit=body/(sz.floor*10000);
      const makers=LAND_MAKERS.filter(m=>m[F.grade]<=unit);
      return {c,sqm,land,body,unit,fit:makers.length?landFitOf(unit):null,makers,cm:landCommute(cent.get(c.code))};
    }).filter(Boolean);
  }
  function landPerfSum(m){const s=landSpecScore(m);return (s.seis||0)+(s.ins||0)+(s.air||0)+(s.war||0);}
  function landFindScreen(){return state.land.find.step?landFindWizard():landFindResult();}
  function landFindCityScreen(){
    const F=state.land.find,x=landFindCities().find(v=>v.c.code===ui.lpFindCity),sz=landFindSizes();
    if(!x)return modalFrame('おすすめ',empty('◔','データがありません',''));
    const ms=x.makers.slice().sort((a,b)=>landPerfSum(b)-landPerfSum(a)||b.mid-a.mid).slice(0,(window.innerHeight||800)<700?4:5);
    const towns=(()=>{const g=new Map();for(const p of landData.points){if(p.cityCode!==x.c.code||p.use!=='住宅地')continue;const t=landTownOf(p,x.c);if(!g.has(t))g.set(t,[]);g.get(t).push(p.priceSqm);}
      return [...g].map(([t,a])=>[t,a.reduce((s,v)=>s+v,0)/a.length]).sort((a,b)=>a[1]-b[1]).slice(0,3);})();
    return modalFrame(x.c.name+'で建てるなら','<div class="panel detail grow lp-find-detail">'+
      '<div class="lp-size-result"><div><span>土地 '+sz.land+'坪（平均 坪'+(x.sqm*LAND_TSUBO/10000).toFixed(1)+'万）</span><strong>'+landMan(x.land)+'</strong><em>'+esc(x.c.region)+(x.cm?'・通勤'+x.cm.minutes+'分':'')+'</em></div>'+
        '<div><span>建物本体に使える</span><strong>'+Math.floor(x.unit)+'<small>万/坪</small></strong><em>'+sz.floor+'坪で'+landMan(x.body)+'</em></div></div>'+
      '<span class="kicker">建てられるメーカー（性能の高い順・'+x.makers.length+'社中）</span>'+
      '<div class="lp-find-list">'+(ms.length?ms.map(m=>'<button class="lp-find-item" data-act="lp-find-go" data-value="'+esc(x.c.code+'|'+m.id)+'"><span><b>'+esc(m.name)+'</b><small class="lp-bds">'+(landMakerBadges(m)||esc(m.type))+'</small></span><em>坪'+m[F.grade]+'万 ›</em></button>').join(''):'<p class="lp-note">この場所では予算内のメーカーがありません。</p>')+'</div>'+
      (towns.length?'<p class="lp-find-towns">この市で地価が安めの地区：'+towns.map(([t,v])=>esc(t)+'（坪'+(v*LAND_TSUBO/10000).toFixed(1)+'万）').join('・')+'</p>':'')+
      '<p class="lp-note">メーカーをタップすると「家の総額」でこの組み合わせを計算します。坪単価は仕様の'+({low:'下限',mid:'目安',high:'上限'})[F.grade]+'。</p></div>');
  }
  function landFindMakerScreen(){
    const F=state.land.find,m=landMakerById(ui.lpFindMaker);
    if(!m)return modalFrame('おすすめ',empty('◔','見つかりません',''));
    const cs=landFindCities().filter(x=>x.fit&&x.makers.includes(m));
    const list=cs.slice().sort(landHasWork()?(a,b)=>(a.cm?.minutes??9999)-(b.cm?.minutes??9999):(a,b)=>b.sqm-a.sqm).slice(0,(window.innerHeight||800)<700?5:6);
    return modalFrame(m.name+'で建てるなら','<div class="panel detail grow lp-find-detail">'+
      '<div class="lp-size-result"><div><span>建物本体の坪単価（'+({low:'下限',mid:'目安',high:'上限'})[F.grade]+'）</span><strong>'+m[F.grade]+'<small>万/坪</small></strong><em>'+esc(m.band)+'・'+esc(m.type)+'</em></div>'+
        '<div><span>予算内で建てられる場所</span><strong>'+cs.length+'<small>か所</small></strong><em>総額'+landFindBudget().total.toLocaleString()+'万円の場合</em></div></div>'+
      '<span class="kicker">おすすめの場所（'+(landHasWork()?'通勤が近い順':'便利な＝地価が高い順')+'）</span>'+
      '<div class="lp-find-list">'+list.map(x=>'<button class="lp-find-item" data-act="lp-find-go" data-value="'+esc(x.c.code+'|'+m.id)+'"><span><b>'+esc(x.c.name)+'</b><small>土地'+landMan(x.land)+(x.cm?'・通勤'+x.cm.minutes+'分':'・'+esc(x.c.region))+'</small></span><em>残り坪'+Math.floor(x.unit)+'万 ›</em></button>').join('')+'</div>'+
      '<p class="lp-note">「残り坪◯万」はその場所で建物本体にかけられる坪単価。この会社の坪単価より大きいほどゆとりがあります。</p></div>');
  }
  function landV9Action(action,v){
    const L=state.land;
    if(action==='lp-find-open')return step(()=>{L.find=landFindNormalize({...L.find,open:L.find.open?0:1});save();});
    if(action==='lp-find-mode')return step(()=>{const B=landFindBudget();L.find=landFindNormalize({...L.find,mode:L.find.mode==='monthly'?'total':'monthly',budget:B.total});ui.lpFindPage=0;save();});
    if(action==='lp-find-tab')return step(()=>{L.find=landFindNormalize({...L.find,tab:v});ui.lpFindPage=0;save();});
    if(action==='lp-find-page'){const ok=landFindCities().filter(x=>x.fit),n=state.land.find.tab==='maker'?LAND_MAKERS.filter(m=>ok.some(x=>x.makers.includes(m))).length:ok.length;const per=Math.max(4,landPerPage()-(state.land.find.tab==='maker'?4:5));return step(()=>changePage('lpFindPage',Math.max(1,Math.ceil(n/per)),Number(v)));}
    if(action==='lp-find-city')return openOverlay('land-find-city',()=>{ui.lpFindCity=v;});
    if(action==='lp-find-maker')return openOverlay('land-find-maker',()=>{ui.lpFindMaker=v;});
    if(action==='lp-help-find')return message('総額から諸費用10%を引き、土地代を引いた残りを建物（本体＋付帯工事25%）に使う計算です');
    if(action==='lp-find-go'){const [code,mid]=String(v).split('|'),sz=landFindSizes();
      return step(()=>{L.sim=landSimNormalize({...L.sim,mode:'cond',city:code,maker:mid,grade:L.find.grade,landTsubo:sz.land,floorTsubo:sz.floor});L.view='sim';ui.lastCalc='sim';ui.overlay='';save();message('家の総額で計算しました');});}
    return false;
  }
  /* ===== 金利と返済の詳細（r89） ===== */
  // 2026年11月の目安：変動＝主要銀行の低い水準（三菱UFJ銀行 1.195%）、10年固定＝主要銀行（みずほ銀行 2026年9月 3.45%）、全期間固定＝フラット35（買取型）3.81%
  const LAND_RATES=[
    {k:'v',rate:1.2,t:'変動金利',sub:'1.2%前後（2026年11月・主要銀行の低い水準）',
      pros:['いまの金利がいちばん低い','繰り上げ返済の手数料が無料の銀行が多い'],
      cons:['半年ごとに金利が見直され、日銀の利上げで上がる（2026年9月にも利上げ）','上がると返済額や利息が増える。多くの銀行は返済額を5年ごとに見直し']},
    {k:'t',rate:3.5,t:'10年固定',sub:'3%台半ば（2026年9月 みずほ銀行3.45%）',
      pros:['10年間は金利と返済額が変わらない','子どもが小さい時期の家計が読みやすい'],
      cons:['11年目からは、その時の金利になる','いまは変動より2%以上高い']},
    {k:'f',rate:3.81,t:'全期間固定（フラット35）',sub:'3.81%（2026年11月・買取型）',
      pros:['35年間ずっと金利と返済額が変わらない','金利上昇の心配がない。子育て世帯などは当初5年の金利引き下げあり'],
      cons:['いまの3つの中で金利がいちばん高い','金利が下がっても返済額は下がらない']}
  ];
  function landLoanBase(){
    const M=state.land.money;
    const loan=ui.lpLoanSrc==='money'?(landMoney()?.loan||0):landFindBudget().loan*10000;
    return {loan,rate:M.rate,years:M.years};
  }
  function landLoanStats(loan,rate,years){
    const pay=landPay(loan,rate,years),total=pay*years*12,interest=Math.max(0,total-loan);
    const r=rate/1200,bal=[];let b=loan,firstInt=0;
    for(let m=1;m<=years*12;m++){const i=b*r;if(m<=12)firstInt+=i;b=Math.max(0,b-(pay-i));if(m%60===0||m===years*12)bal.push([Math.ceil(m/12),b]);}
    return {pay,total,interest,firstPct:pay?firstInt/(pay*12)*100:0,bal:[[0,loan]].concat(bal.filter((x,i,a)=>a.findIndex(y=>y[0]===x[0])===i))};
  }
  const landYenFull=yen=>Number.isFinite(yen)?digits.format(Math.round(yen/100)*100)+'円':'—';
  function landLoanScreen(){
    const M=state.land.money,{loan,rate,years}=landLoanBase(),x=landLoanStats(loan,rate,years),tab=ui.lpLoanTab||'detail';
    const seg='<div class="lp-sub">'+landSeg('lp-loan-tab',tab,[['detail','返済の内訳'],['compare','金利で比べる'],['type','金利の種類']],'lp-seg-fill')+'</div>';
    const rateSeg='<div class="lp-loan-ctrl">'+landSeg('lp-money-rate',LAND_RATES.find(r=>r.rate===M.rate)?.k||'',LAND_RATES.map(r=>[r.k,(r.k==='v'?'変動':r.k==='t'?'10年固定':'全期間固定')+' '+r.rate+'%']),'lp-seg-fill')+
      landSeg('lp-loan-years',String(years),[['25','25年'],['30','30年'],['35','35年'],['40','40年']],'lp-seg-fill')+'</div>';
    let body='';
    if(tab==='compare'){
      const rates=[0.8,1.2,1.5,2,2.5,3,3.5,3.81,4.5];if(!rates.includes(rate))rates.push(rate);rates.sort((a,b)=>a-b);
      const base=landLoanStats(loan,rate,years);
      body='<div class="lp-loan-table"><span>金利</span><span>月々</span><span>利息の合計</span><span>差（利息）</span>'+rates.map(rt=>{const s=landLoanStats(loan,rt,years),cur=rt===rate;
        return '<b class="'+(cur?'is-cur':'')+'">'+rt+'%'+(cur?' ◀':'')+'</b><i class="'+(cur?'is-cur':'')+'">'+landYenFull(s.pay)+'</i><i class="'+(cur?'is-cur':'')+'">'+landMan(s.interest)+'</i><i class="'+(cur?'is-cur':'')+(s.interest>base.interest?' up':' down')+'">'+(cur?'—':(s.interest>base.interest?'+':'−')+landMan(Math.abs(s.interest-base.interest)))+'</i>';}).join('')+'</div>'+
        '<p class="lp-note">借入'+landMan(loan)+'・'+years+'年・元利均等返済。変動金利は途中で金利が変わるため、上の表は「ずっとその金利だった場合」の目安です。</p>';
    }else if(tab==='type'){
      body='<div class="lp-loan-types">'+LAND_RATES.map(r=>{const s=landLoanStats(loan,r.rate,years);return '<div class="lp-loan-type'+(r.rate===rate?' is-cur':'')+'"><div class="lp-loan-type-top"><b>'+esc(r.t)+'</b><span>'+esc(r.sub)+'</span></div>'+
        '<div class="lp-loan-type-num"><span>月々 <b>'+landYenFull(s.pay)+'</b></span><span>利息 <b>'+landMan(s.interest)+'</b></span>'+(r.rate===rate?'<em>計算中</em>':'<button class="btn compact" data-act="lp-money-rate" data-value="'+r.k+'">この金利で計算</button>')+'</div>'+
        '<ul><li class="ok">'+r.pros.map(esc).join('</li><li class="ok">')+'</li><li class="ng">'+r.cons.map(esc).join('</li><li class="ng">')+'</li></ul></div>';}).join('')+'</div>';
    }else{
      const mx=loan||1,pi=x.total?x.interest/x.total*100:0;
      body='<div class="lp-loan-tiles"><div><span>借りる額</span><b>'+landMan(loan)+'</b></div><div><span>月々の返済</span><b>'+landYenFull(x.pay)+'</b></div>'+
        '<div><span>返す総額</span><b>'+landMan(x.total)+'</b></div><div class="is-int"><span>そのうち利息</span><b>'+landMan(x.interest)+'</b></div></div>'+
        '<div class="lp-loan-split"><i style="width:'+(100-pi)+'%"><b>元金 '+Math.round(100-pi)+'%</b></i><em><b>利息 '+Math.round(pi)+'%</b></em></div>'+
        '<span class="kicker">借りている額（残高）の減り方</span>'+
        '<div class="lp-loan-bal">'+x.bal.map(([y,b])=>'<div><i><em style="height:'+(b/mx*100)+'%"></em></i><b>'+(b>=1e4?Math.round(b/1e4).toLocaleString():0)+'</b><span>'+y+'年</span></div>').join('')+'</div>'+
        landSay('最初の1年は、返済の<b>'+Math.round(x.firstPct)+'%</b>が利息だよ。'+(rate<3?'金利が1%上がると、利息は<b>'+landMan(landLoanStats(loan,rate+1,years).interest-x.interest)+'</b>増えるから気をつけてね。':'固定金利なら、この先ずっと同じ返済額で安心！'),rate<3?'think':'happy','lp-loan-say');
    }
    return modalFrame('金利と返済の詳細','<div class="panel detail grow lp-loan">'+seg+rateSeg+'<p class="lp-loan-head">金利 <b>'+rate+'%</b>・'+years+'年・借入 <b>'+landMan(loan)+'</b></p>'+body+'</div>');
  }
  function landV10Action(action,v){
    const L=state.land;
    if(action==='lp-loan-open')return openOverlay('land-loan',()=>{ui.lpLoanSrc=v==='money'?'money':'find';ui.lpLoanTab='detail';});
    if(action==='lp-loan-tab')return step(()=>{ui.lpLoanTab=['detail','compare','type'].includes(v)?v:'detail';});
    if(action==='lp-loan-years')return step(()=>{L.money=landMoneyNormalize({...L.money,years:Number(v)});save();});
    return false;
  }
  /* ===== キャラクター「チカしらべくん」（r89・オリジナル） ===== */
  function landMascot(mood='happy',size=40,glass=true){
    const eyes=mood==='happy'?'<path d="M21.5 40.5q3-3.6 6 0M36.5 40.5q3-3.6 6 0" fill="none" stroke="#173e32" stroke-width="2.4" stroke-linecap="round"/>':
      '<circle cx="25" cy="40" r="2.6" fill="#173e32"/><circle cx="39" cy="40" r="2.6" fill="#173e32"/><circle cx="25.9" cy="39.1" r=".9" fill="#fff"/><circle cx="39.9" cy="39.1" r=".9" fill="#fff"/>';
    const mouth={happy:'M27 46q5 5 10 0',normal:'M28 46.5q4 2.4 8 0',think:'M28 47l8-1.4',worry:'M27.5 49q4.5-4 9 0'}[mood]||'M28 46.5q4 2.4 8 0';
    const brow=mood==='worry'?'<path d="M21 35.5l6 1.6M43 35.5l-6 1.6" stroke="#173e32" stroke-width="1.6" stroke-linecap="round"/>':mood==='think'?'<path d="M36.5 35l6-1" stroke="#173e32" stroke-width="1.6" stroke-linecap="round"/>':'';
    return '<svg class="lp-mascot m-'+mood+'" width="'+size+'" height="'+size+'" viewBox="0 0 64 64" aria-hidden="true">'+
      '<rect x="44" y="9" width="6" height="12" rx="1.5" fill="#c9622c"/>'+
      '<rect x="12" y="26" width="40" height="32" rx="9" fill="#fffdf8" stroke="#1a735d" stroke-width="3"/>'+
      '<path d="M5 31L32 8l27 23" fill="none" stroke="#e0763a" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>'+
      '<path d="M15 27L32 13l17 14z" fill="#f4a261" opacity=".55"/>'+
      eyes+brow+'<ellipse cx="20" cy="46" rx="3" ry="2" fill="#f7a8a0" opacity=".8"/><ellipse cx="44" cy="46" rx="3" ry="2" fill="#f7a8a0" opacity=".8"/>'+
      '<path d="'+mouth+'" fill="none" stroke="#173e32" stroke-width="2.2" stroke-linecap="round"/>'+
      (glass?'<path d="M50.5 53.5l7.5 7.5" stroke="#173e32" stroke-width="4" stroke-linecap="round"/><circle cx="46" cy="49" r="7.5" fill="#dff3ff" fill-opacity=".85" stroke="#173e32" stroke-width="3"/><path d="M42.5 46.5q2-2.4 4.6-2.2" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/>':'')+
      '</svg>';
  }
  // ふきだし
  function landSay(text,mood='happy',cls=''){
    return '<div class="lp-say '+cls+'">'+landMascot(mood,34)+'<p>'+text+'</p></div>';
  }
  // からっぽの画面のイラスト（家と土地）
  function landEmptyArt(mood='happy'){
    return '<div class="lp-empty-art"><svg width="150" height="62" viewBox="0 0 150 62" aria-hidden="true"><path d="M0 52q40-10 75-2t75-4v16H0z" fill="#d7eedf"/><path d="M8 50h40" stroke="#b9dcc6" stroke-width="2" stroke-dasharray="4 4"/>'+
      '<g transform="translate(100 18)"><rect x="4" y="14" width="30" height="22" rx="3" fill="#fff" stroke="#1a735d" stroke-width="2.5"/><path d="M0 17L19 2l19 15" fill="none" stroke="#e0763a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="15" y="24" width="8" height="12" rx="1.5" fill="#f4a261"/></g>'+
      '<g transform="translate(14 30)"><path d="M0 20V6" stroke="#2f8a63" stroke-width="2.5"/><circle cx="0" cy="6" r="7" fill="#7cc49b"/></g><g transform="translate(30 34)"><path d="M0 16V5" stroke="#2f8a63" stroke-width="2"/><circle cx="0" cy="5" r="5.5" fill="#9ad3b1"/></g></svg>'+landMascot(mood,64)+'</div>';
  }
  /* ===== かんたん4ステップ・建売（r90） ===== */
  // 建売：2025年度フラット35利用者調査の建売住宅（敷地131.5㎡・延床100.4㎡、購入価額 愛知3,853.5万円・岐阜3,025.2万円）から、県の標準的な地価（中央値）×敷地を引いて建物分を推計
  const LAND_READY={site:131.5,floor:100.4,price:{'愛知県':3853.5,'岐阜県':3025.2},cost:0.075};
  function landReadyBasis(pref){
    const p=(landData?.prefs||[]).find(x=>x.name===pref)?.residential;
    const med=p&&p.koji&&p.chosa?(p.koji.medianSqm*p.koji.count+p.chosa.medianSqm*p.chosa.count)/(p.koji.count+p.chosa.count):null;
    const avg=LAND_READY.price[pref]||LAND_READY.price['愛知県'];
    const raw=med?avg-med*LAND_READY.site/10000:2500,build=Math.max(1800,Math.min(3000,raw))*10000;
    return {pref:LAND_READY.price[pref]?pref:'愛知県',avg:avg*10000,med,prefLand:med?med*LAND_READY.site:null,build,clamped:raw<1800||raw>3000};
  }
  function landReadyBuilding(pref){return landReadyBasis(pref).build;}
  function landReadyCities(){
    const total=landFindBudget().total*10000,cent=landCentroids();
    return (landData?.cities||[]).filter(landCityIn).map(c=>{
      const sqm=c.residential?.all?.avgSqm||c.residential?.koji?.avgSqm||c.residential?.chosa?.avgSqm;
      if(!sqm)return null;
      const land=sqm*LAND_READY.site,build=landReadyBuilding(c.pref),price=land+build,cost=price*LAND_READY.cost,all=price+cost;
      return {c,sqm,land,build,price,cost,all,left:total-all,ok:all<=total,cm:landCommute(cent.get(c.code))};
    }).filter(Boolean);
  }
  const LAND_TYPES_BUY=[['order','注文住宅','土地を買って、好きな家を建てる'],['ready','建売住宅','土地と家がセット。安くて早い'],['both','両方くらべる','どっちが合うか見比べる']];
  function landFindWizard(){
    const F=state.land.find,M=state.land.money,B=landFindBudget(),st=F.step;
    const big=(val,unit,act)=>'<div class="lp-fs-big"><button class="lp-fs-pm" data-act="'+act+'" data-value="-1" aria-label="減らす">−</button><label><input type="number" inputmode="decimal" step="'+(act==='lp-fs-monthly'?'0.5':'10')+'" data-label="'+(act==='lp-fs-monthly'?'月々払える額':'頭金')+'" data-lp-fs="'+(act==='lp-fs-monthly'?'monthly':'own')+'" value=""'+esc(val)+'"><i>'+unit+'</i></label><button class="lp-fs-pm" data-act="'+act+'" data-value="1" aria-label="増やす">＋</button></div>';
    const chips=(act,list,cur,unit)=>'<div class="lp-fs-chips">'+list.map(v=>'<button class="'+(Number(cur)===v?'active':'')+'" data-act="'+act+'" data-value="'+v+'">'+v+unit+'</button>').join('')+'</div>';
    let q,body,mood='happy';
    if(st===1){q='月々、いくらまで返せる？';body=big(F.monthly,'万円/月','lp-fs-monthly')+chips('lp-fs-monthly-set',[8,10,12,15],F.monthly,'万')+
      '<button class="lp-fs-sub" data-act="lp-loan-open" data-value="find">'+(M.rate===3.81?'全期間固定':M.rate===3.5?'10年固定':'変動')+' '+M.rate+'%・'+M.years+'年で計算 <b>変える ›</b></button>';}
    else if(st===2){q='頭金（すぐ出せる貯金）は？';mood='normal';body=big(M.own||0,'万円','lp-fs-own')+chips('lp-fs-own-set',[0,100,300,500],M.own||0,'万')+
      '<p class="lp-fs-hint">借りられる額 <b>'+landMan(B.loan*10000)+'</b> ＋ 頭金 → 総額 <b>'+landMan(B.total*10000)+'</b></p>';}
    else if(st===3){q='どんな家にする？';mood='think';body='<div class="lp-fs-types">'+LAND_TYPES_BUY.map(([k,t,d])=>'<button class="'+(F.type===k?'active':'')+'" data-act="lp-fs-type" data-value="'+k+'">'+
      (k==='order'?'<span class="lp-fs-ic">🏗️</span>':k==='ready'?'<span class="lp-fs-ic">🏠</span>':'<span class="lp-fs-ic">⚖️</span>')+'<b>'+t+'</b><small>'+d+'</small></button>').join('')+'</div>';}
    else{q='どのあたりに住みたい？';body='<div class="lp-sub">'+landSeg('lp-fs-areamode',ui.lpAreaMode==='line'?'line':'area',[['area','地域で選ぶ'],['line','沿線で選ぶ']],'lp-seg-fill')+'</div>'+(ui.lpAreaMode==='line'?'<div class="lp-line-chips">'+landLineChips()+'</div>':'<div class="lp-fs-areas">'+LAND_FILTERS.map(([k,l])=>'<button class="'+(state.land.filter===k?'active':'')+'" data-act="lp-fs-area" data-value="'+k+'">'+esc(k==='all'?'全部（愛知＋岐阜東濃・中濃）':l)+'</button>').join('')+'</div>')+'';}
    return '<div class="lp-fs">'+
      '<div class="lp-fs-prog">'+[1,2,3,4].map(n=>'<button class="'+(n===st?'is-cur':n<st?'is-done':'')+'" data-act="lp-fs-step" data-value="'+n+'">'+(n<st?'✓':n)+'</button>').join('<i></i>')+'</div>'+
      landSay('<b class="lp-fs-q">'+q+'</b>',mood,'lp-fs-say')+
      '<div class="lp-fs-body" style="--k:'+st+'">'+body+'</div>'+
      '<div class="lp-fs-nav">'+(st>1?'<button class="btn" data-act="lp-fs-step" data-value="'+(st-1)+'">‹ 戻る</button>':'<span></span>')+
        '<button class="btn primary" data-act="lp-fs-step" data-value="'+(st<4?st+1:0)+'">'+(st<4?'次へ ›':'結果を見る ›')+'</button></div></div>';
  }
  function landFindSummary(){
    const F=state.land.find,M=state.land.money,B=landFindBudget();
    const area=landLineFilterLabel(state.land.filter)||(LAND_FILTERS.find(x=>x[0]===state.land.filter)||LAND_FILTERS[0])[1].replace(/（.*$/,'');
    return '<div class="lp-fs-sum">'+[[1,'月'+F.monthly+'万'],[2,'頭金'+(M.own||0)+'万'],[3,({order:'注文',ready:'建売',both:'注文・建売'})[F.type]],[4,area]].map(([n,t])=>'<button data-act="lp-fs-step" data-value="'+n+'">'+esc(t)+'</button>').join('')+'</div>'+
      '<button class="lp-find-total" data-act="lp-loan-open" data-value="find"><span>借入'+landMan(B.loan*10000)+'＋頭金'+(B.own?landMan(B.own*10000):'0円')+'</span><b>総額 '+landMan(B.total*10000)+' <i>金利 ›</i></b></button>';
  }
  function landFindResult(){
    const F=state.land.find,type=F.type;
    const head=landFindSummary();
    const per=Math.max(4,landPerPage()-4);
    if(type==='order'){
      const tabs='<div class="lp-find-row">'+landSeg('lp-find-tab',F.tab,[['place','場所'],['maker','メーカー']],'lp-seg-fill')+'</div>';
      return head+tabs+landFindOrderList(per);
    }
    const ready=landReadyCities(),order=type==='both'?new Map(landFindCities().map(x=>[x.c.code,x])):null;
    let rows=type==='ready'?ready.filter(x=>x.ok):ready.filter(x=>x.ok||order.get(x.c.code)?.fit);
    rows.sort(F.sort==='commute'&&landHasWork()?(a,b)=>(a.cm?.minutes??9999)-(b.cm?.minutes??9999):F.sort==='cheap'?(a,b)=>a.all-b.all:(a,b)=>b.sqm-a.sqm);
    const total=Math.max(1,Math.ceil(rows.length/per));
    ui.lpFindPage=Math.max(0,Math.min(ui.lpFindPage||0,total-1));
    const page=rows.slice(ui.lpFindPage*per,(ui.lpFindPage+1)*per);
    const sorts=[['best','便利な所から'],['cheap','安い順']].concat(landHasWork()?[['commute','通勤が近い順']]:[]);
    return head+
      '<div class="lp-find-row"><p class="lp-find-sum">'+landMascot(rows.length?'happy':'worry',24,false)+'<b>'+rows.length+'</b>か所</p><label class="lp-area-pick lp-sort-pick"><span aria-hidden="true">↕</span><b>'+esc((sorts.find(s=>s[0]===F.sort)||sorts[0])[1])+'</b><i aria-hidden="true">▾</i><select data-lp-find="sort" aria-label="並べ替え">'+sorts.map(([k,l])=>'<option value="'+k+'"'+(k===F.sort?' selected':'')+'>'+l+'</option>').join('')+'</select></label></div>'+
      '<div class="lp-list swipe-zone" data-swipe="lp-find" style="--lp-rows:'+per+'">'+(page.length?page.map((x,i)=>{
        const o=order&&order.get(x.c.code);
        return '<div class="lp-row" style="--i:'+i+'"><button class="lp-row-main" data-act="lp-find-ready" data-value="'+esc(x.c.code)+'">'+
          '<span class="lp-name"><b>'+esc(x.c.name)+'</b><small>'+(x.cm?'通勤'+x.cm.minutes+'分・':'')+esc(x.c.region)+'</small></span>'+
          (type==='both'?'<span class="lp-two"><em class="'+(o?.fit?'ok':'ng')+'">注文 '+(o?.fit?esc(o.fit[1]):'×')+'</em><em class="'+(x.ok?'ok':'ng')+'">建売 '+landMan(x.all)+'</em></span>':
          '<span class="lp-val"><b>'+landMan(x.all)+'</b><span class="lp-extra">残り'+landMan(x.left)+'</span></span>')+'</button></div>';}).join(''):
        '<div class="lp-empty">'+landMascot('worry',56)+'<strong>予算内の場所がありません</strong><span>月々の額やエリアを変えてみてね。</span></div>')+'</div>'+
      '<div class="lp-foot">'+navPager(ui.lpFindPage,total,'lp-find-page')+'</div>';
  }
  function landFindOrderList(per){
    const F=state.land.find,all=landFindCities(),ok=all.filter(x=>x.fit);
    if(F.tab==='maker'){
      const makers=LAND_MAKERS.map(m=>{const cs=ok.filter(x=>x.makers.includes(m));return {m,cs,perf:landPerfSum(m)};}).filter(x=>x.cs.length).sort((a,b)=>b.perf-a.perf||a.m.mid-b.m.mid);
      const total=Math.max(1,Math.ceil(makers.length/per));ui.lpFindPage=Math.max(0,Math.min(ui.lpFindPage||0,total-1));
      const page=makers.slice(ui.lpFindPage*per,(ui.lpFindPage+1)*per);
      return '<div class="lp-list swipe-zone" data-swipe="lp-find" style="--lp-rows:'+per+'">'+(page.length?page.map((x,i)=>
        '<div class="lp-row" style="--i:'+i+'"><button class="lp-row-main" data-act="lp-find-maker" data-value="'+x.m.id+'">'+
        '<span class="lp-name"><b>'+esc(x.m.name)+'</b><small class="lp-bds">'+(landMakerBadges(x.m)||esc(x.m.type))+'</small></span>'+
        '<span class="lp-val"><b>'+x.cs.length+'<small>か所</small></b><span class="lp-extra">坪'+x.m[F.grade]+'万</span></span></button></div>').join(''):
        '<div class="lp-empty">'+landMascot('worry',56)+'<strong>建てられるメーカーがありません</strong></div>')+'</div>'+
        '<div class="lp-foot">'+navPager(ui.lpFindPage,total,'lp-find-page')+'</div>';
    }
    const sorted=ok.slice().sort(F.sort==='commute'&&landHasWork()?(a,b)=>(a.cm?.minutes??9999)-(b.cm?.minutes??9999):F.sort==='cheap'?(a,b)=>a.sqm-b.sqm:(a,b)=>((b.unit>=70)-(a.unit>=70))||b.sqm-a.sqm);
    const total=Math.max(1,Math.ceil(sorted.length/per));ui.lpFindPage=Math.max(0,Math.min(ui.lpFindPage||0,total-1));
    const page=sorted.slice(ui.lpFindPage*per,(ui.lpFindPage+1)*per);
    return '<div class="lp-list swipe-zone" data-swipe="lp-find" style="--lp-rows:'+per+'">'+(page.length?page.map((x,i)=>
        '<div class="lp-row" style="--i:'+i+'"><button class="lp-row-main" data-act="lp-find-city" data-value="'+esc(x.c.code)+'">'+
        '<span class="lp-fit f-'+x.fit[2]+'">'+esc(x.fit[1])+'</span>'+
        '<span class="lp-name"><b>'+esc(x.c.name)+'</b><small>土地'+landMan(x.land)+(x.cm?'・通勤'+x.cm.minutes+'分':'')+'</small></span>'+
        '<span class="lp-val"><b>'+x.makers.length+'<small>社</small></b><span class="lp-extra">建てられる</span></span></button></div>').join(''):
        '<div class="lp-empty">'+landMascot('worry',56)+'<strong>予算内の場所がありません</strong><span>月々の額やエリアを変えてみてね。</span></div>')+'</div>'+
      '<div class="lp-foot">'+navPager(ui.lpFindPage,total,'lp-find-page')+'</div>';
  }
  function landReadyScreen(){
    const x=landReadyCities().find(v=>v.c.code===ui.lpReadyCity),M=state.land.money;
    if(!x)return modalFrame('建売住宅',empty('◔','データがありません',''));
    const o=landFindCities().find(v=>v.c.code===x.c.code);
    const loan=Math.max(0,x.all-(M.own||0)*10000),pay=landPay(loan,M.rate,M.years);
    const tabSeg='<div class="lp-sub">'+landSeg('lp-ready-tab',ui.lpReadyTab==='basis'?'basis':'res',[['res','結果'],['basis','計算の根拠']],'lp-seg-fill')+'</div>';
    if(ui.lpReadyTab==='basis'){
      const b=landReadyBasis(x.c.pref),row=(no,t,f,v,note)=>'<div class="lp-basis-row" style="--i:'+no+'"><i>'+no+'</i><div><b>'+t+'</b><p>'+f+'</p>'+(note?'<small>'+note+'</small>':'')+'</div><strong>'+v+'</strong></div>';
      const tb=v=>(v*LAND_TSUBO/10000).toFixed(1);
      return modalFrame(x.c.name+'の建売',tabSeg.replace('lp-sub','lp-sub lp-ready-seg')+'<div class="panel detail grow lp-find-detail"><div class="lp-basis">'+
        row(1,'土地','この市の住宅地の平均 坪'+tb(x.sqm)+'万 × 40坪（131.5㎡）',landMan(x.land),esc(x.c.name)+'の地価公示・地価調査の平均。敷地131.5㎡は建売住宅の全国平均')+
        row(2,'建物','県の建売の平均価格 '+landMan(b.avg)+' − 県の標準的な土地代 '+(b.prefLand?landMan(b.prefLand):'—'),landMan(b.build),esc(b.pref)+'の建売の平均（2025年度フラット35利用者調査）から、県の住宅地の中央値 坪'+(b.med?tb(b.med):'—')+'万×131.5㎡を引いた残りを建物分とみなす'+(b.clamped?'（1,800〜3,000万円の範囲に調整）':''))+
        row(3,'物件価格','土地 ＋ 建物',landMan(x.price))+
        row(4,'諸費用','物件価格 × 7.5%',landMan(x.cost),'建売の諸費用の相場は物件価格の6〜9%。仲介手数料の有無で変わるため中間の7.5%')+
        row(5,'合計（諸費用込み）','物件価格 ＋ 諸費用',landMan(x.all))+
        row(6,'月々の返済','（合計 − 頭金'+(M.own||0)+'万）を '+M.rate+'%・'+M.years+'年の元利均等返済',landYenText(pay))+
        '</div><p class="lp-note">実際の建売は広さ・駅距離・仕様で大きく変わります。同じ市の販売中の物件と比べて使ってください。</p></div>');
    }
    return modalFrame(x.c.name+'の建売',tabSeg+'<div class="panel detail grow lp-find-detail">'+
      '<div class="lp-size-result"><div><span>建売の目安（諸費用込み）</span><strong>'+landMan(x.all)+'</strong><em>土地40坪・建物30坪</em></div>'+
        '<div><span>月々の返済</span><strong>'+landYenText(pay)+'</strong><em>頭金'+(M.own||0)+'万・'+M.rate+'%・'+M.years+'年</em></div></div>'+
      '<div class="lp-ready-bars">'+[['土地',x.land,'land'],['建物',x.build,'body'],['諸費用',x.cost,'cost']].map(([l,v,c])=>'<div class="lp-sim-row"><span>'+l+'</span><i class="lp-sim-bar '+c+'" style="--w:'+Math.round(v/x.all*100)+'%"></i><b>'+landMan(v)+'</b></div>').join('')+'</div>'+
      landSay(x.ok?'予算内だよ！残り<b>'+landMan(x.left)+'</b>。':'予算を<b>'+landMan(-x.left)+'</b>オーバー。',x.ok?'happy':'worry')+
      (o?'<div class="lp-ready-vs"><div><span>注文住宅なら</span><b>'+(o.fit?esc(o.fit[1]):'予算オーバー')+'</b><small>建てられる会社 '+o.makers.length+'社</small></div><div><span>建売の良いところ</span><small>安い・すぐ住める・実物を見て買える</small></div></div>':'')+
      '<div class="lp-detail-actions">'+(o?.fit?'<button class="btn flex1" data-act="lp-find-city" data-value="'+esc(x.c.code)+'">注文住宅のメーカーを見る</button>':'')+'<button class="btn primary flex1" data-act="lp-open" data-value="'+esc(x.c.code)+'">'+esc(x.c.name)+'の地価</button></div>'+
      '</div>');
  }
  function landV12Action(action,v){
    const L=state.land,F=L.find,set=patch=>{L.find=landFindNormalize({...L.find,...patch});ui.lpFindPage=0;save();};
    if(action==='lp-find-page'){const per=Math.max(4,landPerPage()-4);let n;
      if(F.type==='order'){const ok=landFindCities().filter(x=>x.fit);n=F.tab==='maker'?LAND_MAKERS.filter(m=>ok.some(x=>x.makers.includes(m))).length:ok.length;}
      else{const r=landReadyCities(),om=F.type==='both'?new Map(landFindCities().map(x=>[x.c.code,x])):null;n=F.type==='ready'?r.filter(x=>x.ok).length:r.filter(x=>x.ok||om.get(x.c.code)?.fit).length;}
      return step(()=>changePage('lpFindPage',Math.max(1,Math.ceil(n/per)),Number(v)));}
    if(action==='lp-fs-step')return step(()=>set({step:Number(v)||0}));
    if(action==='lp-fs-monthly')return step(()=>set({monthly:F.monthly+Number(v)*0.5}));
    if(action==='lp-fs-monthly-set')return step(()=>set({monthly:Number(v)}));
    if(action==='lp-fs-own')return step(()=>{L.money=landMoneyNormalize({...L.money,own:Math.max(0,(L.money.own||0)+Number(v)*50)});save();});
    if(action==='lp-fs-own-set')return step(()=>{L.money=landMoneyNormalize({...L.money,own:Number(v)});save();});
    if(action==='lp-fs-type')return step(()=>set({type:v,step:4}));
    if(action==='lp-fs-area')return step(()=>{if((v=>typeof v==='string'&&(LAND_FILTERS.some(x=>x[0]===v)||(v.startsWith('line:')&&v.length<40)))(v))L.filter=v;set({step:0});});
    if(action==='lp-fs-areamode')return step(()=>{ui.lpAreaMode=v==='line'?'line':'area';});
    if(action==='lp-find-ready')return openOverlay('land-ready',()=>{ui.lpReadyCity=v;ui.lpReadyTab='res';});
    if(action==='lp-ready-tab')return step(()=>{ui.lpReadyTab=v==='basis'?'basis':'res';});
    return false;
  }
  /* ===== 登録した土地（r91） ===== */
  const LAND_MY_DIRS=[['','不明'],['南','南'],['東','東'],['西','西'],['北','北']];
  const LAND_MY_ZONES=['','第一種低層住居専用地域','第二種低層住居専用地域','第一種中高層住居専用地域','第二種中高層住居専用地域','第一種住居地域','第二種住居地域','準住居地域','近隣商業地域','商業地域','準工業地域','市街化調整区域'];
  function landMyNormalize(list){
    return (Array.isArray(list)?list:[]).map(x=>{
      if(!x||typeof x!=='object')return null;
      const n=(v,lo,hi)=>{v=Number(v);return Number.isFinite(v)&&v>=lo&&v<=hi?v:null;};
      const city=typeof x.city==='string'&&/^\d{5}$/.test(x.city)?x.city:'';
      const tsubo=n(x.tsubo,1,5000),price=n(x.price,1,100000);
      if(!city||!tsubo||!price)return null;
      const s=(v,max)=>typeof v==='string'?v.slice(0,max):'';
      return {id:s(x.id,20)||Date.now().toString(36),name:s(x.name,40),city,town:s(x.town,60),station:s(x.station,20).replace(/駅$/,''),tsubo,price,walk:n(x.walk,0,300),
        dir:['南','東','西','北'].includes(x.dir)?x.dir:'',road:n(x.road,0,50),zone:LAND_MY_ZONES.includes(x.zone)?x.zone:'',cond:x.cond?1:0,
        memo:s(x.memo,300),url:/^https?:\/\//.test(x.url||'')?s(x.url,400):'',lat:n(x.lat,20,50),lon:n(x.lon,120,155),geo:['gsi','town','station','city'].includes(x.geo)?x.geo:'city'};
    }).filter(Boolean).slice(0,30);
  }
  function landMyRef(m){
    const c=landCity(m.city);if(!c)return null;
    const pts=(landData?.points||[]).filter(p=>p.cityCode===c.code&&p.use==='住宅地');
    const t=m.town?pts.filter(p=>{const tn=landTownOf(p,c);return tn&&m.town.replace(/\s/g,'').startsWith(tn);}):[];
    if(t.length)return {sqm:t.reduce((a,p)=>a+p.priceSqm,0)/t.length,how:landTownOf(t[0],c)+'の地価（'+t.length+'地点）'};
    const med=landMedian(pts.map(p=>p.priceSqm))||c.residential?.all?.avgSqm;
    return med?{sqm:med,how:c.name+'の住宅地の中央値'}:null;
  }
  function landMyEval(m){
    const c=landCity(m.city),S=state.land.sim,M=state.land.money;
    const maker=S.maker==='avg'?landMakerAvg():(landMakerById(S.maker)||landMakerAvg()),unit=maker[S.grade]||maker.mid;
    const land=m.price*10000,unitTsubo=land/m.tsubo,ref=landMyRef(m),ratio=ref?unitTsubo/(ref.sqm*LAND_TSUBO):null;
    const tone=ratio==null?null:ratio<0.95?['cheap','割安']:ratio<=1.25?['fair','相場なみ']:['high','高め'];
    const body=unit*10000*S.floorTsubo,extra=body*LAND_EXTRA_RATE,cost=(land+body+extra)*LAND_COST_RATE,total=land+body+extra+cost;
    const loan=Math.max(0,total-(M.own||0)*10000),pay=landPay(loan,M.rate,M.years),budget=landFindBudget().total*10000;
    const center=Number.isFinite(m.lat)?{lat:m.lat,lon:m.lon}:landCentroids().get(m.city);
    const notes=[];
    if(m.road!=null&&m.road<4)notes.push(['warn','道路の幅が4m未満。建てるときに道路の中心から2m下がる（セットバック）必要があり、使える広さが減るかも']);
    if(m.dir==='北')notes.push(['info','北道路は割安なことが多い。家の南側に庭やリビングを取りやすい']);
    if(m.dir==='南')notes.push(['good','南道路は日当たりが良く人気']);
    if(m.cond)notes.push(['warn','建築条件付き：建てる会社が決まっている。メーカーを自由に選べない']);
    if(m.zone==='市街化調整区域')notes.push(['bad','市街化調整区域は原則として家を建てにくい。必ず役所に確認']);
    if(/商業|工業/.test(m.zone))notes.push(['info','商業・工業系の地域。便利だが騒音や日当たりを現地で確認']);
    if(m.walk!=null&&m.walk<=10)notes.push(['good','駅まで徒歩'+m.walk+'分。将来売るときも有利']);
    const tsuboNeed=landTb(landSizeCalc().site);
    if(m.tsubo<tsuboNeed-5)notes.push(['warn','広さの目安（'+tsuboNeed+'坪）より狭め。駐車場や庭が取れるか確認']);
    return {c,land,unitTsubo,ref,ratio,tone,body,extra,cost,total,loan,pay,budget,ok:total<=budget,cm:landCommute(center),notes,maker,unit};
  }
  function landMyScreen(){
    const L=state.land,list=L.my;
    const seg='<div class="lp-sub">'+landSeg('lp-cand-tab','my',[['my','登録した土地（'+list.length+'）'],['cmp','くらべる']],'lp-seg-fill')+'</div>';
    if(!list.length)return seg+'<div class="lp-commute-empty">'+landEmptyArt('happy')+'<strong>気になる土地を登録しよう</strong><span>広告やチラシの土地の値段と広さを入れると、相場より安いか、家を建てた総額や月々の返済がすぐわかります。</span><button class="btn primary wide" data-act="lp-my-new">＋ 土地を登録する</button></div>';
    const per=Math.max(3,Math.floor((landPerPage()-3)/1.6)),total=Math.max(1,Math.ceil(list.length/per));
    ui.lpMyPage=Math.max(0,Math.min(ui.lpMyPage||0,total-1));
    const page=list.slice(ui.lpMyPage*per,(ui.lpMyPage+1)*per);
    return seg+'<div class="lp-find-row"><p class="lp-find-sum">'+landMascot('happy',24,false)+'<b>'+list.length+'</b>件</p><button class="btn compact primary lp-my-add" data-act="lp-my-new">＋ 登録</button></div>'+
      '<div class="lp-my-list swipe-zone" data-swipe="lp-my">'+page.map((m,i)=>{const e=landMyEval(m);
        return '<button class="lp-my-card" style="--i:'+i+'" data-act="lp-my-open" data-value="'+esc(m.id)+'">'+
          '<div class="lp-my-top"><b>'+esc(m.name||((e.c?.name||'')+(m.town?' '+m.town:'')))+'</b><strong>'+landMan(e.land)+'</strong></div>'+
          '<small>'+esc((e.c?.name||'')+(m.town&&m.name?' '+m.town:''))+'・'+landArea(m.tsubo)+(m.station?'・'+m.station+'駅'+(m.walk!=null?'徒歩'+m.walk+'分':''):m.walk!=null?'・駅徒歩'+m.walk+'分':'')+'・坪'+(e.unitTsubo/10000).toFixed(1)+'万</small>'+
          '<div class="lp-my-tags">'+(e.tone?'<i class="t-'+e.tone[0]+'">'+e.tone[1]+'</i>':'')+'<i>総額 '+landMan(e.total)+'</i><i>月々 '+landYenText(e.pay)+'</i><i class="'+(e.ok?'t-cheap':'t-high')+'">'+(e.ok?'予算内':'予算オーバー')+'</i>'+(e.cm?'<i>通勤'+e.cm.minutes+'分</i>':'')+'</div></button>';}).join('')+'</div>'+
      '<div class="lp-foot">'+navPager(ui.lpMyPage,total,'lp-my-page')+'</div>';
  }
  function landMyDetail(){
    const m=state.land.my.find(x=>x.id===ui.lpMy);
    if(!m)return modalFrame('登録した土地',empty('◔','見つかりません',''));
    const e=landMyEval(m),S=state.land.sim;
    const pos=e.ratio==null?null:Math.max(0,Math.min(100,(e.ratio-0.5)/1.5*100));
    const say=e.tone?(e.tone[0]==='cheap'?'地価の目安より<b>'+Math.round((1-e.ratio)*100)+'%安い</b>よ！掘り出し物かも。理由（形・道路・地盤）も確認してね。':e.tone[0]==='fair'?'相場なみの値段だよ。広告の値段は地価公示より1〜2割高いのがふつう。':'地価の目安の<b>'+e.ratio.toFixed(2)+'倍</b>で高め。駅近・広い道路などの理由がなければ値下げ交渉の余地あり。'):'この市区町村の地価データがないよ。';
    return '<div class="full lp-detail"><header class="full-header"><button class="btn compact" data-act="overlay-close">‹ 戻る</button><strong>'+esc(m.name||e.c?.name||'土地')+'</strong><button class="btn compact" data-act="lp-my-edit" data-value="'+esc(m.id)+'">編集</button></header>'+
      '<section class="full-body lp-detail-body lp-my-detail">'+
      '<div class="lp-size-result"><div><span>'+esc((e.c?.name||'')+(m.town?' '+m.town:''))+'・'+landArea(m.tsubo)+'</span><strong>'+landMan(e.land)+'</strong><em>坪'+(e.unitTsubo/10000).toFixed(1)+'万円</em></div>'+
        '<div><span>家を建てた総額</span><strong>'+landMan(e.total)+'</strong><em>月々'+landYenText(e.pay)+'・'+(e.ok?'予算内':'予算オーバー')+'</em></div></div>'+
      (pos!=null?'<div class="lp-my-gauge"><div class="lp-my-gauge-bar"><span>割安</span><span>相場なみ</span><span>高め</span><u style="left:'+pos+'%"></u></div><small>地価の目安 坪'+(e.ref.sqm*LAND_TSUBO/10000).toFixed(1)+'万（'+esc(e.ref.how)+'）の'+e.ratio.toFixed(2)+'倍</small></div>':'')+
      (m.station?(()=>{const st=landStationFind(m.station),R=landRail();return '<p class="lp-my-line-hit">🚉 '+esc(m.station)+'駅'+(st&&R?'（'+esc(R.lineOf(st).join('・'))+'）':'')+(m.walk!=null?'　徒歩'+m.walk+'分':'')+'</p>';})():'')+
      landSay(say,e.tone?.[0]==='high'?'think':e.tone?.[0]==='cheap'?'happy':'normal')+
      '<div class="lp-ready-bars">'+[['土地',e.land,'land'],['建物'+S.floorTsubo+'坪',e.body,'body'],['付帯＋諸費用',e.extra+e.cost,'extra']].map(([l,v,c])=>'<div class="lp-sim-row"><span>'+l+'</span><i class="lp-sim-bar '+c+'" style="--w:'+Math.round(v/e.total*100)+'%"></i><b>'+landMan(v)+'</b></div>').join('')+'</div>'+
      (e.notes.length?'<div class="lp-tips lp-my-notes">'+e.notes.slice(0,3).map(([lv,t],i)=>'<div class="lp-tip '+lv+'" style="--i:'+i+'">'+landMascot(({good:'happy',warn:'think',bad:'worry',info:'normal'})[lv],26,false)+'<p>'+esc(t)+'</p></div>').join('')+'</div>':'')+
      '<div class="lp-detail-actions"><button class="btn flex1" data-act="lp-my-map" data-value="'+esc(m.id)+'">地図で見る</button><button class="btn primary flex1" data-act="lp-cand-tab" data-value="cmp">ほかと比べる</button></div>'+
      (m.url?'<a class="lp-my-url" href="'+esc(m.url)+'" target="_blank" rel="noopener">広告ページを開く ›</a>':'')+
      '<p class="lp-disclaimer">建物は「家の総額」の設定（'+esc(e.maker.name)+'・坪'+e.unit+'万×'+S.floorTsubo+'坪）で計算。'+(m.geo==='city'?'場所は市区町村の中心で計算。':m.geo==='station'?'場所は最寄駅の位置で計算。':'')+'</p></section></div>';
  }
  async function landMyGeocode(id){
    const m=state.land.my.find(x=>x.id===id),c=m&&landCity(m.city);
    if(!m||!c||!m.town)return;
    try{
      const r=await fetch('https://msearch.gsi.go.jp/address-search/AddressSearch?q='+encodeURIComponent(c.pref+c.name+m.town),{cache:'no-store'});
      const list=r.ok?await r.json():[];const g=(list||[]).find(x=>Array.isArray(x?.geometry?.coordinates));
      if(!g)return;
      const [lon,lat]=g.geometry.coordinates.map(Number);
      const cc=landCentroids().get(c.code);if(cc&&landKm(lat,lon,cc.lat,cc.lon)>40)return;
      const x=state.land.my.find(y=>y.id===id);if(!x)return;
      x.lat=lat;x.lon=lon;x.geo='gsi';save();render();
    }catch(_){}
  }
  function landMySave(){
    const d=ui.lpMyEdit||{};
    const size=Number(d.size),price=Number(d.price);
    if(!d.city)return message('市区町村を選んでください');
    if(!(size>0))return message('広さを入れてください');
    if(!(price>0))return message('土地の価格を入れてください');
    const tsubo=d.unit==='sqm'?size/LAND_TSUBO:size,c=landCity(d.city);
    let lat=null,lon=null,geo='city';
    if(d.town&&c){const pts=(landData?.points||[]).filter(p=>p.cityCode===c.code&&Number.isFinite(p.lat)&&d.town.replace(/\s/g,'').startsWith(landTownOf(p,c)));
      if(pts.length){lat=pts.reduce((a,p)=>a+p.lat,0)/pts.length;lon=pts.reduce((a,p)=>a+p.lon,0)/pts.length;geo='town';}}
    if(geo==='city'&&d.station){const st=landStationFind(d.station);if(st){lat=st.lat;lon=st.lon;geo='station';}}
    const item=landMyNormalize([{...d,tsubo,price,walk:d.walk===''?null:d.walk,road:d.road===''?null:d.road,lat,lon,geo,id:d.id||Date.now().toString(36)}])[0];
    if(!item)return message('入力を確認してください');
    const L=state.land,i=L.my.findIndex(x=>x.id===item.id);
    if(i>=0)L.my[i]=item;else L.my=[item,...L.my].slice(0,30);
    ui.lpMyEdit=null;ui.lpMy=item.id;ui.overlay='land-my';save();render();
    message('保存しました');
    landMyGeocode(item.id);
  }
  function landV13Action(action,v){
    const L=state.land;
    if(action==='lp-cand-tab')return step(()=>{ui.lpCandTab=v==='cmp'?'cmp':'my';L.view='compare';ui.overlay='';});
    if(action==='lp-my-new')return openOverlay('land-my-edit',()=>{ui.lpMyEdit={unit:'sqm',step:0};});
    if(action==='lp-my-edit')return openOverlay('land-my-edit',()=>{const m=L.my.find(x=>x.id===v);ui.lpMyEdit=m?{...m,size:Math.round(m.tsubo*LAND_TSUBO*100)/100,unit:'sqm',walk:m.walk??'',road:m.road??'',step:1}:{unit:'sqm',step:0};});
    if(action==='lp-my-open')return openOverlay('land-my',()=>{ui.lpMy=v;});
    if(action==='lp-my-save'){landMySave();return;}
    if(action==='lp-my-unit')return step(()=>{const d=landMySync();const s=Number(d.size);if(s>0&&d.unit!==v)d.size=Math.round((v==='sqm'?s*LAND_TSUBO:s/LAND_TSUBO)*10)/10;d.unit=v;ui.lpMyEdit=d;});
    if(action==='lp-my-dir')return step(()=>{ui.lpMyEdit={...ui.lpMyEdit,dir:v};});
    if(action==='lp-my-cond')return step(()=>{ui.lpMyEdit={...ui.lpMyEdit,cond:v==='1'?1:0};});
    if(action==='lp-my-del'){if(!confirm('この土地を削除しますか？'))return;return step(()=>{L.my=L.my.filter(x=>x.id!==v);ui.overlay='';ui.lpMyEdit=null;save();message('削除しました');});}
    if(action==='lp-my-page')return step(()=>changePage('lpMyPage',Math.max(1,Math.ceil(L.my.length/Math.max(3,Math.floor((landPerPage()-3)/1.6)))),Number(v)));
    if(action==='lp-my-sim'){const m=L.my.find(x=>x.id===v);if(!m)return;return step(()=>{L.sim=landSimNormalize({...L.sim,mode:'cond',city:m.city,landTsubo:Math.round(m.tsubo)});L.view='sim';ui.lastCalc='sim';ui.overlay='';save();message('市区町村と広さを「家の総額」に入れました（土地代は地価の目安で計算）');});}
    if(action==='lp-my-map'){const m=L.my.find(x=>x.id===v),pt=m&&(Number.isFinite(m.lat)?m:landCentroids().get(m.city));if(pt)return step(()=>{landMapFocus(pt.lat,pt.lon,15);});return;}
    return false;
  }
  /* ===== 使い方ガイド・計算の根拠（r92） ===== */
  // 画面ごとの「何のため・いつ使う・使い方・次は」
  const LAND_HOWTO={
    find:{icon:'💰',t:'予算から探す',what:'月々の返済から、買える家と場所を探す',when:'「いくらの家なら買える？」「どこなら建てられる？」を最初に知りたいとき',
      steps:['月々いくらまで返せるか選ぶ','頭金（すぐ出せる貯金）を選ぶ','注文住宅か建売かを選ぶ','住みたいエリアを選ぶ → 場所とメーカーが並ぶ'],next:[['sim','気になる場所の総額を詳しく出す'],['compare','気になる土地を登録する']]},
    sim:{icon:'🧮',t:'総額を計算',what:'場所・広さ・会社を決めて、家の総額を出す',when:'「この市で、この会社で建てたら全部でいくら？」を知りたいとき',
      steps:['市区町村を選ぶ（土地の値段が決まる）','土地と建物の広さを入れる（わからなければ「広さの目安」）','ハウスメーカーと仕様のグレードを選ぶ','下に「土地＋建物＋付帯工事＋諸費用＝総額」が出る'],
      tip:'ここで出た総額が「返済チェック」の計算にそのまま使われます。予算が先に決まっているなら上の「予算を土地と建物に分ける」に切り替え。',next:[['advice','この総額で返済できるか確認'],['commute','この場所からの通勤を見る']]},
    commute:{icon:'🚗',t:'通勤',what:'夫・妻の通勤時間と通勤費を市区町村ごとに比べる',when:'住む場所を決めるときに、通勤の負担も考えたいとき',
      steps:['「勤務先と通勤方法を設定」を押す','夫・妻それぞれ勤務先（住所や駅名）と、車・電車・自転車を選ぶ','一覧に通勤時間・月の費用・土地＋通勤の合計が並ぶ'],next:[['find','通勤が近い順で予算内の場所を探す']]},
    advice:{icon:'🩺',t:'返済チェック',what:'その総額を、年収で無理なく返せるかを判定する',when:'買う前に「返済が重すぎないか」を確かめたいとき',
      steps:['世帯年収と頭金を入れる','金利（変動・固定）と年数を選ぶ','月々の返済と返済負担率が出て、アドバイスが並ぶ','「計算の根拠」で式と数字を確認できる'],
      tip:'総額は「総額を計算」の結果を使います。総額を変えたいときはそちらで場所・広さ・会社を変えてください。',next:[['sim','総額を変える'],['find','予算から探しなおす']]},
    rank:{icon:'🏆',t:'ランキング',what:'市区町村の地価を高い順・安い順・上昇率などで比べる',when:'「どこが安い？」「どこが値上がりしている？」をざっと見たいとき',
      steps:['上の種類（坪単価・前年比など）を選ぶ','📍でエリアを絞る','市区町村をタップ → 詳しい地価・地区ごとの地価','☆で候補に追加'],next:[['map','地図で見る'],['compare','☆を付けた所を比べる']]},
    map:{icon:'🗺️',t:'地図',what:'地価の地点を地図で見る',when:'場所の位置関係や、駅の近くの値段を見たいとき',steps:['指で動かす・2本指で拡大','色の点をタップ → その地点の価格','「この地区」でまわりの地価一覧'],next:[['rank','ランキングで比べる']]},
    compare:{icon:'⭐',t:'候補',what:'気になる土地を登録して評価・比較する',when:'広告やチラシで気になる土地を見つけたとき',
      steps:['「＋登録」で市区町村・広さ・価格を入れる','相場より安いか、総額・月々・予算内かがすぐ出る','「くらべる」で候補どうしを並べる'],next:[['advice','返済できるか確認']]},
    maker:{icon:'🏠',t:'メーカー',what:'ハウスメーカーの価格・性能・特徴を調べる',when:'どの会社に相談するか決めたいとき',steps:['並べ替えで「耐震が強い順」などを選ぶ','会社をタップ → 性能・特徴・注意点','「この会社で総額を計算」で費用がわかる'],next:[['sim','この会社で総額を計算']]},
    guide:{icon:'📖',t:'土地の知識・用語',what:'地域の特徴、土地の条件、用語を調べる',when:'わからない言葉が出てきたとき、地域の雰囲気を知りたいとき',steps:['上で「地域」「土地の条件」「用語」を切り替え','カードを左右にめくる'],next:[['rank','地価を見る']]}
  };
  const LAND_START=[
    ['💰','いくらの家が買える？','find'],['🧮','この場所・この会社でいくら？','sim'],['🩺','返済は大丈夫？','advice'],['🚗','通勤はどれくらい？','commute'],
    ['⭐','気になる土地を評価したい','compare'],['🏆','地価の安い所・高い所は？','rank'],['🏠','ハウスメーカーを知りたい','maker'],['📖','言葉の意味がわからない','guide']
  ];
  function landPurpose(view){
    const h=LAND_HOWTO[view];if(!h)return '';
    return '<button class="lp-purpose" data-act="lp-howto" data-value="'+view+'"><span>'+h.icon+'</span><em>'+esc(h.what)+'</em><b>使い方</b></button>';
  }
  function landHowtoScreen(){
    const v=ui.lpHowto,h=LAND_HOWTO[v];
    if(!h)return landStartScreen();
    return modalFrame(h.icon+' '+h.t+'の使い方','<div class="panel detail grow lp-howto">'+
      landSay('<b>'+esc(h.what)+'</b>','happy')+
      '<div class="lp-howto-when"><span>こんなときに</span><p>'+esc(h.when)+'</p></div>'+
      '<ol class="lp-howto-steps">'+h.steps.map((s,i)=>'<li style="--i:'+i+'"><i>'+(i+1)+'</i><p>'+esc(s)+'</p></li>').join('')+'</ol>'+
      (h.tip?'<p class="lp-howto-tip">💡 '+esc(h.tip)+'</p>':'')+
      '<div class="lp-howto-next"><span>次はこれ</span>'+h.next.map(([k,l])=>'<button data-act="lp-go" data-value="'+k+'">'+(LAND_HOWTO[k]?.icon||'')+' '+esc(l)+' ›</button>').join('')+'</div>'+
      '<button class="lp-howto-all" data-act="lp-start">すべての機能を見る</button></div>');
  }
  function landStartScreen(){
    return modalFrame('地価調べ君の使い方','<div class="panel detail grow lp-start">'+
      landSay('やりたいことを選んでね。<b>迷ったら上から順に</b>使うのがおすすめ！','happy')+
      '<div class="lp-start-flow">'+['💰 予算から探す','⭐ 候補を登録','🧮 総額を計算','🩺 返済チェック'].map((t,i)=>'<span style="--i:'+i+'">'+t+'</span>').join('<i>›</i>')+'</div>'+
      '<div class="lp-start-list">'+LAND_START.map(([ic,t,k],i)=>'<button style="--i:'+i+'" data-act="lp-go" data-value="'+k+'"><span>'+ic+'</span><b>'+esc(t)+'</b><small>'+esc(LAND_HOWTO[k].t)+' ›</small></button>').join('')+'</div>'+
      '<p class="lp-note">各画面の上の「使い方」からも、いつでも見られます。</p></div>');
  }
  // 返済チェックの計算の根拠
  function landMoneyBasis(x){
    const M=state.land.money,r=x.r,inc=M.income*10000,mr=M.rate/1200,n=M.years*12;
    const row=(no,t,f,v,note)=>'<div class="lp-basis-row" style="--i:'+no+'"><i>'+no+'</i><div><b>'+t+'</b><p>'+f+'</p>'+(note?'<small>'+note+'</small>':'')+'</div><strong>'+v+'</strong></div>';
    return '<div class="lp-basis">'+
      row(1,'家の総額','土地 '+landMan(r.land||0)+' ＋ 建物 '+landMan(r.body)+' ＋ 付帯工事 '+landMan(r.extra)+' ＋ 諸費用 '+landMan(r.cost),landMan(x.total),'「総額を計算」の結果（'+esc(r.c.name)+'）。付帯工事＝建物本体の25%、諸費用＝10%')+
      row(2,'借りる額','総額 '+landMan(x.total)+' − 頭金 '+(M.own?landMan(M.own*10000):'0円'),landMan(x.loan))+
      row(3,'月々の返済','借りる額 × 月の金利 ÷ {1 − (1＋月の金利)^−'+n+'回}',landYenText(x.pay),'元利均等返済。月の金利＝年'+M.rate+'%÷12＝'+(mr*100).toFixed(4)+'%、'+M.years+'年＝'+n+'回')+
      row(4,'返済負担率',inc>0?'月々 '+landYenText(x.pay)+' × 12 ÷ 年収 '+landMan(inc):'年収を入れると計算',x.burden==null?'—':x.burden.toFixed(1)+'%','目安は25%以下。フラット35の審査の上限は年収400万円未満30%・400万円以上35%')+
      row(5,'年収倍率',inc>0?'総額 '+landMan(x.total)+' ÷ 年収 '+landMan(inc):'年収を入れると計算',x.mult==null?'—':x.mult.toFixed(1)+'倍','土地を買って注文住宅を建てた人の平均は'+LAND_STATS.ratio+'倍（2025年度フラット35利用者調査）')+
      row(6,'25%に収まる借入額',inc>0?'年収 × 25% ÷ 12 ＝ 月'+landYenText(inc*0.25/12)+' を返せる額に逆算':'年収を入れると計算',x.max25==null?'—':landMan(x.max25))+
      '</div>'+
      '<div class="lp-detail-actions"><button class="btn flex1" data-act="lp-go" data-value="sim">総額を変える ›</button><button class="btn primary flex1" data-act="lp-loan-open" data-value="money">利息の内訳 ›</button></div>';
  }
  function landV14Action(action,v){
    const L=state.land;
    if(action==='lp-howto')return openOverlay('land-howto',()=>{ui.lpHowto=v;});
    if(action==='lp-start')return openOverlay('land-howto',()=>{ui.lpHowto='';});
    if(action==='lp-go')return step(()=>{
      if(v==='region'||v==='cond'||v==='words'){L.view='guide';L.guideTab=v;}
      else if(LAND_VIEWS.some(x=>x[0]===v))L.view=v;
      if(v==='compare')ui.lpCandTab='my';
      if(v==='find')L.find=landFindNormalize({...L.find,step:L.find.step||0});
      if(landGroup(L.view)==='calc')ui.lastCalc=L.view;if(landGroup(L.view)==='learn')ui.lastLearn=L.view;
      ui.overlay='';L.seenGuide=1;save();});
    return false;
  }
  /* ===== 土地の登録をかんたんに（r94） ===== */
  const landZen=t=>String(t||'').replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/[．]/g,'.').replace(/[，]/g,',').replace(/[ｍＭ]/g,'m').replace(/㎡|m²|ｍ２|m2|平米|平方メートル/g,'㎡');
  // 広告（SUUMO・アットホームなど）の文章から読み取る
  function landParseAd(raw){
    const t=landZen(raw),out={},num=s=>Number(String(s).replace(/,/g,''));
    const area=t.match(/土地面積[^\d]{0,12}([\d.,]+)\s*㎡/)||t.match(/([\d.,]+)\s*㎡/);
    if(area)out.size=Math.round(num(area[1])*100)/100,out.unit='sqm';
    else{const tb=t.match(/([\d.,]+)\s*坪/);if(tb)out.size=num(tb[1]),out.unit='tsubo';}
    const pr=t.match(/(?:価格|販売価格)[^\d億]{0,10}(?:(\d+)\s*億)?\s*([\d,]+)\s*万円/)||t.match(/(?:(\d+)\s*億)?\s*([\d,]+)\s*万円/);
    if(pr)out.price=(pr[1]?num(pr[1])*10000:0)+num(pr[2]);
    const w=t.match(/徒歩\s*(\d+)\s*分/);if(w)out.walk=num(w[1]);
    const st=t.match(/「([^」]{1,12})」\s*駅/)||t.match(/([^\s「」、,（()・]{1,10})駅\s*(?:まで)?\s*徒歩/);if(st)out.station=st[1].replace(/駅$/,'');
    const road=t.match(/(?:前面道路|接道|道路幅員|幅員)[^\d]{0,14}([\d.]+)\s*m/);if(road)out.road=num(road[1]);
    const dir=t.match(/(南|北|東|西)(?:東|西)?側?(?:道路|公道|私道|接道)/);if(dir)out.dir=dir[1];
    const z=LAND_MY_ZONES.filter(Boolean).find(zn=>t.includes(zn)||t.includes(zn.replace('専用地域','').replace('地域','')));if(z)out.zone=z;
    if(/建築条件\s*(付|あり|有)/.test(t))out.cond=1;else if(/建築条件\s*(なし|無)/.test(t))out.cond=0;
    const u=t.match(/https?:\/\/[^\s"'<>]+/);if(u)out.url=u[0];
    const cs=(landData?.cities||[]).slice().sort((a,b)=>b.name.length-a.name.length);
    for(const c of cs){const k=t.indexOf(c.name);if(k<0)continue;out.city=c.code;
      const rest=t.slice(k+c.name.length).replace(/^\s+/,'');const m=rest.match(/^([^\s、,（(「\/|]{1,16})/);
      if(m&&!/^(駅|線|徒歩)/.test(m[1]))out.town=m[1].replace(/[-‐−ー].*$/,'');break;}
    return out;
  }
  function landMySize(d){const s=Number(d.size);if(!(s>0))return null;return d.unit==='tsubo'?{tsubo:s,sqm:s*LAND_TSUBO}:{tsubo:s/LAND_TSUBO,sqm:s};}
  const landArea=(tsubo)=>Math.round(tsubo*LAND_TSUBO)+'㎡（約'+Math.round(tsubo)+'坪）';
  function landMyEditScreen(){
    const d=ui.lpMyEdit||{},st=d.step??0,isEdit=state.land.my.some(x=>x.id===d.id);
    const title=isEdit?'土地を編集':'土地を登録';
    const prog='<div class="lp-fs-prog">'+[1,2,3,4].map(n=>'<button class="'+(n===st?'is-cur':n<st?'is-done':'')+'" data-act="lp-my-step" data-value="'+n+'">'+(n<st?'✓':n)+'</button>').join('<i></i>')+'</div>';
    const navb=(back,next,label)=>'<div class="lp-fs-nav">'+(back!=null?'<button class="btn" data-act="lp-my-step" data-value="'+back+'">‹ 戻る</button>':'<span></span>')+'<button class="btn primary" data-act="'+(next==='save'?'lp-my-save':'lp-my-step')+'" data-value="'+next+'">'+label+'</button></div>';
    if(st===0){
      return modalFrame(title,'<div class="panel detail grow lp-fs lp-my-wiz">'+
        landSay('<b class="lp-fs-q">どうやって入れる？</b>','happy','lp-fs-say')+
        '<div class="lp-fs-types">'+
          '<button data-act="lp-my-mode" data-value="paste"><span class="lp-fs-ic">📋</span><b>広告の文章を貼り付ける</b><small>SUUMOなどの物件ページをコピー → 自動で読み取り</small></button>'+
          '<button data-act="lp-my-step" data-value="1"><span class="lp-fs-ic">✏️</span><b>自分で入れる</b><small>場所・広さ・値段の3つだけ</small></button></div>'+
        (d.mode==='paste'?'<div class="lp-my-paste"><textarea data-lp-my="ad" rows="5" placeholder="例）多治見市音羽町3丁目 土地面積165.29㎡（50.00坪） 価格1,480万円 JR中央線「多治見」駅 徒歩12分 南側公道5m">'+esc(d.ad||'')+'</textarea><button class="btn primary wide" data-act="lp-my-parse">読み取る</button></div>':'')+
        '</div>');
    }
    const c=landCity(d.city),size=landMySize(d),price=Number(d.price);
    let q,body,next=st+1,label='次へ ›';
    if(st===1){
      q='どこの土地？';
      const quick=[...new Set([state.land.sim.city,...state.land.favorites,...state.land.my.map(m=>m.city)].filter(Boolean))].slice(0,6).map(landCity).filter(Boolean);
      const cityOpts='<option value="">市区町村を選ぶ</option>'+LAND_REGION_ORDER.map(region=>{const cs=(landData?.cities||[]).filter(x=>x.region===region);return cs.length?'<optgroup label="'+esc(region)+'">'+cs.map(x=>'<option value="'+esc(x.code)+'"'+(d.city===x.code?' selected':'')+'>'+esc(x.name)+'</option>').join('')+'</optgroup>':'';}).join('');
      body=(quick.length?'<div class="lp-fs-chips lp-my-quick">'+quick.map(x=>'<button class="'+(d.city===x.code?'active':'')+'" data-act="lp-my-city" data-value="'+x.code+'">'+esc(x.name.replace(/^名古屋市/,''))+'</button>').join('')+'</div>':'')+
        '<select class="lp-my-big-select" data-lp-my="city">'+cityOpts+'</select>'+
        '<div class="lp-my-line"><span>町名（わかれば）</span><button class="lp-my-fake'+(d.town?'':' is-empty')+'" data-act="lp-pick-open" data-value="town">'+(d.town?esc(d.town):'例：音羽町3丁目')+'<i>›</i></button></div>'+
        '<div class="lp-my-line"><span>最寄駅（わかれば）</span><button class="lp-my-fake'+(d.station?'':' is-empty')+'" data-act="lp-pick-open" data-value="station">'+(d.station?esc(d.station)+'駅':'例：多治見')+'<i>›</i></button></div>'+
        (()=>{const st=landStationFind(d.station),R=landRail();return st&&R?'<p class="lp-my-line-hit">🚉 '+esc(st.name)+'駅：'+esc(R.lineOf(st).join('・'))+'</p>':(d.station?'<p class="lp-my-line-hit is-miss">駅名が見つかりません（候補から選んでね）</p>':'');})();
      if(!d.city)next=null;
    }else if(st===2){
      q='広さは？（広告の「土地面積」）';
      const z=landSizeCalc(),need=landTb(z.site);
      const verdict=size?(size.tsubo<need-5?['narrow','目安より狭め']:size.tsubo>need*1.6?['wide','かなり広い']:['ok','ちょうどいい']):null;
      body='<div class="lp-fs-big lp-my-size"><label><input type="number" inputmode="decimal" step="0.01" data-label="土地の広さ" data-lp-my="size" value=""'+esc(d.size??'')+'" placeholder="0"><i>'+(d.unit==='tsubo'?'坪':'㎡')+'</i></label></div>'+
        '<div class="lp-my-unit">'+landSeg('lp-my-unit',d.unit==='tsubo'?'tsubo':'sqm',[['sqm','㎡（平米）で入れる'],['tsubo','坪で入れる']],'lp-seg-fill')+'</div>'+
        '<p class="lp-fs-hint">'+(size?'＝ <b>'+Math.round(size.sqm*10)/10+'㎡</b>・<b>約'+(Math.round(size.tsubo*10)/10)+'坪</b>':'広告に「165.29㎡（50.00坪）」のように書いてあります')+'</p>'+
        (verdict?'<div class="lp-my-verdict v-'+verdict[0]+'">'+landMascot(verdict[0]==='narrow'?'think':'happy',30,false)+'<p>'+state.land.size.people+'人・車'+state.land.size.cars+'台の目安は約'+need+'坪（'+Math.round(need*LAND_TSUBO)+'㎡）→ <b>'+verdict[1]+'</b></p></div>':'');
      if(!size)next=null;
    }else if(st===3){
      q='広告の「価格」はいくら？';
      let prev='';
      const ref0=c&&size?landMyRef({city:d.city,town:d.town}):null,mk=ref0?ref0.sqm*size.sqm:null;
      const guess=mk?Math.round(mk*1.1/100000)*10:null;
      const guide=mk?'<div class="lp-my-guide">'+landMascot('normal',30,false)+'<div><p>家は入らない<b>土地だけ</b>の値段だよ。</p><p>'+esc(c.name.replace(/^名古屋市/,'')+(d.town?' '+d.town:''))+'で'+Math.round(size.sqm)+'㎡なら、だいたい <b>'+landMan(mk)+'〜'+landMan(mk*1.25)+'</b></p></div></div>'+
        (!(price>0)?'<button class="lp-fs-sub lp-my-guess" data-act="lp-my-guess" data-value="'+guess+'">まだ決まってなければ 相場の約'+guess.toLocaleString()+'万円で入れる ›</button>':''):'';
      if(c&&size&&price>0){const ref=landMyRef({city:d.city,town:d.town}),unit=price*10000/size.tsubo,ratio=ref?unit/(ref.sqm*LAND_TSUBO):null;
        const tone=ratio==null?null:ratio<0.95?['cheap','割安']:ratio<=1.25?['fair','相場なみ']:['high','高め'];
        prev='<p class="lp-fs-hint">坪 <b>'+(unit/10000).toFixed(1)+'万円</b>（1㎡あたり'+(unit/LAND_TSUBO/10000).toFixed(1)+'万円）</p>'+
          (tone?'<div class="lp-my-verdict v-'+tone[0]+'">'+landMascot(tone[0]==='high'?'think':'happy',30,false)+'<p>この辺りの目安 坪'+(ref.sqm*LAND_TSUBO/10000).toFixed(1)+'万円 → <b>'+tone[1]+'</b></p></div>':'');}
      body='<div class="lp-fs-big"><label><input type="number" inputmode="decimal" step="1" data-label="土地の価格" data-lp-my="price" value=""'+esc(d.price??'')+'" placeholder="0"><i>万円</i></label></div>'+(price>0?prev:guide);
      if(!(price>0))next=null;
    }else{
      q='わかればもっと正確に（なくてもOK）';next='save';label='保存して評価 ›';
      const inp=(k,l,type,unit,ph)=>'<label class="lp-sim-field"><span>'+l+'</span><span class="lp-sim-num"><input type="'+type+'" '+(type==='number'?'inputmode="decimal" ':'')+'data-lp-my="'+k+'" value="'+esc(d[k]??'')+'" placeholder="'+esc(ph)+'">'+(unit?'<i>'+unit+'</i>':'')+'</span></label>';
      body='<div class="lp-sim-form lp-my-form">'+inp('walk','駅まで徒歩','number','分','10')+inp('road','前の道路の幅','number','m','4')+
        '<div class="lp-sim-field lp-sim-wide"><span>道路はどっち側？</span>'+landSeg('lp-my-dir',d.dir||'',LAND_MY_DIRS,'lp-seg-fill')+'</div>'+
        '<div class="lp-sim-field lp-sim-wide"><span>建築条件</span>'+landSeg('lp-my-cond',d.cond?'1':'0',[['0','なし'],['1','あり']],'lp-seg-fill')+'</div>'+
        inp('name','呼び名','text','','A土地')+inp('memo','メモ','text','','日当たり良い')+
        '<label class="lp-sim-field lp-sim-wide"><span>用途地域</span><select data-lp-my="zone">'+LAND_MY_ZONES.map(z=>'<option value="'+esc(z)+'"'+(d.zone===z?' selected':'')+'>'+(z||'わからない')+'</option>').join('')+'</select></label>'+
        '</div>'+(isEdit?'<button class="lp-howto-all lp-danger" data-act="lp-my-del" data-value="'+esc(d.id)+'">この土地を削除</button>':'');
    }
    const summary=st>1?'<div class="lp-my-sum">'+[c?c.name+(d.town?' '+d.town:''):'',size?landArea(size.tsubo):'',price>0?landMan(price*10000):''].filter(Boolean).map(t=>'<span>'+esc(t)+'</span>').join('')+'</div>':'';
    return modalFrame(title,'<div class="panel detail grow lp-fs lp-my-wiz">'+prog+summary+landSay('<b class="lp-fs-q">'+q+'</b>',st===4?'normal':'happy','lp-fs-say')+
      '<div class="lp-fs-body" style="--k:'+st+'">'+body+'</div>'+
      (st===3&&next?'<div class="lp-fs-nav"><button class="btn" data-act="lp-my-save">ここで保存</button><button class="btn primary" data-act="lp-my-step" data-value="4">詳しく入れる ›</button></div>':
        navb(st>1?st-1:0,next||st+1,label))+'</div>');
  }
  function landMySync(){
    const d={...(ui.lpMyEdit||{})};
    app.querySelectorAll('.lp-my-wiz [data-lp-my]').forEach(el=>{d[el.dataset.lpMy]=el.value;});
    ui.lpMyEdit=d;return d;
  }
  function landV15Action(action,v){
    const L=state.land;
    if(action==='lp-my-save'){landMySync();return false;}
    const d=action.startsWith('lp-my-')?landMySync():(ui.lpMyEdit||{});
    if(action==='lp-my-step'){
      const to=Number(v),cur=d.step??0;
      if(v==='null'||to>cur){
        if(cur===1&&!d.city)return message('市区町村を選んでください');
        if(cur===2&&!landMySize(d))return message('広さを入れてください');
        if(cur===3&&!(Number(d.price)>0))return message('値段を入れてください');
      }
      if(v==='null')return;
      return step(()=>{ui.lpMyEdit={...d,step:to};});}
    if(action==='lp-my-mode')return step(()=>{ui.lpMyEdit={...d,mode:v};});
    if(action==='lp-my-city')return step(()=>{ui.lpMyEdit={...d,city:v};});
    if(action==='lp-my-guess')return step(()=>{ui.lpMyEdit={...d,price:Number(v)};});
    if(action==='lp-my-parse'){
      const ta=app.querySelector('[data-lp-my="ad"]'),txt=ta?ta.value:d.ad,got=landParseAd(txt||'');
      const keys=Object.keys(got);
      if(!keys.length)return message('読み取れませんでした。自分で入れてください');
      ui.lpMyEdit={...d,...got,ad:txt,step:!got.city?1:!got.size?2:!got.price?3:4};
      message('読み取り：'+[got.city&&'場所',got.station&&'最寄駅',got.size&&'広さ',got.price&&'値段',got.walk!=null&&'駅徒歩',got.road&&'道路幅',got.dir&&'道路の向き',got.zone&&'用途地域'].filter(Boolean).join('・'));
      return render();
    }
    return false;
  }
  /* ===== 駅・沿線（r96）：国土数値情報 鉄道データ N02 ===== */
  let landStations=null,landRailCache={st:null,data:null,v:null};
  async function landLoadStations(){
    try{const r=await fetch('./data/stations.json',{cache:'no-cache'});if(r.ok){const j=await r.json();if(Array.isArray(j?.stations)&&Array.isArray(j?.lines)){landStations=j;landRailCache.v=null;render();}}}catch(_){}
  }
  const LAND_OP={'東海旅客鉄道':'JR','JR東海交通事業':'JR','西日本旅客鉄道':'JR','名古屋鉄道':'名鉄','名古屋市':'地下鉄','近畿日本鉄道':'近鉄','名古屋臨海高速鉄道':'あおなみ線','愛知高速交通':'リニモ','愛知環状鉄道':'愛環','豊橋鉄道':'豊鉄','名古屋ガイドウェイバス':'ゆとりーとライン','明知鉄道':'明知鉄道','長良川鉄道':'長良川鉄道','樽見鉄道':'樽見鉄道','養老鉄道':'養老鉄道','三岐鉄道':'三岐鉄道'};
  const LAND_OP_ORDER=['JR','名鉄','地下鉄','近鉄','あおなみ線','リニモ','愛環','豊鉄'];
  function landLineLabel(l){
    const op=LAND_OP[l.op]||l.op;let n=l.name.replace(/^\d号線/,'').replace(/線$/,'')+'線';
    if(op==='あおなみ線'||op==='リニモ')return op;
    if(op==='愛環')return '愛知環状鉄道';
    if(op==='ゆとりーとライン')return 'ゆとりーとライン';
    if(/新幹線/.test(n))return null;
    return op+(op==='地下鉄'||op==='JR'||op==='名鉄'||op==='近鉄'||op==='豊鉄'?'':'・')+n;
  }
  function landRail(){
    if(!landStations||!landData)return null;
    if(landRailCache.v===landData&&landRailCache.st===landStations)return landRailCache.data;
    const pts=(landData.points||[]).filter(p=>Number.isFinite(p.lat));
    const stations=landStations.stations.map(s=>{
      let best=null,bd=4;for(const p of pts){const dl=Math.abs(p.lat-s.lat);if(dl>0.04)continue;const d=landKm(s.lat,s.lon,p.lat,p.lon);if(d<bd){bd=d;best=p;}}
      return {...s,city:best?.cityCode||null};
    });
    const byLabel=new Map();
    landStations.lines.forEach((l,i)=>{const label=landLineLabel(l);if(!label)return;if(!byLabel.has(label))byLabel.set(label,{label,op:LAND_OP[l.op]||l.op,idx:[]});byLabel.get(label).idx.push(i);});
    const lines=[...byLabel.values()].map(L=>{const st=stations.filter(s=>s.lines.some(i=>L.idx.includes(i)));return {...L,stations:st,cities:new Set(st.map(s=>s.city).filter(Boolean))};})
      .filter(L=>L.cities.size).sort((a,b)=>{const oa=LAND_OP_ORDER.indexOf(a.op),ob=LAND_OP_ORDER.indexOf(b.op);return ((oa<0?99:oa)-(ob<0?99:ob))||b.stations.length-a.stations.length;});
    const lineOf=s=>lines.filter(L=>L.stations.includes(s)).map(L=>L.label);
    const data={stations,lines,lineOf};
    landRailCache={st:landStations,v:landData,data};
    return data;
  }
  function landLineFilterLabel(f){return f&&f.startsWith('line:')?f.slice(5)+'沿線':null;}
  function landStationFind(name){
    const R=landRail();if(!R||!name)return null;
    const n=String(name).replace(/駅$/,'').trim();
    return R.stations.find(s=>s.name===n)||null;
  }
  function landStationOptions(city){
    const R=landRail();if(!R)return '';
    const list=R.stations.slice().sort((a,b)=>((b.city===city)-(a.city===city))||a.name.localeCompare(b.name,'ja'));
    return '<datalist id="lp-stations">'+list.map(s=>'<option value="'+esc(s.name)+'">'+esc(R.lineOf(s).slice(0,2).join('・'))+'</option>').join('')+'</datalist>';
  }
  function landLineChips(){
    const R=landRail();if(!R)return '<p class="lp-note">駅・路線データを読み込み中です</p>';
    const groups=[...new Set(R.lines.map(L=>LAND_OP_ORDER.includes(L.op)?L.op:'その他'))];
    return groups.map(g=>'<div class="lp-line-group"><span>'+esc(g)+'</span><div>'+R.lines.filter(L=>(LAND_OP_ORDER.includes(L.op)?L.op:'その他')===g).map(L=>'<button class="'+(state.land.filter==='line:'+L.label?'active':'')+'" data-act="lp-fs-area" data-value="line:'+esc(L.label)+'">'+esc(L.label.replace(/^(JR|名鉄|地下鉄|近鉄|豊鉄)/,''))+'</button>').join('')+'</div></div>').join('');
  }
  /* --- 町名・最寄駅の入力（画面の一番上に入力欄。キーボードで画面が動かない） --- */
  function landPickItems(){
    const P=ui.lpPick||{},d=ui.lpMyEdit||{},q=String(P.q||'').trim(),c=landCity(d.city);
    let items=[];
    if(P.field==='station'){
      const R=landRail();if(!R)return '<p class="lp-note">駅のデータを読み込み中です</p>';
      const qq=q.replace(/駅$/,'');
      items=R.stations.filter(s=>!qq||s.name.includes(qq)).sort((a,b)=>((b.city===d.city)-(a.city===d.city))||(qq?(a.name.indexOf(qq)-b.name.indexOf(qq)):0)||a.name.localeCompare(b.name,'ja')).slice(0,40)
        .map(s=>'<button data-act="lp-pick-set" data-value="'+esc(s.name)+'"><b>'+esc(s.name)+'駅</b><small>'+esc(R.lineOf(s).join('・'))+(s.city&&s.city!==d.city?'・'+esc(landCity(s.city)?.name||''):'')+'</small></button>');
    }else{
      const towns=c?[...new Set((landData?.points||[]).filter(p=>p.cityCode===c.code).map(p=>landTownOf(p,c)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja')):[];
      items=towns.filter(t=>!q||t.includes(q)).slice(0,40).map(t=>'<button data-act="lp-pick-set" data-value="'+esc(t)+'"><b>'+esc(t)+'</b><small>'+esc(c.name)+'</small></button>');
      if(q)items.unshift('<button class="is-use" data-act="lp-pick-set" data-value="'+esc(q)+'"><b>「'+esc(q)+'」で決定</b><small>番地まで入れてもOK</small></button>');
    }
    return items.length?items.join(''):'<p class="lp-note">見つかりません。別の書き方で入れてみてね。</p>';
  }
  function landPickScreen(){
    const P=ui.lpPick||{},isSt=P.field==='station';
    return '<div class="full lp-pick"><header class="full-header"><button class="btn compact" data-act="lp-pick-back">‹ 戻る</button><strong>'+(isSt?'最寄駅を選ぶ':'町名を入れる')+'</strong>'+
      '<button class="btn compact" data-act="lp-pick-set" data-value="">'+(isSt?'なし':'空欄')+'</button></header>'+
      '<input class="lp-pick-input" type="search" enterkeyhint="done" autocomplete="off" autocorrect="off" autocapitalize="off" data-lp-pick value="'+esc(P.q||'')+'" placeholder="'+(isSt?'駅名（例：多治見）':'町名（例：音羽町）')+'">'+
      '<div class="lp-pick-list">'+landPickItems()+'</div></div>';
  }
  function landV17Action(action,v){
    if(action==='lp-pick-open'){
      landMySync();const d=ui.lpMyEdit||{};
      ui.lpPick={field:v==='station'?'station':'town',q:(v==='station'?d.station:d.town)||''};ui.overlay='land-pick';render();
      const inp=app.querySelector('.lp-pick-input');if(inp){try{inp.focus({preventScroll:true});}catch(_){inp.focus();}}
      return;
    }
    if(action==='lp-pick-back')return step(()=>{ui.overlay='land-my-edit';});
    if(action==='lp-pick-set')return step(()=>{const f=ui.lpPick?.field||'town';ui.lpMyEdit={...(ui.lpMyEdit||{}),[f]:v};ui.overlay='land-my-edit';});
    return false;
  }
  /* ===== 入力をすべて専用の入力画面で（r99）：iPhoneのキーボードで画面が動かないように ===== */
  // 数字＝アプリ内のテンキー（キーボードを出さない）、文字＝画面の一番上に入力欄がある入力画面
  let kp=null;
  function landProxyInputs(){
    app.querySelectorAll('input:not([type=range]):not([type=checkbox]):not([data-lp-pick]),textarea').forEach(el=>{
      if(el.dataset.proxy)return;
      el.dataset.proxy=el.type==='number'?'num':'text';
      el.readOnly=true;el.setAttribute('inputmode','none');el.tabIndex=-1;
    });
  }
  function landFieldLabel(el){
    return (el.dataset.label||el.closest('label')?.querySelector('span')?.textContent||el.getAttribute('aria-label')||el.placeholder||'入力').replace(/[＊*]/g,'').trim();
  }
  function landFieldUnit(el){return el.parentElement?.querySelector('i')?.textContent||'';}
  function kpClose(){if(kp?.node)kp.node.remove();kp=null;}
  function kpCommit(){
    if(!kp)return;
    const {el,val}=kp;kpClose();
    if(!el||!document.body.contains(el))return;
    el.value=val;
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
    if(el.dataset.lpWorkQuery!==undefined)landWorkSearch(val);
  }
  function kpRender(){
    if(!kp)return;
    const disp=kp.type==='num'?(kp.val===''?'0':kp.val):'';
    // 2回目以降は数字の表示だけ書き換える（毎回作り直すと、出てくる動きがくり返されて一瞬消えて見えるため）
    if(kp.type==='num'&&kp.built){const b=kp.node.querySelector('.kp-val b');if(b){b.textContent=disp;return;}}
    if(kp.type==='num'){kp.built=true;
      kp.node.innerHTML='<div class="kp-dim" data-kp="cancel"></div><div class="kp-sheet" role="dialog" aria-label="'+esc(kp.label)+'">'+
        '<div class="kp-head"><button data-kp="cancel">キャンセル</button><span>'+esc(kp.label)+'</span><button class="kp-ok" data-kp="ok">決定</button></div>'+
        '<div class="kp-val"><b>'+esc(disp)+'</b><i>'+esc(kp.unit)+'</i></div>'+
        '<div class="kp-keys">'+['1','2','3','4','5','6','7','8','9',kp.dec?'.':'','0','⌫'].map(k=>k?'<button data-kp="'+k+'">'+k+'</button>':'<span></span>').join('')+'</div>'+
        '<button class="kp-clear" data-kp="clear">クリア</button></div>';
    }else{
      kp.node.innerHTML='<div class="kp-full" role="dialog" aria-label="'+esc(kp.label)+'"><div class="kp-head"><button data-kp="cancel">キャンセル</button><span>'+esc(kp.label)+'</span><button class="kp-ok" data-kp="ok">決定</button></div>'+
        (kp.multi?'<textarea class="kp-text" rows="6" placeholder="'+esc(kp.ph)+'">'+esc(kp.val)+'</textarea>':'<input class="kp-text" type="'+(kp.url?'url':'text')+'" enterkeyhint="done" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="'+esc(kp.ph)+'" value="'+esc(kp.val)+'">')+
        (kp.pass?'':'<p class="kp-hint">入力したら「決定」を押してね</p>')+'</div>';
      const t=kp.node.querySelector('.kp-text');
      if(kp.pass)t.type='password';
      try{t.focus({preventScroll:true});}catch(_){t.focus();}
      const len=t.value.length;try{t.setSelectionRange(len,len);}catch(_){}
    }
  }
  function kpOpen(el){
    kpClose();
    const node=document.createElement('div');node.className='kp-root';document.body.appendChild(node);
    const step=String(el.getAttribute('step')||'1');
    kp={el,node,type:el.dataset.proxy,val:String(el.value||''),label:landFieldLabel(el),unit:landFieldUnit(el),
      dec:step.includes('.')||Number(step)<1,multi:el.tagName==='TEXTAREA',url:el.type==='url',pass:el.type==='password',ph:el.placeholder||'',fresh:true};
    node.addEventListener('click',e=>{const b=e.target.closest('[data-kp]');if(!b)return;e.preventDefault();const k=b.dataset.kp;
      if(k==='cancel')return kpClose();
      if(k==='ok'){if(kp.type==='text')kp.val=kp.node.querySelector('.kp-text').value;return kpCommit();}
      if(k==='clear'){kp.val='';kp.fresh=false;return kpRender();}
      if(k==='⌫'){kp.val=kp.fresh?'':kp.val.slice(0,-1);kp.fresh=false;return kpRender();}
      if(kp.fresh){kp.val='';kp.fresh=false;}
      if(k==='.'&&(kp.val.includes('.')))return;
      if(kp.val.replace('.','').length>=9)return;
      kp.val=(kp.val==='0'&&k!=='.')?k:(kp.val===''&&k==='.'?'0.':kp.val+k);kpRender();});
    node.addEventListener('keydown',e=>{if(e.key==='Enter'&&kp?.type==='text'&&!kp.multi){e.preventDefault();kp.val=e.target.value;kpCommit();}});
    kpRender();
  }
  // 入力欄のタップで開く（キャプチャで先に受け取る）
  document.addEventListener('click',e=>{
    const el=e.target.closest?.('#app [data-proxy]');if(!el)return;
    e.preventDefault();e.stopPropagation();kpOpen(el);
  },true);
  function landSimMonthly(total){
    const M=state.land.money,loan=Math.max(0,total-(M.own||0)*10000),pay=landPay(loan,M.rate,M.years);
    const inc=M.income*10000,burden=inc>0?pay*12/inc*100:null;
    return '<button class="lp-sim-monthly" data-act="lp-loan-open" data-value="money"><span>月々の返済</span><b>'+landYenFull(pay)+'</b>'+
      '<small>頭金'+(M.own||0)+'万・'+(M.rate===3.81?'全期間固定':M.rate===3.5?'10年固定':'変動')+M.rate+'%・'+M.years+'年'+(burden!=null?'・年収の'+burden.toFixed(0)+'%':'')+'</small><em>詳しく ›</em></button>';
  }
  function overlay(){return ui.overlay==='land-detail'?landDetailScreen():ui.overlay==='land-settings'?landSettingsScreen():
    ui.overlay==='land-about'?landAboutScreen():ui.overlay==='land-maker'?landMakerDetail():ui.overlay==='land-area'?landAreaScreen():ui.overlay==='land-town'?landTownScreen():ui.overlay==='land-commute'?landCommuteSettingsScreen():ui.overlay==='land-word'?landWordScreen():ui.overlay==='land-size'?landSizeScreen():ui.overlay==='land-help'?landHelpScreen():ui.overlay==='land-find-city'?landFindCityScreen():ui.overlay==='land-find-maker'?landFindMakerScreen():ui.overlay==='land-loan'?landLoanScreen():ui.overlay==='land-ready'?landReadyScreen():ui.overlay==='land-my'?landMyDetail():ui.overlay==='land-my-edit'?landMyEditScreen():ui.overlay==='land-howto'?landHowtoScreen():ui.overlay==='land-pick'?landPickScreen():'';}
  function render(){
    if(!app)return;
    const liveMain=app.querySelector('main.main');
    if(ui.overlay&&liveMain){
      const current=app.querySelector('.full');
      if(current)current.outerHTML=overlay();else app.insertAdjacentHTML('beforeend',overlay());
      landProxyInputs();renderToast();return;
    }
    app.innerHTML='<main class="main" aria-label="地価調べ君">'+landScreen()+'</main>'+(ui.overlay?overlay():'');
    landProxyInputs();renderToast();renderReleaseBanner();
  }
  function handler(action,button){
    const v=button.dataset.value;
    if(action==='hoppo-update-dismiss'){remoteRelease.notice='';renderReleaseBanner();return;}
    if(action==='hoppo-hard-refresh'){window.location.assign('./refresh.html?new='+encodeURIComponent(remoteRelease.latest||BUILD));return;}
    if(action==='overlay-close'){if(ui.overlay==='land-help'&&ui.lpHelpBack){const b=ui.lpHelpBack;ui.lpHelpBack=null;return step(()=>{ui.overlay=b;});}return closeOverlay();}
    if(action.startsWith('lp-'))return landAction(action,v);
  }
  let touch=null,lastSwipeAt=0;
  app.addEventListener('click',e=>{if(Date.now()-lastSwipeAt<350){e.preventDefault();return;}const b=e.target.closest('[data-act]');if(!b||!app.contains(b))return;e.preventDefault();handler(b.dataset.act,b);});
  app.addEventListener('change',e=>{
    const el=e.target;
    if(el.dataset?.lpSim!==undefined){state.land.sim=landSimNormalize({...state.land.sim,[el.dataset.lpSim]:el.value});save();render();return;}
    if(el.dataset?.lpMy!==undefined){
      ui.lpMyEdit={...(ui.lpMyEdit||{}),[el.dataset.lpMy]:el.value};
      if(['city','size','price','station'].includes(el.dataset.lpMy))render();
      return;
    }
    if(el.dataset?.lpFs!==undefined){
      if(el.dataset.lpFs==='monthly')state.land.find=landFindNormalize({...state.land.find,monthly:el.value});
      else state.land.money=landMoneyNormalize({...state.land.money,own:el.value});
      save();render();return;
    }
    if(el.dataset?.lpFind!==undefined){
      state.land.find=landFindNormalize({...state.land.find,[el.dataset.lpFind]:el.value});ui.lpFindPage=0;save();render();return;
    }
    if(el.dataset?.lpMoney!==undefined){
      state.land.money=landMoneyNormalize({...state.land.money,[el.dataset.lpMoney]:el.value});ui.lpTipPage=0;save();render();return;
    }
    if(el.dataset?.lpMakerSort!==undefined){
      if(LAND_MAKER_SORTS.some(x=>x[0]===el.value))state.land.makerSort=el.value;
      ui.lpMakerPage=0;save();render();return;
    }
    if(el.dataset?.lpArea!==undefined){
      if((v=>typeof v==='string'&&(LAND_FILTERS.some(x=>x[0]===v)||(v.startsWith('line:')&&v.length<40)))(el.value))state.land.filter=el.value;
      ui.lpPage=0;ui.lpCommutePage=0;if(state.land.view==='map')landMapFit();else if(ui.map)ui.map.sel=null;save();render();return;
    }
    if(el.dataset?.lpCommute!==undefined){
      const k=el.dataset.lpCommute;
      if(k==='years'){state.land.commute=landCommuteNormalize({...state.land.commute,years:el.value});el.value=state.land.commute.years;}
      else{landSetPerson({[k]:el.value});el.value=landPerson()[k];}
      save();return;
    }
    if(el.dataset?.lpWorkCity!==undefined){
      const c=landCity(el.value),pt=c&&landCentroids().get(c.code);
      if(c&&pt){landSetWork(c.name+'（市区町村の中心付近）',pt.lat,pt.lon);render();}
      return;
    }
    if(el.dataset?.lpGuideScope!==undefined){state.land.guideScope=landNormalize({...state.land,guideScope:el.value}).guideScope;ui.lpGuidePage=0;save();render();return;}
    if(el.dataset?.lpSetting!==undefined){
      const key=el.dataset.lpSetting,next=landNormalize({...state.land,[key]:el.value});
      if(!(key in next))return;
      state.land[key]=next[key];el.value=next[key];save();
      if(ui.overlay==='land-settings')render();
    }
  });
  app.addEventListener('input',e=>{const el=e.target;
    if(el?.dataset?.lpPick!==undefined){ui.lpPick={...(ui.lpPick||{}),q:el.value};const box=app.querySelector('.lp-pick-list');if(box)box.innerHTML=landPickItems();return;}
    if(el?.dataset?.lpSim!=='landPct')return;
    const p=Math.round(Number(el.value)),box=el.parentElement?.querySelector('.lp-ratio-bar');if(!box)return;
    const i=box.querySelector('i'),em=box.querySelector('em');if(i){i.style.width=p+'%';i.querySelector('b').textContent='土地 '+p+'%';}if(em)em.querySelector('b').textContent='建物 '+(100-p)+'%';});
  // iPhoneでキーボードを閉じたあと画面が上下にずれたままになるのを戻す
  document.addEventListener('focusout',()=>setTimeout(()=>{const a=document.activeElement;if(!a||!/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)){try{window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0;}catch(_){}}},80));

  // （入力欄へのスクロールは行わない：画面全体が動く原因になるため）
  app.addEventListener('pointerdown',landMapDown);
  window.addEventListener('pointermove',landMapMove,{passive:false});
  window.addEventListener('pointerup',landMapUp);window.addEventListener('pointercancel',landMapUp);
  app.addEventListener('wheel',e=>{if(!e.target.closest?.('[data-map]'))return;e.preventDefault();landV4Action('lp-map-zoom',e.deltaY<0?'1':'-1');},{passive:false});
  app.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target?.dataset?.lpPick!==undefined){e.preventDefault();const q=e.target.value.trim();if(q){const f=ui.lpPick?.field;const val=f==='station'?(landStationFind(q)?.name||q.replace(/駅$/,'')):q;ui.lpMyEdit={...(ui.lpMyEdit||{}),[f]:val};ui.overlay='land-my-edit';render();}return;}if(e.key==='Enter'&&e.target?.dataset?.lpWorkQuery!==undefined){e.preventDefault();landWorkSearch(e.target.value);}});
  app.addEventListener('touchstart',e=>{const zone=e.target.closest('.swipe-zone');if(!zone||e.target.closest('input,textarea,select,label')){touch=null;return;}touch={x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY,zone:zone.dataset.swipe||''};},{passive:true});
  app.addEventListener('touchend',e=>{
    if(!touch)return;const dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y,zone=touch.zone;touch=null;
    if(Math.abs(dx)<55||Math.abs(dy)>Math.abs(dx)*.7)return;
    if(ui.overlay){if(ui.overlay==='land-area'&&zone==='lp-area'){lastSwipeAt=Date.now();landV3Action('lp-area-page',String(dx<0?1:-1));}return;}
    lastSwipeAt=Date.now();landSwipe(zone,dx<0?1:-1);
  },{passive:true});

  // 地価データ（端末保存→初期データ→公開JSONの順に読む）。描画後に非同期で実行。
  loadState();
  Promise.resolve().then(landBoot).catch(()=>{});
  save();render();
  Promise.resolve().then(verifyPublishedRelease).catch(()=>{});
  try{document.addEventListener('visibilitychange',()=>{if(!document.hidden)verifyPublishedRelease();});}catch(_){}
  const launch=document.getElementById('hoppo-launch');
  if(launch?.id==='hoppo-launch'){
    const reduceMotion=!!reduced.matches;
    setTimeout(()=>{
      launch.classList.add('is-leaving');
      setTimeout(()=>launch.remove(),reduceMotion?30:280);
    },reduceMotion?100:760);
  }
  if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'))window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'})
      .then(reg=>reg.update().catch(()=>{})).catch(()=>{});
  });
})();
