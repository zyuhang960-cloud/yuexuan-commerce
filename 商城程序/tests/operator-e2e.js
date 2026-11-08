"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const HOST = "127.0.0.1";
const appPort = 19000 + Math.floor(Math.random() * 500);
const debugPort = 20000 + Math.floor(Math.random() * 500);
const baseUrl = `http://${HOST}:${appPort}/`;
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "yuexuan-operator-e2e-"));
const failureScreenshot = path.join(ROOT, "runtime", "operator-e2e-failure.png");
const report = [];
const browserErrors = [];
let serverProcess;
let edgeProcess;
let cdp;

function record(name, detail = "通过") {
    report.push({ name, detail });
    process.stdout.write(`✓ ${name}${detail === "通过" ? "" : `：${detail}`}\n`);
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, timeout = 30000) {
    const started = Date.now();
    let lastError;
    while (Date.now() - started < timeout) {
        try {
            const response = await fetch(url);
            if (response.ok) return response;
        } catch (error) {
            lastError = error;
        }
        await delay(200);
    }
    throw new Error(`等待服务超时：${url}${lastError ? ` (${lastError.message})` : ""}`);
}

class CdpClient {
    constructor(url) {
        this.url = url;
        this.nextId = 1;
        this.pending = new Map();
    }

    async connect() {
        this.socket = new WebSocket(this.url);
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("连接 Edge 调试端口超时")), 10000);
            this.socket.addEventListener("open", () => { clearTimeout(timer); resolve(); });
            this.socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("无法连接 Edge 调试端口")); });
        });
        this.socket.addEventListener("message", (event) => {
            const message = JSON.parse(String(event.data));
            if (message.id && this.pending.has(message.id)) {
                const pending = this.pending.get(message.id);
                this.pending.delete(message.id);
                if (message.error) pending.reject(new Error(message.error.message));
                else pending.resolve(message.result);
                return;
            }
            if (message.method === "Runtime.exceptionThrown") {
                const details = message.params.exceptionDetails || {};
                browserErrors.push(`页面异常：${details.text || "未知异常"} ${details.exception && details.exception.description ? details.exception.description : ""}`.trim());
            }
            if (message.method === "Log.entryAdded" && message.params.entry && message.params.entry.level === "error") {
                browserErrors.push(`控制台错误：${message.params.entry.text}`);
            }
        });
        await this.send("Runtime.enable");
        await this.send("Page.enable");
        await this.send("Log.enable");
    }

    send(method, params = {}) {
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.socket.send(JSON.stringify({ id, method, params }));
            setTimeout(() => {
                if (!this.pending.has(id)) return;
                this.pending.delete(id);
                reject(new Error(`浏览器命令超时：${method}`));
            }, 15000);
        });
    }

    async evaluate(expression) {
        const response = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
        if (response.exceptionDetails) {
            const description = response.exceptionDetails.exception && response.exceptionDetails.exception.description;
            throw new Error(description || response.exceptionDetails.text || "页面脚本执行失败");
        }
        return response.result.value;
    }

    async waitFor(expression, description, timeout = 12000) {
        const started = Date.now();
        let lastError;
        while (Date.now() - started < timeout) {
            try {
                const value = await this.evaluate(expression);
                if (value) return value;
            } catch (error) {
                lastError = error;
            }
            await delay(120);
        }
        throw new Error(`等待页面状态超时：${description}${lastError ? ` (${lastError.message})` : ""}`);
    }

    async click(selector) {
        const clicked = await this.evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element) return false; element.click(); return true; })()`);
        assert.equal(clicked, true, `找不到可点击元素：${selector}`);
        await delay(120);
    }

    async clickByText(selector, text) {
        const clicked = await this.evaluate(`(() => { const element = Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find((item) => item.textContent.includes(${JSON.stringify(text)})); if (!element) return false; element.click(); return true; })()`);
        assert.equal(clicked, true, `找不到按钮：${text}`);
        await delay(120);
    }

    async fill(selector, value) {
        const filled = await this.evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element) return false; element.focus(); element.value = ${JSON.stringify(value)}; element.dispatchEvent(new Event("input", { bubbles: true })); element.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
        assert.equal(filled, true, `找不到输入框：${selector}`);
        await delay(80);
    }

    text(selector) {
        return this.evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); return element ? element.textContent.trim() : null; })()`);
    }

    count(selector) {
        return this.evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
    }

    async modal(title) {
        return this.waitFor(`document.querySelector("#modalBackdrop.open") && document.querySelector("#modalTitle") && document.querySelector("#modalTitle").textContent.trim() === ${JSON.stringify(title)}`, `弹窗“${title}”`);
    }

    async closeModal() {
        await this.click("#closeModalBtn");
        await this.waitFor(`!document.querySelector("#modalBackdrop.open")`, "弹窗关闭");
    }

    async screenshot(filePath) {
        const result = await this.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
        fs.writeFileSync(filePath, Buffer.from(result.data, "base64"));
    }
}

