"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const crypto = require("node:crypto");
const vm = require("node:vm");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "yuexuan-test-"));
const port = 18800 + Math.floor(Math.random() * 500);
const base = `http://127.0.0.1:${port}`;
let child;

async function api(method, url, body, cookie) {
  const response = await fetch(base + url, {
    method,
    headers: Object.assign({ "Content-Type": "application/json" }, cookie ? { Cookie: cookie } : {}),
    body: body == null ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, body: payload, cookie: response.headers.get("set-cookie") };
}

async function waitForServer() {
  for (let i = 0; i < 50; i += 1) {
    try { if ((await fetch(base + "/api/health")).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("测试服务器启动超时");
}

test.before(async () => {
  child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      YUEXUAN_PORT: String(port),
      YUEXUAN_DB_PATH: path.join(tempDir, "test.db"),
      YUEXUAN_SKIP_AUTO_SEED: "1",
      YUEXUAN_DISABLE_OLLAMA: "1"
    }),
    stdio: ["ignore", "pipe", "pipe"]
  });
  await waitForServer();
  const seed = await api("POST", "/api/state/seed", { data: {
    products: [
      { id: "P001", name: "测试商品", spec: "标准款", category: "数码精选", price: 250, cost: 100, stock: 10, warningStock: 2, status: "正常销售" },
      { id: "P021", name: "天然竹木锅铲", spec: "原木色", category: "厨房用品", price: 39, cost: 15, stock: 5, warningStock: 1, status: "正常销售" }
    ],
    customers: [{ id: "C001", name: "演示用户", phone: "13800001231", region: "广东深圳", type: "老客户", points: 0 }],
    orders: [], stockRecords: [], pointRecords: []
  } });
  assert.equal(seed.status, 201);
});

test.after(async () => {
  if (child && !child.killed) child.kill();
  await new Promise(resolve => setTimeout(resolve, 200));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("catalog has complete categories and unique local product images", () => {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "网页前端", "catalog-data.js"), "utf8"), sandbox);
  const products = sandbox.window.YUEXUAN_CATALOG;
  assert.ok(products.length >= 156, `商品数量不足：${products.length}`);
  assert.equal(new Set(products.map(item => item.id)).size, products.length);
  assert.ok(new Set(products.map(item => item.name)).size >= products.length - 25, "重复商品名称过多");
  const categoryCounts = products.reduce((map, item) => { map[item.category] = (map[item.category] || 0) + 1; return map; }, {});
  assert.ok(Object.keys(categoryCounts).length >= 15, `分类不足：${Object.keys(categoryCounts).length}`);
  Object.entries(categoryCounts).forEach(([category, count]) => assert.ok(count >= 10, `${category}少于10件商品`));
  const hashes = new Set();
  const duplicates = [];
  products.forEach(product => {
    assert.ok(product.price > 0 && Number.isInteger(product.stock) && product.stock >= 0, `${product.id}商品数值不正确`);
    const imagePath = path.join(ROOT, "网页前端", product.imageAsset);
    assert.equal(fs.existsSync(imagePath), true, `${product.id}缺少图片 ${product.imageAsset}`);
    const bytes = fs.readFileSync(imagePath);
    assert.ok(bytes.length > 3000, `${product.id}图片文件异常`);
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    if (hashes.has(hash)) duplicates.push(product.id);
    else hashes.add(hash);
  });
  assert.ok(duplicates.length <= 25, `重复商品图片过多：${duplicates.length}`);
});

test("registration rejects weak passwords and creates an isolated member wallet", async () => {
  const weak = await api("POST", "/api/auth/register", { name: "测试用户", phone: "13911112222", password: "123456", region: "广东深圳" });
  assert.equal(weak.status, 400);

  const registered = await api("POST", "/api/auth/register", { name: "测试用户", phone: "13911112222", password: "Strong@12345", region: "广东深圳" });
  assert.equal(registered.status, 201);
  const cookie = registered.cookie.split(";")[0];
  const profile = await api("GET", "/api/profile", null, cookie);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.coupons.length, 2);
  assert.equal(profile.body.campaigns.filter(item => item.status === "available").length, 2);
  assert.equal(profile.body.campaigns.filter(item => item.status === "claimable").length, 5);
});

