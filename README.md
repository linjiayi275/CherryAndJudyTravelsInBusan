# TravelsInBusan

純 HTML + CSS + JS 的「類 React 元件化」架構，
不使用任何框架，只用 `fetch()` 動態載入 HTML 片段。

## 16 個選單 + 5 個 footer 連結的規則

`pages/home.html` 裡的 16 個項目、`components/footer.html` 裡的 5 個
項目，依連結類型分成 4 種寫法，全部由 `js/common.js` 統一處理：

### 1. 內部頁面（SPA 換頁，不整頁重新整理）
```html
<a href="#" class="menu-item js-nav-link"
   data-page-url="pages/sub-hotel.html"
   data-page-key="hotel">
  ...
</a>
```
點擊會被攔截、呼叫 `navigateTo(pageUrl, pageKey)`，把 `pages/sub-hotel.html`
載入 `#page-container`，並同步 footer 的 active 狀態。
適用：飯店詳情、景點與餐廳、簡要行程、雨天備案、關於退稅、
必買推薦(實體店)、線上免稅店、緊急聯絡，以及 footer 全部 5 個項目
（行程、出入境、首頁、換匯、花費）——footer 現在統一都是內部頁面
連結，「花費」點進去後會進到 `pages/sub-expense.html`，該頁面裡面
才放連到 LINE App「lightsplit」小工具的連結。

### 2. 外部連結，直接開新分頁
```html
<a href="https://..." class="menu-item" target="_blank" rel="noopener noreferrer">
  ...
</a>
```
適用：地鐵路線圖（PDF）、釜山Pass。

### 3. 優先開手機 App，沒安裝才改開網頁
```html
<a href="https://map.naver.com/" class="menu-item js-open-app"
   data-app-url="nmap://"
   data-web-url="https://map.naver.com/">
  ...
</a>
```
點擊會呼叫 `openAppOrWeb(appUrl, webUrl)`：先嘗試用自訂協定
（如 `nmap://`）喚起 App，如果短時間內頁面沒有被切到背景
（代表 App 沒被喚起、可能沒安裝），就改用 `window.open()`
開啟備用網頁。`href` 本身也設定為網頁版網址，這樣即使 JS
還沒載入完成，使用者點擊也至少能正常導向網頁版。
適用：Naver Map、Google翻譯、Papago翻譯。

> ⚠️ 目前使用的 App 協定（`uber://`、`kakaot://`、`kakaobus://`、
> `nmap://`、`googletranslate://`、`papago://`）是各家常見的自訂
> URL Scheme 寫法，但沒有官方文件保證每一款都 100% 有效，
> 且各瀏覽器（尤其 iOS Safari）對「協定沒有對應 App」時的處理
> 方式不完全一致，實機測試後如有落差，請直接調整
> `pages/home.html` 對應項目的 `data-app-url`。

### 4. 跳出說明視窗（Bootstrap Modal）
```html
<button type="button" class="menu-item" data-bs-toggle="modal" data-bs-target="#modalUber">
  ...
</button>
```
適用：Uber、Kakao T、Kakao Bus。三個 Modal 的 HTML 直接寫在
`pages/home.html` 最下方（`#modalUber` / `#modalKakaoT` /
`#modalKakaoBus`），header 有標題 + X 關閉鍵，body 放備註／
重要提醒文字（目前是預留的範例文字，請自行替換），footer 的
「前往」按鈕本身也是 `.js-open-app`，點擊後一樣走「優先開
App、沒安裝才開網頁」的邏輯，同時因為有 `data-bs-dismiss="modal"`
會自動關閉視窗。

## 子頁面 Header 自動載入機制

之前的做法是在每個子頁面裡寫一段 inline `<script>` 呼叫
`loadComponent(...)`，但這樣沒辦法完全符合嚴格 CSP（inline script
規則），所以改成**資料屬性驅動**：

