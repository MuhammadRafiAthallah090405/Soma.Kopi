import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  onValue,
  push,
  remove,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js";

// ===== FIREBASE CONFIG =====
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  databaseURL:
    "",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ===== DATA =====
const MENUS = [
  {
    id: 0,
    produk: "Assets/produk/americano.jpeg",
    name: "AMERICANO",
    desc: "Pure, Bold, & Intense. Ekstraksi espresso ganda dengan air mineral berkualitas.",
    price: 8000,
  },
  {
    id: 1,
    produk: "Assets/produk/aren.jpeg",
    name: "coffee ARENT",
    desc: "The All-Time Favorite. Perpaduan harmonis espresso, susu segar, dan legitnya gula aren murni.",
    price: 10000,
  },
  {
    id: 2,
    produk: "Assets/produk/dolce.jpeg",
    name: "DOLCE coffee",
    desc: "Silky & Smooth. Sentuhan mewah espresso yang bertemu dengan premium dolce sauce.",
    price: 10000,
  },
  {
    id: 3,
    produk: "Assets/produk/vanila.jpeg",
    name: "VANILLA coffee",
    desc: "Sweet & Aromatic. Paduan espresso dan susu dengan aroma vanilla yang menenangkan.",
    price: 12000,
  },
  {
    id: 4,
    produk: "Assets/produk/butter-scotch.jpeg",
    name: "coffee BUTTERSCOTCH",
    desc: "Rich & Buttery. Eksplorasi rasa unik dari espresso dengan sensasi karamel mentega.",
    price: 12000,
  },
  {
    id: 5,
    produk: "Assets/produk/matcha.jpeg",
    name: "MATCHA",
    desc: "Calm & Earthy. Menggunakan bubuk matcha premium dengan tekstur yang creamy.",
    price: 12000,
  },
  {
    id: 6,
    produk: "Assets/produk/choco-classic.jpeg",
    name: "CHOCOLATE CLASSIC",
    desc: "Rich & Comforting. Definisi kebahagiaan dalam segelas cokelat premium yang kental.",
    price: 12000,
  },
];

let appData = {
  stock: { 0: 25, 1: 20, 2: 30, 3: 15, 4: 20, 5: 18, 6: 12 },
  orders: [],
  pendingOrders: [],
  revenue: 0,
  feedbackList: [],
};

// ===== FIREBASE: INISIALISASI DATA AWAL =====
async function initFirebaseData() {
  const stockSnap = await get(ref(db, "stock"));
  if (!stockSnap.exists()) {
    await set(ref(db, "stock"), appData.stock);
  }
  const revenueSnap = await get(ref(db, "revenue"));
  if (!revenueSnap.exists()) {
    await set(ref(db, "revenue"), 0);
  }
}

// ===== FIREBASE: LOAD DATA =====
async function loadData() {
  const snap = await get(ref(db, "/"));
  if (snap.exists()) {
    const data = snap.val();
    appData.stock = data.stock || appData.stock;
    appData.revenue = data.revenue || 0;

    // Pending orders
    appData.pendingOrders = [];
    if (data.pendingOrders) {
      Object.entries(data.pendingOrders).forEach(([key, val]) => {
        appData.pendingOrders.push({ ...val, firebaseKey: key });
      });
    }

    // Confirmed orders
    appData.orders = [];
    if (data.orders) {
      Object.entries(data.orders).forEach(([key, val]) => {
        appData.orders.push({ ...val, firebaseKey: key });
      });
    }

    // Feedback
    appData.feedbackList = [];
    if (data.feedback) {
      Object.entries(data.feedback).forEach(([key, val]) => {
        appData.feedbackList.push({ ...val, key });
      });
    }
  }
}

// ===== FIREBASE: REALTIME LISTENER =====
function listenRealtimeChanges(callback) {
  onValue(ref(db, "/"), async (snap) => {
    if (snap.exists()) {
      const data = snap.val();
      appData.stock = data.stock || appData.stock;
      appData.revenue = data.revenue || 0;

      appData.pendingOrders = [];
      if (data.pendingOrders) {
        Object.entries(data.pendingOrders).forEach(([key, val]) => {
          appData.pendingOrders.push({ ...val, firebaseKey: key });
        });
      }

      appData.orders = [];
      if (data.orders) {
        Object.entries(data.orders).forEach(([key, val]) => {
          appData.orders.push({ ...val, firebaseKey: key });
        });
      }

      appData.feedbackList = [];
      if (data.feedback) {
        Object.entries(data.feedback).forEach(([key, val]) => {
          appData.feedbackList.push({ ...val, key });
        });
      }

      if (callback) callback();
    }
  });
}

let cart = [];
let currentOrderCode = "";
let overlayState = {
  menuId: -1,
  sugar: "Normal",
  temp: "Normal",
  qty: 1,
  notes: "",
};
let currentPayMethod = "qris";

// ===== PAGE ROUTING =====
function showPage(id) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

async function checkRoute() {
  await initFirebaseData();
  await loadData();
  if (window.location.hash === "#admin") {
    if (sessionStorage.getItem("adminLoggedIn")) {
      showPage("pageAdmin");
      initAdmin();
    } else {
      showPage("pageLogin");
    }
  } else {
    showPage("pageCust");
    buildMenuGrid();
    startCustomerListener();
    // Restore customer state setelah refresh
    const savedScreen = restoreScreenState();
    restoreCartState();
    restoreCurrentOrderState();
    if (savedScreen >= 3) {
      restoreCustomerData();
    }
    if (savedScreen >= 4) {
      restorePayMethodState();
    }
    if (savedScreen >= 5) {
      if (restoreOrderScreenState()) return;
    }
    if (savedScreen > 1) {
      goScreen(savedScreen);
    }
  }
}

window.addEventListener("hashchange", () => checkRoute());

// Tunggu DOM siap sebelum menjalankan checkRoute
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkRoute);
} else {
  checkRoute();
}

// ===== SCREEN NAVIGATION =====
let currentScreen = 1;

function saveScreenState(n) {
  sessionStorage.setItem("custCurrentScreen", n);
}

function restoreScreenState() {
  const saved = sessionStorage.getItem("custCurrentScreen");
  return saved ? parseInt(saved) : 1;
}

function clearScreenState() {
  sessionStorage.removeItem("custCurrentScreen");
  sessionStorage.removeItem("custName");
  sessionStorage.removeItem("custPhone");
  sessionStorage.removeItem("custCart");
  sessionStorage.removeItem("custPayMethod");
  sessionStorage.removeItem("custOrderCode");
}

function saveCartState() {
  sessionStorage.setItem("custCart", JSON.stringify(cart));
}

function restoreCartState() {
  const saved = sessionStorage.getItem("custCart");
  if (saved) {
    try {
      cart = JSON.parse(saved);
    } catch (e) {
      cart = [];
    }
  } else {
    cart = [];
  }
}

function saveCustomerData() {
  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  if (name) sessionStorage.setItem("custName", name);
  if (phone) sessionStorage.setItem("custPhone", phone);
}

function restoreCustomerData() {
  const name = sessionStorage.getItem("custName");
  const phone = sessionStorage.getItem("custPhone");
  if (name) document.getElementById("custName").value = name;
  if (phone) document.getElementById("custPhone").value = phone;
}

function savePayMethodState() {
  sessionStorage.setItem("custPayMethod", currentPayMethod);
}

function restorePayMethodState() {
  const saved = sessionStorage.getItem("custPayMethod");
  if (saved) {
    currentPayMethod = saved;
    selPay(saved);
  }
}

function saveCurrentOrderState() {
  if (currentOrderCode) {
    sessionStorage.setItem("custOrderCode", currentOrderCode);
  }
}

function restoreCurrentOrderState() {
  const saved = sessionStorage.getItem("custOrderCode");
  if (saved) currentOrderCode = saved;
}

function restorePendingScreen(order) {
  const codeEl = document.getElementById("pendingCodeDisplay");
  const summaryEl = document.getElementById("pendingSummary");
  if (codeEl) codeEl.textContent = currentOrderCode;
  if (summaryEl && order) {
    summaryEl.innerHTML =
      `<div class="sum-row"><span>Nama</span><span>${escapeHtml(
        order.name
      )}</span></div>` +
      order.items
        .map(
          (i) =>
            `<div class="sum-row"><span>${escapeHtml(i.menuName)} ×${
              i.qty
            }</span><span>${fmt(i.itemTotal)}</span></div>`
        )
        .join("") +
      `<div class="sum-row total"><span>Total</span><span>${fmt(
        order.total
      )}</span></div>`;
  }
}

