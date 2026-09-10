/* ============================================
   shopping-lightbox.js
   初始化 PhotoSwipe，讓購物清單表格裡的商品縮圖可以
   點擊放大看大圖。

   這支是 ES module（<script type="module">），因為
   PhotoSwipe v5 官方發佈的就是 ESM 格式，跟其他全站共用
   的 classic <script> 檔案（common.js 等）不同支。

   PhotoSwipeLightbox 內部是用「事件委派」監聽 gallery
   選到的容器，符合 children 選擇器的點擊都會被接住，
   即使購物清單是之後才由 js/shopping-render.js 動態插入
   DOM 的也一樣抓得到，所以只需要在網站啟動時初始化一次，
   不需要每次 SPA 換頁時重新綁定。

   跟橫向/縱向拖曳捲動（js/common.js 的 initDragScroll）
   共用同一批圖片元素：拖曳超過門檻值放開滑鼠時，
   initDragScroll 會攔截掉緊接著的 click，PhotoSwipe
   就不會被誤觸開啟，兩者互不干擾。
   ============================================ */

import PhotoSwipeLightbox from "../third-party/photoswipe/photoswipe-lightbox.esm.min.js";

const lightbox = new PhotoSwipeLightbox({
  gallery: "#page-container",
  children: ".pswp-trigger",
  pswpModule: () => import("../third-party/photoswipe/photoswipe.esm.min.js"),
});

lightbox.init();
