import React, { useState, useEffect, useMemo } from "react";
import {
  ShoppingBag, Search, User, Menu, X, Plus, Minus, ArrowRight, ArrowLeft,
  Heart, Check, LogOut, Pencil, Trash2, Upload, Lock, Star,
  Phone, Mail, MapPin, Clock, Settings, Send,
  SlidersHorizontal, Package, ArrowUpDown,
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

const BRAND = "ROVELLE";
const ORDER_STATUSES = ["Обработка", "Подтверждён", "Собирается", "В доставке", "Доставлен", "Отменён"];
const DELIVERY_LABELS = { courier: "Курьер", cdek: "СДЭК", pickup: "Самовывоз" };
const PAY_LABELS = { request: "Заявка (свяжемся)", online: "Оплата онлайн", sbp: "СБП онлайн", cash: "При получении" };
const arr = (v) => (Array.isArray(v) ? v : []);
const normalizeProduct = (p = {}) => ({
  ...p,
  id: p.id,
  name: p.name || "Без названия",
  brand: p.brand || "",
  cat: LINES.includes(p.cat) ? p.cat : "Archive", // старые отделы схлопываем в линию Archive
  type: p.type || "shirt",
  price: Number(p.price) || 0,
  oldPrice: Number(p.oldPrice) || 0,
  material: p.material || "",
  materials: Array.isArray(p.materials) ? p.materials : [],
  care: p.care || "",
  desc: p.desc || "",
  highlights: p.highlights || "",
  fit: p.fit || "",
  sizes: arr(p.sizes).length ? arr(p.sizes) : ["Единый"],
  colors: arr(p.colors).length ? arr(p.colors) : ["#8f8677"],
  images: arr(p.images),
  stock: Number.isFinite(Number(p.stock)) ? Number(p.stock) : 0,
  delivery: p.delivery || "1–3 дня по России",
});

const DEFAULT_SETTINGS = {
  brand: BRAND,
  announce: "Коллекция 001 — уже на сайте · Доставка по всей России",
  heroEyebrow: "Menswear · Est. 2026",
  heroTitle1: "Тихая",
  heroTitleEm: "роскошь",
  heroSub: "Один бренд — два мира. Архивный винтаж для смелых и спокойный люкс для тех, кто уже всё доказал.",
  philosophyTitle: "Философия",
  philosophyText:
    "Rovelle — это одежда без логомании. Мы верим, что вещь должна говорить фактурой, швами и посадкой, а не надписью на груди. Каждая позиция отбирается вручную: архивные мотивы, честные материалы, ограниченные партии.",
  line1Name: "Heritage",
  line1Desc: "Винтаж, архивные мотивы и Стокгольм. Вещи с историей — для тех, кто экспериментирует.",
  line2Name: "Quiet Luxe",
  line2Desc: "Дорогие ткани, идеальная посадка, ноль визуального шума. Для тех, кто уже всё доказал.",
  luxeText: "Шерсть, кашемир, благородный хлопок. Поло, брюки, полузамки — одежда в духе Loro Piana, но с честным ценником. Для мужчин, которым не нужно ничего доказывать.",
  manifesto: "Мы не печатаем логотипы.\nМы прошиваем историю.",
  phone: "+7 900 000-00-00",
  email: "hello@rovelle.moscow",
  address: "Москва",
  hours: "Онлайн, 24/7",
  instagram: "https://instagram.com/rovelle",
  telegram: "https://t.me/rovelle",
  logo: "",                            // аватарка магазина (ссылка на файл)
  managerTg: "@pinxty",                // @username менеджера для заказов
  onlinePayEnabled: false,             // включить, когда подключишь эквайринг (ИП/ЮKassa)
  sbpPhone: "+7 911 098 51 28",        // номер для перевода по СБП
  sbpBank: "Т-Банк",
  sbpName: "Роберт В.",
};

/* Две линии одного бренда */
const LINES = ["Archive", "Quiet Luxe"];
const LINE_LABELS = { "Archive": "Rovelle Heritage", "Quiet Luxe": "Rovelle Quiet Luxe" };
const LINE_SHORT = { "Archive": "Heritage", "Quiet Luxe": "Quiet Luxe" };  // короткое имя линии
const catLabel = (c) => (c === "Всё" ? "Вся коллекция" : LINE_SHORT[c] || c);
const CATEGORIES = ["Всё", ...LINES];
const SHOP_CATS = LINES;
const TAGS = ["", "Новинка", "Sale", "Архив", "Лимит"];
const TYPES = [
  { v: "jeans", l: "Джинсы" }, { v: "hoodie", l: "Худи / свитшот" }, { v: "sweater", l: "Свитер" },
  { v: "shirt", l: "Рубашка" }, { v: "tee", l: "Футболка" }, { v: "polo", l: "Поло" },
  { v: "pants", l: "Брюки" }, { v: "coat", l: "Куртка / пальто" }, { v: "halfzip", l: "Полузамок" },
  { v: "sneakers", l: "Кроссовки" }, { v: "boots", l: "Ботинки" }, { v: "loafers", l: "Лоферы" },
];
const typeLabel = (v) => TYPES.find((t) => t.v === v)?.l || v;
const uniq = (arr) => [...new Set(arr.filter(Boolean))];

/* Размерные подсказки: по типу вещи (обувь — числовые) */
const SHOE_TYPES = ["sneakers", "boots", "loafers", "shoes"];
const CLOTHES_SIZE_SUGG = ["XS", "S", "M", "L", "XL", "XXL"];
const SHOE_SIZE_SUGG = ["39", "40", "41", "42", "43", "44", "45", "46"];
const sizeSuggestions = (type) => (SHOE_TYPES.includes(type) ? SHOE_SIZE_SUGG : CLOTHES_SIZE_SUGG);

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
const imgFull = (im) => (typeof im === "string" ? im : im?.full || im?.thumb || "");
const imgThumb = (im) => (typeof im === "string" ? im : im?.thumb || im?.full || "");
const imgZoom = (im) => (typeof im === "string" ? im : im?.zoom || im?.full || im?.thumb || "");

function getGallery(p) {
  if (p.images && p.images.length)
    return p.images.map((im, i) => ({ key: "img" + i, label: "Фото " + (i + 1), src: imgFull(im), thumb: imgThumb(im), zoom: imgZoom(im) }));
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
  const [tgFallback, setTgFallback] = useState("");
  const [payMeta, setPayMeta] = useState(null);
  const [booting, setBooting] = useState(true);
  const [fatal, setFatal] = useState("");
  const [fade, setFade] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false); // пришёл по ссылке из письма

  // гостевая корзина: не теряется при закрытии вкладки
  useEffect(() => {
    if (user) return;
    try {
      const raw = localStorage.getItem("arsene_guest_cart");
      if (raw) setCart(JSON.parse(raw));
      const f = localStorage.getItem("arsene_guest_favs");
      if (f) setFavorites(JSON.parse(f));
    } catch (e) { /* пусто */ }
    // eslint-disable-next-line
  }, []);
  useEffect(() => {
    if (user) return;
    try {
      localStorage.setItem("arsene_guest_cart", JSON.stringify(cart));
      localStorage.setItem("arsene_guest_favs", JSON.stringify(favorites));
    } catch (e) { /* переполнено */ }
  }, [cart, favorites, user]);

  // снимаем класс анимации после перехода
  useEffect(() => { if (!fade) return; const t = setTimeout(() => setFade(false), 260); return () => clearTimeout(t); }, [fade]);

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
    // человек пришёл по ссылке из письма: в адресе токены Supabase
    const cameFromEmail = window.location.hash.includes("access_token=");

    supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      applySession(session);
      // сессия получена из ссылки — убираем токены из адреса и приветствуем
      if (session?.user && window.location.hash.includes("access_token=")) {
        window.history.replaceState(null, "", window.location.pathname + "#/");
        setView("catalog");
        setJustConfirmed(true);
        setTimeout(() => setJustConfirmed(false), 6000);
      }
    });

    // если письмо подтверждено, но сессия почему-то не поднялась — не оставляем мусор в адресе
    if (cameFromEmail) {
      setTimeout(() => {
        if (window.location.hash.includes("access_token=")) {
          window.history.replaceState(null, "", window.location.pathname + "#/");
        }
      }, 3000);
    }
    return () => sub.subscription.unsubscribe();
  }, []);

  /* --- Сохраняем корзину и избранное в профиль --- */
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => saveProfileState(user.id, { cart, favorites }), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [cart, favorites]);

  // заголовок вкладки: помогает и людям, и поиску
  useEffect(() => {
    if (!settings) return;
    const brand = BRAND;
    const p = view === "product" && selectedId ? byId(selectedId) : null;
    const titles = { catalog: `${brand} — мужская одежда`, cart: `Корзина — ${brand}`, checkout: `Оформление заказа — ${brand}`,
      favorites: `Избранное — ${brand}`, info: `О магазине — ${brand}`, account: `Мой аккаунт — ${brand}`,
      orders: `Мои заказы — ${brand}`, admin: `Админ-панель — ${brand}`, success: `Заказ оформлен — ${brand}` };
    document.title = p ? `${p.name} — ${brand}` : (titles[view] || brand);
  }, [view, selectedId, settings, products]);

  // блокируем прокрутку под меню и закрываем его по Esc
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  const byId = (id) => (products || []).find((p) => p.id === id);

  /* --- Адреса страниц: #/, #/product/12, #/cart … Работает «Назад» и ссылки --- */
  const go = (v, id) => {
    const hash = v === "catalog" ? "#/" : v === "product" ? `#/product/${id}` : `#/${v}`;
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
    setView(v); setFade(true); window.scrollTo({ top: 0 });
    // засчитываем переход в Яндекс.Метрике (SPA hit)
    try { if (window.ym) window.ym(window.__ym_id, "hit", hash); } catch (e) {}
  };
  const openProduct = (id) => { setSelectedId(id); go("product", id); };
  const openCatalog = (cat) => { if (cat) setActiveCat(cat); go("catalog"); };

  // читаем адрес при загрузке и по кнопке «Назад»
  useEffect(() => {
    const applyHash = () => {
      const raw = window.location.hash;
      // ссылка подтверждения почты приходит как #access_token=...&type=signup —
      // это адрес Supabase, а не наш маршрут: не трогаем, клиент сам заберёт сессию
      if (raw.includes("access_token=") || raw.includes("error_description=")) return;
      const h = raw.replace(/^#\/?/, "");
      const [seg, id] = h.split("/");
      if (seg === "product" && id) { setSelectedId(Number(id)); setView("product"); }
      else if (["cart", "checkout", "favorites", "info", "account", "orders", "login", "admin", "success"].includes(seg)) setView(seg);
      else setView("catalog");
      setFade(true);
    };
    applyHash();
    window.addEventListener("popstate", applyHash);
    window.addEventListener("hashchange", applyHash);
    return () => { window.removeEventListener("popstate", applyHash); window.removeEventListener("hashchange", applyHash); };
  }, []);

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

  // похожие: сначала тот же тип, затем та же категория
  const relatedTo = (p) => {
    if (!p) return [];
    const pool = products.filter((x) => x.id !== p.id && x.stock > 0);
    const sameType = pool.filter((x) => x.type === p.type);
    const sameCat = pool.filter((x) => x.cat === p.cat && x.type !== p.type);
    return [...sameType, ...sameCat].slice(0, 4);
  };
  const openSearch = () => { openCatalog("Всё"); setTimeout(() => document.getElementById("search-input")?.focus(), 40); };

  /* --- Заказ: пишем в базу (остатки уменьшит триггер), обновляем список --- */
  const placeOrder = async (order) => {
    try {
      // сверяем остатки с базой: вещь могли разобрать, пока покупатель заполнял форму
      const fresh = await fetchProducts();
      const short = order.items.filter((i) => {
        const p = fresh.find((x) => x.id === i.id);
        return !p || p.stock < i.qty;
      });
      if (short.length) {
        setProducts(fresh.map(normalizeProduct));
        return { ok: false, error: `Не хватает на складе: ${short.map((i) => i.name).join(", ")}. Мы обновили наличие — измените количество.` };
      }
      await createOrder(order, user?.id);
      try { localStorage.removeItem("arsene_guest_cart"); } catch (e) { /* ok */ }
      setLastOrderId(order.id);
      setCart([]);
      const [prods, ords] = await Promise.all([fetchProducts(), user ? fetchOrders() : Promise.resolve([])]);
      setProducts(prods.map(normalizeProduct));
      setOrders(ords);
      go("success");
      return { ok: true };
    } catch (e) {
      console.error(e);
      return { ok: false, error: "Не удалось сохранить заказ: " + (e.message || "ошибка сети") };
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
    // вошли сразу (подтверждение почты выключено) — открываем каталог
    if (r.ok && r.signedIn) go("catalog");
    // иначе AuthView покажет экран «проверьте почту», вход случится сам по ссылке
    return r;
  };
  const logout = async () => { await signOut(); setIsAdmin(false); setUser(null); setCart([]); setFavorites([]); setOrders([]); go("catalog"); };

  if (booting || !products || !settings) {
    return (
      <div className="store">
        <style>{css}</style>
        <div className="announce skel-announce" />
        <header className="header">
          <div className="skel skel-nav" />
          <div className="skel skel-word" />
          <div className="skel skel-nav" />
        </header>
        <section className="hero">
          <div className="skel skel-line" style={{ width: 140, margin: "0 auto 22px" }} />
          <div className="skel skel-title" />
          <div className="skel skel-line" style={{ width: 320, margin: "26px auto 34px" }} />
        </section>
        <section className="catalog">
          <div className="grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card">
                <div className="skel skel-media" />
                <div className="skel skel-line" style={{ width: "70%", marginTop: 14 }} />
                <div className="skel skel-line" style={{ width: "40%", marginTop: 8 }} />
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }
  if (fatal) {
    return <div className="store"><style>{css}</style><div className="boot boot-error">{fatal}</div></div>;
  }

  const accountTarget = isAdmin ? "admin" : user ? "account" : "login";
  const themeClass = activeCat === "Quiet Luxe" ? "theme-luxe" : "theme-heritage";

  return (
    <div className={`store ${themeClass}`}>
      <style>{css}</style>
      <ScrollProgress />
      {justConfirmed && (
        <div className="welcome-toast" role="status">
          <Check size={17} />
          <span>Почта подтверждена{user?.name ? `, ${user.name}` : ""} — вы вошли в аккаунт</span>
        </div>
      )}
      <BackToTop />
      <div className="announce">{settings.announce}</div>

      <Header
        brand={BRAND} logo={settings.logo} cartCount={cartCount} favCount={favorites.length} isAdmin={isAdmin} user={user}
        onLogo={() => openCatalog("Всё")} onCart={() => go("cart")} onNav={openCatalog} onSearch={openSearch}
        onFavs={() => go("favorites")} onMenu={() => setMenuOpen(true)}
        onAccount={() => go(accountTarget)} onLogout={logout}
      />

      {menuOpen && (
        <div className="mobile-menu">
          <div className="mm-top">
            <Wordmark size={24} />
            <button className="icon-btn menu-close" onClick={() => setMenuOpen(false)} aria-label="Закрыть"><X size={22} /></button>
          </div>
          <div className="mm-links">
            {CATEGORIES.map((c, i) => (
              <button key={c} className="mobile-link" style={{ animationDelay: `${i * 45}ms` }} onClick={() => { openCatalog(c); setMenuOpen(false); }}>
                <span>{catLabel(c)}</span><ArrowRight size={18} />
              </button>
            ))}
            <button className="mobile-link" style={{ animationDelay: "180ms" }} onClick={() => { go("favorites"); setMenuOpen(false); }}><span>Избранное</span><Heart size={17} /></button>
            <button className="mobile-link" style={{ animationDelay: "225ms" }} onClick={() => { go("info"); setMenuOpen(false); }}><span>О бренде</span><ArrowRight size={18} /></button>
            <button className="mobile-link" style={{ animationDelay: "270ms" }} onClick={() => { go(accountTarget); setMenuOpen(false); }}><span>{user ? "Мой аккаунт" : isAdmin ? "Админ-панель" : "Вход и регистрация"}</span><User size={17} /></button>
          </div>
          <div className="mm-foot">
            {settings.telegram && <a href={settings.telegram} target="_blank" rel="noreferrer" className="mm-social"><Send size={15} /> Telegram</a>}
            {settings.instagram && <a href={settings.instagram} target="_blank" rel="noreferrer" className="mm-social">Instagram</a>}
          </div>
        </div>
      )}

      <main className={fade ? "page page-in" : "page"}>
      {view === "catalog" && (
        <CatalogView settings={settings} products={products} activeCat={activeCat} setActiveCat={setActiveCat}
          onOpen={openProduct} onInfo={() => go("info")} query={query} setQuery={setQuery} favorites={favorites} onFav={toggleFav} />
      )}
      {view === "product" && selectedId && byId(selectedId) && (
        (() => {
          const idx = products.findIndex((x) => x.id === selectedId);
          const prevP = idx > 0 ? products[idx - 1] : null;
          const nextP = idx < products.length - 1 ? products[idx + 1] : null;
          return (
            <ProductView key={selectedId} product={byId(selectedId)} onBack={() => openCatalog()} onAdd={addToCart}
              inCart={cart.filter((i) => i.id === selectedId).reduce((s, i) => s + i.qty, 0)}
              related={relatedTo(byId(selectedId))} onOpen={openProduct} favorites={favorites} onFavId={toggleFav}
              pieceIndex={Math.max(0, idx)} pieceTotal={products.length}
              onPrev={prevP ? () => openProduct(prevP.id) : undefined} onNext={nextP ? () => openProduct(nextP.id) : undefined}
              onGoCart={() => go("cart")} isFav={favorites.includes(selectedId)} onFav={() => toggleFav(selectedId)} />
          );
        })()
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
        <CheckoutView cart={cart} byId={byId} user={user} settings={settings} onBack={() => go("cart")} onPlace={placeOrder} onTgFallback={setTgFallback} onMeta={setPayMeta} />
      )}
      {view === "success" && <SuccessView brand={BRAND} orderId={lastOrderId} canTrack={!!user} tgLink={tgFallback} payMeta={payMeta} settings={settings} onOrders={() => go("orders")} onShop={() => { setTgFallback(""); setPayMeta(null); openCatalog("Всё"); }} />}
      {view === "orders" && (
        user
          ? <OrdersView orders={orders.filter((o) => o.userId === user.id)} onShop={() => openCatalog("Всё")} onBack={() => go("account")} onCancel={(id) => updateOrderStatus(id, "Отменён")} />
          : <AuthView onLogin={login} onRegister={register} onBack={() => openCatalog("Всё")} />
      )}
      {view === "account" && (
        user
          ? <AccountView user={user} favCount={favorites.length} cartCount={cartCount} ordersCount={orders.filter((o) => o.userId === user.id).length}
              onFavs={() => go("favorites")} onCart={() => go("cart")} onOrders={() => go("orders")} onLogout={logout} onShop={() => openCatalog("Всё")} />
          : <AuthView brand={BRAND} onLogin={login} onRegister={register} onBack={() => openCatalog("Всё")} />
      )}
      {view === "login" && <AuthView brand={BRAND} onLogin={login} onRegister={register} onBack={() => openCatalog("Всё")} />}
      {view === "admin" && (
        isAdmin
          ? <AdminView products={products} settings={settings} orders={orders} onAdd={addProduct} onUpdate={updateProduct} onDelete={deleteProduct}
              onLogout={logout} onPreview={openProduct} onSaveSettings={updateSettings} onAddType={addType} onOrderStatus={updateOrderStatus} />
          : <AuthView brand={BRAND} onLogin={login} onRegister={register} onBack={() => openCatalog("Всё")} />
      )}

      </main>

      <Footer settings={settings} onNav={openCatalog} onInfo={() => go("info")} onAdmin={() => go(accountTarget)} isAdmin={isAdmin} user={user} />
    </div>
  );
}

/* -------------------------------- Шапка -------------------------------- */
function Header({ brand, logo, cartCount, favCount, isAdmin, onLogo, onCart, onNav, onMenu, onAccount, onLogout, onSearch, onFavs }) {
  return (
    <header className="header">
      <button className="icon-btn only-mobile" aria-label="Меню" onClick={onMenu}><Menu size={20} /></button>
      <nav className="nav only-desktop">
        {SHOP_CATS.map((c) => <button key={c} className="nav-link" onClick={() => onNav(c)}>{LINE_SHORT[c] || c}</button>)}
        {isAdmin && <button className="nav-link nav-admin" onClick={onAccount}>Админ</button>}
      </nav>
      <button className="wordmark" onClick={onLogo} aria-label={brand}>
        {logo ? <img className="brand-logo" src={logo} alt={brand} /> : <Wordmark size={22} />}
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
          {cartCount > 0 && <span key={cartCount} className="cart-badge badge-pop">{cartCount}</span>}
        </button>
      </div>
    </header>
  );
}

/* ------------------------------ Каталог ------------------------------ */
/* --------- Появление секций при прокрутке --------- */
function Reveal({ children, delay = 0, className = "" }) {
  const ref = React.useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { el.classList.add("rv-in"); io.disconnect(); } }),
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`rv ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

/* --------- Полоса прогресса прокрутки --------- */
function ScrollProgress() {
  const ref = React.useRef(null);
  useEffect(() => {
    const on = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      if (ref.current) ref.current.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, []);
  return <div ref={ref} className="scroll-progress" />;
}

/* --------- Кнопка «наверх» --------- */
function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 700);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  if (!show) return null;
  return <button className="to-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Наверх">↑</button>;
}

/* --------- Фирменное начертание: ROVELLE + линия --------- */
function Wordmark({ animate = false, size = 30 }) {
  // фирменное начертание ROVELLE, обведённое с логотипа — не шрифт, а сам знак
  return <span className={`wm-brand ${animate ? "wm-brand-in" : ""}`} style={{ height: size }} role="img" aria-label="ROVELLE" />;
}

/* --------- Сменяющиеся слова --------- */
function RotatingWord({ words, interval = 2200 }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [words.length, interval]);
  return <span key={i} className="rot-word">{words[i]}</span>;
}

/* --------- Логотип бренда: точная векторная копия знака, цвет следует теме --------- */
function Monogram({ size = 150 }) {
  return <div className="mono-img" style={{ width: size, height: size }} role="img" aria-label="ROVELLE" />;
}

/* --------- Первый экран: свет за курсором + параллакс --------- */
function BrandHero({ settings, activeCat, setActiveCat, onDrop, onInfo }) {
  const ref = React.useRef(null);
  const markRef = React.useRef(null);

  useEffect(() => {
    const onScroll = () => {
      if (markRef.current) markRef.current.style.transform = `translate(-50%, calc(-50% + ${window.scrollY * 0.22}px))`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <section className="bhero" ref={ref} onMouseMove={onMove}>
      <div className="bhero-glow" aria-hidden="true" />
      <div className="bhero-mark" ref={markRef} aria-hidden="true">RV</div>
      <h1 className="bhero-name"><Wordmark animate size={64} /></h1>
      <Reveal delay={700}><p className="bhero-tag">{settings.heroSub}</p></Reveal>
      <Reveal delay={600}>
        <div className="hero-lines">
          {[["Archive", "Heritage"], ["Quiet Luxe", "Quiet Luxe"]].map(([val, label]) => (
            <button key={val} className={`hero-line-btn ${activeCat === val ? "on" : ""}`} onClick={() => setActiveCat(val)}>
              {label}
            </button>
          ))}
        </div>
      </Reveal>
      <Reveal delay={850}>
        <div className="bhero-cta">
          <button className="btn-primary" onClick={onDrop}>Смотреть коллекцию <ArrowRight size={15} /></button>
          <button className="btn-ghost" onClick={onInfo}>Философия</button>
        </div>
      </Reveal>
      <div className="bhero-est">{settings.heroEyebrow} · <RotatingWord words={["Архив", "Стокгольм", "Винтаж", "Без логотипов"]} /></div>
      <div className="bhero-scroll" aria-hidden="true"><span /></div>
    </section>
  );
}

/* --------- «Живое» фото вещи: наклон, вторая картинка, блик --------- */
function PieceMedia({ p, onOpen }) {
  const gallery = getGallery(p);
  const alt = gallery[1]?.src ? gallery[1] : null;
  const ref = React.useRef(null);

  const move = (e) => {
    const el = ref.current;
    if (!el || window.matchMedia("(pointer: coarse)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 4).toFixed(2)}deg)`;
    el.style.setProperty("--gx", `${e.clientX - r.left}px`);
    el.style.setProperty("--gy", `${e.clientY - r.top}px`);
  };
  const leave = () => { if (ref.current) ref.current.style.transform = ""; };

  return (
    <button className="piece-media" ref={ref} onMouseMove={move} onMouseLeave={leave} onClick={onOpen} aria-label={p.name}>
      <Media p={p} img={gallery[0]} large />
      {alt && <img className="piece-alt" src={alt.src} alt="" loading="lazy" />}
      <span className="piece-glow" aria-hidden="true" />
      <span className="piece-shine" aria-hidden="true" />
      {p.tag && <span className="piece-tag">{p.tag}</span>}
      <span className="piece-view"><Search size={15} /> Открыть</span>
    </button>
  );
}

