import React, { useState, useEffect } from "react";
import {
  ShoppingBag, Search, User, Menu, X, Plus, Minus, ArrowRight, ArrowLeft,
  Heart, Check, LogOut, Pencil, Trash2, Upload, Lock, Star,
  Phone, Mail, MapPin, Clock, Settings, Send,
  SlidersHorizontal, Package,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import {
  fetchProducts, createProduct, updateProductDb, deleteProductDb,
  fetchSettings, saveSettingsDb,
  createOrder, fetchOrders, setOrderStatus,
  signUp, signIn, signOut, fetchProfile, saveProfileState,
  uploadProductImage,
} from "./lib/api";

/* ================================================================== *
 *  ARSÈNE — интернет-магазин одежды
 *  Данные (товары, заказы, аккаунты, настройки) хранятся в Supabase.
 *  Права администратора выдаются полем role='admin' в таблице profiles.
 * ================================================================== */

const BRAND = "ARSÈNE";
const ORDER_STATUSES = ["Обработка", "Подтверждён", "Собирается", "В доставке", "Доставлен", "Отменён"];
const DELIVERY_LABELS = { courier: "Курьер", cdek: "СДЭК", pickup: "Самовывоз" };
const PAY_LABELS = { sbp: "СБП онлайн", cash: "При получении" };
const arr = (v) => (Array.isArray(v) ? v : []);
const normalizeProduct = (p = {}) => ({
  ...p,
  id: p.id,
  name: p.name || "Без названия",
  brand: p.brand || "",
  cat: p.cat || "Женское",
  type: p.type || "shirt",
  price: Number(p.price) || 0,
  oldPrice: Number(p.oldPrice) || 0,
  material: p.material || "",
  care: p.care || "",
  desc: p.desc || "",
  sizes: arr(p.sizes).length ? arr(p.sizes) : ["Единый"],
  colors: arr(p.colors).length ? arr(p.colors) : ["#8f8677"],
  images: arr(p.images),
  stock: Number.isFinite(Number(p.stock)) ? Number(p.stock) : 0,
  delivery: p.delivery || "1–3 дня по России",
});

const DEFAULT_SETTINGS = {
  brand: BRAND,
  announce: "Бесплатная доставка от 5 000 ₽ · Возврат 30 дней",
  heroEyebrow: "Коллекция 2026",
  heroTitle1: "Тихая",
  heroTitleEm: "роскошь",
  heroSub: "Базовый гардероб из натуральных тканей. Сделано, чтобы носить годами.",
  philosophyTitle: "Философия",
  philosophyText:
    "Мы работаем с небольшими ателье в Европе и выпускаем ограниченные партии. Никаких распродаж ради распродаж — только то, что хочется оставить. Меньше вещей, но каждая на своём месте.",
  phone: "+7 900 000-00-00",
  email: "hello@arsene.store",
  address: "Москва, ул. Примерная, 1",
  hours: "Пн–Вс, 10:00–22:00",
  instagram: "https://instagram.com/arsene",
  telegram: "https://t.me/arsene_store",
  logo: "",                            // аватарка магазина (ссылка на файл)
  managerTg: "@pinxty",                // @username менеджера для заказов
  sbpPhone: "+7 911 098 51 28",        // номер для перевода по СБП
  sbpBank: "Т-Банк",
  sbpName: "Роберт В.",
};

const CATEGORIES = ["Всё", "Женское", "Мужское", "Обувь", "Аксессуары"];
const SHOP_CATS = ["Женское", "Мужское", "Обувь", "Аксессуары"];
const TAGS = ["", "Новинка", "Sale"];
const TYPES = [
  { v: "coat", l: "Пальто / жакет" }, { v: "shirt", l: "Рубашка" }, { v: "sweater", l: "Свитер / худи" },
  { v: "dress", l: "Платье" }, { v: "skirt", l: "Юбка" }, { v: "pants", l: "Брюки / джинсы" },
  { v: "sneakers", l: "Кроссовки" }, { v: "boots", l: "Ботинки" }, { v: "shoes", l: "Туфли" },
  { v: "bag", l: "Сумка" }, { v: "belt", l: "Ремень" }, { v: "scarf", l: "Платок" },
];
const typeLabel = (v) => TYPES.find((t) => t.v === v)?.l || v;
const uniq = (arr) => [...new Set(arr.filter(Boolean))];

/* Категории с разными размерными сетками */
const ONE_SIZE_CAT = "Аксессуары";        // только «Единый»
const SHOE_CAT = "Обувь";                 // обувные размеры
const CLOTHES_SIZE_SUGG = ["XS", "S", "M", "L", "XL", "XXL"];
const SHOE_SIZE_SUGG = ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"];
const sizeSuggestions = (cat) => (cat === SHOE_CAT ? SHOE_SIZE_SUGG : CLOTHES_SIZE_SUGG);

/* Цена в рублях: 18900 -> «18 900 ₽» */
const money = (n) => `${(Number(n) || 0).toLocaleString("ru-RU")} ₽`;

/* -------- Валидация форм заказа -------- */
const digitsOnly = (s) => (s || "").replace(/\D/g, "");
function formatPhone(raw) {
  let d = digitsOnly(raw);
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (!d.startsWith("7")) d = "7" + d;
  d = d.slice(0, 11);
  const p = d.slice(1);
  let out = "+7";
  if (p.length) out += " " + p.slice(0, 3);
  if (p.length > 3) out += " " + p.slice(3, 6);
  if (p.length > 6) out += "-" + p.slice(6, 8);
  if (p.length > 8) out += "-" + p.slice(8, 10);
  return out;
}
const isValidPhone = (s) => digitsOnly(s).length === 11;
// имя и фамилия: минимум два слова, только буквы/дефис, каждое слово ≥2 букв, есть гласная
const isValidName = (s) => {
  const parts = (s || "").trim().split(/\s+/);
  if (parts.length < 2) return false;
  return parts.every((w) => /^[A-Za-zА-Яа-яЁё]{2,}(-[A-Za-zА-Яа-яЁё]{2,})?$/.test(w) && /[AEIOUaeiouАЕЁИОУЫЭЮЯаеёиоуыэюя]/.test(w));
};
const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || "");
// ткани из строки состава: «80% шерсть, 20% полиамид» → [шерсть, полиамид]
const fabricsOf = (material) => (material || "").split(",").map((x) => x.replace(/[\d%]/g, "").trim().toLowerCase()).filter(Boolean);
const capit = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// извлекаем username из «@name», «name» или «https://t.me/name»
const tgUsername = (v) => (v || "").trim().replace(/^https?:\/\/t\.me\//i, "").replace(/^@/, "").replace(/\/.*$/, "").trim();


/* -------- Фото товара: сжатие 900×900 и загрузка в Supabase Storage -------- */
const processImage = (file) => uploadProductImage(file);

/* -------- Галерея: реальные фото ИЛИ плейсхолдеры-силуэты -------- */
function getGallery(p) {
  if (p.images && p.images.length) return p.images.map((src, i) => ({ key: "img" + i, label: "Фото " + (i + 1), src }));
  return [
    { key: "front", label: "Спереди", bg: "#eeeae2", mode: "front" },
    { key: "styled", label: "В образе", bg: "#ddd6c8", mode: "styled" },
    { key: "back", label: "Сзади", bg: "#e6e0d5", mode: "back" },
    { key: "detail", label: "Деталь", bg: "#f1eee8", mode: "detail" },
    { key: "fabric", label: "Ткань", bg: (p.colors && p.colors[0]) || "#8f8677", mode: "fabric" },
  ];
}

/* ================================================================== */

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("Ошибка интерфейса:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", background: "#f3f1ec", color: "#1a1613", fontFamily: "system-ui, sans-serif", padding: "48px 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>Что-то пошло не так</h1>
          <p style={{ color: "#6b655c", maxWidth: 560, margin: "0 auto 18px", lineHeight: 1.6 }}>
            Страница не смогла отрисоваться. Скопируйте текст ошибки ниже — он подскажет причину.
          </p>
          <pre style={{ display: "inline-block", textAlign: "left", background: "#faf9f6", border: "1px solid #e3ddd2", borderRadius: 6, padding: "14px 16px", maxWidth: "100%", overflow: "auto", fontSize: 13, color: "#7c2634" }}>
            {String(this.state.error?.stack || this.state.error)}
          </pre>
          <div style={{ marginTop: 22 }}>
            <button onClick={() => window.location.reload()} style={{ background: "#1a1613", color: "#f3f1ec", border: "none", padding: "13px 24px", borderRadius: 2, cursor: "pointer", letterSpacing: ".06em", textTransform: "uppercase", fontSize: 13 }}>
              Перезагрузить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return <ErrorBoundary><Store /></ErrorBoundary>;
}

function Store() {
  const [products, setProducts] = useState(null);
  const [view, setView] = useState("catalog");
  const [selectedId, setSelectedId] = useState(null);
  const [activeCat, setActiveCat] = useState("Всё");
  const [menuOpen, setMenuOpen] = useState(false);
  const [cart, setCart] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState([]);
  const [settings, setSettings] = useState(null);
  const [user, setUser] = useState(null);      // текущий покупатель {id,email,name,phone}
  const [orders, setOrders] = useState([]);
  const [lastOrderId, setLastOrderId] = useState(null);
  const [booting, setBooting] = useState(true);
  const [fatal, setFatal] = useState("");

  /* --- Первичная загрузка: товары + настройки (публичные данные) --- */
  useEffect(() => {
    (async () => {
      try {
        const [prods, sets] = await Promise.all([fetchProducts(), fetchSettings()]);
        setProducts(prods.map(normalizeProduct));
        setSettings({ ...DEFAULT_SETTINGS, ...sets });
      } catch (e) {
        console.error(e);
        setFatal("Не удалось подключиться к базе. Проверьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в файле .env, а также что SQL-схема применена.");
        setProducts([]); setSettings(DEFAULT_SETTINGS);
      } finally { setBooting(false); }
    })();
  }, []);

  /* --- Сессия пользователя: подхватываем при старте и при входе/выходе --- */
  useEffect(() => {
    const applySession = async (session) => {
      if (!session?.user) { setUser(null); setIsAdmin(false); setCart([]); setFavorites([]); setOrders([]); return; }
      try {
        const prof = await fetchProfile(session.user.id);
        setUser({ id: session.user.id, email: session.user.email, name: prof.name || "", phone: prof.phone || "" });
        setIsAdmin(prof.role === "admin");
        setCart(prof.cart || []);
        setFavorites(prof.favorites || []);
        setOrders(await fetchOrders());
      } catch (e) { console.error("Профиль не загружен:", e); }
    };
    supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => applySession(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  /* --- Сохраняем корзину и избранное в профиль --- */
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => saveProfileState(user.id, { cart, favorites }), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [cart, favorites]);

  // блокируем прокрутку под меню и закрываем его по Esc
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  const byId = (id) => (products || []).find((p) => p.id === id);
  const go = (v) => { setView(v); window.scrollTo({ top: 0 }); };
  const openProduct = (id) => { setSelectedId(id); go("product"); };
  const openCatalog = (cat) => { if (cat) setActiveCat(cat); go("catalog"); };

  // нельзя заказать больше, чем есть в наличии
  const addToCart = (id, size) => {
    const p = byId(id);
    const max = p?.stock ?? 0;
    const key = `${id}-${size}`;
    const current = cart.find((i) => i.key === key)?.qty ?? 0;
    if (current >= max) return { ok: false, error: max === 0 ? "Товара нет в наличии" : `Больше нет в наличии — доступно ${max} шт` };
    setCart((c) => {
      const found = c.find((i) => i.key === key);
      if (found) return c.map((i) => (i.key === key ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { key, id, size, qty: 1 }];
    });
    return { ok: true };
  };
  const changeQty = (key, d) => setCart((c) => c.map((i) => {
    if (i.key !== key) return i;
    const max = byId(i.id)?.stock ?? 0;
    return { ...i, qty: Math.min(i.qty + d, max) };
  }).filter((i) => i.qty > 0));
  const removeItem = (key) => setCart((c) => c.filter((i) => i.key !== key));
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const toggleFav = (id) => setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  const openSearch = () => { openCatalog("Всё"); setTimeout(() => document.getElementById("search-input")?.focus(), 40); };

  /* --- Заказ: пишем в базу (остатки уменьшит триггер), обновляем список --- */
  const placeOrder = async (order) => {
    try {
      await createOrder(order, user?.id);
      setLastOrderId(order.id);
      setCart([]);
      const [prods, ords] = await Promise.all([fetchProducts(), user ? fetchOrders() : Promise.resolve([])]);
      setProducts(prods.map(normalizeProduct));
      setOrders(ords);
      go("success");
    } catch (e) {
      console.error(e);
      alert("Не удалось сохранить заказ: " + (e.message || "ошибка сети"));
    }
  };
  const updateOrderStatus = async (id, status) => {
    setOrders((o) => o.map((x) => (x.id === id ? { ...x, status } : x))); // мгновенный отклик
    try { await setOrderStatus(id, status); } catch (e) { console.error(e); setOrders(await fetchOrders()); }
  };

  /* --- Админ-операции над товарами --- */
  const addProduct = async (data) => {
    try { const p = await createProduct(data); setProducts((l) => [...l, normalizeProduct(p)]); }
    catch (e) { alert("Не удалось добавить товар: " + e.message); }
  };
  const updateProduct = async (id, data) => {
    try { const p = await updateProductDb(id, data); setProducts((l) => l.map((x) => (x.id === id ? normalizeProduct(p) : x))); }
    catch (e) { alert("Не удалось сохранить товар: " + e.message); }
  };
  const deleteProduct = async (id) => {
    try { await deleteProductDb(id); setProducts((l) => l.filter((p) => p.id !== id)); setCart((c) => c.filter((i) => i.id !== id)); }
    catch (e) { alert("Не удалось удалить товар: " + e.message); }
  };
  const updateSettings = async (data) => {
    const s = { ...settings, ...data };
    setSettings(s);
    try { await saveSettingsDb(s); } catch (e) { alert("Не удалось сохранить настройки: " + e.message); }
  };
  const addType = (label) => { const l = (label || "").trim(); if (!l) return; updateSettings({ extraTypes: uniq([...(settings.extraTypes || []), l]) }); };

  /* --- Авторизация через Supabase --- */
  const login = async (id, pass) => {
    const r = await signIn((id || "").trim().toLowerCase(), pass);
    if (r.ok) go("catalog");
    return r;
  };
  const register = async ({ name, email, phone, pass }) => {
    const r = await signUp({ name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), pass });
    if (r.ok) go("catalog");
    return r;
  };
  const logout = async () => { await signOut(); setIsAdmin(false); setUser(null); setCart([]); setFavorites([]); setOrders([]); go("catalog"); };

  if (booting || !products || !settings) {
    return <div className="store"><style>{css}</style><div className="boot">Загрузка магазина…</div></div>;
  }
  if (fatal) {
    return <div className="store"><style>{css}</style><div className="boot boot-error">{fatal}</div></div>;
  }

  const accountTarget = isAdmin ? "admin" : user ? "account" : "login";

  return (
    <div className="store">
      <style>{css}</style>
      <div className="announce">{settings.announce}</div>

      <Header
        brand={settings.brand} logo={settings.logo} cartCount={cartCount} favCount={favorites.length} isAdmin={isAdmin} user={user}
        onLogo={() => openCatalog("Всё")} onCart={() => go("cart")} onNav={openCatalog} onSearch={openSearch}
        onFavs={() => go("favorites")} onMenu={() => setMenuOpen(true)}
        onAccount={() => go(accountTarget)} onLogout={logout}
      />

      {menuOpen && (
        <div className="mobile-menu">
          <button className="icon-btn menu-close" onClick={() => setMenuOpen(false)} aria-label="Закрыть"><X size={22} /></button>
          {CATEGORIES.map((c) => <button key={c} className="mobile-link" onClick={() => { openCatalog(c); setMenuOpen(false); }}>{c}</button>)}
          <button className="mobile-link" onClick={() => { go("favorites"); setMenuOpen(false); }}>Избранное</button>
          <button className="mobile-link" onClick={() => { go("info"); setMenuOpen(false); }}>О магазине</button>
          <button className="mobile-link" onClick={() => { go(accountTarget); setMenuOpen(false); }}>{user ? "Мой аккаунт" : isAdmin ? "Админ-панель" : "Вход"}</button>
        </div>
      )}

      {view === "catalog" && (
        <CatalogView settings={settings} products={products} activeCat={activeCat} setActiveCat={setActiveCat}
          onOpen={openProduct} onInfo={() => go("info")} query={query} setQuery={setQuery} favorites={favorites} onFav={toggleFav} />
      )}
      {view === "product" && selectedId && byId(selectedId) && (
        <ProductView key={selectedId} product={byId(selectedId)} onBack={() => openCatalog()} onAdd={addToCart}
          inCart={cart.filter((i) => i.id === selectedId).reduce((s, i) => s + i.qty, 0)}
          onGoCart={() => go("cart")} isFav={favorites.includes(selectedId)} onFav={() => toggleFav(selectedId)} />
      )}
      {view === "favorites" && (
        <FavoritesView products={products.filter((p) => favorites.includes(p.id))} onOpen={openProduct} onFav={toggleFav} onShop={() => openCatalog("Всё")} />
      )}
      {view === "info" && <InfoView settings={settings} onShop={() => openCatalog("Всё")} />}
      {view === "cart" && (
        <CartView cart={cart} byId={byId} onChangeQty={changeQty} onRemove={removeItem}
          onShop={() => openCatalog("Всё")} onOpen={openProduct} onCheckout={() => go("checkout")} />
      )}
      {view === "checkout" && (
        <CheckoutView cart={cart} byId={byId} user={user} settings={settings} onBack={() => go("cart")} onPlace={placeOrder} />
      )}
      {view === "success" && <SuccessView brand={settings.brand} orderId={lastOrderId} canTrack={!!user} onOrders={() => go("orders")} onShop={() => openCatalog("Всё")} />}
      {view === "orders" && (
        user
          ? <OrdersView orders={orders.filter((o) => o.userId === user.id)} onShop={() => openCatalog("Всё")} onBack={() => go("account")} />
          : <AuthView onLogin={login} onRegister={register} onBack={() => openCatalog("Всё")} />
      )}
      {view === "account" && (
        user
          ? <AccountView user={user} favCount={favorites.length} cartCount={cartCount} ordersCount={orders.filter((o) => o.userId === user.id).length}
              onFavs={() => go("favorites")} onCart={() => go("cart")} onOrders={() => go("orders")} onLogout={logout} onShop={() => openCatalog("Всё")} />
          : <AuthView brand={settings.brand} onLogin={login} onRegister={register} onBack={() => openCatalog("Всё")} />
      )}
      {view === "login" && <AuthView brand={settings.brand} onLogin={login} onRegister={register} onBack={() => openCatalog("Всё")} />}
      {view === "admin" && (
        isAdmin
          ? <AdminView products={products} settings={settings} orders={orders} onAdd={addProduct} onUpdate={updateProduct} onDelete={deleteProduct}
              onLogout={logout} onPreview={openProduct} onSaveSettings={updateSettings} onAddType={addType} onOrderStatus={updateOrderStatus} />
          : <AuthView brand={settings.brand} onLogin={login} onRegister={register} onBack={() => openCatalog("Всё")} />
      )}

      <Footer settings={settings} onNav={openCatalog} onInfo={() => go("info")} onAdmin={() => go(accountTarget)} isAdmin={isAdmin} user={user} />
    </div>
  );
}

/* -------------------------------- Шапка -------------------------------- */
function Header({ brand, cartCount, favCount, isAdmin, onLogo, onCart, onNav, onMenu, onAccount, onLogout, onSearch, onFavs }) {
  return (
    <header className="header">
      <button className="icon-btn only-mobile" aria-label="Меню" onClick={onMenu}><Menu size={20} /></button>
      <nav className="nav only-desktop">
        {SHOP_CATS.map((c) => <button key={c} className="nav-link" onClick={() => onNav(c)}>{c}</button>)}
        <button className="nav-link nav-sale" onClick={() => onNav("Всё")}>Sale</button>
        {isAdmin && <button className="nav-link nav-admin" onClick={onAccount}>Админ</button>}
      </nav>
      <button className="wordmark" onClick={onLogo}>
        {logo ? <img className="brand-logo" src={logo} alt={brand} /> : brand}
      </button>
      <div className="header-actions">
        <button className="icon-btn only-desktop" aria-label="Поиск" onClick={onSearch}><Search size={19} /></button>
        <button className="icon-btn cart-btn only-desktop" aria-label="Избранное" onClick={onFavs}>
          <Heart size={19} />
          {favCount > 0 && <span className="cart-badge">{favCount}</span>}
        </button>
        <button className="icon-btn only-desktop" aria-label={isAdmin ? "Админ-панель" : "Войти"} onClick={onAccount}>
          {isAdmin ? <Lock size={18} /> : <User size={19} />}
        </button>
        {isAdmin && <button className="icon-btn only-desktop" aria-label="Выйти" onClick={onLogout}><LogOut size={18} /></button>}
        <button className="icon-btn cart-btn" aria-label="Корзина" onClick={onCart}>
          <ShoppingBag size={19} />
          {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
        </button>
      </div>
    </header>
  );
}

/* ------------------------------ Каталог ------------------------------ */
const EMPTY_FILTERS = { types: [], brands: [], sizes: [], colors: [], fabrics: [], min: "", max: "" };

function CatalogView({ settings, products, activeCat, setActiveCat, onOpen, onInfo, query, setQuery, favorites, onFav }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [open, setOpen] = useState(false);

  // при смене раздела фильтры сбрасываем: у обуви и одежды разные размеры/бренды
  useEffect(() => { setFilters(EMPTY_FILTERS); }, [activeCat]);

  // варианты фильтров считаем только по товарам текущего раздела
  const scoped = activeCat === "Всё" ? products : products.filter((p) => p.cat === activeCat);
  const sortSizes = (a, b) => (isNaN(a) || isNaN(b) ? 0 : Number(a) - Number(b));
  const opts = {
    types: uniq(scoped.map((p) => p.type)),
    brands: uniq(scoped.map((p) => p.brand)),
    sizes: uniq(scoped.flatMap((p) => p.sizes || [])).sort(sortSizes),
    colors: uniq(scoped.flatMap((p) => p.colors || [])),
    fabrics: uniq(scoped.flatMap((p) => fabricsOf(p.material))).sort(),
  };

  const toggle = (key, val) => setFilters((f) => ({
    ...f, [key]: f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val],
  }));
  const activeCount = filters.types.length + filters.brands.length + filters.sizes.length +
    filters.colors.length + filters.fabrics.length + (filters.min ? 1 : 0) + (filters.max ? 1 : 0);

  const q = query.trim().toLowerCase();
  const list = products.filter((p) => {
    if (activeCat !== "Всё" && p.cat !== activeCat) return false;
    if (q && !`${p.name} ${p.brand || ""} ${p.cat} ${p.material || ""} ${typeLabel(p.type)}`.toLowerCase().includes(q)) return false;
    if (filters.types.length && !filters.types.includes(p.type)) return false;
    if (filters.brands.length && !filters.brands.includes(p.brand)) return false;
    if (filters.sizes.length && !(p.sizes || []).some((s) => filters.sizes.includes(s))) return false;
    if (filters.colors.length && !(p.colors || []).some((c) => filters.colors.includes(c))) return false;
    if (filters.fabrics.length && !fabricsOf(p.material).some((fb) => filters.fabrics.includes(fb))) return false;
    if (filters.min && p.price < Number(filters.min)) return false;
    if (filters.max && p.price > Number(filters.max)) return false;
    return true;
  });

  return (
    <>
      <section className="hero">
        <div className="hero-eyebrow">{settings.heroEyebrow}</div>
        <h1 className="hero-title">{settings.heroTitle1}<br /><em>{settings.heroTitleEm}</em></h1>
        <p className="hero-sub">{settings.heroSub}</p>
        <button className="btn-primary" onClick={() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" })}>
          Смотреть каталог <ArrowRight size={16} />
        </button>
      </section>

      <section className="catalog" id="catalog">
        <div className="catalog-head">
          <h2 className="section-title">Каталог</h2>
          <div className="catalog-tools">
            <div className="search-box">
              <Search size={16} />
              <input id="search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по каталогу" />
              {query && <button className="search-clear" onClick={() => setQuery("")} aria-label="Очистить"><X size={15} /></button>}
            </div>
            <button className={`filter-toggle ${open ? "on" : ""}`} onClick={() => setOpen((o) => !o)}>
              <SlidersHorizontal size={15} /> Фильтры{activeCount > 0 && <span className="fcount">{activeCount}</span>}
            </button>
            <div className="filters">
              {CATEGORIES.map((c) => <button key={c} className={`chip ${activeCat === c ? "chip-active" : ""}`} onClick={() => setActiveCat(c)}>{c}</button>)}
            </div>
          </div>
        </div>

        {open && (
          <div className="filter-panel">
            <FilterGroup title="Цена, ₽">
              <div className="price-row">
                <input type="number" placeholder="от" value={filters.min} onChange={(e) => setFilters((f) => ({ ...f, min: e.target.value }))} />
                <span>—</span>
                <input type="number" placeholder="до" value={filters.max} onChange={(e) => setFilters((f) => ({ ...f, max: e.target.value }))} />
              </div>
            </FilterGroup>
            <FilterGroup title="Тип">
              <div className="chip-wrap">{opts.types.map((t) => (
                <button key={t} className={`fchip ${filters.types.includes(t) ? "on" : ""}`} onClick={() => toggle("types", t)}>{typeLabel(t)}</button>
              ))}</div>
            </FilterGroup>
            {opts.brands.length > 0 && (
              <FilterGroup title="Бренд">
                <div className="chip-wrap">{opts.brands.map((b) => (
                  <button key={b} className={`fchip ${filters.brands.includes(b) ? "on" : ""}`} onClick={() => toggle("brands", b)}>{b}</button>
                ))}</div>
              </FilterGroup>
            )}
            <FilterGroup title={activeCat === SHOE_CAT ? "Размер обуви" : "Размер"}>
              <div className="chip-wrap">{opts.sizes.map((s) => (
                <button key={s} className={`fchip ${filters.sizes.includes(s) ? "on" : ""}`} onClick={() => toggle("sizes", s)}>{s}</button>
              ))}</div>
            </FilterGroup>
            <FilterGroup title="Цвет">
              <div className="chip-wrap">{opts.colors.map((c) => (
                <button key={c} className={`color-dot ${filters.colors.includes(c) ? "on" : ""}`} style={{ background: c }} onClick={() => toggle("colors", c)} aria-label={c} title={c}>
                  {filters.colors.includes(c) && <Check size={12} />}
                </button>
              ))}</div>
            </FilterGroup>
            {opts.fabrics.length > 0 && (
              <FilterGroup title="Состав">
                <div className="chip-wrap">{opts.fabrics.map((m) => (
                  <button key={m} className={`fchip ${filters.fabrics.includes(m) ? "on" : ""}`} onClick={() => toggle("fabrics", m)}>{capit(m)}</button>
                ))}</div>
              </FilterGroup>
            )}
            {activeCount > 0 && <button className="link-btn" onClick={() => setFilters(EMPTY_FILTERS)}>Сбросить фильтры</button>}
          </div>
        )}

        <div className="catalog-count">{list.length} {plural(list.length, "товар", "товара", "товаров")}</div>

        {list.length === 0
          ? <p className="muted-block">{q || activeCount ? "Ничего не найдено — попробуйте изменить фильтры." : "В этой категории пока нет товаров."}</p>
          : <div className="grid">{list.map((p) => (
              <ProductCard key={p.id} p={p} onOpen={() => onOpen(p.id)} isFav={favorites.includes(p.id)} onFav={() => onFav(p.id)} />
            ))}</div>}
      </section>

      <section className="philosophy-band">
        <div className="hero-eyebrow">{settings.philosophyTitle}</div>
        <p className="philosophy-quote">{settings.philosophyText}</p>
        <button className="btn-ghost" onClick={onInfo}>Подробнее о магазине <ArrowRight size={15} /></button>
      </section>
    </>
  );
}

function FilterGroup({ title, children }) {
  return (
    <div className="filter-group">
      <div className="filter-group-title">{title}</div>
      {children}
    </div>
  );
}
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

function ProductCard({ p, onOpen, isFav, onFav }) {
  const cover = getGallery(p)[0];
  return (
    <article className="card" onClick={onOpen}>
      <div className="card-media">
        <Media p={p} img={cover} />
        {p.tag && <span className={`badge ${p.tag === "Sale" ? "badge-sale" : ""}`}>{p.tag}</span>}
        <button className={`wish ${isFav ? "wish-on" : ""}`} aria-label="В избранное"
          onClick={(e) => { e.stopPropagation(); onFav(); }}>
          <Heart size={16} fill={isFav ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="card-body">
        <div className="card-top">
          <h3 className="card-name">{p.name}</h3>
          <div className="card-price">
            {p.oldPrice > 0 && <span className="old">{money(p.oldPrice)}</span>}
            <span className={p.oldPrice > 0 ? "sale-price" : ""}>{money(p.price)}</span>
          </div>
        </div>
        <div className="swatches">{(p.colors || []).map((c, i) => <span key={i} className="swatch" style={{ background: c }} />)}</div>
      </div>
    </article>
  );
}

/* --------------------------- Страница товара --------------------------- */
function ProductView({ product: p, onBack, onAdd, onGoCart, isFav, onFav, inCart = 0 }) {
  const images = getGallery(p);
  const [active, setActive] = useState(0);
  const singleSize = p.sizes.length === 1;
  const [size, setSize] = useState(singleSize ? p.sizes[0] : null);
  const [added, setAdded] = useState(false);
  const [askSize, setAskSize] = useState(false);
  const [stockErr, setStockErr] = useState("");
  const soldOut = p.stock <= 0;
  const maxedOut = !soldOut && inCart >= p.stock;

  const doAdd = (sz) => {
    const r = onAdd(p.id, sz);
    if (r && !r.ok) { setStockErr(r.error); setTimeout(() => setStockErr(""), 2500); return; }
    setStockErr("");
    setAdded(true); setTimeout(() => setAdded(false), 1800);
  };
  const handleAdd = () => {
    if (size) doAdd(size);
    else setAskSize(true); // размер не выбран — просим выбрать
  };
  const pickInPrompt = (s) => { setSize(s); setAskSize(false); doAdd(s); };

  return (
    <section className="product">
      <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Каталог</button>
      <div className="product-grid">
        <div className="gallery">
          <div className="main-img"><Media p={p} img={images[active]} large /></div>
          <div className="thumbs">
            {images.map((img, i) => (
              <button key={img.key} className={`thumb ${i === active ? "thumb-active" : ""}`} onClick={() => setActive(i)} aria-label={img.label}>
                <Media p={p} img={img} />
              </button>
            ))}
          </div>
        </div>

        <div className="product-info">
          <div className="p-eyebrow">{p.brand || p.cat}</div>
          <h1 className="p-name">{p.name}</h1>
          <div className="p-price">
            {p.oldPrice > 0 && <span className="old">{money(p.oldPrice)}</span>}
            <span className={p.oldPrice > 0 ? "sale-price big" : "big"}>{money(p.price)}</span>
          </div>
          <p className="p-desc">{p.desc}</p>

          <div className={`avail ${p.stock <= 0 ? "avail-out" : p.stock <= 3 ? "avail-low" : "avail-in"}`}>
            {p.stock <= 0 ? "Нет в наличии" : p.stock <= 3 ? `Осталось мало — ${p.stock} шт` : "В наличии"}
          </div>

          <div className="size-block">
            <div className="size-head"><span>Размер</span>{size && <span className="size-chosen">выбран: {size}</span>}</div>
            <div className="size-row">
              {p.sizes.map((s) => <button key={s} className={`size-chip ${size === s ? "size-active" : ""}`} onClick={() => setSize(s)} disabled={singleSize}>{s}</button>)}
            </div>
          </div>

          <div className="add-row">
            <button className="btn-primary btn-block" onClick={handleAdd} disabled={soldOut || maxedOut}>
              {soldOut ? "Нет в наличии" : maxedOut ? "Всё в корзине" : added ? <><Check size={16} /> Добавлено</> : "Добавить в корзину"}
            </button>
            <button className={`fav-btn ${isFav ? "fav-on" : ""}`} onClick={onFav} aria-label="В избранное" title="В избранное">
              <Heart size={18} fill={isFav ? "currentColor" : "none"} />
            </button>
          </div>
          {stockErr && <div className="stock-err">{stockErr}</div>}
          {maxedOut && !stockErr && <div className="stock-note">В корзине уже все доступные {p.stock} шт</div>}
          {added && <button className="link-btn go-cart" onClick={onGoCart}>Перейти в корзину →</button>}

          <div className="specs">
            {p.brand && <SpecRow label="Бренд" value={p.brand} />}
            <SpecRow label="Категория" value={`${p.cat} · ${typeLabel(p.type)}`} />
            <SpecRow label="Состав" value={p.material} />
            <SpecRow label="Уход" value={p.care} />
            {p.tag && <SpecRow label="Метка" value={p.tag} />}
            <SpecRow label="Сроки доставки" value={`${p.delivery}${p.price ? " · бесплатно от 5 000 ₽" : ""}`} />
          </div>
        </div>
      </div>

      {askSize && (
        <>
          <div className="overlay" onClick={() => setAskSize(false)} />
          <div className="confirm-box size-picker" role="dialog" aria-modal="true">
            <h3 className="confirm-title">Выберите размер</h3>
            <p className="confirm-text">Чтобы добавить «{p.name}» в корзину, выберите размер.</p>
            <div className="size-row">
              {p.sizes.map((s) => <button key={s} className="size-chip" onClick={() => pickInPrompt(s)}>{s}</button>)}
            </div>
            <div className="confirm-actions"><button className="btn-ghost" onClick={() => setAskSize(false)}>Отмена</button></div>
          </div>
        </>
      )}
    </section>
  );
}
function SpecRow({ label, value }) {
  return <div className="spec-row"><span className="spec-label">{label}</span><span className="spec-value">{value || "—"}</span></div>;
}

/* --------------------------- Страница корзины --------------------------- */
function CartView({ cart, byId, onChangeQty, onRemove, onShop, onOpen, onCheckout }) {
  const items = cart.map((i) => ({ ...i, p: byId(i.id) })).filter((i) => i.p);
  const subtotal = items.reduce((s, i) => s + i.p.price * i.qty, 0);
  const shipping = subtotal === 0 || subtotal >= 5000 ? 0 : 390;
  const total = subtotal + shipping;

  if (items.length === 0) {
    return (
      <section className="cart-page">
        <h1 className="section-title">Корзина</h1>
        <div className="cart-empty"><ShoppingBag size={44} strokeWidth={1} /><p>В корзине пока пусто</p>
          <button className="btn-primary" onClick={onShop}>Перейти в каталог</button></div>
      </section>
    );
  }
  return (
    <section className="cart-page">
      <h1 className="section-title">Корзина</h1>
      <div className="cart-layout">
        <div className="cart-list">
          {items.map(({ p, ...i }) => {
            const cover = getGallery(p)[0];
            return (
              <div className="cart-row" key={i.key}>
                <button className="cart-thumb" onClick={() => onOpen(p.id)}><Media p={p} img={cover} /></button>
                <div className="cart-main">
                  <button className="cart-name" onClick={() => onOpen(p.id)}>{p.name}</button>
                  <div className="cart-meta">{p.cat} · Размер: {i.size}</div>
                  <div className="qty">
                    <button onClick={() => onChangeQty(i.key, -1)} aria-label="Меньше"><Minus size={14} /></button>
                    <span>{i.qty}</span>
                    <button onClick={() => onChangeQty(i.key, 1)} disabled={i.qty >= p.stock} aria-label="Больше"><Plus size={14} /></button>
                  </div>
                  {i.qty >= p.stock && <div className="cart-limit">Максимум: {p.stock} шт в наличии</div>}
                </div>
                <div className="cart-right"><div className="cart-price">{money(p.price * i.qty)}</div>
                  <button className="remove" onClick={() => onRemove(i.key)}>Убрать</button></div>
              </div>
            );
          })}
        </div>
        <aside className="summary">
          <h2 className="summary-title">Итог заказа</h2>
          <div className="sum-row"><span>Товары</span><span>{money(subtotal)}</span></div>
          <div className="sum-row"><span>Доставка</span><span>{shipping === 0 ? "Бесплатно" : money(shipping)}</span></div>
          <div className="sum-row total"><span>К оплате</span><span className="total-sum">{money(total)}</span></div>
          <button className="btn-primary btn-block" onClick={onCheckout}>Оформить заказ</button>
          <button className="btn-ghost btn-block" onClick={onShop}>Продолжить покупки</button>
          <p className="summary-note">Налоги включены. Доставка бесплатно от {money(5000)}.</p>
        </aside>
      </div>
    </section>
  );
}

/* --------------------------- Избранное --------------------------- */
function FavoritesView({ products, onOpen, onFav, onShop }) {
  return (
    <section className="catalog fav-page">
      <div className="catalog-head">
        <h2 className="section-title">Избранное <span className="count">{products.length}</span></h2>
      </div>
      {products.length === 0
        ? <div className="cart-empty"><Heart size={44} strokeWidth={1} /><p>В избранном пока пусто</p>
            <button className="btn-primary" onClick={onShop}>Перейти в каталог</button></div>
        : <div className="grid">{products.map((p) => (
            <ProductCard key={p.id} p={p} onOpen={() => onOpen(p.id)} isFav={true} onFav={() => onFav(p.id)} />
          ))}</div>}
    </section>
  );
}

/* --------------------------- Оформление --------------------------- */
function CheckoutView({ cart, byId, user, settings, onBack, onPlace }) {
  const items = cart.map((i) => ({ ...i, p: byId(i.id) })).filter((i) => i.p);
  const subtotal = items.reduce((s, i) => s + i.p.price * i.qty, 0);
  const shipping = subtotal >= 5000 ? 0 : 390;
  const total = subtotal + shipping;
  const [f, setF] = useState({
    name: user?.name || "", phone: user?.phone || "", city: "", address: "", pvz: "",
    delivery: "courier", pay: "sbp", comment: "",
  });
  const [err, setErr] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const deliveryText = () => {
    if (f.delivery === "courier") return `Курьер, ${f.city}, ${f.address}`;
    if (f.delivery === "cdek") return `СДЭК, ${f.city}, ПВЗ: ${f.pvz}`;
    return "Самовывоз";
  };

  const buildMessage = (ref) => {
    const lines = items.map(({ p, ...i }) => `• ${p.name}${p.brand ? ` (${p.brand})` : ""} — размер ${i.size}, ${i.qty} шт — ${money(p.price * i.qty)}`).join("\n");
    const payText = f.pay === "sbp"
      ? `СБП онлайн (${settings.sbpBank}, ${settings.sbpPhone}, ${settings.sbpName})`
      : "При получении";
    return `Здравствуйте! Хочу оформить заказ ${ref} в ${settings.brand}.\n\n` +
      `Товары:\n${lines}\n\n` +
      `Сумма: ${money(total)} (доставка: ${shipping === 0 ? "бесплатно" : money(shipping)})\n` +
      `Доставка: ${deliveryText()}\n` +
      `Оплата: ${payText}\n` +
      (f.comment ? `Комментарий: ${f.comment}\n` : "") +
      `\nПокупатель: ${f.name}\nТелефон: ${f.phone}`;
  };

  const submit = () => {
    if (!isValidName(f.name)) return setErr("Введите настоящие имя и фамилию (например, Владимир Андреев)");
    if (!isValidPhone(f.phone)) return setErr("Введите телефон полностью: +7 900 000-00-00");
    if (f.delivery === "courier" && !f.address.trim()) return setErr("Укажите адрес доставки");
    if (f.delivery === "cdek" && !f.pvz.trim()) return setErr("Укажите пункт выдачи СДЭК");
    setErr("");

    const ref = "AR-" + Date.now().toString().slice(-6);
    const order = {
      id: ref,
      customer: { name: f.name.trim(), phone: f.phone.trim(), email: user?.email || "" },
      delivery: { method: f.delivery, city: f.city.trim(), address: f.address.trim(), pvz: f.pvz.trim(), comment: f.comment.trim() },
      payment: { method: f.pay, card: "" },
      items: items.map(({ p, ...i }) => ({ id: p.id, name: p.name, brand: p.brand || "", size: i.size, qty: i.qty, price: p.price })),
      subtotal, shipping, total,
    };

    // формируем сообщение и открываем чат с менеджером в Telegram
    const msg = buildMessage(ref);
    const uname = tgUsername(settings.managerTg);
    const url = uname
      ? `https://t.me/${uname}?text=${encodeURIComponent(msg)}`
      : `https://t.me/share/url?url=${encodeURIComponent(settings.telegram || "https://t.me")}&text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener");

    onPlace(order);
  };

  return (
    <section className="checkout">
      <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Корзина</button>
      <h1 className="section-title">Оформление заказа</h1>
      <div className="checkout-grid">
        <div className="checkout-form">
          <div className="form-block">
            <h3 className="block-title">Контакты</h3>
            <div className="row-2">
              <Field label="Имя и фамилия"><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Владимир Андреев" /></Field>
              <Field label="Телефон"><input value={f.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} placeholder="+7 900 000-00-00" inputMode="tel" /></Field>
            </div>
          </div>

          <div className="form-block">
            <h3 className="block-title">Доставка</h3>
            <div className="seg seg-wide">
              <button className={f.delivery === "courier" ? "seg-on" : ""} onClick={() => set("delivery", "courier")}>Курьер</button>
              <button className={f.delivery === "cdek" ? "seg-on" : ""} onClick={() => set("delivery", "cdek")}>СДЭК</button>
              <button className={f.delivery === "pickup" ? "seg-on" : ""} onClick={() => set("delivery", "pickup")}>Самовывоз</button>
            </div>
            {f.delivery === "courier" && (
              <div className="row-2">
                <Field label="Город"><input value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Москва" /></Field>
                <Field label="Адрес"><input value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Улица, дом, кв." /></Field>
              </div>
            )}
            {f.delivery === "cdek" && (
              <div className="row-2">
                <Field label="Город"><input value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Москва" /></Field>
                <Field label="Пункт выдачи СДЭК"><input value={f.pvz} onChange={(e) => set("pvz", e.target.value)} placeholder="ПВЗ, адрес или код" /></Field>
              </div>
            )}
            {f.delivery === "pickup" && <p className="pickup-note">Заказ можно забрать в магазине по адресу из раздела «О магазине». Мы сообщим о готовности.</p>}
            <Field label="Комментарий (необязательно)"><textarea rows={2} value={f.comment} onChange={(e) => set("comment", e.target.value)} placeholder="Пожелания к заказу…" /></Field>
          </div>

          <div className="form-block">
            <h3 className="block-title">Оплата</h3>
            <div className="seg seg-wide">
              <button className={f.pay === "sbp" ? "seg-on" : ""} onClick={() => set("pay", "sbp")}>СБП онлайн</button>
              <button className={f.pay === "cash" ? "seg-on" : ""} onClick={() => set("pay", "cash")}>При получении</button>
            </div>
            {f.pay === "sbp" && (
              <div className="sbp-block">
                <div className="sbp-row"><span>Банк</span><b>{settings.sbpBank}</b></div>
                <div className="sbp-row"><span>Номер для перевода</span><b>{settings.sbpPhone}</b></div>
                <div className="sbp-row"><span>Получатель</span><b>{settings.sbpName}</b></div>
                <p className="sbp-note">Переведите {money(total)} по СБП на этот номер. После оформления откроется чат с менеджером в Telegram — отправьте готовое сообщение, менеджер подтвердит оплату и заказ.</p>
              </div>
            )}
          </div>
        </div>

        <aside className="summary">
          <h2 className="summary-title">Ваш заказ</h2>
          <div className="checkout-items">
            {items.map(({ p, ...i }) => (
              <div className="checkout-line" key={i.key}>
                <span className="cl-name">{p.name} <span className="cl-qty">×{i.qty}</span><br /><span className="cl-size">{i.size}</span></span>
                <span className="cl-price">{money(p.price * i.qty)}</span>
              </div>
            ))}
          </div>
          <div className="sum-row"><span>Товары</span><span>{money(subtotal)}</span></div>
          <div className="sum-row"><span>Доставка</span><span>{shipping === 0 ? "Бесплатно" : money(shipping)}</span></div>
          <div className="sum-row total"><span>К оплате</span><span className="total-sum">{money(total)}</span></div>
          {err && <div className="login-err">{err}</div>}
          <button className="btn-primary btn-block" onClick={submit}><Send size={16} /> Оформить и написать менеджеру</button>
          <p className="summary-note">По кнопке откроется Telegram с готовым сообщением о заказе.</p>
        </aside>
      </div>
    </section>
  );
}

/* --------------------------- Заказ принят --------------------------- */
function SuccessView({ brand, orderId, canTrack, onOrders, onShop }) {
  return (
    <section className="success">
      <div className="success-icon"><Check size={34} /></div>
      <h1 className="success-title">Заказ оформлен</h1>
      {orderId && <div className="success-order">Номер заказа: <b>{orderId}</b></div>}
      <p className="success-sub">Спасибо за покупку в {brand}. Заказ отправлен на подтверждение — статус можно отслеживать в личном кабинете.</p>
      <div className="success-actions">
        {canTrack && <button className="btn-primary" onClick={onOrders}>Мои заказы</button>}
        <button className={canTrack ? "btn-ghost" : "btn-primary"} onClick={onShop}>Вернуться в магазин</button>
      </div>
    </section>
  );
}

/* --------------------------- О магазине / Контакты --------------------------- */
function InfoView({ settings, onShop }) {
  const s = settings;
  const contacts = [
    s.phone && { icon: <Phone size={17} />, label: "Телефон", value: s.phone, href: `tel:${s.phone.replace(/[^\d+]/g, "")}` },
    s.email && { icon: <Mail size={17} />, label: "E-mail", value: s.email, href: `mailto:${s.email}` },
    s.address && { icon: <MapPin size={17} />, label: "Адрес", value: s.address },
    s.hours && { icon: <Clock size={17} />, label: "Часы работы", value: s.hours },
  ].filter(Boolean);
  return (
    <section className="info-page">
      <div className="info-hero">
        <div className="hero-eyebrow">{s.philosophyTitle}</div>
        <p className="info-philosophy">{s.philosophyText}</p>
      </div>

      <div className="info-contacts-wrap">
        <div className="info-contacts">
          <h2 className="info-h2">Контакты</h2>
          <div className="contact-list">
            {contacts.map((c) => (
              <div className="contact-row" key={c.label}>
                <span className="contact-icon">{c.icon}</span>
                <div>
                  <div className="contact-label">{c.label}</div>
                  {c.href ? <a className="contact-value" href={c.href}>{c.value}</a> : <div className="contact-value">{c.value}</div>}
                </div>
              </div>
            ))}
          </div>
          <div className="info-socials">
            {s.telegram && <a href={s.telegram} target="_blank" rel="noreferrer" className="tg-pill"><Send size={16} /><span>Telegram-канал</span></a>}
            {s.instagram && <a href={s.instagram} target="_blank" rel="noreferrer" className="ig-pill">Instagram</a>}
          </div>
          <button className="btn-primary info-shop" onClick={onShop}>Перейти в каталог <ArrowRight size={16} /></button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- Вход / Регистрация ------------------------------- */
function AuthView({ onLogin, onRegister, onBack, brand }) {
  const [mode, setMode] = useState("login"); // login | register
  const [f, setF] = useState({ id: "", name: "", email: "", phone: "", pass: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => { setF((s) => ({ ...s, [k]: v })); setErr(""); };

  const doLogin = async () => {
    if (!f.id.trim() || !f.pass) return setErr("Введите почту и пароль");
    setBusy(true);
    const r = await onLogin(f.id.trim(), f.pass);
    setBusy(false);
    if (!r.ok) setErr(r.error || "Ошибка входа");
  };
  const doRegister = async () => {
    if (!isValidName(f.name)) return setErr("Введите настоящие имя и фамилию");
    if (!isValidEmail(f.email)) return setErr("Введите корректный e-mail");
    if (!isValidPhone(f.phone)) return setErr("Введите телефон полностью");
    if (f.pass.length < 6) return setErr("Пароль минимум 6 символов");
    setBusy(true);
    const r = await onRegister({ name: f.name, email: f.email, phone: f.phone, pass: f.pass });
    setBusy(false);
    if (!r.ok) setErr(r.error || "Не удалось зарегистрироваться");
  };

  return (
    <section className="login-page">
      <div className="login-card">
        <div className="login-icon"><User size={22} /></div>
        <div className="auth-tabs">
          <button className={mode === "login" ? "on" : ""} onClick={() => { setMode("login"); setErr(""); }}>Вход</button>
          <button className={mode === "register" ? "on" : ""} onClick={() => { setMode("register"); setErr(""); }}>Регистрация</button>
        </div>

        {mode === "login" ? (
          <>
            <label className="field"><span>E-mail</span>
              <input value={f.id} onChange={(e) => set("id", e.target.value)} autoComplete="username" placeholder="you@mail.ru" /></label>
            <label className="field"><span>Пароль</span>
              <input type="password" value={f.pass} onChange={(e) => set("pass", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doLogin()} /></label>
            {err && <div className="login-err">{err}</div>}
            <button className="btn-primary btn-block" onClick={doLogin} disabled={busy}>{busy ? "Вход…" : "Войти"}</button>
          </>
        ) : (
          <>
            <label className="field"><span>Имя и фамилия</span>
              <input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Владимир Андреев" /></label>
            <label className="field"><span>E-mail</span>
              <input value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="you@mail.ru" /></label>
            <label className="field"><span>Телефон</span>
              <input value={f.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} placeholder="+7 900 000-00-00" inputMode="tel" /></label>
            <label className="field"><span>Пароль</span>
              <input type="password" value={f.pass} onChange={(e) => set("pass", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doRegister()} /></label>
            {err && <div className="login-err">{err}</div>}
            <button className="btn-primary btn-block" onClick={doRegister} disabled={busy}>{busy ? "Создаём…" : "Создать аккаунт"}</button>
          </>
        )}
        <button className="link-btn" onClick={onBack}>← Вернуться в магазин</button>
      </div>
    </section>
  );
}

/* ------------------------------- Личный кабинет ------------------------------- */
function AccountView({ user, favCount, cartCount, ordersCount, onFavs, onCart, onOrders, onLogout, onShop }) {
  return (
    <section className="account-page">
      <div className="account-card">
        <div className="account-avatar">{(user.name || "?").trim().charAt(0).toUpperCase()}</div>
        <h1 className="account-name">{user.name}</h1>
        <div className="account-meta">{user.email}{user.phone ? ` · ${user.phone}` : ""}</div>

        <div className="account-tiles">
          <button className="account-tile" onClick={onOrders}><Package size={18} /><span>Заказы</span><b>{ordersCount}</b></button>
          <button className="account-tile" onClick={onFavs}><Heart size={18} /><span>Избранное</span><b>{favCount}</b></button>
          <button className="account-tile" onClick={onCart}><ShoppingBag size={18} /><span>Корзина</span><b>{cartCount}</b></button>
        </div>

        <p className="account-note">Заказы, корзина и избранное сохраняются в вашем аккаунте и подтянутся при следующем входе.</p>
        <button className="btn-primary btn-block" onClick={onShop}>За покупками</button>
        <button className="link-btn" onClick={onLogout}>Выйти из аккаунта</button>
      </div>
    </section>
  );
}

/* ------------------------------- Мои заказы ------------------------------- */
const statusClass = (s) => s === "Доставлен" ? "st-done" : s === "Отменён" ? "st-cancel" : s === "Обработка" ? "st-wait" : "st-progress";

function OrdersView({ orders, onShop, onBack }) {
  return (
    <section className="orders-page">
      <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> В кабинет</button>
      <h1 className="section-title">Мои заказы</h1>
      {orders.length === 0
        ? <div className="cart-empty"><Package size={44} strokeWidth={1} /><p>Заказов пока нет</p>
            <button className="btn-primary" onClick={onShop}>Перейти в каталог</button></div>
        : <div className="orders-list">
            {orders.map((o) => (
              <div className="order-card" key={o.id}>
                <div className="order-head">
                  <div>
                    <div className="order-id">Заказ {o.id}</div>
                    <div className="order-date">{new Date(o.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</div>
                  </div>
                  <span className={`status-badge ${statusClass(o.status)}`}>{o.status}</span>
                </div>
                <div className="order-items">
                  {o.items.map((i, idx) => (
                    <div className="order-item" key={idx}><span>{i.name} · {i.size} · ×{i.qty}</span><span>{money(i.price * i.qty)}</span></div>
                  ))}
                </div>
                <div className="order-foot">
                  <span className="order-delivery">{DELIVERY_LABELS[o.delivery.method] || o.delivery.method} · {PAY_LABELS[o.payment.method]}</span>
                  <span className="order-total">{money(o.total)}</span>
                </div>
              </div>
            ))}
          </div>}
    </section>
  );
}

/* --------------------------- Админ-панель --------------------------- */
function AdminView({ products, settings, orders, onAdd, onUpdate, onDelete, onLogout, onPreview, onSaveSettings, onAddType, onOrderStatus }) {
  const [editing, setEditing] = useState(null); // null | "new" | product
  const [tab, setTab] = useState("products"); // products | orders | settings
  const [pending, setPending] = useState(null); // {type:'delete',product} | {type:'reset'}

  if (editing) {
    return (
      <ProductForm
        initial={editing === "new" ? null : editing}
        products={products}
        extraTypes={settings.extraTypes || []}
        onAddType={onAddType}
        onCancel={() => setEditing(null)}
        onSave={(data) => { editing === "new" ? onAdd(data) : onUpdate(editing.id, data); setEditing(null); }}
      />
    );
  }
  if (tab === "settings") {
    return <SettingsForm settings={settings} onSave={(d) => { onSaveSettings(d); setTab("products"); }} onCancel={() => setTab("products")} />;
  }

  const confirmPending = () => {
    if (pending?.type === "delete") onDelete(pending.product.id);
    setPending(null);
  };
  const pendingOrders = orders.filter((o) => o.status === "Обработка").length;

  return (
    <section className="admin">
      <div className="admin-tabbar">
        <div className="admin-tabs">
          <button className={tab === "products" ? "atab on" : "atab"} onClick={() => setTab("products")}>Товары</button>
          <button className={tab === "orders" ? "atab on" : "atab"} onClick={() => setTab("orders")}>
            Заказы{pendingOrders > 0 && <span className="tab-badge">{pendingOrders}</span>}
          </button>
          <button className="atab" onClick={() => setTab("settings")}><Settings size={14} /> Настройки сайта</button>
        </div>
        <button className="btn-ghost admin-logout" onClick={onLogout}><LogOut size={15} /> Выйти</button>
      </div>

      {tab === "products" && (
        <>
          <div className="admin-head-simple">
            <p className="admin-sub">Добавляйте, редактируйте и удаляйте позиции. Изменения сохраняются автоматически.</p>
            <button className="btn-primary" onClick={() => setEditing("new")}><Plus size={16} /> Добавить товар</button>
          </div>
          <div className="admin-list">
            {products.map((p) => {
              const cover = getGallery(p)[0];
              return (
                <div className="admin-row" key={p.id}>
                  <div className="admin-thumb"><Media p={p} img={cover} /></div>
                  <div className="admin-info">
                    <div className="admin-name">{p.name}{p.tag && <span className="mini-tag">{p.tag}</span>}</div>
                    <div className="admin-meta">{p.brand ? `${p.brand} · ` : ""}{p.cat} · {money(p.price)}</div>
                    <div className="admin-photos">В наличии: {p.stock ?? 0} шт · {p.delivery}</div>
                  </div>
                  <div className="admin-btns">
                    <button className="mini-btn" onClick={() => onPreview(p.id)} title="Открыть"><Star size={15} /></button>
                    <button className="mini-btn" onClick={() => setEditing(p)} title="Изменить"><Pencil size={15} /></button>
                    <button className="mini-btn danger" onClick={() => setPending({ type: "delete", product: p })} title="Удалить"><Trash2 size={15} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "orders" && <AdminOrders orders={orders} onStatus={onOrderStatus} />}

      {pending && (
        <>
          <div className="overlay" onClick={() => setPending(null)} />
          <div className="confirm-box" role="dialog" aria-modal="true">
            <h3 className="confirm-title">Удалить товар?</h3>
            <p className="confirm-text">
              Товар «{pending.product.name}» будет удалён без возможности восстановления.
            </p>
            <div className="confirm-actions">
              <button className="btn-ghost" onClick={() => setPending(null)}>Отмена</button>
              <button className="btn-danger" onClick={confirmPending}>Удалить</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function AdminOrders({ orders, onStatus }) {
  if (!orders.length) return <p className="muted-block">Заказов пока нет. Как только покупатель оформит заказ, он появится здесь.</p>;
  return (
    <div className="admin-orders">
      {orders.map((o) => (
        <div className="aorder" key={o.id}>
          <div className="aorder-top">
            <div>
              <div className="order-id">Заказ {o.id} <span className={`status-badge ${statusClass(o.status)}`}>{o.status}</span></div>
              <div className="order-date">{new Date(o.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</div>
            </div>
            <div className="aorder-total">{money(o.total)}</div>
          </div>

          <div className="aorder-grid">
            <div className="aorder-block">
              <div className="ab-title">Покупатель</div>
              <div>{o.customer.name}</div>
              <a className="ab-link" href={`tel:${o.customer.phone.replace(/[^\d+]/g, "")}`}>{o.customer.phone}</a>
              {o.customer.email && <div className="ab-muted">{o.customer.email}</div>}
            </div>
            <div className="aorder-block">
              <div className="ab-title">Доставка и оплата</div>
              <div>{DELIVERY_LABELS[o.delivery.method] || o.delivery.method}</div>
              {(o.delivery.city || o.delivery.address || o.delivery.pvz) && (
                <div className="ab-muted">{[o.delivery.city, o.delivery.address, o.delivery.pvz && `ПВЗ: ${o.delivery.pvz}`].filter(Boolean).join(", ")}</div>
              )}
              <div className="ab-muted">Оплата: {PAY_LABELS[o.payment.method]}{o.payment.card ? ` (${o.payment.card})` : ""}</div>
              {o.delivery.comment && <div className="ab-muted">Комментарий: «{o.delivery.comment}»</div>}
            </div>
          </div>

          <div className="aorder-items">
            {o.items.map((i, idx) => (
              <div className="order-item" key={idx}>
                <span>{i.name}{i.brand ? ` · ${i.brand}` : ""} · {i.size} · ×{i.qty}</span>
                <span>{money(i.price * i.qty)}</span>
              </div>
            ))}
          </div>

          <div className="aorder-actions">
            <label className="status-select">Статус заказа
              <select value={o.status} onChange={(e) => onStatus(o.id, e.target.value)}>
                {ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            {o.status === "Обработка" && (
              <div className="quick-actions">
                <button className="btn-primary sm" onClick={() => onStatus(o.id, "Подтверждён")}>Одобрить</button>
                <button className="btn-ghost sm" onClick={() => onStatus(o.id, "Отменён")}>Отклонить</button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------- Настройки сайта -------------------------- */
function SettingsForm({ settings, onSave, onCancel }) {
  const [f, setF] = useState({ ...DEFAULT_SETTINGS, ...settings });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const uploadLogo = async (fileList) => {
    const file = fileList?.[0];
    if (!file) return;
    setBusy(true); setErr("");
    try { set("logo", await processImage(file)); }
    catch (e) { setErr("Не удалось загрузить аватарку: " + (e.message || "ошибка")); }
    setBusy(false);
  };
  return (
    <section className="admin form-page">
      <button className="back-link" onClick={onCancel}><ArrowLeft size={16} /> К товарам</button>
      <h1 className="section-title">Настройки сайта</h1>

      <div className="settings-cols">
        <div className="form-block">
          <h3 className="block-title">Бренд и баннер</h3>
          <Field label="Название магазина"><input value={f.brand} onChange={(e) => set("brand", e.target.value)} /></Field>
          <Field label="Аватарка магазина (логотип)">
            <div className="logo-row">
              <div className="logo-preview">
                {f.logo ? <img src={f.logo} alt="Логотип" /> : <span>нет</span>}
              </div>
              <div className="logo-actions">
                <label className="btn-ghost logo-btn">
                  {busy ? "Загрузка…" : f.logo ? "Заменить" : "Загрузить"}
                  <input type="file" accept="image/*" hidden onChange={(e) => { uploadLogo(e.target.files); e.target.value = ""; }} />
                </label>
                {f.logo && <button className="link-btn danger" onClick={() => set("logo", "")}>Убрать</button>}
              </div>
            </div>
            {err && <div className="login-err">{err}</div>}
            <p className="form-hint">Если аватарка не задана, в шапке показывается название магазина.</p>
          </Field>
          <Field label="Строка-баннер вверху"><input value={f.announce} onChange={(e) => set("announce", e.target.value)} /></Field>
        </div>

        <div className="form-block">
          <h3 className="block-title">Главный экран</h3>
          <Field label="Надпись над заголовком"><input value={f.heroEyebrow} onChange={(e) => set("heroEyebrow", e.target.value)} /></Field>
          <div className="row-2">
            <Field label="Заголовок, 1-я строка"><input value={f.heroTitle1} onChange={(e) => set("heroTitle1", e.target.value)} /></Field>
            <Field label="Заголовок, 2-я строка (акцент)"><input value={f.heroTitleEm} onChange={(e) => set("heroTitleEm", e.target.value)} /></Field>
          </div>
          <Field label="Подзаголовок"><textarea rows={2} value={f.heroSub} onChange={(e) => set("heroSub", e.target.value)} /></Field>
        </div>

        <div className="form-block">
          <h3 className="block-title">Философия</h3>
          <Field label="Заголовок блока"><input value={f.philosophyTitle} onChange={(e) => set("philosophyTitle", e.target.value)} /></Field>
          <Field label="Текст"><textarea rows={5} value={f.philosophyText} onChange={(e) => set("philosophyText", e.target.value)} /></Field>
        </div>

        <div className="form-block">
          <h3 className="block-title">Контакты</h3>
          <div className="row-2">
            <Field label="Телефон"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+7 900 000-00-00" /></Field>
            <Field label="E-mail"><input value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="hello@arsene.store" /></Field>
          </div>
          <Field label="Адрес"><input value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Город, улица, дом" /></Field>
          <Field label="Часы работы"><input value={f.hours} onChange={(e) => set("hours", e.target.value)} placeholder="Пн–Вс, 10:00–22:00" /></Field>
          <div className="row-2">
            <Field label="Instagram (ссылка)"><input value={f.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="https://instagram.com/…" /></Field>
            <Field label="Telegram-канал (ссылка)"><input value={f.telegram} onChange={(e) => set("telegram", e.target.value)} placeholder="https://t.me/…" /></Field>
          </div>
        </div>

        <div className="form-block">
          <h3 className="block-title">Заказы и оплата (СБП)</h3>
          <Field label="Telegram менеджера для заказов (@username)">
            <input value={f.managerTg} onChange={(e) => set("managerTg", e.target.value)} placeholder="@arsene_manager или https://t.me/arsene_manager" />
          </Field>
          <div className="row-2">
            <Field label="Банк (СБП)"><input value={f.sbpBank} onChange={(e) => set("sbpBank", e.target.value)} placeholder="Т-Банк" /></Field>
            <Field label="Номер для перевода (СБП)"><input value={f.sbpPhone} onChange={(e) => set("sbpPhone", e.target.value)} placeholder="+7 900 000-00-00" /></Field>
          </div>
          <Field label="Получатель"><input value={f.sbpName} onChange={(e) => set("sbpName", e.target.value)} placeholder="Имя Ф." /></Field>
        </div>
      </div>

      <div className="form-bar">
        <button className="btn-ghost" onClick={onCancel}>Отмена</button>
        <button className="btn-primary" onClick={() => onSave(f)}>Сохранить настройки</button>
      </div>
    </section>
  );
}

/* -------------------------- Форма товара -------------------------- */
function TokenEditor({ tokens, onChange, suggestions = [], placeholder }) {
  const [val, setVal] = useState("");
  const add = (t) => {
    const v = String(t ?? val).trim();
    if (v && !tokens.includes(v)) onChange([...tokens, v]);
    setVal("");
  };
  return (
    <div>
      {tokens.length > 0 && (
        <div className="token-row">
          {tokens.map((t) => (
            <span className="token" key={t}>{t}<button onClick={() => onChange(tokens.filter((x) => x !== t))} aria-label="Удалить">×</button></span>
          ))}
        </div>
      )}
      <div className="token-add">
        <input value={val} onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={placeholder} />
        <button className="token-add-btn" onClick={() => add()} aria-label="Добавить"><Plus size={14} /></button>
      </div>
      {suggestions.filter((s) => !tokens.includes(s)).length > 0 && (
        <div className="token-sugg">
          {suggestions.filter((s) => !tokens.includes(s)).map((s) => <button key={s} onClick={() => add(s)}>+ {s}</button>)}
        </div>
      )}
    </div>
  );
}

function ColorEditor({ colors, onChange }) {
  const [val, setVal] = useState("#8f8677");
  const hex = /^#[0-9a-fA-F]{6}$/.test(val) ? val : "#8f8677";
  const add = () => { const v = val.trim(); if (v && !colors.includes(v)) onChange([...colors, v]); };
  return (
    <div>
      {colors.length > 0 && (
        <div className="token-row">
          {colors.map((c) => (
            <span className="color-token" key={c}>
              <span className="color-swatch" style={{ background: c }} />{c}
              <button onClick={() => onChange(colors.filter((x) => x !== c))} aria-label="Удалить">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="token-add">
        <input type="color" value={hex} onChange={(e) => setVal(e.target.value)} className="color-picker" aria-label="Выбрать цвет" />
        <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="#8f8677"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button className="token-add-btn" onClick={add} aria-label="Добавить"><Plus size={14} /></button>
      </div>
    </div>
  );
}

function ProductForm({ initial, products, extraTypes = [], onAddType, onSave, onCancel }) {
  const [f, setF] = useState(() => ({
    name: initial?.name || "", brand: initial?.brand || "", cat: initial?.cat || "Женское", type: initial?.type || "coat",
    price: initial?.price || "", oldPrice: initial?.oldPrice || "", material: initial?.material || "",
    care: initial?.care || "", desc: initial?.desc || "", tag: initial?.tag || "",
    stock: initial?.stock ?? 10, delivery: initial?.delivery || "1–3 дня по России",
    sizes: initial?.sizes ? [...initial.sizes] : ["S", "M", "L"],
    colors: initial?.colors ? [...initial.colors] : ["#8f8677"],
    images: initial?.images || [],
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [newType, setNewType] = useState("");
  const [addingType, setAddingType] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const isAccessory = f.cat === ONE_SIZE_CAT;

  // категория задаёт размерную сетку: аксессуары — только «Единый»
  const changeCat = (cat) => setF((s) => {
    if (cat === ONE_SIZE_CAT) return { ...s, cat, sizes: ["Единый"] };
    const cleaned = s.sizes.filter((x) => x !== "Единый");
    return { ...s, cat, sizes: cleaned.length ? cleaned : (cat === SHOE_CAT ? ["40", "41", "42"] : ["S", "M", "L"]) };
  });
  const brandOptions = uniq((products || []).map((p) => p.brand));
  const tagOptions = uniq(["Новинка", "Sale", ...(products || []).map((p) => p.tag)]);
  const allTypes = [...TYPES, ...extraTypes.map((l) => ({ v: l, l }))];

  const saveNewType = () => {
    const l = newType.trim();
    if (!l) return;
    onAddType?.(l);
    setF((s) => ({ ...s, type: l }));
    setNewType(""); setAddingType(false);
  };

  const handleFiles = async (fileList) => {
    if (!fileList || !fileList.length) return;
    setBusy(true);
    const arr = Array.from(fileList).slice(0, 6);
    const encoded = [];
    let failed = 0;
    for (const file of arr) {
      try { encoded.push(await processImage(file)); }
      catch (e) { failed++; console.error("Ошибка загрузки фото:", e); }
    }
    if (encoded.length) setF((s) => ({ ...s, images: [...s.images, ...encoded].slice(0, 6) }));
    if (failed) setErr(`Не удалось загрузить ${failed} фото. Проверьте, что bucket «product-images» создан и публичен.`);
    setBusy(false);
  };
  const removeImg = (i) => setF((s) => ({ ...s, images: s.images.filter((_, idx) => idx !== i) }));
  const makeMain = (i) => setF((s) => { const im = [...s.images]; const [x] = im.splice(i, 1); return { ...s, images: [x, ...im] }; });

  const save = () => {
    if (!f.name.trim()) return setErr("Укажите название товара");
    if (!f.price || Number(f.price) <= 0) return setErr("Укажите цену");
    if (isAccessory && (f.sizes.length !== 1 || f.sizes[0] !== "Единый")) return setErr("У аксессуаров размер только «Единый»");
    if (!isAccessory && !f.sizes.length) return setErr("Добавьте хотя бы один размер");
    if (!isAccessory && f.sizes.includes("Единый")) return setErr("«Единый» доступен только аксессуарам");
    setErr("");
    onSave({
      name: f.name.trim(), brand: f.brand.trim(), cat: f.cat, type: f.type, price: Number(f.price),
      oldPrice: f.oldPrice ? Number(f.oldPrice) : 0, material: f.material.trim(), care: f.care.trim(),
      desc: f.desc.trim(), tag: f.tag.trim() || undefined,
      stock: Math.max(0, parseInt(f.stock, 10) || 0), delivery: f.delivery.trim() || "1–3 дня по России",
      sizes: isAccessory ? ["Единый"] : f.sizes, colors: f.colors.length ? f.colors : ["#8f8677"], images: f.images,
    });
  };

  return (
    <section className="admin form-page">
      <button className="back-link" onClick={onCancel}><ArrowLeft size={16} /> К списку товаров</button>
      <h1 className="section-title">{initial ? "Редактирование" : "Новый товар"}</h1>

      <div className="form-grid">
        <div className="form-col">
          <Field label="Название"><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Пальто «Осло»" /></Field>
          <div className="row-2">
            <Field label="Бренд">
              <input value={f.brand} onChange={(e) => set("brand", e.target.value)} list="brand-list" placeholder="ARSÈNE" />
              <datalist id="brand-list">{brandOptions.map((b) => <option key={b} value={b} />)}</datalist>
            </Field>
            <Field label="Метка">
              <input value={f.tag} onChange={(e) => set("tag", e.target.value)} list="tag-list" placeholder="Новинка / Sale / своя" />
              <datalist id="tag-list">{tagOptions.map((t) => <option key={t} value={t} />)}</datalist>
            </Field>
          </div>
          <div className="row-2">
            <Field label="Категория"><select value={f.cat} onChange={(e) => changeCat(e.target.value)}>{SHOP_CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Тип вещи">
              <select value={f.type} onChange={(e) => { if (e.target.value === "__new") setAddingType(true); else set("type", e.target.value); }}>
                {allTypes.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                <option value="__new">+ Новый тип…</option>
              </select>
              {addingType && (
                <div className="token-add" style={{ marginTop: 8 }}>
                  <input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="Напр. Купальник"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveNewType(); } }} autoFocus />
                  <button className="token-add-btn" onClick={saveNewType} aria-label="Добавить тип"><Plus size={14} /></button>
                </div>
              )}
            </Field>
          </div>
          <div className="row-2">
            <Field label="Цена, ₽"><input type="number" value={f.price} onChange={(e) => set("price", e.target.value)} placeholder="18900" /></Field>
            <Field label="Старая цена (скидка)"><input type="number" value={f.oldPrice} onChange={(e) => set("oldPrice", e.target.value)} placeholder="—" /></Field>
          </div>
          <div className="row-2">
            <Field label="В наличии, шт"><input type="number" min="0" value={f.stock} onChange={(e) => set("stock", e.target.value)} placeholder="10" /></Field>
            <Field label="Сроки доставки"><input value={f.delivery} onChange={(e) => set("delivery", e.target.value)} placeholder="1–3 дня по России" /></Field>
          </div>
          <Field label={isAccessory ? "Размер" : f.cat === SHOE_CAT ? "Доступные размеры обуви" : "Доступные размеры"}>
            {isAccessory
              ? <div className="fixed-size">Единый <span>— у аксессуаров всегда один размер</span></div>
              : <TokenEditor tokens={f.sizes} onChange={(v) => set("sizes", v.filter((x) => x !== "Единый"))}
                  suggestions={sizeSuggestions(f.cat)} placeholder="Добавить размер и Enter" />}
          </Field>
          <Field label="Цвета">
            <ColorEditor colors={f.colors} onChange={(v) => set("colors", v)} />
          </Field>
          <Field label="Состав"><input value={f.material} onChange={(e) => set("material", e.target.value)} placeholder="80% шерсть, 20% полиамид" /></Field>
          <Field label="Уход"><input value={f.care} onChange={(e) => set("care", e.target.value)} placeholder="Сухая чистка" /></Field>
          <Field label="Описание"><textarea rows={4} value={f.desc} onChange={(e) => set("desc", e.target.value)} placeholder="Короткое описание товара…" /></Field>
        </div>

        <div className="form-col">
          <Field label="Фото товара (до 6, первое — главное)">
            <label className="uploader"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}>
              <Upload size={20} /><span>{busy ? "Обработка…" : "Нажмите или перетащите фото"}</span>
              <input type="file" accept="image/*" multiple hidden
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
            </label>
          </Field>
          {f.images.length > 0 && (
            <div className="img-grid">
              {f.images.map((src, i) => (
                <div className={`img-cell ${i === 0 ? "is-main" : ""}`} key={i}>
                  <img src={src} alt={`Фото ${i + 1}`} />
                  {i === 0 && <span className="main-flag">Главное</span>}
                  <div className="img-overlay">
                    {i !== 0 && <button onClick={() => makeMain(i)} title="Сделать главным"><Star size={14} /></button>}
                    <button onClick={() => removeImg(i)} title="Удалить"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="form-hint">Если фото не загружены, в каталоге показывается силуэт-плейсхолдер по типу товара. Фото сжимаются автоматически.</p>
        </div>
      </div>

      <div className="form-bar">
        {err && <span className="form-err">{err}</span>}
        <button className="btn-ghost" onClick={onCancel}>Отмена</button>
        <button className="btn-primary" onClick={save}>{initial ? "Сохранить изменения" : "Добавить товар"}</button>
      </div>
    </section>
  );
}
function Field({ label, children }) { return <label className="field block"><span>{label}</span>{children}</label>; }

/* ------------------------------- Подвал ------------------------------- */
function Footer({ settings, onNav, onInfo, onAdmin, isAdmin, user }) {
  const s = settings || DEFAULT_SETTINGS;
  const accLabel = isAdmin ? "Админ-панель" : user ? "Мой аккаунт" : "Вход / регистрация";
  return (
    <footer className="footer">
      <div className="footer-cols">
        <div className="footer-brand-col">
          <div className="footer-brand">{s.brand}</div>
          <p className="footer-tagline">{s.heroSub}</p>
        </div>
        <div className="footer-col"><div className="footer-col-title">Магазин</div>
          {SHOP_CATS.map((l) => <button key={l} className="footer-link" onClick={() => onNav(l)}>{l}</button>)}</div>
        <div className="footer-col"><div className="footer-col-title">О нас</div>
          <button className="footer-link" onClick={onInfo}>{s.philosophyTitle}</button>
          <button className="footer-link" onClick={onInfo}>Контакты</button>
          <button className="footer-link" onClick={onAdmin}>{accLabel}</button>
        </div>
        <div className="footer-col"><div className="footer-col-title">Контакты</div>
          {s.phone && <a className="footer-link" href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}>{s.phone}</a>}
          {s.email && <a className="footer-link" href={`mailto:${s.email}`}>{s.email}</a>}
          {s.address && <span className="footer-link footer-plain">{s.address}</span>}
          {s.hours && <span className="footer-link footer-plain">{s.hours}</span>}
        </div>
      </div>
      <div className="footer-bottom">© 2026 {s.brand}. Все права защищены.</div>
    </footer>
  );
}

/* ----------------------- Медиа: фото или силуэт ----------------------- */
function Media({ p, img, large }) {
  if (img && img.src) return <img className={`garment${large ? " garment-contain" : ""}`} src={img.src} alt={p.name} loading="lazy" />;
  return <GarmentImage p={p} img={img} large={large} />;
}

function GarmentImage({ p, img, large }) {
  const c = (p.colors && p.colors[0]) || "#8f8677";
  const d = (p.colors && p.colors[1]) || "#1a1714";
  const shape = GARMENTS[p.type] || GARMENTS.shirt;
  const cid = `clip-${p.id}-${img.key}-${large ? "L" : "S"}`;
  let inner;
  if (img.mode === "fabric") {
    inner = (
      <g>
        <rect width="260" height="260" fill={c} />
        <g stroke="rgba(255,255,255,.14)" strokeWidth="6">{Array.from({ length: 16 }).map((_, i) => <line key={i} x1={-40 + i * 24} y1="0" x2={-40 + i * 24 + 90} y2="260" />)}</g>
        <g stroke="rgba(0,0,0,.12)" strokeWidth="6">{Array.from({ length: 16 }).map((_, i) => <line key={i} x1={-40 + i * 24 + 90} y1="0" x2={-40 + i * 24} y2="260" />)}</g>
      </g>
    );
  } else {
    const t = img.mode === "back" ? "translate(200,0) scale(-1,1)" : img.mode === "detail" ? "translate(-52,-64) scale(1.85)" : "";
    inner = (<><rect width="260" height="260" fill={img.bg} /><g transform="translate(30,0)"><g transform={t}>{shape(c, d)}</g></g></>);
  }
  return (
    <svg className="garment" viewBox="0 0 260 260" preserveAspectRatio="xMidYMid slice" role="img" aria-label={p.name} xmlns="http://www.w3.org/2000/svg">
      <defs><clipPath id={cid}><rect width="260" height="260" /></clipPath></defs>
      <g clipPath={`url(#${cid})`}>{inner}</g>
    </svg>
  );
}

const GARMENTS = {
  coat: (c, d) => (<g><path d="M70,46 L56,60 L50,150 L60,252 L140,252 L150,150 L144,60 L130,46 L116,56 L100,66 L84,56 Z" fill={c} /><path d="M100,66 L100,252" stroke={d} strokeWidth="2.5" opacity=".5" /><path d="M84,56 L100,66 L116,56" fill="none" stroke={d} strokeWidth="2.5" opacity=".6" /><circle cx="100" cy="120" r="2.6" fill={d} opacity=".6" /><circle cx="100" cy="150" r="2.6" fill={d} opacity=".6" /><circle cx="100" cy="180" r="2.6" fill={d} opacity=".6" /></g>),
  shirt: (c, d) => (<g><path d="M68,50 L50,62 L44,98 L60,104 L66,74 L66,200 L134,200 L134,74 L140,104 L156,98 L150,62 L132,50 L116,58 L100,70 L84,58 Z" fill={c} /><path d="M84,58 L100,70 L116,58" fill="none" stroke={d} strokeWidth="2.5" opacity=".55" /><path d="M100,70 L100,200" stroke={d} strokeWidth="2" opacity=".35" /></g>),
  sweater: (c, d) => (<g><path d="M66,52 L48,66 L42,104 L58,110 L66,80 L66,205 L134,205 L134,80 L142,110 L158,104 L152,66 L134,52 L118,60 Q100,74 82,60 Z" fill={c} /><path d="M82,60 Q100,74 118,60" fill="none" stroke={d} strokeWidth="3" opacity=".5" /><path d="M66,196 L134,196" stroke={d} strokeWidth="4" opacity=".3" /></g>),
  dress: (c, d) => (<g><path d="M72,52 L58,66 L64,98 L74,94 L80,124 L52,250 L148,250 L120,124 L126,94 L136,98 L142,66 L128,52 L114,60 L100,70 L86,60 Z" fill={c} /><path d="M86,60 L100,70 L114,60" fill="none" stroke={d} strokeWidth="2.5" opacity=".5" /><path d="M80,124 L120,124" stroke={d} strokeWidth="2.5" opacity=".4" /></g>),
  skirt: (c, d) => (<g><path d="M72,70 L128,70 L126,84 L152,244 L48,244 L74,84 Z" fill={c} /><rect x="72" y="66" width="56" height="14" fill={d} opacity=".85" /><g stroke={d} strokeWidth="1.6" opacity=".3"><line x1="86" y1="90" x2="72" y2="244" /><line x1="100" y1="90" x2="100" y2="244" /><line x1="114" y1="90" x2="128" y2="244" /></g></g>),
  pants: (c, d) => (<g><path d="M74,44 L126,44 L134,250 L106,250 L100,140 L94,250 L66,250 Z" fill={c} /><rect x="74" y="44" width="52" height="12" fill={d} opacity=".8" /><path d="M100,60 L100,140" stroke={d} strokeWidth="1.6" opacity=".3" /></g>),
  sneakers: (c, d) => (<g><path d="M40,168 L44,132 L74,128 L96,146 L146,158 Q160,161 160,172 L160,180 L40,180 Z" fill={c} /><path d="M40,172 L160,172 L160,182 L40,182 Z" fill={d} opacity=".85" /><path d="M74,130 L92,150" stroke={d} strokeWidth="3" opacity=".5" /><path d="M84,136 L100,156" stroke={d} strokeWidth="3" opacity=".5" /><circle cx="132" cy="162" r="3" fill={d} opacity=".5" /></g>),
  boots: (c, d) => (<g><path d="M66,70 L104,70 L106,140 L150,158 Q160,162 160,172 L160,182 L64,182 Z" fill={c} /><rect x="64" y="176" width="96" height="10" rx="2" fill={d} opacity=".85" /><path d="M70,96 L104,96" stroke={d} strokeWidth="2.5" opacity=".45" /><path d="M70,116 L105,116" stroke={d} strokeWidth="2.5" opacity=".45" /></g>),
  shoes: (c, d) => (<g><path d="M48,164 Q52,138 78,136 L104,150 L146,160 Q158,163 158,172 L158,178 L48,178 Z" fill={c} /><path d="M48,172 L158,172 L158,180 L48,180 Z" fill={d} opacity=".85" /><path d="M78,138 Q96,146 104,152" stroke={d} strokeWidth="2.5" fill="none" opacity=".5" /></g>),
  bag: (c, d) => (<g><path d="M78,96 Q78,64 100,64 Q122,64 122,96" fill="none" stroke={d} strokeWidth="7" /><path d="M62,104 L138,104 L146,214 L54,214 Z" fill={c} /><rect x="90" y="150" width="20" height="10" rx="2" fill={d} opacity=".7" /></g>),
  belt: (c, d) => (<g><rect x="28" y="118" width="144" height="24" rx="3" fill={c} /><rect x="86" y="112" width="30" height="36" rx="4" fill="none" stroke={d} strokeWidth="6" /><circle cx="101" cy="130" r="3" fill={d} /></g>),
  scarf: (c, d) => (<g><path d="M62,64 L138,64 L150,92 L138,200 L100,182 L62,200 L74,92 Z" fill={c} /><path d="M74,92 L138,92" stroke={d} strokeWidth="2" opacity=".35" /><rect x="66" y="70" width="68" height="6" fill={d} opacity=".25" /></g>),
};

/* ------------------------------ Стили ------------------------------ */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Instrument+Sans:wght@400;500;600&display=swap');
.store{--paper:#f3f1ec;--card:#faf9f6;--ink:#1a1613;--ink-soft:#6b655c;--line:#e3ddd2;--accent:#7c2634;--serif:'Fraunces',Georgia,serif;--sans:'Instrument Sans',system-ui,sans-serif;background:var(--paper);color:var(--ink);font-family:var(--sans);min-height:100vh;-webkit-font-smoothing:antialiased}
.store *{box-sizing:border-box;margin:0;padding:0}
.store button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}
.garment{width:100%;height:100%;display:block;object-fit:cover}
.garment-contain{object-fit:contain;background:var(--card)}
.boot{min-height:60vh;display:grid;place-items:center;color:var(--ink-soft);font-size:15px;text-align:center;padding:40px 24px;line-height:1.6}
.boot-error{color:var(--accent);max-width:560px;margin:0 auto}
.muted-block{color:var(--ink-soft);padding:30px 0}

.announce{background:var(--ink);color:var(--paper);text-align:center;font-size:12px;letter-spacing:.06em;padding:9px 16px;text-transform:uppercase}
.header{position:sticky;top:0;z-index:40;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:18px 32px;background:rgba(243,241,236,.85);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.nav{display:flex;gap:24px;justify-self:start;align-items:center}
.nav-link{font-size:13px;letter-spacing:.04em;color:var(--ink-soft);transition:color .2s}
.nav-link:hover{color:var(--ink)}
.nav-sale{color:var(--accent);font-weight:600}
.nav-admin{border:1px solid var(--line);padding:5px 12px;border-radius:100px;color:var(--ink)}
.wordmark{justify-self:center;font-family:var(--serif);font-weight:600;font-size:26px;letter-spacing:.24em;padding-left:.24em;color:var(--ink)}
.header-actions{display:flex;gap:4px;justify-self:end;align-items:center}
.icon-btn{width:38px;height:38px;display:grid;place-items:center;border-radius:50%;color:var(--ink);transition:background .2s;position:relative}
.icon-btn:hover{background:rgba(0,0,0,.05)}
.cart-badge{position:absolute;top:2px;right:2px;background:var(--accent);color:#fff;font-size:10px;min-width:16px;height:16px;border-radius:8px;display:grid;place-items:center;padding:0 4px;font-weight:600}
.only-mobile{display:none}
@media(max-width:900px){.only-desktop{display:none}.only-mobile{display:grid}.header{grid-template-columns:auto 1fr auto;padding:16px 20px}.wordmark{font-size:22px}}
.mobile-menu{position:fixed;inset:0;z-index:60;background:var(--paper);display:flex;flex-direction:column;padding:80px 28px 28px;gap:6px}
.menu-close{position:absolute;top:16px;right:16px}
.mobile-link{font-family:var(--serif);font-size:28px;text-align:left;padding:10px 0;border-bottom:1px solid var(--line)}

.hero{text-align:center;padding:90px 24px 78px;max-width:760px;margin:0 auto}
.hero-eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);margin-bottom:22px}
.hero-title{font-family:var(--serif);font-weight:400;font-size:clamp(52px,11vw,108px);line-height:.92;letter-spacing:-.02em}
.hero-title em{font-style:italic;color:var(--accent)}
.hero-sub{max-width:440px;margin:26px auto 34px;color:var(--ink-soft);font-size:16px;line-height:1.6}

.btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--ink);color:var(--paper);padding:14px 26px;border-radius:2px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;transition:background .2s,transform .1s}
.btn-primary:hover:not(:disabled){background:var(--accent)}
.btn-primary:active{transform:translateY(1px)}
.btn-primary:disabled{opacity:.4;cursor:not-allowed}
.btn-ghost{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--line);padding:13px 20px;border-radius:2px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;transition:border-color .2s}
.btn-ghost:hover{border-color:var(--ink)}
.btn-block{width:100%}
.link-btn{font-size:13px;color:var(--ink-soft);text-decoration:underline;text-underline-offset:2px;margin-top:6px}
.link-btn:hover{color:var(--ink)}
.link-btn.danger:hover,.mini-btn.danger:hover{color:var(--accent)}

.catalog{padding:20px 32px 80px;max-width:1280px;margin:0 auto}
@media(max-width:760px){.catalog{padding:20px 20px 60px}}
.catalog-head{display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:20px;margin-bottom:34px;padding-bottom:18px;border-bottom:1px solid var(--line)}
.section-title{font-family:var(--serif);font-weight:500;font-size:32px;letter-spacing:-.01em}
.count{font-family:var(--sans);font-size:16px;color:var(--ink-soft);font-weight:400;vertical-align:middle;margin-left:6px}
.filters{display:flex;gap:8px;flex-wrap:wrap}
.chip{padding:8px 16px;border:1px solid var(--line);border-radius:100px;font-size:13px;color:var(--ink-soft);transition:all .2s}
.chip:hover{border-color:var(--ink);color:var(--ink)}
.chip-active{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.grid{display:grid;gap:26px 22px;grid-template-columns:repeat(4,1fr)}
@media(max-width:1080px){.grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:760px){.grid{grid-template-columns:repeat(2,1fr);gap:20px 14px}}
@media(max-width:420px){.grid{grid-template-columns:1fr}}
.card{display:flex;flex-direction:column;cursor:pointer}
.card-media{position:relative;aspect-ratio:1/1;border-radius:3px;overflow:hidden;background:var(--card)}
.badge{position:absolute;top:12px;left:12px;z-index:2;background:var(--paper);color:var(--ink);font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:4px 10px;border-radius:2px}
.badge-sale{background:var(--accent);color:#fff}
.wish{position:absolute;top:10px;right:10px;z-index:2;width:34px;height:34px;border-radius:50%;background:rgba(250,249,246,.85);display:grid;place-items:center;color:var(--ink);opacity:0;transition:opacity .25s}
.card:hover .wish{opacity:1}
@media(hover:none){.wish{opacity:1}}
.card-body{padding:14px 2px 0}
.card-top{display:flex;justify-content:space-between;gap:10px;align-items:baseline}
.card-name{font-size:15px;font-weight:500}
.card-price{font-size:14px;display:flex;gap:8px;align-items:baseline;white-space:nowrap}
.old{color:var(--ink-soft);text-decoration:line-through;font-size:13px}
.sale-price{color:var(--accent);font-weight:600}
.swatches{display:flex;gap:6px;margin-top:9px}
.swatch{width:13px;height:13px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)}

.product{max-width:1180px;margin:0 auto;padding:26px 32px 80px}
@media(max-width:760px){.product{padding:20px 20px 60px}}
.back-link{display:inline-flex;align-items:center;gap:6px;font-size:13px;letter-spacing:.04em;color:var(--ink-soft);margin-bottom:26px;transition:color .2s}
.back-link:hover{color:var(--ink)}
.product-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:56px;align-items:start}
@media(max-width:860px){.product-grid{grid-template-columns:1fr;gap:32px}}
.main-img{aspect-ratio:1/1;border-radius:4px;overflow:hidden;background:var(--card)}
.thumbs{display:flex;gap:10px;margin-top:12px}
.thumb{flex:1;aspect-ratio:1;border-radius:3px;overflow:hidden;border:1px solid var(--line);opacity:.7;transition:opacity .2s,border-color .2s;padding:0}
.thumb:hover{opacity:1}.thumb-active{opacity:1;border-color:var(--ink)}
.product-info{padding-top:6px}
.p-eyebrow{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:14px}
.p-name{font-family:var(--serif);font-weight:500;font-size:40px;line-height:1.05;letter-spacing:-.01em}
.p-price{display:flex;align-items:baseline;gap:12px;margin:18px 0 22px}
.p-price .big{font-size:24px;font-weight:600}
.p-desc{color:var(--ink-soft);line-height:1.7;max-width:440px}
.size-block{margin:30px 0 24px}
.size-head{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;letter-spacing:.04em;text-transform:uppercase;margin-bottom:12px}
.size-hint{color:var(--accent);text-transform:none;letter-spacing:0}
.size-row{display:flex;gap:8px;flex-wrap:wrap}
.size-chip{min-width:48px;padding:11px 14px;border:1px solid var(--line);border-radius:2px;font-size:14px;transition:all .2s}
.size-chip:hover:not(:disabled){border-color:var(--ink)}
.size-active{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.size-chip:disabled{cursor:default;background:var(--card)}
.add-row{display:flex;gap:10px;margin-bottom:34px}.add-row .btn-primary{flex:1}
.specs{border-top:1px solid var(--line)}
.spec-row{display:flex;gap:20px;padding:15px 0;border-bottom:1px solid var(--line)}
.spec-label{width:110px;flex-shrink:0;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-soft)}
.spec-value{font-size:14px;line-height:1.5}

.cart-page{max-width:1120px;margin:0 auto;padding:40px 32px 90px}
@media(max-width:760px){.cart-page{padding:28px 20px 70px}}
.cart-page .section-title{margin-bottom:30px}
.cart-layout{display:grid;grid-template-columns:1fr 360px;gap:44px;align-items:start}
@media(max-width:860px){.cart-layout{grid-template-columns:1fr;gap:30px}}
.cart-row{display:flex;gap:18px;padding:22px 0;border-bottom:1px solid var(--line)}
.cart-thumb{width:92px;height:92px;border-radius:3px;overflow:hidden;flex-shrink:0;background:var(--card);padding:0}
.cart-main{flex:1;min-width:0}
.cart-name{font-weight:500;font-size:16px;text-align:left}
.cart-name:hover{color:var(--accent)}
.cart-meta{color:var(--ink-soft);font-size:13px;margin:4px 0 16px}
.qty{display:inline-flex;align-items:center;gap:14px;border:1px solid var(--line);border-radius:2px;padding:6px 12px}
.qty button{display:grid;place-items:center;color:var(--ink-soft)}.qty button:hover{color:var(--ink)}
.qty span{font-size:14px;min-width:16px;text-align:center}
.cart-right{display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between}
.cart-price{font-weight:600;font-size:16px}
.remove{font-size:12px;color:var(--ink-soft);text-decoration:underline;text-underline-offset:2px}.remove:hover{color:var(--accent)}
.summary{background:var(--card);border:1px solid var(--line);border-radius:4px;padding:26px 24px;position:sticky;top:96px}
.summary-title{font-family:var(--serif);font-weight:500;font-size:20px;margin-bottom:20px}
.sum-row{display:flex;justify-content:space-between;font-size:14px;padding:9px 0;color:var(--ink-soft)}
.sum-row.total{color:var(--ink);font-weight:600;border-top:1px solid var(--line);margin-top:8px;padding-top:16px;align-items:baseline}
.total-sum{font-family:var(--serif);font-size:22px}
.summary .btn-primary{margin:16px 0 10px}
.summary-note{font-size:12px;color:var(--ink-soft);text-align:center;margin-top:12px;line-height:1.5}
.cart-empty{display:flex;flex-direction:column;align-items:center;gap:18px;padding:70px 0;color:var(--ink-soft)}.cart-empty p{font-size:16px}

/* вход */
.login-page{max-width:440px;margin:0 auto;padding:70px 24px 100px}
.login-card{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:40px 34px;text-align:center}
.login-icon{width:52px;height:52px;border-radius:50%;background:var(--ink);color:var(--paper);display:grid;place-items:center;margin:0 auto 20px}
.login-title{font-family:var(--serif);font-weight:500;font-size:24px}
.login-sub{color:var(--ink-soft);font-size:14px;margin:8px 0 26px}
.field{display:block;text-align:left;margin-bottom:16px}
.field>span{display:block;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:7px}
.field input,.field select,.field textarea{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:2px;background:var(--paper);font-family:inherit;font-size:15px;color:var(--ink)}
.field textarea{resize:vertical;line-height:1.5}
.field input:focus,.field select:focus,.field textarea:focus{outline:none;border-color:var(--ink)}
.login-err{background:rgba(124,38,52,.08);color:var(--accent);font-size:13px;padding:10px;border-radius:2px;margin-bottom:14px}
.login-demo{font-size:12px;color:var(--ink-soft);margin-top:18px}
.login-page .btn-primary{margin-top:6px}

/* вкладки вход/регистрация */
.auth-tabs{display:flex;gap:6px;background:var(--paper);border:1px solid var(--line);border-radius:100px;padding:4px;margin-bottom:24px}
.auth-tabs button{flex:1;padding:10px;border-radius:100px;font-size:14px;color:var(--ink-soft);transition:all .2s}
.auth-tabs button.on{background:var(--ink);color:var(--paper)}

/* личный кабинет */
.account-page{max-width:480px;margin:0 auto;padding:60px 24px 100px}
.account-card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:40px 32px;text-align:center}
.account-avatar{width:72px;height:72px;border-radius:50%;background:var(--ink);color:var(--paper);display:grid;place-items:center;margin:0 auto 18px;font-family:var(--serif);font-size:30px}
.account-name{font-family:var(--serif);font-weight:500;font-size:26px;line-height:1.15}
.account-meta{color:var(--ink-soft);font-size:14px;margin-top:8px;word-break:break-word}
.account-tiles{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:28px 0 22px}
.account-tile{display:flex;flex-direction:column;align-items:center;gap:6px;padding:20px 12px;border:1px solid var(--line);border-radius:6px;background:var(--paper);color:var(--ink);transition:border-color .2s}
.account-tile:hover{border-color:var(--ink)}
.account-tile span{font-size:13px;color:var(--ink-soft)}
.account-tile b{font-family:var(--serif);font-size:22px;font-weight:500}
.account-note{font-size:13px;color:var(--ink-soft);line-height:1.55;margin-bottom:22px}
.account-page .link-btn{margin-top:14px}

/* выбор размера (модалка) */
.size-picker{width:min(360px,calc(100% - 40px))}
.size-picker .size-row{margin:16px 0 20px}

/* оплата картой */
.pickup-note{font-size:13px;color:var(--ink-soft);line-height:1.55;background:var(--card);border:1px solid var(--line);border-radius:4px;padding:12px 14px;margin-bottom:16px}
.sbp-block{margin-top:16px;border:1px solid var(--line);border-radius:6px;padding:16px 18px;background:var(--card)}
.sbp-row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--line);font-size:14px}
.sbp-row:last-of-type{border-bottom:none}
.sbp-row span{color:var(--ink-soft)}
.sbp-row b{font-weight:600}
.sbp-note{font-size:13px;color:var(--ink-soft);line-height:1.55;margin-top:12px}
.card-form{margin-top:16px}
.card-input{position:relative;display:flex;align-items:center}
.card-input input{width:100%}
.card-brand{position:absolute;right:12px;font-size:12px;font-weight:600;letter-spacing:.02em;color:var(--ink-soft);background:var(--card);padding:2px 6px;border-radius:3px;pointer-events:none}
.card-secure{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink-soft);margin-top:4px}
.size-chosen{color:var(--ink-soft);text-transform:none;letter-spacing:0;font-size:12px}

