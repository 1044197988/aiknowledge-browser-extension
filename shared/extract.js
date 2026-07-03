/**
 * 注入到目标页面执行的正文提取函数（须为独立函数，不可依赖扩展 API）
 */
function extractPageContent() {
  const title = document.title || '';

  let content = '';

  const article = document.querySelector('article');
  if (article) {
    content = article.innerText || article.textContent;
  }

  if (!content) {
    const selectors = [
      '.post-content', '.article-content', '.entry-content',
      '.content-body', '.article-body', '.post-body',
      '.markdown-body', '.rich_media_content',
      '#article-content', '#content-body',
      'main', '.main-content',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText && el.innerText.length > 100) {
        content = el.innerText;
        break;
      }
    }
  }

  if (!content || content.length < 50) {
    const body = document.body;
    if (body) {
      const clone = body.cloneNode(true);
      ['SCRIPT', 'STYLE', 'NAV', 'HEADER', 'FOOTER', 'NOSCRIPT', 'IFRAME'].forEach((tag) => {
        clone.querySelectorAll(tag).forEach((el) => el.remove());
      });
      content = clone.innerText || clone.textContent || '';
    }
  }

  let publishDate = '';
  for (const sel of [
    'time[datetime]', '[itemprop="datePublished"]',
    '[property="article:published_time"]', '.publish-date', '.post-date',
  ]) {
    const el = document.querySelector(sel);
    if (el) {
      publishDate = el.getAttribute('datetime') || el.getAttribute('content') || el.textContent?.trim() || '';
      if (publishDate) break;
    }
  }

  let author = '';
  for (const sel of ['[rel="author"]', '.author', '.post-author', '[itemprop="author"]', '.byline']) {
    const el = document.querySelector(sel);
    if (el) {
      author = el.textContent?.trim() || '';
      if (author) break;
    }
  }

  content = (content || '').replace(/\n{3,}/g, '\n\n').trim();

  return { title, content, publishDate, author };
}
