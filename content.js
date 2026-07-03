/**
 * 灏天文库剪藏助手 - Content Script
 * 在每个页面注入，监听来自background的提取请求
 */

// 这个content script主要用于：
// 1. 被background.js通过scripting.executeScript直接注入时使用
// 2. 标记页面已被注入

(function () {
  // 避免重复注入
  if (window.__aiknowledge_clipper_injected__) return;
  window.__aiknowledge_clipper_injected__ = true;

  // 监听来自扩展的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'EXTRACT_CONTENT') {
      const data = extractPageContent();
      sendResponse(data);
      return true;
    }
  });

  /**
   * 提取当前页面内容
   * @returns {{ title: string, content: string, publishDate: string, author: string, url: string }}
   */
  function extractPageContent() {
    const title = document.title || '';
    const url = window.location.href;

    let content = '';

    // 策略1: <article> 标签
    const article = document.querySelector('article');
    if (article) {
      content = cleanText(article.innerText || article.textContent);
    }

    // 策略2: 常见内容选择器
    if (!content || content.length < 100) {
      const selectors = [
        '.post-content', '.article-content', '.entry-content',
        '.content-body', '.article-body', '.post-body',
        '.markdown-body', '.rich_media_content',
        '#article-content', '#content-body',
        'main .content', '.main-content', 'main',
        '.topic-content', '.story-body',
        '.article-detail', '.news-content',
      ];
      for (const sel of selectors) {
        try {
          const el = document.querySelector(sel);
          if (el) {
            const text = cleanText(el.innerText || el.textContent);
            if (text.length > 100) {
              content = text;
              break;
            }
          }
        } catch (_) { /* ignore invalid selectors */ }
      }
    }

    // 策略3: 移除噪音后取body
    if (!content || content.length < 50) {
      const body = document.body;
      if (body) {
        const clone = body.cloneNode(true);
        const noiseTags = ['SCRIPT', 'STYLE', 'NAV', 'HEADER', 'FOOTER', 'NOSCRIPT',
          'IFRAME', 'aside', '.sidebar', '.ad', '.advertisement',
          '.comments', '.comment', '#comments'];
        noiseTags.forEach(sel => {
          try {
            clone.querySelectorAll(sel).forEach(el => el.remove());
          } catch (_) {}
        });
        content = cleanText(clone.innerText || clone.textContent);
      }
    }

    // 发布时间
    const publishDate = findMeta([
      { sel: 'time[datetime]', attr: 'datetime' },
      { sel: 'time[pubdate]', attr: 'datetime' },
      { sel: '[itemprop="datePublished"]', attr: 'content' },
      { sel: '[property="article:published_time"]', attr: 'content' },
      { sel: '.publish-date', attr: null },
      { sel: '.post-date', attr: null },
      { sel: '.article-date', attr: null },
      { sel: '.date-time', attr: null },
    ]);

    // 作者
    const author = findMeta([
      { sel: '[rel="author"]', attr: null },
      { sel: '[itemprop="author"]', attr: null },
      { sel: '.author-name', attr: null },
      { sel: '.post-author', attr: null },
      { sel: '.article-author', attr: null },
      { sel: '.byline', attr: null },
    ]);

    return { title, content, publishDate, author, url };
  }

  /**
   * 从多种选择器中查找第一个有内容的元信息
   */
  function findMeta(selectors) {
    for (const { sel, attr } of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const value = attr
            ? (el.getAttribute(attr) || '')
            : (el.textContent?.trim() || '');
          if (value) return value;
        }
      } catch (_) {}
    }
    return '';
  }

  /**
   * 清理提取的文本
   */
  function cleanText(text) {
    return (text || '')
      .replace(/\t/g, ' ')
      .replace(/ {2,}/g, ' ')
      .replace(/\n\n+/g, '\n\n')
      .trim();
  }
})();
