/* ============================================
   app.js
   應用程式進入點
   負責：初次進站時載入 home 頁面 + footer 元件
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  // 載入首頁內容到 #page-container
  loadComponent("pages/home.html", "page-container");

  // 載入固定底部導覽列到 #footer-container
  loadComponent("components/footer.html", "footer-container");

  // 之後若要動態切換分頁，可改為：
  // navigateTo('pages/sub-itinerary.html', 'itinerary');
});