function restoreOrderScreenState() {
  restoreCurrentOrderState();
  if (!currentOrderCode) return false;

  const pendingOrder = appData.pendingOrders.find(
    (o) => o.code === currentOrderCode
  );
  if (pendingOrder) {
    if (pendingOrder.confirmed) {
      populateFeedbackScreen(pendingOrder);
      goScreen(7);
    } else {
      restorePendingScreen(pendingOrder);
      goScreen(5);
    }
    return true;
  }

  const confirmedOrder = appData.orders.find(
    (o) => o.code === currentOrderCode
  );
  if (confirmedOrder) {
    populateSuccessScreen(confirmedOrder);
    goScreen(6);
    return true;
  }

  return false;
}

function goScreen(n) {
  document
    .querySelectorAll(".cust-screen")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById("sc" + n).classList.add("active");
  currentScreen = n;
  saveScreenState(n);

  [1, 2, 3, 4].forEach((i) => {
    const el = document.getElementById("cs" + i);
    if (el) {
      el.className = "step-item" + (i === n ? " active" : i < n ? " done" : "");
    }
  });

  if (n === 2) updateCartDisplay();
  if (n === 3) {
    updateIdentSummary();
    checkIdentity();
  }
  if (n === 4) {
    updatePaySummary();
    renderQRIS();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}
window.goScreen = goScreen;

// ===== UTILITIES =====
function escapeHtml(text) {
  if (!text) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.toString().replace(/[&<>"']/g, (m) => map[m]);
}
function fmt(n) {
  return "Rp " + n.toLocaleString("id-ID");
}

// ===== MENU GRID =====
function buildMenuGrid() {
  const g = document.getElementById("menuGrid");
  g.innerHTML = "";
  MENUS.forEach((m) => {
    const stock = appData.stock[m.id] ?? 0;
    const isOut = stock === 0;
    const isLow = stock > 0 && stock <= 5;
    const badgeText = isOut
      ? ""
      : isLow
      ? `⚠ Sisa ${stock}`
      : `✓ Tersedia ${stock}`;
    const div = document.createElement("div");
    div.className = "menu-card" + (isOut ? " out-of-stock" : "");
    div.dataset.id = m.id;
    div.innerHTML = `
        ${
          !isOut && badgeText
            ? `<div class="stock-badge ${
                isLow ? "stock-low pulse" : "stock-ok"
              }">${badgeText}</div>`
            : ""
        }
        <img class="menu-produk" src="${m.produk}" alt="${
      m.name
    }" onerror="this.style.display='none'">
        <div class="menu-name">${m.name}</div>
        <div class="menu-desc">${m.desc}</div>
        <div class="menu-price">${fmt(m.price)}</div>
      `;
    if (!isOut) div.onclick = () => openItemOverlay(m.id);
    g.appendChild(div);
  });
}

// ===== ITEM OVERLAY =====
function openItemOverlay(menuId) {
  const m = MENUS[menuId];
  overlayState = {
    menuId,
    sugar: "Normal",
    temp: "Normal",
    qty: 1,
    notes: "",
  };
  document.getElementById(
    "overlayproduk"
  ).innerHTML = `<img src="${m.produk}" alt="${m.name}" style="width:100%;height:80px;object-fit:cover;border-radius:12px;margin-bottom:8px;">`;
  document.getElementById("overlayName").textContent = m.name;
  document.getElementById("overlayDesc").textContent = m.desc;
  document.getElementById("overlayPrice").textContent = fmt(m.price);
  document.getElementById("overlayQty").textContent = "1";
  document.getElementById("overlayNotes").value = "";

  document.getElementById("overlaySugarOpts").innerHTML = `
      <button class="item-option-btn active" onclick="setOverlayOpt('sugar','Normal',this)">Normal</button>
      <button class="item-option-btn" onclick="setOverlayOpt('sugar','Less Sugar',this)">Less Sugar</button>
      <button class="item-option-btn" onclick="setOverlayOpt('sugar','Extra Sweet',this)">Extra Sweet</button>
      <button class="item-option-btn" onclick="setOverlayOpt('sugar','No Sugar',this)">No Sugar</button>
    `;
  document.getElementById("overlayTempOpts").innerHTML = `
      <button class="item-option-btn active" onclick="setOverlayOpt('temp','Normal',this)">Normal</button>
      <button class="item-option-btn" onclick="setOverlayOpt('temp','Less Ice',this)">Less Ice</button>
    `;
  document.getElementById("itemOverlay").classList.add("active");
}
window.openItemOverlay = openItemOverlay;

function closeItemOverlay() {
  document.getElementById("itemOverlay").classList.remove("active");
}
window.closeItemOverlay = closeItemOverlay;

function setOverlayOpt(key, val, btn) {
  btn
    .closest(".item-options")
    .querySelectorAll(".item-option-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  overlayState[key] = val;
}
window.setOverlayOpt = setOverlayOpt;

function changeOverlayQty(d) {
  const stock = appData.stock[overlayState.menuId] ?? 0;
  overlayState.qty = Math.max(1, Math.min(stock, overlayState.qty + d));
  document.getElementById("overlayQty").textContent = overlayState.qty;
}
window.changeOverlayQty = changeOverlayQty;

function addToCart() {
  overlayState.notes = document.getElementById("overlayNotes").value.trim();
  const m = MENUS[overlayState.menuId];
  cart.push({
    menuId: overlayState.menuId,
    menuName: m.name,
    produk: m.produk,
    price: m.price,
    sugar: overlayState.sugar,
    temp: overlayState.temp,
    qty: overlayState.qty,
    notes: overlayState.notes,
  });
  saveCartState();
  closeItemOverlay();
  goScreen(2);
  showToast("Ditambahkan ke keranjang! 🛒");
}
window.addToCart = addToCart;

// ===== CART =====
function getTotalQty() {
  return cart.reduce((a, item) => a + item.qty, 0);
}

function updateCartDisplay() {
  const listEl = document.getElementById("cartItemsList");
  const totalEl = document.getElementById("cartTotalSection");
  const checkoutBtn = document.getElementById("checkoutBtn");
  const totalQty = getTotalQty();

  document.getElementById("cartHeaderBadge").textContent = totalQty;
  document.getElementById("cartHeaderSub").textContent =
    totalQty === 0 ? "Keranjang kosong" : `${totalQty} item dipilih`;

  if (cart.length === 0) {
    listEl.innerHTML =
      '<div class="cart-empty">Keranjang kosong.<br>Pilih menu dulu!</div>';
    totalEl.style.display = "none";
    checkoutBtn.disabled = true;
    return;
  }

  let subtotal = 0;
  listEl.innerHTML = cart
    .map((item, idx) => {
      const itemTotal = item.price * item.qty;
      subtotal += itemTotal;
      return `
        <div class="cart-item">
          <div class="cart-item-img">
            <img src="${item.produk}" alt="${
        item.menuName
      }" style="width:100%;height:100%;object-fit:cover;border-radius:10px;" onerror="this.style.display='none'">
          </div>
          <div class="cart-item-info">
            <div class="cart-item-name">${escapeHtml(item.menuName)}</div>
            <div class="cart-item-opts">${escapeHtml(
              item.sugar
            )} · ${escapeHtml(item.temp)}</div>
            ${
              item.notes
                ? `<div class="cart-item-opts" style="font-style:italic;">📝 ${escapeHtml(
                    item.notes
                  )}</div>`
                : ""
            }
            <div class="cart-item-price">${fmt(itemTotal)}</div>
          </div>
          <div class="cart-item-actions">
            <button class="cart-qty-btn" onclick="changeCartQty(${idx},-1)">−</button>
            <span class="cart-qty">${item.qty}</span>
            <button class="cart-qty-btn" onclick="changeCartQty(${idx},1)">+</button>
            <button class="cart-remove" onclick="removeFromCart(${idx})">🗑</button>
          </div>
        </div>
      `;
    })
    .join("");

  document.getElementById("cartSubtotal").textContent = fmt(subtotal);
  document.getElementById("cartTotal").textContent = fmt(subtotal);
  totalEl.style.display = "block";
  checkoutBtn.disabled = false;
}

function changeCartQty(idx, d) {
  const item = cart[idx];
  const stock = appData.stock[item.menuId] ?? 0;
  item.qty = Math.max(1, Math.min(stock, item.qty + d));
  saveCartState();
  updateCartDisplay();
}
window.changeCartQty = changeCartQty;

function removeFromCart(idx) {
  cart.splice(idx, 1);
  saveCartState();
  updateCartDisplay();
}
window.removeFromCart = removeFromCart;

// ===== IDENTITY =====
function checkIdentity() {
  const n = document.getElementById("custName").value.trim();
  const p = document.getElementById("custPhone").value.trim();
  document.getElementById("btnToPay").disabled = !(
    n.length > 1 && p.length > 6
  );
}
window.checkIdentity = checkIdentity;

function updateIdentSummary() {
  saveCustomerData();
  let subtotal = 0;
  const itemsHtml = cart
    .map((item) => {
      const itemTotal = item.price * item.qty;
      subtotal += itemTotal;
      return `<div class="sum-row"><span>${item.menuName} ×${
        item.qty
      }</span><span>${fmt(itemTotal)}</span></div>`;
    })
    .join("");
  document.getElementById("identSummary").innerHTML =
    itemsHtml +
    `<div class="sum-row total"><span>Total</span><span>${fmt(
      subtotal
    )}</span></div>`;
}

function updatePaySummary() {
  let subtotal = 0;
  const itemsHtml = cart
    .map((item) => {
      const itemTotal = item.price * item.qty;
      subtotal += itemTotal;
      return `<div class="sum-row"><span>${escapeHtml(
        item.menuName
      )}</span><span>×${item.qty} (${escapeHtml(item.sugar)}, ${escapeHtml(
        item.temp
      )})</span></div>`;
    })
    .join("");
  const name = document.getElementById("custName").value.trim();
  const payEl = document.getElementById("paySummary");
  if (payEl) {
    payEl.innerHTML =
      `<div class="sum-row"><span>Nama</span><span>${escapeHtml(
        name
      )}</span></div>` +
      itemsHtml +
      `<div class="sum-row total"><span>Total</span><span>${fmt(
        subtotal
      )}</span></div>`;
  }
  const qrisEl = document.getElementById("qrisAmount");
  if (qrisEl) qrisEl.textContent = fmt(subtotal);
}

function selPay(type) {
  currentPayMethod = type;
  savePayMethodState();
  document.getElementById("pyQRIS").classList.toggle("active", type === "qris");
  document.getElementById("pyCash").classList.toggle("active", type === "cash");
  document.getElementById("qrisSection").style.display =
    type === "qris" ? "block" : "none";
  document.getElementById("cashSection").style.display =
    type === "cash" ? "block" : "none";
}
window.selPay = selPay;

function renderQRIS() {
  // QR pattern tetap sama seperti aslinya
  const pattern = [
    1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1,
    0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0,
    1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1,
    0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 0, 1, 1,
    1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0,
    1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1,
    0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0,
    1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0,
    1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 1, 1,
    1, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    0, 0, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1,
    0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0,
    1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1,
    0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1,
    0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0,
    1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1,
    0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0,
  ];
  const p = document.getElementById("qrisPattern");
  if (!p) return;
  p.innerHTML = "";
  pattern.forEach((v) => {
    const c = document.createElement("div");
    c.className = "qr-cell " + (v ? "qr-dark" : "qr-light");
    p.appendChild(c);
  });
}

// ===== SUBMIT ORDER (FIREBASE) =====
async function submitOrder() {
  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  if (!name || !phone || cart.length === 0) return;

  const code = "KN" + (Date.now() % 10000).toString().padStart(4, "0");
  const now = new Date();
  const timeStr =
    now.getHours().toString().padStart(2, "0") +
    ":" +
    now.getMinutes().toString().padStart(2, "0");

  let total = 0;
  const items = cart.map((item) => {
    const itemTotal = item.price * item.qty;
    total += itemTotal;
    return {
      menuId: item.menuId,
      menuName: item.menuName,
      produk: item.produk,
      price: item.price,
      sugar: item.sugar,
      temp: item.temp,
      qty: item.qty,
      notes: item.notes || "",
      itemTotal,
    };
  });

  const orderData = {
    code,
    time: timeStr,
    name,
    phone,
    items,
    total,
    pay: currentPayMethod,
    confirmed: false,
  };

  // Simpan ke Firebase
  await push(ref(db, "pendingOrders"), orderData);

  currentOrderCode = code;
  saveCurrentOrderState();
  document.getElementById("pendingCodeDisplay").textContent = code;
  document.getElementById("pendingSummary").innerHTML =
    `<div class="sum-row"><span>Nama</span><span>${escapeHtml(
      name
    )}</span></div>` +
    items
      .map(
        (i) =>
          `<div class="sum-row"><span>${escapeHtml(i.menuName)} ×${
            i.qty
          }</span><span>${fmt(i.itemTotal)}</span></div>`
      )
      .join("") +
    `<div class="sum-row total"><span>Total</span><span>${fmt(
      total
    )}</span></div>`;

  cart = [];
  saveCartState();
  goScreen(5);
  showToast("Pesanan terkirim! Menunggu konfirmasi admin ⏳");
}
window.submitOrder = submitOrder;

// ===== CUSTOMER LISTENER: REALTIME untuk stock, pending orders, dan konfirmasi =====
function startCustomerListener() {
  // Listen realtime ke semua changes (stock, pending orders, confirmed orders)
  onValue(ref(db, "/"), (snap) => {
    if (!snap.exists()) return;
    const data = snap.val();

    // Update appData dengan data terbaru
    const oldStock = { ...appData.stock };
    appData.stock = data.stock || appData.stock;

    // Rebuild menu grid jika ada perubahan stock
    const stockChanged =
      JSON.stringify(oldStock) !== JSON.stringify(appData.stock);
    if (stockChanged) {
      buildMenuGrid();
    }

    // Cek konfirmasi pesanan customer - TRIGGER REGARDLESS OF SCREEN STATE
    if (currentOrderCode && data.pendingOrders) {
      Object.values(data.pendingOrders).forEach((order) => {
        if (order.code === currentOrderCode && order.confirmed === true) {
          // Populate feedback screen dan pindah ke screen 7 langsung
          populateFeedbackScreen(order);
          goScreen(7);
        }
      });
    }
  });
}

function populateSuccessScreen(order) {
  document.getElementById("orderCodeDisplay").textContent = order.code;
  document.getElementById("successGreet").textContent = `Hei ${escapeHtml(
    order.name
  )}! Pesananmu sudah dikonfirmasi! ✨`;
  document.getElementById("successSummary").innerHTML =
    `<div class="sum-row"><span>Nama</span><span>${escapeHtml(
      order.name
    )}</span></div>` +
    order.items
      .map(
        (i) =>
          `<div class="sum-row"><span>${escapeHtml(
            i.menuName
          )}</span><span>${escapeHtml(i.sugar)} · ${escapeHtml(
            i.temp
          )}</span></div>`
      )
      .join("") +
    `<div class="sum-row total"><span>Total</span><span>${fmt(
      order.total
    )}</span></div>`;
  document.getElementById("successInfo").innerHTML =
    order.pay === "qris"
      ? `<strong>Pembayaran QRIS</strong> sudah dikonfirmasi. Tunjukkan kode <strong>${escapeHtml(
          order.code
        )}</strong> kepada barista.`
      : `Tunjukkan kode <strong>${escapeHtml(
          order.code
        )}</strong> kepada kasir. Pesananmu sedang dibuat!`;
}

function populateFeedbackScreen(order) {
  document.getElementById("feedbackOrderCodeDisplay").textContent = order.code;
  document.getElementById("feedbackGreet").textContent = `Hei ${escapeHtml(
    order.name
  )}! Silakan bagikan pengalamanmu setelah konfirmasi.`;
  document.getElementById("feedbackSummary").innerHTML =
    `<div class="sum-row"><span>Nama</span><span>${escapeHtml(
      order.name
    )}</span></div>` +
    order.items
      .map(
        (i) =>
          `<div class="sum-row"><span>${escapeHtml(
            i.menuName
          )}</span><span>${escapeHtml(i.sugar)} · ${escapeHtml(
            i.temp
          )}</span></div>`
      )
      .join("") +
    `<div class="sum-row total"><span>Total</span><span>${fmt(
      order.total
    )}</span></div>`;
  document.getElementById("feedbackInfo").innerHTML =
    order.pay === "qris"
      ? `<strong>Pembayaran QRIS</strong> sudah dikonfirmasi. Tunjukkan kode <strong>${escapeHtml(
          order.code
        )}</strong> kepada barista.`
      : `Tunjukkan kode <strong>${escapeHtml(
          order.code
        )}</strong> kepada kasir. Pesananmu sedang dibuat!`;

  feedbackRating = 0;
  document.getElementById("feedbackText").value = "";
  document
    .querySelectorAll(".star-btn")
    .forEach((b) => b.classList.remove("active"));
  const btn = document.getElementById("btnKirimFeedback");
  if (btn) {
    btn.disabled = true;
    btn.style.display = "";
  }
  document.getElementById("feedbackText").style.display = "";
  document.getElementById("starRow").style.pointerEvents = "auto";
  document.getElementById("feedbackSent").style.display = "none";
}

// ===== CHECK ORDER STATUS (MANUAL) =====
async function checkOrderStatus() {
  await loadData();
  const order = appData.pendingOrders.find((o) => o.code === currentOrderCode);
  if (order && order.confirmed) {
    populateFeedbackScreen(order);
    goScreen(7);
  } else {
    showToast("Pesanan belum dikonfirmasi, silakan tunggu...");
  }
}
window.checkOrderStatus = checkOrderStatus;

function resetOrder() {
  cart = [];
  currentOrderCode = "";
  document.getElementById("custName").value = "";
  document.getElementById("custPhone").value = "";
  document.getElementById("btnToPay").disabled = true;
  // Reset feedback form
  feedbackRating = 0;
  document
    .querySelectorAll(".star-btn")
    .forEach((b) => b.classList.remove("active"));
  const ft = document.getElementById("feedbackText");
  if (ft) ft.value = "";
  const fb = document.getElementById("btnKirimFeedback");
  if (fb) {
    fb.disabled = true;
    fb.style.display = "";
  }
  const fs = document.getElementById("feedbackSent");
  if (fs) fs.style.display = "none";
  const fw = document.getElementById("feedbackWrap");
  if (fw) fw.style.display = "";
  buildMenuGrid();
  clearScreenState();
  goScreen(1);
}
window.resetOrder = resetOrder;

// ===== KRITIK & SARAN =====
let feedbackRating = 0;

function setRating(val) {
  feedbackRating = val;
  document.querySelectorAll(".star-btn").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.star) <= val);
  });
  const btn = document.getElementById("btnKirimFeedback");
  if (btn) btn.disabled = false;
}
window.setRating = setRating;

async function kirimFeedback() {
  const text = document.getElementById("feedbackText").value.trim();
  if (feedbackRating === 0) return;
  const orderCode =
    document.getElementById("orderCodeDisplay").textContent || "-";
  const now = new Date();

  await push(ref(db, "feedback"), {
    rating: feedbackRating,
    pesan: text || "",
    orderCode,
    waktu: now.toTimeString().slice(0, 5),
    tanggal: now.toLocaleDateString("id-ID"),
  });

  // Hide form, show thank you
  document.getElementById("btnKirimFeedback").style.display = "none";
  document.getElementById("feedbackText").style.display = "none";
  document.getElementById("starRow").style.pointerEvents = "none";
  document.getElementById("feedbackSent").style.display = "block";
}
window.kirimFeedback = kirimFeedback;

// ===== ADMIN: RENDER FEEDBACK =====
function renderFeedbackAdmin() {
  const el = document.getElementById("feedbackListAdmin");
  const avgEl = document.getElementById("feedbackAvgLabel");
  if (!el) return;

  const list = appData.feedbackList || [];
  if (list.length === 0) {
    el.innerHTML = '<div class="no-orders">💬 Belum ada feedback masuk.</div>';
    if (avgEl) avgEl.textContent = "";
    return;
  }

  // Average rating
  const avg = (
    list.reduce((s, f) => s + (f.rating || 0), 0) / list.length
  ).toFixed(1);
  if (avgEl)
    avgEl.textContent = `⭐ Rata-rata: ${avg} / 5  ·  ${list.length} ulasan`;

  // Update badge
  const badge = document.getElementById("badgeFeedback");
  if (badge) {
    if (list.length > 0) {
      badge.textContent = list.length;
      badge.classList.remove("hidden");
    } else badge.classList.add("hidden");
  }

  el.innerHTML =
    `<div class="feedback-grid">` +
    [...list]
      .reverse()
      .map((f) => {
        const stars =
          "⭐".repeat(f.rating || 0) + "☆".repeat(5 - (f.rating || 0));
        return `
<div class="fb-card">
  <div class="fb-card-top">
    <span class="fb-stars">${stars}</span>
    <div style="display: flex; align-items: center; gap: 8px;">
      <span class="fb-meta">${f.tanggal || ""} ${f.waktu || ""}</span>
      <button class="fb-delete-btn" onclick="deleteFeedback('${
        f.key
      }')" title="Hapus feedback">🗑</button>
    </div>
  </div>
  <div class="fb-order">📋 ${f.orderCode || "-"}</div>
  ${
    f.pesan
      ? `<div class="fb-pesan">"${f.pesan}"</div>`
      : `<div class="fb-empty-msg">Tidak ada pesan</div>`
  }
</div>`;
      })
      .join("") +
    "</div>";
}

// ===== DELETE FEEDBACK =====
async function deleteFeedback(key) {
  if (!confirm("Apakah Anda yakin ingin menghapus feedback ini?")) return;
  try {
    await remove(ref(db, `/feedback/${key}`));
    showToast("Feedback berhasil dihapus");
    // Re-render will happen via realtime listener
  } catch (error) {
    console.error("Error deleting feedback:", error);
    showToast("Gagal menghapus feedback");
  }
}
window.deleteFeedback = deleteFeedback;

// ===== ADMIN LOGIN =====
const ADMIN_ROLES = [
  {
    user: "ceo",
    pass: "pesensoma",
    role: "CEO",
    label: "Chief Executive Officer",
  },
  {
    user: "cfo",
    pass: "pesensoma",
    role: "CFO",
    label: "Chief Financial Officer",
  },
  {
    user: "coo",
    pass: "pesensoma",
    role: "COO",
    label: "Chief Operating Officer",
  },
  {
    user: "cmo",
    pass: "pesensoma",
    role: "CMO",
    label: "Chief Marketing Officer",
  },
];

function doLogin() {
  const u = document.getElementById("loginUser").value.trim().toLowerCase();
  const p = document.getElementById("loginPass").value;
  const found = ADMIN_ROLES.find((r) => r.user === u && r.pass === p);
  if (found) {
    sessionStorage.setItem("adminLoggedIn", "1");
    sessionStorage.setItem("adminUsername", found.role);
    sessionStorage.setItem("adminLabel", found.label);
    document.getElementById("loginErr").classList.remove("show");
    showPage("pageAdmin");
    const roleEl = document.getElementById("adminRoleLabel");
    if (roleEl) roleEl.textContent = found.label;
    initAdmin();
    window.location.hash = "#admin";
  } else {
    document.getElementById("loginErr").classList.add("show");
    document.getElementById("loginPass").value = "";
    document.getElementById("loginPass").focus();
  }
}
window.doLogin = doLogin;

function doLogout() {
  sessionStorage.removeItem("adminLoggedIn");
  window.location.hash = "";
  showPage("pageCust");
  buildMenuGrid();
  startCustomerListener();
}
window.doLogout = doLogout;

// ===== ADMIN INIT =====
function initAdmin() {
  // Restore role label
  const savedLabel = sessionStorage.getItem("adminLabel");
  const savedRole = sessionStorage.getItem("adminUsername");
  const roleEl = document.getElementById("adminRoleLabel");
  if (roleEl && savedLabel) roleEl.textContent = savedLabel;

  // Show role badge in nav
  const existingBadge = document.getElementById("navRoleBadge");
  if (!existingBadge && savedRole) {
    const badge = document.createElement("span");
    badge.id = "navRoleBadge";
    badge.textContent = savedRole;
    badge.style.cssText =
      "background:rgba(255,255,255,0.15);color:var(--b1);padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;";
    const navRight = document.querySelector(".nav-right");
    if (navRight) navRight.insertBefore(badge, navRight.firstChild);
  }

  loadData().then(() => {
    const now = new Date();
    document.getElementById("navDate").textContent = now.toLocaleDateString(
      "id-ID",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    );
    renderStats();
    renderPendingOrders();
    renderStockTable();
    renderOrders();
  });

  // Realtime listener untuk admin
  listenRealtimeChanges(() => {
    if (sessionStorage.getItem("adminLoggedIn")) {
      renderStats();
      renderPendingOrders();
      renderOrders();
      renderStockTable();
      // refresh feedback badge live
      const badge = document.getElementById("badgeFeedback");
      if (badge && appData.feedbackList.length > 0) {
        badge.textContent = appData.feedbackList.length;
        badge.classList.remove("hidden");
      }
    }
  });
}

function renderStats() {
  // Filter out canceled orders for stats display
  const validOrders = appData.orders.filter(
    (o) => (o.status || "menunggu") !== "batal"
  );
  const totalCups = validOrders.reduce(
    (a, o) => a + o.items.reduce((b, i) => b + i.qty, 0),
    0
  );
  const pendingCount = appData.pendingOrders.filter((o) => !o.confirmed).length;
  // Use appData.revenue which should already reflect canceled orders, or recalculate
  const accurateRevenue = validOrders.reduce((s, o) => s + (o.total || 0), 0);
  document.getElementById("statRevenue").textContent = fmt(accurateRevenue);
  document.getElementById("statBuyers").textContent = validOrders.length;
  document.getElementById("statCups").textContent = totalCups;
  const statPendingEl = document.getElementById("statPending");
  if (statPendingEl) statPendingEl.textContent = pendingCount;
}

// ===== RENDER PENDING ORDERS =====
function renderPendingOrders() {
  const pending = appData.pendingOrders.filter((o) => !o.confirmed);

  // Update badge
  const badge = document.getElementById("badgePesananAktif");
  if (badge) {
    if (pending.length > 0) {
      badge.textContent = pending.length;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  const makeHTML = () => {
    if (pending.length === 0) {
      return '<div class="no-orders">Tidak ada pesanan menunggu</div>';
    }
    return pending
      .map(
        (o) => `
      <div class="order-item">
        <div class="order-top">
          <span class="order-code-tag">${escapeHtml(o.code)}</span>
          <span class="order-time">${escapeHtml(o.time)}</span>
        </div>
        <div class="order-detail"><strong>${escapeHtml(
          o.name
        )}</strong> · ${escapeHtml(o.phone)}</div>
        <div class="order-detail" style="margin-top:4px;">
          ${o.items
            .map(
              (i) =>
                `${escapeHtml(i.menuName)} ×${i.qty} (${escapeHtml(
                  i.sugar
                )}, ${escapeHtml(i.temp)})`
            )
            .join(" + ")}
        </div>
        ${
          o.items.some((i) => i.notes)
            ? `<div class="order-detail" style="font-style:italic;margin-top:2px;">📝 ${o.items
                .filter((i) => i.notes)
                .map((i) => escapeHtml(i.notes))
                .join(", ")}</div>`
            : ""
        }
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">
          <span class="order-pay-badge ${
            o.pay === "qris" ? "pay-qris" : "pay-cash"
          }">${o.pay === "qris" ? "📱 QRIS" : "💵 Tunai"}</span>
          <div class="order-total">${fmt(o.total)}</div>
        </div>
        <button class="btn-confirm-order" data-key="${
          o.firebaseKey
        }">✓ Konfirmasi Pesanan</button>
      </div>
    `
      )
      .join("");
  };

  const html = makeHTML();
  ["pendingOrdersList", "pendingOrdersList2"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = html;
      el.querySelectorAll(".btn-confirm-order").forEach((btn) => {
        btn.addEventListener("click", function () {
          const key = this.dataset.key;
          if (key) confirmOrder(key);
        });
      });
    }
  });
}

// ===== CONFIRM ORDER (FIREBASE) =====
async function confirmOrder(firebaseKey) {
  await loadData();
  const order = appData.pendingOrders.find(
    (o) => o.firebaseKey === firebaseKey
  );
  if (!order) {
    showToast("Pesanan tidak ditemukan!");
    return;
  }
  if (order.confirmed) {
    showToast("Sudah dikonfirmasi.");
    return;
  }

  // Check stock availability
  for (const item of order.items) {
    const available = appData.stock[item.menuId] ?? 0;
    if (available < item.qty) {
      showToast(`Stok ${item.menuName} tidak cukup! Tersedia: ${available}`);
      return;
    }
  }

  // Update stock using transaction for concurrency safety
  const stockRef = ref(db, "stock");
  await runTransaction(stockRef, (currentStock) => {
    if (!currentStock) currentStock = {};
    for (const item of order.items) {
      const available = currentStock[item.menuId] ?? 0;
      if (available < item.qty) return; // Abort transaction
      currentStock[item.menuId] = Math.max(0, available - item.qty);
    }
    return currentStock;
  });

  // Update revenue using transaction
  const revenueRef = ref(db, "revenue");
  await runTransaction(revenueRef, (currentRevenue) => {
    return (currentRevenue || 0) + order.total;
  });

  const updates = {};
  updates[`pendingOrders/${firebaseKey}/confirmed`] = true;

  const now2 = new Date();
  const dateStr = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now2.getDate()).padStart(2, "0")}`;
  // Tambah ke confirmed orders
  const confirmedRef = push(ref(db, "orders"));
  updates[`orders/${confirmedRef.key}`] = {
    code: order.code,
    time: order.time,
    dateStr: dateStr,
    name: order.name,
    phone: order.phone,
    items: order.items,
    total: order.total,
    pay: order.pay,
    adminRole: sessionStorage.getItem("adminUsername") || "Admin",
  };

  await update(ref(db), updates);
  showToast(`Pesanan ${order.code} berhasil dikonfirmasi! ✓`);
}