test("address accepts free-form demo text while keeping basic contact validation", async () => {
  const login = await api("POST", "/api/auth/login", { account: "13911112222", password: "Strong@12345" });
  const cookie = login.cookie.split(";")[0];
  const invalid = await api("PUT", "/api/profile/address", { receiver: "张五", phone: "123", region: "A", detail: "B" }, cookie);
  assert.equal(invalid.status, 400);

  const valid = await api("PUT", "/api/profile/address", { receiver: "张五", phone: "13158579875", region: "广东省 — Guangdong Sheng", detail: "dhasfga" }, cookie);
  assert.equal(valid.status, 200);
  assert.equal(valid.body.address.receiver, "张五");
  assert.equal(valid.body.address.region, "广东省 — Guangdong Sheng");
  assert.equal(valid.body.address.detail, "dhasfga");
});

test("birthday accepts familiar month-day input and stores a normalized value", async () => {
  const registered = await api("POST", "/api/auth/register", { name: "生日格式测试", phone: "13955556666", password: "Birthday@2026", region: "广东深圳" });
  assert.equal(registered.status, 201);
  const cookie = registered.cookie.split(";")[0];
  const saved = await api("POST", "/api/operation", { type: "saveBirthday", payload: { birthday: "2.25" } }, cookie);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.result.birthday, "02-25");
  const profile = await api("GET", "/api/profile", null, cookie);
  assert.equal(profile.body.loyalty.birthday, "02-25");
});

test("coupon can be claimed once, cannot be reclaimed after use, and returns on cancellation", async () => {
  const login = await api("POST", "/api/auth/login", { account: "13911112222", password: "Strong@12345" });
  const cookie = login.cookie.split(";")[0];
  const claim = await api("POST", "/api/coupons/claim", { campaignId: "WEEKEND20" }, cookie);
  assert.equal(claim.status, 201);
  const repeat = await api("POST", "/api/coupons/claim", { campaignId: "WEEKEND20" }, cookie);
  assert.equal(repeat.status, 409);

  const coupon = claim.body.coupon;
  const created = await api("POST", "/api/operation", { type: "createOrder", payload: { customerId: "C002", items: [{ productId: "P001", quantity: 1 }], shippingFee: -999, status: "已完成", appliedCoupon: coupon } }, cookie);
  assert.equal(created.status, 200);
  assert.equal(created.body.result.total, 230);
  assert.equal(created.body.result.status, "待付款");
  const orderId = created.body.result.id;
  const afterUse = await api("GET", "/api/profile", null, cookie);
  assert.equal(afterUse.body.coupons.some(item => item.id === coupon.id), false);
  assert.equal(afterUse.body.campaigns.find(item => item.id === "WEEKEND20").status, "used");
  const reclaim = await api("POST", "/api/coupons/claim", { campaignId: "WEEKEND20" }, cookie);
  assert.equal(reclaim.status, 409);

  assert.equal((await api("POST", "/api/operation", { type: "advanceOrder", payload: { orderId } }, cookie)).status, 200);
  const cancelled = await api("POST", "/api/operation", { type: "cancelOrder", payload: { orderId } }, cookie);
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.result.status, "已取消");
  const restored = await api("GET", "/api/profile", null, cookie);
  assert.equal(restored.body.coupons.some(item => item.id === coupon.id), true);
  assert.equal(restored.body.campaigns.find(item => item.id === "WEEKEND20").status, "available");
  const state = await api("GET", "/api/state", null, cookie);
  assert.equal(state.body.data.customers[0].points, 0);
  assert.equal(state.body.data.products[0].stock, 10);
});

test("support answers identity, account and payment questions without repeating one fallback", async () => {
  const login = await api("POST", "/api/auth/login", { account: "13911112222", password: "Strong@12345" });
  const cookie = login.cookie.split(";")[0];
  const identity = await api("POST", "/api/support", { message: "你是谁", history: [] }, cookie);
  const account = await api("POST", "/api/support", { message: "我是谁", history: [{ role: "user", content: "你是谁" }, { role: "assistant", content: identity.body.answer }] }, cookie);
  const payment = await api("POST", "/api/support", { message: "这里会真实扣款吗", history: [] }, cookie);
  const greeting = await api("POST", "/api/support", { message: "哈喽", history: [] }, cookie);
  const categories = await api("POST", "/api/support", { message: "你们有多少商品和哪些分类", history: [] }, cookie);
  assert.match(identity.body.answer, /悦选商城在线客服/);
  assert.match(account.body.answer, /测试用户/);
  assert.match(payment.body.answer, /模拟支付/);
  assert.match(greeting.body.answer, /你好/);
  assert.match(categories.body.answer, /数码精选/);
  assert.notEqual(identity.body.answer, account.body.answer);
});

