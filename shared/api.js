/**
 * 灏天文库剪藏助手
 * popup 通过 <script> 引入；background 通过 importScripts 引入
 */
const AiKnowledgeApi = (() => {
  const DEFAULT_SERVER_URL = 'https://zzht.tech';

  function normalizeServerUrl(url) {
    return (url || DEFAULT_SERVER_URL).trim().replace(/\/+$/, '');
  }

  function authHeaders(token, json = false) {
    const headers = {};
    if (json) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  /** 兼容旧 standalone server 与主 server 的文集列表响应 */
  function parseCollections(payload) {
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.collections)) return payload.collections;
    return [];
  }

  function formatApiError(payload, status) {
    if (status === 401) return 'Token 无效或已过期，请检查设置';
    if (status === 403) {
      if (payload?.details?.length) {
        const fields = payload.details.map((d) => d.field).filter(Boolean).join('、');
        return fields
          ? `${payload.error || '内容被拒绝'}（字段: ${fields}）`
          : payload.error || '无权限或内容被拒绝（用量上限/敏感词）';
      }
      return payload?.error || '无权限或内容被拒绝（用量上限/敏感词）';
    }
    if (status === 503) return payload?.error || '服务暂时不可用，请稍后重试';
    return payload?.error || payload?.detail || `服务器错误 (${status})`;
  }

  async function loadSettings() {
    const data = await chrome.storage.local.get(['serverUrl', 'token', 'apiKey', 'lastCollectionId']);
    let token = (data.token || data.apiKey || '').trim();
    const serverUrl = normalizeServerUrl(data.serverUrl);

    // 从旧版 apiKey 配置迁移到 token
    if (data.apiKey && !data.token) {
      await chrome.storage.local.set({ token });
      await chrome.storage.local.remove('apiKey');
    }

    return {
      serverUrl,
      token,
      lastCollectionId: data.lastCollectionId || null,
    };
  }

  async function saveSettings(serverUrl, token) {
    await chrome.storage.local.set({
      serverUrl: normalizeServerUrl(serverUrl),
      token: token.trim(),
    });
    await chrome.storage.local.remove('apiKey');
  }

  async function testConnection(serverUrl, token) {
    const base = normalizeServerUrl(serverUrl);
    const healthRes = await fetch(`${base}/api/health`);
    if (!healthRes.ok) {
      return { ok: false, message: `健康检查失败 (${healthRes.status})` };
    }
    const health = await healthRes.json().catch(() => ({}));

    if (!token) {
      return {
        ok: true,
        message: `服务可达 (${health.status || 'ok'})，请填写 Token 后保存以使用收藏功能`,
      };
    }

    const coll = await fetchCollections(base, token);
    if (coll.status === 401) {
      return { ok: false, message: 'Token 无效或已过期' };
    }
    if (!coll.ok) {
      return { ok: false, message: formatApiError(coll.data, coll.status) };
    }
    return {
      ok: true,
      message: `连接成功，共 ${coll.collections.length} 个个人花园文集`,
    };
  }

  async function fetchCollections(serverUrl, token) {
    const res = await fetch(`${normalizeServerUrl(serverUrl)}/api/collections`, {
      headers: authHeaders(token),
    });
    const data = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      status: res.status,
      data,
      collections: parseCollections(data),
    };
  }

  async function createDocument(serverUrl, token, { collectionId, name, content }) {
    const res = await fetch(`${normalizeServerUrl(serverUrl)}/api/documents`, {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify({
        collection_id: parseInt(collectionId, 10),
        name,
        content: content || '',
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  /** 生成剪藏内容指纹，用于防重复保存 */
  function computeClipFingerprint({ collectionId, name, content, url = '' }) {
    const raw = `${collectionId}\x00${name}\x00${content}\x00${url}`;
    let h = 5381;
    for (let i = 0; i < raw.length; i += 1) {
      h = (h * 33) ^ raw.charCodeAt(i);
    }
    return (h >>> 0).toString(36);
  }

  async function getLastSavedClip() {
    const { lastSavedClip } = await chrome.storage.local.get('lastSavedClip');
    return lastSavedClip || null;
  }

  async function rememberSavedClip(record) {
    await chrome.storage.local.set({
      lastSavedClip: {
        ...record,
        savedAt: Date.now(),
      },
    });
  }

  async function findDuplicateClip({ collectionId, name, content, url = '' }) {
    const fingerprint = computeClipFingerprint({ collectionId, name, content, url });
    const last = await getLastSavedClip();
    if (last?.fingerprint === fingerprint) {
      return { duplicate: true, record: last };
    }
    return { duplicate: false, fingerprint };
  }

  return {
    DEFAULT_SERVER_URL,
    normalizeServerUrl,
    parseCollections,
    formatApiError,
    loadSettings,
    saveSettings,
    testConnection,
    fetchCollections,
    createDocument,
    computeClipFingerprint,
    getLastSavedClip,
    rememberSavedClip,
    findDuplicateClip,
  };
})();

if (typeof globalThis !== 'undefined') {
  globalThis.AiKnowledgeApi = AiKnowledgeApi;
}
