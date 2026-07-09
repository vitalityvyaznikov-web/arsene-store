import { supabase, BUCKET } from "./supabase";

/* ---------- Преобразование строк БД <-> объектов приложения ---------- */
const fromRow = (r) => ({
  id: r.id,
  name: r.name,
  brand: r.brand || "",
  cat: r.cat,
  type: r.type,
  price: Number(r.price),
  oldPrice: Number(r.old_price || 0),
  material: r.material || "",
  care: r.care || "",
  desc: r.descr || "",
  tag: r.tag || undefined,
  sizes: r.sizes || [],
  colors: r.colors || [],
  images: r.images || [],
  stock: r.stock ?? 0,
  delivery: r.delivery || "1–3 дня по России",
});

const toRow = (p) => ({
  name: p.name,
  brand: p.brand || "",
  cat: p.cat,
  type: p.type,
  price: p.price,
  old_price: p.oldPrice || 0,
  material: p.material || "",
  care: p.care || "",
  descr: p.desc || "",
  tag: p.tag || null,
  sizes: p.sizes || [],
  colors: p.colors || [],
  images: p.images || [],
  stock: p.stock ?? 0,
  delivery: p.delivery || "1–3 дня по России",
});

/* ---------------------------- ТОВАРЫ ---------------------------- */
export async function fetchProducts() {
  const { data, error } = await supabase.from("products").select("*").order("id");
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function createProduct(p) {
  const { data, error } = await supabase.from("products").insert(toRow(p)).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateProductDb(id, p) {
  const { data, error } = await supabase.from("products").update(toRow(p)).eq("id", id).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteProductDb(id) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

/* --------------------------- НАСТРОЙКИ --------------------------- */
export async function fetchSettings() {
  const { data, error } = await supabase.from("settings").select("data").eq("id", 1).single();
  if (error) throw error;
  return data?.data || {};
}

export async function saveSettingsDb(obj) {
  const { error } = await supabase.from("settings").update({ data: obj }).eq("id", 1);
  if (error) throw error;
}

/* ----------------------------- ЗАКАЗЫ ----------------------------- */
export async function createOrder(order, userId) {
  const row = {
    id: order.id,
    user_id: userId || null,
    customer: order.customer,
    delivery: order.delivery,
    payment: order.payment,
    items: order.items,
    subtotal: order.subtotal,
    shipping: order.shipping,
    total: order.total,
    status: "Обработка",
  };
  const { data, error } = await supabase.from("orders").insert(row).select().single();
  if (error) throw error;
  return normalizeOrder(data);
}

export async function fetchOrders() {
  // RLS сама решит: покупатель видит свои, админ — все
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeOrder);
}

export async function setOrderStatus(id, status) {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw error;
}

const normalizeOrder = (o) => ({
  id: o.id,
  userEmail: o.customer?.email || null,
  userId: o.user_id,
  customer: o.customer,
  delivery: o.delivery,
  payment: o.payment,
  items: o.items,
  subtotal: Number(o.subtotal),
  shipping: Number(o.shipping),
  total: Number(o.total),
  status: o.status,
  createdAt: new Date(o.created_at).getTime(),
});

/* ------------------------- АВТОРИЗАЦИЯ ------------------------- */
export async function signUp({ name, email, phone, pass }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
    options: { data: { name, phone } },
  });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  if (!data.session) return { ok: false, error: "Подтвердите e-mail по ссылке из письма, затем войдите." };
  return { ok: true };
}

export async function signIn(email, pass) {
  const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  return { ok: true };
}

export async function signOut() {
  await supabase.auth.signOut();
}

/** Профиль текущего пользователя: имя, телефон, роль, корзина, избранное */
export async function fetchProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

export async function saveProfileState(userId, { cart, favorites }) {
  const { error } = await supabase.from("profiles").update({ cart, favorites }).eq("id", userId);
  if (error) console.error("Не удалось сохранить корзину/избранное:", error.message);
}

function translateAuthError(msg = "") {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Неверная почта или пароль";
  if (m.includes("already registered") || m.includes("already been registered")) return "Почта уже зарегистрирована";
  if (m.includes("password")) return "Пароль слишком короткий (минимум 6 символов)";
  if (m.includes("email")) return "Введите корректный e-mail";
  return msg;
}

/* --------------------- ЗАГРУЗКА ФОТО В ХРАНИЛИЩЕ --------------------- */
/**
 * Загружает две версии фото: полную 900x900 и миниатюру 400x400.
 * Возвращает { full, thumb } — каталог грузит лёгкую, карточка товара полную.
 */
export async function uploadProductImage(file) {
  const base = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [fullBlob, thumbBlob] = await Promise.all([
    squareBlob(file, 900, 0.85),
    squareBlob(file, 400, 0.8),
  ]);
  const [full, thumb] = await Promise.all([
    putImage(`${base}.jpg`, fullBlob),
    putImage(`${base}-thumb.jpg`, thumbBlob),
  ]);
  return { full, thumb };
}

async function putImage(path, blob) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function squareBlob(file, size = 900, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Не удалось открыть изображение"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff"; // белые поля, если фото не квадратное
        ctx.fillRect(0, 0, size, size);
        const scale = Math.min(size / img.width, size / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Ошибка сжатия"))), "image/jpeg", quality);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