test("points mall supports daily check-in, coupon rewards and cancellable physical rewards", async () => {
  const login = await api("POST", "/api/auth/login", { account: "13911112222", password: "Strong@12345" });
  const cookie = login.cookie.split(";")[0];
  const adminLogin = await api("POST", "/api/auth/login", { account: "merchant", password: "YueXuan@2026Admin" });
  const adminCookie = adminLogin.cookie.split(";")[0];
  const checkIn = await api("POST", "/api/operation", { type: "dailyCheckIn", payload: { customerId: "C002" } }, cookie);
  assert.equal(checkIn.status, 200);
  assert.equal(checkIn.body.result.points, 10);
  assert.equal((await api("POST", "/api/operation", { type: "dailyCheckIn", payload: { customerId: "C002" } }, cookie)).status, 400);

  await api("POST", "/api/operation", { type: "changePoints", payload: { customerId: "C002", points: 4000, type: "测试积分" } }, adminCookie);
  const couponReward = await api("POST", "/api/operation", { type: "redeemReward", payload: { customerId: "C002", rewardId: "R001" } }, cookie);
  assert.equal(couponReward.status, 200);
  assert.match(couponReward.body.result.coupon.name, /5元/);

  const physicalReward = await api("POST", "/api/operation", { type: "redeemReward", payload: { customerId: "C002", rewardId: "R007" } }, cookie);
  assert.equal(physicalReward.status, 200);
  assert.equal(physicalReward.body.result.order.status, "待发货");
  const rewardOrderId = physicalReward.body.result.order.id;
  const cancelled = await api("POST", "/api/operation", { type: "cancelOrder", payload: { orderId: rewardOrderId } }, cookie);
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.result.pointsReturned, true);

  const state = await api("GET", "/api/state", null, cookie);
  assert.equal(state.body.data.products.find(item => item.id === "P021").stock, 5);
  const profile = await api("GET", "/api/profile", null, cookie);
  assert.equal(profile.body.loyalty.checkedInToday, true);
  assert.equal(profile.body.loyalty.rewards.length, 8);
  assert.equal(profile.body.loyalty.rewards.find(item => item.id === "R007").remaining, 1);
});

test("completed refund closes the pending after-sale state and restores order benefits", async () => {
  const login = await api("POST", "/api/auth/login", { account: "13911112222", password: "Strong@12345" });
  const cookie = login.cookie.split(";")[0];
  const adminLogin = await api("POST", "/api/auth/login", { account: "merchant", password: "YueXuan@2026Admin" });
  const adminCookie = adminLogin.cookie.split(";")[0];
  const beforeState = await api("GET", "/api/state", null, cookie);
  const startingPoints = beforeState.body.data.customers[0].points;
  const profile = await api("GET", "/api/profile", null, cookie);
  const coupon = profile.body.coupons.find(item => item.campaignId === "WEEKEND20");
  const created = await api("POST", "/api/operation", { type: "createOrder", payload: { customerId: "C002", items: [{ productId: "P001", quantity: 1 }], appliedCoupon: coupon } }, cookie);
  const orderId = created.body.result.id;
  assert.equal((await api("POST", "/api/operation", { type: "advanceOrder", payload: { orderId } }, cookie)).body.result.status, "待发货");
  assert.equal((await api("POST", "/api/operation", { type: "advanceOrder", payload: { orderId } }, cookie)).status, 400);
  assert.equal((await api("POST", "/api/operation", { type: "advanceOrder", payload: { orderId } }, adminCookie)).body.result.status, "已发货");
  assert.equal((await api("POST", "/api/operation", { type: "advanceOrder", payload: { orderId } }, cookie)).body.result.status, "已完成");
  assert.equal((await api("POST", "/api/operation", { type: "requestReturn", payload: { orderId } }, cookie)).body.result.status, "退货处理中");
  assert.equal((await api("POST", "/api/operation", { type: "completeRefund", payload: { orderId } }, cookie)).status, 400);
  const refunded = await api("POST", "/api/operation", { type: "completeRefund", payload: { orderId } }, adminCookie);
  assert.equal(refunded.body.result.status, "已退款");
  const state = await api("GET", "/api/state", null, cookie);
  assert.equal(state.body.data.orders.filter(item => item.status === "退货处理中").length, 0);
  assert.equal(state.body.data.customers[0].points, startingPoints);
  const restored = await api("GET", "/api/profile", null, cookie);
  assert.equal(restored.body.coupons.some(item => item.id === coupon.id), true);
});

