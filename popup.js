/**
 * 灏天文库剪藏助手 - Popup 主逻辑
 * （Bearer Token + REST API）
 */

const $ = (sel) => document.querySelector(sel);
const clipTitle = $('#clip-title');
const clipUrl = $('#clip-url');
const clipCollection = $('#clip-collection');
const clipContent = $('#clip-content');
const clipStatus = $('#clip-status');
const settingsStatus = $('#settings-status');
const settingServer = $('#setting-server');
const settingToken = $('#setting-token');
const btnClip = $('#btn-clip');

const SAVE_BTN_LABEL = '保存到文集';
let isSaving = false;

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    $(`#${tab.dataset.tab}-panel`).classList.add('active');
  });
});

$('#toggle-content-btn').addEventListener('click', () => {
  const ta = clipContent;
  const btn = $('#toggle-content-btn');
  if (ta.classList.contains('expanded')) {
    ta.classList.remove('expanded');
    btn.textContent = '展开';
  } else {
    ta.classList.add('expanded');
    btn.textContent = '收起';
  }
});

async function loadSettingsForm() {
  const { serverUrl, token } = await AiKnowledgeApi.loadSettings();
  settingServer.value = serverUrl;
  settingToken.value = token;
}

async function saveSettingsForm() {
  await AiKnowledgeApi.saveSettings(settingServer.value, settingToken.value);
  showStatus(settingsStatus, 'success', '设置已保存');
  loadCollections();
}

$('#btn-save-settings').addEventListener('click', saveSettingsForm);

$('#btn-test-connection').addEventListener('click', async () => {
  showStatus(settingsStatus, 'loading', '<span class="loading-spinner"></span>正在测试连接…');
  try {
    const result = await AiKnowledgeApi.testConnection(
      settingServer.value,
      settingToken.value.trim(),
    );
    showStatus(settingsStatus, result.ok ? 'success' : 'error', result.message);
  } catch (e) {
    showStatus(settingsStatus, 'error', `无法连接服务器：${e.message}`);
  }
});

function showStatus(el, type, msg, options = {}) {
  const { autoHideMs = 5000, prominent = false } = options;
  el.className = `status-bar ${type}${prominent ? ' prominent' : ''}`;
  el.innerHTML = msg;
  el.classList.remove('hidden');
  if (el._hideTimer) clearTimeout(el._hideTimer);
  if (autoHideMs > 0 && (type === 'success' || type === 'error' || type === 'warn')) {
    el._hideTimer = setTimeout(() => el.classList.add('hidden'), autoHideMs);
  }
}

function showSaveNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
  });
}

function setSaveButtonState(state) {
  btnClip.dataset.state = state;
  if (state === 'saving') {
    btnClip.disabled = true;
    btnClip.textContent = '正在保存…';
    return;
  }
  if (state === 'saved') {
    btnClip.disabled = true;
    btnClip.textContent = '已保存';
    return;
  }
  btnClip.disabled = false;
  btnClip.textContent = SAVE_BTN_LABEL;
}

function resetSaveButtonIfSaved() {
  if (btnClip.dataset.state === 'saved') {
    setSaveButtonState('idle');
  }
}

[clipTitle, clipContent, clipCollection].forEach((el) => {
  el.addEventListener('input', resetSaveButtonIfSaved);
  el.addEventListener('change', resetSaveButtonIfSaved);
});

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatSaveSuccessMessage(collectionName, documentId) {
  const name = escapeHtml(collectionName || '文集');
  return `<strong>保存成功</strong><span class="status-detail">已写入「${name}」，文档 ID ${documentId}</span>`;
}

function formatDuplicateMessage(record) {
  const name = escapeHtml(record.collectionName || '文集');
  const id = record.documentId ? `，文档 ID ${record.documentId}` : '';
  return `该内容已保存至「${name}」${id}，修改后可再次保存`;
}

async function init() {
  await loadSettingsForm();
  await loadCurrentTab();
  await loadCollections();
}

async function loadCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      clipTitle.value = tab.title || '';
      clipUrl.value = tab.url || '';
    }
  } catch {
    clipTitle.value = '';
    clipUrl.value = '无法获取当前页面';
  }
}