/* --------- Дополнительная информация (аккордеон) --------- */
const FAQ_ITEMS = [
  ["Доставка", "Курьером по городу, СДЭК по всей России или самовывоз. Обычный срок — 1–3 дня. При заказе от 5 000 ₽ доставка бесплатная."],
  ["Оплата", "СБП онлайн-переводом или при получении. После оформления открывается чат с менеджером в Telegram — он подтверждает оплату и заказ, обычно в течение часа."],
  ["Возврат", "14 дней на возврат, если вещь не подошла: без следов носки, с сохранённой комплектацией. Напишите менеджеру — организуем обратную доставку."],
  ["Как мы отбираем вещи", "Каждая позиция проходит ручной отбор: смотрим швы, фактуру, честность денима и посадку. В коллекцию попадает малая часть из того, что мы находим."],
];
function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <div className="faq">
      {FAQ_ITEMS.map(([q, a], i) => (
        <div key={q} className={`faq-item ${open === i ? "open" : ""}`}>
          <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)}>
            <span>{q}</span>
            <Plus size={16} className="faq-plus" />
          </button>
          <div className="faq-a"><p>{a}</p></div>
        </div>
      ))}
    </div>
  );
}

/* ============================ ГЛАВНАЯ БРЕНДА ============================ */
function CatalogView({ settings, products, activeCat, setActiveCat, onOpen, onInfo, query, setQuery, favorites, onFav }) {
  const q = query.trim().toLowerCase();
  const inLine = (p) => activeCat === "Всё" || p.cat === activeCat;
  const list = products.filter((p) => inLine(p) &&
    (!q || `${p.name} ${p.brand || ""} ${p.material || ""} ${typeLabel(p.type)}`.toLowerCase().includes(q)));

  const scrollToDrop = (line) => {
    if (line) setActiveCat(line);
    setTimeout(() => document.getElementById("drop")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  };

  const luxeEmpty = activeCat === "Quiet Luxe" && list.length === 0;
  const tickerWords = ["Heritage", "Stockholm", "Vintage", "Тихая роскошь", "No logo", "Quiet Luxe", "Детали", "Посадка"];
  const shots = products.flatMap((p) => (p.images || []).map((im, i) => ({ src: imgThumb(im), id: `${p.id}-${i}`, pid: p.id, name: p.name })));

  return (
    <>
      <BrandHero settings={settings} activeCat={activeCat} setActiveCat={setActiveCat} onDrop={() => scrollToDrop("Archive")} onInfo={onInfo} />

      {/* ---------- Бегущая строка ---------- */}
      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[...tickerWords, ...tickerWords, ...tickerWords].map((w, i) => (
            <span key={i} className="ticker-item">{w}<i>·</i></span>
          ))}
        </div>
      </div>

      {/* ---------- Две линии — два мира ---------- */}
      <section className="lines">
        <button className="line-panel line-archive" onClick={() => scrollToDrop("Archive")}>
          <span className="line-no">Линия 1</span>
          <span className="line-name">{settings.line1Name || "Heritage"}</span>
          <span className="line-desc">{settings.line1Desc}</span>
          <span className="line-go">Смотреть вещи <ArrowRight size={14} /></span>
        </button>
        <button className="line-panel line-luxe" onClick={() => scrollToDrop("Quiet Luxe")}>
          <span className="line-no">Линия 2</span>
          <span className="line-name">{settings.line2Name || "Quiet Luxe"}</span>
          <span className="line-desc">{settings.line2Desc}</span>
          <span className="line-go">Скоро <ArrowRight size={14} /></span>
        </button>
      </section>

      {/* ---------- Цифры бренда ---------- */}
      <section className="stats">
        {[["001", "номер коллекции"], ["2", "линии бренда"], ["14", "дней на возврат"], ["100%", "ручной отбор"]].map(([n, l], i) => (
          <Reveal key={l} delay={i * 90}>
            <div className="stat"><span className="stat-n">{n}</span><span className="stat-l">{l}</span></div>
          </Reveal>
        ))}
      </section>

      {/* ---------- Дроп ---------- */}
      <section className="drop" id="drop">
        <Reveal>
          <div className="drop-head">
            <div>
              <div className="drop-eyebrow">{activeCat === "Quiet Luxe" ? "Линия 2" : "Коллекция 001 · Heritage"}</div>
              <h2 className="drop-title">{activeCat === "Quiet Luxe" ? "Quiet Luxe" : "Первые вещи"}</h2>
            </div>
            <div className="drop-tools">
              <div className="line-tabs">
                {CATEGORIES.map((c) => (
                  <button key={c} className={activeCat === c ? "on" : ""} onClick={() => setActiveCat(c)}>{catLabel(c)}</button>
                ))}
              </div>
              <div className="search-wrap">
                <Search size={15} />
                <input id="search-input" placeholder="Поиск" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
            </div>
          </div>
        </Reveal>

        {luxeEmpty ? (
          <Reveal>
            <div className="luxe-tease">
              <Monogram size={90} />
              <h3>Линия готовится</h3>
              <p>Поло из благородного хлопка, брюки с идеальной посадкой, полузамки и лоферы. Без логотипов — только ткань и крой. Следите в Telegram, чтобы не пропустить запуск.</p>
              {settings.telegram && <a className="btn-primary" href={settings.telegram} target="_blank" rel="noreferrer"><Send size={15} /> Ждать в Telegram</a>}
            </div>
          </Reveal>
        ) : list.length === 0 ? (
          <p className="drop-empty">{q ? "Ничего не нашлось — попробуйте другой запрос." : "Вещи скоро появятся."}</p>
        ) : (
          <div className="drop-list">
            {list.map((p, i) => (
              <React.Fragment key={p.id}>
              {i === 2 && (
                <Reveal className="manifesto-card-wrap">
                  <div className="manifesto-card">
                    <Monogram size={64} />
                    <p>{(settings.manifesto || "Мы не печатаем логотипы.\nМы прошиваем историю.").split("\n").map((ln, k) => <React.Fragment key={k}>{k > 0 && <br />}{ln}</React.Fragment>)}</p>
                  </div>
                </Reveal>
              )}
              <Reveal delay={(i % 2) * 80} className={i % 2 ? "rv-right" : "rv-left"}>
                <article className={`piece ${i % 2 ? "piece-flip" : ""}`}>
                  <PieceMedia p={p} onOpen={() => onOpen(p.id)} />
                  <div className="piece-info">
                    <div className="piece-no">{String(i + 1).padStart(2, "0")} <span>/ {String(list.length).padStart(2, "0")}</span></div>
                    <h3 className="piece-name">{p.name}</h3>
                    <div className="piece-meta">{LINE_LABELS[p.cat] || p.cat} · {typeLabel(p.type)}</div>
                    <p className="piece-desc">{p.desc}</p>
                    {(p.materials && p.materials.length > 0) ? (
                      <div className="piece-mats">
                        {p.materials.map((m, mi) => (
                          <div className="piece-material" key={mi}>
                            <div className="pm-swatch">
                              {m.photo ? <img src={imgThumb(m.photo)} alt={m.name} loading="lazy" />
                                : <span className="pm-color" style={{ background: (p.colors && p.colors[0]) || "#8f8677" }} />}
                            </div>
                            <div className="pm-text">
                              <span className="pm-label">Материал</span>
                              <span className="pm-value">{m.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : p.material && (
                      <div className="piece-material">
                        <div className="pm-swatch">
                          {getGallery(p).length > 1
                            ? <img src={getGallery(p)[getGallery(p).length - 1].thumb} alt="Материал" loading="lazy" />
                            : <span className="pm-color" style={{ background: (p.colors && p.colors[0]) || "#8f8677" }} />}
                        </div>
                        <div className="pm-text">
                          <span className="pm-label">Материал</span>
                          <span className="pm-value">{p.material}</span>
                        </div>
                      </div>
                    )}
                    <div className="piece-sizes">{(p.sizes || []).map((s) => <span key={s}>{s}</span>)}</div>
                    <div className="piece-row">
                      <div className="piece-price">
                        {p.oldPrice > 0 && <span className="old">{money(p.oldPrice)}</span>}
                        <span className={p.oldPrice > 0 ? "sale-price" : ""}>{money(p.price)}</span>
                      </div>
                      <div className="piece-actions">
                        <button className={`fav-btn ${favorites.includes(p.id) ? "fav-on" : ""}`} onClick={() => onFav(p.id)} aria-label="В избранное">
                          <Heart size={17} fill={favorites.includes(p.id) ? "currentColor" : "none"} />
                        </button>
                        <button className="btn-primary" onClick={() => onOpen(p.id)}>Смотреть вещь</button>
                      </div>
                    </div>
                    {p.stock > 0 && p.stock <= 3 && <div className="piece-low">Осталось {p.stock} шт</div>}
                    {p.stock <= 0 && <div className="piece-out">Распродано</div>}
                  </div>
                </article>
              </Reveal>
              </React.Fragment>
            ))}
          </div>
        )}
      </section>

      {/* ---------- Лента кадров ---------- */}
      {shots.length > 1 && (
        <section className="strip" aria-label="Кадры коллекции">
          <div className="strip-track">
            {shots.map((sh) => (
              <button key={sh.id} className="strip-shot" onClick={() => onOpen(sh.pid)} title={sh.name}>
                <img src={sh.src} alt={sh.name} loading="lazy" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---------- Что мы проверяем ---------- */}
      <section className="craft">
        <Reveal><h2 className="craft-title">{settings.philosophyText || "Мы отбираем каждую вещь вручную — за фактуру, крой и историю, а не за логотип."}</h2></Reveal>
        <div className="craft-grid">
          {[
            ["01", "Швы и фактуры", "Архивные стирки, честный деним, необычные обработки. Вещь интересно рассматривать вблизи."],
            ["02", "История вещи", "Каждая позиция выглядит как архивная находка, но сделана как новая — и продумана до мелочей."],
            ["03", "Посадка", "Стокгольмская чистота силуэта. Никакого визуального шума — форма говорит сама."],
          ].map(([n, t, d], i) => (
            <Reveal key={n} delay={i * 100}>
              <div className="craft-card"><span className="craft-no">{n}</span><h3>{t}</h3><p>{d}</p></div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- Quiet Luxe — тёмный тизер ---------- */}
      <section className="luxe" onMouseMove={(e) => {
        const el = e.currentTarget; const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}>
        <div className="luxe-glow" aria-hidden="true" />
        <Reveal>
          <div className="luxe-inner">
            <div className="luxe-eyebrow">Линия 2 · скоро</div>
            <h2 className="luxe-title">Quiet <em>Luxe</em></h2>
            <p className="luxe-text">{settings.luxeText}</p>
            {settings.telegram && (
              <a className="luxe-btn" href={settings.telegram} target="_blank" rel="noreferrer">
                <Send size={15} /> Узнать о запуске первым
              </a>
            )}
          </div>
        </Reveal>
      </section>

      {/* ---------- Дополнительная информация ---------- */}
      <section className="info-block">
        <Reveal>
          <div className="drop-eyebrow">Как всё устроено</div>
          <h2 className="drop-title" style={{ marginBottom: 34 }}>Вопросы и ответы</h2>
        </Reveal>
        <Reveal delay={120}><FAQ /></Reveal>
      </section>
    </>
  );
}

function ProductCard({ p, onOpen, isFav, onFav }) {
  const gallery = getGallery(p);
  const cover = gallery[0];
  const alt = gallery[1]?.src ? gallery[1] : null;
  const soldOut = p.stock <= 0;
  const low = !soldOut && p.stock <= 3;
  const ref = React.useRef(null);

  const move = (e) => {
    const el = ref.current;
    if (!el || window.matchMedia("(pointer: coarse)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(x * 6).toFixed(2)}deg`);
    el.style.setProperty("--gx", `${(e.clientX - r.left)}px`);
    el.style.setProperty("--gy", `${(e.clientY - r.top)}px`);
  };
  const leave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  return (
    <article className="card" onClick={onOpen} ref={ref} onMouseMove={move} onMouseLeave={leave}>
      <div className="card-media">
        <div className="card-imgwrap">
          <Media p={p} img={cover} />
          {alt && <img className="card-alt" src={alt.src} alt="" loading="lazy" />}
        </div>
        <span className="card-glow" aria-hidden="true" />
        <span className="card-shine" aria-hidden="true" />
        <div className="card-badges">
          {p.tag && <span className={`badge ${p.tag === "Sale" ? "badge-sale" : ""}`}>{p.tag}</span>}
          {low && <span className="badge badge-low">Осталось {p.stock}</span>}
          {soldOut && <span className="badge badge-out">Распродано</span>}
        </div>
        <button className={`wish ${isFav ? "wish-on" : ""}`} aria-label="В избранное"
          onClick={(e) => { e.stopPropagation(); onFav(); }}>
          <Heart size={16} fill={isFav ? "currentColor" : "none"} />
        </button>
        <div className="card-quick" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
          <span>Смотреть вещь <ArrowRight size={14} /></span>
        </div>
      </div>
      <div className="card-body">
        <div className="card-line">{LINE_SHORT[p.cat] || p.cat} · {typeLabel(p.type)}</div>
        <div className="card-top">
          <h3 className="card-name">{p.name}</h3>
          <div className="card-price">
            {p.oldPrice > 0 && <span className="old">{money(p.oldPrice)}</span>}
            <span className={p.oldPrice > 0 ? "sale-price" : ""}>{money(p.price)}</span>
          </div>
        </div>
        <div className="card-foot">
          <div className="card-sizes">{(p.sizes || []).slice(0, 5).map((s) => <span key={s}>{s}</span>)}</div>
          <div className="swatches">{(p.colors || []).slice(0, 4).map((c, i) => <span key={i} className="swatch" style={{ background: c }} />)}</div>
        </div>
      </div>
    </article>
  );
}

/* --------------------------- Страница товара --------------------------- */
/* --------- Изображение с зумом по наведению (десктоп) --------- */
function ZoomImage({ p, img, onOpen }) {
  const ref = React.useRef(null);
  const [zoom, setZoom] = useState(false);
  const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  const move = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    el.style.setProperty("--zx", `${Math.max(0, Math.min(100, x))}%`);
    el.style.setProperty("--zy", `${Math.max(0, Math.min(100, y))}%`);
  };

  if (img && img.src) {
    return (
      <div
        ref={ref}
        className={`zoom-img ${zoom ? "zoomed" : ""}`}
        onMouseMove={move}
        onMouseEnter={() => !coarse && setZoom(true)}
        onMouseLeave={() => setZoom(false)}
        onClick={onOpen}
        role="button"
        aria-label="Открыть фото на весь экран"
        style={{ "--zurl": `url(${img.zoom || img.src})` }}
      >
        <Media p={p} img={img} large eager />
        <span className="zoom-hint"><Search size={14} /> {coarse ? "Нажмите, чтобы увеличить" : "Наведите для зума · клик — на весь экран"}</span>
      </div>
    );
  }
  return <div className="zoom-img" onClick={onOpen}><Media p={p} img={img} large /></div>;
}

/* --------- Лайтбокс: галерея на весь экран --------- */
function Lightbox({ images, index, p, onClose, onIndex }) {
  const [scale, setScale] = useState(1);
  const startX = React.useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % images.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [index, images.length, onClose, onIndex]);

  const cur = images[index];
  const go = (d) => { setScale(1); onIndex((index + d + images.length) % images.length); };

  return (
    <div className="lb" role="dialog" aria-modal="true">
      <div className="lb-bar">
        <span className="lb-count">{index + 1} / {images.length}</span>
        <div className="lb-tools">
          <button onClick={() => setScale((s) => (s === 1 ? 2 : 1))} aria-label="Увеличить">{scale === 1 ? <Plus size={18} /> : <Minus size={18} />}</button>
          <button onClick={onClose} aria-label="Закрыть"><X size={20} /></button>
        </div>
      </div>
      <div className="lb-stage" onClick={onClose}>
        {images.length > 1 && <button className="lb-nav lb-prev" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Предыдущее"><ArrowLeft size={22} /></button>}
        <div
          className="lb-imgwrap"
          onClick={(e) => { e.stopPropagation(); setScale((s) => (s === 1 ? 2 : 1)); }}
          onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (startX.current == null) return;
            const dx = e.changedTouches[0].clientX - startX.current;
            if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);
            startX.current = null;
          }}
        >
          <img src={cur.zoom || cur.src} alt={p.name} style={{ transform: `scale(${scale})`, cursor: scale === 1 ? "zoom-in" : "zoom-out" }} />
        </div>
        {images.length > 1 && <button className="lb-nav lb-next" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Следующее"><ArrowRight size={22} /></button>}
      </div>
      {images.length > 1 && (
        <div className="lb-thumbs" onClick={(e) => e.stopPropagation()}>
          {images.map((im, i) => (
            <button key={im.key} className={`lb-thumb ${i === index ? "on" : ""}`} onClick={() => { setScale(1); onIndex(i); }}>
              <img src={im.thumb || im.src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------- Чистый аккордеон характеристик на странице вещи --------- */
function ProductAccordion({ p }) {
  const [open, setOpen] = useState("care");
  const rows = [];
  const hasMats = p.materials && p.materials.length > 0;
  const careContent = hasMats ? (
    <div className="acc-mats">
      {p.materials.map((m, i) => (
        <div className="acc-mat" key={i}>
          {m.photo && <img src={imgThumb(m.photo)} alt={m.name} loading="lazy" />}
          <span>{m.name}</span>
        </div>
      ))}
      <div className="acc-care">{p.care || "Бережная стирка, сушить в расправленном виде."}</div>
    </div>
  ) : p.material ? (
    <>{p.material}{p.care ? <><br />{p.care}</> : <><br />Бережная стирка, сушить в расправленном виде.</>}</>
  ) : null;
  if (careContent) rows.push(["care", "Состав и уход", careContent]);
  rows.push(["fit", "Размер и посадка", p.fit || "Классическая посадка. Между размерами выбирайте меньший для чёткого силуэта."]);
  rows.push(["ship", "Доставка и возврат", <>{p.delivery}, бесплатно от 5 000 ₽. Возврат в течение 14 дней.</>]);

  return (
    <div className="p-acc">
      {rows.map(([k, q, a]) => (
        <div key={k} className={`p-acc-item ${open === k ? "open" : ""}`}>
          <button className="p-acc-q" onClick={() => setOpen(open === k ? "" : k)}>
            <span>{q}</span><Plus size={15} className="p-acc-plus" />
          </button>
          <div className="p-acc-a"><div>{a}</div></div>
        </div>
      ))}
    </div>
  );
}

/* --------- Богатая карточка вещи: вкладки с деталями --------- */
function ProductStory({ p, onZoom }) {
  const gallery = getGallery(p);
  const highlights = (p.highlights || "").split("\n").map((x) => x.trim()).filter(Boolean);
  const fabrics = fabricsOf(p.material).map(capit);
  // «фактурные» кадры — все фото кроме обложки; если фото одно, секция для крупного плана всё равно полезна
  const details = gallery.length > 1 ? gallery.slice(1) : gallery;

  return (
    <div className="pstory">
      {/* широкая цитата-манифест вещи */}
      {p.desc && (
        <Reveal className="pstory-quote-wrap">
          <div className="pstory-quote">
            <span className="pstory-mark">”</span>
            <p>{p.desc}</p>
            <span className="pstory-sign">{LINE_LABELS[p.cat] || p.cat}</span>
          </div>
        </Reveal>
      )}

      {/* чередующиеся полосы: деталь + подпись */}
      {details.length > 0 && (
        <div className="pstory-bands">
          {details.slice(0, 3).map((img, i) => {
            const cap = highlights[i];
            return (
              <Reveal key={img.key} className="pstory-band-wrap">
                <div className={`pstory-band ${i % 2 ? "flip" : ""}`}>
                  <button className="pstory-media" onClick={() => onZoom(gallery.indexOf(img))} aria-label="Открыть на весь экран">
                    <img src={img.src} alt={p.name} loading="lazy" />
                    <span className="pstory-zoom"><Search size={16} /></span>
                  </button>
                  <div className="pstory-text">
                    <span className="pstory-no">{String(i + 1).padStart(2, "0")}</span>
                    <h3>{cap || ["Детали, которые видно вблизи", "Фактура и материал", "Посадка и силуэт"][i] || "Крупный план"}</h3>
                    <p>{i === 0 && fabrics.length ? `Состав: ${fabrics.join(", ")}. ` : ""}{cap ? "" : "Наведите на фото для увеличения — рассмотрите вещь так, будто держите её в руках."}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      )}

      {/* лента фактуры: макро-кадры в ряд */}
      {gallery.length > 1 && (
        <Reveal className="texture-wrap">
          <div className="drop-eyebrow">Фактура</div>
          <h2 className="drop-title" style={{ marginBottom: 22 }}>Крупным планом</h2>
          <div className="texture-strip">
            {gallery.map((img, i) => (
              <button key={img.key} className="texture-shot" onClick={() => onZoom(i)}>
                <img src={img.thumb || img.src} alt={p.name} loading="lazy" />
                <span className="texture-zoom"><Search size={15} /></span>
              </button>
            ))}
          </div>
        </Reveal>
      )}
    </div>
  );
}

/* --------- Кинематографичная история вещи конец --------- */

function ProductView({ product: p, onBack, onAdd, onGoCart, isFav, onFav, inCart = 0, related = [], onOpen, favorites = [], onFavId, pieceIndex = 0, pieceTotal = 1, onPrev, onNext }) {
  const images = getGallery(p);
  const [active, setActive] = useState(0);
  const [imgKey, setImgKey] = useState(0); // для плавной смены кадра
  const [lightbox, setLightbox] = useState(false);
  const singleSize = p.sizes.length === 1;
  const [size, setSize] = useState(singleSize ? p.sizes[0] : null);
  const [added, setAdded] = useState(false);
  const [askSize, setAskSize] = useState(false);
  const [stockErr, setStockErr] = useState("");
  const soldOut = p.stock <= 0;
  const maxedOut = !soldOut && inCart >= p.stock;

  const showImg = (i) => { if (i === active) return; setActive(i); setImgKey((k) => k + 1); };

  const doAdd = (sz) => {
    const r = onAdd(p.id, sz);
    if (r && !r.ok) { setStockErr(r.error); setTimeout(() => setStockErr(""), 2500); return; }
    setStockErr("");
    setAdded(true); setTimeout(() => setAdded(false), 1800);
  };
  const handleAdd = () => { if (size) doAdd(size); else setAskSize(true); };
  const pickInPrompt = (s) => { setSize(s); setAskSize(false); doAdd(s); };

  const fabrics = fabricsOf(p.material).map(capit);

  return (
    <section className="product">
      <div className="p-top">
        <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Коллекция</button>
        <div className="p-crumb">
          Вещь <b>{String(pieceIndex + 1).padStart(2, "0")}</b> / {String(pieceTotal).padStart(2, "0")}
          <span className="p-crumb-nav">
            <button onClick={onPrev} disabled={!onPrev} aria-label="Предыдущая"><ArrowLeft size={14} /></button>
            <button onClick={onNext} disabled={!onNext} aria-label="Следующая"><ArrowRight size={14} /></button>
          </span>
        </div>
      </div>

      <div className="product-grid">
        <div className="gallery">
          <div className="main-img">
            <div key={imgKey} className="main-img-frame"><ZoomImage p={p} img={images[active]} onOpen={() => setLightbox(true)} /></div>
            {p.tag && <span className="piece-tag">{p.tag}</span>}
            <button className="img-expand" onClick={() => setLightbox(true)} aria-label="На весь экран"><Plus size={16} /></button>
          </div>
          {images.length > 1 && (
            <div className="thumbs">
              {images.map((img, i) => (
                <button key={img.key} className={`thumb ${i === active ? "thumb-active" : ""}`} onClick={() => showImg(i)} aria-label={img.label}>
                  <Media p={p} img={img} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="product-info">
          <div className="p-eyebrow">{LINE_LABELS[p.cat] || p.cat}{p.brand ? ` · ${p.brand}` : ""}</div>
          <h1 className="p-name">{p.name}</h1>
          <div className="p-meta-line">{typeLabel(p.type)}{fabrics.length ? ` · ${fabrics.join(", ")}` : ""}</div>
          <div className="p-price">
            {p.oldPrice > 0 && <span className="old">{money(p.oldPrice)}</span>}
            <span className={p.oldPrice > 0 ? "sale-price big" : "big"}>{money(p.price)}</span>
            <span className={`avail-dot ${soldOut ? "out" : p.stock <= 3 ? "low" : "in"}`}>
              {soldOut ? "распродано" : p.stock <= 3 ? `осталось ${p.stock}` : "в наличии"}
            </span>
          </div>

          <div className="size-block">
            <div className="size-head"><span>Размер</span>{size && <span className="size-chosen">выбран: {size}</span>}</div>
            <div className="size-row">
              {p.sizes.map((s) => <button key={s} className={`size-chip ${size === s ? "size-active" : ""}`} onClick={() => setSize(s)} disabled={singleSize}>{s}</button>)}
            </div>
          </div>

          <div className="add-row">
            <button className="btn-primary btn-block btn-cta" onClick={handleAdd} disabled={soldOut || maxedOut}>
              {soldOut ? "Нет в наличии" : maxedOut ? "Всё в корзине" : added ? <><Check size={16} /> Добавлено</> : "Добавить в корзину"}
            </button>
            <button className={`fav-btn ${isFav ? "fav-on" : ""}`} onClick={onFav} aria-label="В избранное" title="В избранное">
              <Heart size={18} fill={isFav ? "currentColor" : "none"} />
            </button>
          </div>
          {stockErr && <div className="stock-err">{stockErr}</div>}
          {maxedOut && !stockErr && <div className="stock-note">В корзине уже все доступные {p.stock} шт</div>}
          {added && <button className="link-btn go-cart" onClick={onGoCart}>Перейти в корзину →</button>}

          <div className="p-promise">
            <span>Отправка {p.delivery}</span><i>·</i><span>Возврат 14 дней</span>
          </div>

          <ProductAccordion p={p} />
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

      <ProductStory p={p} onZoom={(i) => { setActive(i); setLightbox(true); }} />

      {related.length > 0 && (
        <div className="related">
          <div className="drop-eyebrow">Коллекция 001</div>
          <h2 className="drop-title" style={{ marginBottom: 30 }}>Другие вещи</h2>
          <div className="grid">
            {related.map((r, i) => (
              <Reveal key={r.id} delay={(i % 4) * 70}><ProductCard p={r} onOpen={() => onOpen(r.id)} isFav={favorites.includes(r.id)} onFav={() => onFavId(r.id)} /></Reveal>
            ))}
          </div>
        </div>
      )}

      {lightbox && <Lightbox images={images} index={active} p={p} onClose={() => setLightbox(false)} onIndex={setActive} />}
    </section>
  );
}

/* Строка характеристик на странице вещи */
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
        : <div className="grid">{products.map((p, i) => (
            <Reveal key={p.id} delay={(i % 4) * 70}><ProductCard p={p} onOpen={() => onOpen(p.id)} isFav={true} onFav={() => onFav(p.id)} /></Reveal>
          ))}</div>}
    </section>
  );
}

/* --------------------------- Оформление (премиум, одна страница) --------------------------- */
function CheckoutView({ cart, byId, user, settings, onBack, onPlace, onTgFallback, onMeta }) {
  const items = cart.map((i) => ({ ...i, p: byId(i.id) })).filter((i) => i.p);
  const subtotal = items.reduce((s, i) => s + i.p.price * i.qty, 0);
  const [f, setF] = useState({
    name: user?.name || "", phone: user?.phone || "", city: "", address: "", pvz: "",
    delivery: "courier", mode: "request", comment: "",
  });
  const shipping = f.delivery === "pickup" ? 0 : subtotal >= 5000 ? 0 : 390;
  const total = subtotal + shipping;
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => { setF((s) => ({ ...s, [k]: v })); setErr(""); };

  const orderRef = useMemo(() => "RV-" + Date.now().toString().slice(-6), []);

  const deliveryText = () => {
    if (f.delivery === "courier") return `Курьер, ${f.city}, ${f.address}`;
    if (f.delivery === "cdek") return `СДЭК, ${f.city}, ПВЗ: ${f.pvz}`;
    return "Самовывоз";
  };

  const buildMessage = () => {
    const lines = items.map(({ p, ...i }) => `• ${p.name} — размер ${i.size}, ${i.qty} шт — ${money(p.price * i.qty)}`).join("\n");
    const payText = f.mode === "online" ? "Онлайн-оплата на сайте" : "Заявка — требуется подтверждение";
    return `Здравствуйте! Заказ ${orderRef} в ${BRAND}.\n\n${lines}\n\nИтого: ${money(total)} (доставка: ${shipping === 0 ? "бесплатно" : money(shipping)})\nДоставка: ${deliveryText()}\nОформление: ${payText}\n` +
      (f.comment ? `Комментарий: ${f.comment}\n` : "") + `\nПокупатель: ${f.name}\nТелефон: ${f.phone}`;
  };

  const validate = () => {
    if (!isValidName(f.name)) return "Введите настоящие имя и фамилию (например, Владимир Андреев)";
    if (!isValidPhone(f.phone)) return "Введите телефон полностью: +7 900 000-00-00";
    if (f.delivery === "courier" && !f.address.trim()) return "Укажите адрес доставки";
    if (f.delivery === "cdek" && !f.pvz.trim()) return "Укажите пункт выдачи СДЭК";
    const short = items.filter((i) => i.qty > (i.p.stock ?? 0));
    if (short.length) return `Не хватает на складе: ${short.map((i) => i.p.name).join(", ")}`;
    return "";
  };

  const submit = async () => {
    const problem = validate();
    if (problem) return setErr(problem);
    setErr(""); setBusy(true);

    const order = {
      id: orderRef,
      customer: { name: f.name.trim(), phone: f.phone.trim(), email: user?.email || "" },
      delivery: { method: f.delivery, city: f.city.trim(), address: f.address.trim(), pvz: f.pvz.trim(), comment: f.comment.trim() },
      payment: { method: f.mode, card: "" },
      items: items.map(({ p, ...i }) => ({ id: p.id, name: p.name, brand: p.brand || "", size: i.size, qty: i.qty, price: p.price })),
      subtotal, shipping, total,
    };

    const uname = tgUsername(settings.managerTg);
    const msg = buildMessage();
    const url = uname ? `https://t.me/${uname}?text=${encodeURIComponent(msg)}` : "";
    onTgFallback?.(url);
    onMeta?.({ mode: f.mode, total });

    const res = await onPlace(order);
    setBusy(false);
    if (res && !res.ok) setErr(res.error);
  };

  const num = (n) => <span className="ck-num">{n}</span>;

  return (
    <section className="checkout">
      <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Корзина</button>
      <div className="ck-head">
        <h1 className="drop-title">Оформление</h1>
        <div className="ck-ref">Заказ {orderRef}</div>
      </div>

      <div className="checkout-grid">
        <div className="checkout-form">
          <div className="ck-block">
            <h3 className="ck-title">{num("01")} Контакты</h3>
            <div className="row-2">
              <Field label="Имя и фамилия"><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Владимир Андреев" autoComplete="name" /></Field>
              <Field label="Телефон"><input value={f.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} placeholder="+7 900 000-00-00" inputMode="tel" autoComplete="tel" /></Field>
            </div>
            <p className="ck-hint">По этому номеру менеджер подтвердит заказ.</p>
          </div>

          <div className="ck-block">
            <h3 className="ck-title">{num("02")} Доставка</h3>
            <div className="pay-cards">
              {[["courier", "Курьер", "1–3 дня, по адресу"], ["cdek", "СДЭК", "по всей России"], ["pickup", "Самовывоз", "по договорённости"]].map(([v, t, d]) => (
                <button key={v} className={`pay-card ${f.delivery === v ? "on" : ""}`} onClick={() => set("delivery", v)}>
                  <span className="pc-t">{t}</span><span className="pc-d">{d}</span>
                </button>
              ))}
            </div>
            {f.delivery === "courier" && (
              <div className="row-2">
                <Field label="Город"><input value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Москва" autoComplete="address-level2" /></Field>
                <Field label="Адрес"><input value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Улица, дом, кв." autoComplete="street-address" /></Field>
              </div>
            )}
            {f.delivery === "cdek" && (
              <div className="row-2">
                <Field label="Город"><input value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Москва" /></Field>
                <Field label="Пункт выдачи СДЭК"><input value={f.pvz} onChange={(e) => set("pvz", e.target.value)} placeholder="Адрес или код ПВЗ" /></Field>
              </div>
            )}
            {f.delivery === "pickup" && <p className="ck-hint">Менеджер согласует место и время при подтверждении заказа.</p>}
            <Field label="Комментарий (необязательно)"><textarea rows={2} value={f.comment} onChange={(e) => set("comment", e.target.value)} placeholder="Пожелания к заказу…" /></Field>
          </div>

          <div className="ck-block">
            <h3 className="ck-title">{num("03")} Как оформить</h3>
            <div className="mode-cards">
              <button className={`mode-card ${f.mode === "request" ? "on" : ""}`} onClick={() => set("mode", "request")}>
                <span className="mode-ic"><Send size={18} /></span>
                <span className="mode-t">Оставить заявку</span>
                <span className="mode-d">Мы свяжемся с вами, подтвердим наличие и детали, поможем с оплатой и доставкой.</span>
                <span className="mode-badge">Ничего платить сейчас не нужно</span>
              </button>
              <button className={`mode-card ${f.mode === "online" ? "on" : ""} ${!settings.onlinePayEnabled ? "mode-soon" : ""}`}
                onClick={() => settings.onlinePayEnabled && set("mode", "online")} disabled={!settings.onlinePayEnabled}>
                <span className="mode-ic"><Check size={18} /></span>
                <span className="mode-t">Оплатить онлайн</span>
                <span className="mode-d">Мгновенное оформление с оплатой картой на сайте. Заказ уходит в работу сразу.</span>
                <span className="mode-badge">{settings.onlinePayEnabled ? "Быстро и без звонков" : "Скоро"}</span>
              </button>
            </div>
          </div>
        </div>

        <aside className="summary">
          <h2 className="summary-title">Ваш заказ</h2>
          <div className="ck-items">
            {items.map(({ p, ...i }) => (
              <div className="ck-item" key={i.key}>
                <div className="ck-thumb"><Media p={p} img={getGallery(p)[0]} /></div>
                <div className="ck-item-info">
                  <div className="ck-item-name">{p.name}</div>
                  <div className="ck-item-meta">{i.size} · ×{i.qty}</div>
                </div>
                <div className="ck-item-price">{money(p.price * i.qty)}</div>
              </div>
            ))}
          </div>
          <div className="sum-row"><span>Товары</span><span>{money(subtotal)}</span></div>
          <div className="sum-row"><span>Доставка</span><span>{shipping === 0 ? "Бесплатно" : money(shipping)}</span></div>
          <div className="sum-row total"><span>{f.mode === "online" ? "К оплате" : "Сумма"}</span><span className="total-sum">{money(total)}</span></div>
          {err && <div className="login-err">{err}</div>}
          <button className="btn-primary btn-block" onClick={submit} disabled={busy}>
            {busy ? "Оформляем…" : f.mode === "online" ? <>Перейти к оплате {money(total)}</> : "Оставить заявку"}
          </button>
          <p className="summary-note">
            {f.mode === "online"
              ? "Оплата картой на защищённой странице. Заказ уходит в работу сразу после оплаты."
              : "Это заявка — платить сейчас не нужно. Мы свяжемся с вами, чтобы подтвердить заказ."}
          </p>
          <div className="p-promise ck-promise">
            <span>Ручной отбор</span><i>·</i><span>Возврат 14 дней</span><i>·</i><span>Без логомании</span>
          </div>
        </aside>
      </div>
    </section>
  );
}

/* --------------------------- Заказ принят --------------------------- */
function SuccessView({ brand, orderId, canTrack, tgLink, payMeta, settings, onOrders, onShop }) {
  const online = payMeta?.mode === "online";
  const steps = online
    ? ["Заказ принят", "Оплата получена", "Сборка", "Отправка"]
    : ["Заявка принята", "Мы свяжемся", "Оплата и сборка", "Отправка"];
  return (
    <section className="success">
      <div className="success-icon"><Check size={34} /></div>
      <h1 className="success-title">{online ? "Заказ оформлен" : "Заявка принята"}</h1>
      {orderId && <div className="success-order">Номер: <b>{orderId}</b></div>}

      <div className="order-steps" aria-label="Статус заказа">
        {steps.map((t, i) => (
          <div key={t} className={`ostep ${i === 0 ? "done" : i === 1 ? "now" : ""}`}>
            <span className="ostep-dot">{i === 0 ? <Check size={11} /> : i + 1}</span>
            <span className="ostep-t">{t}</span>
            {i < steps.length - 1 && <span className="ostep-line" />}
          </div>
        ))}
      </div>

      <p className="success-sub">
        {online
          ? <>Спасибо за заказ в {brand}. Оплата получена, заказ уже в работе — мы напишем, когда он отправится.</>
          : <>Спасибо за заявку в {brand}. <b>Мы свяжемся с вами</b> — обычно в течение часа, — подтвердим наличие, поможем с оплатой и доставкой. Держите телефон под рукой.</>}
      </p>

      {tgLink && !online && (
        <a className="tg-cta-big" href={tgLink} target="_blank" rel="noreferrer">
          <span className="tg-cta-icon"><Send size={20} /></span>
          <span className="tg-cta-text">
            <b>Ускорить подтверждение</b>
            <span>Написать менеджеру в Telegram — сообщение уже готово</span>
          </span>
          <ArrowRight size={18} />
        </a>
      )}

      <div className="success-actions">
        {canTrack && <button className="btn-ghost" onClick={onOrders}>Мои заказы</button>}
        <button className="btn-ghost" onClick={onShop}>Вернуться к коллекции</button>
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
  const [sentTo, setSentTo] = useState(""); // письмо отправлено, ждём подтверждения
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
    if (!r.ok) return setErr(r.error || "Не удалось зарегистрироваться");
    // почту нужно подтвердить — показываем экран ожидания
    if (r.needsConfirm) setSentTo(r.email || f.email);
  };

  // Письмо отправлено: вход произойдёт сам, как только человек нажмёт ссылку
  if (sentTo) {
    return (
      <section className="login-page">
        <div className="login-card confirm-card">
          <div className="login-icon confirm-icon"><Send size={22} /></div>
          <h1 className="confirm-h">Проверьте почту</h1>
          <p className="confirm-p">
            Мы отправили письмо на <b>{sentTo}</b>. Откройте его и нажмите кнопку подтверждения —
            вы <b>сразу войдёте в аккаунт</b>, ничего вводить заново не нужно.
          </p>
          <div className="confirm-hint">
            <span>Письма нет? Проверьте папку «Спам» — иногда оно попадает туда.</span>
          </div>
          <button className="btn-ghost btn-block" onClick={() => { setSentTo(""); setMode("login"); }}>Вернуться ко входу</button>
        </div>
      </section>
    );
  }

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

function OrdersView({ orders, onShop, onBack, onCancel }) {
  const [confirming, setConfirming] = useState(null);
  const canCancel = (s) => s === "Обработка" || s === "Подтверждён";
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
                {canCancel(o.status) && (
                  confirming === o.id ? (
                    <div className="order-cancel-confirm">
                      <span>Отозвать заявку?</span>
                      <button className="btn-danger sm" onClick={() => { onCancel(o.id); setConfirming(null); }}>Да, отозвать</button>
                      <button className="btn-ghost sm" onClick={() => setConfirming(null)}>Нет</button>
                    </div>
                  ) : (
                    <button className="order-cancel-btn" onClick={() => setConfirming(o.id)}>Отозвать заявку</button>
                  )
                )}
                {o.status === "Отменён" && <div className="order-cancelled-note">Заявка отозвана</div>}
              </div>
            ))}
          </div>}
    </section>
  );
}

/* --------------------------- Аналитика (админ) --------------------------- */
function AdminAnalytics({ orders, products }) {
  const paid = orders.filter((o) => o.status !== "Отменён");
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  const avgCheck = paid.length ? Math.round(revenue / paid.length) : 0;
  const customers = new Set(paid.map((o) => o.userId || o.customer?.phone).filter(Boolean)).size;
  const cancelled = orders.filter((o) => o.status === "Отменён").length;
  const pending = orders.filter((o) => o.status === "Обработка").length;
  const unitsSold = paid.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0);
  const stockLeft = products.reduce((s, p) => s + (p.stock || 0), 0);

  // выручка по месяцам (последние 6)
  const now = new Date();
  const months = [];
  for (let k = 5; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("ru-RU", { month: "short" }), sum: 0, count: 0 });
  }
  paid.forEach((o) => {
    const d = new Date(o.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const m = months.find((x) => x.key === key);
    if (m) { m.sum += o.total; m.count += 1; }
  });
  const maxSum = Math.max(1, ...months.map((m) => m.sum));

  // статусы заказов
  const statusCounts = ORDER_STATUSES.map((st) => ({ st, n: orders.filter((o) => o.status === st).length })).filter((x) => x.n > 0);
  const maxStatus = Math.max(1, ...statusCounts.map((x) => x.n));

  // топ товаров по продажам
  const soldMap = {};
  paid.forEach((o) => o.items.forEach((i) => { soldMap[i.name] = (soldMap[i.name] || 0) + i.qty; }));
  const topProducts = Object.entries(soldMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxTop = Math.max(1, ...topProducts.map(([, n]) => n));

  const cards = [
    ["Выручка", money(revenue), "за всё время"],
    ["Заказов", String(paid.length), pending ? `${pending} в обработке` : "все обработаны"],
    ["Покупателей", String(customers), "уникальных"],
    ["Средний чек", money(avgCheck), "на заказ"],
    ["Продано вещей", String(unitsSold), "штук"],
    ["Остаток на складе", String(stockLeft), "штук"],
    ["Отменено", String(cancelled), "заявок"],
    ["Позиций в каталоге", String(products.length), "товаров"],
  ];

  return (
    <div className="analytics">
      <div className="an-cards">
        {cards.map(([label, val, sub]) => (
          <div className="an-card" key={label}>
            <div className="an-val">{val}</div>
            <div className="an-label">{label}</div>
            <div className="an-sub">{sub}</div>
          </div>
        ))}
      </div>

      <div className="an-charts">
        <div className="an-chart">
          <h3 className="an-chart-title">Выручка по месяцам</h3>
          <div className="an-bars">
            {months.map((m) => (
              <div className="an-bar-col" key={m.key}>
                <div className="an-bar-wrap">
                  <div className="an-bar-val">{m.sum > 0 ? money(m.sum).replace(" ₽", "") : ""}</div>
                  <div className="an-bar" style={{ height: `${Math.round((m.sum / maxSum) * 100)}%` }} />
                </div>
                <div className="an-bar-label">{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="an-chart">
          <h3 className="an-chart-title">Заказы по статусам</h3>
          <div className="an-rows">
            {statusCounts.length === 0 ? <p className="an-empty">Пока нет заказов</p> : statusCounts.map(({ st, n }) => (
              <div className="an-row" key={st}>
                <span className="an-row-label">{st}</span>
                <div className="an-row-track"><div className="an-row-fill" style={{ width: `${Math.round((n / maxStatus) * 100)}%` }} /></div>
                <span className="an-row-n">{n}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="an-chart an-chart-wide">
          <h3 className="an-chart-title">Топ товаров по продажам</h3>
          <div className="an-rows">
            {topProducts.length === 0 ? <p className="an-empty">Пока нет продаж</p> : topProducts.map(([name, n]) => (
              <div className="an-row" key={name}>
                <span className="an-row-label">{name}</span>
                <div className="an-row-track"><div className="an-row-fill gold" style={{ width: `${Math.round((n / maxTop) * 100)}%` }} /></div>
                <span className="an-row-n">{n} шт</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="an-note">Данные считаются по реальным заказам из базы. Отменённые заявки не входят в выручку.</p>
    </div>
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
          <button className={tab === "analytics" ? "atab on" : "atab"} onClick={() => setTab("analytics")}>Аналитика</button>
          <button className={tab === "products" ? "atab on" : "atab"} onClick={() => setTab("products")}>Товары</button>
          <button className={tab === "orders" ? "atab on" : "atab"} onClick={() => setTab("orders")}>
            Заказы{pendingOrders > 0 && <span className="tab-badge">{pendingOrders}</span>}
          </button>
          <button className="atab" onClick={() => setTab("settings")}><Settings size={14} /> Настройки сайта</button>
        </div>
        <button className="btn-ghost admin-logout" onClick={onLogout}><LogOut size={15} /> Выйти</button>
      </div>

      {tab === "analytics" && <AdminAnalytics orders={orders} products={products} />}

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
          <h3 className="block-title">Блоки главной страницы</h3>
          <div className="row-2">
            <Field label="Линия 1 — название"><input value={f.line1Name} onChange={(e) => set("line1Name", e.target.value)} placeholder="Heritage" /></Field>
            <Field label="Линия 2 — название"><input value={f.line2Name} onChange={(e) => set("line2Name", e.target.value)} placeholder="Quiet Luxe" /></Field>
          </div>
          <Field label="Линия 1 — описание"><textarea rows={2} value={f.line1Desc} onChange={(e) => set("line1Desc", e.target.value)} /></Field>
          <Field label="Линия 2 — описание"><textarea rows={2} value={f.line2Desc} onChange={(e) => set("line2Desc", e.target.value)} /></Field>
          <Field label="Текст тизера Quiet Luxe"><textarea rows={3} value={f.luxeText} onChange={(e) => set("luxeText", e.target.value)} /></Field>
          <Field label="Манифест (2 строки)"><textarea rows={2} value={f.manifesto} onChange={(e) => set("manifesto", e.target.value)} placeholder={"Мы не печатаем логотипы.\nМы прошиваем историю."} /></Field>
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
          <h3 className="block-title">Заказы и оплата</h3>
          <label className="toggle-row">
            <input type="checkbox" checked={!!f.onlinePayEnabled} onChange={(e) => set("onlinePayEnabled", e.target.checked)} />
            <span><b>Онлайн-оплата картой на сайте</b><i>Включайте, когда подключите эквайринг (нужно ИП/ЮKassa). Пока выключено, покупатели оставляют заявку.</i></span>
          </label>
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
    name: initial?.name || "", brand: initial?.brand || "", cat: initial?.cat || "Archive", type: initial?.type || "jeans",
    price: initial?.price || "", oldPrice: initial?.oldPrice || "", material: initial?.material || "",
    materials: initial?.materials?.length ? initial.materials.map((m) => ({ ...m })) : [],
    care: initial?.care || "", desc: initial?.desc || "", highlights: initial?.highlights || "", fit: initial?.fit || "", tag: initial?.tag || "",
    stock: initial?.stock ?? 10, delivery: initial?.delivery || "1–3 дня по России",
    sizes: initial?.sizes ? [...initial.sizes] : ["S", "M", "L"],
    colors: initial?.colors ? [...initial.colors] : ["#8f8677"],
    images: initial?.images || [],
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [newType, setNewType] = useState("");
  const [addingType, setAddingType] = useState(false);
  const [matBusy, setMatBusy] = useState(-1);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  // при смене типа на обувной подставляем числовые размеры (и наоборот)
  const changeType = (type) => setF((s) => {
    const wasShoe = SHOE_TYPES.includes(s.type), isShoe = SHOE_TYPES.includes(type);
    if (wasShoe === isShoe) return { ...s, type };
    return { ...s, type, sizes: isShoe ? ["41", "42", "43"] : ["S", "M", "L"] };
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
    if (!f.sizes.length) return setErr("Добавьте хотя бы один размер");
    setErr("");
    onSave({
      name: f.name.trim(), brand: f.brand.trim(), cat: f.cat, type: f.type, price: Number(f.price),
      oldPrice: f.oldPrice ? Number(f.oldPrice) : 0,
      materials: (f.materials || []).filter((m) => (m.name || "").trim()).map((m) => ({ name: m.name.trim(), photo: m.photo || "" })),
      material: (f.materials || []).filter((m) => (m.name || "").trim()).map((m) => m.name.trim()).join(", ") || f.material.trim(),
      care: f.care.trim(),
      desc: f.desc.trim(), highlights: f.highlights.trim(), fit: f.fit.trim(), tag: f.tag.trim() || undefined,
      stock: Math.max(0, parseInt(f.stock, 10) || 0), delivery: f.delivery.trim() || "1–3 дня по России",
      sizes: f.sizes, colors: f.colors.length ? f.colors : ["#8f8677"], images: f.images,
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
            <Field label="Линия бренда"><select value={f.cat} onChange={(e) => set("cat", e.target.value)}>{SHOP_CATS.map((c) => <option key={c} value={c}>{LINE_LABELS[c]}</option>)}</select></Field>
            <Field label="Тип вещи">
              <select value={f.type} onChange={(e) => { if (e.target.value === "__new") setAddingType(true); else changeType(e.target.value); }}>
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
          <Field label={SHOE_TYPES.includes(f.type) ? "Доступные размеры обуви" : "Доступные размеры"}>
            <TokenEditor tokens={f.sizes} onChange={(v) => set("sizes", v)}
              suggestions={sizeSuggestions(f.type)} placeholder="Добавить размер и Enter" />
          </Field>
          <Field label="Цвета">
            <ColorEditor colors={f.colors} onChange={(v) => set("colors", v)} />
          </Field>
          <Field label="Материалы (каждый со своим фото)">
            <div className="mat-editor">
              {(f.materials || []).map((m, i) => (
                <div className="mat-row" key={i}>
                  <label className="mat-photo">
                    {m.photo ? <img src={imgThumb(m.photo)} alt="" /> : <span className="mat-photo-add"><Upload size={15} /></span>}
                    <input type="file" accept="image/*" hidden onChange={async (e) => {
                      const file = e.target.files?.[0]; e.target.value = "";
                      if (!file) return;
                      setMatBusy(i);
                      try { const url = await processImage(file); setF((s) => { const arr = [...s.materials]; arr[i] = { ...arr[i], photo: url }; return { ...s, materials: arr }; }); }
                      catch (err) { setErr("Не удалось загрузить фото материала"); }
                      setMatBusy(-1);
                    }} />
                    {matBusy === i && <span className="mat-loading">…</span>}
                  </label>
                  <input className="mat-name" value={m.name} placeholder="80% шерсть"
                    onChange={(e) => setF((s) => { const arr = [...s.materials]; arr[i] = { ...arr[i], name: e.target.value }; return { ...s, materials: arr }; })} />
                  <button type="button" className="mat-del" onClick={() => setF((s) => ({ ...s, materials: s.materials.filter((_, k) => k !== i) }))} aria-label="Удалить"><Trash2 size={15} /></button>
                </div>
              ))}
              <button type="button" className="mat-add" onClick={() => setF((s) => ({ ...s, materials: [...(s.materials || []), { name: "", photo: "" }] }))}>
                <Plus size={15} /> Добавить материал
              </button>
              <p className="form-hint">Например: «80% шерсть» и фото шерсти, «20% полиамид» и фото подкладки. Показываются на странице и в каталоге.</p>
            </div>
          </Field>
          <Field label="Уход"><input value={f.care} onChange={(e) => set("care", e.target.value)} placeholder="Сухая чистка" /></Field>
          <Field label="Описание"><textarea rows={4} value={f.desc} onChange={(e) => set("desc", e.target.value)} placeholder="Короткое описание товара…" /></Field>
          <Field label="Ключевые детали (каждая с новой строки)"><textarea rows={4} value={f.highlights} onChange={(e) => set("highlights", e.target.value)} placeholder={"Автоподзавод, 24 камня\nВодозащита 100 м\nСапфировое стекло"} /></Field>
          <Field label="Заметка о посадке"><textarea rows={3} value={f.fit} onChange={(e) => set("fit", e.target.value)} placeholder="Свободный крой. Модель ростом 182 см в размере L." /></Field>
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
                  <img src={imgThumb(src)} alt={`Фото ${i + 1}`} loading="lazy" />
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
      <div className="footer-mark" aria-hidden="true">
        <span className="footer-brand"><Wordmark size={34} /></span>
      </div>
      <div className="footer-cols">
        <div className="footer-brand-col">
          <div className="footer-brand">{s.brand}</div>
          <p className="footer-tagline">{s.heroSub}</p>
        </div>
        <div className="footer-col"><div className="footer-col-title">Линии</div>
          {SHOP_CATS.map((l) => <button key={l} className="footer-link" onClick={() => onNav(l)}>{LINE_LABELS[l]}</button>)}</div>
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
function Media({ p, img, large, eager }) {
  if (img && img.src) {
    return (
      <img
        className={`garment${large ? " garment-contain" : ""}`}
        src={large ? img.src : img.thumb || img.src}
        alt={p.name}
        width={large ? 900 : 400}
        height={large ? 900 : 400}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
    );
  }
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
.store{--paper:#f3f1ec;--card:#faf9f6;--ink:#1a1613;--ink-soft:#6b655c;--line:#e3ddd2;--accent:#7c2634;--glow:124,38,52;--serif:'Fraunces',Georgia,serif;--sans:'Instrument Sans',system-ui,sans-serif;background:var(--paper);color:var(--ink);font-family:var(--sans);min-height:100vh;-webkit-font-smoothing:antialiased;transition:background .8s ease,color .8s ease}
/* Тема Heritage — тёплый тёмно-синий, светлый в целом */
.theme-heritage{--paper:#eef1f5;--card:#f7f9fc;--ink:#1c2740;--ink-soft:#5a6478;--line:#d5dbe6;--accent:#2f4a73;--glow:47,74,115}
/* Тема Quiet Luxe — тёмный люкс с золотом */
.theme-luxe{--paper:#16130f;--card:#1e1a15;--ink:#efe7d8;--ink-soft:#a79c88;--line:#332c22;--accent:#c99a6b;--glow:201,154,107}
.store,.store *{transition-property:background-color,border-color,color;transition-duration:.6s;transition-timing-function:ease}
.store *{box-sizing:border-box;margin:0;padding:0}
.store button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}
.garment{width:100%;height:100%;display:block;object-fit:cover}
.garment-contain{object-fit:contain;background:#fff}
.boot{min-height:60vh;display:grid;place-items:center;color:var(--ink-soft);font-size:15px;text-align:center;padding:40px 24px;line-height:1.6}
.boot-error{color:var(--accent);max-width:560px;margin:0 auto}
.muted-block{color:var(--ink-soft);padding:30px 0}

.announce{background:var(--ink);color:var(--paper);text-align:center;font-size:12px;letter-spacing:.06em;padding:9px 16px;text-transform:uppercase}
.header{position:sticky;top:0;z-index:40;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:18px 32px;background:color-mix(in srgb, var(--paper) 85%, transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
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

.btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--ink);color:var(--paper);padding:14px 26px;border-radius:6px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;transition:transform .18s cubic-bezier(.2,.7,.2,1),box-shadow .25s,opacity .2s}
.btn-primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 12px 30px rgba(var(--glow),.35)}
.btn-primary:active{transform:translateY(1px)}
.btn-primary:disabled{opacity:.4;cursor:not-allowed}
.btn-ghost{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--line);padding:13px 20px;border-radius:6px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;transition:border-color .2s,background .2s}
.btn-ghost:hover{border-color:var(--ink);background:rgba(26,22,19,.04)}
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
.grid{display:grid;gap:32px 24px;grid-template-columns:repeat(4,minmax(0,1fr))}
@media(max-width:1080px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:760px){.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 14px}}
@media(max-width:420px){.grid{grid-template-columns:minmax(0,1fr)}}
@media(max-width:520px){
  .card-top{flex-direction:column;align-items:flex-start;gap:4px}
  .card-price{font-size:13px}
  .card-name{font-size:14px}
}
.card{display:flex;flex-direction:column;cursor:pointer;min-width:0;perspective:1000px}
.card-media{position:relative;aspect-ratio:4/5;border-radius:8px;overflow:hidden;background:#fff;box-shadow:0 1px 12px rgba(26,22,19,.04);transition:box-shadow .35s,transform .5s cubic-bezier(.2,.7,.2,1);transform-style:preserve-3d;transform:rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg))}
.card:hover .card-media{box-shadow:0 26px 60px rgba(26,22,19,.18)}
.card-imgwrap{position:absolute;inset:0}
.card-imgwrap .garment{transition:transform .9s cubic-bezier(.2,.7,.2,1),opacity .5s}
.card:hover .card-imgwrap .garment{transform:scale(1.06)}
.card-alt{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#fff;opacity:0;transition:opacity .55s ease}
.card:hover .card-alt{opacity:1}
.card-glow{position:absolute;inset:0;z-index:2;pointer-events:none;opacity:0;transition:opacity .3s;background:radial-gradient(240px circle at var(--gx,50%) var(--gy,40%),rgba(255,255,255,.28),transparent 60%)}
.card:hover .card-glow{opacity:1}
.card-shine{position:absolute;top:0;bottom:0;left:-75%;width:50%;background:linear-gradient(78deg,transparent,rgba(255,255,255,.45),transparent);transform:skewX(-12deg);pointer-events:none;z-index:2}
.card:hover .card-shine{left:130%;transition:left .9s ease}
.card-badges{position:absolute;top:12px;left:12px;z-index:3;display:flex;flex-direction:column;gap:6px;align-items:flex-start;transform:translateZ(30px)}
.badge{background:var(--paper);color:var(--ink);font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:4px 10px;border-radius:100px;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.badge-sale{background:var(--accent);color:#fff}
.badge-low{background:#8a5a1a;color:#fff}
.badge-out{background:var(--ink);color:var(--paper)}
.wish{position:absolute;top:10px;right:10px;z-index:3;width:36px;height:36px;border-radius:50%;background:rgba(250,249,246,.9);backdrop-filter:blur(4px);display:grid;place-items:center;color:var(--ink);opacity:0;transform:translateY(-4px);transition:opacity .25s,transform .25s,color .2s}
.card:hover .wish{opacity:1;transform:none}
.wish-on{opacity:1;color:var(--accent)}
.wish:hover{color:var(--accent)}
@media(hover:none){.wish{opacity:1;transform:none}}
.card-quick{position:absolute;left:0;right:0;bottom:0;z-index:3;padding:14px;display:flex;justify-content:center;background:linear-gradient(transparent,rgba(26,22,19,.5));transform:translateY(100%) translateZ(30px);transition:transform .35s cubic-bezier(.2,.7,.2,1)}
.card:hover .card-quick{transform:translateY(0) translateZ(30px)}
.card-quick span{display:inline-flex;align-items:center;gap:7px;background:var(--paper);color:var(--ink);font-size:12px;letter-spacing:.05em;text-transform:uppercase;padding:10px 18px;border-radius:100px;box-shadow:0 6px 18px rgba(0,0,0,.18)}
@media(hover:none){.card-quick{display:none}}
@media(hover:none){.card-media{transform:none!important}}
.card-body{padding:14px 2px 0;min-width:0}
.card-line{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:6px}
.card-top{display:flex;justify-content:space-between;gap:8px;align-items:baseline;min-width:0}
.card-name{font-family:var(--serif);font-size:17px;font-weight:400;min-width:0;overflow-wrap:anywhere;line-height:1.2}
.card-price{font-size:14px;display:flex;gap:8px;align-items:baseline;white-space:nowrap;flex-shrink:0}
.old{color:var(--ink-soft);text-decoration:line-through;font-size:13px}
.sale-price{color:var(--accent);font-weight:600}
.card-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:11px}
.card-sizes{display:flex;gap:5px;flex-wrap:wrap;min-width:0}
.card-sizes span{font-size:11px;color:var(--ink-soft);border:1px solid var(--line);border-radius:4px;padding:2px 7px}
.swatches{display:flex;gap:6px;flex-shrink:0}
.swatch{width:13px;height:13px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)}

.product{max-width:1180px;margin:0 auto;padding:26px 32px 80px}
@media(max-width:760px){.product{padding:20px 20px 60px}}
.back-link{display:inline-flex;align-items:center;gap:6px;font-size:13px;letter-spacing:.04em;color:var(--ink-soft);margin-bottom:26px;transition:color .2s}
.back-link:hover{color:var(--ink)}
.product-grid{display:grid;grid-template-columns:1.15fr 1fr;gap:64px;align-items:start}
@media(max-width:860px){.product-grid{grid-template-columns:1fr;gap:32px}}
.main-img{position:relative;aspect-ratio:1/1;border-radius:8px;overflow:hidden;background:#fff;box-shadow:0 2px 30px rgba(26,22,19,.05)}
.thumbs{display:flex;gap:10px;margin-top:12px}
.thumb{flex:1;aspect-ratio:1;border-radius:8px;overflow:hidden;border:1px solid var(--line);opacity:.6;transition:opacity .25s,border-color .25s,transform .2s;padding:0}
.thumb:hover{opacity:1;transform:translateY(-2px)}.thumb-active{opacity:1;border-color:var(--accent)}
.product-info{padding-top:6px}
.p-eyebrow{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:14px}
.p-name{font-family:var(--serif);font-weight:400;font-size:clamp(30px,4vw,44px);line-height:1.06;letter-spacing:-.01em;margin-bottom:2px}
.p-price{display:flex;align-items:baseline;gap:12px;margin:18px 0 22px}
.p-price .big{font-size:24px;font-weight:600}
.p-desc{color:var(--ink-soft);line-height:1.7;max-width:440px}
.size-block{margin:30px 0 24px}
.size-head{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;letter-spacing:.04em;text-transform:uppercase;margin-bottom:12px}
.size-hint{color:var(--accent);text-transform:none;letter-spacing:0}
.size-row{display:flex;gap:8px;flex-wrap:wrap}
.size-chip{min-width:48px;padding:11px 14px;border:1px solid var(--line);border-radius:8px;font-size:14px;transition:all .2s;background:var(--paper)}
.size-chip:hover:not(:disabled){border-color:var(--ink)}
.size-active{background:var(--ink);color:var(--paper);border-color:var(--ink);box-shadow:0 6px 16px rgba(26,22,19,.18)}
.size-chip:disabled{cursor:default;background:var(--card)}
.add-row{display:flex;gap:10px;margin-bottom:34px}.add-row .btn-primary{flex:1}





.cart-page{max-width:1120px;margin:0 auto;padding:40px 32px 90px}
@media(max-width:760px){.cart-page{padding:28px 20px 70px}}
.cart-page .section-title{margin-bottom:30px}
.cart-layout{display:grid;grid-template-columns:1fr 360px;gap:44px;align-items:start}
@media(max-width:860px){.cart-layout{grid-template-columns:1fr;gap:30px}}
.cart-row{display:flex;gap:18px;padding:22px 0;border-bottom:1px solid var(--line)}
.cart-thumb{width:92px;height:92px;border-radius:3px;overflow:hidden;flex-shrink:0;background:#fff;padding:0}
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
.admin-thumb{width:56px;height:56px;border-radius:3px;overflow:hidden;flex-shrink:0;background:#fff}
.admin-info{flex:1;min-width:0}
.admin-name{font-weight:500;font-size:15px;display:flex;align-items:center;gap:8px}
.mini-tag{font-size:10px;letter-spacing:.05em;text-transform:uppercase;background:var(--ink);color:var(--paper);padding:2px 7px;border-radius:2px}
.admin-meta{color:var(--ink-soft);font-size:13px;margin-top:3px}
.admin-photos{color:var(--ink-soft);font-size:12px;margin-top:2px;opacity:.8}
.admin-btns{display:flex;gap:6px}
.mini-btn{width:36px;height:36px;display:grid;place-items:center;border:1px solid var(--line);border-radius:8px;color:var(--ink-soft);transition:all .2s}
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
.tg-open{display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;margin-bottom:14px}
.tg-cta-big{display:flex;align-items:center;gap:14px;max-width:440px;margin:0 auto 24px;padding:16px 20px;border-radius:10px;text-decoration:none;color:#fff;text-align:left;background:linear-gradient(120deg,#2aabee,#229ed9);box-shadow:0 8px 22px rgba(34,158,217,.3);transition:transform .15s,box-shadow .2s}
.tg-cta-big:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(34,158,217,.38)}
.tg-cta-icon{width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.2);display:grid;place-items:center;flex-shrink:0}
.tg-cta-text{display:flex;flex-direction:column;gap:2px;flex:1}
.tg-cta-text b{font-size:15px}
.tg-cta-text span{font-size:12px;opacity:.92;line-height:1.4}

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

/* скелетоны загрузки */
.skel{background:linear-gradient(90deg,#e9e5dd 25%,#f2efe9 37%,#e9e5dd 63%);background-size:400% 100%;animation:shimmer 1.4s ease infinite;border-radius:4px}
.skel-announce{height:34px;background:var(--ink);opacity:.15}
.skel-nav{height:14px;width:180px}
.skel-word{height:22px;width:150px;justify-self:center}
.skel-title{height:96px;max-width:520px;margin:0 auto;border-radius:8px}
.skel-line{height:13px}
.skel-media{aspect-ratio:1/1;border-radius:3px}
@keyframes shimmer{0%{background-position:100% 50%}100%{background-position:0 50%}}

/* плавная смена страниц */
.page-in{animation:pagein .26s cubic-bezier(.2,.7,.2,1)}
@keyframes pagein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

/* сортировка */
.sort-btn{display:inline-flex;align-items:center;gap:7px;padding:9px 15px;border:1px solid var(--line);border-radius:100px;background:var(--card);font-size:13px;color:var(--ink);transition:border-color .2s,color .2s;white-space:nowrap}
.sort-btn:hover{border-color:var(--ink)}
.sort-btn span{min-width:104px;text-align:left}
.checkout-link{text-decoration:none}
.checkout-link.is-busy{opacity:.6;pointer-events:none}

/* похожие товары */
.related{margin-top:70px;padding-top:40px;border-top:1px solid var(--line)}
.related .section-title{margin-bottom:26px}

/* ================= ГЛАВНАЯ БРЕНДА ================= */
html{scroll-behavior:smooth}

/* полоса прогресса */
.scroll-progress{position:fixed;top:0;left:0;right:0;height:2.5px;background:var(--accent);transform:scaleX(0);transform-origin:left;z-index:90}

/* наверх */
.to-top{position:fixed;right:22px;bottom:22px;width:46px;height:46px;border-radius:50%;background:var(--ink);color:var(--paper);font-size:18px;z-index:60;box-shadow:0 8px 22px rgba(0,0,0,.22);transition:transform .2s;animation:fade .3s ease}
.to-top:hover{transform:translateY(-3px)}

/* липкая шапка с размытием */
.header{position:sticky;top:0;z-index:50;background:color-mix(in srgb, var(--paper) 86%, transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
.nav-link{position:relative}
.nav-link::after{content:"";position:absolute;left:0;bottom:-4px;width:100%;height:1px;background:var(--accent);transform:scaleX(0);transform-origin:right;transition:transform .3s cubic-bezier(.2,.7,.2,1)}
.nav-link:hover::after{transform:scaleX(1);transform-origin:left}

/* появление при прокрутке */
.rv{opacity:0;transform:translateY(18px);transition:opacity .7s ease,transform .7s cubic-bezier(.2,.7,.2,1)}
.rv-left{transform:translateX(-40px)}
.rv-right{transform:translateX(40px)}
.rv-in{opacity:1;transform:none}

/* фирменное начертание */
/* фирменная надпись ROVELLE — обведена с логотипа, цвет следует теме */
.wm-brand{display:block;aspect-ratio:11.65/1;background-color:var(--accent);-webkit-mask:url(/logo-word.svg) center/contain no-repeat;mask:url(/logo-word.svg) center/contain no-repeat;transition:background-color .6s ease}
.wm-brand-in{animation:wmfade 1s cubic-bezier(.2,.7,.2,1) .1s both}
@keyframes wmfade{from{opacity:0;transform:translateY(10px);letter-spacing:0}to{opacity:1;transform:none}}
.footer-brand .wm-brand{background-color:var(--paper);opacity:.92}
.brand-logo{max-height:26px;width:auto;display:block}

/* монограмма */
.mono-img{display:block;margin:0 auto;background-color:var(--accent);-webkit-mask:url(/logo-mark.svg) center/contain no-repeat;mask:url(/logo-mark.svg) center/contain no-repeat;transition:background-color .6s ease}

/* первый экран */
.bhero{min-height:calc(100vh - 120px);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:70px 24px 90px;position:relative;overflow:hidden}
.bhero-glow{position:absolute;inset:0;pointer-events:none;background:radial-gradient(460px circle at var(--mx,50%) var(--my,38%),rgba(var(--glow),.12),transparent 68%);transition:background .1s}
.bhero-mark{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-family:var(--serif);font-size:clamp(240px,42vw,520px);line-height:1;color:var(--accent);opacity:.05;pointer-events:none;user-select:none;max-width:100%}
.bhero-name{margin:0 0 22px;position:relative;width:min(88vw,620px);max-width:100%}
.bhero-name .wm-brand{width:100%;height:auto!important}
.bhero-tag{max-width:520px;color:var(--ink-soft);font-size:16px;line-height:1.7;margin-bottom:34px;position:relative}
.bhero-cta{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;position:relative}
.bhero-est{position:absolute;bottom:64px;left:50%;transform:translateX(-50%);font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--ink-soft)}
.bhero-scroll{position:absolute;bottom:22px;left:50%;transform:translateX(-50%);width:1px;height:30px;background:var(--line);overflow:hidden}
.bhero-scroll span{display:block;width:100%;height:12px;background:var(--accent);animation:scrolldot 1.8s ease-in-out infinite}
@keyframes scrolldot{0%{transform:translateY(-14px)}70%{transform:translateY(32px)}100%{transform:translateY(32px)}}

/* бегущая строка */
.ticker{overflow:hidden;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:14px 0;background:var(--card)}
.ticker-track{display:flex;width:max-content;animation:ticker 36s linear infinite}
.ticker-item{font-family:var(--serif);font-size:15px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);display:inline-flex;align-items:center;white-space:nowrap}
.ticker-item i{font-style:normal;color:var(--accent);margin:0 22px}
@keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-33.333%)}}
.ticker:hover .ticker-track{animation-play-state:paused}

/* две линии */
.lines{display:grid;grid-template-columns:1fr 1fr;min-height:460px}
.line-panel{display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-start;text-align:left;gap:13px;padding:48px 44px;cursor:pointer;position:relative;overflow:hidden;transition:transform .5s cubic-bezier(.2,.7,.2,1),box-shadow .5s,filter .4s}
/* фоновая буква-знак, проявляется при наведении */
.line-panel::before{content:"RV";position:absolute;right:-6%;bottom:-18%;font-family:var(--serif);font-size:clamp(220px,26vw,360px);line-height:1;opacity:.045;transform:translateY(20px) rotate(-4deg);transition:opacity .5s,transform .7s cubic-bezier(.2,.7,.2,1);pointer-events:none}
/* тонкая линия-акцент, «прочерчивается» снизу вверх слева */
.line-panel::after{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--accent);transform:scaleY(0);transform-origin:bottom;transition:transform .5s cubic-bezier(.2,.7,.2,1)}
.line-panel>*{position:relative;transition:transform .5s cubic-bezier(.2,.7,.2,1)}
.line-panel:hover{transform:translateY(-4px);box-shadow:0 30px 60px rgba(26,22,19,.14);z-index:2}
.line-panel:hover::before{opacity:.1;transform:translateY(0) rotate(0)}
.line-panel:hover::after{transform:scaleY(1)}
.line-panel:hover>*{transform:translateX(8px)}
/* соседняя панель слегка гаснет, когда наводишь на другую */
.lines:hover .line-panel:not(:hover){filter:brightness(.97) saturate(.92)}
.line-archive{background:var(--card);border-right:1px solid var(--line)}
.line-luxe{background:#191512;color:#efe9df}
.line-luxe::after{background:#c99a6b}
.line-luxe::before{color:#c99a6b;opacity:.06}
.line-luxe:hover::before{opacity:.13}
.line-no{font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--accent)}
.line-luxe .line-no{color:#c99a6b}
.line-name{font-family:var(--serif);font-weight:400;font-size:clamp(28px,4vw,44px);line-height:1.05}
.line-desc{font-size:14px;line-height:1.65;color:var(--ink-soft);max-width:420px}
.line-luxe .line-desc{color:#b3aa99}
.line-go{display:inline-flex;align-items:center;gap:7px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin-top:8px;border-bottom:1px solid currentColor;padding-bottom:3px;transition:gap .3s}
.line-panel:hover .line-go{gap:13px}
@media(max-width:820px){.lines{grid-template-columns:1fr}.line-archive{border-right:none;border-bottom:1px solid var(--line)}.line-panel{padding:36px 24px;min-height:230px}.line-panel:hover{transform:none;box-shadow:none}.line-panel:hover>*{transform:none}}

/* цифры */
.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));max-width:1120px;margin:0 auto;padding:64px 32px 6px;gap:18px}
@media(max-width:760px){.stats{grid-template-columns:repeat(2,minmax(0,1fr));padding:48px 20px 0}}
.stat{text-align:center;padding:18px 8px;border-top:1px solid var(--line)}
.stat-n{display:block;font-family:var(--serif);font-size:clamp(30px,4vw,44px);color:var(--accent);line-height:1.1;margin-bottom:6px}
.stat-l{font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-soft)}

/* дроп */
.drop{max-width:1120px;margin:0 auto;padding:90px 32px 40px}
@media(max-width:760px){.drop{padding:60px 20px 30px}}
.drop-head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;margin-bottom:50px}
.drop-eyebrow{font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--accent);margin-bottom:10px}
.drop-title{font-family:var(--serif);font-weight:400;font-size:clamp(30px,4.6vw,48px);line-height:1.05}
.drop-tools{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.line-tabs{display:flex;gap:4px;border:1px solid var(--line);border-radius:100px;padding:4px;background:var(--paper)}
.line-tabs button{padding:8px 16px;border-radius:100px;font-size:13px;color:var(--ink-soft);transition:all .2s;white-space:nowrap}
.line-tabs button.on{background:var(--accent);color:#fff;box-shadow:0 6px 18px rgba(var(--glow),.3)}
.search-wrap{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:100px;padding:9px 16px;background:var(--paper);color:var(--ink-soft)}
.search-wrap input{border:none;background:none;outline:none;font-family:inherit;font-size:13px;color:var(--ink);width:110px}
.drop-empty{color:var(--ink-soft);text-align:center;padding:60px 0}

/* вещь дропа */
.drop-list{display:flex;flex-direction:column;gap:88px}
.piece{display:grid;grid-template-columns:1.05fr 1fr;gap:48px;align-items:center}
.piece-flip{direction:rtl}
.piece-flip>*{direction:ltr}
@media(max-width:820px){.piece,.piece-flip{grid-template-columns:1fr;gap:22px;direction:ltr}}
.piece-media{position:relative;aspect-ratio:1/1;border-radius:4px;overflow:hidden;background:#fff;cursor:pointer;display:block;width:100%;transition:transform .35s ease,box-shadow .35s ease;will-change:transform}
.piece-media:hover{box-shadow:0 30px 70px rgba(var(--glow),.22)}
.piece-glow{position:absolute;inset:0;z-index:2;pointer-events:none;opacity:0;transition:opacity .3s;background:radial-gradient(260px circle at var(--gx,50%) var(--gy,40%),rgba(var(--glow),.16),transparent 62%)}
.piece-media:hover .piece-glow{opacity:1}
.piece-view{position:absolute;left:50%;bottom:16px;transform:translateX(-50%) translateY(12px);z-index:3;display:inline-flex;align-items:center;gap:7px;background:var(--paper);color:var(--ink);font-size:12px;letter-spacing:.05em;text-transform:uppercase;padding:9px 18px;border-radius:100px;box-shadow:0 8px 22px rgba(0,0,0,.16);opacity:0;transition:opacity .35s,transform .35s cubic-bezier(.2,.7,.2,1)}
.piece-media:hover .piece-view{opacity:1;transform:translateX(-50%) translateY(0)}
@media(hover:none){.piece-view{display:none}}
.piece-media .garment{transition:transform .8s cubic-bezier(.2,.7,.2,1)}
.piece-media:hover .garment{transform:scale(1.05)}
.piece-alt{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#fff;opacity:0;transition:opacity .45s ease}
.piece-media:hover .piece-alt{opacity:1}
.piece-shine{position:absolute;top:0;bottom:0;left:-70%;width:45%;background:linear-gradient(78deg,transparent,rgba(255,255,255,.5),transparent);transform:skewX(-12deg);transition:none;pointer-events:none}
.piece-media:hover .piece-shine{left:130%;transition:left .8s ease}
.piece-tag{position:absolute;top:14px;left:14px;background:var(--ink);color:var(--paper);font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:5px 12px;border-radius:2px;z-index:2}
.piece-no{font-family:var(--serif);font-size:44px;color:var(--accent);line-height:1;margin-bottom:14px}
.piece-no span{font-size:16px;color:var(--ink-soft)}
.piece-name{font-family:var(--serif);font-weight:400;font-size:clamp(24px,3.2vw,34px);line-height:1.15;margin-bottom:8px;transition:color .3s}
.piece-meta{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:14px}
.piece-desc{color:var(--ink-soft);font-size:14.5px;line-height:1.7;margin-bottom:16px;max-width:440px}
.piece-sizes{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px}
.piece-sizes span{border:1px solid var(--line);border-radius:2px;padding:4px 10px;font-size:12px;color:var(--ink-soft)}
.piece-row{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
.piece-price{font-family:var(--serif);font-size:22px;display:flex;gap:10px;align-items:baseline}
.piece-actions{display:flex;gap:10px;align-items:center}
.piece-low{margin-top:12px;font-size:12px;color:#8a5a1a}
.piece-out{margin-top:12px;font-size:12px;color:var(--accent)}

/* лента кадров */
.strip{margin:70px 0 0;padding:26px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:var(--card)}
.strip-track{display:flex;gap:14px;overflow-x:auto;padding:0 32px;scrollbar-width:thin;scroll-snap-type:x mandatory}
.strip-shot{flex:0 0 auto;width:190px;aspect-ratio:1/1;border-radius:3px;overflow:hidden;background:#fff;scroll-snap-align:start;cursor:pointer}
.strip-shot img{width:100%;height:100%;object-fit:contain;filter:grayscale(.55);transition:filter .4s ease,transform .6s ease;display:block}
.strip-shot:hover img{filter:none;transform:scale(1.04)}
@media(max-width:760px){.strip-shot{width:150px}.strip-track{padding:0 20px}}

/* что мы проверяем */
.craft{max-width:1120px;margin:0 auto;padding:80px 32px}
.craft-title{font-family:var(--serif);font-weight:400;font-size:clamp(28px,4.4vw,44px);line-height:1.12;margin-bottom:46px}
.craft-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}
@media(max-width:820px){.craft-grid{grid-template-columns:1fr}}
.craft-card{border:1px solid var(--line);border-radius:6px;background:var(--card);padding:28px 24px;height:100%;transition:transform .3s ease,box-shadow .3s ease,border-color .3s}
.craft-card:hover{transform:translateY(-5px);box-shadow:0 16px 38px rgba(26,22,19,.09);border-color:var(--accent)}
.craft-no{font-family:var(--serif);font-size:15px;color:var(--accent);display:block;margin-bottom:16px}
.craft-card h3{font-family:var(--serif);font-weight:500;font-size:20px;margin-bottom:10px}
.craft-card p{font-size:14px;line-height:1.7;color:var(--ink-soft)}

/* quiet luxe тизер */
.luxe{background:#191512;color:#efe9df;padding:100px 32px;position:relative;overflow:hidden}
.luxe-glow{position:absolute;inset:0;pointer-events:none;background:radial-gradient(460px circle at var(--mx,50%) var(--my,50%),rgba(201,154,107,.10),transparent 70%)}
.luxe-inner{max-width:640px;margin:0 auto;text-align:center;position:relative}
.luxe-eyebrow{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:#c99a6b;margin-bottom:20px}
.luxe-title{font-family:var(--serif);font-weight:400;font-size:clamp(38px,7vw,68px);letter-spacing:.06em;margin-bottom:22px}
.luxe-title em{font-style:italic;color:#c99a6b}
.luxe-text{color:#b3aa99;font-size:15px;line-height:1.75;margin-bottom:34px}
.luxe-btn{display:inline-flex;align-items:center;gap:9px;border:1px solid #c99a6b;color:#efe9df;text-decoration:none;padding:14px 26px;border-radius:2px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;transition:background .25s,color .25s}
.luxe-btn:hover{background:#c99a6b;color:#191512}
.luxe-tease{text-align:center;padding:40px 20px 60px;display:flex;flex-direction:column;align-items:center;gap:18px}
.luxe-tease h3{font-family:var(--serif);font-weight:400;font-size:30px}
.luxe-tease p{max-width:480px;color:var(--ink-soft);font-size:14.5px;line-height:1.7}

/* доп. информация */
.info-block{max-width:760px;margin:0 auto;padding:90px 32px 20px}
@media(max-width:760px){.info-block{padding:60px 20px 10px}}
.faq{border-top:1px solid var(--line)}
.faq-item{border-bottom:1px solid var(--line)}
.faq-q{width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 4px;font-family:var(--serif);font-size:19px;color:var(--ink);text-align:left;transition:color .2s}
.faq-q:hover{color:var(--accent)}
.faq-plus{flex-shrink:0;transition:transform .35s cubic-bezier(.2,.7,.2,1);color:var(--accent)}
.faq-item.open .faq-plus{transform:rotate(45deg)}
.faq-a{display:grid;grid-template-rows:0fr;transition:grid-template-rows .4s cubic-bezier(.2,.7,.2,1)}
.faq-item.open .faq-a{grid-template-rows:1fr}
.faq-a p{overflow:hidden;color:var(--ink-soft);font-size:14.5px;line-height:1.7;padding:0 4px}
.faq-item.open .faq-a p{padding-bottom:22px}

/* сменяющееся слово */
.rot-word{display:inline-block;color:var(--accent);animation:rotword .5s cubic-bezier(.2,.7,.2,1)}
@keyframes rotword{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

/* манифест среди вещей */
.manifesto-card-wrap{margin:-20px 0}
.manifesto-card{border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:52px 20px;display:flex;flex-direction:column;align-items:center;gap:22px;text-align:center}
.manifesto-card p{font-family:var(--serif);font-size:clamp(21px,3vw,29px);line-height:1.4;font-style:italic;color:var(--ink)}

/* пульс бейджа корзины */
.badge-pop{animation:badgepop .45s cubic-bezier(.2,.9,.3,1.4)}
@keyframes badgepop{0%{transform:scale(.4)}60%{transform:scale(1.25)}100%{transform:scale(1)}}

/* страница вещи */
.p-top{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:8px}
.p-crumb{font-size:13px;color:var(--ink-soft);display:inline-flex;align-items:center;gap:10px}
.p-crumb b{font-family:var(--serif);font-size:17px;color:var(--accent)}
.p-crumb-nav{display:inline-flex;gap:6px;margin-left:4px}
.p-crumb-nav button{width:30px;height:30px;border:1px solid var(--line);border-radius:50%;display:grid;place-items:center;color:var(--ink);transition:all .2s}
.p-crumb-nav button:hover:not(:disabled){border-color:var(--ink);transform:translateX(0) scale(1.06)}
.p-crumb-nav button:disabled{opacity:.3;cursor:default}
.main-img{position:relative}
.main-img-frame{width:100%;height:100%;animation:imgfade .45s ease}
@keyframes imgfade{from{opacity:0;transform:scale(1.015)}to{opacity:1;transform:none}}
.gallery{position:sticky;top:86px;align-self:start}
@media(max-width:900px){.gallery{position:static}}
.avail-dot{font-size:12px;letter-spacing:.05em;padding:4px 11px;border-radius:100px;margin-left:6px;white-space:nowrap}
.avail-dot.in{background:rgba(74,107,82,.12);color:#3f5c47}
.avail-dot.low{background:rgba(176,120,40,.14);color:#8a5a1a}
.avail-dot.out{background:rgba(124,38,52,.1);color:var(--accent)}
.p-fabrics{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px}
.p-fabrics span{border:1px solid var(--line);background:var(--card);border-radius:100px;padding:6px 14px;font-size:12.5px;color:var(--ink-soft)}
.p-promise{display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:12.5px;color:var(--ink-soft);margin:22px 0 4px}
.p-promise i{font-style:normal;color:var(--accent)}
.product .related{margin-top:80px;padding-top:46px;border-top:1px solid var(--line)}

/* большой знак в подвале */
.footer-mark{display:flex;justify-content:center;padding:8px 20px 40px}

/* оформление — премиум */
.ck-head{display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap;margin-bottom:34px}
.ck-ref{font-size:13px;color:var(--ink-soft);letter-spacing:.06em}
.ck-block{border:1px solid var(--line);border-radius:8px;background:var(--card);padding:26px 26px 20px;margin-bottom:18px}
.ck-title{display:flex;align-items:baseline;gap:12px;font-family:var(--serif);font-weight:500;font-size:20px;margin-bottom:18px}
.ck-num{font-family:var(--serif);font-size:15px;color:var(--accent)}
.ck-hint{font-size:12.5px;color:var(--ink-soft);margin:4px 0 14px}
.pay-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:16px}
@media(max-width:560px){.pay-cards{grid-template-columns:1fr}}
.pay-card{border:1px solid var(--line);border-radius:10px;background:var(--paper);padding:15px 16px;display:flex;flex-direction:column;gap:4px;text-align:left;transition:border-color .2s,box-shadow .25s,transform .18s,background .2s;cursor:pointer}
.pay-card:hover:not(:disabled){border-color:var(--ink);transform:translateY(-2px);box-shadow:0 8px 20px rgba(26,22,19,.08)}
.pay-card.on{border-color:var(--accent);background:rgba(124,38,52,.05)}
.pay-card:disabled{cursor:default}
.pc-t{font-weight:600;font-size:14px}
.pc-d{font-size:12px;color:var(--ink-soft)}
.pay-soon{opacity:.55;position:relative}
.pay-soon .pc-d{color:var(--accent)}
.ck-items{display:flex;flex-direction:column;gap:12px;margin-bottom:16px}
.ck-item{display:flex;align-items:center;gap:12px}
.ck-thumb{width:54px;height:54px;border-radius:4px;overflow:hidden;background:#fff;flex-shrink:0;border:1px solid var(--line)}
.ck-item-info{flex:1;min-width:0}
.ck-item-name{font-size:13.5px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ck-item-meta{font-size:12px;color:var(--ink-soft);margin-top:2px}
.ck-item-price{font-size:13.5px;white-space:nowrap}
.ck-promise{justify-content:center;margin-top:16px}
.success-sbp{max-width:360px;margin:0 auto 26px;text-align:left}

/* таймлайн заказа */
.order-steps{display:flex;justify-content:center;gap:0;margin:26px auto 6px;flex-wrap:wrap;max-width:560px}
.ostep{display:flex;align-items:center;gap:8px;position:relative;padding:6px 0}
.ostep-dot{width:24px;height:24px;border-radius:50%;border:1.5px solid var(--line);display:grid;place-items:center;font-size:11px;color:var(--ink-soft);background:var(--paper);flex-shrink:0}
.ostep.done .ostep-dot{background:var(--ink);border-color:var(--ink);color:var(--paper)}
.ostep.now .ostep-dot{border-color:var(--accent);color:var(--accent);animation:pulse 2s ease infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(124,38,52,.25)}50%{box-shadow:0 0 0 6px rgba(124,38,52,0)}}
.ostep-t{font-size:12px;color:var(--ink-soft);white-space:nowrap}
.ostep.done .ostep-t,.ostep.now .ostep-t{color:var(--ink)}
.ostep-line{width:34px;height:1px;background:var(--line);margin:0 10px}
@media(max-width:560px){.ostep-line{width:14px;margin:0 6px}.ostep-t{font-size:11px}}

/* копирование реквизитов */
.sbp-copy{display:inline-flex;align-items:center;gap:10px}
.copy-btn{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);border:1px solid var(--line);border-radius:100px;padding:5px 12px;transition:all .2s;white-space:nowrap}
.copy-btn:hover{border-color:var(--accent)}
.copy-btn.ok{background:var(--accent);color:#fff;border-color:var(--accent)}
.success-sbp{max-width:420px;margin:20px auto 6px;text-align:left}

/* ================== МОБИЛЬНАЯ ВЕРСИЯ ================== */
@media(max-width:900px){
  /* меню */
  .mobile-menu{padding:0;gap:0}
  .mm-top{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--line)}
  .menu-close{position:static}
  .mm-links{display:flex;flex-direction:column;padding:8px 0}
  .mobile-link{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 24px;font-family:var(--serif);font-size:24px;color:var(--ink);border-bottom:1px solid var(--line);opacity:0;transform:translateX(-12px);animation:mmin .45s cubic-bezier(.2,.7,.2,1) forwards}
  .mobile-link svg{color:var(--accent);flex-shrink:0}
  .mobile-link:active{background:var(--card)}
  @keyframes mmin{to{opacity:1;transform:none}}
  .mm-foot{margin-top:auto;display:flex;gap:12px;padding:22px 24px 30px}
  .mm-social{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);border-radius:100px;padding:10px 18px;font-size:13px;color:var(--ink);text-decoration:none}

  /* первый экран короче и живее */
  .bhero{min-height:auto;padding:54px 22px 66px}
  .bhero-mark{font-size:clamp(200px,68vw,340px);opacity:.06}
  .bhero-tag{font-size:15px}
  .bhero-cta{width:100%;flex-direction:column;gap:10px}
  .bhero-cta .btn-primary,.bhero-cta .btn-ghost{width:100%}
  .bhero-est{position:static;transform:none;margin-top:34px}
  .bhero-scroll{display:none}

  /* цифры в 2 колонки крупнее */
  .stats{gap:0}
  .stat{border:1px solid var(--line);border-radius:12px;margin:6px}

  /* вещь дропа: фото сверху, всё крупно, кнопка широкая */
  .drop-list{gap:56px}
  .piece-no{font-size:34px;margin-bottom:8px}
  .piece-name{font-size:26px}
  .piece-desc{font-size:14px}
  .piece-row{flex-direction:column;align-items:stretch;gap:14px}
  .piece-actions{width:100%}
  .piece-actions .btn-primary{flex:1}
  .piece-price{justify-content:flex-start}

  /* карта манифеста компактнее */
  .manifesto-card{padding:40px 18px}

  /* лента кадров — подсказка что листается */
  .strip-track{scroll-snap-type:x mandatory}

  /* заголовки секций ровнее */
  .drop-head{margin-bottom:32px}
  .drop-tools{width:100%;flex-direction:column;align-items:stretch;gap:10px}
  .line-tabs{width:auto;align-self:flex-start;max-width:100%;overflow-x:auto;justify-content:flex-start}
  .search-wrap{width:100%}
  .search-wrap input{width:100%}

  /* товар: галерея и инфо, липкая покупка */
  .product-grid{gap:22px}
  .p-name{font-size:28px}
  .thumbs{gap:8px}
  .add-row{position:sticky;bottom:12px;z-index:20;background:color-mix(in srgb, var(--paper) 90%, transparent);backdrop-filter:blur(10px);padding:10px;margin:20px -10px 24px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.1)}
  .p-crumb{font-size:12px}

  /* оформление на мобильном: сводка НЕ липкая, уходит под форму */
  .checkout-grid{display:flex;flex-direction:column}
  .summary{position:static;order:1;top:auto}
  .field input,.field textarea,.field select{font-size:16px;padding:14px}
  .pay-cards{grid-template-columns:1fr}

  /* корзина: строки в столбик */
  .cart-line{gap:12px}
}

@media(max-width:520px){
  .stats{grid-template-columns:repeat(2,minmax(0,1fr))}
  .ticker-item{font-size:13px}
  .craft-card{padding:22px 20px}
  .luxe{padding:70px 22px}
  .to-top{right:14px;bottom:14px;width:42px;height:42px}
}

/* аккуратные тач-таргеты */
@media(hover:none){
  .piece-media:hover .garment{transform:none}
  .piece-alt{display:none}
  .craft-card:hover{transform:none;box-shadow:none}
}

/* зум по наведению */
.zoom-img{position:relative;width:100%;height:100%;cursor:zoom-in;overflow:hidden}
.zoom-img .garment{transition:opacity .3s}
.zoom-img.zoomed .garment{opacity:0}
.zoom-img.zoomed::after{content:"";position:absolute;inset:0;background-image:var(--zurl);background-repeat:no-repeat;background-size:200%;background-position:var(--zx,50%) var(--zy,50%);background-color:#fff}
.zoom-hint{position:absolute;left:14px;bottom:14px;display:inline-flex;align-items:center;gap:6px;background:rgba(26,22,19,.72);color:#fff;font-size:11px;letter-spacing:.03em;padding:6px 11px;border-radius:100px;pointer-events:none;opacity:0;transition:opacity .25s;z-index:3}
.zoom-img:hover .zoom-hint{opacity:1}
.zoom-img.zoomed .zoom-hint{opacity:0}
.img-expand{position:absolute;top:14px;right:14px;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.9);color:var(--ink);display:grid;place-items:center;box-shadow:0 4px 12px rgba(0,0,0,.12);z-index:3;transition:transform .2s}
.img-expand:hover{transform:scale(1.08)}
@media(hover:none){.zoom-hint{display:none}}

/* лайтбокс */
.lb{position:fixed;inset:0;z-index:100;background:rgba(20,17,15,.96);display:flex;flex-direction:column;animation:fade .25s ease}
.lb-bar{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;color:#fff}
.lb-count{font-size:13px;letter-spacing:.1em;color:#cbbfae}
.lb-tools{display:flex;gap:8px}
.lb-tools button{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;color:#fff;background:rgba(255,255,255,.08);transition:background .2s}
.lb-tools button:hover{background:rgba(255,255,255,.16)}
.lb-stage{flex:1;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:0 12px}
.lb-imgwrap{max-width:min(92vw,900px);max-height:78vh;display:flex;align-items:center;justify-content:center}
.lb-imgwrap img{max-width:100%;max-height:78vh;object-fit:contain;transition:transform .3s cubic-bezier(.2,.7,.2,1);border-radius:2px;background:#fff}
.lb-nav{position:absolute;top:50%;transform:translateY(-50%);width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,.1);color:#fff;display:grid;place-items:center;transition:background .2s,transform .2s;z-index:2}
.lb-nav:hover{background:rgba(255,255,255,.2)}
.lb-prev{left:14px}.lb-next{right:14px}
.lb-thumbs{display:flex;gap:8px;justify-content:center;padding:16px 12px 22px;overflow-x:auto}
.lb-thumb{flex:0 0 auto;width:58px;height:58px;border-radius:6px;overflow:hidden;opacity:.45;border:1.5px solid transparent;transition:opacity .2s,border-color .2s}
.lb-thumb.on{opacity:1;border-color:#c99a6b}
.lb-thumb img{width:100%;height:100%;object-fit:contain;background:#fff}
@media(max-width:640px){
  .lb-nav{width:44px;height:44px}
  .lb-imgwrap{max-height:64vh}.lb-imgwrap img{max-height:64vh}
  .zoom-img{cursor:pointer}
}



/* карточки способа оформления */
.mode-cards{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:600px){.mode-cards{grid-template-columns:1fr}}
.mode-card{border:1px solid var(--line);border-radius:14px;background:var(--paper);padding:20px;display:flex;flex-direction:column;align-items:flex-start;gap:8px;text-align:left;cursor:pointer;transition:border-color .25s,box-shadow .3s,transform .2s,background .25s;position:relative}
.mode-card:hover:not(:disabled){border-color:var(--ink);transform:translateY(-3px);box-shadow:0 14px 34px rgba(26,22,19,.1)}
.mode-card.on{border-color:var(--accent);background:rgba(124,38,52,.045);box-shadow:0 10px 30px rgba(124,38,52,.1)}
.mode-ic{width:40px;height:40px;border-radius:50%;background:var(--card);display:grid;place-items:center;color:var(--accent);margin-bottom:4px}
.mode-card.on .mode-ic{background:var(--accent);color:#fff}
.mode-t{font-family:var(--serif);font-size:20px;color:var(--ink)}
.mode-d{font-size:13.5px;line-height:1.6;color:var(--ink-soft)}
.mode-badge{margin-top:4px;font-size:11.5px;letter-spacing:.03em;color:var(--accent);background:rgba(124,38,52,.08);border-radius:100px;padding:5px 12px}
.mode-soon{opacity:.55;cursor:not-allowed}
.mode-soon .mode-badge{color:var(--ink-soft);background:var(--card)}

.toggle-row{display:flex;gap:12px;align-items:flex-start;padding:14px;border:1px solid var(--line);border-radius:10px;background:var(--card);margin-bottom:14px;cursor:pointer}
.toggle-row input{width:20px;height:20px;margin-top:2px;flex-shrink:0;accent-color:var(--accent)}
.toggle-row b{display:block;font-size:14px;font-weight:500;margin-bottom:3px}
.toggle-row i{font-style:normal;font-size:12.5px;color:var(--ink-soft);line-height:1.5}

/* кинематографичная история вещи */
.pstory{max-width:1120px;margin:70px auto 0;padding:0 32px}
@media(max-width:760px){.pstory{padding:0 20px;margin-top:50px}}
.pstory-quote-wrap{margin:0 0 70px}
.pstory-quote{text-align:center;max-width:760px;margin:0 auto;position:relative;padding:20px}
.pstory-mark{font-family:var(--serif);font-size:90px;color:var(--accent);opacity:.28;line-height:0;position:absolute;top:34px;left:0}
.pstory-quote p{font-family:var(--serif);font-size:clamp(21px,3.2vw,32px);line-height:1.5;color:var(--ink);font-style:italic}
.pstory-sign{display:inline-block;margin-top:20px;font-size:11px;letter-spacing:.25em;text-transform:uppercase;color:var(--accent)}

.pstory-bands{display:flex;flex-direction:column;gap:70px}
.pstory-band{display:grid;grid-template-columns:1.15fr 1fr;gap:48px;align-items:center}
.pstory-band.flip{direction:rtl}
.pstory-band.flip>*{direction:ltr}
@media(max-width:820px){.pstory-band,.pstory-band.flip{grid-template-columns:1fr;gap:22px;direction:ltr}}
.pstory-media{position:relative;aspect-ratio:4/5;border-radius:10px;overflow:hidden;background:#fff;cursor:zoom-in;box-shadow:0 4px 30px rgba(26,22,19,.07)}
.pstory-media img{width:100%;height:100%;object-fit:contain;background:#fff;transition:transform 1s cubic-bezier(.2,.7,.2,1)}
.pstory-media:hover img{transform:scale(1.06)}
.pstory-zoom{position:absolute;right:14px;bottom:14px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.92);display:grid;place-items:center;color:var(--ink);opacity:0;transform:translateY(6px);transition:opacity .3s,transform .3s}
.pstory-media:hover .pstory-zoom{opacity:1;transform:none}
.pstory-no{font-family:var(--serif);font-size:34px;color:var(--accent);display:block;margin-bottom:12px}
.pstory-text h3{font-family:var(--serif);font-weight:400;font-size:clamp(22px,3vw,30px);line-height:1.2;margin-bottom:12px}
.pstory-text p{color:var(--ink-soft);font-size:15px;line-height:1.75;max-width:420px}

.texture-wrap{margin:80px 0 0;padding-top:44px;border-top:1px solid var(--line)}
.texture-strip{display:flex;gap:14px;overflow-x:auto;padding-bottom:10px;scroll-snap-type:x mandatory}
.texture-shot{position:relative;flex:0 0 auto;width:230px;aspect-ratio:1/1;border-radius:10px;overflow:hidden;background:#fff;cursor:zoom-in;scroll-snap-align:start;box-shadow:0 2px 16px rgba(26,22,19,.05)}
.texture-shot img{width:100%;height:100%;object-fit:contain;background:#fff;transition:transform .7s ease}
.texture-shot:hover img{transform:scale(1.1)}
.texture-zoom{position:absolute;right:10px;bottom:10px;width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.92);display:grid;place-items:center;color:var(--ink);opacity:0;transition:opacity .25s}
.texture-shot:hover .texture-zoom{opacity:1}
@media(max-width:760px){.texture-shot{width:170px}}

/* мета-строка под названием */
.p-meta-line{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);margin:2px 0 16px}

/* чистый аккордеон характеристик */
.p-acc{margin-top:26px;border-top:1px solid var(--line)}
.p-acc-item{border-bottom:1px solid var(--line)}
.p-acc-q{width:100%;display:flex;justify-content:space-between;align-items:center;gap:14px;padding:16px 2px;font-size:14px;letter-spacing:.02em;color:var(--ink);text-align:left;transition:color .2s}
.p-acc-q:hover{color:var(--accent)}
.p-acc-plus{flex-shrink:0;color:var(--accent);transition:transform .35s cubic-bezier(.2,.7,.2,1)}
.p-acc-item.open .p-acc-plus{transform:rotate(45deg)}
.p-acc-a{display:grid;grid-template-rows:0fr;transition:grid-template-rows .35s cubic-bezier(.2,.7,.2,1)}
.p-acc-item.open .p-acc-a{grid-template-rows:1fr}
.p-acc-a>div{overflow:hidden;color:var(--ink-soft);font-size:14px;line-height:1.7}
.p-acc-item.open .p-acc-a>div{padding:0 2px 18px}

/* индикатор активной линии/темы */
.line-tabs button{position:relative}
.line-tabs button.on::before{content:"";position:absolute;left:14px;right:14px;bottom:-2px;height:2px;background:transparent}
/* мягкое свечение вокруг активной вкладки уже задано box-shadow */

/* плавная смена темы для крупных тёмных блоков */
.lines,.drop,.craft,.stats,.info-block,.philosophy,.ticker{transition:background .8s ease}

/* переключатель линий в hero */
.hero-lines{display:inline-flex;gap:6px;padding:5px;border:1px solid var(--line);border-radius:100px;background:var(--card);margin:0 auto 22px;position:relative;z-index:2}
.hero-line-btn{padding:9px 22px;border-radius:100px;font-size:13px;letter-spacing:.04em;color:var(--ink-soft);transition:color .3s;position:relative}
.hero-line-btn.on{color:#fff}
.hero-line-btn.on::before{content:"";position:absolute;inset:0;background:var(--accent);border-radius:100px;z-index:-1;box-shadow:0 6px 18px rgba(var(--glow),.35);animation:pillpop .4s cubic-bezier(.2,.9,.3,1.3)}
@keyframes pillpop{0%{transform:scale(.85)}60%{transform:scale(1.04)}100%{transform:scale(1)}}
.hero-line-btn:not(.on):hover{color:var(--ink)}

/* материал вещи в каталоге */
.piece-material{display:flex;align-items:center;gap:12px;margin-bottom:18px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card);max-width:340px;transition:border-color .3s,transform .3s}
.piece-material:hover{border-color:var(--accent);transform:translateX(3px)}
.pm-swatch{width:44px;height:44px;border-radius:8px;overflow:hidden;flex-shrink:0;background:#fff;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06)}
.pm-swatch img{width:100%;height:100%;object-fit:cover;display:block}
.pm-color{display:block;width:100%;height:100%}
.pm-text{display:flex;flex-direction:column;gap:2px;min-width:0}
.pm-label{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent)}
.pm-value{font-size:13px;color:var(--ink);line-height:1.4}

/* редактор материалов в админке */
.mat-editor{display:flex;flex-direction:column;gap:10px}
.mat-row{display:flex;align-items:center;gap:10px}
.mat-photo{position:relative;width:46px;height:46px;flex-shrink:0;border:1px solid var(--line);border-radius:8px;overflow:hidden;cursor:pointer;background:var(--card);display:grid;place-items:center}
.mat-photo img{width:100%;height:100%;object-fit:cover}
.mat-photo-add{color:var(--ink-soft)}
.mat-loading{position:absolute;inset:0;display:grid;place-items:center;background:rgba(255,255,255,.7);font-size:18px}
.mat-name{flex:1;padding:11px 12px;border:1px solid var(--line);border-radius:8px;font-family:inherit;font-size:14px;background:var(--paper);color:var(--ink)}
.mat-del{width:38px;height:38px;flex-shrink:0;display:grid;place-items:center;border:1px solid var(--line);border-radius:8px;color:var(--ink-soft);transition:all .2s}
.mat-del:hover{border-color:var(--accent);color:var(--accent)}
.mat-add{display:inline-flex;align-items:center;gap:7px;padding:10px 16px;border:1px dashed var(--line);border-radius:8px;font-size:13px;color:var(--ink);align-self:flex-start;transition:border-color .2s}
.mat-add:hover{border-color:var(--accent);color:var(--accent)}

/* несколько материалов в каталоге — стопкой */
.piece-mats{display:flex;flex-direction:column;gap:8px;margin-bottom:18px}
.piece-mats .piece-material{margin-bottom:0}

/* материалы в аккордеоне товара */
.acc-mats{display:flex;flex-direction:column;gap:10px}
.acc-mat{display:flex;align-items:center;gap:12px}
.acc-mat img{width:40px;height:40px;border-radius:8px;object-fit:cover;flex-shrink:0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06)}
.acc-mat span{font-size:14px;color:var(--ink)}
.acc-care{margin-top:4px;font-size:13px;color:var(--ink-soft);line-height:1.6}

/* отзыв заявки покупателем */
.order-cancel-btn{margin-top:12px;font-size:13px;color:var(--ink-soft);border:1px solid var(--line);border-radius:8px;padding:8px 16px;transition:all .2s}
.order-cancel-btn:hover{border-color:var(--accent);color:var(--accent)}
.order-cancel-confirm{margin-top:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px;color:var(--ink)}
.order-cancelled-note{margin-top:12px;font-size:13px;color:var(--accent)}
.btn-danger.sm,.btn-ghost.sm{padding:7px 14px;font-size:12px;border-radius:8px}

/* аналитика */
.analytics{animation:fade .3s ease}
.an-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:26px}
@media(max-width:900px){.an-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
.an-card{border:1px solid var(--line);border-radius:12px;background:var(--card);padding:20px}
.an-val{font-family:var(--serif);font-size:26px;color:var(--ink);line-height:1.1}
.an-label{font-size:13px;color:var(--ink);margin-top:6px}
.an-sub{font-size:11px;color:var(--ink-soft);margin-top:2px}
.an-charts{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:900px){.an-charts{grid-template-columns:1fr}}
.an-chart{border:1px solid var(--line);border-radius:12px;background:var(--card);padding:22px}
.an-chart-wide{grid-column:1/-1}
.an-chart-title{font-family:var(--serif);font-weight:400;font-size:18px;margin-bottom:20px}
.an-bars{display:flex;align-items:flex-end;gap:10px;height:180px}
.an-bar-col{flex:1;display:flex;flex-direction:column;align-items:center;height:100%}
.an-bar-wrap{flex:1;width:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:6px}
.an-bar-val{font-size:10px;color:var(--ink-soft);white-space:nowrap}
.an-bar{width:100%;max-width:46px;background:linear-gradient(var(--accent),color-mix(in srgb,var(--accent) 60%,transparent));border-radius:6px 6px 0 0;min-height:3px;transition:height .6s cubic-bezier(.2,.7,.2,1)}
.an-bar-label{font-size:12px;color:var(--ink-soft);margin-top:8px;text-transform:capitalize}
.an-rows{display:flex;flex-direction:column;gap:12px}
.an-row{display:flex;align-items:center;gap:12px}
.an-row-label{font-size:13px;color:var(--ink);width:130px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.an-row-track{flex:1;height:10px;background:var(--paper);border-radius:100px;overflow:hidden}
.an-row-fill{height:100%;background:var(--accent);border-radius:100px;transition:width .6s cubic-bezier(.2,.7,.2,1)}
.an-row-fill.gold{background:#c99a6b}
.an-row-n{font-size:13px;color:var(--ink-soft);width:56px;text-align:right;flex-shrink:0}
.an-empty{font-size:13px;color:var(--ink-soft)}
.an-note{margin-top:18px;font-size:12px;color:var(--ink-soft)}

/* приветствие после подтверждения почты */
.welcome-toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:95;display:flex;align-items:center;gap:9px;background:var(--ink);color:var(--paper);padding:12px 20px;border-radius:100px;font-size:13.5px;box-shadow:0 10px 30px rgba(0,0,0,.25);animation:toastin .5s cubic-bezier(.2,.9,.3,1.2)}
.welcome-toast svg{color:#7fbf8f;flex-shrink:0}
@keyframes toastin{from{opacity:0;transform:translateX(-50%) translateY(-14px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
@media(max-width:600px){.welcome-toast{left:12px;right:12px;transform:none;justify-content:center}
@keyframes toastin{from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:none}}}

/* экран «проверьте почту» */
.confirm-card{text-align:center}
.confirm-icon{background:var(--accent)!important;color:#fff!important}
.confirm-h{font-family:var(--serif);font-weight:400;font-size:26px;margin:14px 0 10px}
.confirm-p{font-size:14.5px;line-height:1.7;color:var(--ink-soft);margin-bottom:18px}
.confirm-p b{color:var(--ink);font-weight:500}
.confirm-hint{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-size:12.5px;color:var(--ink-soft);line-height:1.55;margin-bottom:18px}

@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;