/* админ */
.admin{max-width:1080px;margin:0 auto;padding:34px 32px 90px}
@media(max-width:760px){.admin{padding:26px 20px 70px}}
.admin-head{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:18px;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid var(--line)}
.admin-sub{color:var(--ink-soft);font-size:14px;margin-top:8px;max-width:440px}
.admin-actions{display:flex;gap:10px;flex-wrap:wrap}
.admin-list{display:flex;flex-direction:column}
.admin-row{display:flex;align-items:center;gap:16px;padding:14px 0;border-bottom:1px solid var(--line)}
.admin-thumb{width:56px;height:56px;border-radius:3px;overflow:hidden;flex-shrink:0;background:var(--card)}
.admin-info{flex:1;min-width:0}
.admin-name{font-weight:500;font-size:15px;display:flex;align-items:center;gap:8px}
.mini-tag{font-size:10px;letter-spacing:.05em;text-transform:uppercase;background:var(--ink);color:var(--paper);padding:2px 7px;border-radius:2px}
.admin-meta{color:var(--ink-soft);font-size:13px;margin-top:3px}
.admin-photos{color:var(--ink-soft);font-size:12px;margin-top:2px;opacity:.8}
.admin-btns{display:flex;gap:6px}
.mini-btn{width:36px;height:36px;display:grid;place-items:center;border:1px solid var(--line);border-radius:2px;color:var(--ink-soft);transition:all .2s}
.mini-btn:hover{border-color:var(--ink);color:var(--ink)}
.admin-footer{margin-top:28px}