async function loadCollections() {
  const { serverUrl, token } = await AiKnowledgeApi.loadSettings();
  clipCollection.innerHTML = '<option value="">-- 加载中... --</option>';

  if (!token) {
    clipCollection.innerHTML = '<option value="">请先在设置中填写 Token</option>';
    return;
  }

  try {
    const result = await AiKnowledgeApi.fetchCollections(serverUrl, token);
    if (!result.ok) {
      const hint = result.status === 401
        ? 'Token 无效，请检查设置'
        : `加载失败 (${result.status})`;
      clipCollection.innerHTML = `<option value="">${hint}</option>`;
      return;
    }

    const { collections } = result;
    if (collections.length === 0) {
      clipCollection.innerHTML = '<option value="">暂无文集（请先在灏天文库创建个人花园文集）</option>';
      return;
    }

    clipCollection.innerHTML = '<option value="">-- 请选择文集 --</option>';
    const { lastCollectionId } = await AiKnowledgeApi.loadSettings();
    collections.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      if (lastCollectionId && String(c.id) === String(lastCollectionId)) {
        opt.selected = true;
      }
      clipCollection.appendChild(opt);
    });
  } catch {
    clipCollection.innerHTML = '<option value="">无法连接服务器</option>';
  }
}

$('#btn-refresh-collections').addEventListener('click', loadCollections);

async function extractFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;

  try {
    const data = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_CONTENT' });
    if (data?.content) return data;
  } catch {
    // content script 未注入时回退到 scripting API
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractPageContent,
  });
  return results?.[0]?.result || null;
}

$('#btn-extract').addEventListener('click', async () => {
  clipContent.value = '正在提取...';
  try {
    const data = await extractFromActiveTab();
    if (data) {
      if (data.title && !clipTitle.value) clipTitle.value = data.title;
      clipContent.value = data.content || '（未提取到正文内容）';
      showStatus(clipStatus, 'success', `已提取 ${(data.content || '').length} 字`);
    } else {
      clipContent.value = '';
      showStatus(clipStatus, 'error', '提取失败');
    }
  } catch (e) {
    clipContent.value = '';
    showStatus(clipStatus, 'error', `提取失败：${e.message}`);
  }
});

$('#btn-clip').addEventListener('click', async () => {
  if (isSaving || btnClip.dataset.state === 'saved') {
    return;
  }

  const name = clipTitle.value.trim();
  const collectionId = clipCollection.value;
  const url = clipUrl.value.trim();
  let content = clipContent.value.trim();
  const collectionName = clipCollection.options[clipCollection.selectedIndex]?.textContent || '';

  if (!name) {
    showStatus(clipStatus, 'error', '标题不能为空');
    return;
  }
  if (!collectionId) {
    showStatus(clipStatus, 'error', '请选择文集');
    return;
  }

  if (!content) {
    setSaveButtonState('saving');
    try {
      const data = await extractFromActiveTab();
      if (data?.content) {
        content = data.content.trim();
        clipContent.value = content;
      }
    } catch {
      // 提取失败不阻塞
    }
    if (!content) {
      setSaveButtonState('idle');
      showStatus(clipStatus, 'error', '正文为空，请先提取或填写内容');
      return;
    }
  }

  const dupCheck = await AiKnowledgeApi.findDuplicateClip({
    collectionId,
    name,
    content,
    url,
  });
  if (dupCheck.duplicate) {
    showStatus(clipStatus, 'warn', formatDuplicateMessage(dupCheck.record), { autoHideMs: 6000 });
    setSaveButtonState('saved');
    return;
  }

  const { serverUrl, token } = await AiKnowledgeApi.loadSettings();
  if (!token) {
    setSaveButtonState('idle');
    showStatus(clipStatus, 'error', '请先在设置中填写 Token');
    return;
  }

  isSaving = true;
  setSaveButtonState('saving');
  showStatus(clipStatus, 'loading', '<span class="loading-spinner"></span>正在保存…', { autoHideMs: 0 });

  try {
    const result = await AiKnowledgeApi.createDocument(serverUrl, token, {
      collectionId,
      name,
      content,
    });

    if (result.ok && result.data?.document_id) {
      const documentId = result.data.document_id;
      await chrome.storage.local.set({ lastCollectionId: collectionId });
      await AiKnowledgeApi.rememberSavedClip({
        fingerprint: dupCheck.fingerprint,
        documentId,
        collectionId,
        collectionName,
        name,
      });

      setSaveButtonState('saved');
      showStatus(
        clipStatus,
        'success',
        formatSaveSuccessMessage(collectionName, documentId),
        { autoHideMs: 8000, prominent: true },
      );
      showSaveNotification(
        '保存成功',
        `《${name.slice(0, 24)}》已写入「${collectionName}」`,
      );
    } else {
      setSaveButtonState('idle');
      showStatus(clipStatus, 'error', AiKnowledgeApi.formatApiError(result.data, result.status));
    }
  } catch (e) {
    setSaveButtonState('idle');
    showStatus(clipStatus, 'error', `网络错误：${e.message}`);
  } finally {
    isSaving = false;
  }
});

init();