```html
<div class="sub-page" data-header-style="style1" data-header-title="行程">
  <div id="header-container"></div>
  ...
</div>
```

`js/common.js` 裡的 `initSubPageHeader()` 會在每次 `#page-container`
的內容載入完成後，自動偵測有沒有 `[data-header-title]`，有的話就載入
`components/header/sub-header-${style}.html`，並把標題文字塞進去。
header 上的返回鍵也拿掉了 `onclick="..."` 這種 inline 事件寫法，
改成 `.js-back` class + 事件委派處理（見下方 CSP 相容性段落）。

新增子頁面時，直接複製 `pages/sub-example.html` 改內容即可，
完全不用寫任何 `<script>` 標籤。

## 內部頁面清單（目前皆為預留骨架，之後請自行填內容）

| 檔案 | 對應項目 |
|---|---|
| `pages/sub-hotel.html` | 飯店詳情 |
| `pages/sub-spots.html` | 景點與餐廳 |
| `pages/sub-itinerary-brief.html` | 簡要行程 |
| `pages/sub-rain-plan.html` | 雨天備案 |
| `pages/sub-tax-refund.html` | 關於退稅 |
| `pages/sub-must-buy.html` | 必買推薦（實體店） |
| `pages/sub-duty-free.html` | 線上免稅店 |
| `pages/sub-emergency.html` | 緊急聯絡 |
| `pages/sub-itinerary.html` | footer「行程」 |
| `pages/sub-departure.html` | footer「出入境」 |
| `pages/sub-exchange.html` | footer「換匯」 |
| `pages/sub-expense.html` | footer「花費」（內含 LINE lightsplit 連結） |
| `pages/home.html` | footer「首頁」 |

## 資料夾說明

```
TravelsInBusan/
├─ index.html              ← 唯一的入口頁，載入所有 css/js，
│                              並提供 #page-container、#footer-container 兩個掛載點
├─ pages/
│  ├─ home.html             ← 首頁內容片段（對應你給的示意圖）
│  └─ sub-example.html      ← 子頁面範例，示範如何搭配 header 元件
├─ components/
│  ├─ header/
│  │  ├─ sub-header-style1.html  ← 返回鍵＋靠左標題
│  │  └─ sub-header-style2.html  ← 返回鍵（浮動）＋置中標題
│  └─ footer.html           ← 固定於畫面下方的導覽列
├─ css/
│  ├─ common.css            ← 色彩變數、reset、440px 版型規則
│  ├─ header.css
│  ├─ footer.css
│  ├─ home.css
│  └─ sub.css
├─ js/
│  ├─ app.js                 ← 進站時載入 home.html + footer.html
│  ├─ component-loader.js    ← 通用的 fetch → innerHTML 載入器
│  └─ common.js               ← footer active 狀態切換、navigateTo() 工具
├─ images/
│  ├─ common/                ← 共用圖片
│  ├─ home/                  ← 首頁用圖（README.md 內附完整檔名清單）
│  └─ sub/                   ← 子頁面用圖
└─ third-party/
   ├─ bootstrap-5.3.8-dist/
   └─ fontawesome-free-7.3.1-web/
```

third-party 內已經放入 bootstrap 5.3.8 與 Font Awesome Free 7.3.1
的完整 dist 檔案（css + js + webfonts），可直接使用，不用再另外下載。

## 運作原理

`index.html` 本身幾乎沒有內容，只有兩個空容器：

```html
<div id="page-container"></div>   <!-- pages/home.html 會被塞進這裡 -->
<div id="footer-container"></div> <!-- components/footer.html 會被塞進這裡 -->
```

`js/app.js` 在 `DOMContentLoaded` 時呼叫：

```js
loadComponent("pages/home.html", "page-container");
loadComponent("components/footer.html", "footer-container");
```

之後如果要新增子頁（例如「行程」、「出入境」），流程是：

