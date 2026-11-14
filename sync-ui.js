import {registerTranslations,translatePage,getLanguage,tr} from './i18n.js';

registerTranslations({
  '云端包含当前版本暂不支持的测验，本次同步已暂停。请刷新网站，或在原设备完成测验后重试。':'The cloud contains a quiz that this version cannot open. This sync is paused. Refresh the site, or finish the quiz on the original device and try again.',
  '云同步':'Cloud sync', '仅本地':'Local only', '等待同步':'Sync pending', '正在同步':'Syncing', '已同步':'Synced',
  '同步需检查':'Check sync', '正在连接':'Connecting', '云同步暂未启用':'Cloud sync is not available yet',
  '把进度，带到下一台设备。':'Take your progress to your next device.',
  '电脑学到哪，手机就从哪继续。语言偏好只保存在当前设备。':'Pick up on your phone where you left off on your computer. Language preferences stay on this device.',
  '一个学习空间，接着学。':'One learning space. Keep going.',
  '课程、任务、实验、笔记和答题记录，可以在设备之间同步。':'Sync lessons, tasks, labs, notes, and practice records between devices.',
  '无需注册账户':'No account registration', '上传前加密':'Encrypted before upload', '页面内离线可用':'Offline while this page is open',
  '第一次使用？':'First time here?',
  '创建一个私密同步空间，将当前学习进度带到其他设备。创建后，请主动显示或复制配对码并妥善保存。':'Create a private sync space to use your current progress on other devices. After creating it, explicitly reveal or copy the pairing code and save it securely.',
  '创建我的同步空间':'Create my sync space', '已有配对码':'I have a pairing code',
  '在另一台设备输入同一个配对码，即可合并学习进度。':'Enter the same pairing code on another device to merge your progress.',
  '配对码':'Pairing code', '粘贴以 SAA1- 开头的配对码':'Paste your pairing code beginning with SAA1-',
  '连接我的学习空间':'Connect my learning space',
  '当前学习仍会保存在本机。云同步开放后，可以在这里连接；现在也可以导出备份。':'Your learning continues to be saved on this device. Connect here when cloud sync becomes available, or export a backup now.',
  '本机进度已连接':'This device is connected',
  '不同项目的离线修改会自动合并，已经交卷的测验不会重新打开。':'Offline changes to different items merge automatically. Completed quizzes will not reopen.',
  '立即同步':'Sync now', '断开此设备':'Disconnect this device', '上次成功同步':'Last successful sync',
  '尚未完成同步':'No completed sync yet',
  '本机已保存，等待连接云端。':'Saved on this device; waiting to connect to the cloud.',
  '正在检查并合并学习进度…':'Checking and merging your progress…',
  '正在连接你的学习空间…':'Connecting to your learning space…',
  '当前修改已与云端确认。':'Current changes have been confirmed with the cloud.',
  '未连接云同步，进度保存在当前浏览器。':'Cloud sync is disconnected. Progress stays in this browser.',
  '把配对码保存在安全的地方':'Keep your pairing code somewhere safe',
  '持有配对码的人可以读取和修改这个学习空间。建议保存到密码管理器，不要发到公共聊天或放进网址。':'Anyone with this code can read and change this learning space. Store it in a password manager; do not post it publicly or put it in a URL.',
  '如果所有已连接设备和配对码都丢失，云端进度无法找回。':'If you lose the code and every connected device, the cloud progress cannot be recovered.',
  '显示配对码':'Reveal pairing code', '隐藏配对码':'Hide pairing code', '复制配对码':'Copy pairing code',
  '配对码仅在你主动显示时出现。':'The code appears only when you choose to reveal it.',
  '同步如何保存你的进度':'How your progress is saved',
  '默认保存在本机；启用同步后，学习数据会在浏览器中加密，再上传到你的私密同步空间。':'Progress is saved locally by default. When sync is enabled, your browser encrypts the learning data before uploading it to your private space.',
  '页面保持打开时，离线也能继续打卡、刷题和记笔记。重新联网或回到这个页面后，待同步的修改会再次尝试上传。':'While this page remains open, keep checking off tasks, practicing, and writing notes offline. Pending changes are retried when you reconnect or return to this page.',
  '每个空间最多保存 1 MiB 的加密数据。达到上限时，本机学习仍可继续，请及时导出备份。':'Each space supports up to 1 MiB of encrypted data. If it fills up, you can keep learning locally; export a backup promptly.',
  '需要额外副本时，可以随时导出备份。':'Export a backup whenever you want an extra copy.',
  '管理备份':'Manage backups',
  '配对码格式不正确，请完整复制后重试。':'The pairing code format is invalid. Copy the complete code and try again.',
  '没有找到这个学习空间，请检查配对码。':'This learning space was not found. Check the pairing code.',
  '当前无法联网，本机修改已保留。恢复连接后会重试。':'You appear to be offline. Local changes are retained and will retry when the connection returns.',
  '同步空间已达容量上限。本机进度仍保留，请导出备份。':'The sync space has reached its capacity. Local progress is retained; export a backup.',
  '同步请求较频繁，请稍等片刻后重试。':'There have been too many sync requests. Wait briefly and try again.',
  '其他设备也在更新，请稍后再同步一次。':'Another device is also updating. Try syncing again shortly.',
  '浏览器未能保存同步设置。请导出备份，并检查浏览器存储权限。':'The browser could not save sync settings. Export a backup and check browser storage permissions.',
  '本机同步设置无法读取。学习进度仍可使用，请检查备份后重新连接。':'Local sync settings could not be read. You can continue learning; check your backup before reconnecting.',
  '暂时无法读取云端数据，请检查配对码并稍后重试。本机进度不会因此删除。':'Cloud data could not be read. Check the pairing code and retry later. This does not delete local progress.',
  '这个浏览器暂不支持安全同步，请使用最新浏览器。':'This browser does not support secure sync. Use an up-to-date browser.',
  '同步暂时不可用，本机修改已保留，请稍后重试。':'Sync is temporarily unavailable. Local changes are retained; try again later.',
  '同步空间已创建，请显示或复制配对码并妥善保存。':'Your sync space was created. Reveal or copy the pairing code and save it securely.',
  '已连接学习空间，进度会自动同步。':'Your learning space is connected. Progress will sync automatically.',
  '配对码已复制，请妥善保存。':'Pairing code copied. Keep it secure.',
  '自动复制不可用，请在显示的输入框中手动复制配对码。':'Automatic copying is unavailable. Copy the code manually from the revealed field.',
  '仅断开此设备？':'Disconnect only this device?',
  '本机进度和云端数据都会保留。断开后本机的新修改不会上传；再次连接需要配对码。':'Local progress and cloud data will remain. New edits on this device will stop uploading. You will need the pairing code to reconnect.',
  '确认断开':'Disconnect', '已断开云同步，本机进度保留。':'Cloud sync disconnected. Local progress is retained.',
  '任务、课程、实验、答题记录和笔记会保存在当前浏览器。开启云同步后，加密进度也会同步到连接的设备；清除浏览器数据前请导出备份并保存配对码。':'Tasks, courses, labs, answers, and notes are saved in this browser. With cloud sync enabled, encrypted progress also syncs to connected devices. Export a backup and save your pairing code before clearing browser data.',
  '已连接云同步：此操作也会替换云端进度，并传播到其他已连接设备。':'Cloud sync is connected: this action also replaces cloud progress and propagates to other connected devices.',
  '语言选择只影响当前设备，不会改变题目答案或学习进度。':'Language selection affects only this device. It does not change answers or learning progress.',
  '同步已收到新进度，编辑完成后会更新页面。':'New progress has arrived. The page will update when you finish editing.',
  '当前学习空间包含暂不支持的测验，已保留其余学习进度。':'This learning space contains an unsupported quiz. Other learning progress has been retained.',
});

