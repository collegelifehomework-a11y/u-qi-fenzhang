/* u 起分帳｜app.js｜v0.2
 * 此版是前端介面與互動骨架，使用示範資料。
 * 正式 API 尚未接線；權限、金額算法及結算一律由 GAS 後端執行。
 */
(() => {
  "use strict";
  const API = { url: "", pollMs: 120000 };
  const $ = (selector) => document.querySelector(selector);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "local-" + Date.now());
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
  const money = (value, currency) => new Intl.NumberFormat("zh-TW", {
    style: "currency", currency, maximumFractionDigits: 0
  }).format(Number(value) || 0);
  const today = () => new Date().toISOString().slice(0, 10);

  const state = {
    page: "home",
    theme: localStorage.getItem("u-theme") || "light",
    trip: { id: "demo-trip", name: "福岡自由行", start: "2026-10-04", end: "2026-10-09" },
    trips: [{ name: "福岡自由行", dates: "2026/10/04 – 10/09", status: "進行中" }],
    members: [
      { id: "m1", name: "我", role: "主要管理者" },
      { id: "m2", name: "小安", role: "旅伴" },
      { id: "m3", name: "阿哲", role: "旅伴" }
    ],
    expenses: [
      { id: "e1", title: "晚餐", date: "2026-10-04", category: "餐飲", jpy: 4800, twd: 1056, method: "現金", payer: "我", status: "已確認" },
      { id: "e2", title: "地鐵車票", date: "2026-10-05", category: "交通", jpy: 1200, twd: 264, method: "信用卡", payer: "小安", status: "已確認" },
      { id: "e3", title: "便利商店", date: "2026-10-05", category: "購物", jpy: 860, twd: null, method: "現金", payer: "阿哲", status: "待補" }
    ],
    selectedExpenseId: null
  };

  const activeExpenses = () => state.expenses.filter((item) => item.status !== "已取消");
  const totalTwd = () => activeExpenses().reduce((sum, item) => sum + (Number(item.twd) || 0), 0);
  const totalJpy = () => activeExpenses().reduce((sum, item) => sum + (Number(item.jpy) || 0), 0);
  const pageHeader = (eyebrow, title, subtitle = "") =>
    '<div class="hero"><div class="eyebrow">' + eyebrow + '</div><h1>' + title + '</h1>' +
    (subtitle ? "<p>" + subtitle + "</p>" : "") + "</div>";
  const pageButton = (label, page) =>
    '<button class="btn secondary small" type="button" data-page="' + page + '">' + label + "</button>";

  function expenseRows() {
    if (!state.expenses.length) return '<div class="empty">還沒有支出紀錄</div>';
    return state.expenses.map((item) =>
      '<button class="trip-card" type="button" data-expense="' + item.id + '">' +
      '<span><strong>' + escapeHtml(item.title) + '</strong><small>' + item.date + " · " +
      escapeHtml(item.category) + " · " + escapeHtml(item.payer) + "</small></span>" +
      '<span><strong>' + (item.twd == null ? "待補" : money(item.twd, "TWD")) +
      '</strong><small class="pill ' + (item.status === "待補" ? "pending" : "") + '">' +
      item.status + "</small></span></button>"
    ).join("");
  }

  function renderHome() {
    return pageHeader("TRAVEL EXPENSES", "旅途中的每一筆，<br>都幫你分清楚。", "建立旅行帳本，和旅伴一起記錄支出、掌握分帳。") +
      '<div class="actions"><button class="btn" data-action="new-trip">＋ 建立新旅行</button>' +
      '<button class="btn secondary" data-action="join">輸入邀請碼加入</button></div>' +
      '<div class="section-head"><h2>我的旅行</h2><span class="pill">' + state.trips.length + " 趟旅行</span></div>" +
      state.trips.map((trip) => '<button class="trip-card" data-page="trip"><span><strong>' +
        escapeHtml(trip.name) + "</strong><small>" + trip.dates + " · " + trip.status +
        "</small></span>›</button>").join("") +
      '<div class="card"><div class="eyebrow">QUICK OVERVIEW</div><h2>目前旅行</h2>' +
      '<div class="grid"><div class="stat"><small>總支出 TWD</small><strong>' +
      money(totalTwd(), "TWD") + '</strong></div><div class="stat"><small>支出筆數</small><strong>' +
      activeExpenses().length + "</strong></div></div>" +
      '<p class="hint">目前為本機示範資料，尚未連接雲端帳本。</p></div>';
  }

  function renderTrip() {
    return pageHeader("TRIP OVERVIEW", escapeHtml(state.trip.name), state.trip.start + " – " + state.trip.end) +
      '<div class="grid"><div class="stat"><small>總支出・台幣</small><strong>' +
      money(totalTwd(), "TWD") + '</strong></div><div class="stat"><small>總支出・日幣</small><strong>' +
      money(totalJpy(), "JPY") + "</strong></div></div>" +
      '<div class="section-head"><h2>近期支出</h2>' + pageButton("＋ 新增", "expense-new") + "</div>" +
      expenseRows() + '<div class="section-head"><h2>旅伴</h2>' + pageButton("管理成員", "members") + "</div>" +
      '<div class="card">' + state.members.map((member) =>
        '<div class="member"><span class="avatar">' + escapeHtml(member.name.slice(0, 1)) +
        '</span><span class="member-info"><strong>' + escapeHtml(member.name) +
        "</strong><small>" + escapeHtml(member.role) + "</small></span></div>"
      ).join("") + "</div>" +
      '<div class="actions"><button class="btn" data-page="expense-new">＋ 新增支出</button>' +
      pageButton("查看結算", "settlement") + "</div>";
  }

  function renderExpenseForm() {
    return '<button class="back" data-page="trip">← 返回旅行總覽</button>' +
      pageHeader("NEW EXPENSE", "新增支出", "先記錄消費，再確認付款與分帳細節。") +
      '<form id="expense-form" class="card form">' +
      '<div class="field"><label for="expense-title">支出名稱</label><input id="expense-title" name="title" required maxlength="80" placeholder="例如：博多拉麵"></div>' +
      '<div class="form-grid"><div class="field"><label>消費日期</label><input name="date" type="date" value="' + today() + '" required></div>' +
      '<div class="field"><label>分類</label><select name="category"><option>餐飲</option><option>交通</option><option>住宿</option><option>購物</option><option>門票</option><option>其他</option></select></div></div>' +
      '<div class="field"><label>付款方式</label><label class="choice"><input type="radio" name="method" value="現金" checked>現金</label>' +
      '<label class="choice"><input type="radio" name="method" value="信用卡">信用卡</label></div>' +
      '<div class="form-grid"><div class="field"><label>日幣消費金額</label><input name="jpy" inputmode="decimal" required placeholder="例如 1500.5"><small class="hint">最多一位小數；正式驗證由後端執行。</small></div>' +
      '<div class="field"><label>實際台幣金額</label><input name="twd" type="number" min="0" step="1" placeholder="待補可留空"></div></div>' +
      '<div class="field"><label>付款人</label><select name="payer">' + state.members.map((member) =>
        "<option>" + escapeHtml(member.name) + "</option>").join("") + "</select></div>' +
      '<details><summary>折扣與回饋（介面預留）</summary><div class="form-grid">' +
      '<div class="field"><label>折扣 TWD</label><input name="discount" type="number" min="0" value="0"></div>' +
      '<div class="field"><label>回饋點數／金額</label><input name="reward" type="number" min="0" step="0.01" value="0"></div></div>' +
      '<label class="choice"><input type="checkbox" name="sharedReward">回饋共享</label></details>' +
      '<div class="field"><label>分帳方式</label><select name="split"><option value="equal">平均分帳</option><option value="ratio">比例分帳</option><option value="exact">指定金額</option><option value="items">依項目分帳</option></select>' +
      '<small class="hint">目前僅保存介面選項；正式分帳計算由 GAS 執行。</small></div>' +
      '<button class="btn" type="submit">儲存支出（本機示範）</button></form>';
  }

  function renderExpenseDetail() {
    const item = state.expenses.find((expense) => expense.id === state.selectedExpenseId);
    if (!item) return '<div class="empty">找不到這筆支出。<button class="btn" data-page="trip">返回</button></div>';
    return '<button class="back" data-page="trip">← 返回旅行總覽</button>' +
      pageHeader("EXPENSE DETAIL", escapeHtml(item.title), item.date + " · " + escapeHtml(item.category)) +
      '<div class="card">' +
      '<div class="row"><span>日幣金額</span><strong>' + money(item.jpy, "JPY") + "</strong></div>" +
      '<div class="row"><span>台幣金額</span><strong>' + (item.twd == null ? "待補" : money(item.twd, "TWD")) + "</strong></div>" +
      '<div class="row"><span>付款方式</span><strong>' + escapeHtml(item.method) + "</strong></div>" +
      '<div class="row"><span>付款人</span><strong>' + escapeHtml(item.payer) + "</strong></div>" +
      '<div class="row"><span>狀態</span><strong>' + escapeHtml(item.status) + "</strong></div></div>" +
      '<div class="actions"><button class="btn danger" data-action="cancel-expense" data-id="' + item.id + '">取消示範支出</button></div>' +
      '<p class="hint">正式付款明細與分帳結果尚待後端 API 對接。</p>';
  }

  function renderRepayments() {
    return pageHeader("REPAYMENTS & REFUNDS", "還款與退款", "追蹤每位旅伴的應付、已付與退款確認。") +
      '<div class="card"><p>正式還款與退款資料將由後端提供。</p><p class="hint">此頁目前沒有建立示範債務，避免將假數字誤認為真實欠款。</p></div>';
  }

  function renderSettlement() {
    return pageHeader("SETTLEMENT", "結算中心", "確認總額、查看付款計畫，逐筆完成收付款。") +
      '<div class="grid"><div class="stat"><small>已記錄台幣金額</small><strong>' + money(totalTwd(), "TWD") +
      '</strong></div><div class="stat"><small>結算狀態</small><strong>尚未確認</strong></div></div>' +
      '<div class="card"><span class="pill pending">尚未建立結算快照</span><p>需先補齊待補付款與匯率，再由後端依正式規格產生付款計畫。</p>' +
      '<p class="hint">此示範畫面不自行推算真實債務。</p></div>' + pageButton("查看還款與退款", "repayments");
  }

  function renderMembers() {
    return pageHeader("TRAVEL MEMBERS", "旅伴管理", "查看成員並邀請旅伴加入同一本旅行帳本。") +
      '<div class="card">' + state.members.map((member, index) =>
        '<div class="member"><span class="avatar">' + escapeHtml(member.name.slice(0, 1)) +
        '</span><span class="member-info"><strong>' + escapeHtml(member.name) +
        "</strong><small>" + escapeHtml(member.role) + "</small></span>" +
        (index === 0 ? '<span class="pill">你</span>' : "") + "</div>"
      ).join("") + "</div><div class="actions"><button class="btn" data-action="invite">產生示範邀請碼</button></div>";
  }

  function renderSettings() {
    return pageHeader("PREFERENCES", "旅行設定", "調整外觀與同步偏好。") +
      '<div class="card"><div class="row"><strong>顯示模式</strong><select id="theme-select">' +
      '<option value="light" ' + (state.theme === "light" ? "selected" : "") + '>淺色</option>' +
      '<option value="dark" ' + (state.theme === "dark" ? "selected" : "") + '>深色</option></select></div>' +
      '<div class="row"><strong>自動同步</strong><span class="pill pending">每 2 分鐘・待串接</span></div>' +
      '<div class="row"><strong>目前版本</strong><span>前端 v0.2</span></div>' +
      '<p>正式版資料將由 GAS 驗證 Token、角色權限與資料版本後存入 Google Sheets。</p></div>';
  }

  const renderers = {
    home: renderHome, trip: renderTrip, "expense-new": renderExpenseForm,
    "expense-detail": renderExpenseDetail, repayments: renderRepayments,
    settlement: renderSettlement, members: renderMembers, settings: renderSettings
  };

  function render() {
    document.documentElement.dataset.theme = state.theme;
    $("#view").innerHTML = (renderers[state.page] || renderHome)();
    document.querySelectorAll(".nav-item").forEach((button) => {
      button.classList.toggle("active", button.dataset.page === state.page ||
        (state.page === "expense-detail" && button.dataset.page === "trip"));
    });
  }
  function navigate(page) {
    state.page = renderers[page] ? page : "home";
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 2300);
  }
  function showDialog(markup) {
    $("#dialog-content").innerHTML = markup;
    $("#dialog").showModal();
  }

  async function callApi(action, payload = {}) {
    if (!API.url) throw new Error("GAS API 尚未設定，目前使用示範資料。");
    const response = await fetch(API.url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, requestId: uid(), ...payload })
    });
    if (!response.ok) throw new Error("伺服器連線失敗");
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || "API 發生錯誤");
    return result.data;
  }
  async function syncNow() {
    if (!API.url) return showToast("目前是示範模式，尚未連接雲端");
    $("#sync-status").textContent = "同步中…";
    try {
      await callApi("trip.getSnapshot", { tripId: state.trip.id });
      $("#sync-status").textContent = "已同步";
    } catch (error) {
      $("#sync-status").textContent = "同步失敗";
      showToast(error.message);
    }
  }

  document.addEventListener("click", (event) => {
    const pageButton = event.target.closest("[data-page]");
    if (pageButton) { event.preventDefault(); navigate(pageButton.dataset.page); return; }
    const expenseButton = event.target.closest("[data-expense]");
    if (expenseButton) { state.selectedExpenseId = expenseButton.dataset.expense; navigate("expense-detail"); return; }
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    switch (actionButton.dataset.action) {
      case "sync": syncNow(); break;
      case "new-trip":
        showDialog('<h2>建立新旅行</h2><form id="trip-form" class="form"><div class="field"><label>旅行名稱</label><input name="name" required maxlength="60"></div><div class="form-grid"><input name="start" type="date" required><input name="end" type="date" required></div><button class="btn">建立（本機示範）</button></form>');
        break;
      case "join":
        showDialog('<h2>加入旅行</h2><form id="join-form" class="form"><div class="field"><label>邀請碼</label><input name="code" required maxlength="30"></div><div class="field"><label>暱稱</label><input name="nickname" required maxlength="20"></div><button class="btn">送出</button></form>');
        break;
      case "invite":
        showDialog('<h2>示範邀請碼</h2><h1>DEMO26</h1><p>此為示範文字，不是真正可用的邀請碼。</p><button class="btn" data-action="copy-code">複製</button>');
        break;
      case "copy-code":
        if (navigator.clipboard) navigator.clipboard.writeText("DEMO26").then(() => showToast("已複製")).catch(() => showToast("邀請碼：DEMO26"));
        else showToast("邀請碼：DEMO26");
        break;
      case "cancel-expense": {
        const item = state.expenses.find((expense) => expense.id === actionButton.dataset.id);
        if (item && window.confirm("確定取消這筆本機示範支出？")) {
          item.status = "已取消"; render(); showToast("已取消（僅本機示範）");
        }
        break;
      }
    }
  });

  document.addEventListener("submit", (event) => {
    if (event.target.id === "expense-form") {
      event.preventDefault();
      const form = new FormData(event.target);
      const jpyText = String(form.get("jpy") || "");
      const twdText = String(form.get("twd") || "").trim();
      if (!/^(0|[1-9][0-9]*)(\.[0-9])?$/.test(jpyText) || Number(jpyText) <= 0) {
        showToast("請輸入大於 0、最多一位小數的日幣金額"); return;
      }
      const twdValue = twdText === "" ? null : Number(twdText);
      if (twdValue !== null && (!Number.isSafeInteger(twdValue) || twdValue < 0)) {
        showToast("台幣金額請輸入非負安全整數"); return;
      }
      state.expenses.unshift({
        id: uid(), title: String(form.get("title")).trim(), date: form.get("date"),
        category: form.get("category"), jpy: Number(jpyText), twd: twdValue,
        method: form.get("method"), payer: form.get("payer"),
        status: twdValue === null ? "待補" : "待後端確認"
      });
      showToast("已加入本機示範紀錄");
      navigate("trip");
    }
    if (event.target.id === "trip-form") {
      event.preventDefault();
      const form = new FormData(event.target);
      const start = String(form.get("start")), end = String(form.get("end"));
      if (end < start) return showToast("結束日期不可早於開始日期");
      state.trip = { ...state.trip, name: String(form.get("name")).trim(), start, end };
      state.trips.unshift({ name: state.trip.name, dates: start + " – " + end, status: "準備中" });
      $("#dialog").close(); navigate("trip");
    }
    if (event.target.id === "join-form") {
      event.preventDefault(); $("#dialog").close();
      showToast("加入流程尚未連接後端，邀請碼未驗證");
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.id === "theme-select") {
      state.theme = event.target.value;
      localStorage.setItem("u-theme", state.theme);
      render();
    }
  });

  // 正式 GAS URL 尚未設定，因此不啟動無效輪詢。
  if (API.url) window.setInterval(syncNow, API.pollMs);
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
  }
  render();
})();