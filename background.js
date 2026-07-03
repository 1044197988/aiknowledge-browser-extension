/**
 * 灏天文库剪藏助手 - Background Service Worker
 * 处理右键菜单、快捷键；
 */

importScripts('shared/api.js', 'shared/extract.js');

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'clip-to-aiknowledge',
    title: '收藏到灏天文库',
    contexts: ['page', 'link', 'selection'],
  });

  chrome.storage.local.get(['serverUrl', 'token', 'apiKey'], (data) => {
    if (!data.serverUrl) {
      chrome.storage.local.set({
        serverUrl: AiKnowledgeApi.DEFAULT_SERVER_URL,
        token: data.token || data.apiKey || '',
      });
    }
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || info.menuItemId !== 'clip-to-aiknowledge') return;
  await quickClip(tab, info);
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'quick-clip' && tab?.id) {
    await quickClip(tab, {});
  }
});

async function extractTabContent(tabId) {
  try {
    const data = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_CONTENT' });
    if (data?.content !== undefined) return data;
  } catch {
    // fallback
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractPageContent,
  });
  return results?.[0]?.result || { title: '', content: '', author: '' };
}

async function quickClip(tab, info) {
  const { serverUrl, token, lastCollectionId } = await AiKnowledgeApi.loadSettings();

  if (!token) {
    chrome.action.openPopup();
    return;
  }

  try {
    let pageData = await extractTabContent(tab.id);
    pageData = {
      title: pageData.title || tab.title || '',
      content: pageData.content || '',
      author: pageData.author || '',
    };

    if (info.selectionText) {
      pageData.content = info.selectionText;
    }

    const collResult = await AiKnowledgeApi.fetchCollections(serverUrl, token);
    if (!collResult.ok) {
      showNotification('收藏失败', AiKnowledgeApi.formatApiError(collResult.data, collResult.status));
      return;
    }

    const { collections } = collResult;
    let targetCollectionId = lastCollectionId;
    if (targetCollectionId && !collections.find((c) => String(c.id) === String(targetCollectionId))) {
      targetCollectionId = null;
    }
    if (!targetCollectionId && collections.length > 0) {
      targetCollectionId = collections[0].id;
    }
    if (!targetCollectionId) {
      showNotification('收藏失败', '没有可用的文集，请先在灏天文库创建个人花园文集');
      return;
    }

    await chrome.storage.local.set({ lastCollectionId: targetCollectionId });

    const collName = collections.find((c) => String(c.id) === String(targetCollectionId))?.name || '';
    const clipName = pageData.title || tab.title || '未命名剪藏';
    const clipContent = pageData.content;
    const clipUrl = tab.url || '';

    const dupCheck = await AiKnowledgeApi.findDuplicateClip({
      collectionId: targetCollectionId,
      name: clipName,
      content: clipContent,
      url: clipUrl,
    });
    if (dupCheck.duplicate) {
      const id = dupCheck.record.documentId ? ` (ID:${dupCheck.record.documentId})` : '';
      showNotification('已保存过', `该内容已在「${collName}」${id}，无需重复保存`);
      return;
    }

    const docResult = await AiKnowledgeApi.createDocument(serverUrl, token, {
      collectionId: targetCollectionId,
      name: clipName,
      content: clipContent,
    });

    if (docResult.ok && docResult.data?.document_id) {
      await AiKnowledgeApi.rememberSavedClip({
        fingerprint: dupCheck.fingerprint,
        documentId: docResult.data.document_id,
        collectionId: targetCollectionId,
        collectionName: collName,
        name: clipName,
      });
      const titlePreview = clipName.slice(0, 30);
      showNotification(
        '保存成功',
        `《${titlePreview}》已写入「${collName}」`,
      );
    } else {
      showNotification('收藏失败', AiKnowledgeApi.formatApiError(docResult.data, docResult.status));
    }
  } catch (e) {
    showNotification('收藏失败', `网络错误: ${e.message}`);
  }
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CLIP_PAGE') {
    quickClip({ id: message.tabId, title: message.title, url: message.url }, {})
      .then(() => sendResponse({ success: true }))
      .catch((e) => sendResponse({ success: false, error: e.message }));
    return true;
  }
});