test("member growth, referral, comparison, alerts, timeline, reviews and product Q&A work together", async () => {
  const referrerLogin = await api("POST", "/api/auth/login", { account: "13911112222", password: "Strong@12345" });
  const referrerCookie = referrerLogin.cookie.split(";")[0];
  const referrerProfile = await api("GET", "/api/profile", null, referrerCookie);
  const inviteCode = referrerProfile.body.features.inviteCode;
  const beforeState = await api("GET", "/api/state", null, referrerCookie);
  const referrerBefore = beforeState.body.data.customers[0].points;

  const registered = await api("POST", "/api/auth/register", { name: "邀请测试", phone: "13933334444", password: "Invite@12345", region: "广东广州", inviteCode });
  assert.equal(registered.status, 201);
  const cookie = registered.cookie.split(";")[0];
  const customerId = registered.body.customer.id;

  assert.equal((await api("POST", "/api/operation", { type: "recordProductView", payload: { productId: "P001" } }, cookie)).status, 200);
  assert.equal((await api("POST", "/api/operation", { type: "toggleCompare", payload: { productId: "P001" } }, cookie)).body.result.added, true);
  assert.equal((await api("POST", "/api/operation", { type: "toggleProductAlert", payload: { productId: "P001" } }, cookie)).body.result.added, true);
  for (const keyword of ["耳机", "数码", "测试商品"]) await api("POST", "/api/operation", { type: "recordSearch", payload: { keyword } }, cookie);
  const features = await api("GET", "/api/profile", null, cookie);
  assert.deepEqual(features.body.features.history, ["P001"]);
  assert.deepEqual(features.body.features.compare, ["P001"]);
  assert.equal(features.body.features.alerts.length, 1);
  assert.equal(features.body.loyalty.tasks.find(item => item.id === "TASK_SEARCH").ready, true);
  assert.equal((await api("POST", "/api/operation", { type: "claimTask", payload: { taskId: "TASK_SEARCH" } }, cookie)).body.result.task.points, 20);
  const clearedCompare = await api("POST", "/api/operation", { type: "clearCompare", payload: {} }, cookie);
  assert.equal(clearedCompare.status, 200);
  assert.deepEqual(clearedCompare.body.result.compare, []);

  const created = await api("POST", "/api/operation", { type: "createOrder", payload: { customerId, items: [{ productId: "P001", quantity: 1 }] } }, cookie);
  const orderId = created.body.result.id;
  const paid = await api("POST", "/api/operation", { type: "advanceOrder", payload: { orderId } }, cookie);
  assert.equal(paid.body.result.status, "待发货");
  assert.equal(paid.body.result.timeline.length, 2);
  const adminLogin = await api("POST", "/api/auth/login", { account: "merchant", password: "YueXuan@2026Admin" });
  const adminCookie = adminLogin.cookie.split(";")[0];
  await api("POST", "/api/operation", { type: "advanceOrder", payload: { orderId } }, adminCookie);
  await api("POST", "/api/operation", { type: "advanceOrder", payload: { orderId } }, cookie);
  const review = await api("POST", "/api/operation", { type: "submitReview", payload: { productId: "P001", rating: 5, content: "测试商品使用顺畅，包装也很完整。" } }, cookie);
  assert.equal(review.status, 200);
  const question = await api("POST", "/api/operation", { type: "submitQuestion", payload: { productId: "P001", content: "这个商品支持七天无理由吗？" } }, cookie);
  const answer = await api("POST", "/api/operation", { type: "answerQuestion", payload: { questionId: question.body.result.id, answer: "未拆封且不影响二次销售时支持。" } }, adminCookie);
  assert.match(answer.body.result.answer, /支持/);
  const refreshedQuestionState = await api("GET", "/api/state", null, cookie);
  const visibleAnswer = refreshedQuestionState.body.data.questions.find(item => item.id === question.body.result.id);
  assert.equal(visibleAnswer.answer, "未拆封且不影响二次销售时支持。");

  const birthday = new Date().toISOString().slice(5, 10);
  assert.equal((await api("POST", "/api/operation", { type: "saveBirthday", payload: { birthday } }, cookie)).status, 200);
  const gift = await api("POST", "/api/operation", { type: "claimBirthdayGift", payload: {} }, cookie);
  assert.equal(gift.body.result.points, 200);

  const afterState = await api("GET", "/api/state", null, referrerCookie);
  assert.ok(afterState.body.data.customers[0].points >= referrerBefore + 300);
  const finalProfile = await api("GET", "/api/profile", null, cookie);
  assert.equal(finalProfile.body.loyalty.referralRewarded, true);
  assert.equal(finalProfile.body.loyalty.tasks.find(item => item.id === "TASK_REVIEW").ready, true);

  const toggled = await api("POST", "/api/operation", { type: "togglePromotion", payload: { promotionId: "M001" } }, adminCookie);
  assert.equal(toggled.status, 200);
  assert.equal(toggled.body.result.enabled, false);
});