// ===== STOCK TABLE =====
function renderStockTable() {
  const tbody = document.getElementById("stockTableBody");
  tbody.innerHTML = "";
  MENUS.forEach((m) => {
    const stock = appData.stock[m.id] ?? 0;
    const indClass = stock > 5 ? "ind-ok" : stock > 0 ? "ind-low" : "ind-out";
    const indText =
      stock > 5 ? "✓ Aman" : stock > 0 ? "⚠ Hampir Habis" : "✗ Habis";
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td>
          <div class="menu-info">
            <img src="${m.produk}" alt="${
      m.name
    }" class="menu-produk-sm" onerror="this.src='https://via.placeholder.com/40?text=☕'">
            <div><div class="menu-nm">${m.name}</div><div class="menu-pr">${fmt(
      m.price
    )}</div></div>
          </div>
        </td>
        <td style="color:var(--b6);font-weight:500;font-size:14px;">${fmt(
          m.price
        )}</td>
        <td><input class="stock-input" type="number" min="0" max="999" value="${stock}" id="si_${
      m.id
    }" onchange="liveStockStatus(${m.id})"></td>
        <td><span class="stock-indicator ${indClass}" id="sind_${
      m.id
    }">${indText}</span></td>
      `;
    tbody.appendChild(tr);
  });
}

function liveStockStatus(id) {
  const val = parseInt(document.getElementById("si_" + id).value) || 0;
  const el = document.getElementById("sind_" + id);
  if (val > 5) {
    el.className = "stock-indicator ind-ok";
    el.textContent = "✓ Aman";
  } else if (val > 0) {
    el.className = "stock-indicator ind-low";
    el.textContent = "⚠ Hampir Habis";
  } else {
    el.className = "stock-indicator ind-out";
    el.textContent = "✗ Habis";
  }
}
window.liveStockStatus = liveStockStatus;

async function saveStock() {
  const newStock = {};
  MENUS.forEach((m) => {
    const inp = document.getElementById("si_" + m.id);
    if (inp) newStock[m.id] = Math.max(0, parseInt(inp.value) || 0);
  });
  await set(ref(db, "stock"), newStock);
  showToast("Stok berhasil disimpan ✓");
}
window.saveStock = saveStock;

// ===== CONFIRMED ORDERS =====
let riwayatFilter = "semua";

function setRiwayatFilter(filter, btn) {
  riwayatFilter = filter;
  document
    .querySelectorAll(".riwayat-filter-btn")
    .forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  renderOrders();
}
window.setRiwayatFilter = setRiwayatFilter;

function renderOrders() {
  const el = document.getElementById("ordersList");
  if (!el) return;

  let orders = [...appData.orders].reverse();

  // Apply filter
  if (riwayatFilter !== "semua") {
    orders = orders.filter((o) => (o.status || "menunggu") === riwayatFilter);
  }

  if (orders.length === 0) {
    el.innerHTML =
      '<div class="no-orders">📋 Tidak ada pesanan ditemukan</div>';
    return;
  }

  const adminRole = sessionStorage.getItem("adminUsername") || "Admin";

  el.innerHTML =
    `<div class="riwayat-kanban">` +
    orders
      .map((o) => {
        const status = o.status || "menunggu";
        const statusLabel =
          {
            menunggu: "MENUNGGU",
            siap: "SIAP DISAJIKAN",
            selesai: "SELESAI",
            batal: "DIBATAL",
          }[status] || "MENUNGGU";
        const statusClass =
          {
            menunggu: "status-menunggu",
            siap: "status-siap",
            selesai: "status-selesai",
            batal: "status-batal",
          }[status] || "status-menunggu";
        const table = o.table || o.phone || "Takeaway";

        // Action buttons based on status
        let actionHTML = "";
        if (status === "menunggu") {
          actionHTML = `
              <button class="rw-btn rw-btn-siap" onclick="updateOrderStatus('${o.firebaseKey}', 'siap')">🔔 Pesanan Siap</button>
              <button class="rw-btn rw-btn-cancel" onclick="cancelOrder('${o.firebaseKey}')">✕ Batal</button>`;
        } else if (status === "siap") {
          actionHTML = `
              <button class="rw-btn rw-btn-selesai" onclick="updateOrderStatus('${o.firebaseKey}', 'selesai')">✅ Selesaikan</button>
              <button class="rw-btn rw-btn-cancel" onclick="cancelOrder('${o.firebaseKey}')">✕ Batal</button>`;
        } else {
          actionHTML = `<button class="rw-btn rw-btn-disabled" style="grid-column:1/-1;" disabled>${
            status === "batal" ? "❌ Pesanan Dibatalkan" : "✅ Pesanan Selesai"
          }</button>`;
        }

        return `
