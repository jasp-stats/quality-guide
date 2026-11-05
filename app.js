/* Guide content and exports run locally. Online media is requested only on demand. */
const DATA = JSON.parse(document.getElementById('guide-data').textContent);
const ANALYSES = DATA.analyses;
const SAMPLES = DATA.examples;
const APP_VERSION = '0.5';
const app = document.getElementById('app');
const e = value => String(value == null ? '' : value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const iconPaths = {
  chart:'<path d="M3 3v18h18"/><path d="m6 15 4-5 4 3 6-8"/><path d="M5 7h1m3 0h1m3 0h1m3 0h1"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  ruler:'<path d="m3 17 14-14 4 4L7 21Z"/><path d="m7 13 2 2m1-5 2 2m1-5 2 2"/>',
  compare:'<path d="M4 5h16M4 12h16M4 19h16"/><circle cx="9" cy="5" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="11" cy="19" r="2" fill="currentColor"/>',
  experiment:'<path d="M8 3h8M10 3v6l-6 10a1.4 1.4 0 0 0 1.2 2h13.6a1.4 1.4 0 0 0 1.2-2L14 9V3"/><path d="M7 15h10"/><circle cx="10" cy="18" r=".5"/><circle cx="14" cy="12" r=".5"/>',
  scatter:'<path d="M3 3v18h18M6 17 19 6"/><circle cx="7" cy="12" r="1"/><circle cx="11" cy="15" r="1"/><circle cx="15" cy="7" r="1"/><circle cx="19" cy="10" r="1"/>',
  lifetime:'<path d="M3 3v18h18M5 6h5v4h4v5h5v3h2"/><path d="M8 3v3m4 2v4m5 1v4"/>',
  inspection:'<path d="m3 7 9-4 9 4v11l-9 4-9-4Z"/><path d="m3 7 9 4 9-4M12 11v11m-5-8 2 2 4-4"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  back:'<path d="M20 12H4m6-6-6 6 6 6"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  play:'<path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
  print:'<path d="M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6Z"/><path d="M17 11h1"/>',
  copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  book:'<path d="M12 5v16M3 4h5a4 4 0 0 1 4 3 4 4 0 0 1 4-3h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z"/>',
  search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  folder:'<path d="M3 6h7l2 3h9v11H3Z"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .4-1 1-1 2m0 3v.1"/>',
  shield:'<path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  external:'<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  list:'<path d="M9 5h12M9 12h12M9 19h12M3 5h1m-1 7h1m-1 7h1"/>'
};
const icon = (name,cls='')=>`<svg class="icon ${e(cls)}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${iconPaths[name]||iconPaths.info}</svg>`;
const sourceLink = s=>`<a href="${e(s.url)}" target="_blank" rel="noopener noreferrer">${e(s.title)} ${icon('external')}</a>`;
const button = (label,action,value='',style='secondary',ic='')=>`<button class="button ${style}" data-action="${e(action)}" data-value="${e(value)}">${ic?icon(ic):''}${e(label)}</button>`;
let activeContext=null;
let lastAnalysis=null;
let toastTimer;
let catalogFamily='all';
let catalogQuery='';
let firstRender=true;
function toast(message) {
  const t=document.getElementById('toast');
  t.textContent=message;t.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3800);
}
function navigate(hash) {
  if (location.hash===hash) render(); else location.hash=hash;
}
function readRoute() {
  let parts=[];
  try {parts=decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/').filter(Boolean);} catch {return {view:'home'};}
  if (!parts.length) return {view:'home'};
  if (parts[0]==='guide'&&GOALS[parts[1]]) return {view:'guide',goal:parts[1],picks:parts.slice(2)};
  if (parts[0]==='case'&&SCENARIOS[parts[1]]) return {view:'guide',goal:SCENARIOS[parts[1]].goal,picks:parts.slice(2),caseId:parts[1]};
  if (parts[0]==='analysis'&&ANALYSES[parts[1]]) return {view:'analysis',id:parts[1]};
  if (['examples','analyses','about'].includes(parts[0])) return {view:parts[0]};
  return {view:'missing'};
}
function flowUrl(context,picks) {
  return (context.caseId?'#/case/'+context.caseId:'#/guide/'+context.goal)+(picks.length?'/'+picks.join('/'):'');
}
function caseUrl(id) {return '#/case/'+id+'/'+SCENARIOS[id].picks.join('/');}
function stageBar(done=false) {
  return `<div class="stage-bar" aria-label="${done?'Your next step':'Choosing an analysis'}">
    <span class="stage done"><span>✓</span> Your goal</span><span class="stage-line"></span>
    <span class="stage ${done?'done':'current'}"${done?'':' aria-current="step"'}><span>${done?'✓':'2'}</span> Your process</span><span class="stage-line"></span>
    <span class="stage ${done?'current':''}"${done?' aria-current="step"':''}><span>3</span> Next step</span></div>`;
}
function flowTop(context,done=false) {
  const label=context&&context.history.length?'Previous question':'All goals';
  return `<div class="flow-top"><button class="back-link" data-action="${context?'back':'home'}">${icon('back')}${context?label:'Find an analysis'}</button>${context?stageBar(done):'<span class="badge neutral">Analysis reference</span>'}</div>`;
}
function journey(context) {
  if(!context) return `<div class="route-card"><p class="route-title">Find your starting point</p><h3 class="route-goal">${icon('help')} Does this fit your process?</h3><p class="route-empty">Answer a few questions to check your goal, measurement type, and study structure.</p><div class="route-footer"><button class="text-button" data-action="home">Use guided selection ${icon('arrow')}</button></div></div>`;
  const g=GOALS[context.goal];
  return `<div class="route-card"><p class="route-title">Your decision path</p><div class="route-goal">${icon(g.icon)} ${e(g.title)}</div>
    ${context.history.length?'<ol class="route-items">'+context.history.map((h,i)=>`<li class="route-item"><button data-action="edit" data-value="${i}" aria-label="Change answer to ${e(h.short)}"><span class="route-q">${e(h.short)}</span><span class="route-a">${e(h.label)}</span></button></li>`).join('')+'</ol>':'<p class="route-empty">Your answers will appear here as you go.</p>'}
    <div class="route-footer">Select any answer to change it.<br><button class="text-button" data-action="start" data-value="${e(context.goal)}" style="margin-top:8px">Start this route again ${icon('arrow')}</button></div></div>`;
}
function caseNote(context) {
  if(!context||!context.caseId) return '';
  const s=SCENARIOS[context.caseId];
  return `<div class="case-note"><p class="eyebrow">Worked example</p><h3>${e(s.title)}</h3><p>${e(s.description)}</p>${s.sample?'<button class="text-button" data-action="csv" data-value="'+e(s.sample)+'">Download example '+icon('download')+'</button>':'<p class="settings-label">Example settings are included in the analysis guide.</p>'}</div>`;
}
function miniSeries(sampleId,small=false) {
  const s=SAMPLES[sampleId];if(!s)return '';
  const idx=s.columns.indexOf('fill_ml');
  if(idx<0)return '';
  const vals=s.rows.map(r=>Number(r[idx]));
  const W=small?340:560,H=small?100:190,p={l:small?29:45,r:12,t:12,b:small?18:33};
  const lo=Math.floor(Math.min(...vals)-1),hi=Math.ceil(Math.max(...vals)+1);
  const x=i=>p.l+i*(W-p.l-p.r)/Math.max(vals.length-1,1),y=v=>p.t+(hi-v)*(H-p.t-p.b)/(hi-lo);
  const path=vals.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+','+y(v).toFixed(1)).join(' ');
  const ticks=[lo,500,hi].filter((v,i,a)=>v>=lo&&v<=hi&&a.indexOf(v)===i);
  return `<svg class="${small?'teaser-chart':''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Synthetic fill volume measurements in collection order. A mean shift was introduced after observation 40.">
    <title>Example filling measurements</title>
    ${ticks.map(v=>`<line x1="${p.l}" x2="${W-p.r}" y1="${y(v)}" y2="${y(v)}" stroke="#dbe7e8" stroke-dasharray="3 4"/><text x="${p.l-6}" y="${y(v)+3}" text-anchor="end" font-size="8" fill="#6b8a90">${v}</text>`).join('')}
    <path d="${path}" stroke="#007d8d" stroke-width="${small?'1.7':'2'}" fill="none" stroke-linejoin="round"/>
    <text x="${p.l}" y="${H-3}" font-size="8" fill="#6b8a90">1</text><text x="${W-p.r}" y="${H-3}" text-anchor="end" font-size="8" fill="#6b8a90">${vals.length}</text>
    ${small?'':`<text x="${W/2}" y="${H-3}" text-anchor="middle" font-size="10" fill="#6b8a90">Collection order</text><text x="6" y="9" font-size="9" fill="#6b8a90">mL</text>`}</svg>`;
}
function capabilityHistogram(sampleId) {
  if(!['cap_spread','cap_offcenter'].includes(sampleId))return '';
  const values=SAMPLES[sampleId].rows.map(r=>r[1]);
  const all=['cap_spread','cap_offcenter'].flatMap(k=>SAMPLES[k].rows.map(r=>r[1]));
  const lo=Math.floor(Math.min(480,...all)/5)*5,hi=Math.ceil(Math.max(520,...all)/5)*5;
  const bins=20,counts=Array(bins).fill(0),bw=(hi-lo)/bins;
  values.forEach(v=>counts[Math.max(0,Math.min(bins-1,Math.floor((v-lo)/bw)))]++);
  const W=560,H=210,p={l:35,r:20,t:27,b:34},max=Math.max(...counts);
  const x=v=>p.l+(v-lo)*(W-p.l-p.r)/(hi-lo),y=v=>H-p.b-v*(H-p.b-p.t)/max;
  return `<figure class="preview-plot"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Histogram of synthetic fill volumes with specification limits at 490 and 510 millilitres. Bars show observed counts, not fitted probabilities.">
    <title>Synthetic fill volumes and specification limits</title>
    <text x="${p.l}" y="12" font-size="10" fill="#5e7e85">Count</text>
    ${counts.map((n,i)=>`<rect x="${x(lo+i*bw)+1}" y="${y(n)}" width="${(W-p.l-p.r)/bins-2}" height="${H-p.b-y(n)}" rx="1" fill="#4a9fa8"/>`).join('')}
    ${[490,510].map((v,i)=>`<line x1="${x(v)}" x2="${x(v)}" y1="25" y2="${H-p.b}" stroke="#c77713" stroke-width="1.8" stroke-dasharray="5 3"/><text x="${x(v)}" y="17" text-anchor="middle" font-size="10" fill="#94601b">${i?'USL':'LSL'} ${v}</text>`).join('')}
    <line x1="${p.l}" x2="${W-p.r}" y1="${H-p.b}" y2="${H-p.b}" stroke="#bdd2d6"/>
    ${[lo,490,500,510,hi].filter((v,i,a)=>a.indexOf(v)===i).map(v=>`<text x="${x(v)}" y="${H-p.b+16}" text-anchor="middle" font-size="9" fill="#5e7e85">${v}</text>`).join('')}
    <text x="${p.l-7}" y="${y(max)+4}" text-anchor="end" font-size="9" fill="#5e7e85">${max}</text>
    <text x="${W/2}" y="${H-2}" text-anchor="middle" font-size="10" fill="#5e7e85">Fill volume (mL)</text>
    </svg><figcaption>Observed synthetic values, ${values.length} bottles. Orange lines are specification limits. This preview is a histogram, not a capability calculation.</figcaption></figure>`;
}
function pageMasthead(title,introHtml='',label='',modifier='') {
  return `<header class="page-masthead ${e(modifier)}"><div class="masthead-inner container">${label?'<p class="masthead-label">'+e(label)+'</p>':''}<h1 id="page-title" tabindex="-1">${e(title)}</h1>${introHtml?'<div class="masthead-intro">'+introHtml+'</div>':''}</div></header>`;
}
function renderHome() {
  return `${pageMasthead('JASP Quality Guide','<p class="masthead-subtitle">Find your next analysis.</p><p>Explore '+Object.keys(ANALYSES).length+' analysis guides and '+Object.keys(SAMPLES).length+' practical example datasets, with step-by-step instructions for using JASP.</p><p class="resource-note">Annotated JASP files and short videos are being added for each analysis. Coming-soon placeholders mark resources that are not available yet.</p><a class="masthead-action" href="#/analyses">Already know your method? Browse the guides '+icon('arrow')+'</a>','','home-masthead')}
    <section class="goal-section container" aria-labelledby="goals-title"><div class="section-heading"><h2 id="goals-title">What is your goal?</h2><p>Choose a starting point.</p></div>
    <div class="goal-grid">${Object.entries(GOALS).map(([id,g])=>`<button class="goal-card" data-action="start" data-value="${id}"><span class="icon-wrap">${icon(g.icon)}</span><span class="goal-copy"><span class="goal-title">${e(g.title)}</span><span class="goal-description">${e(g.description)}</span></span>${icon('arrow')}</button>`).join('')}</div></section>
    <section class="home-example-band" aria-labelledby="home-example-title"><div class="example-teaser container"><div class="example-copy"><p class="eyebrow">Try a worked example</p><h2 id="home-example-title">Has the filling process shifted?</h2><p>Follow a production-line question from observations to an analysis.</p><button class="button" data-action="case" data-value="filling">Explore the example ${icon('arrow')}</button></div><div class="example-visual">${miniSeries('individuals',false)}</div></div></section>
    <div class="home-bottom container"><a class="text-button" href="#/about">About this guide ${icon('arrow')}</a></div>`;
}
function renderQuestion(context) {
  const q=NODES[context.current],g=GOALS[context.goal];
  return `<div class="question-banner"><div class="container"><p>${e(g.title)}</p></div></div><div class="container content-section question-workspace">${flowTop(context)}
    <div class="flow-layout"><section class="question-panel" aria-labelledby="page-title">
      <div class="question-meta"><span class="badge">${icon(g.icon)}${e(g.family)}</span><span class="question-number">Question ${context.history.length+1}</span></div>
      <h1 id="page-title" tabindex="-1">${e(q.title)}</h1><p class="question-description" id="question-description">${e(q.description)}</p>
      <fieldset class="choice-list" aria-describedby="question-description"><legend class="sr-only">${e(q.title)}</legend>${q.options.map(o=>`<button class="choice" data-action="answer" data-value="${e(o.value)}"><span class="choice-icon" aria-hidden="true"></span><span class="choice-copy"><span class="choice-title">${e(o.label)}</span><span class="choice-desc">${e(o.description)}</span></span>${icon('chevron')}</button>`).join('')}</fieldset>
      <details class="helper"><summary>Not sure? Help me choose</summary><div class="helper-copy">${q.help.map(p=>'<p>'+e(p)+'</p>').join('')}</div></details>
      <p class="question-end">${icon('info')} Select an answer to continue. You can change it at any time.</p>
    </section><aside class="sidebar">${journey(context)}${caseNote(context)}</aside></div></div>`;
}
function sourcesBlock(sources) {
  return `<details class="sources"><summary>Documentation &amp; sources (${sources.length})</summary><ul>${sources.map(s=>'<li>'+sourceLink(s)+'</li>').join('')}</ul><small>Menus and options are tied to the reviewed module sources. Recent beta features are marked separately; see <a href="#/about">version scope</a>. These links require internet access.</small></details>`;
}
function mappingTable(a) {
  if(!a.columns.length)return '<div class="settings-note"><h3>Enter the settings directly in JASP</h3><p>This analysis accepts plan settings or summary inputs. Follow the setup above and the concrete values in the example; a CSV is not required.</p></div>';
  return `<h3 class="minor-heading">Arrange your data</h3><div class="table-scroll" tabindex="0" aria-label="Data column guide"><table class="mapping-table"><thead><tr><th scope="col">Example column</th><th scope="col">Type</th><th scope="col">What it contains</th></tr></thead><tbody>${a.columns.map(c=>`<tr><td>${e(c.name)}</td><td><span class="type-label">${e(c.type)}</span></td><td>${e(c.description)}</td></tr>`).join('')}</tbody></table></div><p class="module-hint">Use your own column names. Check the measurement types in JASP; identifiers should identify units, not be treated as numerical predictors by default.</p>`;
}
function dataPreview(sample) {
  if(!sample)return '<div class="settings-note"><h3>A worked example using settings</h3><p>Enter the values above directly in JASP. This example needs no dataset; the setup is included when you save or print the analysis plan.</p></div>';
  return `<div class="table-scroll" tabindex="0" aria-label="Preview of ${e(sample.title)}"><table class="data-table"><thead><tr><th class="row-number" scope="col">Row</th>${sample.columns.map(c=>'<th scope="col">'+e(c)+'</th>').join('')}</tr></thead><tbody>${sample.rows.slice(0,7).map((r,i)=>'<tr><td class="row-number">'+(i+1)+'</td>'+r.map(v=>'<td>'+e(v)+'</td>').join('')+'</tr>').join('')}</tbody></table></div><div class="table-caption"><span>Showing ${Math.min(7,sample.rows.length)} of ${sample.rows.length} rows · ${sample.columns.length} columns</span><span>Download includes every row</span></div>`;
}
function exampleInfo(a,context) {
  const scenario=context&&context.caseId?SCENARIOS[context.caseId]:null;
  const use=scenario&&scenario.result===a.id;
  const sampleId=use?scenario.sample:a.example.sample;
  return {sampleId,sample:SAMPLES[sampleId],title:use?scenario.title:a.example.title,story:use?scenario.description:a.example.story,scenario:use?scenario:null};
}
function conditionalNote(a,context) {
  const answers=context?answerMap(context.history):{};
  const out=[];
  if(a.family==='capability'&&answers.c_specs==='one')out.push('You selected a one-sided requirement. Enter only the genuine lower or upper specification; do not interpret a two-sided Cp. The example below has its own stated limits.');
  if(a.id==='contingency'&&answers.h_outcome==='categories')out.push('Your outcome has several categories. Keep all relevant category counts; the Pass/Fail dataset is only an example of the layout. A 2 × 2 Fisher test does not apply to a larger table.');
  if(a.family==='model'&&answers.r_goal==='prediction')out.push('For prediction, set aside genuinely new observations or use appropriate validation. Evaluate prediction uncertainty and performance; the fitted-data R² or classification accuracy is not enough.');
  if(a.id==='survival_parametric'&&answers.s_censor==='interval')out.push('Your records include left- or interval-censoring. Select the Interval format and preserve both bounds using the encodings in the setup below. The downloadable example demonstrates right-censoring and must not replace your interval bounds.');
  if(['variance_two','variance_multiple'].includes(a.id)&&answers.h_variance_structure==='summary')out.push('You selected summary data from independent normal populations. Use the summary-input and F/Bartlett options described below; the raw-data Levene procedure cannot be recovered from sample sizes and variances alone.');
  return out.map(t=>'<div class="note-banner">'+e(t)+'</div>').join('');
}
function availabilityInfo(a) {
  return a.availability||{module:a.path[0],sourceVersion:'v0.96.0 interface baseline',status:'released',note:'Menu and setup reviewed against released module sources. Check the installed help if its wording differs.'};
}
function availabilityLabel(a) {
  const info=availabilityInfo(a);
  return info.status==='beta'?'Recent beta · check installed options':info.status==='source-verified'?'Source verified · check availability':'Released module';
}
function availabilityBlock(a) {
  const info=availabilityInfo(a);
  return `<details class="availability-note ${info.status==='released'?'':'availability-conditional'}" ${info.status==='released'?'':'open'}><summary>${icon(info.status==='released'?'check':'info')}<strong>${e(availabilityLabel(a))}</strong><span>${e(info.sourceVersion)}</span></summary><p>${e(info.note)}</p></details>`;
}
function analysisMedia(a) {
  const media=DATA.media;
  const selection={...media.defaults,...media.analyses[a.id]};
  return {video:media.assets[selection.video]||null,jasp:media.assets[selection.jasp]||null};
}
let cachedVideoSource=null;
let cachedVideoBlob=null;
let releaseVideoListeners=null;
function embeddedVideoBlob(source) {
  if(cachedVideoSource!==source){
    const raw=atob(source.slice(source.indexOf(',')+1));
    const bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    cachedVideoBlob=new Blob([bytes],{type:'video/mp4'});
    cachedVideoSource=source;
  }
  return cachedVideoBlob;
}
function releaseAnalysisVideo() {
  if(releaseVideoListeners){releaseVideoListeners();releaseVideoListeners=null;}
  const player=document.getElementById('analysis-video');
  if(!player)return;
  player.pause();
  if('srcObject' in player)player.srcObject=null;
  player.removeAttribute('src');
  player.load();
}
function attachAnalysisVideo() {
  const player=document.getElementById('analysis-video');
  if(!player||!lastAnalysis)return;
  const status=document.getElementById('analysis-video-status');
  const error=document.getElementById('analysis-video-error');
  const listeners={
    loadstart:()=>{if(player.dataset.started)status.hidden=false;},
    waiting:()=>{if(player.dataset.started&&!player.error)status.hidden=false;},
    stalled:()=>{if(player.dataset.started&&!player.paused&&!player.error)status.hidden=false;},
    canplay:()=>{status.hidden=true;},
    playing:()=>{status.hidden=true;error.hidden=true;},
    pause:()=>{status.hidden=true;},
    ended:()=>{status.hidden=true;},
    error:()=>{if(player.dataset.started){status.hidden=true;error.hidden=false;}}
  };
  for(const [name,handler] of Object.entries(listeners))player.addEventListener(name,handler);
  releaseVideoListeners=()=>{
    for(const [name,handler] of Object.entries(listeners))player.removeEventListener(name,handler);
  };
}
function startAnalysisVideo(retry=false) {
  const player=document.getElementById('analysis-video');
  if(!player||!lastAnalysis)return;
  const {video}=analysisMedia(lastAnalysis.a);
  if(!video)return;
  const status=document.getElementById('analysis-video-status');
  const error=document.getElementById('analysis-video-error');
  document.getElementById('analysis-video-play').hidden=true;
  error.hidden=true;status.hidden=false;
  player.focus({preventScroll:true});
  const request=String(Number(player.dataset.request||0)+1);
  player.dataset.request=request;
  const failed=()=>{
    // Navigation may have replaced this player while play() was pending.
    if(document.getElementById('analysis-video')!==player||player.dataset.request!==request)return;
    status.hidden=true;error.hidden=false;
  };
  try{
    if(!player.dataset.started||retry){
      player.dataset.started='true';
      if(retry){
        player.pause();
        if('srcObject' in player)player.srcObject=null;
        player.removeAttribute('src');
        player.load();
        status.hidden=false;
      }
      // Decode only a requested offline video. Online URLs use native streaming.
      let attached=false;
      if(video.src.startsWith('data:')&&'srcObject' in player){
        try{player.srcObject=embeddedVideoBlob(video.src);attached=true;}catch{}
      }
      if(!attached)player.src=video.src;
    }
    const playback=player.play();
    if(playback&&typeof playback.catch==='function')playback.catch(failed);
  }catch{failed();}
}
function learningSection(a) {
  const {video,jasp}=analysisMedia(a);
  const placeholder=DATA.media.videoPlaceholder;
  return `<section class="learning-section" aria-labelledby="learning-title">
    <div class="learning-heading"><h2 id="learning-title">See it in JASP</h2></div>
    <div class="learning-grid"><figure class="video-card">
      ${video?`<div id="analysis-video-stage" class="video-stage">
        <video id="analysis-video" class="video-frame" controls muted playsinline preload="none" tabindex="0" aria-label="${e(video.title)}" aria-describedby="video-note">Your browser does not support this video. <a href="${e(video.src)}">Open the video</a>.</video>
        <button id="analysis-video-play" class="video-play-overlay" type="button" data-action="video-play" aria-label="${e('Play '+video.title)}" aria-describedby="video-note"><span class="video-play-icon">${icon('play')}</span><span>Watch walkthrough</span><span class="video-play-hint">Step by step in JASP</span></button>
        <div id="analysis-video-status" class="video-loading" role="status" hidden><span class="loading-spinner" aria-hidden="true"></span><span>Loading video…</span></div>
        <div id="analysis-video-error" class="video-error" role="status" hidden><p>We couldn’t play this video.</p><div class="video-error-actions"><button class="button" type="button" data-action="video-play" data-value="retry">Try again</button><a href="${e(video.src)}" target="_blank" rel="noopener noreferrer">Open video separately</a></div></div>
      </div>`:`<img class="video-frame video-placeholder" src="${e(placeholder.src)}" alt="${e(placeholder.alt)}" width="1328" height="712" aria-describedby="video-note">`}
      <figcaption id="video-note">${video?e(video.note):'A video walkthrough for this analysis is coming soon.'}</figcaption>
    </figure><aside class="download-card" aria-labelledby="download-title"><span class="icon-wrap">${icon('folder')}</span><h3 id="download-title">Annotated JASP file</h3><p>Explore a saved analysis with notes on its data, settings, and results.</p>
      ${jasp?`<a class="button" href="${e(jasp.src)}" download="${e(jasp.filename)}" aria-describedby="jasp-note">${icon('download')}Download annotated JASP file</a>`:`<button type="button" class="button secondary" data-action="jasp-unavailable" data-value="${e(a.id)}" aria-describedby="jasp-note">${icon('download')}Download annotated JASP file</button>`}<p class="resource-note" id="jasp-note">${jasp?e(jasp.note):'Coming soon'}</p>
    </aside></div></section>`;
}
function renderResult(a,context) {
  lastAnalysis={a,context};
  const g=GOALS[a.family],ex=exampleInfo(a,context);
  const introLabel=context?(context.caseId?'Worked example · JASP analysis':'Suggested JASP analysis'):'JASP analysis guide';
  const source=(a.sources||[]).concat([]);
  const module=a.path[0];
  const optionalModule=['Quality Control','Equivalence T-Tests','Classical Tests','Survival','Acceptance Sampling'].includes(module);
  return `${pageMasthead(a.title,'<p>'+e(a.summary)+'</p>',g.family,'analysis-masthead')}<div class="container analysis-page content-section">${flowTop(context,true)}
    <article class="analysis-content">
      <div class="result-header-top"><span class="result-kicker">${icon(g.icon)} ${e(introLabel)}</span></div>
      ${learningSection(a)}
      <section class="result-header" aria-labelledby="page-title">
        <div class="jasp-path"><p class="jasp-path-label">${icon('folder')} Where to go in JASP</p><div class="path-parts">${a.path.map((p,i)=>(i?icon('chevron'):'')+'<span class="'+(i===a.path.length-1?'path-last':'')+'">'+e(p)+'</span>').join('')}</div></div>
        ${optionalModule?'<p class="module-hint">'+e('If '+module+' is hidden, enable it using JASP’s + / Modules menu.')+'</p>':''}
        ${conditionalNote(a,context)}
        <details class="analysis-context"><summary>${context?'Why this analysis fits your answers':'When to use this analysis'}</summary><p>${e(a.why)}</p>${context?'':'<p>Suitability has not been checked. <a href="#/">Answer a few questions</a> to find a starting point.</p>'}</details>
        ${availabilityBlock(a)}
      </section>
      <div class="print-heading"><strong>Decision path:</strong> ${context?e(GOALS[context.goal].title+' → '+context.history.map(h=>h.label).join(' → ')):'Viewed from the analysis reference; suitability has not been checked by a guided path.'}</div>
      <section class="result-body"><div class="tabs" role="tablist" aria-label="Analysis guidance">
        <button class="tab" role="tab" id="tab-setup" aria-selected="true" aria-controls="panel-setup" tabindex="0" data-action="tab" data-value="setup">JASP setup</button>
        <button class="tab" role="tab" id="tab-example" aria-selected="false" aria-controls="panel-example" tabindex="-1" data-action="tab" data-value="example">Example &amp; inputs</button>
        <button class="tab" role="tab" id="tab-checks" aria-selected="false" aria-controls="panel-checks" tabindex="-1" data-action="tab" data-value="checks">Checks &amp; reporting</button>
      </div>
      <div class="tab-panel" id="panel-setup" role="tabpanel" aria-labelledby="tab-setup" tabindex="0"><h2>Set up the analysis</h2><ol class="setup-list">${a.setup.map(s=>'<li><div><h3>'+e(s.title)+'</h3><p>'+e(s.text)+'</p></div></li>').join('')}</ol>${mappingTable(a)}${sourcesBlock(source)}</div>
      <div class="tab-panel" id="panel-example" role="tabpanel" aria-labelledby="tab-example" tabindex="0" hidden><span class="badge orange">${ex.sample?'Synthetic teaching data':'Synthetic planning example'}</span><h2 style="margin-top:15px">${e(ex.title)}</h2><p class="example-story">${e(ex.story)}</p>
        ${ex.scenario?'<p class="example-story"><strong>'+e(ex.scenario.lesson)+'</strong></p>':''}
        <ul class="example-instructions">${a.example.instructions.map(s=>'<li>'+e(s)+'</li>').join('')}</ul>
        ${dataPreview(ex.sample)}${capabilityHistogram(ex.sampleId)}
        ${ex.sampleId==='individuals'?'<figure class="preview-plot">'+miniSeries('individuals')+'<figcaption>Raw synthetic observations in collection order. The guide does not estimate control limits; run the chart in JASP.</figcaption></figure>':''}
        ${ex.sample?'<div class="sample-controls">'+button('Download CSV','csv',ex.sampleId,'','download')+button('Copy data','copy-csv',ex.sampleId,'secondary','copy')+'</div><div class="example-notes"><ul>'+ex.sample.notes.map(s=>'<li>'+e(s)+'</li>').join('')+'</ul></div>':''}
        ${a.id==='cap_normal'?'<div class="learn-more-strip"><p>Compare the two teaching examples with the same specification limits: too much variation versus an off-centre mean.</p><button class="text-button" data-action="case" data-value="'+(ex.sampleId==='cap_offcenter'?'spread':'centering')+'">Compare examples '+icon('arrow')+'</button></div>':''}
      </div>
      <div class="tab-panel" id="panel-checks" role="tabpanel" aria-labelledby="tab-checks" tabindex="0" hidden><h2>Before you interpret the output</h2><ul class="review-list">${a.checks.map(c=>'<li>'+icon('check')+'<span>'+e(c)+'</span></li>').join('')}</ul><div class="report-block"><h3>What to examine and report</h3><ul>${a.report.map(r=>'<li>'+e(r)+'</li>').join('')}</ul></div><p class="result-status">These are checks to carry out in JASP and in your process records. Choosing answers in this guide does not verify the data or establish that assumptions hold.</p></div></section>
      <div class="action-row plan-actions">${button('Save analysis plan','plan','','secondary','download')}${button('Print plan','print','','secondary','print')}${button('Copy plan','copy-plan','','ghost','copy')}</div>
      <p class="result-status">The guide helps you choose and prepare an analysis. Run the analysis and examine its results in JASP.</p>
      <div class="result-bottom">${context?'<details class="analysis-context"><summary>Your answers · change your decision path</summary>'+journey(context)+'</details>':''}${a.related&&a.related.length?'<div class="related-card"><h3>Explore related analyses</h3>'+a.related.filter(r=>ANALYSES[r.id]).map(r=>'<button class="related-link" data-action="analysis" data-value="'+e(r.id)+'">'+e(r.label)+' '+icon('chevron')+'</button>').join('')+'</div>':''}</div>
    </article></div>`;
}
function renderGuard(context) {
  const guard=GUARDS[context.current.slice(2)];
  return `${pageMasthead(guard.title,'<p>'+e(guard.summary)+'</p>','Preparation or review required','masthead-guard')}<div class="container content-section">${flowTop(context,true)}<div class="flow-layout"><section class="guard-panel"><p class="guard-outcome">${icon('info')} No JASP analysis has been selected for this path yet.</p><h2>What to do next</h2><ol>${guard.steps.map(s=>'<li>'+e(s)+'</li>').join('')}</ol>
    ${guard.goals&&guard.goals.length?'<div class="action-row">'+guard.goals.map((id,i)=>button(GOALS[id].title,'start',id,i?'secondary':'',GOALS[id].icon)).join('')+'</div>':''}
    ${guard.analyses&&guard.analyses.length?'<h2>Relevant JASP guides to review</h2><div class="related-card">'+guard.analyses.map(id=>'<button class="related-link" data-action="analysis" data-value="'+id+'">'+e(ANALYSES[id].title)+' '+icon('arrow')+'</button>').join('')+'</div>':''}
    <p class="guard-note">Use the steps above to resolve this prerequisite. Related guides are references to help with that review.</p>
    ${sourcesBlock((guard.sources||[]).map(id=>REFERENCES[id]))}
    </section><aside class="sidebar">${journey(context)}${caseNote(context)}<div class="aside-note"><h3>${icon('help')} You can revisit an answer</h3><p>If the description does not match your situation, select an earlier answer in the decision path.</p></div></aside></div></div>`;
}
function renderExamples() {
  return `${pageMasthead('Try a practical example.','<p>Explore a worked decision path, download the data, and follow the setup in JASP. Every example is synthetic and designed for teaching.</p>','From question to analysis')}<div class="container content-section">
    <div class="examples-banner">${icon('folder')}<p><strong>${Object.keys(SAMPLES).length} downloadable datasets, plus examples using plan settings.</strong> The cases below highlight common choices. CSV files include all rows and open in JASP; check variable types after importing. Planning examples show the values to enter directly.</p></div>
    <div class="example-grid">${Object.entries(SCENARIOS).map(([id,s])=>`<article class="scenario-card"><span class="badge">${icon(GOALS[s.family].icon)}${e(GOALS[s.family].family)}</span><h2>${e(s.title)}</h2><p>${e(s.description)}</p><div class="scenario-lesson">${e(s.lesson)}</div><div class="sample-controls"><button class="button" data-action="case" data-value="${id}">Explore the example ${icon('arrow')}</button>${s.sample?'<button class="button secondary" data-action="csv" data-value="'+e(s.sample)+'">'+icon('download')+' CSV · '+SAMPLES[s.sample].rows.length+' rows</button>':'<span class="settings-label">Settings included · no CSV needed</span>'}</div></article>`).join('')}</div></div>`;
}
function renderCatalogue() {
  return `${pageMasthead('Find a method you know.','<p>Browse the analyses covered by this guide, or <a href="#/">answer a few questions</a> to choose a starting point for your process.</p>','The JASP analysis reference')}<div class="container content-section">
    <div class="filter-row"><div class="search-wrap">${icon('search')}<label for="analysis-search" class="sr-only">Search analyses, for example Welch, defects, or capability</label><input id="analysis-search" type="search" placeholder="Search analyses, e.g. Welch or defects" value="${e(catalogQuery)}" autocomplete="off"></div><div class="filters" role="group" aria-label="Filter analyses by goal"><button class="filter ${catalogFamily==='all'?'active':''}" data-action="filter" data-value="all" aria-pressed="${catalogFamily==='all'}">All</button>${Object.entries(GOALS).map(([id,g])=>'<button class="filter '+(catalogFamily===id?'active':'')+'" data-action="filter" data-value="'+id+'" aria-pressed="'+(catalogFamily===id)+'">'+e(g.short)+'</button>').join('')}</div></div><p class="catalog-count" id="catalog-count" aria-live="polite"></p><div class="catalog-grid" id="catalog-results"></div></div>`;
}
const SEARCH_ALIASES = {
  imr:'i mr imr x mr shewhart individual moving range',xbar_r:'xbar r x-bar subgroup average range',xbar_s:'xbar s x-bar subgroup mean standard deviation',
  p_chart:'p chart defectives rejected proportion fraction variable denominator',np_chart:'np chart nonconforming defective rejected constant sample',
  c_chart:'c chart count defects fixed opportunity',u_chart:'u chart counts rate defects variable exposure',
  ewma:'exponentially weighted moving average small shift drift',cusum:'cumulative sum small shift',
  cap_normal:'cp cpk pp ppk cpm normal capability tolerance specs',cap_nonnormal:'skewed lognormal weibull gamma transformation box cox johnson capability',
  gage_crossed:'gage gauge r&r rr crossed repeatability reproducibility msa',gage_nested:'gage gauge r&r rr nested destructive msa',
  gage_type1:'instrument type i type 1 bias cg cgk',gage_linearity:'linearity bias type 4',
  attribute_agreement:'kappa tau pass fail inspectors raters categorical measurement agreement',
  ind_t:'welch independent t test two samples difference means',paired_t:'paired dependent matched before after t test',
  one_t:'one sample t test target reference mean',one_anova:'one way welch anova independent groups three means',
  rm_anova:'repeated measures anova dependent same items conditions',
  eq_one:'tost equivalence one sample target close enough',eq_ind:'tost equivalence independent two suppliers close enough',
  eq_paired:'tost equivalence paired interchangeable mean differences',
  binomial:'proportion binomial pass fail defective one sample frequency',
  contingency:'chi square chi squared fisher exact categorical proportions frequencies association',
  doe_factorial:'doe design of experiments full fractional factorial screening create worksheet',
  doe_surface:'doe response surface central composite box behnken optimization optimise axial centre center',
  doe_analyze:'doe analyze analyse design factorial response surface interactions optimizer',
  linear_regression:'linear regression predict association drivers continuous covariates r2',
  logistic_regression:'logistic regression binary odds probability defectives classification'
};
Object.assign(SEARCH_ALIASES, {
  correlation_pearson:'pearson r correlation matrix association scatterplot',
  correlation_rank:'spearman rho kendall tau ranks ordinal ties monotonic correlation',
  correlation_partial:'partial correlation adjusted covariates residual bootstrap',
  variance_one:'classical variance sigma chi square standard deviation one spread',
  variance_two:'classical variance sigma f test levene brown forsythe bonett bartlett spread two',
  variance_multiple:'classical variance levene brown forsythe bonett bartlett three multiple spread',
  poisson_one:'classical poisson count event rate exposure one',poisson_two:'classical poisson count rates ratio exposure two',
  proportion_two:'classical binomial proportions fisher risk difference ratio two',proportion_multiple:'classical proportions chi square groups many',
  survival_km:'survival reliability lifetime failure kaplan meier km censored log rank',
  survival_cox:'survival reliability cox regression hazard proportional predictors censored',
  survival_parametric:'survival reliability life time weibull b10 quantile percentile interval censoring lognormal',
  survival_accelerated:'survival reliability accelerated life alt arrhenius eyring stress temperature aft beta',
  survival_mixture:'survival reliability mixture latent failure populations weibull beta',
  survival_recurrent:'survival reliability repaired recurrent duane crow amsaa nhpp log linear piecewise beta',
  accept_create_attribute:'acceptance sampling design attribute aql rql ltpd producer consumer risk binomial hypergeometric poisson',
  accept_analyze_attribute:'acceptance sampling evaluate attribute oc curve asn multistage stages aoq ati',
  accept_create_variable:'acceptance sampling design variable k method normal aql rql',
  accept_analyze_variable:'acceptance sampling evaluate variable k method oc curve normal',
  accept_decide_variable:'acceptance sampling accept reject lot variable k method decision',
  accept_bayesian_single:'acceptance sampling bayesian posterior prior single lot beta',
  accept_bayesian_sequence:'acceptance sampling bayesian state space sequential lots dynamic beta'
});
function updateCatalogue() {
  const target=document.getElementById('catalog-results');if(!target)return;
  const terms=catalogQuery.toLowerCase().normalize('NFKD').split(/\s+/).filter(Boolean);
  const entries=Object.values(ANALYSES).filter(a=>(catalogFamily==='all'||a.family===catalogFamily)&&terms.every(t=>([a.title,a.summary,a.why,a.path.join(' '),SEARCH_ALIASES[a.id]||''].join(' ')).toLowerCase().normalize('NFKD').includes(t)));
  document.getElementById('catalog-count').textContent=entries.length+' '+(entries.length===1?'analysis guide':'analysis guides')+(catalogQuery?' matching “'+catalogQuery+'”':' in this view');
  target.innerHTML=entries.length?entries.map(a=>`<button class="analysis-card" data-action="analysis" data-value="${a.id}"><span class="icon-wrap">${icon(GOALS[a.family].icon)}</span><div><h2>${e(a.title)}</h2><p>${e(a.summary)}</p><span class="analysis-family">${e(GOALS[a.family].family)}${availabilityInfo(a).status==='beta'?' <span class="beta-tag">Recent beta</span>':''}</span></div>${icon('chevron')}</button>`).join(''):'<div class="empty-state" style="grid-column:1/-1;margin:0"><h2>No matching analysis in this guide</h2><p>Try a broader term or another goal. This prototype covers selected workflows; it is not a complete inventory of JASP.</p><div class="action-row">'+button('Clear search','clear-search')+button('Find an analysis','home','','','arrow')+'</div></div>';
  document.querySelectorAll('[data-action="filter"]').forEach(b=>{b.classList.toggle('active',b.dataset.value===catalogFamily);b.setAttribute('aria-pressed',String(b.dataset.value===catalogFamily));});
}
function renderAbout() {
  const logo=document.querySelector('.brand img').src;
  const betaCount=Object.values(ANALYSES).filter(a=>availabilityInfo(a).status==='beta').length;
  return `${pageMasthead('A practical route into JASP.','<p>An interactive prototype created for JASP Services B.V. to help quality practitioners choose, prepare, and discuss an appropriate analysis.</p>','About the guide')}<div class="container content-section">
    <div class="about-grid"><div>
    <section class="about-section"><h2>How to use it</h2><ol><li><strong>Choose a goal.</strong> Start with the process question you want to answer.</li><li><strong>Describe your data and design.</strong> Use the short explanations when a distinction is unfamiliar.</li><li><strong>Follow the next step.</strong> An analysis result gives the JASP menu and setup. A preparation result identifies what must be resolved first.</li><li><strong>Keep an analysis plan.</strong> Copy, save, or print the recommendation, availability note, example, and decision path.</li></ol>
      <h3>What this version covers</h3><p>${Object.keys(ANALYSES).length} analysis guides across ${Object.keys(GOALS).length} starting goals. Some guides use the same JASP dialog with different settings and interpretations.</p>
      <div class="table-scroll"><table class="mapping-table scope-table"><thead><tr><th scope="col">Area</th><th scope="col">Included examples</th></tr></thead><tbody>
      <tr><td>Control charts</td><td>Individuals, subgroups, p/np, c/u, EWMA, CUSUM</td></tr>
      <tr><td>Capability</td><td>Normal and nonnormal continuous measurements</td></tr>
      <tr><td>Measurement systems</td><td>Type 1, linearity, crossed and nested Gauge R&amp;R, attribute agreement</td></tr>
      <tr><td>Comparisons</td><td>Means and equivalence; one, two, and multiple proportions; variances; one and two Poisson rates</td></tr>
      <tr><td>DOE</td><td>Factorial and response-surface planning and analysis</td></tr>
      <tr><td>Relationships</td><td>Pearson, Spearman/Kendall, and partial correlation; linear and binary logistic regression</td></tr>
      <tr><td>Lifetimes</td><td>Kaplan–Meier, Cox, and parametric lifetimes; recent beta routes for accelerated life, mixtures, and recurrent events</td></tr>
      <tr><td>Acceptance sampling</td><td>Attribute and variable plan design/evaluation; variable lot decisions; recent beta Bayesian single-lot and state-space analyses</td></tr>
      </tbody></table></div><p>Further specialised selection remains outside this version: multivariate charts, mixed models, general count regression, competing risks, step-stress modelling, constrained DOE, and comprehensive sample-size planning. Review outcomes explain when the current route is insufficient.</p>
    </section>
    <section class="about-section"><h2>What each outcome means</h2>
      <p><strong>Suggested JASP analysis:</strong> a named JASP menu, explicit inputs, setup steps, example, interpretation checks, and source links. Run it in the installed module after checking the design and assumptions.</p>
      <p><strong>Recent beta · check installed options:</strong> ${betaCount} advanced guides use verified beta additions. Guided selection asks whether the relevant menu or controls are visible. The catalogue also labels these guides.</p>
      <p><strong>Preparation or review required:</strong> a prerequisite, a specialised design, or a documented software limitation prevents this guide from selecting an analysis yet. Related analyses are offered as references. These outcomes are deliberately explicit.</p>
      <p>For an observed attribute-sampling decision, the agreed count rule is applied directly; the JASP plan analysis evaluates its operating characteristics. The guide keeps those tasks distinct.</p>
    </section>
    <section class="about-section"><h2>Evidence and version scope</h2><p><strong>Content baseline: 29 October 2026. Guide clarifications: 4 November 2026.</strong> The original routes retain their released v0.96.0 source baseline. The additions were checked against official module interfaces and calculation code, released source commits, and the module catalogue at that time. The later statistical review clarified the attribute-agreement reference category, monitoring baselines, Cox controls, and variance-test convention. Each guide records its own sources.</p>
      <div class="table-scroll"><table class="mapping-table scope-table"><thead><tr><th scope="col">Module</th><th scope="col">Reviewed availability</th></tr></thead><tbody>
      <tr><td>Regression</td><td>Stable 0.96.5-release.803; correlation interface/code at released v0.96.0</td></tr>
      <tr><td>Classical Tests</td><td>Stable 0.1.1-release.803; immutable released source</td></tr>
      <tr><td>Survival</td><td>Stable 0.96.6-release.803 for core routes; official 0.98.2-beta.0 build for advanced routes</td></tr>
      <tr><td>Acceptance Sampling</td><td>Stable 0.95.5-release.803 for the five conventional analyses; 0.96.4 beta builds for Bayesian additions</td></tr>
      </tbody></table></div>
      <p>Modules can update independently of the desktop, and the catalogue may lag a newly published build. Check the actual installed menu and help. The guide does not install or inspect JASP.</p>
      <p>The decision paths are original guidance. JASP sources establish the software options; methodological references support the choices and limitations.</p><ul style="margin-top:16px">${['classical','correlation','survival','survival_beta','acceptance','acceptance_beta','module_catalogue','qc_menu','nist_capability'].map(id=>'<li>'+sourceLink(REFERENCES[id])+'</li>').join('')}</ul>
    </section>
    </div><div>
    <section class="about-section"><div class="logo-bg"><img src="${e(logo)}" alt="JASP Services B.V."></div><h2>Made for a practical workflow</h2><p>The guide recommends a next analysis and explains how to prepare it. Calculations, diagnostic assessment, and statistical output are performed in JASP.</p><p>Recommendations depend on the answers you select. The guide does not inspect your dataset or certify that the assumptions have been met.</p><p>Examples are explicitly synthetic. They illustrate study designs and layouts; they are not evidence about any real production process.</p><a class="button secondary" href="https://www.jasp-services.com/" target="_blank" rel="noopener noreferrer">JASP Services ${icon('external')}</a></section>
    <section class="about-section"><h2>Verification and its limits</h2><p>The decision tree is checked for complete, reachable routes. Methodological test cases check key distinctions; dataset checks cover counts, exposure, pairing, and other study structures.</p><p><strong>The teaching examples have not been executed inside desktop JASP.</strong> Source verification establishes the named menus and controls; it is not an end-to-end numerical validation. Practitioner review in the intended installed modules remains part of preparing a production release.</p></section>
    <section class="about-section"><h2>Using the guide</h2><p>Follow the questions, explore practical examples, and save an analysis plan to use in JASP. You do not need to upload your data or create an account.</p><p>Share a page link to revisit a decision path. Documentation links open external websites when you choose them.</p>${DATA.delivery.mode==='online'?`<p>Videos load when you press play. You can also save a complete offline copy, including all available videos and JASP files.</p><a class="button" href="${e(DATA.delivery.offlineFile)}" download="JASP-Quality-Guide.html">${icon('download')}Save complete offline guide</a><p class="module-hint">This is a large download. Once saved, open the HTML file in your browser without an internet connection.</p>`:button('Save a copy of the guide','html','','','download')}<p class="module-hint">Downloads, copying, and printing use your browser. If clipboard access is unavailable, the guide downloads the requested text instead.</p></section>
    <section class="about-section"><h2>Prototype ${APP_VERSION}</h2><p>A simpler layout with a place to watch a walkthrough and explore an annotated JASP file alongside each analysis.</p><p>Analysis-specific videos and annotated JASP files are being prepared. Missing videos show a coming-soon image; unavailable JASP downloads show a short notification. The analysis-specific CSV data and setup instructions remain available in the Example &amp; inputs tab.</p><p>Useful feedback concerns unclear wording, missing steps, and practical examples. Save the analysis plan to identify the route and its reviewed module version.</p></section>
    </div></div></div>`;
}
function render() {
  const route=readRoute();
  const wasQuestion=activeContext&&Boolean(NODES[activeContext.current]);
  activeContext=null;lastAnalysis=null;
  let html;
  if(route.view==='home')html=renderHome();
  else if(route.view==='examples')html=renderExamples();
  else if(route.view==='analyses')html=renderCatalogue();
  else if(route.view==='about')html=renderAbout();
  else if(route.view==='analysis')html=renderResult(ANALYSES[route.id],null);
  else if(route.view==='guide'){
    const ctx=walk(route.goal,route.picks);ctx.caseId=route.caseId;activeContext=ctx;
    if(NODES[ctx.current])html=renderQuestion(ctx);
    else if(ctx.current.startsWith('r:')&&ANALYSES[ctx.current.slice(2)])html=renderResult(ANALYSES[ctx.current.slice(2)],ctx);
    else if(ctx.current.startsWith('g:')&&GUARDS[ctx.current.slice(2)])html=renderGuard(ctx);
  }
  releaseAnalysisVideo();
  app.innerHTML=html||'<div class="container"><div class="empty-state"><h1 id="page-title" tabindex="-1">This route is not available</h1><p style="margin-top:15px">Start from a goal or browse the analyses included in this version.</p><div class="action-row">'+button('Find an analysis','home','','','arrow')+'</div></div></div>';
  app.setAttribute('aria-busy','false');
  attachAnalysisVideo();
  const current=route.view==='examples'?'examples':route.view==='about'?'about':route.view==='analyses'||route.view==='analysis'?'analyses':'guide';
  document.querySelectorAll('[data-nav]').forEach(n=>{n.classList.toggle('active',n.dataset.nav===current);if(n.dataset.nav===current)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current');});
  if(route.view==='analyses')updateCatalogue();
  const title=document.getElementById('page-title');
  const question=activeContext&&NODES[activeContext.current];
  const pageLabel=question?'Question '+(activeContext.history.length+1)+': '+question.title:(title?title.textContent:'');
  document.title=(pageLabel&&pageLabel!=='JASP Quality Guide'?pageLabel+' · ':'')+'JASP Quality Guide · JASP Services B.V.';
  if(!firstRender){
    // Keep the reader in the task. Focus announces the new question without
    // dragging the viewport back through the company header on every answer.
    if(title)title.focus({preventScroll:true});
    if(wasQuestion&&lastAnalysis&&activeContext){
      // Completing the questions opens a new analysis page from its beginning.
      window.scrollTo({top:0,behavior:'instant'});
    }else if((route.view==='guide'||route.view==='analysis')&&title){
      const rect=title.getBoundingClientRect();
      if(rect.top<24||rect.bottom>window.innerHeight-96){
        window.scrollTo({top:Math.max(0,window.scrollY+rect.top-24),behavior:'instant'});
      }
    }else window.scrollTo({top:0,behavior:'instant'});
  }
  firstRender=false;
}
function selectTab(name,focus=false) {
  document.querySelectorAll('.tab').forEach(t=>{const active=t.dataset.value===name;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;if(active&&focus)t.focus();});
  document.querySelectorAll('.tab-panel').forEach(p=>p.hidden=p.id!=='panel-'+name);
}
function csvText(id) {
  const s=SAMPLES[id];
  const cell=v=>{const text=String(v);return /[",\r\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;};
  return [s.columns,...s.rows].map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
function downloadFile(name,text,type='text/plain;charset=utf-8') {
  const blob=new Blob([text],{type});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
async function copyText(text,fallbackName) {
  try{
    if(!navigator.clipboard||!navigator.clipboard.writeText)throw new Error('Unavailable');
    await navigator.clipboard.writeText(text);toast('Copied to clipboard.');
  }catch{
    const textarea=document.createElement('textarea');textarea.value=text;textarea.setAttribute('readonly','');textarea.style.cssText='position:fixed;left:-10000px;top:0';document.body.appendChild(textarea);textarea.select();
    let copied=false;try{copied=document.execCommand('copy');}catch{}textarea.remove();
    if(copied)toast('Copied to clipboard.');else{downloadFile(fallbackName,text);toast('Clipboard unavailable. A text file was downloaded instead.');}
  }
}
function planText() {
  if(!lastAnalysis)return '';
  const {a,context}=lastAnalysis,ex=exampleInfo(a,context);
  const version=availabilityInfo(a);
  const lines=['JASP QUALITY GUIDE · JASP Services B.V.','Analysis plan · Prototype '+APP_VERSION,'Content baseline 29 October 2026; guide clarifications 4 November 2026','',a.title,'='.repeat(a.title.length),'',a.summary,'','WHEN THIS IS USEFUL',a.why,'','MODULE AVAILABILITY',availabilityLabel(a),version.module+' · '+version.sourceVersion,version.note,''];
  if(context){lines.push('DECISION PATH',GOALS[context.goal].title,...context.history.map(h=>h.short+': '+h.label),'');}
  else lines.push('Viewed from the analysis reference. A guided suitability check has not been completed.','');
  lines.push('JASP MENU',a.path.join(' > '),'','SETUP');
  a.setup.forEach((s,i)=>lines.push((i+1)+'. '+s.title,s.text,''));
  lines.push(a.columns.length?'DATA LAYOUT':'INPUT MODE',...(a.columns.length?a.columns.map(c=>c.name+' ['+c.type+']: '+c.description):['Enter settings or summary inputs directly in JASP; no dataset is required.']),'','CHECKS BEFORE INTERPRETING',...a.checks.map(c=>'• '+c),'','WHAT TO EXAMINE AND REPORT',...a.report.map(r=>'• '+r),'','SYNTHETIC EXAMPLE',ex.title,ex.story,...a.example.instructions.map(x=>'• '+x));
  if(ex.sample)lines.push('Sample: '+ex.sampleId+'.csv ('+ex.sample.rows.length+' rows)',...ex.sample.notes.map(n=>'• '+n));
  else lines.push('Settings-only example: enter the specified values directly in JASP.');
  const media=analysisMedia(a);
  lines.push('','VIDEO AND ANNOTATED JASP FILE',media.video?media.video.note:'Video walkthrough: coming soon.',media.jasp?media.jasp.filename+': '+media.jasp.note:'Annotated JASP file: coming soon.');
  lines.push('','SOURCES',...a.sources.map(s=>s.title+'\n'+s.url),'','Recommendations depend on the selected answers. This guide does not analyse a dataset or verify assumptions. Menus and options were source-checked; these teaching examples have not been executed in desktop JASP. Run the analysis and review diagnostics in your installed module.');
  const answers=context?answerMap(context.history):{};
  if(a.family==='capability'&&answers.c_specs==='one')lines.push('','USER-SPECIFIC REQUIREMENT: One-sided specification. Enter only the genuine limit; two-sided Cp does not apply. The teaching example has its own stated specifications.');
  if(a.id==='survival_parametric'&&answers.s_censor==='interval')lines.push('','USER-SPECIFIC REQUIREMENT: Use the Interval format and preserve the observed bounds. The downloadable example demonstrates right-censoring; its layout does not replace your interval boundaries.');
  if(['variance_two','variance_multiple'].includes(a.id)&&answers.h_variance_structure==='summary')lines.push('','USER-SPECIFIC REQUIREMENT: Summary data from independent normal groups. Use the summary-input and F/Bartlett settings; raw-data Levene inference cannot be reconstructed from variances and sample sizes.');
  return lines.join('\n');
}
function saveHtml() {
  const copy=document.documentElement.cloneNode(true);
  copy.querySelector('#app').innerHTML='<div class="guide-loading container"><span class="loading-eyebrow">JASP Quality Guide</span><h1>Preparing your guide</h1><p class="guide-loading-status" role="status"><span class="loading-spinner" aria-hidden="true"></span>Loading analyses and examples…</p></div>';
  copy.querySelector('#app').setAttribute('aria-busy','true');
  copy.querySelector('#toast').textContent='';copy.querySelector('#toast').className='toast';
  copy.querySelector('title').textContent='JASP Quality Guide · JASP Services B.V.';
  downloadFile('JASP-Quality-Guide.html','<!DOCTYPE html>\n'+copy.outerHTML,'text/html;charset=utf-8');
  toast('HTML download requested. Open the saved file in your browser.');
}
document.addEventListener('click',async event=>{
  if(event.target.closest('.skip-link')){event.preventDefault();document.getElementById('main-content').focus();return;}
  const b=event.target.closest('[data-action]');if(!b)return;
  const action=b.dataset.action,value=b.dataset.value;
  if(action==='video-play')startAnalysisVideo(value==='retry');
  else if(action==='start'&&GOALS[value])navigate('#/guide/'+value);
  else if(action==='home')navigate('#/');
  else if(action==='answer'&&activeContext){
    const q=NODES[activeContext.current];if(!q||!q.options.some(o=>o.value===value))return;
    navigate(flowUrl(activeContext,[...activeContext.history.map(h=>h.value),value]));
  }
  else if(action==='back'){
    if(activeContext&&activeContext.history.length)navigate(flowUrl(activeContext,activeContext.history.slice(0,-1).map(h=>h.value)));else navigate('#/');
  }
  else if(action==='edit'&&activeContext){const index=Number(value);if(Number.isInteger(index)&&index>=0)navigate(flowUrl(activeContext,activeContext.history.slice(0,index).map(h=>h.value)));}
  else if(action==='analysis'&&ANALYSES[value])navigate('#/analysis/'+value);
  else if(action==='case'&&SCENARIOS[value])navigate(caseUrl(value));
  else if(action==='tab')selectTab(value);
  else if(action==='jasp-unavailable'&&ANALYSES[value])toast('The annotated JASP file for this analysis is coming soon.');
  else if(action==='csv'&&SAMPLES[value]){downloadFile('JASP-example-'+value+'.csv','\ufeff'+csvText(value),'text/csv;charset=utf-8');toast('Example CSV download requested. Check your browser’s downloads.');}
  else if(action==='copy-csv'&&SAMPLES[value])await copyText(csvText(value),'JASP-example-'+value+'.csv');
  else if(action==='print')window.print();
  else if(action==='plan'&&lastAnalysis){downloadFile('JASP-analysis-plan-'+lastAnalysis.a.id+'.txt',planText());toast('Analysis-plan download requested.');}
  else if(action==='copy-plan'&&lastAnalysis)await copyText(planText(),'JASP-analysis-plan-'+lastAnalysis.a.id+'.txt');
  else if(action==='html')saveHtml();
  else if(action==='filter'){catalogFamily=value;updateCatalogue();}
  else if(action==='clear-search'){catalogFamily='all';catalogQuery='';document.getElementById('analysis-search').value='';updateCatalogue();}
});
document.addEventListener('input',event=>{if(event.target.id==='analysis-search'){catalogQuery=event.target.value;updateCatalogue();}});
document.addEventListener('keydown',event=>{
  if(event.target.getAttribute('role')!=='tab')return;
  const tabs=[...document.querySelectorAll('.tab')],i=tabs.indexOf(event.target);
  let next;
  if(event.key==='ArrowRight')next=(i+1)%tabs.length;
  else if(event.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;
  else if(event.key==='Home')next=0;
  else if(event.key==='End')next=tabs.length-1;
  else return;
  event.preventDefault();selectTab(tabs[next].dataset.value,true);
});
window.addEventListener('hashchange',render);
window.addEventListener('beforeprint',()=>{document.querySelectorAll('.sources,.analysis-context,.availability-note').forEach(d=>{d.dataset.wasOpen=d.open?'1':'0';d.open=true;});});
window.addEventListener('afterprint',()=>{document.querySelectorAll('.sources,.analysis-context,.availability-note').forEach(d=>{d.open=d.dataset.wasOpen==='1';});});
render();