test("price history and recurring purchase plans stay account-scoped and support lifecycle actions", async () => {
  const registered = await api("POST", "/api/auth/register", { name: "周期购测试", phone: "13977778888", password: "Subscribe@2026", region: "浙江杭州" });
  assert.equal(registered.status, 201);
  const cookie = registered.cookie.split(";")[0];
  const initial = await api("GET", "/api/state", null, cookie);
  assert.equal(initial.body.data.priceHistory.filter(item => item.productId === "P021").length, 3);

  const created = await api("POST", "/api/operation", { type: "createSubscription", payload: { productId: "P021", intervalDays: 30, quantity: 2 } }, cookie);
  assert.equal(created.status, 200);
  assert.equal(created.body.result.status, "active");
  const subscriptionId = created.body.result.id;
  const originalDate = created.body.result.nextDelivery;

  const duplicate = await api("POST", "/api/operation", { type: "createSubscription", payload: { productId: "P021", intervalDays: 30, quantity: 1 } }, cookie);
  assert.equal(duplicate.status, 400);
  const skipped = await api("POST", "/api/operation", { type: "skipSubscription", payload: { subscriptionId } }, cookie);
  assert.notEqual(skipped.body.result.nextDelivery, originalDate);
  const paused = await api("POST", "/api/operation", { type: "toggleSubscription", payload: { subscriptionId } }, cookie);
  assert.equal(paused.body.result.status, "paused");
  const cancelled = await api("POST", "/api/operation", { type: "cancelSubscription", payload: { subscriptionId } }, cookie);
  assert.equal(cancelled.body.result.status, "cancelled");

  const ownState = await api("GET", "/api/state", null, cookie);
  assert.equal(ownState.body.data.subscriptions.length, 1);
  const otherLogin = await api("POST", "/api/auth/login", { account: "13911112222", password: "Strong@12345" });
  const otherState = await api("GET", "/api/state", null, otherLogin.cookie.split(";")[0]);
  assert.equal(otherState.body.data.subscriptions.length, 0);

  const adminLogin = await api("POST", "/api/auth/login", { account: "merchant", password: "YueXuan@2026Admin" });
  const adminCookie = adminLogin.cookie.split(";")[0];
  const repriced = await api("POST", "/api/operation", { type: "updateProduct", payload: { productId: "P021", changes: { price: 42 } } }, adminCookie);
  assert.equal(repriced.status, 200);
  const afterReprice = await api("GET", "/api/state", null, cookie);
  assert.equal(afterReprice.body.data.priceHistory.filter(item => item.productId === "P021").at(-1).price, 42);
});

test("customer cannot execute merchant-only inventory operations", async () => {
  const login = await api("POST", "/api/auth/login", { account: "13911112222", password: "Strong@12345" });
  const cookie = login.cookie.split(";")[0];
  const result = await api("POST", "/api/operation", { type: "adjustStock", payload: { productId: "P001", quantity: 99 } }, cookie);
  assert.equal(result.status, 400);
  const points = await api("POST", "/api/operation", { type: "changePoints", payload: { customerId: "C002", points: 99999 } }, cookie);
  assert.equal(points.status, 400);
});
