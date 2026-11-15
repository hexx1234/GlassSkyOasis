(() => {
  'use strict';
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const esc=value=>String(value??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
  const inputValue=value=>esc(String(value??''));
  const ID=()=>`item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
  const mediaUrl = value => /^uploads\/[A-Za-z0-9._-]+$/.test(String(value||''))?'/api/media/'+encodeURIComponent(value.split('/')[1]):(/^https?:\/\//.test(String(value||''))?value:'');
  let data=null, sha=null, activeTab='site', selected={characters:null,artworks:null,news:null}, busy=false, dirty=false;
  const titles={site:'메인 홈페이지',world:'세계관 설정',characters:'캐릭터 관리',artworks:'일러스트·커미션',news:'뉴스·보도자료',typography:'폰트 설정'};
  async function api(path,method='GET',body){
    const opts={method,headers:body?{'content-type':'application/json'}:{},credentials:'same-origin'};
    if(body)opts.body=JSON.stringify(body);
    let res;
    try{res=await fetch(path,opts);}catch{throw new Error('서버에 연결할 수 없습니다.');}
    const payload=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(payload.error||`HTTP ${res.status}`);
    return payload;
  }
  function status(text,isError=false){const t=$('#studio-status');if(t){t.textContent=text;t.classList.toggle('error',isError);}}
  function field(label,key,value,opts={}){
    const attr=`data-field="${esc(key)}"`;
    const content=opts.type==='textarea'?`<textarea ${attr} rows="${opts.rows||4}" placeholder="${esc(opts.placeholder||'')}">${esc(value||'')}</textarea>`:
      opts.type==='select'?`<select ${attr}>${(opts.options||[]).map(o=>`<option value="${esc(o.value)}" ${o.value==value?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`:
      `<input ${attr} type="${opts.type||'text'}" value="${inputValue(value)}" placeholder="${esc(opts.placeholder||'')}">`;
    return `<div class="field ${opts.full?'full':''}"><label>${esc(label)}</label>${content}${opts.description?`<div class="field-desc">${esc(opts.description)}</div>`:''}</div>`;
  }
  function heading(title,description){return `<h2>${esc(title)}</h2><p class="hint">${esc(description)}</p>`;}
  function settingsForm(fields){return `<div class="form-grid">${fields.map(f=>field(f[0],f[1],data.settings[f[1]],f[2]||{})).join('')}</div>`;}
  function renderSite(){return `<section class="form-panel">${heading('사이트 로고','공개 홈페이지 왼쪽 위의 로고를 변경합니다. 이미지를 업로드한 다음 반드시 변경사항 저장 버튼을 눌러주세요.')}
    <div class="form-grid">
    ${field('로고 이미지 경로 또는 URL','logoImage',data.settings.logoImage,{full:true,description:'투명 배경 PNG 또는 WEBP 권장. SVG는 파일 업로드 대상이 아닙니다.'})}
    ${field('로고 표시 방식','logoMode',data.settings.logoMode||'symbol',{type:'select',full:true,options:[{value:'symbol',label:'심볼 이미지 + GLASS SKY OASIS 문구'},{value:'full',label:'전체 로고 이미지 (기존 문구 숨기기)'}]})}
    <div class="field full"><label>현재 로고 미리보기</label><div class="logo-preview">${data.settings.logoImage?`<img src="${esc(mediaUrl(data.settings.logoImage))}" alt="로고 미리보기">`:'기본 사이트 로고 사용 중'}</div></div>
    ${uploadWidget('logoImage')}
    <div class="field full"><button type="button" class="admin-button ghost" data-action="reset-logo">기본 로고로 되돌리기</button></div>
    </div></section><section class="form-panel">${heading('메인 히어로','사이트 첫 화면의 제목, 소개 문구와 도시 대표 이미지를 변경합니다.')}${settingsForm([
    ['상단 라벨','heroEyebrow'],['메인 제목','heroTitle'],['소개 문구','heroDescription',{type:'textarea',full:true}],['메인 이미지 주소','heroImage',{full:true,description:'이미지 파일 업로드는 아래에서 할 수 있습니다. 외부 이미지 URL도 사용 가능합니다.'}]
  ])}${uploadWidget('heroImage')}</section><section class="form-panel">${heading('국가·기업 소개','ABOUT GSO는 독립 페이지가 아니라 홈 안의 소개 섹션입니다.')}${settingsForm([
    ['섹션 라벨','introEyebrow'],['섹션 제목','introTitle'],['소개 본문','introText',{type:'textarea',full:true}],['소개 이미지 URL (선택)','introImage',{full:true}]
  ])}${settingsImagePreview('introImage')}${uploadWidget('introImage')}</section><section class="form-panel">${heading('버블존 소개','홈의 버블존 배너에 나타나는 문구와 이미지를 편집합니다.')}${settingsForm([['소개 문구','zoneText',{type:'textarea',full:true}],['방송·경기 대표 이미지 URL','zoneImage',{full:true}]])}${uploadWidget('zoneImage')}</section>`;}

  const fallbackFont='Inter, "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';
  const safeFontName=name=>String(name||'').trim().replace(/[^\p{L}\p{N} _.-]/gu,'').slice(0,90);
  const fontFileUrl=value=>{try{const u=new URL(String(value||'').trim());return u.protocol==='https:' && /\.(woff2?|ttf|otf)(?:$|[?#])/i.test(u.pathname+u.search)?u.href:'';}catch{return '';}};
  const fontFamilyCss=name=>safeFontName(name)?JSON.stringify(safeFontName(name))+', '+fallbackFont:fallbackFont;
  async function loadStudioFont(which){
    const isHeading=which==='heading';
    const family=safeFontName(data.settings[isHeading?'fontHeadingFamily':'fontBodyFamily']);
    const src=fontFileUrl(data.settings[isHeading?'fontHeadingUrl':'fontBodyUrl']);
    const sample=$(`[data-font-sample="${which}"]`);
    if(!sample)return;
    const note=$(`[data-font-message="${which}"]`);
    sample.style.fontFamily=fallbackFont;
    if(!family||!src){note.textContent='폰트 이름과 HTTPS 웹폰트 파일 URL을 모두 입력하면 미리보기가 나옵니다.';return;}
    try{
      const font=new FontFace(family,`url(${JSON.stringify(src)})`,{style:'normal',weight:'100 900'});
      await font.load();document.fonts.add(font);
      if(!sample.isConnected)return;
      sample.style.fontFamily=fontFamilyCss(family);note.textContent='미리보기 적용됨. 저장 버튼을 누르면 공개 사이트에도 반영됩니다.';
    }catch(e){note.textContent='폰트를 불러오지 못했습니다. URL이 .woff2/.woff 파일을 가리키는지, 외부 접근이 허용되는지 확인하세요.';}
  }
  function parseNoonnuSnippet(which,source){
    const familyMatch=source.match(/font-family\s*:\s*(['"])(.*?)\1/i)||source.match(/font-family\s*:\s*([^;\r\n]+)/i);
    const urlMatch=source.match(/url\s*\(\s*(['"]?)(https:\/\/[^)'"\s]+\.(?:woff2?|ttf|otf)(?:\?[^)'"\s]*)?)\1\s*\)/i);
    if(!familyMatch||!urlMatch)return false;
    const family=safeFontName(familyMatch[2]||familyMatch[1]);
    const url=fontFileUrl(urlMatch[2]);
    if(!family||!url)return false;
    const prefix=which==='heading'?'fontHeading':'fontBody';
    data.settings[prefix+'Family']=family;data.settings[prefix+'Url']=url;
    const familyInput=$(`[data-field="${prefix}Family"]`),urlInput=$(`[data-field="${prefix}Url"]`);
    if(familyInput)familyInput.value=family;if(urlInput)urlInput.value=url;
    dirty=true;status('폰트 코드에서 이름과 파일 주소를 가져왔습니다. 변경사항 저장을 눌러주세요.');
    loadStudioFont(which);return true;
  }
  function fontCard(which){
    const isHeading=which==='heading',prefix=isHeading?'fontHeading':'fontBody';
    const name=isHeading?'제목 폰트':'본문 폰트';
    return `<section class="form-panel">${heading(name,isHeading?'큰 제목, 섹션 제목, 헤더의 브랜드 문구에 적용됩니다.':'본문 설명, 메뉴, 버튼, 캐릭터 소개 등에 적용됩니다.')}
      <div class="form-grid">
        ${field('눈누 CSS의 font-family 이름',prefix+'Family',data.settings[prefix+'Family']||'',{placeholder:'예: Paperlogy',full:true})}
        ${field('폰트 파일 주소 (https://...woff2)',prefix+'Url',data.settings[prefix+'Url']||'',{placeholder:'https://.../font.woff2',full:true,description:'눈누 @font-face 안의 src: url(...)에서 웹폰트 파일 주소를 사용하세요. HTTPS 주소만 지원합니다.'})}
        <div class="field full"><label>눈누의 @font-face 코드 붙여넣기 (선택)</label>
          <textarea class="font-code-paste" data-font-paste="${which}" rows="5" placeholder="눈누에서 제공하는 @font-face { ... } 코드를 그대로 붙여넣으세요."></textarea>
          <button class="admin-button ghost" type="button" data-font-import="${which}" style="margin-top:10px">코드에서 폰트 정보 가져오기</button>
          <div class="field-desc">코드를 저장하지 않고, 폰트 이름과 파일 주소만 추출합니다.</div></div>
        <div class="field full"><label>실시간 미리보기</label><div class="font-live-preview" data-font-sample="${which}">${isHeading?'지속 가능한 낙원을 향한 우리의 약속':'버블 에너지와 함께 새로운 내일을 만들어갑니다. GLASS SKY OASIS 123'}</div><div class="field-desc" data-font-message="${which}"></div></div>
        <div class="field full"><button type="button" class="admin-button ghost" data-font-reset="${which}">이 폰트만 기본값으로 되돌리기</button></div>
      </div></section>`;
  }
  function renderTypography(){return `<div class="notice">눈누에서 원하는 폰트의 웹폰트 CSS(@font-face)를 복사하면, 아래 붙여넣기 칸에서 자동으로 이름과 URL을 추출할 수 있습니다. 변경사항 저장 후 공개 사이트 전체에 적용됩니다. 눈누의 웹폰트 이용 허용 여부를 먼저 확인하세요.</div>${fontCard('body')}${fontCard('heading')}`;}

  function renderWorld(){return `<section class="form-panel">${heading('OUR WORLD','세계관 개요, 시스템 탄생 배경, 사회 구조를 편집합니다.')}${settingsForm([
    ['글래스 스카이 오아시스 개요','worldOverview',{type:'textarea',full:true,rows:5}],['연혁 및 버블 랭킹 시스템 탄생 배경','worldBackground',{type:'textarea',full:true,rows:6}],['클래스와 시민 권리','worldSociety',{type:'textarea',full:true,rows:5}],['버블 에너지 사업 소개','energyText',{type:'textarea',full:true}],['시민 서비스 소개','citizenText',{type:'textarea',full:true}]
  ])}</section><section class="form-panel">${heading('종족 데이터베이스','종족 이름과 특징을 수정할 수 있습니다.')}${data.species.map((s,i)=>`<div class="species-edit" data-index="${i}" style="border-top:1px solid #d9e4e9;padding-top:25px;margin-top:25px"><strong>${esc(s.name)}</strong><div class="form-grid" style="margin-top:18px">${field('한글 이름','name',s.name)}${field('영문 이름','en',s.en)}${field('종족 설명','description',s.description,{type:'textarea',full:true,rows:4})}</div></div>`).join('')}</section>`;}
  function newRecord(type){
    if(type==='characters')return {id:ID(),name:'새 캐릭터',en:'NEW PLAYER',registration:'',species:'',age:'',role:'',attribute:'',weapon:'',image:'',description:'',story:'',skills:[],relations:''};
    if(type==='artworks')return {id:ID(),title:'새 작품',artist:'',artistUrl:'',characterId:'',kind:'commission',image:'',description:''};
    return {id:ID(),title:'새 보도자료',category:'NEWS',date:new Date().toISOString().slice(0,10),image:'',summary:''};
  }
  function recordLabel(type,obj){return type==='characters'?(obj.name||obj.en):type==='artworks'?obj.title:obj.title;}
  function records(type){
    if(!data[type].length)return `<div class="notice">등록된 항목이 없습니다. 아래 버튼으로 첫 항목을 추가하세요.</div><button class="admin-button" data-action="add" data-type="${type}">＋ 새 항목 추가</button>`;
    const cur=data[type].find(x=>x.id===selected[type])||data[type][0];selected[type]=cur.id;
    return `<div class="records-layout"><div class="record-list"><button class="admin-button" data-action="add" data-type="${type}">＋ 새 항목 추가</button>${data[type].map(x=>`<button class="${x.id===cur.id?'active':''}" data-record="${esc(x.id)}" data-type="${type}"><span>${esc(recordLabel(type,x))}</span> <span>›</span></button>`).join('')}</div><div class="form-panel">${recordForm(type,cur)}</div></div>`;
  }
  function settingsImagePreview(fieldName){
    return `<div class="field full"><label>이미지 미리보기</label><div class="image-preview" data-preview-field="${esc(fieldName)}">${preview(data.settings[fieldName])}</div><div class="field-desc">주소를 입력하면 미리보기가 자동 갱신됩니다. 변경사항 저장을 눌러 공개 사이트에 적용하세요.</div></div>`;
  }
  function updateImagePreview(fieldName, value){
    const box=$(`[data-preview-field="${fieldName}"]`);
    if(!box)return;
    box.replaceChildren();
    const url=mediaUrl(value);
    if(!url){box.textContent='이미지 등록 전';return;}
    const img=document.createElement('img');img.alt='이미지 미리보기';img.loading='lazy';img.src=url;
    img.onerror=()=>{box.textContent='이미지를 열 수 없습니다. 주소와 배포 상태를 확인하세요.';};
    box.append(img);
  }
  function uploadWidget(fieldName){return `<div class="field full"><label>이미지 파일 업로드 (GitHub 저장)</label><input class="image-upload" type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-upload-field="${esc(fieldName)}"><div class="upload-note">JPG · PNG · WEBP · GIF / 파일당 8MB 이하. 업로드하면 GitHub에 이미지 파일이 바로 저장됩니다.</div></div>`;}
  // Character images only: pan-and-zoom crop before the existing GitHub upload API.
  function characterUploadWidget(){
    return `<div class="field full"><label>캐릭터 이미지 업로드 · 원하는 부분 자르기</label><input class="character-crop-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><div class="crop-upload-status" role="status" aria-live="polite">파일을 선택하면 자르기 편집창이 열립니다.</div><div class="upload-note">이미지를 고르면 자르기 창이 열립니다. 드래그로 위치를 조절하고 확대·축소한 다음 '자르고 업로드'를 누르세요. 8MB 이하 · JPG/PNG/WEBP/GIF(애니메이션은 정지 이미지로 저장).</div></div>`;
  }
  async function uploadImageFile(file, fieldName, target, onFinish){
    if(file.size>8*1024*1024)throw new Error('8MB 이하의 이미지를 선택해 주세요.');
    const content=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result).split(',')[1]);
      reader.onerror=()=>reject(new Error('이미지를 읽지 못했습니다.'));
      reader.readAsDataURL(file);
    });
    const response=await api('/api/upload','POST',{name:file.name,mimeType:file.type,base64:content});
    target[fieldName]=response.path;
    dirty=true;
    if(onFinish)onFinish();
  }
  async function openCharacterCrop(file, recordId){
    if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type))throw new Error('JPG, PNG, WEBP, GIF 이미지만 사용할 수 있습니다.');
    if(file.size>8*1024*1024)throw new Error('8MB 이하 이미지만 사용할 수 있습니다.');
    const objectUrl=URL.createObjectURL(file);
    let modal=null, source=null;
    try{
      source=new Image();
      // Use load/error events as well as decode so browsers without Image.decode() work.
      await new Promise((resolve,reject)=>{
        source.onload=()=>resolve();
        source.onerror=()=>reject(new Error('선택한 이미지를 브라우저에서 열지 못했습니다. PNG 또는 JPG로 변환해 다시 선택해 주세요.'));
        source.src=objectUrl;
        if(source.complete && source.naturalWidth)resolve();
      });
      if(!source.naturalWidth||!source.naturalHeight)throw new Error('이미지 크기를 읽을 수 없습니다.');
      const template=`<div class="crop-dialog" role="dialog" aria-modal="true" aria-label="캐릭터 이미지 자르기"><div class="crop-header"><div><h2>캐릭터 이미지 자르기</h2><p>이미지를 드래그해 원하는 부분을 가운데에 놓으세요.</p></div><button class="crop-close" type="button" aria-label="닫기">✕</button></div><div class="crop-layout"><div class="crop-canvas-box"><canvas class="crop-canvas" width="600" height="800" aria-label="이미지 자르기 미리보기"></canvas></div><div class="crop-controls"><label for="crop-aspect">자르기 비율</label><select id="crop-aspect"><option value="3:4">3:4 · 캐릭터 세로형</option><option value="1:1">1:1 · 정사각형</option><option value="free">원본 비율 유지</option></select><label for="crop-zoom">확대 / 축소 <output class="crop-zoom-number">100%</output></label><input id="crop-zoom" type="range" min="1" max="3" step="0.01" value="1"><p class="crop-help">드래그: 위치 변경<br>슬라이더: 확대 / 축소<br>원본 파일은 그대로 보존되며, 잘라낸 이미지만 업로드됩니다.</p><div class="crop-actions"><button class="admin-button ghost crop-cancel" type="button">취소</button><button class="admin-button crop-confirm" type="button">자르고 업로드</button></div><p class="crop-feedback" role="status" aria-live="polite"></p></div></div></div>`;
      modal=document.createElement('div');modal.className='crop-backdrop';modal.innerHTML=template;document.body.appendChild(modal);
      const canvas=modal.querySelector('canvas');const context=canvas.getContext('2d');
      if(!context)throw new Error('브라우저에서 이미지 편집을 지원하지 않습니다.');
      const ratioSelect=modal.querySelector('#crop-aspect'), zoomInput=modal.querySelector('#crop-zoom');
      const zoomNumber=modal.querySelector('.crop-zoom-number');const feedback=modal.querySelector('.crop-feedback');
      let zoom=1,offsetX=0,offsetY=0,drag=null,locked=false;
      const render=()=>{
        const W=canvas.width,H=canvas.height;
        const minScale=Math.max(W/source.naturalWidth,H/source.naturalHeight);
        const scale=minScale*zoom;
        const drawW=source.naturalWidth*scale,drawH=source.naturalHeight*scale;
        const limitX=Math.max(0,(drawW-W)/2),limitY=Math.max(0,(drawH-H)/2);
        offsetX=Math.max(-limitX,Math.min(limitX,offsetX));
        offsetY=Math.max(-limitY,Math.min(limitY,offsetY));
        context.clearRect(0,0,W,H);
        context.drawImage(source,(W-drawW)/2+offsetX,(H-drawH)/2+offsetY,drawW,drawH);
      };
      function changeRatio(){
        const choice=ratioSelect.value;
        if(choice==='1:1'){canvas.width=720;canvas.height=720;}
        else if(choice==='free'){
          const naturalRatio=source.naturalWidth/source.naturalHeight;
          if(naturalRatio>=1){canvas.width=720;canvas.height=Math.max(200,Math.round(720/naturalRatio));}
          else{canvas.height=960;canvas.width=Math.max(200,Math.round(960*naturalRatio));}
        }else{canvas.width=720;canvas.height=960;}
        offsetX=0;offsetY=0;zoom=1;zoomInput.value='1';zoomNumber.textContent='100%';render();
      }
      changeRatio();
      ratioSelect.addEventListener('change',changeRatio);
      zoomInput.addEventListener('input',()=>{zoom=Number(zoomInput.value);zoomNumber.textContent=`${Math.round(zoom*100)}%`;render();});
      canvas.addEventListener('pointerdown',e=>{if(locked)return;drag={x:e.clientX,y:e.clientY,offsetX,offsetY};canvas.setPointerCapture(e.pointerId);});
      canvas.addEventListener('pointermove',e=>{
        if(!drag||locked)return;
        const rect=canvas.getBoundingClientRect();
        offsetX=drag.offsetX+(e.clientX-drag.x)*(canvas.width/rect.width);
        offsetY=drag.offsetY+(e.clientY-drag.y)*(canvas.height/rect.height);
        render();
      });
      canvas.addEventListener('pointerup',()=>{drag=null;});canvas.addEventListener('pointercancel',()=>{drag=null;});
      const close=()=>{if(locked)return;modal.remove();modal=null;};
      modal.querySelector('.crop-close').addEventListener('click',close);
      modal.querySelector('.crop-cancel').addEventListener('click',close);
      modal.addEventListener('click',e=>{if(e.target===modal)close();});
      const onKey=e=>{if(e.key==='Escape'&&modal&&!locked){close();document.removeEventListener('keydown',onKey);}};
      document.addEventListener('keydown',onKey);
      const upload=async()=>{
        if(locked)return;
        const target=data.characters.find(c=>c.id===recordId);
        if(!target){feedback.textContent='캐릭터를 찾을 수 없습니다. 다시 열어 주세요.';return;}
        locked=true;const button=modal.querySelector('.crop-confirm');button.disabled=true;
        feedback.textContent='잘라낸 이미지를 업로드하고 있습니다…';
        try{
          const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('이미지 생성에 실패했습니다.')),'image/webp',0.9));
          const imageFile=new File([blob],`character-${Date.now()}.webp`,{type:'image/webp'});
          await uploadImageFile(imageFile,'image',target);
          modal.remove();modal=null;document.removeEventListener('keydown',onKey);
          renderStudio();status('캐릭터 이미지 자르기 및 업로드 완료! 변경사항 저장을 눌러 연결해 주세요.');
        }catch(e){feedback.textContent=e.message||'업로드에 실패했습니다.';button.disabled=false;locked=false;}
      };
      modal.querySelector('.crop-confirm').addEventListener('click',upload);
      return new Promise(resolve=>{
        const watcher=new MutationObserver(()=>{
          if(!modal||!modal.isConnected){watcher.disconnect();document.removeEventListener('keydown',onKey);resolve();}
        });
        watcher.observe(document.body,{childList:true});
      });
    }finally{URL.revokeObjectURL(objectUrl);if(modal?.isConnected)modal.remove();}
  }
  function recordForm(type,r){
    const footer=`<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:26px"><button class="admin-button danger" data-action="delete" data-type="${type}">이 항목 삭제</button></div>`;
    if(type==='characters')return `${heading('캐릭터 정보','소개와 스킬을 편집하고 이미지를 업로드하세요. 저장 버튼을 눌러야 텍스트가 공개됩니다.')}<div class="form-grid">
    ${field('한글 이름','name',r.name)}${field('영문 이름','en',r.en)}${field('등록 번호','registration',r.registration)}${field('종족','species',r.species)}${field('나이','age',r.age)}${field('전투 포지션','role',r.role)}${field('속성','attribute',r.attribute)}${field('무기','weapon',r.weapon)}${field('캐릭터 이미지 URL','image',r.image,{full:true})}
    <div class="field full"><div class="image-preview">${preview(r.image)}</div></div>${characterUploadWidget()}${field('성격과 특징','description',r.description,{type:'textarea',full:true,rows:5})}${field('과거·서사·외형','story',r.story,{type:'textarea',full:true,rows:5})}${field('스킬 (한 줄에 하나씩)','skills',(r.skills||[]).join('\n'),{type:'textarea',full:true,rows:5})}${field('관계','relations',r.relations,{type:'textarea',full:true,rows:4})}</div>${footer}`;
    if(type==='artworks')return `${heading('작품 상세 정보','커미션 작가의 공개 허가와 크레딧 조건을 확인해 주세요.')}<div class="form-grid">${field('작품 제목','title',r.title,{full:true})}${field('작품 종류','kind',r.kind,{type:'select',options:[{value:'commission',label:'커미션'},{value:'original',label:'직접 그린 그림'},{value:'fanart',label:'팬아트'}]})}${field('캐릭터','characterId',r.characterId,{type:'select',options:[{value:'',label:'캐릭터 선택 안 함'},...data.characters.map(c=>({value:c.id,label:c.name}))]})}${field('작가명','artist',r.artist)}${field('작가 링크 (https://)','artistUrl',r.artistUrl,{full:true})}${field('이미지 URL','image',r.image,{full:true})}<div class="field full"><div class="image-preview">${preview(r.image)}</div></div>${uploadWidget('image')}${field('작품 설명','description',r.description,{type:'textarea',full:true})}</div>${footer}`;
    return `${heading('뉴스·보도자료','공식 소식과 이미지 기록을 작성합니다.')}<div class="form-grid">${field('제목','title',r.title,{full:true})}${field('분류','category',r.category)}${field('게시일','date',r.date,{type:'date'})}${field('대표 이미지 URL','image',r.image,{full:true})}<div class="field full"><div class="image-preview">${preview(r.image)}</div></div>${uploadWidget('image')}${field('내용 요약','summary',r.summary,{type:'textarea',full:true,rows:6})}</div>${footer}`;
  }
  function preview(raw){const url=mediaUrl(raw);return url?`<img src="${esc(url)}" alt="등록된 이미지 미리보기" loading="lazy">`:'이미지 등록 전';}
  function renderStudio(){
    $('#admin-app').innerHTML=`<div class="studio"><aside class="studio-nav">${Object.entries(titles).map(([id,title])=>`<button data-tab="${id}" class="${id===activeTab?'active':''}">${esc(title)}</button>`).join('')}<div class="side-note">저장하면 GitHub의 data/site.json이 변경됩니다.<br>토큰은 서버 비밀 값으로만 관리됩니다.</div></aside><div class="studio-main"><div class="studio-toolbar"><div><div class="eyebrow">GLASS SKY OASIS / CONTENT STUDIO</div><h1>${titles[activeTab]}</h1><div class="studio-status" id="studio-status">${dirty?'저장되지 않은 변경사항이 있습니다.':'저장된 데이터를 편집할 수 있습니다.'}</div></div><div class="save-fixed"><button class="admin-button" id="save-button" ${busy?'disabled':''}>변경사항 저장 ↗</button></div></div><div class="notice">저장 후 공개 사이트에 변경사항이 반영됩니다. 이미지는 업로드하는 즉시 별도 GitHub 커밋으로 저장됩니다.</div>${activeTab==='site'?renderSite():activeTab==='world'?renderWorld():activeTab==='typography'?renderTypography():records(activeTab)}<div class="studio-footer">계정 비밀번호나 GitHub 토큰을 HTML·JS 파일 또는 공개 저장소에 적지 마세요.</div></div></div>`;
    for(const input of $$('#admin-app [data-field]')){
      const block=input.closest('.species-edit');
      input.addEventListener('input',()=>{
        let target;
        if(block)target=data.species[Number(block.dataset.index)];
        else if(activeTab==='site'||activeTab==='world'||activeTab==='typography')target=data.settings;
        else target=data[activeTab].find(x=>x.id===selected[activeTab]);
        if(!target)return;
        target[input.dataset.field]=input.dataset.field==='skills'?input.value.split('\n').map(s=>s.trim()).filter(Boolean):input.value;
        if(input.dataset.field==='introImage')updateImagePreview('introImage',input.value);
        if(activeTab==='typography' && /^font(Heading|Body)/.test(input.dataset.field))loadStudioFont(input.dataset.field.startsWith('fontHeading')?'heading':'body');
        dirty=true;status('저장되지 않은 변경사항이 있습니다.');
      });
    }
    $$('[data-tab]').forEach(b=>b.addEventListener('click',()=>{activeTab=b.dataset.tab;renderStudio();}));
    $$('[data-record]').forEach(b=>b.addEventListener('click',()=>{selected[b.dataset.type]=b.dataset.record;renderStudio();}));
    $$('[data-action]').forEach(b=>b.addEventListener('click',()=>{
      if(b.dataset.action==='reset-logo'){
        data.settings.logoImage='';data.settings.logoMode='symbol';dirty=true;renderStudio();status('기본 로고로 변경했습니다. 변경사항 저장을 눌러 적용해 주세요.');return;
      }
      const type=b.dataset.type;
      if(b.dataset.action==='add'){const item=newRecord(type);data[type].push(item);selected[type]=item.id;dirty=true;renderStudio();}
      if(b.dataset.action==='delete'){
        const record=data[type].find(x=>x.id===selected[type]);
        if(!confirm(`'${recordLabel(type,record)}' 항목을 삭제할까요? (저장 시 반영)`))return;
        data[type]=data[type].filter(x=>x.id!==selected[type]);selected[type]=data[type][0]?.id||null;dirty=true;renderStudio();
      }
    }));
    $$('[data-font-import]').forEach(btn=>btn.addEventListener('click',()=>{
      const which=btn.dataset.fontImport;
      if(!parseNoonnuSnippet(which,$(`[data-font-paste="${which}"]`)?.value||''))status('코드에서 폰트 이름 또는 HTTPS 폰트 파일 주소를 찾지 못했습니다. 눈누의 @font-face 전체 코드를 붙여넣으세요.',true);
    }));
    $$('[data-font-reset]').forEach(btn=>btn.addEventListener('click',()=>{
      const prefix=btn.dataset.fontReset==='heading'?'fontHeading':'fontBody';
      data.settings[prefix+'Family']='';data.settings[prefix+'Url']='';dirty=true;renderStudio();status('기본 폰트로 변경했습니다. 변경사항 저장을 눌러 적용하세요.');
    }));
    if(activeTab==='typography'){loadStudioFont('body');loadStudioFont('heading');}
    $$('.character-crop-input').forEach(input=>input.addEventListener('change',async()=>{
      const file=input.files?.[0];if(!file)return;
      const recordId=selected.characters;
      const note=input.parentElement.querySelector('.crop-upload-status');
      input.value='';
      if(note)note.textContent=`${file.name} 읽는 중…`;
      try{await openCharacterCrop(file,recordId);}
      catch(e){
        const message=e?.message||'이미지를 열 수 없습니다.';
        if(note)note.textContent=`오류: ${message}`;
        status(message,true);
        alert('캐릭터 이미지 편집을 시작하지 못했습니다.\n'+message);
      }
    }));
    $$('.image-upload').forEach(input=>input.addEventListener('change',async()=>{
      const file=input.files?.[0];if(!file)return;
      if(file.size>8*1024*1024){alert('8MB 이하의 이미지를 선택해 주세요.');return;}
      const target=activeTab==='site'||activeTab==='world'?data.settings:data[activeTab].find(x=>x.id===selected[activeTab]);
      if(!target)return;
      input.disabled=true;status('이미지를 GitHub에 업로드하는 중입니다.');
      try{
        const content=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});
        const response=await api('/api/upload','POST',{name:file.name,mimeType:file.type,base64:content});
        target[input.dataset.uploadField]=response.path;
        dirty=true;renderStudio();status('이미지 업로드 완료. 변경사항 저장을 눌러 연결해 주세요.');
      }catch(e){status(e.message,true);input.disabled=false;}
    }));
    $('#save-button').addEventListener('click',save);
  }
  async function save(){
    if(busy)return;
    busy=true;$('#save-button').disabled=true;status('GitHub에 변경사항을 저장하는 중입니다.');
    try{
      const result=await api('/api/data','PUT',{data,sha});
      sha=result.sha;dirty=false;status('저장 완료! 공개 사이트에서 새로고침하여 확인할 수 있습니다.');
    }catch(e){status(e.message,true);}
    finally{busy=false;$('#save-button').disabled=false;}
  }
  async function loadData(){const result=await api('/api/data');data=result.data;sha=result.sha;renderStudio();}
  function loginScreen(message=''){
    $('#admin-app').innerHTML=`<section class="admin-box"><div class="eyebrow">SECURE ADMINISTRATION</div><h1>관리자 로그인</h1><p>GLASS SKY OASIS의 콘텐츠를 관리하려면 관리자 비밀번호를 입력하세요. 비밀번호는 GitHub 저장소가 아닌 Cloudflare 비밀 설정에 보관됩니다.</p><form id="login-form"><label for="password">ADMIN PASSWORD</label><input id="password" type="password" autocomplete="current-password" required><button class="admin-button admin-wide" type="submit">로그인</button></form>${message?`<div class="admin-error">${esc(message)}</div>`:''}</section>`;
    $('#login-form').addEventListener('submit',async event=>{event.preventDefault();const b=$('#login-form button');b.disabled=true;try{await api('/api/login','POST',{password:$('#password').value});$('#auth-label').textContent='관리자 로그인됨';$('#logout').hidden=false;await loadData();}catch(e){loginScreen(e.message);}finally{b.disabled=false;}});
  }
  function setupScreen(){
    $('#admin-app').innerHTML=`<section class="admin-box" style="max-width:740px"><div class="eyebrow">FIRST-TIME CONFIGURATION</div><h1>관리자 연결이 필요합니다</h1><p>사이트 기본 화면은 작동하지만, 아직 GitHub 저장소와 Cloudflare Workers 비밀 설정이 연결되지 않았습니다.</p><ol class="setup-steps"><li>새 GitHub 저장소에 사이트 파일을 업로드하고 Cloudflare Workers와 연결합니다.</li><li>Worker 변수 <code>GITHUB_OWNER</code>, <code>GITHUB_REPO</code>, <code>GITHUB_BRANCH</code>를 저장소에 맞게 설정합니다.</li><li>Worker의 <strong>Secrets</strong>에 <code>GITHUB_TOKEN</code> (Contents: Read and write), <code>ADMIN_PASSWORD</code>, <code>SESSION_SECRET</code>을 등록합니다.</li><li>사이트를 다시 열고 관리자 페이지에 로그인합니다.</li></ol><p>자세한 단계는 프로젝트의 README.md에 있습니다. 토큰을 이 페이지나 GitHub 공개 파일에 붙여넣지 마세요.</p><a class="admin-button" href="/#home">공개 사이트로 이동</a></section>`;
  }
  async function init(){
    $('#logout').addEventListener('click',async()=>{try{await api('/api/logout','POST',{});}catch{}window.location.reload();});
    try{const session=await api('/api/session');if(!session.configured)setupScreen();else if(!session.authenticated)loginScreen();else{$('#auth-label').textContent='관리자 로그인됨';$('#logout').hidden=false;await loadData();}}
    catch(e){setupScreen();}
  }
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  init();
})();