async function connectToPage() {
    const endpoint = `http://${HOST}:${debugPort}/json/list`;
    const started = Date.now();
    while (Date.now() - started < 30000) {
        try {
            const targets = await (await fetch(endpoint)).json();
            const page = targets.find((target) => target.type === "page" && target.url.startsWith(baseUrl));
            if (page && page.webSocketDebuggerUrl) return new CdpClient(page.webSocketDebuggerUrl);
        } catch (_) {}
        await delay(200);
    }
    throw new Error("没有找到商城页面的 Edge 调试目标");
}

async function getWallet() {
    return cdp.evaluate(`(() => { const values = Array.from(document.querySelectorAll(".member-wallet button strong")).map((item) => Number(item.textContent.trim())); return { points: values[0], favorites: values[1], orders: values[2], coupons: values[3] }; })()`);
}

async function orderBadge(label) {
    return cdp.evaluate(`(() => { const button = Array.from(document.querySelectorAll(".account-order-card button")).find((item) => item.textContent.includes(${JSON.stringify(label)})); const badge = button && button.querySelector("b"); return badge ? Number(badge.textContent.trim()) : 0; })()`);
}

async function runOperatorScenario() {
    await cdp.waitFor(`document.querySelectorAll(".consumer-desktop-nav button").length === 5 && document.querySelectorAll(".product-card").length >= 8`, "商城首页加载");
    assert.equal(await cdp.count(".home-category-grid button"), 15);
    const catalogSummary = await cdp.evaluate(`fetch("/api/state").then((response) => response.json()).then((payload) => ({ products: payload.data.products.length, categories: new Set(payload.data.products.map((item) => item.category)).size }))`);
    assert.equal(catalogSummary.products, 156);
    assert.equal(catalogSummary.categories, 15);
    const brokenImages = await cdp.evaluate(`(async () => { const payload = await fetch("/api/state").then((response) => response.json()); const checks = await Promise.all(payload.data.products.map((product) => new Promise((resolve) => { const image = new Image(); image.onload = () => resolve(image.naturalWidth > 0 && image.naturalHeight > 0 ? null : product.id); image.onerror = () => resolve(product.id); image.src = product.imageAsset + "?image-audit=1"; }))); return checks.filter(Boolean); })()`);
    assert.deepEqual(brokenImages, [], `存在无法解码的商品图片：${brokenImages.join(", ")}`);
    record("首页、5个主导航和15个商品分类可用");

    const categoryNames = await cdp.evaluate(`Array.from(document.querySelectorAll(".home-category-grid button")).map((button) => button.dataset.categoryJump)`);
    for (const category of categoryNames) {
        await cdp.click(`[data-category-jump="${category}"]`);
        await cdp.waitFor(`document.querySelector(".category-pill.active") && document.querySelector(".category-pill.active").textContent.trim() === ${JSON.stringify(category)}`, `分类“${category}”`);
        assert.ok(await cdp.count(".product-card") >= 10, `${category}应至少展示10件商品`);
        await cdp.click('.consumer-logo[data-consumer-page="home"]');
        await cdp.waitFor(`document.querySelector(".home-category-grid")`, "返回商城首页");
    }
    record("15个分类按钮逐个打开且每类至少10件商品");

    const imageChecks = [
        { category: "男装鞋履", id: "P102", asset: "catalog-p120.webp" },
        { category: "腕表饰品", id: "P107", asset: "catalog-p115.webp" },
        { category: "汽车出行", id: "P118", asset: "catalog-p105.webp" },
        { category: "汽车出行", id: "P119", asset: "catalog-p107.webp" },
        { category: "商超百货", id: "P127", asset: "catalog-p127.webp" },
        { category: "餐具水具", id: "P137", asset: "catalog-p137.webp" },
        { category: "烘焙厨具", id: "P147", asset: "catalog-p147.webp" }
    ];
    for (const check of imageChecks) {
        await cdp.click(`[data-category-jump="${check.category}"]`);
        await cdp.waitFor(`document.querySelector('.category-pill.active') && document.querySelector('.category-pill.active').textContent.trim() === ${JSON.stringify(check.category)}`, `图片映射分类“${check.category}”`);
        const image = await cdp.evaluate(`(() => { const trigger = document.querySelector('[data-action="product-detail"][data-id="${check.id}"]'); const img = trigger && trigger.closest('.product-card').querySelector('img'); return img ? { src: img.getAttribute('src'), alt: img.alt } : null; })()`);
        assert.ok(image, `未找到商品 ${check.id}`);
        assert.ok(image.src.endsWith(check.asset), `${check.id} 图片应为 ${check.asset}，实际为 ${image.src}`);
        assert.ok(image.alt.length > 0, `${check.id} 图片应有商品说明`);
        await cdp.click('.consumer-logo[data-consumer-page="home"]');
        await cdp.waitFor(`document.querySelector('.home-category-grid')`, "返回商城首页");
    }
    record("男装、腕表、汽车及3个新增分类的重点商品图片逐一对应");

    await cdp.click('[data-consumer-page="account"]');
    await cdp.click('[data-action="user-register"]');
    await cdp.modal("注册悦选账号");
    const phone = `139${String(Date.now()).slice(-8)}`;
    await cdp.fill("#registerName", "验收用户");
    await cdp.fill("#registerPhone", phone);
    await cdp.fill("#registerPassword", "Operator@2026");
    await cdp.fill("#registerRegion", "广东深圳");
    assert.match(await cdp.text('[data-password-meter="registerPassword"]'), /强|全部满足|安全/i);
    await cdp.click("#submitModalBtn");
    await cdp.waitFor(`document.querySelector(".account-hero h2") && document.querySelector(".account-hero h2").textContent.includes("验收用户")`, "注册完成并进入会员中心");
    let wallet = await getWallet();
    assert.equal(wallet.favorites, 0, "新账号收藏夹必须为空");
    assert.equal(await cdp.count("[data-cart-count]"), 0, "空购物车不应显示角标");
    record("注册、强密码提示、新账号空收藏夹和空购物车角标");

    const couponCountBeforeClaim = wallet.coupons;
    await cdp.click('[data-consumer-page="messages"]');
    await cdp.click('[data-action="promotions"]');
    await cdp.modal("优惠活动");
    assert.ok(await cdp.count(".promotion-grid article") >= 4, "优惠活动种类不足");
    const claimableCoupon = await cdp.evaluate(`(() => { const button = Array.from(document.querySelectorAll("[data-campaign-id]")).find((item) => !["available", "used"].includes(item.dataset.campaignStatus)); return button ? button.dataset.campaignId : null; })()`);
    assert.ok(claimableCoupon, "应存在一张可领取优惠券");
    await cdp.click(`[data-campaign-id="${claimableCoupon}"]`);
    await cdp.waitFor(`document.querySelector(${JSON.stringify(`[data-campaign-id="${claimableCoupon}"]`)}).dataset.campaignStatus === "available"`, "优惠券领取成功");
    await cdp.click(`[data-campaign-id="${claimableCoupon}"]`);
    await cdp.modal("我的优惠券");
    assert.ok(await cdp.count(".coupon-list article") >= couponCountBeforeClaim + 1);
    await cdp.closeModal();
    await cdp.click('[data-action="promotions"]');
    await cdp.modal("优惠活动");
    assert.equal(await cdp.evaluate(`document.querySelector(${JSON.stringify(`[data-campaign-id="${claimableCoupon}"]`)}).dataset.campaignStatus`), "available", "同一优惠券不可重复领取");
    await cdp.closeModal();
    record("优惠活动种类、首次领取、卡包到账和防重复领取");

    await cdp.click('[data-consumer-page="account"]');
    wallet = await getWallet();
    const pointsBeforeCheckIn = wallet.points;
    await cdp.click('[data-action="points-mall"]');
    await cdp.modal("积分商城");
    assert.ok(await cdp.count(".reward-card") >= 6, "积分好礼数量不足");
    await cdp.click('[data-loyalty-action="checkin"]');
    await cdp.modal("积分商城");
    const pointsAfterCheckIn = Number(await cdp.text(".points-balance strong"));
    assert.equal(pointsAfterCheckIn, pointsBeforeCheckIn + 10);
    assert.equal(await cdp.evaluate(`document.querySelector('[data-loyalty-action="checkin"]').disabled`), true, "签到每天只能进行一次");
    await cdp.fill("#birthdayValue", "2.25");
    await cdp.click('[data-loyalty-action="birthday-save"]');
    await cdp.modal("积分商城");
    assert.equal(await cdp.evaluate(`document.querySelector('#birthdayValue').value`), "02-25", "生日应归一化为月-日格式");
    assert.equal(await cdp.evaluate(`document.querySelector('#birthdayValue').disabled`), true, "保存后的生日不可随意修改");
    await cdp.closeModal();
    record("积分商城签到、每日防重复、生日2.25格式和多种兑换礼品");

    await cdp.click('[data-action="address-manager"]');
    await cdp.modal("收货地址");
    await cdp.fill("#addressReceiver", "验收员");
    await cdp.fill("#addressPhone", phone);
    await cdp.fill("#addressRegion", "广东省 — Guangdong Sheng");
    await cdp.fill("#addressDetail", "abcdefg");
    await cdp.click("#submitModalBtn");
    await cdp.waitFor(`!document.querySelector("#modalBackdrop.open")`, "保存自由输入地址");
    record("收货地址保留联系人校验并允许中英文自由输入");

    await cdp.click('[data-action="shopping-advisor"]');
    await cdp.modal("帮我选");
    await cdp.evaluate(`document.querySelector("#advisorCategory").value = "商超百货"`);
    await cdp.fill("#advisorBudget", "1000");
    await cdp.click("#submitModalBtn");
    await cdp.modal("为你推荐");
    assert.ok(await cdp.count(".advisor-card") >= 2, "帮我选应给出多个匹配结果");
    assert.match(await cdp.text(".advisor-card.best"), /最适合/);
    await cdp.closeModal();

    await cdp.click('[data-action="price-deals"]');
    await cdp.modal("价格历史与个性化优惠");
    assert.ok(await cdp.count(".deal-card") >= 6, "价格优惠页应展示足够商品");
    assert.ok(await cdp.count(".price-history-bars i") >= 18, "价格历史应包含多个时间点");
    await cdp.closeModal();

    await cdp.click('[data-action="subscription-manager"]');
    await cdp.modal("周期购 / 自动补货");
    await cdp.click("#submitModalBtn");
    await cdp.waitFor(`document.querySelectorAll(".subscription-list article").length === 1`, "创建周期购计划");
    const beforeSkipDate = await cdp.text(".subscription-list article p");
    await cdp.click('[data-subscription-action="skip"]');
    await cdp.waitFor(`document.querySelector(".subscription-list article p") && document.querySelector(".subscription-list article p").textContent !== ${JSON.stringify(beforeSkipDate)}`, "跳过本期后更新日期");
    await cdp.click('[data-subscription-action="toggle"]');
    await cdp.waitFor(`document.querySelector(".subscription-status.paused")`, "暂停周期购计划");
    await cdp.closeModal();
    record("帮我选、价格历史与个性化优惠、周期购创建/跳期/暂停均可操作");

    await cdp.click('[data-consumer-page="catalog"]');
    await cdp.waitFor(`document.querySelectorAll(".product-card").length >= 10`, "商品列表加载");
    assert.equal(await cdp.count(".category-pill"), 16);
    await cdp.click('.category-pill[data-category="商超百货"]');
    await cdp.click('[data-action="smart-filter"]');
    await cdp.modal("多属性智能筛选");
    await cdp.evaluate(`(() => { document.querySelector("#filterBrand").value = "悦选优品"; document.querySelector("#filterPrice").value = "100—499元"; document.querySelector("#filterStock").value = "现货"; })()`);
    await cdp.click("#submitModalBtn");
    await cdp.waitFor(`document.querySelector(".active-smart-filters") && document.querySelectorAll(".product-card").length === 1`, "多属性筛选结果");
    assert.match(await cdp.text(".product-card h3"), /乳清蛋白粉/);
    await cdp.click('[data-action="reset-smart-filter"]');
    await cdp.click('.category-pill[data-category="全部分类"]');
    record("品牌、价格和库存多属性筛选及一键清除可用");
    const product = await cdp.evaluate(`(() => { const card = document.querySelector(".product-card"); return { id: card.querySelector("[data-id]").dataset.id, name: card.querySelector("h3").textContent.trim() }; })()`);
    await cdp.fill("#storeSearch", product.name);
    await delay(350);
    await cdp.waitFor(`document.querySelectorAll(".product-card").length === 1`, "商品搜索结果");
    await cdp.evaluate(`(() => { const input = document.querySelector("#storeSearch"); input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); return true; })()`);
    await delay(200);
    await cdp.click(`.product-card [data-action="product-detail"][data-id="${product.id}"]`);
    await cdp.modal(product.name);
    assert.equal(await cdp.text(".product-detail-visual img"), "");
    const detailAlt = await cdp.evaluate(`document.querySelector(".product-detail-visual img").alt`);
    assert.equal(detailAlt, product.name, "详情图的商品说明必须与商品名一致");
    await cdp.click('[data-detail-action="compare"]');
    await cdp.modal(product.name);
    assert.match(await cdp.text('[data-detail-action="compare"]'), /已加入对比/);
    await cdp.click('[data-detail-action="alert"]');
    await cdp.modal(product.name);
    assert.match(await cdp.text('[data-detail-action="alert"]'), /已设置提醒/);
    await cdp.fill("#questionContent", "这件商品是否支持七天无理由退货？");
    await cdp.click('[data-detail-action="question"]');
    await cdp.modal(product.name);
    assert.match(await cdp.text(".detail-section:last-child"), /等待商家回复/);
    await cdp.click("#submitModalBtn");
    await cdp.waitFor(`!document.querySelector("#modalBackdrop.open")`, "详情加入购物车");
    await cdp.waitFor(`document.querySelectorAll("[data-cart-count]").length > 0`, "购物车角标更新");
    await cdp.click(`.product-card .favorite-button[data-id="${product.id}"]`);
    record("商品搜索、详情图绑定、对比、提醒、提问、收藏和加入购物车");

    await cdp.click('[data-consumer-page="account"]');
    wallet = await getWallet();
    assert.equal(wallet.favorites, 1);
    const beforeOrder = { ...wallet };
    await cdp.click('[data-action="browsing-history"]');
    await cdp.modal("浏览足迹");
    assert.match(await cdp.text("#modalBody"), new RegExp(product.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await cdp.closeModal();
    await cdp.click('[data-action="product-compare"]');
    await cdp.modal("商品对比");
    assert.match(await cdp.text("#modalBody"), new RegExp(product.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await cdp.click("[data-clear-compare]");
    await cdp.waitFor(`document.querySelector('#modalBody .empty-state') && document.querySelector('#modalBody .empty-state').textContent.includes('还没有对比商品')`, "一键清空商品对比");
    await cdp.closeModal();
    await cdp.click('[data-action="product-alerts"]');
    await cdp.modal("降价 / 补货提醒");
    assert.match(await cdp.text("#modalBody"), new RegExp(product.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await cdp.closeModal();
    record("收藏、浏览足迹、商品对比一键清空和提醒数据均按账号保存");

    await cdp.click('[data-action="customer-service"]');
    await cdp.modal("悦选客服");
    await cdp.fill("#serviceInput", "你是谁");
    await cdp.click("#serviceSend");
    await cdp.waitFor(`document.querySelectorAll(".service-reply").length >= 2 && !document.querySelector(".service-thinking")`, "客服回答身份问题");
    const identityReply = await cdp.evaluate(`Array.from(document.querySelectorAll(".service-reply")).at(-1).textContent.trim()`);
    assert.match(identityReply, /悦选|客服/);
    await cdp.fill("#serviceInput", "哈喽，今天有什么购物建议？");
    await cdp.click("#serviceSend");
    await cdp.waitFor(`document.querySelectorAll(".service-reply").length >= 3 && !document.querySelector(".service-thinking")`, "客服回答开放式问候");
    const greetingReply = await cdp.evaluate(`Array.from(document.querySelectorAll(".service-reply")).at(-1).textContent.trim()`);
    assert.notEqual(greetingReply, identityReply);
    await cdp.closeModal();
    record("账户感知客服可回答身份和开放式问候");

    await cdp.click('[data-consumer-page="cart"]');
    await cdp.waitFor(`document.querySelectorAll(".cart-page-item").length === 1`, "购物车商品");
    await cdp.evaluate(`window.confirm = () => true`);
    await cdp.click('[data-action="clear-cart"]');
    await cdp.waitFor(`document.querySelectorAll('.cart-page-item').length === 0 && document.querySelector('.empty-state')`, "一键清空购物车");
    assert.equal(await cdp.count("[data-cart-count]"), 0, "清空购物车后角标应消失");
    await cdp.click('[data-consumer-page="catalog"]');
    await cdp.waitFor(`document.querySelector('[data-action="add-cart"][data-id="${product.id}"]')`, "返回商品列表");
    await cdp.click(`[data-action="add-cart"][data-id="${product.id}"]`);
    await cdp.click('[data-consumer-page="cart"]');
    await cdp.waitFor(`document.querySelectorAll(".cart-page-item").length === 1`, "重新加入购物车");
    assert.equal(await cdp.text(".cart-page-controls span"), "1");
    await cdp.click('[data-cart-page="plus"]');
    assert.equal(await cdp.text(".cart-page-controls span"), "2");
    await cdp.click('[data-cart-page="minus"]');
    assert.equal(await cdp.text(".cart-page-controls span"), "1");
    await cdp.click('[data-action="checkout"]');
    await cdp.modal("确认订单");
    assert.match(await cdp.text(".checkout-address"), /abcdefg/);
    await cdp.click("#submitModalBtn");
    await cdp.modal("支付成功");
    await cdp.click("#submitModalBtn");
    await cdp.modal("我的订单");
    assert.equal(await cdp.count(".consumer-order"), 1);
    assert.match(await cdp.text(".consumer-order"), /待发货/);
    await cdp.closeModal();
    await cdp.click('[data-consumer-page="account"]');
    await cdp.waitFor(`document.querySelector(".account-hero")`, "支付后返回会员中心");
    let afterPay = await getWallet();
    assert.ok(afterPay.points > beforeOrder.points, "支付后应增加积分");
    assert.equal(await orderBadge("待发货"), 1);
    assert.equal(await cdp.count("[data-cart-count]"), 0, "结算后购物车角标应消失");
    record("购物车一键清空、数量、结算、模拟支付、订单和待发货角标");

    await cdp.clickByText('.account-order-card button', "待发货");
    await cdp.modal("我的订单");
    await cdp.click('[data-consumer-order="cancel"]');
    await cdp.modal("我的订单");
    assert.match(await cdp.text(".consumer-order-list"), /暂无待发货订单/);
    await cdp.closeModal();
    await cdp.waitFor(`document.querySelector(".account-hero")`, "取消订单后会员中心刷新");
    const afterCancel = await getWallet();
    assert.equal(afterCancel.points, beforeOrder.points, "取消订单后积分应恢复");
    assert.equal(afterCancel.coupons, beforeOrder.coupons, "取消订单后优惠券应恢复");
    assert.equal(await orderBadge("待发货"), 0, "取消订单后待发货角标应消失");
    assert.equal(await orderBadge("退款/售后"), 0, "取消订单不应产生售后角标");
    assert.equal(await cdp.count("[data-cart-count]"), 0, "空购物车不应显示角标");
    record("取消订单后积分、优惠券、待发货/售后/购物车角标全部恢复");

    await cdp.click('[data-action="user-logout"]');
    await cdp.waitFor(`document.querySelector(".guest-account")`, "退出用户账号");
    await cdp.click('[data-action="user-login"]');
    await cdp.modal("登录悦选");
    await cdp.fill("#loginAccount", "merchant");
    await cdp.fill("#loginPassword", "YueXuan@2026Admin");
    await cdp.click("#submitModalBtn");
    await cdp.waitFor(`!document.body.classList.contains("storefront-mode") && document.querySelector(".nav-item.active[data-page='dashboard']")`, "进入商家后台");
    const adminPages = [
        ["dashboard", "数据概览"], ["products", "商品管理"], ["customers", "客户管理"],
        ["orders", "订单管理"], ["inventory", "库存管理"], ["analytics", "经营分析"], ["marketing", "营销与问答"]
    ];
    for (const [page, title] of adminPages) {
        await cdp.click(`.nav-item[data-page="${page}"]`);
        await cdp.waitFor(`document.querySelector("#pageTitle").textContent.trim() === ${JSON.stringify(title)}`, `后台${title}`);
    }
    assert.equal(await cdp.count('[data-action="answer-question"]'), 1);
    await cdp.click('[data-action="answer-question"]');
    await cdp.modal("回复商品问题");
    await cdp.fill("#answerContent", "支持七天无理由退货，商品保持完好即可申请。");
    await cdp.click("#submitModalBtn");
    await cdp.waitFor(`!document.querySelector("#modalBackdrop.open") && document.querySelector("#pageTitle").textContent.trim() === "营销与问答"`, "发布商家回复");
    assert.equal(await cdp.count('[data-action="answer-question"]'), 0);
    record("商家账号直达后台、7个后台导航和商品问答回复");

    await cdp.click("#adminLogoutBtn");
    await cdp.waitFor(`document.body.classList.contains("storefront-mode") && document.querySelector(".home-category-grid")`, "退出商家后台");
    await cdp.click('[data-consumer-page="account"]');
    await cdp.click('[data-action="user-login"]');
    await cdp.modal("登录悦选");
    await cdp.fill("#loginAccount", phone);
    await cdp.fill("#loginPassword", "Operator@2026");
    await cdp.click("#submitModalBtn");
    await cdp.waitFor(`document.querySelector(".account-hero h2") && document.querySelector(".account-hero h2").textContent.includes("验收用户")`, "重新登录提问账号");
    await cdp.click('[data-action="my-questions"]');
    await cdp.modal("我的提问");
    assert.match(await cdp.text(".my-question-list"), /支持七天无理由退货，商品保持完好即可申请/);
    await cdp.closeModal();
    await cdp.click('[data-consumer-page="messages"]');
    await cdp.waitFor(`document.querySelector(".question-reply-message")`, "消息中心显示商家回复");
    assert.match(await cdp.text(".question-reply-message"), /商家回复/);
    await cdp.click(`.question-reply-message [data-action="product-detail"][data-id="${product.id}"]`);
    await cdp.modal(product.name);
    assert.match(await cdp.text(".detail-section:last-child"), /支持七天无理由退货，商品保持完好即可申请/);
    await cdp.closeModal();
    record("商家回复可在我的提问、消息中心和商品详情三处同步显示");

    assert.deepEqual(browserErrors, [], `浏览器出现脚本错误：\n${browserErrors.join("\n")}`);
    record("整轮操作无页面脚本异常");
}

async function main() {
    if (!fs.existsSync(EDGE)) throw new Error(`未找到 Microsoft Edge：${EDGE}`);
    serverProcess = spawn(process.execPath, ["server.js"], {
        cwd: ROOT,
        env: {
            ...process.env,
            YUEXUAN_PORT: String(appPort),
            YUEXUAN_DB_PATH: path.join(tempDir, "operator-e2e.db"),
            YUEXUAN_DISABLE_OLLAMA: "1"
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
    });
    let serverOutput = "";
    serverProcess.stdout.on("data", (chunk) => { serverOutput += chunk; });
    serverProcess.stderr.on("data", (chunk) => { serverOutput += chunk; });
    await waitForHttp(`${baseUrl}api/health`);

    edgeProcess = spawn(EDGE, [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        `--remote-debugging-port=${debugPort}`,
        `--user-data-dir=${path.join(tempDir, "edge-profile")}`,
        "--window-size=1440,1000",
        baseUrl
    ], { stdio: "ignore", windowsHide: true });

    cdp = await connectToPage();
    await cdp.connect();
    try {
        await runOperatorScenario();
        try { fs.rmSync(failureScreenshot, { force: true }); } catch (_) {}
        process.stdout.write(`\n真实操作员验收通过：${report.length} 组检查全部正常。\n`);
    } catch (error) {
        fs.mkdirSync(path.dirname(failureScreenshot), { recursive: true });
        try { fs.rmSync(failureScreenshot, { force: true }); } catch (_) {}
        try { await cdp.screenshot(failureScreenshot); } catch (_) {}
        error.message += `\n失败截图：${failureScreenshot}`;
        if (serverOutput.trim()) error.message += `\n服务器输出：${serverOutput.trim()}`;
        throw error;
    }
}

main().catch((error) => {
    process.stderr.write(`\n✗ ${error.stack || error.message}\n`);
    process.exitCode = 1;
}).finally(async () => {
    try { if (cdp && cdp.socket) cdp.socket.close(); } catch (_) {}
    try { if (edgeProcess && !edgeProcess.killed) edgeProcess.kill(); } catch (_) {}
    try { if (serverProcess && !serverProcess.killed) serverProcess.kill(); } catch (_) {}
    await delay(250);
    try {
        const resolvedTemp = path.resolve(tempDir);
        const resolvedRoot = path.resolve(os.tmpdir());
        if (resolvedTemp.startsWith(resolvedRoot + path.sep) && path.basename(resolvedTemp).startsWith("yuexuan-operator-e2e-")) {
            fs.rmSync(resolvedTemp, { recursive: true, force: true });
        }
    } catch (_) {}
});