/* форма */
.form-page .section-title{margin-bottom:24px}
.form-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:40px;align-items:start}
@media(max-width:820px){.form-grid{grid-template-columns:1fr;gap:8px}}
.field.block{margin-bottom:18px}
.row-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:480px){.row-2{grid-template-columns:1fr}}
.seg{display:flex;border:1px solid var(--line);border-radius:2px;overflow:hidden}
.seg button{flex:1;padding:11px;font-size:13px;color:var(--ink-soft)}
.seg .seg-on{background:var(--ink);color:var(--paper)}
.uploader{display:flex;flex-direction:column;align-items:center;gap:10px;padding:34px;border:1.5px dashed var(--line);border-radius:4px;color:var(--ink-soft);cursor:pointer;transition:border-color .2s,color .2s;text-align:center;font-size:14px}
.uploader:hover{border-color:var(--ink);color:var(--ink)}
.img-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}
.img-cell{position:relative;aspect-ratio:1/1;border-radius:3px;overflow:hidden;border:1px solid var(--line)}
.img-cell.is-main{border-color:var(--ink)}
.img-cell img{width:100%;height:100%;object-fit:cover;display:block}
.main-flag{position:absolute;top:6px;left:6px;font-size:10px;background:var(--ink);color:var(--paper);padding:2px 7px;border-radius:2px;letter-spacing:.04em}
.img-overlay{position:absolute;bottom:0;left:0;right:0;display:flex;gap:6px;justify-content:flex-end;padding:6px;background:linear-gradient(transparent,rgba(0,0,0,.5))}
.img-overlay button{width:28px;height:28px;display:grid;place-items:center;background:rgba(255,255,255,.9);border-radius:2px;color:var(--ink)}
.form-hint{font-size:12px;color:var(--ink-soft);line-height:1.5;margin-top:14px}
.form-bar{display:flex;justify-content:flex-end;gap:12px;margin-top:30px;padding-top:22px;border-top:1px solid var(--line)}