const errorMessages={
  UNSUPPORTED_QUIZ:'云端包含当前版本暂不支持的测验，本次同步已暂停。请刷新网站，或在原设备完成测验后重试。',
  INVALID_CODE:'配对码格式不正确，请完整复制后重试。', SPACE_NOT_FOUND:'没有找到这个学习空间，请检查配对码。',
  OFFLINE:'当前无法联网，本机修改已保留。恢复连接后会重试。', SPACE_FULL:'同步空间已达容量上限。本机进度仍保留，请导出备份。',
  RATE_LIMIT:'同步请求较频繁，请稍等片刻后重试。', BUSY:'其他设备也在更新，请稍后再同步一次。',
  LOCAL_STORAGE:'浏览器未能保存同步设置。请导出备份，并检查浏览器存储权限。',
  LOCAL_SYNC_DATA:'本机同步设置无法读取。学习进度仍可使用，请检查备份后重新连接。',
  INVALID_CLOUD_DATA:'暂时无法读取云端数据，请检查配对码并稍后重试。本机进度不会因此删除。',
  UNSUPPORTED_BROWSER:'这个浏览器暂不支持安全同步，请使用最新浏览器。', NOT_CONFIGURED:'云同步暂未启用',
};
const genericError='同步暂时不可用，本机修改已保留，请稍后重试。';

