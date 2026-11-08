"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");
const { DatabaseSync } = require("node:sqlite");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "网页前端");
const DATA_DIR = path.join(ROOT, "data");
const PORT = Number(process.env.YUEXUAN_PORT || process.env.PORT || 8787);
const HOST = process.env.YUEXUAN_HOST || "0.0.0.0";
const ADMIN_ACCOUNT = process.env.YUEXUAN_ADMIN_ACCOUNT || "merchant";
const ADMIN_PASSWORD = process.env.YUEXUAN_ADMIN_PASSWORD || "YueXuan@2026Admin";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;
const DB_PATH = process.env.YUEXUAN_DB_PATH || path.join(DATA_DIR, "yuexuan.db");

const COUPON_CAMPAIGNS = [
  { id: "WELCOME10", badge: "新人礼", name: "新人满减券", title: "满99减10元", value: "¥10", condition: "满99元可用", auto: true, expires: "领取后30天" },
  { id: "MEMBER_SHIP", badge: "会员礼", name: "会员包邮券", title: "全场包邮", value: "包邮", condition: "不限订单金额", auto: true, expires: "领取后30天" },
  { id: "WEEKEND20", badge: "周末礼", name: "周末满减券", title: "满199减20元", value: "¥20", condition: "满199元可用", auto: false, expires: "领取后7天" },
  { id: "ORDER50", badge: "满减礼", name: "大额满减券", title: "满399减50元", value: "¥50", condition: "满399元可用", auto: false, expires: "领取后15天" },
  { id: "DIGITAL150", badge: "数码礼", name: "数码品类券", title: "满2999减150元", value: "¥150", condition: "满2999元可用", auto: false, expires: "领取后15天" },
  { id: "HOME40", badge: "家居礼", name: "家居焕新券", title: "满499减40元", value: "¥40", condition: "满499元可用", auto: false, expires: "领取后15天" },
  { id: "BEAUTY30", badge: "美妆礼", name: "个护美妆券", title: "满199减30元", value: "¥30", condition: "满199元可用", auto: false, expires: "领取后15天" }
];

const POINT_REWARDS = [
  { id: "R001", kind: "coupon", category: "优惠券", name: "5元无门槛券", points: 500, value: "¥5", condition: "全场商品可用", limit: 3 },
  { id: "R002", kind: "coupon", category: "优惠券", name: "包邮券", points: 300, value: "包邮", condition: "不限订单金额", limit: 3 },
  { id: "R003", kind: "coupon", category: "优惠券", name: "15元满减券", points: 1200, value: "¥15", condition: "满129元可用", limit: 3 },
  { id: "R004", kind: "coupon", category: "优惠券", name: "30元满减券", points: 2000, value: "¥30", condition: "满299元可用", limit: 2 },
  { id: "R005", kind: "coupon", category: "优惠券", name: "50元大额券", points: 3200, value: "¥50", condition: "满499元可用", limit: 2 },
  { id: "R006", kind: "coupon", category: "优惠券", name: "100元大额券", points: 6000, value: "¥100", condition: "满1999元可用", limit: 1 },
  { id: "R007", kind: "product", category: "实物礼品", name: "天然竹木锅铲", points: 2600, productId: "P021", condition: "兑换后生成待发货订单", limit: 1 },
  { id: "R008", kind: "product", category: "实物礼品", name: "黑色铝制水杯", points: 3200, productId: "P022", condition: "兑换后生成待发货订单", limit: 1 }
];

const LOYALTY_TASKS = [
  { id: "TASK_ADDRESS", name: "完善收货地址", description: "保存一条可用于结算的收货地址", points: 50 },
  { id: "TASK_SEARCH", name: "探索商城", description: "累计搜索 3 个不同关键词", points: 20 },
  { id: "TASK_ORDER", name: "完成首笔付款", description: "拥有一笔已支付订单", points: 80 },
  { id: "TASK_REVIEW", name: "发表首条评价", description: "完成订单后分享真实体验", points: 60 }
];

const DEFAULT_BUNDLES = [
  { id: "B001", name: "移动办公效率套装", items: [{ productId: "P001", quantity: 1 }, { productId: "P005", quantity: 1 }], discount: 20, enabled: true },
  { id: "B002", name: "晨间咖啡生活套装", items: [{ productId: "P012", quantity: 1 }, { productId: "P024", quantity: 1 }], discount: 35, enabled: true },
  { id: "B003", name: "居家运动入门套装", items: [{ productId: "P041", quantity: 1 }, { productId: "P042", quantity: 1 }], discount: 45, enabled: true }
];

const DEFAULT_PROMOTIONS = [
  { id: "M001", name: "会员提前购", type: "会员专享", description: "会员可提前选购本周新品", enabled: true, endsAt: "2026-12-31" },
  { id: "M002", name: "积分限时折扣", type: "积分活动", description: "指定礼品限时降低兑换门槛", enabled: true, endsAt: "2026-12-31" },
  { id: "M003", name: "组合购立减", type: "组合优惠", description: "指定商品一起购买自动立减", enabled: true, endsAt: "2026-12-31" },
  { id: "M004", name: "生日会员礼", type: "会员关怀", description: "生日当天可领取积分与专属券", enabled: true, endsAt: "长期" }
];

const EARLY_ACCESS = [
  { productId: "P003", minimumLifetimePoints: 0, label: "会员提前购" },
  { productId: "P004", minimumLifetimePoints: 0, label: "会员提前购" },
  { productId: "P005", minimumLifetimePoints: 2000, label: "银卡提前购" }
];

const PICKUP_STORES = [
  { id: "SZ-NANSHAN", name: "悦选南山体验店", city: "深圳", address: "南山区深南大道9668号", hours: "10:00—21:30", phone: "0755-88880001" },
  { id: "SZ-FUTIAN", name: "悦选福田中心店", city: "深圳", address: "福田区福华一路88号", hours: "10:00—22:00", phone: "0755-88880002" },
  { id: "SZ-LONGGANG", name: "悦选龙岗万象店", city: "深圳", address: "龙岗区龙翔大道99号", hours: "10:00—21:30", phone: "0755-88880003" }
];

