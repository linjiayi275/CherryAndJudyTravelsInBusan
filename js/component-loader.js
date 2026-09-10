/* ============================================
   component-loader.js
   通用 HTML 片段載入器
   負責把 pages/所有.html、components/所有.html
   fetch 進來後塞進指定的容器 (id)
   ============================================ */

/**
 * 載入一個 HTML 片段到指定容器
 * @param {string} url - 片段路徑，例如 'pages/home.html'
 * @param {string} containerId - 要塞入內容的容器 id
 * @param {Function} [onLoaded] - 載入完成後的 callback（可選）
 * @returns {Promise<void>}
 */
async function loadComponent(url, containerId, onLoaded) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`[component-loader] 找不到容器 #${containerId}`);
    return;
  }

  try {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${url}`);
    }
    const html = await response.text();
    container.innerHTML = html;

    // 讓片段內如有 <script> 標籤也能被執行
    // （innerHTML 插入的 script 預設不會自動執行，需手動搬移重建）
    const scripts = container.querySelectorAll("script");
    scripts.forEach((oldScript) => {
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.textContent = oldScript.textContent;
      oldScript.replaceWith(newScript);
    });

    if (typeof onLoaded === "function") {
      onLoaded(container);
    }

    // 通知全站：某個元件載入完成，方便其他 js 監聽並初始化互動
    document.dispatchEvent(
      new CustomEvent("component:loaded", {
        detail: { url, containerId },
      }),
    );
  } catch (err) {
    console.error(`[component-loader] 載入失敗：${url}`, err);
    container.innerHTML = `<p style="padding:20px;color:#c00;">元件載入失敗：${url}</p>`;
  }
}