.footer{background:var(--ink);color:var(--paper);padding:60px 32px 30px;margin-top:20px}
.footer-cols{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px}
.footer-brand{font-family:var(--serif);font-size:28px;letter-spacing:.2em}
.footer-col-title{font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.6;margin-bottom:14px}
.footer-link{display:block;color:var(--paper);text-decoration:none;opacity:.85;font-size:14px;padding:5px 0;transition:opacity .2s;text-align:left}
.footer-link:hover{opacity:1}
.footer-bottom{max-width:1200px;margin:44px auto 0;padding-top:22px;border-top:1px solid rgba(255,255,255,.14);font-size:12px;opacity:.6;letter-spacing:.04em}
@media(max-width:760px){.footer-cols{grid-template-columns:1fr 1fr;gap:30px}}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

/* поиск + инструменты каталога */
.catalog-tools{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.search-box{position:relative;display:flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid var(--line);border-radius:100px;background:var(--card);color:var(--ink-soft);min-width:240px}
.search-box input{border:none;background:none;font-family:inherit;font-size:14px;color:var(--ink);width:100%;outline:none}
.search-box input::placeholder{color:var(--ink-soft)}
.search-clear{display:grid;place-items:center;color:var(--ink-soft)}
.search-clear:hover{color:var(--ink)}
@media(max-width:520px){.search-box{min-width:0;width:100%}.catalog-tools{width:100%}}

/* избранное на карточке и товаре */
.wish-on{opacity:1;color:var(--accent)}
.card:hover .wish{opacity:1}
.fav-btn{width:52px;flex-shrink:0;display:grid;place-items:center;border:1px solid var(--line);border-radius:2px;color:var(--ink);transition:all .2s}
.fav-btn:hover{border-color:var(--ink)}
.fav-on{border-color:var(--accent);color:var(--accent)}
.go-cart{display:inline-block;margin:-22px 0 30px}

/* оформление заказа */
.checkout{max-width:1120px;margin:0 auto;padding:26px 32px 90px}
@media(max-width:760px){.checkout{padding:20px 20px 70px}}
.checkout .section-title{margin:6px 0 26px}
.checkout-grid{display:grid;grid-template-columns:1fr 360px;gap:44px;align-items:start}
@media(max-width:860px){.checkout-grid{grid-template-columns:1fr;gap:30px}}
.form-block{margin-bottom:26px}
.block-title{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:14px}
.seg-wide{margin-bottom:16px}
.checkout-items{border-bottom:1px solid var(--line);margin-bottom:14px;padding-bottom:6px}
.checkout-line{display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:8px 0;color:var(--ink-soft)}
.cl-name{color:var(--ink);line-height:1.35}
.cl-qty{color:var(--ink-soft)}
.cl-size{font-size:12px;color:var(--ink-soft)}
.cl-price{white-space:nowrap;font-weight:500;color:var(--ink)}

/* заказ принят */
.success{max-width:560px;margin:0 auto;padding:90px 24px 120px;text-align:center}
.success-icon{width:66px;height:66px;border-radius:50%;background:var(--ink);color:var(--paper);display:grid;place-items:center;margin:0 auto 24px}
.success-title{font-family:var(--serif);font-weight:500;font-size:34px}
.success-sub{color:var(--ink-soft);line-height:1.6;margin:16px auto 30px;max-width:400px}

/* о магазине / контакты */
.info-page{max-width:1080px;margin:0 auto;padding:20px 32px 90px}
@media(max-width:760px){.info-page{padding:16px 20px 70px}}
.info-hero{max-width:720px;margin:30px 0 50px}
.info-philosophy{font-family:var(--serif);font-size:clamp(24px,3.4vw,34px);line-height:1.35;font-weight:400;margin-top:16px}
.info-contacts-wrap{max-width:560px}
.info-h2{font-family:var(--serif);font-weight:500;font-size:24px;margin-bottom:14px}
.contact-list{margin-bottom:22px}
.contact-row{display:flex;gap:14px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--line)}
.contact-icon{width:38px;height:38px;flex-shrink:0;display:grid;place-items:center;border:1px solid var(--line);border-radius:50%;color:var(--ink)}
.contact-label{font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:3px}
.contact-value{font-size:16px;color:var(--ink);text-decoration:none}
a.contact-value:hover{color:var(--accent)}
.info-socials{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.tg-pill{display:inline-flex;align-items:center;gap:9px;padding:11px 20px;border-radius:100px;text-decoration:none;color:#fff;font-size:14px;font-weight:500;line-height:1;background:linear-gradient(120deg,#2aabee,#229ed9);box-shadow:0 6px 16px rgba(34,158,217,.28);transition:transform .15s,box-shadow .2s;white-space:nowrap}
.tg-pill svg{flex-shrink:0}
.tg-pill:hover{transform:translateY(-1px);box-shadow:0 9px 22px rgba(34,158,217,.36)}
.ig-pill{display:inline-flex;align-items:center;padding:11px 20px;border-radius:100px;text-decoration:none;font-size:14px;color:var(--ink);line-height:1;border:1px solid var(--line);transition:border-color .2s}
.ig-pill:hover{border-color:var(--ink)}
.info-shop{margin-top:26px}

/* форма настроек */
.settings-cols{display:grid;grid-template-columns:1fr 1fr;gap:20px 40px;align-items:start}
@media(max-width:820px){.settings-cols{grid-template-columns:1fr;gap:8px}}
.settings-cols .form-block{background:var(--card);border:1px solid var(--line);border-radius:5px;padding:22px 22px 6px}

/* подвал: бренд + контакты */
.footer-tagline{opacity:.6;font-size:13px;line-height:1.6;margin-top:14px;max-width:260px}
.footer-plain{opacity:.7;cursor:default}
.footer-plain:hover{opacity:.7}
a.footer-link{text-decoration:none}

/* фильтры */
.filter-toggle{display:inline-flex;align-items:center;gap:7px;padding:9px 15px;border:1px solid var(--line);border-radius:100px;font-size:13px;color:var(--ink);transition:all .2s}
.filter-toggle:hover,.filter-toggle.on{border-color:var(--ink)}
.filter-toggle.on{background:var(--ink);color:var(--paper)}
.fcount{background:var(--accent);color:#fff;font-size:11px;min-width:17px;height:17px;border-radius:9px;display:grid;place-items:center;padding:0 5px;font-weight:600}
.filter-panel{border:1px solid var(--line);border-radius:6px;background:var(--card);padding:22px 24px;margin-bottom:24px;display:grid;grid-template-columns:repeat(3,1fr);gap:22px 34px;align-items:start}
@media(max-width:820px){.filter-panel{grid-template-columns:1fr 1fr}}
@media(max-width:520px){.filter-panel{grid-template-columns:1fr}}
.filter-group-title{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:11px}
.chip-wrap{display:flex;flex-wrap:wrap;gap:7px}
.fchip{padding:6px 12px;border:1px solid var(--line);border-radius:100px;font-size:13px;color:var(--ink-soft);background:var(--paper);transition:all .2s}
.fchip:hover{border-color:var(--ink);color:var(--ink)}
.fchip.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.color-dot{width:26px;height:26px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15);display:grid;place-items:center;color:#fff;transition:transform .15s}
.color-dot:hover{transform:scale(1.1)}
.color-dot.on{box-shadow:0 0 0 2px var(--paper),0 0 0 4px var(--ink)}
.price-row{display:flex;align-items:center;gap:8px}
.price-row input{width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:3px;background:var(--paper);font-family:inherit;font-size:14px;color:var(--ink)}
.price-row input:focus{outline:none;border-color:var(--ink)}
.filter-panel .link-btn{grid-column:1/-1;justify-self:start}
.catalog-count{color:var(--ink-soft);font-size:13px;margin-bottom:18px}

/* философия в конце каталога */
.philosophy-band{max-width:820px;margin:0 auto;padding:20px 32px 96px;text-align:center}
.philosophy-quote{font-family:var(--serif);font-size:clamp(22px,3.2vw,30px);line-height:1.4;font-weight:400;margin:14px 0 26px}

/* редакторы размеров/цветов */
.token-row{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px}
.token{display:inline-flex;align-items:center;gap:6px;padding:5px 6px 5px 11px;background:var(--ink);color:var(--paper);border-radius:3px;font-size:13px}
.token button{color:var(--paper);opacity:.7;font-size:16px;line-height:1;width:18px;height:18px;display:grid;place-items:center;border-radius:50%}
.token button:hover{opacity:1;background:rgba(255,255,255,.15)}
.color-token{display:inline-flex;align-items:center;gap:7px;padding:5px 6px 5px 8px;border:1px solid var(--line);border-radius:3px;font-size:12px}
.color-token .color-swatch{width:16px;height:16px;border-radius:3px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}
.color-token button{color:var(--ink-soft);font-size:16px;line-height:1;width:18px;height:18px;display:grid;place-items:center}
.color-token button:hover{color:var(--accent)}
.token-add{display:flex;gap:8px;align-items:stretch}
.token-add input{flex:1;padding:10px 12px;border:1px solid var(--line);border-radius:3px;background:var(--paper);font-family:inherit;font-size:14px;color:var(--ink)}
.token-add input:focus{outline:none;border-color:var(--ink)}
.token-add .color-picker{flex:0 0 44px;padding:2px;cursor:pointer}
.token-add-btn{flex:0 0 44px;border:1px solid var(--ink);background:var(--ink);color:var(--paper);border-radius:3px;display:grid;place-items:center}
.token-add-btn:hover{background:var(--accent);border-color:var(--accent)}
.token-sugg{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
.token-sugg button{font-size:12px;color:var(--ink-soft);border:1px dashed var(--line);border-radius:100px;padding:4px 10px}
.token-sugg button:hover{border-color:var(--ink);color:var(--ink)}

/* Telegram-баннер */
.tg-cta{display:flex;align-items:center;gap:16px;margin:0 auto 40px;max-width:760px;padding:18px 22px;border-radius:8px;text-decoration:none;color:var(--paper);background:linear-gradient(120deg,#2aabee,#229ed9);box-shadow:0 8px 24px rgba(34,158,217,.28);transition:transform .15s,box-shadow .2s}
.tg-cta:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(34,158,217,.36)}
.tg-icon{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.2);display:grid;place-items:center;flex-shrink:0}
.tg-text{display:flex;flex-direction:column;gap:2px;flex:1}
.tg-text b{font-size:16px}
.tg-text span{font-size:13px;opacity:.9}
.tg-go{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:500;white-space:nowrap}
@media(max-width:520px){.tg-go{display:none}}

/* карта */
.info-map{display:flex;flex-direction:column;gap:10px}
.map-frame{width:100%;min-height:300px;border:1px solid var(--line);border-radius:6px;display:block}
.map-link{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--ink-soft);text-decoration:none;align-self:flex-start}
.map-link:hover{color:var(--ink)}

/* окно подтверждения */
.overlay{position:fixed;inset:0;background:rgba(20,18,15,.45);z-index:70;animation:fade .18s ease}
.confirm-box{position:fixed;z-index:80;left:50%;top:50%;transform:translate(-50%,-50%);width:min(400px,calc(100% - 40px));background:var(--paper);border-radius:8px;padding:26px 26px 22px;box-shadow:0 20px 50px rgba(0,0,0,.28);animation:pop .18s ease}
.confirm-title{font-family:var(--serif);font-weight:500;font-size:21px;margin-bottom:10px}
.confirm-text{color:var(--ink-soft);font-size:14px;line-height:1.55;margin-bottom:22px}
.confirm-actions{display:flex;justify-content:flex-end;gap:10px}
.btn-danger{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--accent);color:#fff;padding:13px 22px;border-radius:2px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;transition:filter .2s}
.btn-danger:hover{filter:brightness(1.08)}
.form-err{color:var(--accent);font-size:13px;margin-right:auto;align-self:center}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes pop{from{opacity:0;transform:translate(-50%,-46%)}to{opacity:1;transform:translate(-50%,-50%)}}

/* наличие на странице товара */
.avail{display:inline-block;font-size:13px;font-weight:500;padding:5px 12px;border-radius:100px;margin-bottom:6px}
.avail-in{background:rgba(74,107,82,.12);color:#3f5c47}
.avail-low{background:rgba(176,120,40,.14);color:#8a5a1a}
.avail-out{background:rgba(124,38,52,.1);color:var(--accent)}

/* успех: номер заказа */
.success-order{font-size:14px;color:var(--ink-soft);margin-bottom:8px}
.success-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:6px}

/* вкладки админки */
.admin-tabbar{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:26px;padding-bottom:16px;border-bottom:1px solid var(--line)}
.admin-tabs{display:flex;gap:6px;flex-wrap:wrap}
.atab{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border:1px solid var(--line);border-radius:100px;font-size:14px;color:var(--ink-soft);transition:all .2s}
.atab:hover{border-color:var(--ink);color:var(--ink)}
.atab.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.tab-badge{background:var(--accent);color:#fff;font-size:11px;min-width:17px;height:17px;border-radius:9px;display:grid;place-items:center;padding:0 5px;font-weight:600}
.admin-head-simple{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:22px}

/* заказы — общий вид */
.status-badge{display:inline-block;font-size:11px;font-weight:600;letter-spacing:.03em;padding:3px 10px;border-radius:100px;vertical-align:middle;margin-left:8px}
.st-wait{background:rgba(176,120,40,.16);color:#8a5a1a}
.st-progress{background:rgba(43,58,103,.12);color:#2b3a67}
.st-done{background:rgba(74,107,82,.16);color:#3f5c47}
.st-cancel{background:rgba(124,38,52,.12);color:var(--accent)}

/* мои заказы */
.orders-page{max-width:820px;margin:0 auto;padding:26px 32px 90px}
@media(max-width:760px){.orders-page{padding:20px 20px 70px}}
.orders-page .section-title{margin-bottom:24px}
.orders-list{display:flex;flex-direction:column;gap:16px}
.order-card{border:1px solid var(--line);border-radius:8px;background:var(--card);padding:20px 22px}
.order-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}
.order-id{font-weight:600;font-size:15px}
.order-date{font-size:13px;color:var(--ink-soft);margin-top:3px}
.order-items{border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:10px 0;margin-bottom:12px}
.order-item{display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:5px 0;color:var(--ink)}
.order-foot{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.order-delivery{font-size:13px;color:var(--ink-soft)}
.order-total{font-family:var(--serif);font-size:19px}

/* заказы в админке */
.admin-orders{display:flex;flex-direction:column;gap:18px}
.aorder{border:1px solid var(--line);border-radius:8px;background:var(--card);padding:22px 24px}
.aorder-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px}
.aorder-total{font-family:var(--serif);font-size:22px;white-space:nowrap}
.aorder-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:16px}
@media(max-width:640px){.aorder-grid{grid-template-columns:1fr}}
.ab-title{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:7px}
.aorder-block>div,.aorder-block>a{font-size:14px;line-height:1.5}
.ab-link{color:var(--ink);text-decoration:none;display:block}
.ab-link:hover{color:var(--accent)}
.ab-muted{color:var(--ink-soft);font-size:13px}
.aorder-items{border-top:1px solid var(--line);padding-top:12px;margin-bottom:16px}
.aorder-actions{display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:16px}
.status-select{display:flex;flex-direction:column;gap:6px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-soft)}
.status-select select{padding:10px 12px;border:1px solid var(--line);border-radius:3px;background:var(--paper);font-family:inherit;font-size:14px;color:var(--ink);min-width:180px}
.quick-actions{display:flex;gap:8px}
.btn-primary.sm,.btn-ghost.sm{padding:10px 16px;font-size:12px}

/* аватарка магазина в шапке */
.brand-logo{height:34px;width:auto;max-width:170px;object-fit:contain;display:block}
@media(max-width:900px){.brand-logo{height:28px;max-width:130px}}

/* лимит остатка */
.stock-err{background:rgba(124,38,52,.1);color:var(--accent);font-size:13px;padding:10px 12px;border-radius:3px;margin:-22px 0 22px}
.stock-note{font-size:13px;color:var(--ink-soft);margin:-22px 0 22px}
.cart-limit{font-size:12px;color:var(--accent);margin-top:7px}
.qty button:disabled{opacity:.3;cursor:not-allowed}

/* фиксированный размер у аксессуаров */
.fixed-size{display:flex;align-items:baseline;gap:8px;padding:12px 14px;border:1px solid var(--line);border-radius:3px;background:var(--card);font-size:14px}
.fixed-size span{color:var(--ink-soft);font-size:12px}

/* загрузка аватарки */
.logo-row{display:flex;align-items:center;gap:16px}
.logo-preview{width:72px;height:72px;flex-shrink:0;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--card);display:grid;place-items:center;color:var(--ink-soft);font-size:12px}
.logo-preview img{width:100%;height:100%;object-fit:contain;display:block}
.logo-actions{display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.logo-btn{cursor:pointer;padding:10px 18px}

@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`;