1. 在 `pages/` 新增 `sub-itinerary.html`（可參考 `sub-example.html`）
2. 需要的話在該檔案裡自行呼叫
   `loadComponent("components/header/sub-header-style1.html", "header-container", ...)`
3. 幫 `css/sub.css` 加上這個頁面專屬的樣式（或另外新增一個 css 檔並在
   `index.html` 加一行 `<link>`）
4. 在 `js/common.js` 的 `navigateTo()` 或直接在按鈕上呼叫：
   `navigateTo('pages/sub-itinerary.html', 'itinerary')`

## 圖片

目前 `pages/home.html` 裡的所有 `<img src="images/home/xxx.png">`
路徑都已經先寫好檔名，實際圖片請依照
`images/home/README.md` 裡的清單放進去即可，不用改 HTML。

## ⚠️ 本機預覽注意事項

因為用了 `fetch()` 載入 HTML 片段，**直接雙擊開啟 index.html
（file:// 協定）在部分瀏覽器會因為 CORS 政策而讀不到片段**，
畫面會是空的。請用任一種本機伺服器方式預覽，例如：

- VS Code 安裝 "Live Server" 套件，右鍵 index.html → Open with Live Server
- 或在專案根目錄下執行：`npx serve .` / `python3 -m http.server 8080`
- 之後正式部署到公司網頁伺服器（WCMS）上就完全沒有這個問題

## 字體（Google Fonts）

`index.html` 的 `<head>` 已引入三款 Google Fonts，並在 `css/common.css`
定義好對應的 CSS 變數：

| 用途 | 字體 | CSS 變數 |
|---|---|---|
| "Visit" / "BUSAN." 大標 | Limelight | `var(--font-display)` |
| "Cherry & Judy" 標籤、日期文字 | Noto Serif | `var(--font-serif)` |
| 其餘所有文字（預設） | Noto Sans TC | `var(--font-base)`（`body` 已預設套用） |

> ⚠️ **CSP 注意事項**：Google Fonts 是外部資源，會從
> `fonts.googleapis.com`（樣式表）與 `fonts.gstatic.com`（字型檔）載入，
> 請務必在公司的 CSP 規範裡把這兩個網域加進
> `style-src` 與 `font-src`（或 `connect-src`，視你們 CSP 規則寫法而定），
> 否則字體會載入失敗、自動 fallback 回 `Noto Sans TC` / 系統字型。
> 若公司政策完全不允許外部字體來源，也可以把字型檔下載下來放進
> `third-party/` 或新增一個 `fonts/` 資料夾，改用 `@font-face` 自架。

## CSP 相容性

目前 CSS 全部寫在獨立的 .css 檔案裡（不是 inline style），
JS 也全部寫在獨立的 .js 檔案裡（不是 inline script），
所有的互動（換頁、開 App、跳出 Modal、返回鍵）都改成用
`class`（`.js-nav-link` / `.js-open-app` / `.js-back`）搭配
`js/common.js` 裡的**事件委派**（`document.addEventListener("click", ...)`）
處理，**沒有任何一處使用 `onclick="..."` 這類 inline 事件屬性**，
本身即符合嚴格 CSP（`script-src` 不含 `'unsafe-inline'`）規範。

Bootstrap 5 的 Modal 是透過 `data-bs-toggle` / `data-bs-target` /
`data-bs-dismiss` 這幾個資料屬性驅動，Bootstrap 內部一樣是用
事件委派實作，不涉及 inline script，同樣符合 CSP。

## 之後要接 React

現在的檔案切分方式（pages / components / css 各自獨立、
component-loader 負責「掛載」）已經很接近 React 的
「Page 組合 Component」概念，未來要轉 React 時：

- `pages/*.html` → 對應 React 的 Page / Route 元件
- `components/**/*.html` → 對應 React 的 UI 元件（Header, Footer...）
- `css/*.css` → 可直接改成 CSS Module 或搬進對應元件旁
- `component-loader.js` 的角色 → 由 React Router / 元件組合取代