<div class="rw-card" id="rwcard-${o.firebaseKey}">
  <div class="rw-card-top">
    <span class="rw-card-code">${escapeHtml(o.code || "-")}</span>
    <span class="rw-status-badge ${statusClass}">${statusLabel}</span>
  </div>
  <div class="rw-card-datetime">🕐 ${
    o.dateStr ? o.dateStr.replace(/-/g, "/") : ""
  } ${o.time || ""}</div>
  <div class="rw-card-customer">${escapeHtml(o.name || "-")}</div>
  <div class="rw-card-meta">
    <span>👤 ${escapeHtml(table)}</span>
    ${
      o.konfirmasiOleh
        ? `<span>· ✓ Dikonfirmasi oleh ${escapeHtml(o.konfirmasiOleh)}</span>`
        : ""
    }
    ${
      o.selesaiOleh
        ? `<span class="selesai-by">· Diselesaikan oleh ${escapeHtml(
            o.selesaiOleh
          )}</span>`
        : ""
    }
  </div>
  <div class="rw-divider"></div>
  ${
    o.qrisCode
      ? `<div style="font-size:10px;color:var(--b4);padding:4px 0;">📱 QRIS: ${
          o.pay === "qris" ? "Scan untuk pembayaran" : "Tunai"
        }</div>`
      : ""
  }
  ${o.items
    .map(
      (i) => `
    <div class="rw-item-row">
      <span>${i.qty}x ${escapeHtml(i.menuName)}</span>
      <span>${fmt((i.price || 0) * i.qty)}</span>
    </div>
    ${
      i.notes
        ? `<div class="rw-item-notes">📝 ${escapeHtml(i.notes)}</div>`
        : ""
    }
  `
    )
    .join("")}
  <div class="rw-total-row">
    <span class="rw-total-label">Total</span>
    <span class="rw-total-val">${fmt(o.total || 0)}</span>
  </div>
  <div class="rw-actions">${actionHTML}</div>