const PREORDER_OFFERS = [
  { productId: "P002", label: "新品预约", availableDateOffset: 12, limit: 2 },
  { productId: "P009", label: "首发预约", availableDateOffset: 9, limit: 2 },
  { productId: "P010", label: "新品预售", availableDateOffset: 15, limit: 1 },
  { productId: "P096", label: "新品预约", availableDateOffset: 10, limit: 2 },
  { productId: "P157", label: "到货预约", availableDateOffset: 7, limit: 1 },
  { productId: "P168", label: "会员预售", availableDateOffset: 8, limit: 2 }
];

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH, { timeout: 5000 });
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK(role IN ('customer','admin')),
    customer_id TEXT,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  ) STRICT;
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    json TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE IF NOT EXISTS login_attempts (
    key TEXT PRIMARY KEY,
    failures INTEGER NOT NULL,
    blocked_until INTEGER NOT NULL
  ) STRICT;
  CREATE TABLE IF NOT EXISTS user_profiles (
    customer_id TEXT PRIMARY KEY,
    address_json TEXT,
    coupons_json TEXT NOT NULL,
    claims_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;
`);

function couponFromCampaign(campaign) {
  return { id: "CP-" + campaign.id, campaignId: campaign.id, name: campaign.name, value: campaign.value, condition: campaign.condition, expires: campaign.expires };
}

function ensureProfile(customerId) {
  let row = db.prepare("SELECT customer_id AS customerId,address_json AS addressJson,coupons_json AS couponsJson,claims_json AS claimsJson FROM user_profiles WHERE customer_id=?").get(customerId);
  if (!row) {
    const automatic = COUPON_CAMPAIGNS.filter(item => item.auto);
    const claims = Object.fromEntries(automatic.map(item => [item.id, { status: "available", claimedAt: new Date().toISOString(), source: "automatic" }]));
    db.prepare("INSERT INTO user_profiles(customer_id,address_json,coupons_json,claims_json,updated_at) VALUES(?,?,?,?,?)")
      .run(customerId, null, JSON.stringify(automatic.map(couponFromCampaign)), JSON.stringify(claims), new Date().toISOString());
    row = db.prepare("SELECT customer_id AS customerId,address_json AS addressJson,coupons_json AS couponsJson,claims_json AS claimsJson FROM user_profiles WHERE customer_id=?").get(customerId);
  }
  const claims = JSON.parse(row.claimsJson || "{}");
  const loyalty = Object.assign({ lastCheckIn: null, streak: 0, redemptionCounts: {}, birthday: "", birthdayClaimYear: "", repairMonth: "", taskClaims: {}, referralRewarded: false }, claims.__loyalty || {});
  const features = Object.assign({ history: [], compare: [], alerts: [], searchHistory: [], inviteCode: "YX" + String(customerId).replace(/\D/g, "").padStart(4, "0"), referredBy: null }, claims.__features || {});
  features.history = Array.isArray(features.history) ? features.history : [];
  features.compare = Array.isArray(features.compare) ? features.compare : [];
  features.alerts = Array.isArray(features.alerts) ? features.alerts : [];
  features.searchHistory = Array.isArray(features.searchHistory) ? features.searchHistory : [];
  return {
    customerId: row.customerId,
    address: row.addressJson ? JSON.parse(row.addressJson) : null,
    coupons: JSON.parse(row.couponsJson || "[]"),
    claims,
    loyalty,
    features
  };
}

function saveProfile(profile) {
  profile.claims.__loyalty = profile.loyalty || { lastCheckIn: null, streak: 0, redemptionCounts: {} };
  profile.claims.__features = profile.features || { history: [], compare: [], alerts: [], searchHistory: [] };
  db.prepare("UPDATE user_profiles SET address_json=?,coupons_json=?,claims_json=?,updated_at=? WHERE customer_id=?")
    .run(profile.address ? JSON.stringify(profile.address) : null, JSON.stringify(profile.coupons || []), JSON.stringify(profile.claims || {}), new Date().toISOString(), profile.customerId);
}

function couponCampaignState(profile) {
  return COUPON_CAMPAIGNS.map(campaign => {
    const claim = profile.claims[campaign.id] || null;
    const available = profile.coupons.some(coupon => coupon.campaignId === campaign.id || coupon.id === "CP-" + campaign.id);
    return Object.assign({}, campaign, { status: available ? "available" : claim ? "used" : campaign.auto ? "automatic" : "claimable" });
  });
}

function claimCampaign(customerId, campaignId) {
  const campaign = COUPON_CAMPAIGNS.find(item => item.id === campaignId);
  if (!campaign) throw new Error("优惠活动不存在");
  const profile = ensureProfile(customerId);
  if (profile.claims[campaignId]) throw new Error(profile.claims[campaignId].status === "used" ? "这张优惠券已经使用，不能重复领取" : "这张优惠券已经在卡包中");
  profile.coupons.unshift(couponFromCampaign(campaign));
  profile.claims[campaignId] = { status: "available", claimedAt: new Date().toISOString(), source: "claim" };
  saveProfile(profile);
  return couponFromCampaign(campaign);
}

function consumeCoupon(customerId, couponId) {
  const profile = ensureProfile(customerId);
  const index = profile.coupons.findIndex(item => item.id === couponId);
  if (index === -1) throw new Error("优惠券不存在、已使用或已失效");
  const coupon = profile.coupons.splice(index, 1)[0];
  if (coupon.campaignId && profile.claims[coupon.campaignId]) profile.claims[coupon.campaignId].status = "used";
  saveProfile(profile);
  return coupon;
}

function restoreCoupon(customerId, coupon) {
  if (!coupon || !coupon.id) return;
  const profile = ensureProfile(customerId);
  if (!profile.coupons.some(item => item.id === coupon.id)) profile.coupons.unshift(coupon);
  if (coupon.campaignId && profile.claims[coupon.campaignId]) profile.claims[coupon.campaignId].status = "available";
  saveProfile(profile);
}

function validateAddress(input) {
  const address = {
    receiver: String(input.receiver || "").trim(), phone: String(input.phone || "").trim(),
    region: String(input.region || "").trim(), detail: String(input.detail || "").trim()
  };
  if (address.receiver.length < 2 || address.receiver.length > 20) throw new Error("收货人姓名需填写 2—20 个字符");
  if (!/^1\d{10}$/.test(address.phone)) throw new Error("请输入正确的 11 位手机号码");
  if (address.region.length < 2 || address.region.length > 60) throw new Error("省市地区请填写 2—60 个字符");
  if (address.detail.length < 2 || address.detail.length > 100) throw new Error("详细地址请填写 2—100 个字符");
  return address;
}

function passwordDigest(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString("hex");
}

function createAccount(account, password, role, customerId) {
  const salt = crypto.randomBytes(16).toString("hex");
  db.prepare("INSERT INTO accounts(account, role, customer_id, password_salt, password_hash, created_at) VALUES(?,?,?,?,?,?)")
    .run(account, role, customerId || null, salt, passwordDigest(password, salt), new Date().toISOString());
}

if (!db.prepare("SELECT id FROM accounts WHERE role='admin' LIMIT 1").get()) {
  createAccount(ADMIN_ACCOUNT, ADMIN_PASSWORD, "admin", null);
}
if (!db.prepare("SELECT id FROM accounts WHERE account=?").get("13800001231")) {
  createAccount("13800001231", "Demo@123456", "customer", "C001");
}

function json(res, status, body, headers) {
  res.writeHead(status, Object.assign({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "SAMEORIGIN"
  }, headers || {}));
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > 2_000_000) {
        reject(new Error("请求内容过大"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); }
      catch { reject(new Error("请求格式不正确")); }
    });
    req.on("error", reject);
  });
}

function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map(v => v.trim()).filter(Boolean).map(v => {
    const at = v.indexOf("=");
    return [decodeURIComponent(v.slice(0, at)), decodeURIComponent(v.slice(at + 1))];
  }));
}

function session(req) {
  const token = cookies(req).yx_session;
  if (!token) return null;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const row = db.prepare(`SELECT a.id, a.account, a.role, a.customer_id AS customerId, s.expires_at AS expiresAt
    FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=?`).get(tokenHash);
  if (!row || Number(row.expiresAt) <= Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(tokenHash);
    return null;
  }
  return row;
}

function setSession(res, account) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  db.prepare("DELETE FROM sessions WHERE account_id=?").run(account.id);
  db.prepare("INSERT INTO sessions(token_hash, account_id, expires_at) VALUES(?,?,?)")
    .run(tokenHash, account.id, Date.now() + SESSION_MAX_AGE * 1000);
  return `yx_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}`;
}

function readState() {
  const row = db.prepare("SELECT json, version FROM app_state WHERE id=1").get();
  return row ? { data: ensureStateShape(JSON.parse(row.json)), version: Number(row.version) } : null;
}

function writeState(data) {
  ensureStateShape(data);
  const now = new Date().toISOString();
  const row = db.prepare("SELECT version FROM app_state WHERE id=1").get();
  const version = row ? Number(row.version) + 1 : 1;
  db.prepare(`INSERT INTO app_state(id,json,version,updated_at) VALUES(1,?,?,?)
    ON CONFLICT(id) DO UPDATE SET json=excluded.json, version=excluded.version, updated_at=excluded.updated_at`)
    .run(JSON.stringify(data), version, now);
  return version;
}

function builtInState() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(PUBLIC_DIR, "catalog-data.js"), "utf8"), sandbox, { filename: "catalog-data.js" });
  return {
    products: JSON.parse(JSON.stringify(sandbox.window.YUEXUAN_CATALOG || [])),
    customers: [{ id: "C001", name: "张宁", phone: "13800001231", region: "广东深圳", type: "老客户", points: 0 }],
    orders: [], stockRecords: [], pointRecords: [], reviews: [], questions: [], subscriptions: [], returnRequests: [], reservations: [], priceHistory: [], bundles: JSON.parse(JSON.stringify(DEFAULT_BUNDLES)), promotions: JSON.parse(JSON.stringify(DEFAULT_PROMOTIONS))
  };
}

function ensureStateShape(data) {
  data.products = Array.isArray(data.products) ? data.products : [];
  data.customers = Array.isArray(data.customers) ? data.customers : [];
  data.orders = Array.isArray(data.orders) ? data.orders : [];
  data.stockRecords = Array.isArray(data.stockRecords) ? data.stockRecords : [];
  data.pointRecords = Array.isArray(data.pointRecords) ? data.pointRecords : [];
  data.reviews = Array.isArray(data.reviews) ? data.reviews : [];
  data.questions = Array.isArray(data.questions) ? data.questions : [];
  data.subscriptions = Array.isArray(data.subscriptions) ? data.subscriptions : [];
  data.returnRequests = Array.isArray(data.returnRequests) ? data.returnRequests : [];
  data.reservations = Array.isArray(data.reservations) ? data.reservations : [];
  data.priceHistory = Array.isArray(data.priceHistory) ? data.priceHistory : [];
  data.products.forEach(product => {
    if (data.priceHistory.some(item => item.productId === product.id)) return;
    const price = Number(product.price || 0);
    data.priceHistory.push(
      { productId: product.id, price: Number((price * 1.12).toFixed(2)), date: dateOffset(-90), source: "历史价格" },
      { productId: product.id, price: Number((price * 1.05).toFixed(2)), date: dateOffset(-30), source: "历史价格" },
      { productId: product.id, price, date: today(), source: "当前价格" }
    );
  });
  data.bundles = Array.isArray(data.bundles) && data.bundles.length ? data.bundles : JSON.parse(JSON.stringify(DEFAULT_BUNDLES));
  data.promotions = Array.isArray(data.promotions) && data.promotions.length ? data.promotions : JSON.parse(JSON.stringify(DEFAULT_PROMOTIONS));
  data.orders.forEach(order => {
    if (!Array.isArray(order.timeline)) {
      order.timeline = [{ status: "订单创建", detail: "订单已提交", at: String(order.date || today()) + "T09:00:00.000Z", actor: "系统" }];
      if (order.status && order.status !== "待付款") order.timeline.push({ status: order.status, detail: "历史订单状态", at: String(order.date || today()) + "T10:00:00.000Z", actor: "系统" });
    }
  });
  return data;
}

if (process.env.YUEXUAN_SKIP_AUTO_SEED !== "1") {
  const storedState = readState();
  if (!storedState) {
    writeState(builtInState());
  } else {
    const beforeShape = JSON.stringify({ reviews: storedState.data.reviews, questions: storedState.data.questions, subscriptions: storedState.data.subscriptions, priceHistory: storedState.data.priceHistory, bundles: storedState.data.bundles, promotions: storedState.data.promotions });
    ensureStateShape(storedState.data);
    const catalog = builtInState().products;
    const catalogById = new Map(catalog.map(item => [item.id, item]));
    let catalogImageChanged = false;
    storedState.data.products.forEach(item => {
      const catalogItem = catalogById.get(item.id);
      if (catalogItem && item.imageAsset !== catalogItem.imageAsset) {
        item.imageAsset = catalogItem.imageAsset;
        catalogImageChanged = true;
      }
      if (catalogItem && Number(String(item.id).replace(/\D/g, "")) >= 127) {
        ["name", "spec", "category", "price", "cost"].forEach(field => {
          if (item[field] !== catalogItem[field]) { item[field] = catalogItem[field]; catalogImageChanged = true; }
        });
      }
    });
    const knownIds = new Set(storedState.data.products.map(item => item.id));
    const additions = catalog.filter(item => !knownIds.has(item.id));
    if (additions.length) {
      storedState.data.products.push(...additions);
      writeState(storedState.data);
    } else if (catalogImageChanged || beforeShape !== JSON.stringify({ reviews: storedState.data.reviews, questions: storedState.data.questions, subscriptions: storedState.data.subscriptions, priceHistory: storedState.data.priceHistory, bundles: storedState.data.bundles, promotions: storedState.data.promotions })) {
      writeState(storedState.data);
    }
  }
}

function filteredState(full, auth) {
  ensureStateShape(full);
  if (auth && auth.role === "admin") return full;
  const customerId = auth && auth.role === "customer" ? auth.customerId : null;
  return {
    products: full.products || [],
    customers: customerId ? (full.customers || []).filter(item => item.id === customerId) : [],
    orders: customerId ? (full.orders || []).filter(item => item.customerId === customerId) : [],
    stockRecords: [],
    pointRecords: customerId ? (full.pointRecords || []).filter(item => item.customerId === customerId) : [],
    reviews: full.reviews || [],
    questions: full.questions || [],
    subscriptions: customerId ? (full.subscriptions || []).filter(item => item.customerId === customerId) : [],
    returnRequests: customerId ? (full.returnRequests || []).filter(item => item.customerId === customerId) : [],
    reservations: customerId ? (full.reservations || []).filter(item => item.customerId === customerId) : [],
    priceHistory: full.priceHistory || [],
    bundles: (full.bundles || []).filter(item => item.enabled !== false),
    promotions: (full.promotions || []).filter(item => item.enabled !== false),
    earlyAccess: EARLY_ACCESS,
    pickupStores: PICKUP_STORES,
    preorderOffers: PREORDER_OFFERS.map(offer => Object.assign({}, offer, { availableDate: dateOffset(offer.availableDateOffset), reservationEnd: dateOffset(Math.max(1, offer.availableDateOffset - 3)) }))
  };
}

function nextId(prefix, items, digits) {
  const max = items.reduce((value, item) => Math.max(value, Number(String(item.id || "").replace(/\D/g, "")) || 0), 0);
  return prefix + String(max + 1).padStart(digits, "0");
}

function today() { return new Date().toISOString().slice(0, 10); }
function dateOffset(days, baseDate) {
  const base = baseDate ? new Date(String(baseDate) + "T00:00:00.000Z") : new Date();
  base.setUTCDate(base.getUTCDate() + Number(days || 0));
  return base.toISOString().slice(0, 10);
}
function subscriptionEligible(product) { return product && ["食品生鲜", "美妆个护", "商超百货", "厨房用品"].includes(product.category); }
function preorderOffer(productId) { return PREORDER_OFFERS.find(item => item.productId === productId) || null; }
function productOf(data, id) { return data.products.find(item => item.id === id); }
function customerOf(data, id) { return data.customers.find(item => item.id === id); }
function orderOf(data, id) { return data.orders.find(item => item.id === id); }
function requireRole(auth, roles) { if (!auth || !roles.includes(auth.role)) throw new Error("请先登录后再操作"); }
function requireOwner(auth, customerId) { if (!auth || (auth.role !== "admin" && auth.customerId !== customerId)) throw new Error("无权操作这项数据"); }

function promisedDate(days) {
  const date = new Date();
  let remaining = Math.max(1, Number(days || 1));
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() !== 0) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
}

function fulfillmentQuote(data, input, subtotalOverride) {
  const method = ["standard", "local", "pickup"].includes(input && input.method) ? input.method : "standard";
  const region = String(input && input.region || "").trim();
  const subtotal = Number.isFinite(Number(subtotalOverride)) ? Number(subtotalOverride) : Math.max(0, Number(input && input.subtotal || 0));
  const cutoffPassed = new Date().getHours() >= 16;
  if (method === "local") {
    if (!/深圳/.test(region)) throw new Error("同城配送目前仅支持深圳市地址");
    const fee = subtotal >= 199 ? 0 : 12;
    return { method, label: "同城配送", fee, estimatedDeliveryDate: promisedDate(1), promiseText: "今日16:00前下单，预计次日送达", storeId: null };
  }
  if (method === "pickup") {
    const store = PICKUP_STORES.find(item => item.id === String(input && input.storeId || ""));
    if (!store) throw new Error("请选择有效的自提门店");
    return { method, label: "门店自提", fee: 0, estimatedDeliveryDate: promisedDate(1), promiseText: "备货完成后短信通知，预计次日可提", storeId: store.id, storeName: store.name, storeAddress: store.address };
  }
  const fee = subtotal >= 99 ? 0 : 8;
  return { method: "standard", label: "标准配送", fee, estimatedDeliveryDate: promisedDate(cutoffPassed ? 3 : 2), promiseText: cutoffPassed ? "已过16:00截单时间，预计3个工作日内送达" : "16:00前下单，预计2个工作日内送达", storeId: null };
}

function couponSaving(coupon, subtotal, shippingFee) {
  if (!coupon) return 0;
  if (coupon.value === "包邮") return Number(shippingFee || 0);
  const threshold = Number((String(coupon.condition || "").match(/满(\d+(?:\.\d+)?)元/) || [])[1] || 0);
  const value = Number((String(coupon.value || "").match(/[\d.]+/) || [])[0] || 0);
  return Number(subtotal) >= threshold ? Math.min(value, Number(subtotal) + Number(shippingFee || 0)) : 0;
}

function pointExpiry(dateValue) {
  const date = new Date(String(dateValue || today()) + "T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + 365);
  return date.toISOString().slice(0, 10);
}

function addPointRecord(data, customerId, points, type, relatedId) {
  data.pointRecords = data.pointRecords || [];
  const date = today();
  const record = { id: nextId("PT", data.pointRecords, 6), customerId, points: Number(points), type, date, relatedId: relatedId || "MEMBER" };
  if (Number(points) > 0) record.expiresAt = pointExpiry(date);
  data.pointRecords.unshift(record);
  return record;
}

function addOrderEvent(order, status, detail, actor) {
  order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
  order.timeline.push({ status, detail: detail || "订单状态已更新", at: new Date().toISOString(), actor: actor || "系统" });
}

function lifetimePointsFor(data, customerId) {
  return Math.max(0, (data.pointRecords || []).filter(item => item.customerId === customerId).reduce((sum, item) => {
    const points = Number(item.points || 0);
    if (points > 0) return sum + points;
    return /撤回|冲正/.test(String(item.type || "")) ? sum + points : sum;
  }, 0));
}

function rewardCost(reward, data) {
  const active = (data.promotions || []).some(item => item.id === "M002" && item.enabled !== false);
  if (!active) return reward.points;
  if (reward.id === "R003") return 900;
  if (reward.id === "R007") return 2200;
  return reward.points;
}

function bundleForItems(data, bundleId, items) {
  const bundle = (data.bundles || []).find(item => item.id === bundleId && item.enabled !== false);
  if (!bundle) return null;
  const quantities = Object.fromEntries(items.map(item => [item.productId, Number(item.quantity)]));
  return bundle.items.every(item => Number(quantities[item.productId] || 0) >= Number(item.quantity || 1)) ? bundle : null;
}

function taskState(customer, data, profile) {
  const paidStatuses = ["待发货", "已发货", "已完成", "退货处理中", "已退款"];
  const readiness = {
    TASK_ADDRESS: Boolean(profile.address),
    TASK_SEARCH: new Set(profile.features.searchHistory || []).size >= 3,
    TASK_ORDER: data.orders.some(order => order.customerId === customer.id && paidStatuses.includes(order.status)),
    TASK_REVIEW: (data.reviews || []).some(review => review.customerId === customer.id)
  };
  const claims = profile.loyalty.taskClaims || {};
  return LOYALTY_TASKS.map(task => Object.assign({}, task, { ready: Boolean(readiness[task.id]), claimed: Boolean(claims[task.id]) }));
}

function awardReferralIfReady(customer, data) {
  const profile = ensureProfile(customer.id);
  if (!profile.features.referredBy || profile.loyalty.referralRewarded) return;
  const referrer = customerOf(data, profile.features.referredBy);
  if (!referrer) return;
  customer.points = Number(customer.points || 0) + 100;
  referrer.points = Number(referrer.points || 0) + 300;
  addPointRecord(data, customer.id, 100, "邀请新人首单奖励", referrer.id);
  addPointRecord(data, referrer.id, 300, "邀请好友奖励", customer.id);
  profile.loyalty.referralRewarded = true;
  saveProfile(profile);
}

function applyOperation(data, auth, type, payload) {
  payload = payload || {};
  let result;
  if (type === "reset") {
    requireRole(auth, ["admin"]);
    throw new Error("线上共享数据不能从浏览器直接重置");
  }
  if (type === "addProduct") {
    requireRole(auth, ["admin"]);
    const price = Number(payload.price), cost = Number(payload.cost), stock = Number(payload.stock), warningStock = Number(payload.warningStock);
    if (!String(payload.name || "").trim() || !String(payload.category || "").trim()) throw new Error("商品名称和分类不能为空");
    if (![price, cost, stock, warningStock].every(Number.isFinite) || price < 0 || cost < 0 || stock < 0 || warningStock < 0) throw new Error("商品数值不正确");
    result = { id: nextId("P", data.products, 3), name: String(payload.name).trim(), spec: String(payload.spec || "标准款").trim(), category: String(payload.category).trim(), price, cost, stock: Math.floor(stock), warningStock: Math.floor(warningStock), status: payload.status === "已停用" ? "已停用" : "正常销售" };
    data.products.push(result);
    data.priceHistory.push({ productId: result.id, price: result.price, date: today(), source: "商品上架" });
  } else if (type === "updateProduct") {
    requireRole(auth, ["admin"]);
    result = productOf(data, payload.productId); if (!result) throw new Error("商品不存在");
    const previousPrice = Number(result.price);
    Object.assign(result, payload.changes || {});
    if (!Number.isFinite(Number(result.price)) || Number(result.price) < 0) throw new Error("商品价格不正确");
    result.price = Number(result.price);
    if (Number(result.price) !== previousPrice) data.priceHistory.push({ productId: result.id, price: result.price, date: today(), source: "后台调价" });
  } else if (type === "toggleProduct") {
    requireRole(auth, ["admin"]);
    result = productOf(data, payload.productId); if (!result) throw new Error("商品不存在");
    result.status = result.status === "正常销售" ? "已停用" : "正常销售";
  } else if (type === "addCustomer") {
    requireRole(auth, ["admin"]);
    const phone = String(payload.phone || "").trim();
    if (!/^1\d{10}$/.test(phone)) throw new Error("请输入 11 位手机号码");
    if (data.customers.some(item => item.phone === phone)) throw new Error("这个手机号码已经存在");
    result = { id: nextId("C", data.customers, 3), name: String(payload.name || "").trim(), phone, region: String(payload.region || "").trim(), type: payload.type === "老客户" ? "老客户" : "新客户", points: 0 };
    data.customers.push(result);
  } else if (type === "updateCustomer") {
    const customerId = payload.customerId;
    requireOwner(auth, customerId);
    result = customerOf(data, customerId); if (!result) throw new Error("客户不存在");
    const changes = payload.changes || {};
    const phone = String(changes.phone || "").trim();
    if (!/^1\d{10}$/.test(phone)) throw new Error("请输入 11 位手机号码");
    if (data.customers.some(item => item.id !== customerId && item.phone === phone)) throw new Error("这个手机号码已经存在");
    Object.assign(result, { name: String(changes.name || "").trim(), phone, region: String(changes.region || "").trim(), type: changes.type === "老客户" ? "老客户" : "新客户" });
  } else if (type === "createOrder") {
    const input = payload;
    requireOwner(auth, input.customerId);
    const customer = customerOf(data, input.customerId); if (!customer) throw new Error("账号信息不存在");
    if (!Array.isArray(input.items) || !input.items.length) throw new Error("订单至少需要一件商品");
    const merged = {};
    input.items.forEach(item => { merged[item.productId] = (merged[item.productId] || 0) + Math.floor(Number(item.quantity)); });
    const items = Object.entries(merged).map(([productId, quantity]) => {
      const product = productOf(data, productId);
      if (!product || product.status !== "正常销售") throw new Error("订单中有商品已下架");
      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > product.stock) throw new Error(product.name + " 库存不足");
      return { productId, quantity, unitPrice: Number(product.price), unitCost: Number(product.cost || 0) };
    });
    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const profile = ensureProfile(input.customerId);
    const quote = fulfillmentQuote(data, Object.assign({}, input.fulfillment || {}, { region: String(input.fulfillment && input.fulfillment.region || profile.address && profile.address.region || "") }), subtotal);
    const shippingFee = quote.fee;
    const appliedCoupon = input.appliedCoupon && input.appliedCoupon.id ? consumeCoupon(input.customerId, String(input.appliedCoupon.id)) : null;
    const couponDiscount = Number(couponSaving(appliedCoupon, subtotal, shippingFee).toFixed(2));
    if (appliedCoupon && couponDiscount <= 0) throw new Error("这张优惠券不满足当前订单使用条件");
    const bundle = bundleForItems(data, String(input.bundleId || ""), items);
    const bundleDiscount = bundle ? Math.min(Number(bundle.discount || 0), subtotal) : 0;
    const discount = Number((couponDiscount + bundleDiscount).toFixed(2));
    result = { id: nextId("O", data.orders, 9), date: today(), customerId: input.customerId, status: "待付款", subtotal: Number(subtotal.toFixed(2)), total: Number(Math.max(0, subtotal + shippingFee - discount).toFixed(2)), discount, couponDiscount, bundleDiscount, bundleId: bundle ? bundle.id : null, shippingFee, fulfillment: quote, paymentMethod: "模拟支付", appliedCoupon, couponRestored: false, rewardPoints: 0, rewardReversed: false, benefitsReversed: false, items, timeline: [] };
    addOrderEvent(result, "订单创建", (bundle ? "已享组合购立减 ¥" + bundleDiscount.toFixed(2) + "；" : "") + quote.label + "，承诺 " + quote.estimatedDeliveryDate + " 前完成履约", "用户");
    if (result.status !== "待付款") {
      items.forEach(item => {
        const product = productOf(data, item.productId); product.stock -= item.quantity;
        data.stockRecords.unshift({ id: nextId("S", data.stockRecords, 6), productId: item.productId, type: "订单出库", quantity: -item.quantity, date: today(), relatedId: result.id });
      });
      const earned = Math.floor(result.total); customer.points = Number(customer.points || 0) + earned;
      result.pointsEarned = earned; result.rewardPoints = earned;
      addPointRecord(data, customer.id, earned, "购物奖励", result.id);
    }
    data.orders.unshift(result);
  } else if (["cancelOrder", "advanceOrder", "requestReturn", "completeRefund"].includes(type)) {
    result = orderOf(data, payload.orderId); if (!result) throw new Error("订单不存在"); requireOwner(auth, result.customerId);
    if (type === "completeRefund" && auth.role !== "admin") throw new Error("只有商家可以确认完成退款");
    if (type === "advanceOrder" && auth.role === "customer" && result.status === "待发货") throw new Error("只有商家可以确认发货");
    const customer = customerOf(data, result.customerId);
    const restoreBenefits = () => {
      if (result.benefitsReversed) return;
      result.items.forEach(item => {
        const p = productOf(data, item.productId);
        if (p) {
          p.stock += item.quantity;
          data.stockRecords.unshift({ id: nextId("S", data.stockRecords, 6), productId: item.productId, type: "取消或退款恢复", quantity: item.quantity, date: today(), relatedId: result.id });
        }
      });
      const granted = Number(result.rewardPoints || result.pointsEarned || 0);
      if (granted && customer) {
        customer.points = Math.max(0, Number(customer.points || 0) - granted);
        addPointRecord(data, customer.id, -granted, "取消或退款撤回购物积分", result.id);
      }
      const redeemed = Number(result.pointsRedemption || 0);
      if (redeemed && customer && !result.pointsReturned) {
        customer.points = Number(customer.points || 0) + redeemed;
        addPointRecord(data, customer.id, redeemed, "积分礼品取消退回", result.id);
        const profile = ensureProfile(customer.id); const counts = profile.loyalty.redemptionCounts || {};
        if (result.rewardId && Number(counts[result.rewardId] || 0) > 0) counts[result.rewardId] -= 1;
        profile.loyalty.redemptionCounts = counts; saveProfile(profile); result.pointsReturned = true;
      }
      result.benefitsReversed = true; result.rewardReversed = true;
    };
    if (type === "cancelOrder") {
      if (!["待付款", "待发货"].includes(result.status)) throw new Error("当前订单不能取消");
      if (result.status === "待发货") restoreBenefits(); result.status = "已取消";
      if (result.appliedCoupon && !result.couponRestored) { restoreCoupon(result.customerId, result.appliedCoupon); result.couponRestored = true; }
      addOrderEvent(result, "已取消", "订单已取消，相关库存、积分和优惠券按规则恢复", auth.role === "admin" ? "商家" : "用户");
    }
    if (type === "advanceOrder") {
      const next = { "待付款": "待发货", "待发货": "已发货", "已发货": "已完成" }[result.status];
      if (!next) throw new Error("当前订单不能继续处理");
      if (result.status === "待付款") {
        result.items.forEach(item => { const p = productOf(data, item.productId); if (!p || p.stock < item.quantity) throw new Error("库存不足"); });
        result.items.forEach(item => {
          const p = productOf(data, item.productId); p.stock -= item.quantity;
          data.stockRecords.unshift({ id: nextId("S", data.stockRecords, 6), productId: item.productId, type: "订单出库", quantity: -item.quantity, date: today(), relatedId: result.id });
        });
        const earned = Math.floor(result.total);
        if (customer) {
          customer.points = Number(customer.points || 0) + earned;
          addPointRecord(data, customer.id, earned, "购物奖励", result.id);
          awardReferralIfReady(customer, data);
        }
        result.pointsEarned = earned; result.rewardPoints = earned;
      }
      result.status = next;
      addOrderEvent(result, next, next === "待发货" ? "模拟支付成功，商家正在备货" : next === "已发货" ? "商家已确认发货" : "用户已确认收货，订单完成", auth.role === "admin" ? "商家" : "用户");
    }
    if (type === "requestReturn") {
      if (result.status !== "已完成") throw new Error("只有已完成订单可以申请售后");
      if (data.returnRequests.some(item => item.orderId === result.id && !["已取消", "已拒绝", "已完成"].includes(item.status))) throw new Error("这个订单已经有进行中的售后申请");
      const completionEvent = (result.timeline || []).slice().reverse().find(item => item.status === "已完成");
      const completedDate = String(completionEvent && completionEvent.at || result.date || today()).slice(0, 10);
      if (today() > dateOffset(7, completedDate)) throw new Error("该订单已超过7天售后申请期");
      const resolution = ["退货退款", "换货"].includes(payload.resolution) ? payload.resolution : "退货退款";
      const reason = String(payload.reason || "不想要了").trim().slice(0, 40);
      const description = String(payload.description || "用户从订单页提交售后申请").trim().slice(0, 300);
      if (description.length < 4) throw new Error("请填写至少4个字的问题说明");
      const request = { id: nextId("RT", data.returnRequests, 6), orderId: result.id, customerId: result.customerId, resolution, reason, description, status: "待审核", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      data.returnRequests.unshift(request); result.returnRequestId = request.id; result.status = "退货处理中";
      addOrderEvent(result, "退货处理中", "已提交" + resolution + "申请（" + request.id + "），等待商家处理", "用户");
    }
    if (type === "completeRefund") {
      if (result.status !== "退货处理中") throw new Error("订单不在退货处理中");
      restoreBenefits(); result.status = "已退款";
      if (result.appliedCoupon && !result.couponRestored) { restoreCoupon(result.customerId, result.appliedCoupon); result.couponRestored = true; }
      const request = data.returnRequests.find(item => item.orderId === result.id && !["已取消", "已拒绝", "已完成"].includes(item.status));
      if (request) { request.status = "已完成"; request.updatedAt = new Date().toISOString(); request.completedAt = request.updatedAt; }
      addOrderEvent(result, "已退款", "商家已确认退款，售后流程结束", "商家");
    }
  } else if (type === "adjustStock") {
    requireRole(auth, ["admin"]); const product = productOf(data, payload.productId); if (!product) throw new Error("商品不存在");
    const quantity = Math.floor(Number(payload.quantity)); if (!quantity || product.stock + quantity < 0) throw new Error("库存调整数量不正确");
    product.stock += quantity; result = product;
    data.stockRecords.unshift({ id: nextId("S", data.stockRecords, 6), productId: product.id, type: payload.type || (quantity > 0 ? "补充库存" : "库存盘点"), quantity, date: today(), relatedId: "MANUAL" });
  } else if (type === "redeemReward") {
    requireOwner(auth, payload.customerId);
    const reward = POINT_REWARDS.find(item => item.id === String(payload.rewardId || ""));
    const customer = customerOf(data, payload.customerId);
    if (!reward || !customer) throw new Error("兑换商品不存在");
    const profile = ensureProfile(customer.id);
    const counts = profile.loyalty.redemptionCounts || {};
    if (Number(counts[reward.id] || 0) >= reward.limit) throw new Error("这项礼遇已达到本账号兑换上限");
    const cost = rewardCost(reward, data);
    if (Number(customer.points || 0) < cost) throw new Error("积分余额不足");
    let product = null;
    if (reward.kind === "product") {
      product = productOf(data, reward.productId);
      if (!product || product.status !== "正常销售" || product.stock < 1) throw new Error("这件积分礼品暂时缺货");
    }
    customer.points -= cost;
    addPointRecord(data, customer.id, -cost, "兑换" + reward.name, String(payload.rewardId));
    let coupon = null; let order = null;
    if (reward.kind === "coupon") {
      coupon = { id: "CP-R-" + crypto.randomUUID(), name: reward.name, value: reward.value, condition: reward.condition, source: "points" };
      profile.coupons.unshift(coupon);
    } else {
      product.stock -= 1;
      order = { id: nextId("O", data.orders, 9), date: today(), customerId: customer.id, status: "待发货", subtotal: product.price, total: 0, discount: product.price, shippingFee: 0, paymentMethod: "积分兑换", appliedCoupon: null, couponRestored: false, rewardPoints: 0, rewardReversed: false, benefitsReversed: false, pointsRedemption: cost, pointsReturned: false, rewardId: reward.id, items: [{ productId: product.id, quantity: 1, unitPrice: product.price, unitCost: Number(product.cost || 0) }], timeline: [] };
      addOrderEvent(order, "待发货", "积分兑换成功，等待商家发出礼品", "系统");
      data.orders.unshift(order);
      data.stockRecords.unshift({ id: nextId("S", data.stockRecords, 6), productId: product.id, type: "积分礼品出库", quantity: -1, date: today(), relatedId: order.id });
    }
    counts[reward.id] = Number(counts[reward.id] || 0) + 1;
    profile.loyalty.redemptionCounts = counts;
    saveProfile(profile);
    result = { customer, reward, coupon, order };
  } else if (type === "dailyCheckIn") {
    requireOwner(auth, payload.customerId);
    const customer = customerOf(data, payload.customerId); if (!customer) throw new Error("会员不存在");
    const profile = ensureProfile(customer.id); const currentDate = today();
    if (profile.loyalty.lastCheckIn === currentDate) throw new Error("今天已经签到过了");
    const previousDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const streak = profile.loyalty.lastCheckIn === previousDate ? Number(profile.loyalty.streak || 0) + 1 : 1;
    const cycleRewards = [10, 10, 15, 15, 20, 20, 30];
    const points = cycleRewards[(streak - 1) % cycleRewards.length];
    customer.points = Number(customer.points || 0) + points;
    profile.loyalty.lastCheckIn = currentDate; profile.loyalty.streak = streak; saveProfile(profile);
    addPointRecord(data, customer.id, points, "每日签到（连续" + streak + "天）", "CHECKIN");
    result = { customer, points, streak, checkedIn: true };
  } else if (type === "recordProductView") {
    requireRole(auth, ["customer"]);
    const product = productOf(data, String(payload.productId || "")); if (!product) throw new Error("商品不存在");
    const profile = ensureProfile(auth.customerId);
    profile.features.history = [product.id].concat((profile.features.history || []).filter(id => id !== product.id)).slice(0, 20);
    saveProfile(profile); result = profile.features;
  } else if (type === "toggleCompare") {
    requireRole(auth, ["customer"]);
    const product = productOf(data, String(payload.productId || "")); if (!product) throw new Error("商品不存在");
    const profile = ensureProfile(auth.customerId); const compare = profile.features.compare || []; const index = compare.indexOf(product.id);
    if (index >= 0) compare.splice(index, 1); else { if (compare.length >= 4) throw new Error("最多同时对比 4 件商品"); compare.push(product.id); }
    profile.features.compare = compare; saveProfile(profile); result = { compare, added: index < 0 };
  } else if (type === "clearCompare") {
    requireRole(auth, ["customer"]);
    const profile = ensureProfile(auth.customerId); profile.features.compare = []; saveProfile(profile); result = { compare: [] };
  } else if (type === "toggleProductAlert") {
    requireRole(auth, ["customer"]);
    const product = productOf(data, String(payload.productId || "")); if (!product) throw new Error("商品不存在");
    const profile = ensureProfile(auth.customerId); const alerts = profile.features.alerts || []; const index = alerts.findIndex(item => item.productId === product.id);
    if (index >= 0) alerts.splice(index, 1); else alerts.unshift({ productId: product.id, watchedPrice: Number(product.price), watchedStock: Number(product.stock), createdAt: new Date().toISOString() });
    profile.features.alerts = alerts.slice(0, 30); saveProfile(profile); result = { alerts: profile.features.alerts, added: index < 0 };
  } else if (type === "recordSearch") {
    requireRole(auth, ["customer"]);
    const keyword = String(payload.keyword || "").trim().slice(0, 40); if (keyword.length < 2) throw new Error("搜索词太短");
    const profile = ensureProfile(auth.customerId);
    profile.features.searchHistory = [keyword].concat((profile.features.searchHistory || []).filter(item => item !== keyword)).slice(0, 10);
    saveProfile(profile); result = profile.features.searchHistory;
  } else if (type === "clearSearchHistory") {
    requireRole(auth, ["customer"]);
    const profile = ensureProfile(auth.customerId); profile.features.searchHistory = []; saveProfile(profile); result = [];
  } else if (type === "saveBirthday") {
    requireRole(auth, ["customer"]);
    const rawBirthday = String(payload.birthday || "").trim().replace(/[月/.]/g, "-").replace(/日/g, "");
    const birthdayParts = rawBirthday.split("-").filter(Boolean);
    const birthday = birthdayParts.length === 2 ? birthdayParts.map(part => String(Number(part)).padStart(2, "0")).join("-") : rawBirthday;
    const birthdayDate = new Date("2000-" + birthday + "T00:00:00Z");
    if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(birthday) || Number.isNaN(birthdayDate.getTime()) || birthdayDate.toISOString().slice(5, 10) !== birthday) throw new Error("请输入正确的生日，例如 02-25、2.25 或 2月25日");
    const profile = ensureProfile(auth.customerId);
    if (profile.loyalty.birthday && profile.loyalty.birthday !== birthday) throw new Error("生日信息每个账号只能设置一次，请联系客服修改");
    profile.loyalty.birthday = birthday; saveProfile(profile); result = { birthday };
  } else if (type === "claimBirthdayGift") {
    requireRole(auth, ["customer"]);
    const customer = customerOf(data, auth.customerId); const profile = ensureProfile(auth.customerId); const year = today().slice(0, 4);
    if (!profile.loyalty.birthday) throw new Error("请先设置生日月日");
    if (profile.loyalty.birthday !== today().slice(5)) throw new Error("生日礼仅在生日当天领取");
    if (profile.loyalty.birthdayClaimYear === year) throw new Error("今年的生日礼已经领取");
    customer.points = Number(customer.points || 0) + 200;
    const coupon = { id: "CP-BIRTH-" + crypto.randomUUID(), name: "生日专属券", value: "¥30", condition: "满199元可用", expires: "领取后30天", source: "birthday" };
    profile.coupons.unshift(coupon); profile.loyalty.birthdayClaimYear = year; saveProfile(profile);
    addPointRecord(data, customer.id, 200, "生日会员礼", "BIRTHDAY-" + year); result = { points: 200, coupon };
  } else if (type === "claimTask") {
    requireRole(auth, ["customer"]);
    const customer = customerOf(data, auth.customerId); const profile = ensureProfile(auth.customerId); const task = taskState(customer, data, profile).find(item => item.id === String(payload.taskId || ""));
    if (!task) throw new Error("任务不存在");
    if (!task.ready) throw new Error("任务尚未完成");
    if (task.claimed) throw new Error("任务奖励已经领取");
    customer.points = Number(customer.points || 0) + task.points; profile.loyalty.taskClaims = profile.loyalty.taskClaims || {}; profile.loyalty.taskClaims[task.id] = new Date().toISOString(); saveProfile(profile);
    addPointRecord(data, customer.id, task.points, "成长任务：" + task.name, task.id); result = { task, customer };
  } else if (type === "repairCheckIn") {
    requireRole(auth, ["customer"]);
    const customer = customerOf(data, auth.customerId); const profile = ensureProfile(auth.customerId); const currentMonth = today().slice(0, 7);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10); const dayBefore = new Date(Date.now() - 172800000).toISOString().slice(0, 10);
    if (profile.loyalty.repairMonth === currentMonth) throw new Error("本月已经使用过补签机会");
    if (profile.loyalty.lastCheckIn !== dayBefore) throw new Error("仅可补签昨天中断的连续签到");
    if (Number(customer.points || 0) < 50) throw new Error("补签需要 50 积分");
    customer.points -= 50; profile.loyalty.lastCheckIn = yesterday; profile.loyalty.streak = Number(profile.loyalty.streak || 0) + 1; profile.loyalty.repairMonth = currentMonth; saveProfile(profile);
    addPointRecord(data, customer.id, -50, "签到补签卡", "REPAIR-" + yesterday); result = { repairedDate: yesterday, cost: 50 };
  } else if (type === "submitReview") {
    requireRole(auth, ["customer"]);
    const product = productOf(data, String(payload.productId || "")); const customer = customerOf(data, auth.customerId);
    if (!product || !customer) throw new Error("商品或会员不存在");
    const eligibleOrder = data.orders.find(order => order.customerId === customer.id && order.status === "已完成" && order.items.some(item => item.productId === product.id));
    if (!eligibleOrder) throw new Error("完成购买后才能评价这件商品");
    if (data.reviews.some(item => item.customerId === customer.id && item.productId === product.id)) throw new Error("你已经评价过这件商品");
    const rating = Math.floor(Number(payload.rating)); const content = String(payload.content || "").trim();
    if (rating < 1 || rating > 5) throw new Error("请选择 1—5 星评分");
    if (content.length < 8 || content.length > 300) throw new Error("评价内容需填写 8—300 个字符");
    result = { id: nextId("RV", data.reviews, 6), productId: product.id, customerId: customer.id, customerName: customer.name.slice(0, 1) + "**", rating, content, date: today() };
    data.reviews.unshift(result);
  } else if (type === "submitQuestion") {
    requireRole(auth, ["customer"]);
    const product = productOf(data, String(payload.productId || "")); const customer = customerOf(data, auth.customerId); const content = String(payload.content || "").trim();
    if (!product || !customer) throw new Error("商品或会员不存在");
    if (content.length < 4 || content.length > 200) throw new Error("问题需填写 4—200 个字符");
    if (/1\d{10}|密码|验证码|银行卡/.test(content)) throw new Error("问题中不能包含手机号或敏感账号信息");
    result = { id: nextId("QA", data.questions, 6), productId: product.id, customerId: customer.id, customerName: customer.name.slice(0, 1) + "**", content, answer: "", date: today(), answeredAt: "" };
    data.questions.unshift(result);
  } else if (type === "answerQuestion") {
    requireRole(auth, ["admin"]);
    result = data.questions.find(item => item.id === String(payload.questionId || "")); if (!result) throw new Error("问题不存在");
    const answer = String(payload.answer || "").trim(); if (answer.length < 4 || answer.length > 300) throw new Error("回复需填写 4—300 个字符");
    result.answer = answer; result.answeredAt = today();
  } else if (type === "quoteFulfillment") {
    requireRole(auth, ["customer"]);
    const items = Array.isArray(payload.items) ? payload.items : [];
    const subtotal = items.length ? items.reduce((sum, item) => {
      const product = productOf(data, String(item.productId || ""));
      const quantity = Math.max(1, Math.floor(Number(item.quantity || 1)));
      if (!product || product.status !== "正常销售") throw new Error("试算商品不存在或已下架");
      return sum + Number(product.price) * quantity;
    }, 0) : Math.max(0, Number(payload.subtotal || 0));
    result = Object.assign({ subtotal: Number(subtotal.toFixed(2)) }, fulfillmentQuote(data, payload, subtotal));
  } else if (type === "createReservation") {
    requireRole(auth, ["customer"]);
    const product = productOf(data, String(payload.productId || ""));
    if (!product || product.status !== "正常销售") throw new Error("预约商品不存在或已下架");
    const offer = preorderOffer(product.id);
    const mode = offer ? "preorder" : product.stock <= 0 ? "arrival" : "arrival";
    const quantity = Math.floor(Number(payload.quantity || 1));
    const limit = offer ? Number(offer.limit || 1) : 1;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > limit) throw new Error("预约数量需为1—" + limit + "件");
    if (data.reservations.some(item => item.customerId === auth.customerId && item.productId === product.id && item.status === "active")) throw new Error("这件商品已经预约过了");
    result = { id: nextId("RS", data.reservations, 6), customerId: auth.customerId, productId: product.id, mode, quantity, status: "active", availableDate: offer ? dateOffset(offer.availableDateOffset) : null, createdAt: new Date().toISOString() };
    data.reservations.unshift(result);
  } else if (type === "cancelReservation") {
    requireRole(auth, ["customer"]);
    result = data.reservations.find(item => item.id === String(payload.reservationId || "") && item.customerId === auth.customerId);
    if (!result || result.status !== "active") throw new Error("有效预约不存在");
    result.status = "cancelled"; result.cancelledAt = new Date().toISOString();
  } else if (type === "cancelReturnRequest") {
    requireRole(auth, ["customer"]);
    result = data.returnRequests.find(item => item.id === String(payload.returnId || "") && item.customerId === auth.customerId);
    if (!result || result.status !== "待审核") throw new Error("当前售后申请不能取消");
    const order = orderOf(data, result.orderId); if (!order || order.status !== "退货处理中") throw new Error("关联订单状态不正确");
    result.status = "已取消"; result.updatedAt = new Date().toISOString(); order.status = "已完成";
    addOrderEvent(order, "售后已取消", "用户取消了售后申请，订单恢复为已完成", "用户");
  } else if (type === "createSubscription") {
    requireRole(auth, ["customer"]);
    const product = productOf(data, String(payload.productId || ""));
    if (!product || product.status !== "正常销售" || product.stock <= 0) throw new Error("商品当前不能创建周期购");
    if (!subscriptionEligible(product)) throw new Error("周期购适用于食品、美妆、香氛和厨房消耗品");
    const intervalDays = Math.floor(Number(payload.intervalDays));
    const quantity = Math.floor(Number(payload.quantity));
    if (![14, 30, 60, 90].includes(intervalDays)) throw new Error("请选择有效的配送周期");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new Error("每期数量需为 1—10 件");
    if (data.subscriptions.some(item => item.customerId === auth.customerId && item.productId === product.id && item.status !== "cancelled")) throw new Error("这件商品已经有周期购计划");
    result = { id: nextId("SUB", data.subscriptions, 6), customerId: auth.customerId, productId: product.id, intervalDays, quantity, status: "active", nextDelivery: dateOffset(intervalDays), createdAt: new Date().toISOString() };
    data.subscriptions.unshift(result);
  } else if (["toggleSubscription", "skipSubscription", "cancelSubscription"].includes(type)) {
    requireRole(auth, ["customer"]);
    result = data.subscriptions.find(item => item.id === String(payload.subscriptionId || ""));
    if (!result || result.customerId !== auth.customerId) throw new Error("周期购计划不存在");
    if (result.status === "cancelled") throw new Error("已取消的计划不能继续操作");
    if (type === "toggleSubscription") result.status = result.status === "active" ? "paused" : "active";
    if (type === "skipSubscription") {
      if (result.status !== "active") throw new Error("暂停中的计划不能跳过本期");
      result.nextDelivery = dateOffset(result.intervalDays, result.nextDelivery);
    }
    if (type === "cancelSubscription") result.status = "cancelled";
  } else if (type === "togglePromotion") {
    requireRole(auth, ["admin"]);
    result = data.promotions.find(item => item.id === String(payload.promotionId || "")); if (!result) throw new Error("活动不存在");
    result.enabled = !result.enabled;
  } else if (type === "toggleBundle") {
    requireRole(auth, ["admin"]);
    result = data.bundles.find(item => item.id === String(payload.bundleId || "")); if (!result) throw new Error("组合不存在");
    result.enabled = !result.enabled;
  } else if (type === "changePoints") {
    requireRole(auth, ["admin"]); const customer = customerOf(data, payload.customerId); if (!customer) throw new Error("客户不存在");
    const points = Math.trunc(Number(payload.points)); if (!points || customer.points + points < 0) throw new Error("积分余额不足");
    customer.points += points; result = customer;
    addPointRecord(data, customer.id, points, payload.type || "积分调整", payload.relatedId || "MEMBER");
  } else throw new Error("不支持的业务操作");
  return result;
}

function passwordRules(password) {
  return password.length >= 10 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

function featuresView(profile, data) {
  const validIds = new Set((data.products || []).map(item => item.id));
  const alerts = (profile.features.alerts || []).filter(item => validIds.has(item.productId)).map(item => {
    const product = productOf(data, item.productId);
    return Object.assign({}, item, {
      name: product.name,
      currentPrice: Number(product.price),
      currentStock: Number(product.stock),
      priceDropped: Number(product.price) < Number(item.watchedPrice),
      restocked: Number(item.watchedStock) === 0 && Number(product.stock) > 0
    });
  });
  return {
    history: (profile.features.history || []).filter(id => validIds.has(id)).slice(0, 20),
    compare: (profile.features.compare || []).filter(id => validIds.has(id)).slice(0, 4),
    alerts,
    searchHistory: (profile.features.searchHistory || []).slice(0, 10),
    inviteCode: profile.features.inviteCode,
    referredBy: profile.features.referredBy || null
  };
}

function loyaltyView(customer, data, profile) {
  const records = (data.pointRecords || []).filter(item => item.customerId === customer.id);
  const lifetimePoints = lifetimePointsFor(data, customer.id);
  const tiers = [
    { name: "悦享会员", threshold: 0 },
    { name: "银卡会员", threshold: 2000 },
    { name: "金卡会员", threshold: 5000 },
    { name: "黑金会员", threshold: 10000 }
  ];
  let tierIndex = 0;
  tiers.forEach((tier, index) => { if (lifetimePoints >= tier.threshold) tierIndex = index; });
  const currentTier = tiers[tierIndex]; const nextTier = tiers[tierIndex + 1] || null;
  const counts = profile.loyalty.redemptionCounts || {};
  const rewards = POINT_REWARDS.map(reward => {
    const redeemed = Number(counts[reward.id] || 0);
    const product = reward.productId ? productOf(data, reward.productId) : null;
    const effectivePoints = rewardCost(reward, data);
    return Object.assign({}, reward, { originalPoints: reward.points, points: effectivePoints, flashSale: effectivePoints < reward.points, redeemed, remaining: Math.max(0, reward.limit - redeemed), stock: product ? product.stock : null, available: redeemed < reward.limit && (!product || (product.status === "正常销售" && product.stock > 0)) });
  });
  const limitDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const expiringSoon = records.filter(item => Number(item.points) > 0 && item.expiresAt && item.expiresAt >= today() && item.expiresAt <= limitDate).reduce((sum, item) => sum + Number(item.points), 0);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10); const dayBefore = new Date(Date.now() - 172800000).toISOString().slice(0, 10);
  return {
    balance: Number(customer.points || 0), lifetimePoints, tier: currentTier.name,
    nextTier: nextTier ? { name: nextTier.name, threshold: nextTier.threshold, remaining: Math.max(0, nextTier.threshold - lifetimePoints) } : null,
    checkedInToday: profile.loyalty.lastCheckIn === today(), streak: Number(profile.loyalty.streak || 0),
    checkInRewards: [10, 10, 15, 15, 20, 20, 30],
    repair: { eligible: profile.loyalty.lastCheckIn === dayBefore && profile.loyalty.repairMonth !== today().slice(0, 7), missedDate: yesterday, cost: 50 },
    birthday: profile.loyalty.birthday || "", birthdayGiftAvailable: profile.loyalty.birthday === today().slice(5) && profile.loyalty.birthdayClaimYear !== today().slice(0, 4),
    tasks: taskState(customer, data, profile),
    inviteCode: profile.features.inviteCode,
    referralRewarded: Boolean(profile.loyalty.referralRewarded),
    expiringSoon,
    pointsRule: "积分自获得之日起 365 天有效",
    rewards, records: records.slice(0, 20)
  };
}

function safeAccountContext(auth, data) {
  if (!auth || auth.role !== "customer") return { loggedIn: false };
  const customer = customerOf(data, auth.customerId);
  const orders = data.orders.filter(item => item.customerId === auth.customerId);
  const profile = ensureProfile(auth.customerId);
  return {
    loggedIn: true,
    name: customer ? customer.name : "会员",
    points: customer ? customer.points : 0,
    orderCount: orders.length,
    orderStatuses: orders.reduce((map, order) => { map[order.status] = (map[order.status] || 0) + 1; return map; }, {}),
    recentOrders: orders.slice(0, 5).map(order => ({ id: order.id, status: order.status, amount: order.total, date: order.date })),
    couponCount: profile.coupons.length,
    hasAddress: Boolean(profile.address),
    loyalty: customer ? loyaltyView(customer, data, profile) : null,
    features: featuresView(profile, data),
    categories: Array.from(new Set(data.products.filter(item => item.status === "正常销售").map(item => item.category))),
    productCount: data.products.filter(item => item.status === "正常销售").length
  };
}

function localSupportAnswer(question, context, data, history) {
  const q = String(question || "").trim();
  const normalized = q.toLowerCase().replace(/[？?！!。,.，\s]+/g, "");
  if (!q) return "请告诉我你想查询的内容。";
  if (/你是谁|你叫什么|什么客服|真人吗/.test(q)) return "我是悦选商城在线客服，可以结合你当前账号中的订单状态、积分、优惠券和在售商品回答问题。我不会询问密码、验证码或银行卡信息。";
  if (/你多大|几岁|年龄/.test(q)) return "我是悦选商城的数字客服，没有真实年龄。我会依据商城中的实时商品、订单和会员数据协助你。";
  if (/机器人|人工智能|ai/i.test(q)) return "我是商城内的智能客服助手。当前会优先读取真实商城数据作答；电脑安装了 Ollama 模型时会自动启用本地大模型，否则使用内置的账户感知服务。";
  if (/你好吗|最近怎么样|开心吗|心情/.test(q)) return "谢谢关心，我一直在线。你可以随便聊两句，也可以把购物目标、预算或订单问题告诉我，我会接着聊。";
  if (/为什么叫悦选|悦选.*名字/.test(q)) return "“悦选”想表达的是轻松挑选、买到真正合适的东西。它是当前演示商城的品牌名称。";
  if (/我是谁|我的名字|我叫什么/.test(q)) return context.loggedIn ? `你当前登录的是 ${context.name} 的会员账号。为保护隐私，我不会在对话里展示完整手机号。` : "你目前还没有登录。登录后我可以识别当前会员并查询该账号的订单与权益。";
  if (/^(你好|您好|嗨|哈喽|哈啰|哈罗|在吗|早上好|下午好|晚上好|hi|hello|hey)$/i.test(normalized)) return context.loggedIn ? `你好，${context.name}。我在呢。可以帮你查订单、积分和优惠券，也能按用途与预算推荐商品。` : "你好，欢迎来到悦选。我在呢。你可以问商品、配送、优惠和售后；涉及个人订单时需要先登录。";
  if (/谢谢|感谢/.test(q)) return "不客气。如果还有订单、商品或售后问题，可以继续告诉我。";
  if (/再见|结束|拜拜/.test(q)) return "好的，本次咨询先到这里。祝你购物愉快。";
  if (/能做什么|会什么|怎么用/.test(q)) return "我能查当前账号的订单状态、积分和优惠券，说明配送与售后规则，也能按品类、用途和预算推荐在售商品。";
  if (/浏览足迹|看过什么/.test(q)) return context.loggedIn ? `你的账号保留了最近 ${context.features.history.length} 件浏览足迹，可在“我的—浏览足迹”继续查看。` : "登录后，商品详情浏览记录会保存到“我的—浏览足迹”。";
  if (/对比/.test(q)) return context.loggedIn ? `你当前加入了 ${context.features.compare.length} 件对比商品，最多可同时对比4件。` : "登录后可在商品卡片点击“＋对比”，最多同时比较4件商品。";
  if (/降价|补货|到货提醒/.test(q)) return context.loggedIn ? `你当前关注了 ${context.features.alerts.length} 件商品。价格下降或缺货商品补货后，会显示在消息中心。` : "登录后可在商品详情设置降价或补货提醒。";
  if (/邀请码|邀请好友|邀请有礼/.test(q)) return context.loggedIn ? `你的专属邀请码是 ${context.features.inviteCode}。好友注册时填写并完成首笔模拟支付后，好友得100积分，你得300积分。` : "登录后进入“我的—邀请有礼”可查看专属邀请码。";
  if (/商城叫什么|什么商城|介绍.*商城|悦选.*什么/.test(q)) return `这里是悦选综合电商平台，目前有 ${context.productCount || data.products.length} 件在售商品，覆盖 ${(context.categories || []).join("、") || "数码、家居、食品和生活方式"}等品类。`;
  if (/密码|验证码|银行卡/.test(q)) return "为了账户安全，请不要在客服对话中发送密码、短信验证码、银行卡号或支付密码。账户设置可在“我的—账户设置”完成。";
  const orderId = (q.match(/O\d{6,}/i) || [])[0];
  if (orderId) {
    if (!context.loggedIn) return "请先登录，我才能核对这个订单是否属于你的账号。";
    const order = context.recentOrders.find(item => item.id.toLowerCase() === orderId.toLowerCase());
    return order ? `订单 ${order.id} 当前状态为“${order.status}”，订单金额 ¥${Number(order.amount).toFixed(2)}，下单日期 ${order.date}。` : "当前账号最近的订单中没有找到这个订单号，请检查是否输入完整。";
  }
  if (/订单|发货|物流|到哪|收货/.test(q)) {
    if (!context.loggedIn) return "登录后我才能查询你的订单进度。你可以先在右上角登录，再告诉我想查哪一笔订单。";
    if (!context.recentOrders.length) return "你的账号目前还没有订单。可以先去“逛好物”挑选商品。";
    const order = context.recentOrders[0];
    return `你最近的订单 ${order.id} 当前为“${order.status}”，金额 ¥${Number(order.amount).toFixed(2)}。如需查询其他订单，请把订单号发给我。`;
  }
  if (/积分/.test(q)) return context.loggedIn ? `你当前有 ${context.points} 积分。购物完成后会按实付金额累计，取消或退款时对应积分会自动退回。` : "登录后可在“我的”页面查看积分余额和兑换记录。";
  if (/签到/.test(q)) return context.loggedIn ? (context.loyalty && context.loyalty.checkedInToday ? `你今天已经签到，当前连续签到 ${context.loyalty.streak} 天。` : "今天还可以签到。进入“我的—积分商城”，点击每日签到即可领取积分，连续第7天奖励更高。") : "登录后进入积分商城即可每日签到领积分。";
  if (/会员等级|银卡|金卡|黑金|升级/.test(q)) return context.loggedIn && context.loyalty ? (context.loyalty.nextTier ? `你现在是${context.loyalty.tier}，累计获得 ${context.loyalty.lifetimePoints} 积分，再累计 ${context.loyalty.nextTier.remaining} 积分可升级为${context.loyalty.nextTier.name}。` : `你现在是${context.loyalty.tier}，已经达到当前最高等级。`) : "登录后可在会员中心查看等级和升级进度。";
  if (/退|售后|退款/.test(q)) {
    const pending = context.loggedIn ? Number(context.orderStatuses["退货处理中"] || 0) : 0;
    return pending ? `你目前有 ${pending} 笔售后正在处理。商家完成退款后，订单使用的优惠券会退回卡包，购物奖励积分会撤回。` : "已完成订单可在“我的订单—售后”申请退货。已退款记录会保留在历史中，但只有正在处理的售后才显示红点。";
  }
  if (/地址|收货人/.test(q)) return context.loggedIn ? (context.hasAddress ? "你的账号已保存收货地址，可在“我的—收货地址”修改。系统会校验手机号、中文地区以及街道门牌信息。" : "你还没有保存收货地址，请进入“我的—收货地址”添加后再结算。") : "收货地址不在注册时填写。登录后进入“我的—收货地址”添加或修改。";
  if (/优惠|券/.test(q)) return context.loggedIn ? `你当前卡包有 ${context.couponCount} 张可用优惠券。新人券与会员包邮券注册后自动到账，其他活动券每个账号限领一次，使用后不能再次领取；取消订单或完成退款会退回本单用券。` : "登录后可在“消息—优惠活动”领取优惠券。每项活动按账号记录领取状态，不能无限重复领取。";
  if (/支付|付款|扣款/.test(q)) return "当前项目使用模拟支付，不会唤起微信、支付宝或银行卡，也不会产生真实扣款；支付成功后的订单、库存、积分和售后流程会照常演示。";
  if (/运费|包邮|配送费/.test(q)) return "普通商品订单满99元包邮，未满99元收取8元配送费；积分兑换的实物礼品免配送费。";
  if (/多久到|几天到|配送时间/.test(q)) return "演示商城按普通快递流程展示：付款后由商家确认发货，通常预计1—3天送达。这里不会生成真实快递单号。";
  if (/发票|开票/.test(q)) return "当前版本还没有电子发票模块。若要用于正式上线，建议增加发票抬头管理、订单开票申请和商家审核下载。";
  if (/保修|质保/.test(q)) return "商品保修期应以商品详情与品牌售后政策为准。当前演示商品暂未接入品牌保修查询，请不要把页面信息当作正式保修承诺。";
  if (/人工|转人工|真人客服/.test(q)) return "当前演示环境没有真人坐席。你可以继续描述问题；涉及退款确认等需要商家操作的事项，我会提示你到相应订单入口处理。";
  if (/多少商品|几件商品|哪些分类|商品种类|有什么分类/.test(q)) return `目前有 ${data.products.filter(item => item.status === "正常销售").length} 件在售商品，分类包括 ${Array.from(new Set(data.products.filter(item => item.status === "正常销售").map(item => item.category))).join("、")}。`;
  const directMatches = data.products.filter(item => item.status === "正常销售" && (normalized.includes(String(item.name).toLowerCase().replace(/\s+/g, "")) || String(item.name).toLowerCase().split(/[\s·+\-]+/).some(token => token.length >= 3 && normalized.includes(token)))).slice(0, 3);
  if (directMatches.length && /多少钱|价格|库存|有货|现货|规格|怎么样|介绍|买/.test(q)) return directMatches.map(item => `${item.name}：${item.spec}，售价 ¥${Number(item.price).toFixed(2)}，${item.stock > 0 ? `现有库存 ${item.stock} 件` : "目前缺货"}`).join("；") + "。";
  if (/最便宜|价格最低|便宜点/.test(q)) {
    const matches = data.products.filter(item => item.status === "正常销售" && item.stock > 0).sort((a, b) => a.price - b.price).slice(0, 3);
    return `当前价格较低的在售商品有：${matches.map(item => `${item.name}（¥${Number(item.price).toFixed(2)}）`).join("、")}。`;
  }
  if (/推荐|买什么|商品/.test(q)) {
    const budget = Number((q.match(/(?:预算|以内|不超过|大约|左右)?\s*(\d{2,6})\s*元?/) || [])[1] || 0);
    const categoryHints = ["数码", "家居", "日用", "电器", "影音", "箱包", "服饰", "美妆", "运动"];
    const hint = categoryHints.find(item => q.includes(item));
    const matches = data.products.filter(item => item.status === "正常销售" && item.stock > 0 && (!budget || item.price <= budget) && (!hint || item.category.includes(hint))).sort((a, b) => b.price - a.price).slice(0, 3);
    if (!matches.length) return "暂时没有找到完全符合这些条件的在售商品。可以放宽预算，或告诉我更具体的用途。";
    return `可以看看 ${matches.map(item => `${item.name}（¥${Number(item.price).toFixed(2)}）`).join("、")}。需要我再按价格或品类缩小范围吗？`;
  }
  const previousUser = (history || []).filter(item => item.role === "user").slice(-1)[0];
  if (/^(是|好|可以|继续)[吧吗！!。.]?$/.test(q) && previousUser && /推荐|预算|商品/.test(previousUser.content || "")) return "可以继续告诉我用途、品类和最高预算，例如“想买运动耳机，预算500元以内”。";
  return "我理解你是在继续咨询，但还缺少一点关键信息。可以直接告诉我对象或目标，例如商品名称、订单号、预算、品类，或者你想办理退款、改地址还是查积分；我会接着当前对话回答。";
}

async function intelligentSupport(question, context, data, history) {
  const fallback = localSupportAnswer(question, context, data, history);
  const messages = [
    { role: "system", content: "你是悦选综合电商平台的在线客服。用自然、简洁的中文回答并记住上下文。可以闲聊，但遇到账户、商品、订单、优惠券、积分和售后问题时只能依据提供的数据回答；不得编造物流、退款、库存或优惠结果，不索要密码、验证码和银行卡信息。当前支付为模拟支付。" },
    { role: "system", content: "脱敏商城与账户摘要：" + JSON.stringify(context) },
    ...(history || []).slice(-8),
    { role: "user", content: String(question).slice(0, 500) }
  ];
  const cloudflareAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
  const cloudflareToken = process.env.CLOUDFLARE_AI_TOKEN;
  if (cloudflareAccount && cloudflareToken) {
    try {
      const cloudflareModel = process.env.CLOUDFLARE_AI_MODEL || "@cf/zai-org/glm-4.7-flash";
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cloudflareAccount)}/ai/run/${cloudflareModel}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + cloudflareToken }, signal: controller.signal, body: JSON.stringify({ messages }) });
      clearTimeout(timer);
      if (response.ok) {
        const body = await response.json(); const answer = body && body.result && (body.result.response || body.result.answer);
        if (answer) return { answer: String(answer).trim(), mode: "cloud-ai" };
      }
    } catch {}
  }
  if (process.env.YUEXUAN_DISABLE_OLLAMA !== "1") {
    try {
      const ollamaBase = String(process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/api\/chat\/?$/, "").replace(/\/$/, "");
      const tagController = new AbortController(); const tagTimer = setTimeout(() => tagController.abort(), 1500);
      const tagsResponse = await fetch(ollamaBase + "/api/tags", { signal: tagController.signal }); clearTimeout(tagTimer);
      if (tagsResponse.ok) {
        const tags = await tagsResponse.json(); const installed = Array.isArray(tags.models) ? tags.models : [];
        const configured = process.env.OLLAMA_MODEL; const model = configured || (installed[0] && (installed[0].name || installed[0].model));
        if (model) {
          const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 20000);
          const response = await fetch(ollamaBase + "/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ model, stream: false, messages }) });
          clearTimeout(timer);
          if (response.ok) {
            const body = await response.json();
            if (body.message && body.message.content) return { answer: body.message.content.trim(), mode: "local-ai" };
          }
        }
      }
    } catch {}
  }
  return { answer: fallback, mode: "account-aware" };
}

function mimeType(file) {
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".webp": "image/webp", ".webmanifest": "application/manifest+json; charset=utf-8", ".json": "application/json; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" })[path.extname(file).toLowerCase()] || "application/octet-stream";
}

async function handleApi(req, res, url) {
  const auth = session(req);
  if (url.pathname === "/api/health") return json(res, 200, { ok: true, database: "sqlite", version: 2 });
  if (url.pathname === "/api/auth/session" && req.method === "GET") return json(res, 200, { authenticated: Boolean(auth), user: auth ? { role: auth.role, account: auth.account, customerId: auth.customerId } : null });
  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    const body = await readBody(req); const accountName = String(body.account || "").trim(); const password = String(body.password || "");
    const attemptKey = crypto.createHash("sha256").update((req.socket.remoteAddress || "") + "|" + accountName).digest("hex");
    const attempt = db.prepare("SELECT failures, blocked_until AS blockedUntil FROM login_attempts WHERE key=?").get(attemptKey);
    if (attempt && Number(attempt.blockedUntil) > Date.now()) return json(res, 429, { error: "尝试次数过多，请稍后再试" });
    const account = db.prepare("SELECT id, account, role, customer_id AS customerId, password_salt AS passwordSalt, password_hash AS passwordHash FROM accounts WHERE account=?").get(accountName);
    const valid = account && crypto.timingSafeEqual(Buffer.from(passwordDigest(password, account.passwordSalt), "hex"), Buffer.from(account.passwordHash, "hex"));
    if (!valid) {
      const failures = Number(attempt && attempt.failures || 0) + 1; const blockedUntil = failures >= 6 ? Date.now() + 5 * 60 * 1000 : 0;
      db.prepare("INSERT INTO login_attempts(key,failures,blocked_until) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET failures=excluded.failures,blocked_until=excluded.blocked_until").run(attemptKey, failures, blockedUntil);
      return json(res, 401, { error: "账号或密码不正确" });
    }
    db.prepare("DELETE FROM login_attempts WHERE key=?").run(attemptKey);
    return json(res, 200, { user: { role: account.role, account: account.account, customerId: account.customerId } }, { "Set-Cookie": setSession(res, account) });
  }
  if (url.pathname === "/api/auth/register" && req.method === "POST") {
    const body = await readBody(req); const phone = String(body.phone || "").trim(); const password = String(body.password || ""); const name = String(body.name || "").trim(); const region = String(body.region || "").trim(); const inviteCode = String(body.inviteCode || "").trim().toUpperCase();
    if (!/^1\d{10}$/.test(phone)) return json(res, 400, { error: "请输入正确的 11 位手机号码" });
    if (!passwordRules(password)) return json(res, 400, { error: "密码至少 10 位，并包含大写字母、小写字母、数字和特殊字符" });
    if (!name || !region) return json(res, 400, { error: "请填写姓名和所在城市" });
    if (db.prepare("SELECT id FROM accounts WHERE account=?").get(phone)) return json(res, 409, { error: "这个手机号码已经注册" });
    const state = readState(); if (!state) return json(res, 503, { error: "商城数据正在初始化，请刷新后重试" });
    if (state.data.customers.some(item => item.phone === phone)) return json(res, 409, { error: "这个手机号码已经存在" });
    let referrer = null;
    if (inviteCode) {
      referrer = state.data.customers.find(item => ensureProfile(item.id).features.inviteCode === inviteCode) || null;
      if (!referrer) return json(res, 400, { error: "邀请码不存在，请检查后重试" });
    }
    const customer = { id: nextId("C", state.data.customers, 3), name, phone, region, type: "新客户", points: 0 };
    db.exec("BEGIN IMMEDIATE");
    try {
      state.data.customers.push(customer); writeState(state.data); createAccount(phone, password, "customer", customer.id); const profile = ensureProfile(customer.id); if (referrer) { profile.features.referredBy = referrer.id; saveProfile(profile); } db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    const account = db.prepare("SELECT id, account, role, customer_id AS customerId FROM accounts WHERE account=?").get(phone);
    return json(res, 201, { user: { role: "customer", account: phone, customerId: customer.id }, customer }, { "Set-Cookie": setSession(res, account) });
  }
  if (url.pathname === "/api/auth/logout" && req.method === "POST") {
    const token = cookies(req).yx_session; if (token) db.prepare("DELETE FROM sessions WHERE token_hash=?").run(crypto.createHash("sha256").update(token).digest("hex"));
    return json(res, 200, { ok: true }, { "Set-Cookie": "yx_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" });
  }
  if (url.pathname === "/api/auth/password" && req.method === "PATCH") {
    requireRole(auth, ["customer"]); const body = await readBody(req); const password = String(body.password || "");
    if (!passwordRules(password)) return json(res, 400, { error: "新密码至少 10 位，并包含大写字母、小写字母、数字和特殊字符" });
    const salt = crypto.randomBytes(16).toString("hex"); db.prepare("UPDATE accounts SET password_salt=?,password_hash=? WHERE id=?").run(salt, passwordDigest(password, salt), auth.id);
    return json(res, 200, { ok: true });
  }
  if (url.pathname === "/api/auth/account" && req.method === "PATCH") {
    requireRole(auth, ["customer"]); const body = await readBody(req); const phone = String(body.phone || "").trim();
    if (!/^1\d{10}$/.test(phone)) return json(res, 400, { error: "请输入正确的 11 位手机号码" });
    const duplicate = db.prepare("SELECT id FROM accounts WHERE account=? AND id<>?").get(phone, auth.id);
    if (duplicate) return json(res, 409, { error: "这个手机号码已经注册" });
    db.prepare("UPDATE accounts SET account=? WHERE id=?").run(phone, auth.id);
    return json(res, 200, { ok: true, account: phone });
  }
  if (url.pathname === "/api/profile" && req.method === "GET") {
    if (!auth || auth.role !== "customer") return json(res, 401, { error: "请先登录" });
    const state = readState(); const profile = ensureProfile(auth.customerId); const customer = state && customerOf(state.data, auth.customerId);
    return json(res, 200, { address: profile.address, coupons: profile.coupons, campaigns: couponCampaignState(profile), features: state ? featuresView(profile, state.data) : featuresView(profile, { products: [] }), loyalty: customer ? loyaltyView(customer, state.data, profile) : null });
  }
  if (url.pathname === "/api/profile/address" && req.method === "PUT") {
    if (!auth || auth.role !== "customer") return json(res, 401, { error: "请先登录" });
    const body = await readBody(req);
    try {
      const profile = ensureProfile(auth.customerId); profile.address = validateAddress(body); saveProfile(profile);
      return json(res, 200, { address: profile.address });
    } catch (error) { return json(res, 400, { error: error.message || "地址信息不正确" }); }
  }
  if (url.pathname === "/api/coupons" && req.method === "GET") {
    if (!auth || auth.role !== "customer") return json(res, 200, { coupons: [], claims: {}, campaigns: COUPON_CAMPAIGNS.map(item => Object.assign({}, item, { status: "login" })) });
    const profile = ensureProfile(auth.customerId);
    return json(res, 200, { coupons: profile.coupons, claims: profile.claims, campaigns: couponCampaignState(profile) });
  }
  if (url.pathname === "/api/coupons/claim" && req.method === "POST") {
    if (!auth || auth.role !== "customer") return json(res, 401, { error: "登录后才能领取优惠券" });
    const body = await readBody(req);
    try {
      const coupon = claimCampaign(auth.customerId, String(body.campaignId || ""));
      const profile = ensureProfile(auth.customerId);
      return json(res, 201, { coupon, coupons: profile.coupons, campaigns: couponCampaignState(profile) });
    } catch (error) { return json(res, 409, { error: error.message || "领取失败" }); }
  }
  if (url.pathname === "/api/state/seed" && req.method === "POST") {
    const remoteAddress = String(req.socket.remoteAddress || "");
    const isLocal = remoteAddress === "127.0.0.1" || remoteAddress === "::1" || remoteAddress === "::ffff:127.0.0.1";
    if (!isLocal || req.headers["cf-connecting-ip"]) return json(res, 403, { error: "初始数据只能在服务器本机创建" });
    if (readState()) return json(res, 409, { error: "数据已经初始化" });
    const body = await readBody(req); if (!body.data || !Array.isArray(body.data.products)) return json(res, 400, { error: "初始化数据不完整" });
    writeState(body.data); return json(res, 201, { ok: true });
  }
  if (url.pathname === "/api/state" && req.method === "GET") {
    const state = readState(); if (!state) return json(res, 404, { error: "数据尚未初始化" });
    return json(res, 200, { data: filteredState(state.data, auth), version: state.version });
  }
  if (url.pathname === "/api/operation" && req.method === "POST") {
    const state = readState(); if (!state) return json(res, 503, { error: "商城数据尚未初始化" });
    const body = await readBody(req);
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = applyOperation(state.data, auth, String(body.type || ""), body.payload || {}); const version = writeState(state.data); db.exec("COMMIT");
      return json(res, 200, { result, data: filteredState(state.data, auth), version });
    } catch (error) { db.exec("ROLLBACK"); return json(res, 400, { error: error.message || "操作失败" }); }
  }
  if (url.pathname === "/api/support" && req.method === "POST") {
    const state = readState(); if (!state) return json(res, 503, { error: "商城数据尚未初始化" });
    const body = await readBody(req); const question = String(body.message || "").trim().slice(0, 500);
    const history = Array.isArray(body.history) ? body.history.slice(-8).map(item => ({ role: item && item.role === "assistant" ? "assistant" : "user", content: String(item && item.content || "").slice(0, 500) })).filter(item => item.content.trim()) : [];
    const context = safeAccountContext(auth, state.data); const answer = await intelligentSupport(question, context, state.data, history);
    return json(res, 200, answer);
  }
  return json(res, 404, { error: "接口不存在" });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    if (url.pathname === "/favicon.ico") { res.writeHead(204, { "Cache-Control": "public, max-age=86400" }); return res.end(); }
    const relative = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    const file = path.resolve(PUBLIC_DIR, relative);
    if (!file.startsWith(path.resolve(PUBLIC_DIR) + path.sep) && file !== path.resolve(PUBLIC_DIR, "index.html")) { res.writeHead(403); return res.end("Forbidden"); }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>页面不存在 · 悦选商城</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f3ef;color:#22201d;font-family:"Microsoft YaHei",system-ui,sans-serif}main{text-align:center;padding:40px}h1{font-size:64px;margin:0;color:#c35d32}p{color:#6f6962;margin:10px 0 26px}a{display:inline-block;padding:12px 22px;border-radius:999px;background:#1f3a2c;color:#fff;text-decoration:none}small{display:block;margin-top:18px;color:#9c958c}</style></head><body><main><h1>404</h1><p>这个页面不存在，可能链接输错了。</p><a href="/">回到商城首页</a><small>悦选商城 · 演示项目</small></main></body></html>`);
    }
    const codeAsset = /\.(?:html|js|css)$/i.test(file);
    res.writeHead(200, { "Content-Type": mimeType(file), "Cache-Control": codeAsset ? "no-cache" : "public, max-age=3600", "X-Content-Type-Options": "nosniff" });
    fs.createReadStream(file).pipe(res);
  } catch (error) { json(res, 500, { error: error.message || "服务器错误" }); }
});

server.listen(PORT, HOST, () => {
  console.log(`悦选商城已启动：http://127.0.0.1:${PORT}`);
  console.log(`商家账号：${ADMIN_ACCOUNT}`);
  if (!process.env.YUEXUAN_ADMIN_PASSWORD) console.log("首次演示密码：YueXuan@2026Admin（公开访问前请通过环境变量修改）");
});