export function createSyncUI({client,icon,esc,toast,confirm}) {
  let latest=client.status(),revealed=false;
  const busy=()=>['connecting','syncing'].includes(latest.phase);
  const unavailable=()=>!latest.configured||latest.error==='UNSUPPORTED_BROWSER';
  function label(){return !latest.configured?'仅本地':({disconnected:'仅本地',pending:'等待同步',syncing:'正在同步',synced:'已同步',connecting:'正在连接',error:'同步需检查'}[latest.phase]||'仅本地');}
  function detail(){
    if(unavailable())return latest.error==='UNSUPPORTED_BROWSER'?errorMessages.UNSUPPORTED_BROWSER:'当前学习仍会保存在本机。云同步开放后，可以在这里连接；现在也可以导出备份。';
    if(latest.phase==='error')return errorMessages[latest.error]||genericError;
    return {pending:'本机已保存，等待连接云端。',syncing:'正在检查并合并学习进度…',connecting:'正在连接你的学习空间…',synced:'当前修改已与云端确认。',disconnected:'未连接云同步，进度保存在当前浏览器。'}[latest.phase]||'';
  }
  function headerContents(){return `${icon('cloud',17)}<span class="sync-status-dot ${esc(latest.phase)}"></span><span class="sync-header-label">${esc(label())}</span>`;}
  function header(){return `<a class="sync-header-chip" href="#sync" data-sync-header title="云同步" aria-label="云同步">${headerContents()}</a>`;}
  function statusContents(){
    const date=latest.lastSync?new Date(latest.lastSync).toLocaleString(getLanguage()==='en'?'en-CA':'zh-CN',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}):'';
    return `<div class="sync-state-title"><span class="sync-status-dot ${esc(latest.phase)}"></span><strong>${esc(!latest.configured?'云同步暂未启用':label())}</strong></div><p>${esc(detail())}</p><div class="sync-last"><span>上次成功同步</span><time data-i18n-ignore>${date?esc(date):esc(tr('尚未完成同步'))}</time></div>`;
  }
  function renderPage(){
    latest=client.status();revealed=false;
    return `<div class="section-heading"><div><p class="eyebrow">CONTINUE ANYWHERE</p><h1>把进度，带到下一台设备。</h1><p class="subtitle">电脑学到哪，手机就从哪继续。语言偏好只保存在当前设备。</p></div></div>
      ${unavailable()?`<div class="notice warning sync-availability"><div><strong>${esc(latest.error==='UNSUPPORTED_BROWSER'?errorMessages.UNSUPPORTED_BROWSER:'云同步暂未启用')}</strong><p>${esc(detail())}</p></div></div>`:''}<div class="sync-layout"><div class="sync-main"><section class="panel sync-intro"><div class="sync-illustration" aria-hidden="true"><span>${icon('book',26)}</span><i></i><span class="sync-cloud">${icon('cloud',40)}</span><i></i><span>${icon('check',26)}</span></div><h2>一个学习空间，接着学。</h2><p>课程、任务、实验、笔记和答题记录，可以在设备之间同步。</p><div class="sync-benefits"><span>${icon('shield',16)}无需注册账户</span><span>${icon('check',16)}上传前加密</span><span>${icon('book',16)}页面内离线可用</span></div></section>
      <section class="panel sync-connection" data-sync-disconnected ${latest.connected?'hidden':''}><div class="sync-create"><span class="eyebrow">START HERE</span><h2>第一次使用？</h2><p>创建一个私密同步空间，将当前学习进度带到其他设备。创建后，请主动显示或复制配对码并妥善保存。</p><button class="btn primary" data-sync-action="create" ${unavailable()||busy()?'disabled':''}>${icon('cloud',18)}创建我的同步空间</button></div><form id="sync-connect-form" class="sync-join"><h2>已有配对码</h2><p>在另一台设备输入同一个配对码，即可合并学习进度。</p><div class="field"><label for="sync-code-input">配对码</label><input id="sync-code-input" type="password" name="syncCode" required minlength="48" maxlength="64" placeholder="粘贴以 SAA1- 开头的配对码" autocomplete="off" autocapitalize="off" spellcheck="false" ${unavailable()||busy()?'disabled':''}></div><button class="btn secondary" type="submit" ${unavailable()||busy()?'disabled':''}>连接我的学习空间${icon('arrow',17)}</button></form></section>
      <section class="panel sync-connected" data-sync-connected ${latest.connected?'':'hidden'}><div class="sync-connected-heading"><span class="round-icon green">${icon('check',24)}</span><div><h2>本机进度已连接</h2><p>不同项目的离线修改会自动合并，已经交卷的测验不会重新打开。</p></div></div><div class="sync-action-row"><button class="btn primary" data-sync-action="now" ${busy()?'disabled':''}>${icon('review',17)}立即同步</button><button class="text-link sync-disconnect" data-sync-action="disconnect">断开此设备</button></div><div class="sync-code-panel"><h3>把配对码保存在安全的地方</h3><p>持有配对码的人可以读取和修改这个学习空间。建议保存到密码管理器，不要发到公共聊天或放进网址。</p><div class="sync-code-actions"><button class="btn secondary" data-sync-action="reveal" aria-expanded="false" aria-controls="sync-code-revealed">显示配对码</button><button class="btn secondary" data-sync-action="copy">${icon('download',16)}复制配对码</button></div><div id="sync-code-revealed" class="field sync-code-revealed" hidden><label for="sync-secret">配对码</label><input id="sync-secret" readonly type="text" autocomplete="off" spellcheck="false" data-i18n-ignore></div><small data-sync-code-hint>配对码仅在你主动显示时出现。</small><p class="sync-recovery-note">如果所有已连接设备和配对码都丢失，云端进度无法找回。</p></div></section></div>
      <aside class="sync-aside"><section class="panel sync-status-panel" data-sync-status aria-live="polite" aria-atomic="true">${statusContents()}</section><section class="panel sync-explainer"><span class="round-icon blue">${icon('shield',24)}</span><h2>同步如何保存你的进度</h2><p>默认保存在本机；启用同步后，学习数据会在浏览器中加密，再上传到你的私密同步空间。</p><p>页面保持打开时，离线也能继续打卡、刷题和记笔记。重新联网或回到这个页面后，待同步的修改会再次尝试上传。</p><p>每个空间最多保存 1 MiB 的加密数据。达到上限时，本机学习仍可继续，请及时导出备份。</p><p>需要额外副本时，可以随时导出备份。</p><a class="text-link" href="#settings">管理备份${icon('arrow',16)}</a></section></aside></div>`;
  }
  function hideCode(root=document){
    revealed=false;const input=root.querySelector('#sync-secret');if(input)input.value='';
    const box=root.querySelector('#sync-code-revealed');if(box)box.hidden=true;
    const button=root.querySelector('[data-sync-action="reveal"]');if(button){button.textContent='显示配对码';button.setAttribute('aria-expanded','false');translatePage(button);}
  }
  function revealCode(root=document){
    const input=root.querySelector('#sync-secret'),box=root.querySelector('#sync-code-revealed');
    if(!input||!box||!latest.connected)return;
    input.value=client.getCode();box.hidden=false;revealed=true;
    const button=root.querySelector('[data-sync-action="reveal"]');if(button){button.textContent='隐藏配对码';button.setAttribute('aria-expanded','true');translatePage(button);}
    input.focus();input.select();
  }
  function update(next=client.status(),root=document){
    latest=next;
    for(const element of root.querySelectorAll('[data-sync-header]')){element.innerHTML=headerContents();element.dataset.phase=latest.phase;translatePage(element);}
    for(const element of root.querySelectorAll('[data-sync-status]')){element.innerHTML=statusContents();translatePage(element);}
    for(const element of root.querySelectorAll('[data-sync-disconnected]'))element.hidden=latest.connected;
    for(const element of root.querySelectorAll('[data-sync-connected]'))element.hidden=!latest.connected;
    for(const element of root.querySelectorAll('[data-sync-action="create"],#sync-connect-form input,#sync-connect-form button'))element.disabled=unavailable()||busy();
    for(const element of root.querySelectorAll('[data-sync-action="now"]'))element.disabled=busy()||!latest.connected||unavailable();
    if(!latest.connected)hideCode(root);
  }
  function fail(e){if(!['CANCELLED','CLOSED'].includes(e.message))toast(errorMessages[e.message]||genericError);}
  async function connect(code,create){
    if(unavailable()||busy())return;
    try{await client.connect(code,{create});const input=document.querySelector('#sync-code-input');if(input)input.value='';toast(create?'同步空间已创建，请显示或复制配对码并妥善保存。':'已连接学习空间，进度会自动同步。');}
    catch(e){fail(e);}
    update();
  }
  function bind(root){
    root.querySelector('#sync-connect-form')?.addEventListener('submit',event=>{event.preventDefault();void connect(root.querySelector('#sync-code-input').value,false);});
    root.querySelectorAll('[data-sync-action]').forEach(button=>button.addEventListener('click',async()=>{
      switch(button.dataset.syncAction){
        case'create':void connect('',true);break;
        case'now':await client.syncNow();update();break;
        case'reveal':if(revealed)hideCode(root);else revealCode(root);break;
        case'copy':try{await navigator.clipboard.writeText(client.getCode());toast('配对码已复制，请妥善保存。');}catch{revealCode(root);toast('自动复制不可用，请在显示的输入框中手动复制配对码。');}break;
        case'disconnect':confirm('仅断开此设备？','本机进度和云端数据都会保留。断开后本机的新修改不会上传；再次连接需要配对码。','确认断开',()=>{hideCode(root);client.disconnect();update();toast('已断开云同步，本机进度保留。');});break;
      }
    }));
    update(client.status(),root);
  }
  return {header,renderPage,update,bind,hideCode};
}