</div>`;
      })
      .join("") +
    `</div>`;
}

// ===== UPDATE ORDER STATUS =====
async function updateOrderStatus(firebaseKey, newStatus) {
  if (!firebaseKey) return;

  // Require admin confirmation for important status changes
  let confirmMsg = "";
  if (newStatus === "siap") {
    confirmMsg = "Konfirmasi pesanan ini sudah siap disajikan?";
  } else if (newStatus === "selesai") {
    confirmMsg =
      "Konfirmasi pesanan ini sudah diselesaikan dan diterima customer?";
  }

  if (confirmMsg && !confirm(confirmMsg)) return;

  const adminRole = sessionStorage.getItem("adminUsername") || "Admin";
  const updates = {};
  updates[`orders/${firebaseKey}/status`] = newStatus;
  if (newStatus === "siap") {
    updates[`orders/${firebaseKey}/konfirmasiOleh`] = adminRole;
  }
  if (newStatus === "selesai") {
    updates[`orders/${firebaseKey}/selesaiOleh`] = adminRole;
  }
  await update(ref(db), updates);
  const label =
    newStatus === "siap"
      ? "Pesanan dikonfirmasi dan siap disajikan ✓"
      : "Pesanan selesai ✓";
  showToast(label);
}
window.updateOrderStatus = updateOrderStatus;

// ===== CANCEL ORDER =====
async function cancelOrder(firebaseKey) {
  if (!firebaseKey) return;
  if (!confirm("Batalkan pesanan ini?")) return;
  const adminRole = sessionStorage.getItem("adminUsername") || "Admin";

  // Find the order to restore stock
  const order = appData.orders.find((o) => o.firebaseKey === firebaseKey);
  const updates = {};
  updates[`orders/${firebaseKey}/status`] = "batal";
  updates[`orders/${firebaseKey}/batalOleh`] = adminRole;

  // Restore revenue
  if (order) {
    updates["revenue"] = Math.max(
      0,
      (appData.revenue || 0) - (order.total || 0)
    );
    // Restore stock
    const newStock = { ...appData.stock };
    order.items.forEach((i) => {
      newStock[i.menuId] = (newStock[i.menuId] ?? 0) + i.qty;
    });
    updates["stock"] = newStock;
  }

  await update(ref(db), updates);
  showToast("Pesanan berhasil dibatalkan");
}
window.cancelOrder = cancelOrder;

// ===== RESET DAY =====
async function resetDay() {
  if (!confirm("Reset semua data hari ini? Stok tidak akan berubah.")) return;
  await set(ref(db, "orders"), null);
  await set(ref(db, "pendingOrders"), null);
  await set(ref(db, "revenue"), 0);
  showToast("Data hari ini berhasil direset");
}
window.resetDay = resetDay;

// ===== DOWNLOAD CSV =====
function downloadCSV() {
  if (appData.orders.length === 0) {
    showToast("Tidak ada pesanan untuk diunduh");
    return;
  }
  let csv =
    "No,Nama Barang,Jumlah Barang,Harga Barang,Metode Pembayaran,Kode Pesanan,Waktu\n";
  appData.orders.forEach((order, index) => {
    order.items.forEach((item, itemIdx) => {
      csv +=
        [
          itemIdx === 0 ? index + 1 : "",
          item.menuName,
          item.qty,
          item.price,
          itemIdx === 0 ? (order.pay === "qris" ? "QRIS" : "Tunai") : "",
          itemIdx === 0 ? order.code : "",
          itemIdx === 0 ? order.time : "",
        ].join(",") + "\n";
    });
  });
  const blob = new Blob(["\ufeff" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `riwayat_pesanan_${
    new Date().toISOString().split("T")[0]
  }.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Berhasil mengunduh CSV");
}
window.downloadCSV = downloadCSV;

// ===== ADMIN TAB SWITCHING =====
function switchAdminTab(tabId) {
  document
    .querySelectorAll(".admin-tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".admin-panel")
    .forEach((p) => p.classList.remove("active"));
  document.getElementById("tab-" + tabId).classList.add("active");
  document.getElementById("panel-" + tabId).classList.add("active");
  if (tabId === "pesanan-baru") {
    buildPbMenuGrid();
    renderKasirCart();
  }
  if (tabId === "rekap-harian") {
    initRekapHarian();
  }
  if (tabId === "laporan-finance") {
    renderLaporanFinance();
  }
  if (tabId === "pesanan-aktif") {
    renderPendingOrders();
  }
  if (tabId === "riwayat") {
    renderOrders();
  }
  if (tabId === "feedback") {
    renderFeedbackAdmin();
  }
}
window.switchAdminTab = switchAdminTab;

// ===== PESANAN BARU (KASIR) =====
let kasirCart = [];
let kasirPay = "qris";
let kasirMeja = "Takeaway";
let kasirQrisCode = "";

function buildPbMenuGrid() {
  const g = document.getElementById("pbMenuGrid");
  if (!g) return;
  g.innerHTML = MENUS.map((m) => {
    const stock = appData.stock[m.id] ?? 0;
    const isOut = stock === 0;
    return `
<div class="pb-menu-card${isOut ? " out" : ""}" onclick="kasirAddItem(${m.id})">
  <img class="pb-menu-img" src="${m.produk}" alt="${
      m.name
    }" onerror="this.style.display='none'">
  <div class="pb-menu-name">${m.name}</div>
  <div class="pb-menu-price">${fmt(m.price)}</div>
  ${
    isOut
      ? '<div style="font-size:10px;color:var(--red);margin-top:3px;">Habis</div>'
      : `<div style="font-size:10px;color:var(--green);margin-top:3px;">Stok: ${stock}</div>`
  }
</div>`;
  }).join("");
}

function kasirAddItem(menuId) {
  const m = MENUS.find((x) => x.id === menuId);
  if (!m) return;
  const existing = kasirCart.find((x) => x.menuId === menuId);
  if (existing) {
    existing.qty++;
  } else {
    kasirCart.push({
      menuId,
      menuName: m.name,
      price: m.price,
      qty: 1,
      produk: m.produk,
    });
  }
  renderKasirCart();
  showToast(`${m.name} ditambahkan ✓`);
}
window.kasirAddItem = kasirAddItem;

function kasirChangeQty(menuId, delta) {
  const idx = kasirCart.findIndex((x) => x.menuId === menuId);
  if (idx === -1) return;
  kasirCart[idx].qty += delta;
  if (kasirCart[idx].qty <= 0) kasirCart.splice(idx, 1);
  renderKasirCart();
}
window.kasirChangeQty = kasirChangeQty;

function renderKasirCart() {
  const body = document.getElementById("kasirCartBody");
  const countEl = document.getElementById("kasirCartCount");
  const totalEl = document.getElementById("kasirTotalDisplay");
  const btn = document.getElementById("btnProsesPesanan");
  const qrisRow = document.getElementById("qrisDisplayRow");

  if (!body) return;

  const total = kasirCart.reduce((s, i) => s + i.price * i.qty, 0);
  const totalQty = kasirCart.reduce((s, i) => s + i.qty, 0);

  if (countEl) countEl.textContent = `${totalQty} item`;
  if (totalEl) totalEl.textContent = fmt(total);
  if (btn) btn.disabled = kasirCart.length === 0;

  // Show QRIS display if QRIS payment method selected
  if (qrisRow) {
    qrisRow.style.display = kasirPay === "qris" ? "block" : "none";
  }

  if (kasirCart.length === 0) {
    body.innerHTML = '<div class="kasir-empty">Belum ada item dipilih</div>';
    return;
  }

  body.innerHTML = kasirCart
    .map(
      (item) => `
<div class="kasir-cart-item">
  <div class="kasir-item-name">${item.menuName}</div>
  <div class="kasir-item-price">${fmt(item.price)}</div>
  <button class="kasir-qty-btn" onclick="kasirChangeQty(${
    item.menuId
  },-1)">−</button>
  <span class="kasir-qty">${item.qty}</span>
  <button class="kasir-qty-btn" onclick="kasirChangeQty(${
    item.menuId
  },1)">+</button>
</div>`
    )
    .join("");

  // Refresh QRIS display if QRIS is selected
  if (kasirPay === "qris") {
    generateQrisDisplay();
  }
}

function kasirSetPay(type) {
  kasirPay = type;
  document
    .getElementById("kpayQris")
    .classList.toggle("active", type === "qris");
  document
    .getElementById("kpayCash")
    .classList.toggle("active", type === "cash");

  // Show/hide QRIS display
  const qrisRow = document.getElementById("qrisDisplayRow");
  if (qrisRow) {
    qrisRow.style.display = type === "qris" ? "block" : "none";
    if (type === "qris") {
      generateQrisDisplay();
    }
  }
}
window.kasirSetPay = kasirSetPay;

// Generate QRIS code display
function generateQrisDisplay() {
  const total = kasirCart.reduce((s, i) => s + i.price * i.qty, 0);
  const qrisCodeImg = document.getElementById("qrisCodeDisplay");
  const qrisAmountEl = document.getElementById("qrisAmountDisplay");

  if (qrisAmountEl) qrisAmountEl.textContent = fmt(total);

  if (qrisCodeImg) {
    qrisCodeImg.src = qrisUrl;
  }

  kasirQrisCode = qrisUrl;
}
window.generateQrisDisplay = generateQrisDisplay;

function pilihMeja(meja, btn) {
  kasirMeja = meja;
  document
    .querySelectorAll(".meja-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
}
window.pilihMeja = pilihMeja;

async function prosesPesananKasir() {
  if (kasirCart.length === 0) return;
  const nama =
    (document.getElementById("kasirNama").value || "").trim() || "Walk-in";
  const total = kasirCart.reduce((s, i) => s + i.price * i.qty, 0);
  const now2 = new Date();
  const timeStr = now2.toTimeString().slice(0, 5);
  const dateStr = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now2.getDate()).padStart(2, "0")}`;
  const adminRole = sessionStorage.getItem("adminUsername") || "Admin";

  // Generate order code
  const code = "SK-" + String(Math.floor(Math.random() * 9000) + 1000);

  // Check stock availability
  await loadData();
  for (const item of kasirCart) {
    const available = appData.stock[item.menuId] ?? 0;
    if (available < item.qty) {
      showToast(`Stok ${item.menuName} tidak cukup! Tersedia: ${available}`);
      return;
    }
  }

  // Update stock using transaction for concurrency safety
  const stockRef = ref(db, "stock");
  await runTransaction(stockRef, (currentStock) => {
    if (!currentStock) currentStock = {};
    for (const item of kasirCart) {
      const available = currentStock[item.menuId] ?? 0;
      if (available < item.qty) return; // Abort transaction
      currentStock[item.menuId] = Math.max(0, available - item.qty);
    }
    return currentStock;
  });

  // Update revenue using transaction
  const revenueRef = ref(db, "revenue");
  await runTransaction(revenueRef, (currentRevenue) => {
    return (currentRevenue || 0) + total;
  });

  const updates = {};

  const orderRef = push(ref(db, "orders"));
  updates[`orders/${orderRef.key}`] = {
    code,
    time: timeStr,
    dateStr,
    name: nama,
    phone: "-",
    table: kasirMeja,
    items: kasirCart.map((i) => ({
      menuId: i.menuId,
      menuName: i.menuName,
      price: i.price,
      qty: i.qty,
      sugar: "Normal",
      temp: "Normal",
      notes: "",
    })),
    total,
    pay: kasirPay,
    qrisCode: kasirPay === "qris" ? kasirQrisCode : null,
    adminRole,
    source: "kasir",
    status: "menunggu",
    createdAt: new Date().toISOString(),
  };

  await update(ref(db), updates);

  showToast(
    `Pesanan ${code} berhasil diproses! Menunggu konfirmasi admin... ⏳`
  );

  // Reset kasir cart
  kasirCart = [];
  kasirPay = "qris";
  kasirMeja = "Takeaway";
  kasirQrisCode = "";
  document.getElementById("kasirNama").value = "";
  document.getElementById("kpayQris").classList.add("active");
  document.getElementById("kpayCash").classList.remove("active");
  const qrisRow = document.getElementById("qrisDisplayRow");
  if (qrisRow) qrisRow.style.display = "block";
  renderKasirCart();
  buildPbMenuGrid();
}
window.prosesPesananKasir = prosesPesananKasir;

// ===== REKAP HARIAN =====
function initRekapHarian() {
  const sel = document.getElementById("rekapMonthSelect");
  const now = new Date();
  // Populate last 12 months
  sel.innerHTML = "";
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    const label = d.toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = label;
    sel.appendChild(opt);
  }
  renderRekapHarian();
}

function renderRekapHarian() {
  const sel = document.getElementById("rekapMonthSelect");
  const [year, month] = sel.value.split("-").map(Number);
  const el = document.getElementById("rekapHarianList");

  // Group confirmed orders by date
  // orders have a `time` field (HH:MM string). We derive date from appData context.
  // Since Firebase doesn't store full date in orders, we use a timestamp approach:
  // We'll use rekapData stored in Firebase (daily snapshots) or fall back to grouping today's orders.
  // For robustness: group by date key stored in each order (if present), else treat all as today.
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Build day groups from appData.orders (add dateStr if not present, assume today)
  const grouped = {};
  appData.orders.forEach((o) => {
    const dateKey = o.dateStr || todayStr;
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(o);
  });

  // Also include rekapArchive from appData if present
  if (appData.rekapArchive) {
    Object.entries(appData.rekapArchive).forEach(([dateKey, dayData]) => {
      if (!grouped[dateKey]) grouped[dateKey] = dayData.orders || [];
    });
  }

  // Filter by selected month
  const filtered = Object.entries(grouped)
    .filter(([dateKey]) => {
      const [y, m] = dateKey.split("-").map(Number);
      return y === year && m === month;
    })
    .sort((a, b) => b[0].localeCompare(a[0]));

  if (filtered.length === 0) {
    el.innerHTML =
      '<div class="rekap-empty">📭 Tidak ada data untuk bulan ini.</div>';
    return;
  }

  el.innerHTML = filtered
    .map(([dateKey, orders], idx) => {
      const dateObj = new Date(dateKey + "T00:00:00");
      const dateLabel = dateObj.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      // Filter out canceled orders for accurate revenue calculation
      const validDayOrders = orders.filter(
        (o) => (o.status || "menunggu") !== "batal"
      );
      const totalRev = validDayOrders.reduce((s, o) => s + (o.total || 0), 0);
      const totalItems = validDayOrders.reduce(
        (s, o) => s + o.items.reduce((b, i) => b + i.qty, 0),
        0
      );
      const avgPerOrder = validDayOrders.length
        ? Math.round(totalRev / validDayOrders.length)
        : 0;

      // Menu terlaris
      const menuCount = {};
      validDayOrders.forEach((o) =>
        o.items.forEach((i) => {
          menuCount[i.menuName] = (menuCount[i.menuName] || 0) + i.qty;
        })
      );
      const menuSorted = Object.entries(menuCount).sort((a, b) => b[1] - a[1]);

      const isOpen = idx === 0;

      return `
<div class="rekap-day-card ${isOpen ? "open" : ""}" id="rdc-${dateKey}">
  <div class="rekap-day-header" onclick="toggleRekapDay('rdc-${dateKey}')">
    <div class="rekap-day-title">
      <span>📅</span> ${dateLabel}
    </div>
    <div class="rekap-day-meta">
      <span>${validDayOrders.length} pesanan</span>
      <span>💰</span>
      <span class="revenue-val">${fmt(totalRev)}</span>
      <span class="rekap-chevron">▼</span>
    </div>
  </div>
  <div class="rekap-day-body">
    <!-- Stat boxes -->
    <div class="rekap-stat-row">
      <div class="rekap-stat-box">
        <div class="rekap-stat-label">Total Pendapatan</div>
        <div class="rekap-stat-value" style="font-size:16px;color:var(--b6)">${fmt(
          totalRev
        )}</div>
      </div>
      <div class="rekap-stat-box">
        <div class="rekap-stat-label">Jumlah Pesanan</div>
        <div class="rekap-stat-value">${validDayOrders.length}</div>
      </div>
      <div class="rekap-stat-box">
        <div class="rekap-stat-label">Rata-rata/Pesanan</div>
        <div class="rekap-stat-value" style="font-size:16px;color:var(--b6)">${fmt(
          avgPerOrder
        )}</div>
      </div>
      <div class="rekap-stat-box">
        <div class="rekap-stat-label">Item Terjual</div>
        <div class="rekap-stat-value">${totalItems}</div>
      </div>
    </div>

    <!-- Menu Terlaris -->
    <div class="rekap-sub-title">Menu Terlaris</div>
    <table class="rekap-table" style="margin-bottom:20px;">
      <thead><tr><th>Menu</th><th>QTY Terjual</th></tr></thead>
      <tbody>
        ${menuSorted
          .map(
            ([name, qty]) => `
          <tr><td>${name}</td><td>${qty}</td></tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    <!-- Detail Pesanan -->
    <div class="rekap-sub-title">Detail Pesanan</div>
    <table class="rekap-table">
      <thead>
        <tr>
          <th>No. Pesanan</th>
          <th>Waktu</th>
          <th>Pelanggan</th>
          <th>Meja</th>
          <th>Total</th>
          <th>Admin</th>
        </tr>
      </thead>
      <tbody>
        ${validDayOrders
          .map(
            (o) => `
          <tr>
            <td><span class="order-no-link">${o.code || "-"}</span></td>
            <td>${o.time || "-"}</td>
            <td>${o.name || "-"}</td>
            <td>${o.table || o.phone || "Takeaway"}</td>
            <td class="rekap-order-total">${fmt(o.total || 0)}</td>
            <td>${o.adminRole || "Admin"}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  </div>
</div>`;
    })
    .join("");
}
window.renderRekapHarian = renderRekapHarian;

function toggleRekapDay(id) {
  const card = document.getElementById(id);
  card.classList.toggle("open");
}
window.toggleRekapDay = toggleRekapDay;

function cetakRekap() {
  window.print();
}
window.cetakRekap = cetakRekap;

// ===== LAPORAN FINANCE =====
function renderLaporanFinance() {
  const el = document.getElementById("laporanFinanceContent");
  if (!el) return;

  // Filter out canceled orders
  const orders = appData.orders.filter(
    (o) => (o.status || "menunggu") !== "batal"
  );
  if (orders.length === 0) {
    el.innerHTML =
      '<div class="no-orders">💰 Belum ada transaksi hari ini.</div>';
    return;
  }

  const totalRev = orders.reduce((s, o) => s + (o.total || 0), 0);
  const qrisOrders = orders.filter((o) => o.pay === "qris");
  const cashOrders = orders.filter((o) => o.pay !== "qris");
  const qrisTotal = qrisOrders.reduce((s, o) => s + (o.total || 0), 0);
  const cashTotal = cashOrders.reduce((s, o) => s + (o.total || 0), 0);

  const menuRev = {};
  orders.forEach((o) =>
    o.items.forEach((i) => {
      if (!menuRev[i.menuName]) menuRev[i.menuName] = { qty: 0, rev: 0 };
      menuRev[i.menuName].qty += i.qty;
      menuRev[i.menuName].rev += (i.price || 0) * i.qty;
    })
  );
  const menuRevSorted = Object.entries(menuRev).sort(
    (a, b) => b[1].rev - a[1].rev
  );

  el.innerHTML = `
<div class="rekap-stat-row" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px;">
  <div class="rekap-stat-box">
    <div class="rekap-stat-label">Total Pendapatan</div>
    <div class="rekap-stat-value" style="font-size:16px;color:var(--b6)">${fmt(
      totalRev
    )}</div>
  </div>
  <div class="rekap-stat-box">
    <div class="rekap-stat-label">Via QRIS</div>
    <div class="rekap-stat-value" style="font-size:15px;color:#1565c0">${fmt(
      qrisTotal
    )}</div>
    <div style="font-size:11px;color:var(--b4);margin-top:3px">${
      qrisOrders.length
    } transaksi</div>
  </div>
  <div class="rekap-stat-box">
    <div class="rekap-stat-label">Via Tunai</div>
    <div class="rekap-stat-value" style="font-size:15px;color:var(--green)">${fmt(
      cashTotal
    )}</div>
    <div style="font-size:11px;color:var(--b4);margin-top:3px">${
      cashOrders.length
    } transaksi</div>
  </div>
</div>

<div class="rekap-sub-title">Breakdown Pendapatan per Menu</div>
<table class="rekap-table">
  <thead>
    <tr><th>Menu</th><th>QTY</th><th>Pendapatan</th><th>Kontribusi</th></tr>
  </thead>
  <tbody>
    ${menuRevSorted
      .map(
        ([name, data]) => `
      <tr>
        <td>${name}</td>
        <td>${data.qty}</td>
        <td class="rekap-order-total">${fmt(data.rev)}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="flex:1;background:var(--b1);border-radius:4px;height:6px;overflow:hidden;">
              <div style="height:100%;background:var(--b5);width:${
                totalRev ? Math.round((data.rev / totalRev) * 100) : 0
              }%"></div>
            </div>
            <span style="font-size:11px;color:var(--b5);min-width:30px">${
              totalRev ? Math.round((data.rev / totalRev) * 100) : 0
            }%</span>
          </div>
        </td>
      </tr>
    `
      )
      .join("")}
  </tbody>
</table>

<div class="rekap-sub-title">Riwayat Transaksi Lengkap</div>
<table class="rekap-table">
  <thead>
    <tr><th>Kode</th><th>Waktu</th><th>Pelanggan</th><th>Item</th><th>Bayar</th><th>Total</th></tr>
  </thead>
  <tbody>
    ${[...orders]
      .reverse()
      .map(
        (o) => `
      <tr>
        <td><span class="order-no-link">${o.code || "-"}</span></td>
        <td>${o.time || "-"}</td>
        <td>${o.name || "-"}</td>
        <td style="font-size:11px;color:var(--b5)">${o.items
          .map((i) => `${i.menuName} ×${i.qty}`)
          .join(", ")}</td>
        <td><span class="order-pay-badge ${
          o.pay === "qris" ? "pay-qris" : "pay-cash"
        }">${o.pay === "qris" ? "QRIS" : "Tunai"}</span></td>
        <td class="rekap-order-total">${fmt(o.total)}</td>
      </tr>
    `
      )
      .join("")}
  </tbody>
</table>`;
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3000);
}

/* ===== MOBILE ADMIN SIDEBAR TOGGLE ===== */
function toggleAdminSidebar() {
  const adminTabs = document.querySelector(".admin-tabs");
  if (adminTabs) {
    adminTabs.classList.toggle("open");
  }
}

function closeAdminSidebar() {
  const adminTabs = document.querySelector(".admin-tabs");
  if (adminTabs) {
    adminTabs.classList.remove("open");
  }
}

window.toggleAdminSidebar = toggleAdminSidebar;
window.closeAdminSidebar = closeAdminSidebar;
window.initAdmin = initAdmin;

// Close sidebar when a tab is clicked
document.addEventListener("DOMContentLoaded", () => {
  const adminTabs = document.querySelectorAll(".admin-tab");
  adminTabs.forEach((tab) => {
    tab.addEventListener("click", closeAdminSidebar);
  });
});