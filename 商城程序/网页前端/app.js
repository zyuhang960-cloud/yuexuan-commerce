(function () {
    "use strict";

    const pageContent = document.getElementById("pageContent");
    const pageTitle = document.getElementById("pageTitle");
    const pageEyebrow = document.getElementById("pageEyebrow");
    const modalBackdrop = document.getElementById("modalBackdrop");
    const modalForm = document.getElementById("modalForm");
    const modalTitle = document.getElementById("modalTitle");
    const modalEyebrow = document.getElementById("modalEyebrow");
    const modalBody = document.getElementById("modalBody");
    const submitModalBtn = document.getElementById("submitModalBtn");
    const toast = document.getElementById("toast");
    const sidebar = document.getElementById("sidebar");
    const sidebarMask = document.getElementById("sidebarMask");
    const CART_KEY = "yuexuan_store_cart_v03";
    const FAVORITE_KEY = "yuexuan_store_favorites_v02";
    const MEMBER_KEY = "yuexuan_current_member_v01";
    const ADDRESS_KEY = "yuexuan_customer_addresses_v01";
    const COUPON_KEY = "yuexuan_customer_coupons_v01";
    const BENEFIT_SYNC_KEY = "yuexuan_reversed_order_benefits_v01";
    const ACTIVE_BUNDLE_KEY = "yuexuan_active_bundle_v01";
    let authenticatedRole = null;

    const productImages = {};

    dataService.snapshot().products.forEach(function (product) {
        if (product.imageAsset) productImages[product.id] = product.imageAsset.indexOf("assets/") === 0 ? product.imageAsset : "assets/catalog/" + product.imageAsset;
    });

    const pointRewards = [
        { id: "R001", category: "优惠券", name: "5元无门槛券", points: 500, condition: "全场商品可用", limit: 3, available: true },
        { id: "R002", category: "优惠券", name: "包邮券", points: 300, condition: "不限订单金额", limit: 3, available: true },
        { id: "R003", category: "优惠券", name: "15元满减券", points: 1200, condition: "满129元可用", limit: 3, available: true },
        { id: "R004", category: "优惠券", name: "30元满减券", points: 2000, condition: "满299元可用", limit: 2, available: true },
        { id: "R005", category: "优惠券", name: "50元大额券", points: 3200, condition: "满499元可用", limit: 2, available: true },
        { id: "R006", category: "优惠券", name: "100元大额券", points: 6000, condition: "满1999元可用", limit: 1, available: true },
        { id: "R007", category: "实物礼品", name: "天然竹木锅铲", points: 2600, condition: "兑换后生成待发货订单", limit: 1, available: true },
        { id: "R008", category: "实物礼品", name: "黑色铝制水杯", points: 3200, condition: "兑换后生成待发货订单", limit: 1, available: true }
    ];

    const state = {
        page: "dashboard",
        productSearch: "",
        productStatus: "全部状态",
        customerSearch: "",
        orderSearch: "",
        orderStatus: "全部状态",
        inventoryMode: "全部商品"
        ,storeSearch: ""
        ,storeCategory: "全部分类"
        ,storeSort: "综合推荐"
        ,storeFilterBrand: "全部品牌"
        ,storeFilterPrice: "全部价格"
        ,storeFilterStock: "全部库存"
        ,storeView: "home"
        ,consumerPage: "home"
        ,messageView: "all"
        ,orderFilter: "全部"
        ,storeVisible: 16
    };

    const pageMeta = {
        storefront: ["悦选 YUEXUAN", ""],
        dashboard: ["数据概览", "悦选商家中心 / 经营概览"],
        products: ["商品管理", "基础资料 / 商品中心"],
        customers: ["客户管理", "基础资料 / 客户中心"],
        orders: ["订单管理", "业务处理 / 订单中心"],
        inventory: ["库存管理", "业务处理 / 仓储中心"],
        analytics: ["经营分析", "经营中心 / 销售分析"],
        marketing: ["营销与问答", "经营中心 / 活动配置"]
    };

    let modalSubmitHandler = null;
    let toastTimer = null;
    let motionInitialized = false;
    let storeSearchTimer = null;

    function enhanceMotion() {
        if (!window.AOS) return;
        document.querySelectorAll(".store-hero, .service-strip, .home-category-grid, .store-section-heading, .message-shortcuts, .message-list > article, .account-hero, .member-wallet, .account-order-card, .account-service-card, .stat-card, .panel").forEach(function (element, index) {
            if (element.hasAttribute("data-aos")) return;
            element.setAttribute("data-aos", "fade-up");
            element.setAttribute("data-aos-delay", String(Math.min((index % 6) * 45, 225)));
        });
        if (!motionInitialized) {
            window.AOS.init({ duration: 520, easing: "ease-out-cubic", once: true, offset: 36 });
            motionInitialized = true;
        } else {
            window.AOS.refreshHard();
        }
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function money(value) {
        return "¥" + Number(value || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function shortDate(value) {
        return String(value || "").replace(/-/g, "/");
    }

    function customerName(data, customerId) {
        const customer = data.customers.find(function (item) { return item.id === customerId; });
        return customer ? customer.name : "未知客户";
    }

    function productName(data, productId) {
        const product = data.products.find(function (item) { return item.id === productId; });
        return product ? product.name : "未知商品";
    }

    function loadCart() {
        try {
            const cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
            if (!Array.isArray(cart)) return [];
            const merged = {};
            cart.forEach(function (item) {
                const productId = String(item && item.productId || "");
                const quantity = Math.floor(Number(item && item.quantity));
                if (!productId || !Number.isFinite(quantity) || quantity <= 0) return;
                merged[productId] = (merged[productId] || 0) + quantity;
            });
            return Object.keys(merged).map(function (productId) { return { productId: productId, quantity: merged[productId] }; });
        } catch (error) {
            return [];
        }
    }

    function saveCart(cart) {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
        refreshCartBadges();
    }

    function cartCount() {
        return loadCart().reduce(function (sum, item) { return sum + Number(item.quantity || 0); }, 0);
    }

    function refreshCartBadges() {
        const count = cartCount();
        document.querySelectorAll("[data-cart-count]").forEach(function (item) {
            item.textContent = count;
            item.hidden = count === 0;
            item.style.display = count === 0 ? "none" : "";
        });
        const quickButton = document.getElementById("quickOrderBtn");
        if (quickButton && state.page === "storefront") quickButton.textContent = "购物车（" + count + "）";
    }

    function loadFavorites() {
        try {
            const memberId = localStorage.getItem(MEMBER_KEY) || "guest";
            const all = JSON.parse(localStorage.getItem(FAVORITE_KEY) || "{}");
            const list = all && typeof all === "object" && Array.isArray(all[memberId]) ? all[memberId] : [];
            return Array.isArray(list) ? list : [];
        } catch (error) { return []; }
    }

    function toggleFavorite(productId) {
        const list = loadFavorites();
        const index = list.indexOf(productId);
        if (index === -1) list.push(productId); else list.splice(index, 1);
        const memberId = localStorage.getItem(MEMBER_KEY) || "guest";
        const all = loadJson(FAVORITE_KEY, {});
        all[memberId] = list;
        localStorage.setItem(FAVORITE_KEY, JSON.stringify(all));
        return index === -1;
    }

    function loadJson(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "null");
            return value == null ? fallback : value;
        } catch (error) { return fallback; }
    }

    function profileSnapshot() {
        if (!window.serverApi || !window.serverApi.enabled) return { features: { history: [], compare: [], alerts: [], searchHistory: [], inviteCode: "" }, loyalty: null };
        try { return window.serverApi.profile(); }
        catch (error) { return { features: { history: [], compare: [], alerts: [], searchHistory: [], inviteCode: "" }, loyalty: null }; }
    }

    function runMemberOperation(type, payload) {
        if (!window.serverApi || !window.serverApi.enabled || !dataService.operate) throw new Error("请通过“启动悦选商城”按钮运行后使用此功能");
        return dataService.operate(type, payload || {});
    }

    function addBundleToCart(bundle) {
        const data = dataService.snapshot(); const cart = loadCart();
        bundle.items.forEach(function (bundleItem) {
            const product = data.products.find(function (item) { return item.id === bundleItem.productId; });
            const current = cart.find(function (item) { return item.productId === bundleItem.productId; });
            const nextQuantity = Number(current ? current.quantity : 0) + Number(bundleItem.quantity || 1);
            if (!product || product.status !== "正常销售" || nextQuantity > product.stock) throw new Error((product ? product.name : "组合商品") + "库存不足");
        });
        bundle.items.forEach(function (bundleItem) {
            const current = cart.find(function (item) { return item.productId === bundleItem.productId; });
            if (current) current.quantity += Number(bundleItem.quantity || 1); else cart.push({ productId: bundleItem.productId, quantity: Number(bundleItem.quantity || 1) });
        });
        saveCart(cart); localStorage.setItem(ACTIVE_BUNDLE_KEY, bundle.id);
    }

    function currentMember(data) {
        const selectedId = localStorage.getItem(MEMBER_KEY);
        if (!selectedId) return null;
        return data.customers.find(function (customer) { return customer.id === selectedId; }) || null;
    }

    function requireMember(nextAction) {
        const member = currentMember(dataService.snapshot());
        if (member) return member;
        openUserLogin(nextAction);
        return null;
    }

    function memberAddress(member) {
        if (!member) return null;
        if (window.serverApi && window.serverApi.enabled) {
            const profile = window.serverApi.profile();
            const legacyAddress = loadJson(ADDRESS_KEY, {})[member.id];
            if (!profile.address && legacyAddress) {
                try { return window.serverApi.saveAddress(legacyAddress).address; } catch (error) {}
            }
            return profile.address || { receiver: member.name, phone: member.phone, region: member.region, detail: "" };
        }
        const addresses = loadJson(ADDRESS_KEY, {});
        return addresses[member.id] || { receiver: member.name, phone: member.phone, region: member.region, detail: "" };
    }

    function saveMemberAddress(memberId, address) {
        if (window.serverApi && window.serverApi.enabled) return window.serverApi.saveAddress(address).address;
        const addresses = loadJson(ADDRESS_KEY, {});
        addresses[memberId] = address;
        localStorage.setItem(ADDRESS_KEY, JSON.stringify(addresses));
    }

    function memberCoupons(memberId) {
        if (window.serverApi && window.serverApi.enabled) return window.serverApi.couponState().coupons || [];
        const allCoupons = loadJson(COUPON_KEY, {});
        if (!Array.isArray(allCoupons[memberId])) allCoupons[memberId] = [
            { id: "CP001", name: "新人满减券", condition: "满99元可用", value: "¥10" },
            { id: "CP002", name: "会员包邮券", condition: "不限订单金额", value: "包邮" }
        ];
        localStorage.setItem(COUPON_KEY, JSON.stringify(allCoupons));
        return allCoupons[memberId];
    }

    function addMemberCoupon(memberId, coupon) {
        const allCoupons = loadJson(COUPON_KEY, {});
        const list = Array.isArray(allCoupons[memberId]) ? allCoupons[memberId] : [];
        if (!list.some(function (item) { return item.id === coupon.id; })) list.unshift(coupon);
        allCoupons[memberId] = list;
        localStorage.setItem(COUPON_KEY, JSON.stringify(allCoupons));
    }

    function consumeMemberCoupon(memberId, couponId) {
        if (window.serverApi && window.serverApi.enabled) return memberCoupons(memberId).find(function (coupon) { return coupon.id === couponId; }) || null;
        const allCoupons = loadJson(COUPON_KEY, {});
        const list = Array.isArray(allCoupons[memberId]) ? allCoupons[memberId] : [];
        const index = list.findIndex(function (coupon) { return coupon.id === couponId; });
        if (index === -1) return null;
        const coupon = list.splice(index, 1)[0];
        allCoupons[memberId] = list;
        localStorage.setItem(COUPON_KEY, JSON.stringify(allCoupons));
        return coupon;
    }

    function restoreOrderCoupon(order) {
        if (!order || !order.appliedCoupon || ["已取消", "已退款"].indexOf(order.status) === -1) return;
        if (window.serverApi && window.serverApi.enabled) return;
        const synced = loadJson(BENEFIT_SYNC_KEY, []);
        if (synced.indexOf(order.id) !== -1) return;
        addMemberCoupon(order.customerId, order.appliedCoupon);
        synced.push(order.id);
        localStorage.setItem(BENEFIT_SYNC_KEY, JSON.stringify(synced));
    }

    function syncReversedOrderCoupons(data, member) {
        if (!member) return;
        data.orders.filter(function (order) { return order.customerId === member.id; }).forEach(restoreOrderCoupon);
    }

    function orderCountBadge(count) {
        return count > 0 ? `<b>${count}</b>` : "";
    }

    function couponSavings(coupon, subtotal, shippingFee) {
        if (!coupon) return 0;
        if (coupon.value === "包邮") return shippingFee;
        const thresholdMatch = String(coupon.condition || "").match(/满(\d+(?:\.\d+)?)元/);
        if (thresholdMatch && subtotal < Number(thresholdMatch[1])) return 0;
        const valueMatch = String(coupon.value || "").match(/[\d.]+/);
        return valueMatch ? Math.min(subtotal + shippingFee, Number(valueMatch[0])) : 0;
    }

    function passwordChecks(password) {
        return {
            length: String(password).length >= 10,
            lower: /[a-z]/.test(password),
            upper: /[A-Z]/.test(password),
            number: /\d/.test(password),
            symbol: /[^A-Za-z0-9]/.test(password)
        };
    }

    function passwordIsStrong(password) {
        return Object.values(passwordChecks(password)).every(Boolean);
    }

    function passwordMeterMarkup(inputId) {
        return `<div class="password-strength" data-password-meter="${inputId}"><div class="password-strength-track"><span></span></div><div class="password-strength-head"><strong>密码强度</strong><span>未输入</span></div><ul><li data-rule="length">至少 10 位</li><li data-rule="upper">大写字母</li><li data-rule="lower">小写字母</li><li data-rule="number">数字</li><li data-rule="symbol">特殊字符</li></ul></div>`;
    }

    function bindPasswordMeter(inputId) {
        const input = document.getElementById(inputId);
        const meter = modalBody.querySelector(`[data-password-meter="${inputId}"]`);
        if (!input || !meter) return;
        const update = function () {
            const checks = passwordChecks(input.value);
            const count = Object.values(checks).filter(Boolean).length;
            Object.keys(checks).forEach(function (rule) { const item = meter.querySelector(`[data-rule="${rule}"]`); if (item) item.classList.toggle("passed", checks[rule]); });
            meter.className = "password-strength level-" + count;
            meter.querySelector(".password-strength-track span").style.width = (count * 20) + "%";
            meter.querySelector(".password-strength-head span").textContent = !input.value ? "未输入" : count <= 2 ? "较弱" : count < 5 ? "一般" : "安全";
        };
        input.addEventListener("input", update); update();
    }

    function productImage(productId) {
        return productImages[productId] || "assets/catalog/catalog-p001.webp";
    }

    function isAdminAuthenticated() {
        return authenticatedRole === "admin";
    }

    function addToCart(productId, quantity) {
        const data = dataService.snapshot();
        const product = data.products.find(function (item) { return item.id === productId; });
        const count = Number(quantity || 1);
        if (!product || product.status !== "正常销售") throw new Error("商品当前不可购买");
        if (!Number.isInteger(count) || count <= 0) throw new Error("购买数量必须是正整数");
        const cart = loadCart();
        const current = cart.find(function (item) { return item.productId === productId; });
        const nextQuantity = (current ? current.quantity : 0) + count;
        if (nextQuantity > product.stock) throw new Error("购物车数量不能超过当前库存 " + product.stock + " 件");
        if (current) current.quantity = nextQuantity;
        else cart.push({ productId: productId, quantity: count });
        saveCart(cart);
    }

    function categoryIcon(category) {
        const icons = { "数码3C": "▣", "数码配件": "⌁", "厨房用品": "◒", "食品生鲜": "◎", "家居生活": "⌂", "时尚穿搭": "◇", "箱包配饰": "▱", "美妆个护": "✦", "运动户外": "△", "男装鞋履": "衣", "腕表饰品": "◉", "汽车出行": "车", "商超百货": "购", "餐具水具": "杯", "烘焙厨具": "焙" };
        return icons[category] || "◇";
    }

    function productBrand(product) {
        const name = String(product && product.name || "");
        const rules = [
            [/iPhone|AirPods|Apple Watch|iPad|MacBook/i, "Apple"], [/Samsung/i, "Samsung"], [/OPPO/i, "OPPO"], [/HUAWEI/i, "HUAWEI"], [/vivo/i, "vivo"], [/Google Pixel/i, "Google"], [/Nike|Air Jordan/i, "Nike"], [/PUMA/i, "PUMA"], [/Off-White/i, "Off-White"], [/Rolex/i, "Rolex"], [/Longines/i, "Longines"], [/IWC/i, "IWC"], [/Calvin Klein|CK One/i, "Calvin Klein"], [/Chanel/i, "Chanel"], [/Dior/i, "Dior"], [/Dolce/i, "Dolce"], [/Gucci/i, "Gucci"], [/Prada/i, "Prada"]
        ];
        const match = rules.find(function (rule) { return rule[0].test(name); });
        return match ? match[1] : "悦选优品";
    }

    function smartFilterCount() {
        return [state.storeFilterBrand !== "全部品牌", state.storeFilterPrice !== "全部价格", state.storeFilterStock !== "全部库存"].filter(Boolean).length;
    }

    function showToast(message, isError) {
        clearTimeout(toastTimer);
        toast.textContent = message;
        toast.classList.toggle("error", Boolean(isError));
        toast.classList.add("show");
        toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 2600);
    }

    function heading(title, description, actions) {
        return `
            <div class="page-heading">
                <div>
                    <h2>${escapeHtml(title)}</h2>
                </div>
                ${actions ? `<div class="heading-actions">${actions}</div>` : ""}
            </div>`;
    }

    function statCard(label, value, note, symbol, color, tint) {
        return `
            <article class="stat-card" style="--card-color:${color};--card-tint:${tint}">
                <div class="stat-top">
                    <span class="stat-label">${escapeHtml(label)}</span>
                    <span class="stat-symbol">${escapeHtml(symbol)}</span>
                </div>
                <div class="stat-value">${value}</div>
            </article>`;
    }

    function statusBadge(status) {
        if (status === "正常销售" || status === "已完成" || status === "已回复") return `<span class="badge badge-success">${status}</span>`;
        if (status === "已取消" || status === "已停用") return `<span class="badge badge-neutral">${status}</span>`;
        if (status === "退货处理中" || status === "已退款") return `<span class="badge badge-warning">${escapeHtml(status)}</span>`;
        if (status === "待付款") return `<span class="badge badge-danger">${escapeHtml(status)}</span>`;
        return `<span class="badge badge-blue">${escapeHtml(status)}</span>`;
    }

    function lowStockBadge(product) {
        if (product.stock === 0) return '<span class="badge badge-danger">缺货</span>';
        if (product.stock <= product.warningStock) return '<span class="badge badge-warning">库存偏低</span>';
        return '<span class="badge badge-success">库存正常</span>';
    }

    function emptyRow(colspan, text) {
        return `<tr><td colspan="${colspan}"><div class="empty-state"><strong>没有找到数据</strong>${escapeHtml(text)}</div></td></tr>`;
    }

    function storefrontProducts(data) {
        const favorites = loadFavorites();
        const keyword = state.storeSearch.trim().toLowerCase();
        const earlyIds = new Set((data.earlyAccess || []).map(function (item) { return item.productId; }));
        const hasMember = Boolean(localStorage.getItem(MEMBER_KEY));
        let products = data.products.filter(function (product) {
            const matchesText = !keyword || [product.name, product.category, product.spec].some(function (value) { return String(value).toLowerCase().includes(keyword); });
            const matchesFavorite = state.storeView !== "favorites" || favorites.indexOf(product.id) !== -1;
            const matchesCategory = state.storeCategory === "全部分类" || product.category === state.storeCategory;
            const matchesBrand = state.storeFilterBrand === "全部品牌" || productBrand(product) === state.storeFilterBrand;
            const price = Number(product.price || 0);
            const matchesPrice = state.storeFilterPrice === "全部价格" || (state.storeFilterPrice === "100元以下" && price < 100) || (state.storeFilterPrice === "100—499元" && price >= 100 && price < 500) || (state.storeFilterPrice === "500—1999元" && price >= 500 && price < 2000) || (state.storeFilterPrice === "2000元以上" && price >= 2000);
            const matchesStock = state.storeFilterStock === "全部库存" || (state.storeFilterStock === "现货" && product.stock > 0) || (state.storeFilterStock === "库存充足" && product.stock > product.warningStock) || (state.storeFilterStock === "库存紧张" && product.stock > 0 && product.stock <= product.warningStock);
            return product.status === "正常销售" && matchesText && matchesFavorite && matchesCategory && matchesBrand && matchesPrice && matchesStock && (hasMember || !earlyIds.has(product.id));
        });
        if (state.storeSort === "价格从低到高") products.sort(function (a, b) { return a.price - b.price; });
        if (state.storeSort === "价格从高到低") products.sort(function (a, b) { return b.price - a.price; });
        if (state.storeSort === "人气优先") products.sort(function (a, b) { return b.id.localeCompare(a.id); });
        return products;
    }

    function productGridMarkup(products, limit) {
        const favorites = loadFavorites();
        const compared = localStorage.getItem(MEMBER_KEY) ? (profileSnapshot().features.compare || []) : [];
        const visibleProducts = Number(limit) > 0 ? products.slice(0, Number(limit)) : products;
        return `<section class="product-grid">${visibleProducts.map(function (product, index) {
            const isFavorite = favorites.indexOf(product.id) !== -1;
            const sold = 128 + Number(product.id.replace("P", "")) * 37;
            return `<article class="product-card">
                <div class="product-media-wrap">
                    <button class="product-media" data-action="product-detail" data-id="${product.id}" aria-label="查看${escapeHtml(product.name)}"><img src="${productImage(product.id)}" alt="${escapeHtml(product.name)}" loading="lazy"></button>
                    <button class="favorite-button ${isFavorite ? "active" : ""}" data-action="toggle-favorite" data-id="${product.id}" aria-label="${isFavorite ? "取消收藏" : "收藏商品"}">${isFavorite ? "♥" : "♡"}</button>
                    <span class="product-tag">${index < 2 ? "人气热选" : product.stock <= product.warningStock ? "即将售罄" : "会员好价"}</span>
                </div>
                <div class="product-card-body">
                    <div class="product-card-meta"><span>${escapeHtml(product.category)}</span><span>★ 4.${8 - index % 3} · ${sold}人已购</span></div>
                    <h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.spec)}</p>
                    <div class="product-price-row"><strong>${money(product.price)}</strong><button type="button" class="compare-chip ${compared.indexOf(product.id) >= 0 ? "active" : ""}" data-action="toggle-compare" data-id="${product.id}">${compared.indexOf(product.id) >= 0 ? "已加入对比" : "+ 对比"}</button><small>${product.stock > 0 ? "现货速发" : "暂时售罄"}</small></div>
                    <div class="product-card-actions"><button class="secondary-button" data-action="product-detail" data-id="${product.id}">查看详情</button><button class="primary-button" data-action="add-cart" data-id="${product.id}" ${product.stock ? "" : "disabled"}>${product.stock ? "加入购物车" : "暂时售罄"}</button></div>
                </div>
            </article>`;
        }).join("") || '<div class="empty-state store-empty"><strong>这里暂时没有商品</strong>换个分类或搜索词看看吧</div>'}</section>`;
    }

    function consumerHeader(member) {
        const labels = { home: "首页", catalog: "逛好物", messages: "消息", cart: "购物车", account: "我的" };
        const accountLabel = member ? `<span>${escapeHtml(member.name.slice(0, 1))}</span>${escapeHtml(member.name)}` : `<span>○</span>登录 / 注册`;
        return `<header class="consumer-header">
            <button class="consumer-logo" data-consumer-page="home"><span>悦</span><strong>悦选</strong></button>
            <nav class="consumer-desktop-nav">${Object.keys(labels).map(function (key) { const count = cartCount(); return `<button class="${state.consumerPage === key ? "active" : ""}" data-consumer-page="${key}">${labels[key]}${key === "cart" && count ? `<b data-cart-count>${count}</b>` : ""}</button>`; }).join("")}</nav>
            <div class="consumer-header-actions"><button data-consumer-page="catalog" aria-label="搜索">⌕</button><button data-consumer-page="messages" aria-label="消息">◇</button><button class="account-pill" data-consumer-page="account">${accountLabel}</button></div>
        </header>`;
    }

    function consumerBottomNav() {
        const items = [{ key: "home", icon: "⌂", label: "首页" }, { key: "catalog", icon: "⌕", label: "分类" }, { key: "messages", icon: "◇", label: "消息" }, { key: "cart", icon: "▱", label: "购物车" }, { key: "account", icon: "○", label: "我的" }];
        return `<nav class="mobile-store-nav">${items.map(function (item) { return `<button class="${state.consumerPage === item.key ? "active" : ""}" data-consumer-page="${item.key}">${item.icon}<span>${item.label}</span>${item.key === "cart" && cartCount() ? `<b data-cart-count>${cartCount()}</b>` : ""}</button>`; }).join("")}</nav>`;
    }

    function cartPageMarkup() {
        const data = dataService.snapshot();
        const cart = loadCart();
        let total = 0;
        return `<section class="consumer-page-head"><div><span>SHOPPING BAG</span><h2>购物车</h2></div><div class="page-head-actions"><strong>${cartCount()} 件商品</strong>${cart.length ? '<button type="button" class="clear-list-button" data-action="clear-cart">一键清空</button>' : ""}</div></section>
            <div class="cart-page-layout"><section class="cart-page-list">${cart.length ? cart.map(function (item) {
                const product = data.products.find(function (productItem) { return productItem.id === item.productId; });
                if (!product) return "";
                total += product.price * item.quantity;
                return `<article class="cart-page-item"><img src="${productImage(product.id)}" alt="${escapeHtml(product.name)}"><div class="cart-page-info"><span>${escapeHtml(product.category)}</span><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.spec)}</p><strong>${money(product.price)}</strong></div><div class="cart-page-controls"><button data-cart-page="minus" data-id="${product.id}">−</button><span>${item.quantity}</span><button data-cart-page="plus" data-id="${product.id}">＋</button></div><button class="cart-page-remove" data-cart-page="remove" data-id="${product.id}">移除</button></article>`;
            }).join("") : '<div class="empty-state cart-page-empty"><strong>购物车还是空的</strong><button class="primary-button" data-consumer-page="catalog">去逛逛</button></div>'}</section>
            <aside class="cart-checkout-card"><span>订单小计</span><div><p>商品金额</p><strong>${money(total)}</strong></div><div><p>配送费</p><strong>${!total ? money(0) : total >= 99 ? "免运费" : money(8)}</strong></div><div class="cart-grand-total"><p>合计</p><strong>${money(total + (total && total < 99 ? 8 : 0))}</strong></div><p>${!total ? "选择商品后显示配送优惠" : total < 99 ? "再选 " + money(99 - total) + " 即可包邮" : "已享受包邮服务"}</p><button class="primary-button" data-action="checkout" ${cart.length ? "" : "disabled"}>去结算</button></aside></div>`;
    }

    function renderStorefront() {
        const data = dataService.snapshot();
        const member = currentMember(data);
        const categories = ["全部分类"].concat(Array.from(new Set(data.products.filter(function (product) { return product.status === "正常销售"; }).map(function (product) { return product.category; }))));
        let content = "";

        if (state.consumerPage === "home") {
            state.storeView = "home";
            const featured = data.products.filter(function (product) { return product.status === "正常销售"; }).slice(0, 8);
            const earlyProducts = (data.earlyAccess || []).map(function (entry) { return data.products.find(function (product) { return product.id === entry.productId; }); }).filter(Boolean);
            const bundles = (data.bundles || []).filter(function (bundle) { return bundle.enabled !== false; });
            content = `<section class="store-hero"><div class="store-hero-copy"><p class="store-kicker">YUEXUAN COLLECTION</p><h2>把喜欢的生活<br>带回家</h2><p>质感日常，从一件真正好用的东西开始</p><button class="store-cta" data-consumer-page="catalog">探索本周精选 <span>→</span></button></div><div class="store-hero-gallery"><img class="hero-main-image" src="${productImage("P051")}" alt="Annibale Colombo 双人床"><img class="hero-small-image top" src="${productImage("P031")}" alt="新鲜红苹果"><img class="hero-small-image bottom" src="${productImage("P081")}" alt="Essence 纤长睫毛膏"></div></section>
                <section class="service-strip"><div><strong>正品保障</strong><span>严选品质好物</span></div><div><strong>满99元包邮</strong><span>安心送达</span></div><div><strong>7天无理由</strong><span>售后无忧</span></div><div><strong>会员积分</strong><span>消费即可累积</span></div></section>
                <section class="home-category-grid"><button data-category-jump="数码3C"><span>01</span><strong>数码新品</strong><small>旗舰科技</small></button><button data-category-jump="家居生活"><span>02</span><strong>理想家居</strong><small>装点空间</small></button><button data-category-jump="厨房用品"><span>03</span><strong>厨房用品</strong><small>认真生活</small></button><button data-category-jump="食品生鲜"><span>04</span><strong>食品生鲜</strong><small>每日新鲜</small></button><button data-category-jump="数码配件"><span>05</span><strong>数码配件</strong><small>效率装备</small></button><button data-category-jump="美妆个护"><span>06</span><strong>美妆个护</strong><small>悦享自己</small></button><button data-category-jump="运动户外"><span>07</span><strong>运动户外</strong><small>自在出发</small></button><button data-category-jump="箱包配饰"><span>08</span><strong>箱包配饰</strong><small>轻装上路</small></button><button data-category-jump="时尚穿搭"><span>09</span><strong>时尚穿搭</strong><small>自在表达</small></button><button data-category-jump="男装鞋履"><span>10</span><strong>男装鞋履</strong><small>通勤与运动</small></button><button data-category-jump="腕表饰品"><span>11</span><strong>腕表饰品</strong><small>细节品位</small></button><button data-category-jump="汽车出行"><span>12</span><strong>汽车出行</strong><small>城市与远方</small></button><button data-category-jump="商超百货"><span>13</span><strong>商超百货</strong><small>日常囤货</small></button><button data-category-jump="餐具水具"><span>14</span><strong>餐具水具</strong><small>餐桌日常</small></button><button data-category-jump="烘焙厨具"><span>15</span><strong>烘焙厨具</strong><small>轻松下厨</small></button></section>
                <section class="feature-hub"><button data-action="shopping-advisor"><span>选</span><strong>帮我选</strong><small>按预算和用途推荐</small></button><button data-action="price-deals"><span>↓</span><strong>价格与优惠</strong><small>历史价格和专属好价</small></button><button data-action="subscription-manager"><span>↻</span><strong>周期购</strong><small>自动补货计划</small></button><button data-action="browsing-history"><span>↺</span><strong>浏览足迹</strong><small>继续上次挑选</small></button><button data-action="product-compare"><span>⇄</span><strong>商品对比</strong><small>最多对比4件</small></button><button data-action="product-alerts"><span>♢</span><strong>降价/补货提醒</strong><small>关注状态变化</small></button><button data-action="invite-friends"><span>礼</span><strong>邀请有礼</strong><small>首单双方得积分</small></button></section>
                ${member && earlyProducts.length ? `<section class="store-section"><div class="store-section-heading"><div><span>MEMBER EARLY ACCESS</span><h2>会员提前购</h2></div><button data-action="member-center">查看会员权益 →</button></div>${productGridMarkup(earlyProducts)}</section>` : ""}
                ${bundles.length ? `<section class="store-section bundle-showcase"><div class="store-section-heading"><div><span>SMART BUNDLES</span><h2>组合购更划算</h2></div><small>满足组合条件，结算自动立减</small></div><div class="bundle-grid">${bundles.map(function (bundle) { return `<article><span>组合优惠</span><h3>${escapeHtml(bundle.name)}</h3><p>${bundle.items.map(function (item) { return escapeHtml(productName(data, item.productId)); }).join(" + ")}</p><strong>立减 ${money(bundle.discount)}</strong><button class="primary-button" data-action="add-bundle" data-id="${bundle.id}">整套加入购物车</button></article>`; }).join("")}</div></section>` : ""}
                <section class="store-section"><div class="store-section-heading"><div><span>CURATED FOR YOU</span><h2>本周精选</h2></div><button data-consumer-page="catalog">查看全部 →</button></div>${productGridMarkup(featured)}</section>`;
        }

        if (state.consumerPage === "catalog") {
            const products = storefrontProducts(data);
            const filterCount = smartFilterCount();
            const searchHistory = member ? (profileSnapshot().features.searchHistory || []) : [];
            const suggestions = (state.storeSearch ? data.products.filter(function (product) { return [product.name, product.category, product.spec].some(function (value) { return String(value).toLowerCase().includes(state.storeSearch.toLowerCase()); }); }).slice(0, 6).map(function (product) { return product.name; }) : searchHistory).slice(0, 6);
            content = `<section class="consumer-page-head"><div><span>DISCOVER</span><h2>${state.storeView === "favorites" ? "我的收藏" : "逛好物"}</h2></div><strong>${products.length} 件商品</strong></section><section class="store-toolbar"><div class="store-search"><span>⌕</span><input id="storeSearch" value="${escapeHtml(state.storeSearch)}" placeholder="搜索商品、类别或规格"></div><select id="storeSort" aria-label="商品排序"><option>综合推荐</option><option>人气优先</option><option>价格从低到高</option><option>价格从高到低</option></select><button class="smart-filter-button ${filterCount ? "active" : ""}" data-action="smart-filter">智能筛选${filterCount ? `<b>${filterCount}</b>` : ""}</button></section>${filterCount ? `<div class="active-smart-filters"><span>${[state.storeFilterBrand, state.storeFilterPrice, state.storeFilterStock].filter(function (value) { return !/^全部/.test(value); }).map(escapeHtml).join(" · ")}</span><button data-action="reset-smart-filter">清除筛选</button></div>` : ""}${suggestions.length ? `<div class="search-suggestions"><span>${state.storeSearch ? "搜索建议" : "最近搜索"}</span>${suggestions.map(function (value) { return `<button data-search-suggestion="${escapeHtml(value)}">${escapeHtml(value)}</button>`; }).join("")}${!state.storeSearch && member ? '<button data-action="clear-search-history">清空</button>' : ""}</div>` : ""}<div class="category-pills">${categories.map(function (category) { return `<button class="category-pill ${state.storeCategory === category ? "active" : ""}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`; }).join("")}</div>${productGridMarkup(products, state.storeVisible)}${products.length > state.storeVisible ? `<div class="load-more-wrap"><button class="secondary-button" data-action="load-more-products">查看更多商品<span>还剩 ${products.length - state.storeVisible} 件</span></button></div>` : ""}`;
        }

        if (state.consumerPage === "messages") {
            const alerts = member ? (profileSnapshot().features.alerts || []) : [];
            const changedAlerts = alerts.filter(function (item) { return item.priceDropped || item.restocked; });
            const answeredQuestions = member ? (data.questions || []).filter(function (item) { return item.customerId === member.id && item.answer; }).slice(0, 5) : [];
            content = `<section class="consumer-page-head"><div><span>NOTIFICATIONS</span><h2>消息中心</h2></div><button class="text-button" data-action="read-all-messages">全部已读</button></section><section class="message-shortcuts"><button data-action="order-assistant"><span>⌁</span><strong>订单助手</strong><small>发货与售后进度</small></button><button data-action="my-questions"><span>问</span><strong>我的提问</strong><small>查看商家回复</small></button><button data-action="promotions"><span>♢</span><strong>优惠活动</strong><small>会员专属好价</small></button><button data-action="customer-service"><span>○</span><strong>悦选客服</strong><small>在线为你解答</small></button></section><section class="message-list">${answeredQuestions.map(function (question) { return `<article class="question-reply-message"><span class="message-icon service">答</span><div><h3>${escapeHtml(productName(data, question.productId))} 有新回复</h3><p>${escapeHtml(question.answer)}</p><small>${shortDate(question.answeredAt)} · 商家回复</small></div><button data-action="product-detail" data-id="${question.productId}">查看问答</button></article>`; }).join("")}${changedAlerts.map(function (item) { return `<article><span class="message-icon coupon">↓</span><div><h3>${escapeHtml(item.name)}${item.priceDropped ? "降价了" : "已补货"}</h3><p>${item.priceDropped ? `关注价 ${money(item.watchedPrice)}，现价 ${money(item.currentPrice)}` : `当前库存 ${item.currentStock} 件`}</p><small>关注提醒</small></div><button data-action="product-detail" data-id="${item.productId}">查看商品</button></article>`; }).join("")}<article><span class="message-icon order">✓</span><div><h3>订单进度提醒</h3><p>查看待付款、待发货、待收货与售后进度。</p><small>实时同步</small></div><button data-action="order-assistant">查看订单</button></article><article><span class="message-icon coupon">券</span><div><h3>本周会员优惠</h3><p>优惠券、积分限时兑换和组合购已经更新。</p><small>活动中心</small></div><button data-action="promotions">去看看</button></article><article><span class="message-icon service">悦</span><div><h3>悦选客服在线</h3><p>配送、退换货和商品问题都可以咨询。</p><small>现在</small></div><button data-action="customer-service">立即咨询</button></article></section>`;
        }

        if (state.consumerPage === "cart") content = cartPageMarkup();

        if (state.consumerPage === "account") {
            if (!member) {
                content = `<section class="guest-account"><div class="guest-account-mark">悦</div><h2>登录悦选</h2><p>登录后可下单、查看订单、管理地址和使用积分。</p><div><button class="primary-button" data-action="user-login">登录</button><button class="secondary-button" data-action="user-register">注册新账号</button></div></section><section class="account-service-card guest-services"><h3>快捷服务</h3><div><button data-action="customer-service"><span>☎</span>联系客服</button><button data-action="help-center"><span>?</span>帮助中心</button><button data-action="promotions"><span>券</span>优惠活动</button></div></section>`;
            } else {
                syncReversedOrderCoupons(data, member);
                const orders = data.orders.filter(function (order) { return order.customerId === member.id; });
                const statusCount = function (status) { return orders.filter(function (order) { return order.status === status; }).length; };
                const afterSalesCount = orders.filter(function (order) { return order.status === "退货处理中"; }).length;
                const couponCount = memberCoupons(member.id).length;
                content = `<section class="account-hero"><div class="account-avatar">${escapeHtml(member.name.slice(0, 1))}</div><div><span>悦享会员</span><h2>${escapeHtml(member.name)}</h2><p>${escapeHtml(member.phone.slice(0, 3) + " **** " + member.phone.slice(-4))} · ${escapeHtml(member.region)}</p></div><button data-action="account-settings">账户设置</button></section>
                    <section class="member-wallet"><button data-action="points-mall"><strong>${member.points || 0}</strong><span>可用积分</span></button><button data-action="favorites"><strong>${loadFavorites().length}</strong><span>我的收藏</span></button><button data-action="my-orders" data-order-filter="全部"><strong>${orders.length}</strong><span>全部订单</span></button><button data-action="coupons"><strong>${couponCount}</strong><span>优惠券</span></button></section>
                    <section class="account-order-card"><header><h3>我的订单</h3><button data-action="my-orders" data-order-filter="全部">查看全部 →</button></header><div><button data-action="my-orders" data-order-filter="待付款"><span>¥</span><strong>待付款</strong>${orderCountBadge(statusCount("待付款"))}</button><button data-action="my-orders" data-order-filter="待发货"><span>▱</span><strong>待发货</strong>${orderCountBadge(statusCount("待发货"))}</button><button data-action="my-orders" data-order-filter="待收货"><span>⌁</span><strong>待收货</strong>${orderCountBadge(statusCount("已发货"))}</button><button data-action="my-orders" data-order-filter="售后"><span>↩</span><strong>退款/售后</strong>${orderCountBadge(afterSalesCount)}</button></div></section>
                    <section class="account-service-card"><h3>更多服务</h3><div><button data-action="points-mall"><span>礼</span>积分与任务</button><button data-action="shopping-advisor"><span>选</span>帮我选</button><button data-action="price-deals"><span>↓</span>价格与优惠</button><button data-action="subscription-manager"><span>↻</span>周期购</button><button data-action="my-questions"><span>问</span>我的提问</button><button data-action="favorites"><span>♡</span>收藏夹</button><button data-action="browsing-history"><span>↺</span>浏览足迹</button><button data-action="product-compare"><span>⇄</span>商品对比</button><button data-action="product-alerts"><span>♢</span>降价/补货提醒</button><button data-action="invite-friends"><span>友</span>邀请有礼</button><button data-consumer-page="messages"><span>◇</span>消息中心</button><button data-action="address-manager"><span>⌖</span>收货地址</button><button data-action="help-center"><span>?</span>帮助中心</button><button data-action="customer-service"><span>☎</span>联系客服</button></div></section>
                    <footer class="account-footer"><button data-action="user-logout">退出登录</button><span>用户协议 · 隐私政策</span></footer>`;
            }
        }

        pageContent.innerHTML = `<div class="storefront-shell">${consumerHeader(member)}<main class="consumer-content">${content}</main><footer class="store-footer"><div><strong>悦选 YUEXUAN</strong><span>用心挑选每一件日常好物</span></div><p>正品保障 · 售后无忧 · 安心配送</p></footer>${consumerBottomNav()}</div>`;

        const searchInput = document.getElementById("storeSearch");
        if (searchInput) searchInput.addEventListener("input", function (event) {
            const value = event.target.value;
            state.storeSearch = value;
            state.storeVisible = 16;
            clearTimeout(storeSearchTimer);
            storeSearchTimer = setTimeout(function () {
                renderStorefront();
                const nextInput = document.getElementById("storeSearch");
                if (nextInput) { nextInput.focus(); nextInput.setSelectionRange(value.length, value.length); }
            }, 180);
        });
        if (searchInput) searchInput.addEventListener("keydown", function (event) {
            if (event.key !== "Enter" || !state.storeSearch.trim() || !member) return;
            event.preventDefault();
            try { runMemberOperation("recordSearch", { keyword: state.storeSearch.trim() }); } catch (error) {}
            renderStorefront();
        });
        const sortSelect = document.getElementById("storeSort");
        if (sortSelect) { sortSelect.value = state.storeSort; sortSelect.addEventListener("change", function (event) { state.storeSort = event.target.value; renderStorefront(); }); }
        document.querySelectorAll(".category-pill").forEach(function (button) { button.addEventListener("click", function () { state.storeCategory = button.dataset.category; state.storeFilterBrand = "全部品牌"; state.storeView = "home"; state.storeVisible = 16; renderStorefront(); }); });
        enhanceMotion();
        refreshCartBadges();
    }

    function renderDashboard() {
        const data = dataService.snapshot();
        const dashboard = dataService.getDashboard();
        const analysis = dataService.getAnalysis();
        const maxMonth = Math.max.apply(null, analysis.monthlySales.map(function (item) { return item.amount; }).concat([1]));

        const recentRows = dashboard.recentOrders.map(function (order) {
            return `
                <tr>
                    <td><span class="cell-title">${order.id}</span><span class="cell-subtitle">${shortDate(order.date)}</span></td>
                    <td>${escapeHtml(customerName(data, order.customerId))}</td>
                    <td>${order.items.reduce(function (sum, item) { return sum + item.quantity; }, 0)} 件</td>
                    <td><strong>${money(order.total)}</strong></td>
                    <td>${statusBadge(order.status)}</td>
                </tr>`;
        }).join("");

        const lowStockItems = dashboard.lowStock.length ? dashboard.lowStock.map(function (product) {
            return `
                <div class="stock-item">
                    <div><strong>${escapeHtml(product.name)}</strong><span>${product.id} · 预警线 ${product.warningStock} 件</span></div>
                    <div class="stock-count">${product.stock} 件</div>
                </div>`;
        }).join("") : '<div class="empty-state"><strong>库存状态良好</strong>当前没有触发预警的商品</div>';

        const monthBars = analysis.monthlySales.map(function (item) {
            const height = Math.max(4, Math.round(item.amount / maxMonth * 100));
            return `
                <div class="chart-column">
                    <span class="chart-value">${money(item.amount).replace("¥", "")}</span>
                    <div class="bar-wrap"><div class="chart-bar" style="height:${height}%"></div></div>
                    <span class="chart-label">${item.month.slice(5)}月</span>
                </div>`;
        }).join("");

        pageContent.innerHTML = `
            ${heading("经营概览", "", '<button class="secondary-button" data-go="inventory">查看库存</button><button class="primary-button" data-action="new-order">新建订单</button>')}
            ${dashboard.lowStock.length ? `<div class="alert-strip"><div><strong>有 ${dashboard.lowStock.length} 个商品需要关注</strong><span>库存小于或等于预警数量，建议先核对补货安排。</span></div><button class="text-button" data-go="inventory">立即查看 →</button></div>` : ""}
            <section class="stats-grid">
                ${statCard("累计有效销售额", money(dashboard.totalSales), '<span class="positive">仅统计已付款业务状态</span>', "¥", "#e97843", "rgba(233,120,67,.12)")}
                ${statCard("预计毛利润", money(dashboard.grossProfit), "综合毛利率 " + dashboard.grossMargin + "%", "↗", "#70b7a5", "rgba(112,183,165,.12)")}
                ${statCard("有效订单", dashboard.validOrderCount + " 单", "共记录 " + data.orders.length + " 单", "▤", "#b995bd", "rgba(185,149,189,.12)")}
                ${statCard("低库存提醒", dashboard.lowStock.length + " 项", dashboard.lowStock.length ? '<span class="warning">需要及时处理</span>' : '<span class="positive">暂无风险</span>', "!", "#d98b18", "rgba(217,139,24,.12)")}
            </section>
            <section class="dashboard-grid">
                <article class="panel">
                    <div class="panel-header"><div><h3>月度销售走势</h3><p>追踪各月销售额变化</p></div><button class="text-button" data-go="analytics">完整分析 →</button></div>
                    <div class="chart-area">${monthBars}</div>
                </article>
                <article class="panel">
                    <div class="panel-header"><div><h3>低库存清单</h3><p>库存 ≤ 预警数量时自动出现</p></div></div>
                    <div class="stock-list">${lowStockItems}</div>
                </article>
            </section>
            <article class="panel" style="margin-top:18px">
                <div class="panel-header"><div><h3>最近订单</h3><p>用于快速核对订单金额和处理状态</p></div><button class="text-button" data-go="orders">全部订单 →</button></div>
                <div class="table-wrap"><table class="data-table"><thead><tr><th>订单编号</th><th>客户</th><th>商品数量</th><th>订单金额</th><th>状态</th></tr></thead><tbody>${recentRows}</tbody></table></div>
            </article>`;
    }

    function renderProducts() {
        pageContent.innerHTML = `
            ${heading("商品管理", "", '<button class="primary-button" data-action="new-product">＋ 添加商品</button>')}
            <article class="panel">
                <div class="toolbar">
                    <div class="toolbar-group">
                        <div class="search-field"><input id="productSearch" value="${escapeHtml(state.productSearch)}" placeholder="搜索商品编号或名称"></div>
                        <select id="productStatusFilter" aria-label="商品状态"><option>全部状态</option><option>正常销售</option><option>已停用</option></select>
                    </div>
                    <span class="badge badge-blue" id="productCountBadge"></span>
                </div>
                <div class="table-wrap"><table class="data-table"><thead><tr><th>商品 / 规格</th><th>类别</th><th>售价 / 成本</th><th>当前库存</th><th>库存状态</th><th>销售状态</th><th>操作</th></tr></thead><tbody id="productTableBody"></tbody></table></div>
            </article>`;
        document.getElementById("productStatusFilter").value = state.productStatus;
        renderProductRows();
        document.getElementById("productSearch").addEventListener("input", function (event) { state.productSearch = event.target.value; renderProductRows(); });
        document.getElementById("productStatusFilter").addEventListener("change", function (event) { state.productStatus = event.target.value; renderProductRows(); });
    }

    function renderProductRows() {
        const data = dataService.snapshot();
        const keyword = state.productSearch.trim().toLowerCase();
        const products = data.products.filter(function (product) {
            const matchesText = !keyword || product.id.toLowerCase().includes(keyword) || product.name.toLowerCase().includes(keyword);
            const matchesStatus = state.productStatus === "全部状态" || product.status === state.productStatus;
            return matchesText && matchesStatus;
        });
        document.getElementById("productCountBadge").textContent = "显示 " + products.length + " / " + data.products.length + " 种";
        document.getElementById("productTableBody").innerHTML = products.length ? products.map(function (product) {
            return `<tr>
                <td><span class="cell-title">${escapeHtml(product.name)}</span><span class="cell-subtitle">${product.id} · ${escapeHtml(product.spec)}</span></td>
                <td>${escapeHtml(product.category)}</td><td><strong>${money(product.price)}</strong><span class="cell-subtitle">成本 ${money(product.cost)}</span></td>
                <td>${product.stock} 件<span class="cell-subtitle">预警 ${product.warningStock} 件</span></td>
                <td>${lowStockBadge(product)}</td><td>${statusBadge(product.status)}</td>
                <td><button class="table-action" data-action="edit-product" data-id="${product.id}">编辑</button><button class="table-action" data-action="adjust-stock" data-id="${product.id}">调库存</button><button class="table-action danger-link" data-action="toggle-product" data-id="${product.id}">${product.status === "正常销售" ? "停用" : "启用"}</button></td>
            </tr>`;
        }).join("") : emptyRow(7, "可以更换搜索词或状态条件");
    }

    function renderCustomers() {
        pageContent.innerHTML = `
            ${heading("客户管理", "", '<button class="primary-button" data-action="new-customer">＋ 添加客户</button>')}
            <article class="panel">
                <div class="toolbar"><div class="search-field"><input id="customerSearch" value="${escapeHtml(state.customerSearch)}" placeholder="搜索客户编号、姓名或电话"></div><span class="badge badge-blue" id="customerCountBadge"></span></div>
                <div class="table-wrap"><table class="data-table"><thead><tr><th>客户</th><th>联系电话</th><th>地区</th><th>客户类型</th><th>累计订单</th><th>操作</th></tr></thead><tbody id="customerTableBody"></tbody></table></div>
            </article>`;
        renderCustomerRows();
        document.getElementById("customerSearch").addEventListener("input", function (event) { state.customerSearch = event.target.value; renderCustomerRows(); });
    }

    function renderCustomerRows() {
        const data = dataService.snapshot();
        const keyword = state.customerSearch.trim().toLowerCase();
        const customers = data.customers.filter(function (customer) {
            return !keyword || [customer.id, customer.name, customer.phone].some(function (value) { return value.toLowerCase().includes(keyword); });
        });
        document.getElementById("customerCountBadge").textContent = "显示 " + customers.length + " / " + data.customers.length + " 位";
        document.getElementById("customerTableBody").innerHTML = customers.length ? customers.map(function (customer) {
            const orderCount = data.orders.filter(function (order) { return order.customerId === customer.id; }).length;
            return `<tr><td><span class="cell-title">${escapeHtml(customer.name)}</span><span class="cell-subtitle">${customer.id}</span></td><td>${escapeHtml(customer.phone)}</td><td>${escapeHtml(customer.region)}</td><td><span class="badge ${customer.type === "老客户" ? "badge-success" : "badge-blue"}">${customer.type}</span></td><td>${orderCount} 单</td><td><button class="table-action" data-action="edit-customer" data-id="${customer.id}">编辑</button><button class="table-action" data-action="new-order" data-customer="${customer.id}">为他下单</button></td></tr>`;
        }).join("") : emptyRow(6, "可以尝试搜索其他客户信息");
    }

    function renderOrders() {
        pageContent.innerHTML = `
            ${heading("订单管理", "", '<button class="primary-button" data-action="new-order">＋ 新建订单</button>')}
            <article class="panel">
                <div class="toolbar"><div class="toolbar-group"><div class="search-field"><input id="orderSearch" value="${escapeHtml(state.orderSearch)}" placeholder="搜索订单编号或客户姓名"></div><select id="orderStatusFilter"><option>全部状态</option><option>待付款</option><option>待发货</option><option>已发货</option><option>已完成</option><option>退货处理中</option><option>已退款</option><option>已取消</option></select></div><span class="badge badge-blue" id="orderCountBadge"></span></div>
                <div class="table-wrap"><table class="data-table"><thead><tr><th>订单编号</th><th>日期</th><th>客户</th><th>订单内容</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody id="orderTableBody"></tbody></table></div>
            </article>`;
        document.getElementById("orderStatusFilter").value = state.orderStatus;
        renderOrderRows();
        document.getElementById("orderSearch").addEventListener("input", function (event) { state.orderSearch = event.target.value; renderOrderRows(); });
        document.getElementById("orderStatusFilter").addEventListener("change", function (event) { state.orderStatus = event.target.value; renderOrderRows(); });
    }

    function renderOrderRows() {
        const data = dataService.snapshot();
        const keyword = state.orderSearch.trim().toLowerCase();
        const orders = data.orders.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).filter(function (order) {
            const customer = customerName(data, order.customerId).toLowerCase();
            const matchesText = !keyword || order.id.toLowerCase().includes(keyword) || customer.includes(keyword);
            const matchesStatus = state.orderStatus === "全部状态" || order.status === state.orderStatus;
            return matchesText && matchesStatus;
        });
        document.getElementById("orderCountBadge").textContent = "显示 " + orders.length + " / " + data.orders.length + " 单";
        document.getElementById("orderTableBody").innerHTML = orders.length ? orders.map(function (order) {
            const detail = order.items.map(function (item) { return productName(data, item.productId) + " × " + item.quantity; }).join("；");
            let actions = '<span class="cell-subtitle">流程已结束</span>';
            if (order.status === "待付款") actions = `<button class="table-action" data-action="advance-order" data-id="${order.id}">确认付款</button><button class="table-action danger-link" data-action="cancel-order" data-id="${order.id}">取消</button>`;
            if (order.status === "待发货") actions = `<button class="table-action" data-action="advance-order" data-id="${order.id}">确认发货</button><button class="table-action danger-link" data-action="cancel-order" data-id="${order.id}">取消</button>`;
            if (order.status === "已发货") actions = `<button class="table-action" data-action="advance-order" data-id="${order.id}">确认完成</button><button class="table-action" data-action="request-return" data-id="${order.id}">申请退货</button>`;
            if (order.status === "已完成") actions = `<button class="table-action" data-action="request-return" data-id="${order.id}">申请退货</button>`;
            if (order.status === "退货处理中") actions = `<button class="table-action" data-action="complete-refund" data-id="${order.id}">确认退回并退款</button>`;
            return `<tr><td><span class="cell-title">${order.id}</span></td><td>${shortDate(order.date)}</td><td>${escapeHtml(customerName(data, order.customerId))}</td><td><span class="cell-title">${order.items.length} 种商品</span><span class="cell-subtitle">${escapeHtml(detail)}</span></td><td><strong>${money(order.total)}</strong></td><td>${statusBadge(order.status)}</td><td>${actions}</td></tr>`;
        }).join("") : emptyRow(7, "可以更换搜索词或订单状态");
    }

    function renderInventory() {
        const data = dataService.snapshot();
        const lowCount = data.products.filter(function (product) { return product.status === "正常销售" && product.stock <= product.warningStock; }).length;
        const totalStock = data.products.reduce(function (sum, product) { return sum + product.stock; }, 0);
        pageContent.innerHTML = `
            ${heading("库存管理", "", '<button class="primary-button" data-action="adjust-stock">＋ 调整库存</button>')}
            <section class="stats-grid">
                ${statCard("当前总库存", totalStock + " 件", "全部商品库存数量合计", "▦", "#2f6fed", "rgba(47,111,237,.10)")}
                ${statCard("库存预警", lowCount + " 项", lowCount ? '<span class="warning">请安排补货</span>' : '<span class="positive">暂无风险</span>', "!", "#d98b18", "rgba(217,139,24,.12)")}
                ${statCard("本期库存记录", data.stockRecords.length + " 条", "包含订单自动变化记录", "↕", "#0f9f8f", "rgba(15,159,143,.10)")}
                ${statCard("已停用商品", data.products.filter(function (p) { return p.status === "已停用"; }).length + " 种", "历史资料仍然保留", "—", "#7557d9", "rgba(117,87,217,.10)")}
            </section>
            <article class="panel">
                <div class="toolbar"><div class="toolbar-group"><select id="inventoryFilter"><option>全部商品</option><option>只看低库存</option><option>只看正常库存</option></select></div></div>
                <div class="table-wrap"><table class="data-table"><thead><tr><th>商品</th><th>当前库存</th><th>预警数量</th><th>库存状态</th><th>销售状态</th><th>操作</th></tr></thead><tbody id="inventoryTableBody"></tbody></table></div>
            </article>
            <article class="panel" style="margin-top:18px"><div class="panel-header"><div><h3>库存记录</h3></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>记录编号</th><th>商品</th><th>变化类型</th><th>数量变化</th><th>日期</th><th>关联编号</th></tr></thead><tbody>${data.stockRecords.slice(0, 8).map(function (record) { const typeLabel = { "采购入库": "增加库存", "手工入库": "增加库存", "手工出库": "减少库存", "订单出库": "订单扣减" }[record.type] || record.type; return `<tr><td>${record.id}</td><td>${escapeHtml(productName(data, record.productId))}</td><td>${escapeHtml(typeLabel)}</td><td><strong class="${record.quantity > 0 ? "positive" : "danger"}">${record.quantity > 0 ? "+" : ""}${record.quantity}</strong></td><td>${shortDate(record.date)}</td><td>${escapeHtml(record.relatedId)}</td></tr>`; }).join("")}</tbody></table></div></article>`;
        document.getElementById("inventoryFilter").value = state.inventoryMode;
        renderInventoryRows();
        document.getElementById("inventoryFilter").addEventListener("change", function (event) { state.inventoryMode = event.target.value; renderInventoryRows(); });
    }

    function renderInventoryRows() {
        const data = dataService.snapshot();
        const products = data.products.filter(function (product) {
            const low = product.stock <= product.warningStock;
            if (state.inventoryMode === "只看低库存") return low;
            if (state.inventoryMode === "只看正常库存") return !low;
            return true;
        });
        document.getElementById("inventoryTableBody").innerHTML = products.map(function (product) {
            return `<tr><td><span class="cell-title">${escapeHtml(product.name)}</span><span class="cell-subtitle">${product.id} · ${escapeHtml(product.category)}</span></td><td><strong>${product.stock} 件</strong></td><td>${product.warningStock} 件</td><td>${lowStockBadge(product)}</td><td>${statusBadge(product.status)}</td><td><button class="table-action" data-action="adjust-stock" data-id="${product.id}">调整</button></td></tr>`;
        }).join("") || emptyRow(6, "当前筛选条件下没有商品");
    }

    function renderAnalytics() {
        const dashboard = dataService.getDashboard();
        const analysis = dataService.getAnalysis();
        const maxMonth = Math.max.apply(null, analysis.monthlySales.map(function (item) { return item.amount; }).concat([1]));
        const maxCategory = Math.max.apply(null, analysis.categorySales.map(function (item) { return item.amount; }).concat([1]));
        const maxRegion = Math.max.apply(null, analysis.regionSales.map(function (item) { return item.amount; }).concat([1]));
        pageContent.innerHTML = `
            ${heading("经营分析", "", '')}
            <section class="stats-grid">
                ${statCard("有效销售额", money(dashboard.totalSales), "基于全部已付款业务状态", "¥", "#e97843", "rgba(233,120,67,.12)")}
                ${statCard("预计毛利润", money(analysis.grossProfit), "销售额减去商品采购成本", "↗", "#70b7a5", "rgba(112,183,165,.12)")}
                ${statCard("平均订单金额", money(analysis.averageOrderAmount), "有效销售额 ÷ 有效订单数", "÷", "#b995bd", "rgba(185,149,189,.12)")}
                ${statCard("退款金额", money(analysis.refundedAmount), "已完成退款订单合计", "↩", "#e97866", "rgba(233,120,102,.12)")}
            </section>
            <section class="dashboard-grid">
                <article class="panel"><div class="panel-header"><div><h3>月度销售额</h3><p>按订单日期中的月份汇总</p></div></div><div class="chart-area">${analysis.monthlySales.map(function (item) { return `<div class="chart-column"><span class="chart-value">${money(item.amount).replace("¥", "")}</span><div class="bar-wrap"><div class="chart-bar" style="height:${Math.max(4, Math.round(item.amount / maxMonth * 100))}%"></div></div><span class="chart-label">${item.month}</span></div>`; }).join("")}</div></article>
                <article class="panel"><div class="panel-header"><div><h3>类别销售占比</h3><p>金额按商品类别合并</p></div></div><div class="progress-list">${analysis.categorySales.map(function (item) { return `<div><div class="progress-row-header"><strong>${escapeHtml(item.category)}</strong><span>${money(item.amount)}</span></div><div class="progress-track"><div class="progress-fill" style="width:${Math.round(item.amount / maxCategory * 100)}%"></div></div></div>`; }).join("")}</div></article>
            </section>
            <section class="dashboard-grid" style="margin-top:18px">
                <article class="panel"><div class="panel-header"><div><h3>商品销量排行</h3><p>按有效订单中的购买数量排序</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>排名</th><th>商品</th><th>销售数量</th><th>销售金额</th></tr></thead><tbody>${analysis.topProducts.slice(0, 6).map(function (item, index) { return `<tr><td><span class="badge ${index < 3 ? "badge-blue" : "badge-neutral"}">TOP ${index + 1}</span></td><td><span class="cell-title">${escapeHtml(item.name)}</span><span class="cell-subtitle">${item.id}</span></td><td>${item.quantity} 件</td><td><strong>${money(item.amount)}</strong></td></tr>`; }).join("")}</tbody></table></div></article>
                <article class="panel"><div class="panel-header"><div><h3>地区销售概览</h3><p>只按客户地区前两个字做简化汇总</p></div></div><div class="progress-list">${analysis.regionSales.map(function (item) { return `<div><div class="progress-row-header"><strong>${escapeHtml(item.region)}</strong><span>${money(item.amount)}</span></div><div class="progress-track"><div class="progress-fill" style="width:${Math.round(item.amount / maxRegion * 100)}%;background:linear-gradient(90deg,#7557d9,#9b83ea)"></div></div></div>`; }).join("")}</div></article>
            </section>`;
    }

    function renderMarketing() {
        const data = dataService.snapshot(); const promotions = data.promotions || []; const bundles = data.bundles || []; const questions = data.questions || [];
        pageContent.innerHTML = `${heading("营销与问答", "", "")}
            <section class="stats-grid">${statCard("活动总数", promotions.length + " 项", promotions.filter(function (item) { return item.enabled !== false; }).length + " 项进行中", "券", "#e97843", "rgba(233,120,67,.12)")}${statCard("组合购", bundles.length + " 组", bundles.filter(function (item) { return item.enabled !== false; }).length + " 组已启用", "组", "#70b7a5", "rgba(112,183,165,.12)")}${statCard("待回复问答", questions.filter(function (item) { return !item.answer; }).length + " 条", "回复会显示在商品详情", "问", "#b995bd", "rgba(185,149,189,.12)")}</section>
            <section class="dashboard-grid marketing-grid"><article class="panel"><div class="panel-header"><div><h3>会员与促销活动</h3><p>可随时启用或暂停前台活动</p></div></div><div class="campaign-admin-list">${promotions.map(function (promotion) { return `<article><div><strong>${escapeHtml(promotion.name)}</strong><span>${escapeHtml(promotion.type)} · ${escapeHtml(promotion.description)}</span><small>结束时间：${escapeHtml(promotion.endsAt)}</small></div>${statusBadge(promotion.enabled === false ? "已停用" : "正常销售")}<button class="table-action" data-action="toggle-promotion" data-id="${promotion.id}">${promotion.enabled === false ? "启用" : "暂停"}</button></article>`; }).join("")}</div></article>
            <article class="panel"><div class="panel-header"><div><h3>组合购配置</h3><p>结算时由服务器核验组合并计算优惠</p></div></div><div class="campaign-admin-list">${bundles.map(function (bundle) { return `<article><div><strong>${escapeHtml(bundle.name)}</strong><span>${bundle.items.map(function (item) { return escapeHtml(productName(data, item.productId)); }).join(" + ")}</span><small>整组立减 ${money(bundle.discount)}</small></div>${statusBadge(bundle.enabled === false ? "已停用" : "正常销售")}<button class="table-action" data-action="toggle-bundle" data-id="${bundle.id}">${bundle.enabled === false ? "启用" : "暂停"}</button></article>`; }).join("")}</div></article></section>
            <section class="panel" style="margin-top:18px"><div class="panel-header"><div><h3>商品问答</h3><p>用户提问后由商家统一回复</p></div><span class="badge badge-blue">${questions.length} 条</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>商品</th><th>用户问题</th><th>回复状态</th><th>操作</th></tr></thead><tbody>${questions.length ? questions.map(function (question) { return `<tr><td>${escapeHtml(productName(data, question.productId))}</td><td><span class="cell-title">${escapeHtml(question.content)}</span><span class="cell-subtitle">${escapeHtml(question.customerName)} · ${shortDate(question.date)}</span></td><td>${statusBadge(question.answer ? "已回复" : "待回复")}</td><td>${question.answer ? `<span class="cell-subtitle">${escapeHtml(question.answer)}</span>` : `<button class="table-action" data-action="answer-question" data-id="${question.id}">回复</button>`}</td></tr>`; }).join("") : '<tr><td colspan="4"><div class="empty-state"><strong>暂无商品提问</strong>用户可在商品详情中提交问题</div></td></tr>'}</tbody></table></div></section>`;
    }

    function openAnswerQuestion(questionId) {
        const data = dataService.snapshot(); const question = (data.questions || []).find(function (item) { return item.id === questionId; });
        if (!question) { showToast("问题不存在", true); return; }
        openModal({ eyebrow: productName(data, question.productId), title: "回复商品问题", submitText: "发布回复", body: `<div class="form-grid"><div class="field full-span"><label>用户问题</label><p class="form-static">${escapeHtml(question.content)}</p></div><div class="field full-span"><label for="answerContent">商家回复</label><textarea id="answerContent" name="answer" minlength="4" maxlength="300" required placeholder="请准确说明规格、使用或配送信息"></textarea></div></div>`, onSubmit: function (formData) { runMemberOperation("answerQuestion", { questionId: question.id, answer: formData.get("answer") }); closeModal(); renderPage("marketing"); showToast("回复已发布到商品详情"); } });
    }

    function renderPage(page) {
        if (page !== "storefront" && !isAdminAuthenticated()) {
            openAdminLogin();
            return;
        }
        state.page = page;
        document.body.classList.toggle("storefront-mode", page === "storefront");
        document.querySelectorAll(".nav-item").forEach(function (item) { item.classList.toggle("active", item.dataset.page === page); });
        pageTitle.textContent = pageMeta[page][0];
        pageEyebrow.textContent = pageMeta[page][1];
        pageEyebrow.hidden = !pageMeta[page][1];
        document.getElementById("exportBtn").textContent = "导出与打印";
        document.getElementById("quickOrderBtn").textContent = page === "storefront" ? "购物车（" + cartCount() + "）" : "＋ 后台新建订单";
        if (page === "storefront") renderStorefront();
        if (page === "dashboard") renderDashboard();
        if (page === "products") renderProducts();
        if (page === "customers") renderCustomers();
        if (page === "orders") renderOrders();
        if (page === "inventory") renderInventory();
        if (page === "analytics") renderAnalytics();
        if (page === "marketing") renderMarketing();
        if (page !== "storefront") enhanceMotion();
        refreshCartBadges();
        pageContent.focus({ preventScroll: true });
        closeSidebar();
    }

    function openModal(options) {
        modalEyebrow.textContent = options.eyebrow || "";
        modalEyebrow.hidden = !options.eyebrow;
        modalTitle.textContent = options.title;
        modalBody.innerHTML = options.body;
        submitModalBtn.textContent = options.submitText || "保存";
        submitModalBtn.disabled = false;
        modalSubmitHandler = options.onSubmit;
        modalBackdrop.classList.add("open");
        modalBackdrop.setAttribute("aria-hidden", "false");
        const firstInput = modalBody.querySelector("input, select, textarea");
        if (firstInput) setTimeout(function () { firstInput.focus(); }, 30);
        if (typeof options.afterOpen === "function") options.afterOpen();
    }

    function closeModal() {
        modalBackdrop.classList.remove("open");
        modalBackdrop.setAttribute("aria-hidden", "true");
        modalSubmitHandler = null;
        modalBody.onclick = null;
        modalForm.reset();
    }

    function openUserLogin(nextAction) {
        openModal({
            title: "登录悦选",
            submitText: "登录",
            body: `<div class="customer-auth"><div class="merchant-login-mark">悦</div><div class="field"><label for="loginAccount">账号或手机号</label><input id="loginAccount" name="account" autocomplete="username" required></div><div class="field"><label for="loginPassword">登录密码</label><input id="loginPassword" name="password" type="password" autocomplete="current-password" required></div><button type="button" class="auth-switch" data-auth-switch="register">还没有账号？立即注册</button></div>`,
            afterOpen: function () {
                modalBody.onclick = function (event) { if (event.target.closest('[data-auth-switch="register"]')) openUserRegister(nextAction); };
            },
            onSubmit: async function (formData) {
                const loginAccount = String(formData.get("account") || "").trim();
                const password = String(formData.get("password") || "");
                if (!window.serverApi || !window.serverApi.enabled) throw new Error("请双击“启动悦选商城.bat”打开，登录功能需要服务器");
                const response = await window.serverApi.login(loginAccount, password);
                const user = response.user;
                authenticatedRole = user.role;
                if (user.role === "admin") {
                    localStorage.removeItem(MEMBER_KEY);
                    closeModal(); renderPage("dashboard"); showToast("欢迎进入悦选商家中心"); return;
                }
                localStorage.setItem(MEMBER_KEY, user.customerId);
                const member = dataService.snapshot().customers.find(function (customer) { return customer.id === user.customerId; });
                if (!member) throw new Error("账号信息不存在");
                closeModal();
                renderStorefront();
                showToast("登录成功");
                if (typeof nextAction === "function") setTimeout(function () { nextAction(member); }, 50);
            }
        });
    }

    function openUserRegister(nextAction) {
        openModal({
            eyebrow: "CREATE ACCOUNT",
            title: "注册悦选账号",
            submitText: "完成注册",
            body: `<div class="form-grid customer-auth"><div class="field"><label for="registerName">姓名</label><input id="registerName" name="name" maxlength="20" autocomplete="name" required></div><div class="field"><label for="registerPhone">手机号码</label><input id="registerPhone" name="phone" inputmode="numeric" maxlength="11" autocomplete="tel" required></div><div class="field full-span"><label for="registerPassword">设置密码</label><input id="registerPassword" name="password" type="password" minlength="10" maxlength="64" autocomplete="new-password" required>${passwordMeterMarkup("registerPassword")}</div><div class="field"><label for="registerRegion">所在城市</label><input id="registerRegion" name="region" placeholder="例如：广东深圳" required></div><div class="field"><label for="registerInvite">邀请码（选填）</label><input id="registerInvite" name="inviteCode" maxlength="12" placeholder="好友邀请时填写"></div><p class="register-address-note full-span">注册完成后，可在“我的—收货地址”中添加收货信息。</p><button type="button" class="auth-switch full-span" data-auth-switch="login">已有账号？返回登录</button></div>`,
            afterOpen: function () {
                modalBody.onclick = function (event) { if (event.target.closest('[data-auth-switch="login"]')) openUserLogin(nextAction); };
                bindPasswordMeter("registerPassword");
            },
            onSubmit: async function (formData) {
                const values = Object.fromEntries(formData.entries());
                if (!passwordIsStrong(String(values.password || ""))) throw new Error("密码至少 10 位，并包含大写字母、小写字母、数字和特殊字符");
                if (!window.serverApi || !window.serverApi.enabled) throw new Error("请双击“启动悦选商城.bat”打开，注册功能需要服务器");
                const response = await window.serverApi.register({ name: values.name, phone: values.phone, password: values.password, region: values.region, inviteCode: values.inviteCode });
                const customer = response.customer;
                authenticatedRole = "customer";
                localStorage.setItem(MEMBER_KEY, customer.id);
                closeModal();
                renderStorefront();
                showToast("注册成功");
                if (typeof nextAction === "function") setTimeout(function () { nextAction(customer); }, 50);
            }
        });
    }

    function openAccountSettings() {
        const member = requireMember(openAccountSettings);
        if (!member) return;
        openModal({
            eyebrow: "ACCOUNT",
            title: "账户设置",
            submitText: "保存",
            body: `<div class="form-grid"><div class="field"><label for="accountName">姓名</label><input id="accountName" name="name" value="${escapeHtml(member.name)}" required></div><div class="field"><label for="accountPhone">手机号码</label><input id="accountPhone" name="phone" inputmode="numeric" maxlength="11" value="${escapeHtml(member.phone)}" required></div><div class="field full-span"><label for="accountRegion">所在城市</label><input id="accountRegion" name="region" value="${escapeHtml(member.region)}" required></div><div class="field full-span"><label for="accountPassword">新密码</label><input id="accountPassword" name="password" type="password" minlength="10" maxlength="64" autocomplete="new-password" placeholder="不修改请留空">${passwordMeterMarkup("accountPassword")}</div></div>`,
            afterOpen: function () { bindPasswordMeter("accountPassword"); },
            onSubmit: async function (formData) {
                const values = Object.fromEntries(formData.entries());
                const oldPhone = member.phone;
                const updated = dataService.updateCustomer(member.id, { name: values.name, phone: values.phone, region: values.region, type: member.type });
                if (updated.phone !== oldPhone) await window.serverApi.changeAccount(updated.phone);
                if (values.password) {
                    if (!passwordIsStrong(String(values.password))) throw new Error("新密码至少 10 位，并包含大写字母、小写字母、数字和特殊字符");
                    await window.serverApi.changePassword(String(values.password));
                }
                const address = memberAddress(member);
                if (address && address.phone === oldPhone) { address.receiver = updated.name; address.phone = updated.phone; address.region = updated.region; saveMemberAddress(member.id, address); }
                closeModal(); renderStorefront(); showToast("账户信息已保存");
            }
        });
    }

    function openAddressManager(returnToCheckout) {
        const member = requireMember(function () { openAddressManager(returnToCheckout); });
        if (!member) return;
        const address = memberAddress(member);
        openModal({
            eyebrow: "DELIVERY ADDRESS",
            title: "收货地址",
            submitText: "保存地址",
            body: `<div class="form-grid"><div class="field"><label for="addressReceiver">收货人</label><input id="addressReceiver" name="receiver" minlength="2" maxlength="20" value="${escapeHtml(address.receiver)}" required></div><div class="field"><label for="addressPhone">联系电话</label><input id="addressPhone" name="phone" inputmode="numeric" maxlength="11" value="${escapeHtml(address.phone)}" required></div><div class="field full-span"><label for="addressRegion">省市地区</label><input id="addressRegion" name="region" minlength="2" maxlength="60" placeholder="填写省、市或地区" value="${escapeHtml(address.region)}" required></div><div class="field full-span"><label for="addressDetail">详细地址</label><input id="addressDetail" name="detail" minlength="2" maxlength="100" placeholder="填写街道、小区和门牌号" value="${escapeHtml(address.detail)}" required></div></div>`,
            onSubmit: function (formData) {
                const values = Object.fromEntries(formData.entries());
                if (!/^1\d{10}$/.test(String(values.phone))) throw new Error("请输入 11 位手机号码");
                if (String(values.region).trim().length < 2) throw new Error("省市地区至少填写 2 个字符");
                if (String(values.detail).trim().length < 2) throw new Error("详细地址至少填写 2 个字符");
                saveMemberAddress(member.id, { receiver: String(values.receiver).trim(), phone: String(values.phone).trim(), region: String(values.region).trim(), detail: String(values.detail).trim() });
                closeModal(); showToast("收货地址已保存");
                if (returnToCheckout) setTimeout(openCheckoutModal, 50); else renderStorefront();
            }
        });
    }

    function openCoupons() {
        const member = requireMember(openCoupons);
        if (!member) return;
        const coupons = memberCoupons(member.id);
        openModal({
            eyebrow: "COUPONS",
            title: "我的优惠券",
            submitText: "去逛好物",
            body: `<div class="coupon-list">${coupons.length ? coupons.map(function (coupon) { return `<article><strong>${escapeHtml(coupon.value)}</strong><div><h3>${escapeHtml(coupon.name)}</h3><p>${escapeHtml(coupon.condition)}</p></div><span>可使用</span></article>`; }).join("") : '<div class="empty-state"><strong>暂无优惠券</strong>参加活动可以领取更多优惠</div>'}</div>`,
            onSubmit: function () { closeModal(); state.consumerPage = "catalog"; renderStorefront(); }
        });
    }

    function openPromotions() {
        const fallbackCampaigns = [
            { id: "WELCOME10", badge: "新人礼", title: "满99减10元", expires: "领取后30天", status: "login" },
            { id: "MEMBER_SHIP", badge: "会员礼", title: "全场包邮", expires: "领取后30天", status: "login" },
            { id: "WEEKEND20", badge: "周末礼", title: "满199减20元", expires: "领取后7天", status: "login" }
        ];
        const couponState = window.serverApi && window.serverApi.enabled ? window.serverApi.couponState() : { campaigns: fallbackCampaigns };
        const campaigns = couponState.campaigns || fallbackCampaigns;
        const statusText = function (campaign) {
            if (campaign.status === "available") return campaign.auto ? "已自动到账" : "查看卡包";
            if (campaign.status === "used") return "已使用";
            if (campaign.status === "login") return "登录后领取";
            return "立即领取";
        };
        openModal({
            eyebrow: "MEMBER OFFERS",
            title: "优惠活动",
            submitText: "去逛好物",
            body: `<div class="promotion-grid">${campaigns.map(function (campaign) { const inactive = campaign.status === "used"; return `<article><span>${escapeHtml(campaign.badge)}</span><h3>${escapeHtml(campaign.title)}</h3><p>${escapeHtml(campaign.expires || "限时有效")} · 每个账号限领一次</p><button type="button" data-campaign-id="${escapeHtml(campaign.id)}" data-campaign-status="${escapeHtml(campaign.status)}" ${inactive ? "disabled" : ""}>${statusText(campaign)}</button></article>`; }).join("")}</div>`,
            afterOpen: function () {
                modalBody.onclick = function (event) {
                    const button = event.target.closest("[data-campaign-id]");
                    if (!button) return;
                    const member = currentMember(dataService.snapshot());
                    if (!member) { closeModal(); setTimeout(function () { openUserLogin(openPromotions); }, 30); return; }
                    if (button.dataset.campaignStatus === "available") { closeModal(); setTimeout(openCoupons, 30); return; }
                    if (!window.serverApi || !window.serverApi.enabled) { showToast("请通过商城服务器领取优惠券", true); return; }
                    try {
                        window.serverApi.claimCoupon(button.dataset.campaignId);
                        button.textContent = "查看卡包"; button.dataset.campaignStatus = "available"; showToast("优惠券已放入卡包");
                    } catch (error) { showToast(error.message, true); }
                };
            },
            onSubmit: function () { closeModal(); state.consumerPage = "catalog"; renderStorefront(); }
        });
    }

    function openHelpCenter() {
        openModal({ eyebrow: "HELP", title: "帮助中心", submitText: "联系客服", body: `<div class="faq-list"><details open><summary>如何修改收货地址？</summary><p>进入“我的—收货地址”，修改后点击保存。</p></details><details><summary>订单什么时候发货？</summary><p>付款后通常会在 24 小时内发出，可在订单助手查看状态。</p></details><details><summary>如何申请售后？</summary><p>在“我的订单”中选择已完成订单，点击申请售后。</p></details><details><summary>积分有什么用途？</summary><p>购物可获得积分，积分可兑换优惠券和会员礼遇。</p></details></div>`, onSubmit: function () { closeModal(); setTimeout(openCustomerService, 30); } });
    }

    function openCustomerService() {
        const history = [];
        openModal({
            eyebrow: "CUSTOMER SERVICE",
            title: "悦选客服",
            submitText: "结束咨询",
            body: `<div class="service-chat"><div class="service-assistant-status"><span></span><strong>账户感知客服</strong><small id="serviceMode">已连接商城数据</small></div><div id="serviceMessages" class="service-messages"><p class="service-reply">您好，我是悦选客服。商品、配送、积分、优惠和售后都可以问我，也可以直接和我打招呼。</p></div><div class="service-compose"><input id="serviceInput" type="text" placeholder="请输入您的问题"><button type="button" id="serviceSend">发送</button></div></div>`,
            afterOpen: function () {
                const input = document.getElementById("serviceInput");
                const sendButton = document.getElementById("serviceSend");
                const send = async function () {
                    const text = input.value.trim(); if (!text) return;
                    const box = document.getElementById("serviceMessages");
                    box.insertAdjacentHTML("beforeend", `<p class="service-user">${escapeHtml(text)}</p><p class="service-reply service-thinking">正在查询与你问题相关的信息…</p>`);
                    input.value = ""; input.disabled = true; sendButton.disabled = true; box.scrollTop = box.scrollHeight;
                    const thinking = box.querySelector(".service-thinking:last-child");
                    try {
                        if (!window.serverApi || !window.serverApi.enabled) throw new Error("客服需要通过商城服务器运行");
                        const response = await window.serverApi.support(text, history.slice(-8));
                        thinking.textContent = response.answer;
                        thinking.classList.remove("service-thinking");
                        const mode = document.getElementById("serviceMode");
                        if (mode) mode.textContent = response.mode === "cloud-ai" ? "云端 AI 已接入" : response.mode === "local-ai" ? "本地 AI 已接入" : "已连接商城数据";
                        history.push({ role: "user", content: text }, { role: "assistant", content: response.answer });
                    } catch (error) {
                        thinking.textContent = error.message || "当前暂时无法连接客服，请稍后再试。";
                        thinking.classList.remove("service-thinking");
                    } finally {
                        input.disabled = false; sendButton.disabled = false; input.focus(); box.scrollTop = box.scrollHeight;
                    }
                };
                sendButton.addEventListener("click", send);
                input.addEventListener("keydown", function (event) { if (event.key === "Enter") { event.preventDefault(); send(); } });
            },
            onSubmit: closeModal
        });
    }

    function openAdminLogin() {
        openUserLogin();
    }

    function openFavorites() {
        state.storeView = "favorites";
        state.storeCategory = "全部分类";
        state.storeSearch = "";
        renderStorefront();
        setTimeout(function () { const target = document.getElementById("productSection"); if (target) target.scrollIntoView({ behavior: "smooth" }); }, 20);
    }

    function openBrowsingHistory() {
        const member = requireMember(openBrowsingHistory); if (!member) return;
        const data = dataService.snapshot(); const ids = profileSnapshot().features.history || [];
        const products = ids.map(function (id) { return data.products.find(function (item) { return item.id === id; }); }).filter(Boolean);
        openModal({
            eyebrow: "RECENTLY VIEWED", title: "浏览足迹", submitText: "继续逛逛",
            body: `<div class="feature-list">${products.length ? products.map(function (product) { return `<button type="button" data-history-product="${product.id}"><img src="${productImage(product.id)}" alt=""><span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.spec)}</small></span><b>${money(product.price)}</b></button>`; }).join("") : '<div class="empty-state"><strong>还没有浏览记录</strong>查看商品详情后会自动保留最近20件足迹</div>'}</div>`,
            afterOpen: function () { modalBody.onclick = function (event) { const button = event.target.closest("[data-history-product]"); if (!button) return; closeModal(); setTimeout(function () { openProductDetail(button.dataset.historyProduct); }, 30); }; },
            onSubmit: function () { closeModal(); state.consumerPage = "catalog"; renderStorefront(); }
        });
    }

    function openProductCompare() {
        const member = requireMember(openProductCompare); if (!member) return;
        const data = dataService.snapshot(); const ids = profileSnapshot().features.compare || [];
        const products = ids.map(function (id) { return data.products.find(function (item) { return item.id === id; }); }).filter(Boolean);
        openModal({
            eyebrow: "PRODUCT COMPARISON", title: "商品对比", submitText: "去选商品",
            body: products.length ? `<div class="compare-toolbar"><span>已选择 ${products.length} 件商品</span><button type="button" data-clear-compare>一键清空</button></div><div class="compare-table" style="--compare-count:${products.length}"><div class="compare-row head"><span>对比项</span>${products.map(function (product) { return `<strong><img src="${productImage(product.id)}" alt="${escapeHtml(product.name)}">${escapeHtml(product.name)}<button type="button" data-remove-compare="${product.id}">移除</button></strong>`; }).join("")}</div><div class="compare-row"><span>价格</span>${products.map(function (product) { return `<b>${money(product.price)}</b>`; }).join("")}</div><div class="compare-row"><span>规格</span>${products.map(function (product) { return `<p>${escapeHtml(product.spec)}</p>`; }).join("")}</div><div class="compare-row"><span>库存</span>${products.map(function (product) { return `<p>${product.stock > 0 ? "现货 " + product.stock + " 件" : "暂时售罄"}</p>`; }).join("")}</div><div class="compare-row"><span>服务</span>${products.map(function () { return "<p>7天无理由<br>购物返积分</p>"; }).join("")}</div></div>` : '<div class="empty-state"><strong>还没有对比商品</strong>在商品卡片点击“＋ 对比”，最多同时加入4件</div>',
            afterOpen: function () { modalBody.onclick = function (event) { const clearButton = event.target.closest("[data-clear-compare]"); if (clearButton) { try { runMemberOperation("clearCompare", {}); showToast("对比商品已全部清空"); openProductCompare(); } catch (error) { showToast(error.message, true); } return; } const button = event.target.closest("[data-remove-compare]"); if (!button) return; try { runMemberOperation("toggleCompare", { productId: button.dataset.removeCompare }); openProductCompare(); } catch (error) { showToast(error.message, true); } }; },
            onSubmit: function () { closeModal(); state.consumerPage = "catalog"; renderStorefront(); }
        });
    }

    function openProductAlerts() {
        const member = requireMember(openProductAlerts); if (!member) return;
        const data = dataService.snapshot(); const alerts = profileSnapshot().features.alerts || [];
        openModal({
            eyebrow: "PRICE & STOCK ALERTS", title: "降价 / 补货提醒", submitText: "完成",
            body: `<div class="feature-list">${alerts.length ? alerts.map(function (alert) { const product = data.products.find(function (item) { return item.id === alert.productId; }); if (!product) return ""; const changed = alert.priceDropped ? `已降价 ${money(Number(alert.watchedPrice) - Number(alert.currentPrice))}` : alert.restocked ? "已经补货" : "持续关注中"; return `<article><img src="${productImage(product.id)}" alt=""><span><strong>${escapeHtml(product.name)}</strong><small>关注价 ${money(alert.watchedPrice)} · 现价 ${money(alert.currentPrice)}</small></span><b>${changed}</b><button type="button" data-remove-alert="${product.id}">取消提醒</button></article>`; }).join("") : '<div class="empty-state"><strong>暂无商品提醒</strong>可在商品详情关注降价或补货</div>'}</div>`,
            afterOpen: function () { modalBody.onclick = function (event) { const button = event.target.closest("[data-remove-alert]"); if (!button) return; try { runMemberOperation("toggleProductAlert", { productId: button.dataset.removeAlert }); openProductAlerts(); } catch (error) { showToast(error.message, true); } }; }, onSubmit: closeModal
        });
    }

    function openInviteFriends() {
        const member = requireMember(openInviteFriends); if (!member) return;
        const code = profileSnapshot().features.inviteCode || "";
        openModal({
            eyebrow: "REFER A FRIEND", title: "邀请有礼", submitText: "完成",
            body: `<section class="invite-card"><span>你的专属邀请码</span><strong>${escapeHtml(code)}</strong><button type="button" class="secondary-button" data-copy-invite>复制邀请码</button><div><p><b>好友</b>注册时填写邀请码，完成首笔模拟支付后得 100 积分</p><p><b>你</b>在好友完成首笔模拟支付后得 300 积分</p></div><small>同一新账号仅奖励一次；退款不会重复发放邀请奖励。</small></section>`,
            afterOpen: function () { modalBody.onclick = function (event) { if (!event.target.closest("[data-copy-invite]")) return; if (navigator.clipboard) navigator.clipboard.writeText(code).catch(function () {}); showToast("邀请码已复制"); }; }, onSubmit: closeModal
        });
    }

    function openSmartFilters() {
        const data = dataService.snapshot();
        const source = data.products.filter(function (product) { return product.status === "正常销售" && (state.storeCategory === "全部分类" || product.category === state.storeCategory); });
        const brands = ["全部品牌"].concat(Array.from(new Set(source.map(productBrand))).sort());
        openModal({
            eyebrow: "SMART FILTER", title: "多属性智能筛选", submitText: "查看结果",
            body: `<div class="smart-filter-form"><div class="field"><label for="filterBrand">品牌</label><select id="filterBrand" name="brand">${brands.map(function (brand) { return `<option>${escapeHtml(brand)}</option>`; }).join("")}</select></div><div class="field"><label for="filterPrice">价格区间</label><select id="filterPrice" name="price"><option>全部价格</option><option>100元以下</option><option>100—499元</option><option>500—1999元</option><option>2000元以上</option></select></div><div class="field"><label for="filterStock">库存状态</label><select id="filterStock" name="stock"><option>全部库存</option><option>现货</option><option>库存充足</option><option>库存紧张</option></select></div></div>`,
            afterOpen: function () { document.getElementById("filterBrand").value = brands.indexOf(state.storeFilterBrand) >= 0 ? state.storeFilterBrand : "全部品牌"; document.getElementById("filterPrice").value = state.storeFilterPrice; document.getElementById("filterStock").value = state.storeFilterStock; },
            onSubmit: function (formData) { state.storeFilterBrand = String(formData.get("brand")); state.storeFilterPrice = String(formData.get("price")); state.storeFilterStock = String(formData.get("stock")); state.storeVisible = 16; closeModal(); state.consumerPage = "catalog"; renderStorefront(); }
        });
    }

    function openShoppingAdvisor() {
        const data = dataService.snapshot();
        const categories = Array.from(new Set(data.products.filter(function (product) { return product.status === "正常销售"; }).map(function (product) { return product.category; }))).sort();
        openModal({
            eyebrow: "SHOPPING ADVISOR", title: "帮我选", submitText: "生成推荐",
            body: `<section class="advisor-intro"><strong>告诉我你的购物目标</strong><span>根据品类、预算、偏好和当前库存筛选合适商品。</span></section><div class="form-grid"><div class="field"><label for="advisorCategory">想买什么</label><select id="advisorCategory" name="category">${categories.map(function (category) { return `<option>${escapeHtml(category)}</option>`; }).join("")}</select></div><div class="field"><label for="advisorBudget">最高预算</label><input id="advisorBudget" name="budget" type="number" min="10" max="500000" value="1000" required></div><div class="field full-span"><label for="advisorPreference">更看重</label><select id="advisorPreference" name="preference"><option>性价比</option><option>价格优先</option><option>品质优先</option><option>库存优先</option></select></div></div>`,
            onSubmit: function (formData) {
                const category = String(formData.get("category")); const budget = Number(formData.get("budget")); const preference = String(formData.get("preference"));
                if (!Number.isFinite(budget) || budget <= 0) throw new Error("请输入正确预算");
                const profile = currentMember(dataService.snapshot()) ? profileSnapshot() : { features: { history: [] } }; const history = profile.features.history || [];
                const recommendations = data.products.filter(function (product) { return product.status === "正常销售" && product.stock > 0 && product.category === category && product.price <= budget; }).map(function (product) {
                    let score = history.indexOf(product.id) >= 0 ? 20 : 0;
                    if (preference === "价格优先") score += Math.max(0, 100 - product.price / Math.max(1, budget) * 100);
                    if (preference === "品质优先") score += product.price / Math.max(1, budget) * 80;
                    if (preference === "库存优先") score += product.stock;
                    if (preference === "性价比") score += (budget - product.price) / Math.max(1, budget) * 45 + Math.min(product.stock, 40);
                    return { product: product, score: score };
                }).sort(function (a, b) { return b.score - a.score; }).slice(0, 3);
                openModal({
                    eyebrow: category, title: "为你推荐", submitText: "继续逛逛",
                    body: recommendations.length ? `<div class="advisor-results">${recommendations.map(function (entry, index) { const product = entry.product; const reason = index === 0 ? "综合匹配度最高" : preference === "价格优先" ? "预算内价格更轻松" : preference === "库存优先" ? "库存充足，发货更稳" : preference === "品质优先" ? "预算内配置更高" : "价格与库存更均衡"; return `<article class="advisor-card ${index === 0 ? "best" : ""}"><span>${index === 0 ? "最适合" : "备选 " + (index + 1)}</span><img src="${productImage(product.id)}" alt="${escapeHtml(product.name)}"><div><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.spec)}</p><small>${reason}</small><strong>${money(product.price)}</strong></div><button type="button" data-advisor-detail="${product.id}">看详情</button><button type="button" data-advisor-cart="${product.id}">加入购物车</button></article>`; }).join("")}</div>` : `<div class="empty-state"><strong>预算内暂时没有合适商品</strong>提高预算或换一个品类再试试</div>`,
                    afterOpen: function () { modalBody.onclick = function (event) { const detail = event.target.closest("[data-advisor-detail]"); const cart = event.target.closest("[data-advisor-cart]"); if (detail) { closeModal(); setTimeout(function () { openProductDetail(detail.dataset.advisorDetail); }, 30); } if (cart) { try { addToCart(cart.dataset.advisorCart, 1); showToast("推荐商品已加入购物车"); } catch (error) { showToast(error.message, true); } } }; },
                    onSubmit: function () { closeModal(); state.consumerPage = "catalog"; renderStorefront(); }
                });
            }
        });
    }

    function openPriceDeals() {
        const data = dataService.snapshot(); const member = currentMember(data); const profile = member ? profileSnapshot() : { features: { history: [] } }; const favorites = loadFavorites();
        const deals = data.products.filter(function (product) { return product.status === "正常销售" && product.stock > 0; }).map(function (product) {
            const history = (data.priceHistory || []).filter(function (item) { return item.productId === product.id; }).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
            const highest = Math.max.apply(null, history.map(function (item) { return Number(item.price); }).concat([Number(product.price)]));
            const saving = Math.max(0, highest - Number(product.price));
            const personal = favorites.indexOf(product.id) >= 0 ? "收藏商品好价" : (profile.features.history || []).indexOf(product.id) >= 0 ? "浏览过的商品" : "全店价格推荐";
            return { product: product, history: history, highest: highest, saving: saving, personal: personal, score: saving + (favorites.indexOf(product.id) >= 0 ? 10000 : 0) + ((profile.features.history || []).indexOf(product.id) >= 0 ? 5000 : 0) };
        }).sort(function (a, b) { return b.score - a.score; }).slice(0, 8);
        openModal({
            eyebrow: "PRICE INSIGHTS", title: "价格历史与个性化优惠", submitText: "完成",
            body: `<div class="deal-grid">${deals.map(function (deal) { const product = deal.product; return `<article class="deal-card"><img src="${productImage(product.id)}" alt="${escapeHtml(product.name)}"><div><span>${escapeHtml(deal.personal)}</span><h3>${escapeHtml(product.name)}</h3><p>${deal.saving > 0 ? "较近90天高点省 " + money(deal.saving) : "当前价格稳定"}</p><div class="price-history-bars">${deal.history.slice(-4).map(function (point) { const height = Math.max(22, Math.round(Number(point.price) / Math.max(1, deal.highest) * 70)); return `<i style="height:${height}px" title="${shortDate(point.date)} ${money(point.price)}"></i>`; }).join("")}</div><strong>${money(product.price)}</strong></div><button type="button" data-deal-detail="${product.id}">查看详情</button><button type="button" data-deal-cart="${product.id}">加入购物车</button></article>`; }).join("")}</div>`,
            afterOpen: function () { modalBody.onclick = function (event) { const detail = event.target.closest("[data-deal-detail]"); const cart = event.target.closest("[data-deal-cart]"); if (detail) { closeModal(); setTimeout(function () { openProductDetail(detail.dataset.dealDetail); }, 30); } if (cart) { try { addToCart(cart.dataset.dealCart, 1); showToast("商品已加入购物车"); } catch (error) { showToast(error.message, true); } } }; }, onSubmit: closeModal
        });
    }

    function openSubscriptionManager(selectedProductId) {
        const member = requireMember(function () { openSubscriptionManager(selectedProductId); }); if (!member) return;
        const data = dataService.snapshot(); const eligibleCategories = ["食品生鲜", "美妆个护", "商超百货", "厨房用品"];
        const products = data.products.filter(function (product) { return product.status === "正常销售" && product.stock > 0 && eligibleCategories.indexOf(product.category) >= 0; });
        const subscriptions = (data.subscriptions || []).filter(function (item) { return item.customerId === member.id; });
        const statusText = { active: "进行中", paused: "已暂停", cancelled: "已取消" };
        openModal({
            eyebrow: "AUTO REPLENISH", title: "周期购 / 自动补货", submitText: "创建周期购",
            body: `<div class="subscription-create"><div class="field"><label for="subscriptionProduct">补货商品</label><select id="subscriptionProduct" name="productId">${products.map(function (product) { return `<option value="${product.id}">${escapeHtml(product.name)} · ${money(product.price)}</option>`; }).join("")}</select></div><div class="field"><label for="subscriptionInterval">配送周期</label><select id="subscriptionInterval" name="intervalDays"><option value="14">每2周</option><option value="30" selected>每月</option><option value="60">每2个月</option><option value="90">每3个月</option></select></div><div class="field"><label for="subscriptionQuantity">每期数量</label><input id="subscriptionQuantity" name="quantity" type="number" min="1" max="10" value="1" required></div></div><section class="subscription-list"><header><h3>我的补货计划</h3><span>${subscriptions.filter(function (item) { return item.status !== "cancelled"; }).length} 个</span></header>${subscriptions.length ? subscriptions.map(function (item) { const product = data.products.find(function (entry) { return entry.id === item.productId; }); return `<article data-subscription-id="${item.id}"><img src="${productImage(item.productId)}" alt=""><div><strong>${escapeHtml(product ? product.name : "商品")}</strong><p>每 ${item.intervalDays} 天 ${item.quantity} 件 · 下次 ${shortDate(item.nextDelivery)}</p><span class="subscription-status ${item.status}">${statusText[item.status] || item.status}</span></div>${item.status !== "cancelled" ? `<button type="button" data-subscription-action="toggle" data-id="${item.id}">${item.status === "active" ? "暂停" : "恢复"}</button>${item.status === "active" ? `<button type="button" data-subscription-action="skip" data-id="${item.id}">跳过本期</button>` : ""}<button type="button" data-subscription-action="cancel" data-id="${item.id}">取消计划</button>` : ""}</article>`; }).join("") : '<div class="empty-state"><strong>还没有补货计划</strong>选择常用消耗品和配送周期即可创建</div>'}</section>`,
            afterOpen: function () { const select = document.getElementById("subscriptionProduct"); if (select && products.some(function (product) { return product.id === selectedProductId; })) select.value = selectedProductId; modalBody.onclick = function (event) { const button = event.target.closest("[data-subscription-action]"); if (!button) return; try { const action = button.dataset.subscriptionAction; if (action === "toggle") runMemberOperation("toggleSubscription", { subscriptionId: button.dataset.id }); if (action === "skip") runMemberOperation("skipSubscription", { subscriptionId: button.dataset.id }); if (action === "cancel" && window.confirm("确定取消这个周期购计划吗？")) runMemberOperation("cancelSubscription", { subscriptionId: button.dataset.id }); showToast("周期购计划已更新"); openSubscriptionManager(); } catch (error) { showToast(error.message, true); } }; },
            onSubmit: function (formData) { runMemberOperation("createSubscription", { productId: String(formData.get("productId")), intervalDays: Number(formData.get("intervalDays")), quantity: Number(formData.get("quantity")) }); showToast("周期购计划创建成功"); openSubscriptionManager(); }
        });
    }

    function openMyQuestions() {
        const member = requireMember(openMyQuestions); if (!member) return;
        const data = dataService.snapshot(); const questions = (data.questions || []).filter(function (item) { return item.customerId === member.id; });
        openModal({
            eyebrow: "MY QUESTIONS", title: "我的提问", submitText: "完成",
            body: `<div class="my-question-list">${questions.length ? questions.map(function (question) { return `<article><div><span>${escapeHtml(productName(data, question.productId))}</span><small>${shortDate(question.date)}</small></div><p><b>问</b>${escapeHtml(question.content)}</p>${question.answer ? `<p class="answered"><b>答</b>${escapeHtml(question.answer)}<small>${shortDate(question.answeredAt)} 商家回复</small></p>` : '<p class="pending">等待商家回复</p>'}<button type="button" data-question-product="${question.productId}">查看商品</button></article>`; }).join("") : '<div class="empty-state"><strong>还没有提问</strong>可在商品详情向商家咨询规格、配送和使用问题</div>'}</div>`,
            afterOpen: function () { modalBody.onclick = function (event) { const button = event.target.closest("[data-question-product]"); if (!button) return; closeModal(); setTimeout(function () { openProductDetail(button.dataset.questionProduct); }, 30); }; }, onSubmit: closeModal
        });
    }

    function openMemberCenter() {
        const data = dataService.snapshot();
        const member = requireMember(openMemberCenter);
        if (!member) return;
        const orders = data.orders.filter(function (order) { return order.customerId === member.id; });
        const records = (data.pointRecords || []).filter(function (record) { return record.customerId === member.id; }).slice(0, 5);
        openModal({
            eyebrow: "YUEXUAN MEMBER",
            title: "会员中心",
            submitText: "去积分商城",
            body: `<section class="member-card"><div><span>悦享会员</span><h3>${escapeHtml(member.name)}</h3><p>${escapeHtml(member.phone.slice(0, 3) + "****" + member.phone.slice(-4))}</p></div><div><strong>${member.points || 0}</strong><span>可用积分</span></div></section>
                <div class="member-stat-grid"><div><strong>${orders.length}</strong><span>全部订单</span></div><div><strong>${loadFavorites().length}</strong><span>收藏商品</span></div><div><strong>4</strong><span>会员权益</span></div></div>
                <div class="benefit-grid"><div>会员专享价</div><div>购物返积分</div><div>生日礼遇</div><div>售后优先</div></div>
                <div class="points-records"><h4>积分明细</h4>${records.length ? records.map(function (record) { return `<div><span>${escapeHtml(record.type)}<small>${shortDate(record.date)}</small></span><strong class="${record.points > 0 ? "positive" : ""}">${record.points > 0 ? "+" : ""}${record.points}</strong></div>`; }).join("") : "<p>暂无积分记录</p>"}</div>`,
            onSubmit: function () { closeModal(); setTimeout(openPointsMall, 30); }
        });
    }

    function openPointsMall() {
        const data = dataService.snapshot();
        const member = requireMember(openPointsMall);
        if (!member) return;
        let loyalty = null;
        if (window.serverApi && window.serverApi.enabled) {
            try { loyalty = window.serverApi.profile().loyalty; } catch (error) { showToast(error.message, true); }
        }
        loyalty = loyalty || { balance: Number(member.points || 0), lifetimePoints: Number(member.points || 0), tier: "悦享会员", nextTier: { name: "银卡会员", threshold: 2000, remaining: Math.max(0, 2000 - Number(member.points || 0)) }, checkedInToday: false, streak: 0, checkInRewards: [10, 10, 15, 15, 20, 20, 30], rewards: pointRewards, records: (data.pointRecords || []).filter(function (record) { return record.customerId === member.id; }).slice(0, 10), tasks: [], expiringSoon: 0, pointsRule: "积分自获得之日起365天有效", repair: { eligible: false, cost: 50 }, birthday: "", birthdayGiftAvailable: false, inviteCode: "" };
        const rewards = loyalty.rewards || pointRewards;
        const cycleProgress = loyalty.streak ? (Number(loyalty.streak) - 1) % 7 + 1 : 0;
        const tierProgress = loyalty.nextTier ? Math.min(100, Math.round(Number(loyalty.lifetimePoints || 0) / Number(loyalty.nextTier.threshold || 1) * 100)) : 100;
        openModal({
            eyebrow: "MEMBER REWARDS",
            title: "积分商城",
            submitText: "完成",
            body: `<section class="loyalty-overview"><div class="points-balance"><div><span>可用积分</span><strong>${loyalty.balance}</strong></div><div><span>${escapeHtml(loyalty.tier)}</span><small>累计获得 ${loyalty.lifetimePoints} 积分</small></div></div><div class="tier-progress"><span style="width:${tierProgress}%"></span></div><p>${loyalty.nextTier ? `再累计 ${loyalty.nextTier.remaining} 积分升级为${escapeHtml(loyalty.nextTier.name)}` : "已达到当前最高会员等级"}</p><div class="points-expiry"><strong>${Number(loyalty.expiringSoon || 0)} 积分将在30天内到期</strong><span>${escapeHtml(loyalty.pointsRule || "积分自获得之日起365天有效")}</span></div></section>
                <section class="checkin-card"><header><div><span>DAILY CHECK-IN</span><h3>每日签到</h3><p>连续签到，第7天可得30积分</p></div><div class="checkin-actions"><button type="button" class="secondary-button" data-loyalty-action="repair" ${loyalty.repair && loyalty.repair.eligible && loyalty.balance >= loyalty.repair.cost ? "" : "disabled"}>补签（50积分）</button><button type="button" class="primary-button" data-loyalty-action="checkin" ${loyalty.checkedInToday ? "disabled" : ""}>${loyalty.checkedInToday ? "今日已签到" : "签到领积分"}</button></div></header><div class="checkin-days">${loyalty.checkInRewards.map(function (points, index) { return `<span class="${index < cycleProgress ? "active" : ""}"><b>第${index + 1}天</b><small>+${points}</small></span>`; }).join("")}</div></section>
                <section class="loyalty-task-section"><header><div><span>GROWTH TASKS</span><h3>成长任务</h3></div><small>每项奖励仅领一次</small></header><div class="task-grid">${(loyalty.tasks || []).map(function (task) { return `<article><span>${task.claimed ? "✓" : task.ready ? "+" + task.points : "○"}</span><div><strong>${escapeHtml(task.name)}</strong><small>${escapeHtml(task.description)}</small></div><button type="button" data-task-id="${task.id}" ${task.claimed || !task.ready ? "disabled" : ""}>${task.claimed ? "已领取" : task.ready ? "领取" : "去完成"}</button></article>`; }).join("") || "<p>暂无成长任务</p>"}</div></section>
                <section class="birthday-benefit"><div><span>BIRTHDAY GIFT</span><h3>生日礼遇</h3><p>生日当天可领取 200 积分与 30 元专属券。</p><small>可输入 02-25、2.25、2/25 或 2月25日</small></div><input id="birthdayValue" type="text" inputmode="numeric" maxlength="10" placeholder="例如 2.25" value="${escapeHtml(loyalty.birthday || "")}" ${loyalty.birthday ? "disabled" : ""}><button type="button" data-loyalty-action="birthday-save" ${loyalty.birthday ? "disabled" : ""}>保存生日</button><button type="button" class="primary-button" data-loyalty-action="birthday-claim" ${loyalty.birthdayGiftAvailable ? "" : "disabled"}>领取生日礼</button></section>
                <section class="points-rule-strip"><div><strong>邀请有礼</strong><span>邀请码 ${escapeHtml(loyalty.inviteCode || "--")}</span></div><div><strong>购物返积分</strong><span>按实付金额累计</span></div><div><strong>限时兑换</strong><span>活动礼品享积分折扣</span></div></section>
                <div class="reward-section-head"><div><span>REWARDS</span><h3>积分好礼</h3></div><small>优惠券与实物礼品</small></div><div class="reward-grid">${rewards.map(function (reward) { const canAfford = Number(loyalty.balance) >= Number(reward.points); const available = reward.available !== false; const soldOut = reward.stock === 0; const note = reward.condition || reward.note || "悦选会员礼遇"; const buttonText = !available ? (soldOut ? "暂时缺货" : "已达兑换上限") : canAfford ? `${reward.points} 积分兑换` : `还差 ${reward.points - Number(loyalty.balance)} 积分`; return `<article class="reward-card ${reward.kind === "product" ? "physical" : ""}">${reward.flashSale ? `<em>限时省 ${Number(reward.originalPoints) - Number(reward.points)} 积分</em>` : ""}${reward.kind === "product" && reward.productId ? `<img src="${productImage(reward.productId)}" alt="${escapeHtml(reward.name)}">` : ""}<span>${escapeHtml(reward.category || "悦选礼遇")}</span><h3>${escapeHtml(reward.name)}</h3><p>${escapeHtml(note)}</p><small>${reward.flashSale ? `<s>${reward.originalPoints}积分</s> · ` : ""}每个账号限兑 ${reward.limit || 1} 次${reward.remaining != null ? ` · 剩余 ${reward.remaining} 次` : ""}</small><button type="button" class="primary-button" data-reward-id="${reward.id}" ${!available || !canAfford ? "disabled" : ""}>${buttonText}</button></article>`; }).join("")}</div>
                <section class="points-history"><header><h3>积分明细</h3><span>最近20条</span></header>${(loyalty.records || []).length ? loyalty.records.map(function (record) { return `<div><span>${escapeHtml(record.type)}<small>${shortDate(record.date)}</small></span><strong class="${record.points > 0 ? "positive" : ""}">${record.points > 0 ? "+" : ""}${record.points}</strong></div>`; }).join("") : "<p>完成签到或购物后，这里会显示积分记录。</p>"}</section>`,
            afterOpen: function () {
                modalBody.onclick = function (event) {
                    const loyaltyAction = event.target.closest("[data-loyalty-action]");
                    if (loyaltyAction) {
                        try {
                            const action = loyaltyAction.dataset.loyaltyAction;
                            if (action === "checkin") { const result = runMemberOperation("dailyCheckIn", { customerId: member.id }); showToast("签到成功，获得 " + Number(result.points || 10) + " 积分"); }
                            if (action === "repair") { runMemberOperation("repairCheckIn", { customerId: member.id }); showToast("昨日签到已补签，连续天数已恢复"); }
                            if (action === "birthday-save") { runMemberOperation("saveBirthday", { birthday: document.getElementById("birthdayValue").value }); showToast("生日信息已保存"); }
                            if (action === "birthday-claim") { runMemberOperation("claimBirthdayGift", { customerId: member.id }); showToast("生日礼已发放到积分与优惠券卡包"); }
                            closeModal(); setTimeout(openPointsMall, 30);
                        } catch (error) { showToast(error.message, true); }
                        return;
                    }
                    const taskButton = event.target.closest("[data-task-id]");
                    if (taskButton) {
                        try { const taskResult = runMemberOperation("claimTask", { taskId: taskButton.dataset.taskId }); showToast("任务奖励 +" + taskResult.task.points + " 积分"); closeModal(); setTimeout(openPointsMall, 30); }
                        catch (error) { showToast(error.message, true); }
                        return;
                    }
                    const button = event.target.closest("[data-reward-id]");
                    if (!button) return;
                    const reward = rewards.find(function (item) { return item.id === button.dataset.rewardId; });
                    if (!reward) return;
                    try {
                        const latestMember = currentMember(dataService.snapshot());
                        if (!latestMember || latestMember.points < reward.points) { showToast("还差 " + (reward.points - Number(latestMember ? latestMember.points : 0)) + " 积分", true); return; }
                        let exchange = null;
                        if (window.serverApi && window.serverApi.enabled) {
                            exchange = window.serverApi.operation("redeemReward", { customerId: member.id, rewardId: reward.id }).result;
                        } else {
                            dataService.changePoints(member.id, -reward.points, "兑换" + reward.name, reward.id);
                            addMemberCoupon(member.id, { id: "CP" + Date.now(), name: reward.name, value: reward.name.indexOf("5元") !== -1 ? "¥5" : reward.name.indexOf("15元") !== -1 ? "¥15" : reward.name.indexOf("包邮") !== -1 ? "包邮" : "礼品", condition: reward.note });
                        }
                        showToast(exchange && exchange.order ? reward.name + " 兑换成功，已生成待发货订单" : reward.name + " 已放入优惠券卡包");
                        closeModal();
                        setTimeout(openPointsMall, 30);
                    } catch (error) { showToast(error.message, true); }
                };
            },
            onSubmit: closeModal
        });
    }

    function openOrderTimeline(orderId) {
        const order = dataService.snapshot().orders.find(function (item) { return item.id === orderId; });
        if (!order) { showToast("订单不存在", true); return; }
        const timeline = Array.isArray(order.timeline) ? order.timeline : [{ status: order.status, detail: "当前订单状态", at: order.date, actor: "系统" }];
        openModal({ eyebrow: order.id, title: "订单进度", submitText: "完成", body: `<section class="order-timeline">${timeline.map(function (event, index) { const date = String(event.at || "").replace("T", " ").slice(0, 16).replace(/-/g, "/"); return `<article class="${index === timeline.length - 1 ? "active" : ""}"><span></span><div><strong>${escapeHtml(event.status)}</strong><p>${escapeHtml(event.detail || "状态已更新")}</p><small>${escapeHtml(date)} · ${escapeHtml(event.actor || "系统")}</small></div></article>`; }).join("")}</section>`, onSubmit: closeModal });
    }

    function openMyOrders(filter) {
        const data = dataService.snapshot();
        const member = requireMember(function () { openMyOrders(filter); });
        if (!member) return;
        state.orderFilter = filter || state.orderFilter || "全部";
        const allOrders = data.orders.filter(function (order) { return order.customerId === member.id; }).sort(function (a, b) { return b.date.localeCompare(a.date); });
        const orders = allOrders.filter(function (order) {
            if (state.orderFilter === "全部") return true;
            if (state.orderFilter === "待收货") return order.status === "已发货";
            if (state.orderFilter === "售后") return order.status === "退货处理中" || order.status === "已退款";
            return order.status === state.orderFilter;
        });
        const tabs = ["全部", "待付款", "待发货", "待收货", "售后"];
        openModal({
            eyebrow: "MY ORDERS",
            title: "我的订单",
            submitText: "继续购物",
            body: `<div class="consumer-order-tabs">${tabs.map(function (tab) { return `<button type="button" data-order-tab="${tab}" class="${state.orderFilter === tab ? "active" : ""}">${tab}</button>`; }).join("")}</div><div class="order-filter-title"><strong>${state.orderFilter === "全部" ? "全部订单" : state.orderFilter + "订单"}</strong><span>${orders.length} 笔</span></div><div class="consumer-order-list">${orders.length ? orders.map(function (order) {
                const first = data.products.find(function (product) { return product.id === order.items[0].productId; });
                let actions = "";
                if (order.status === "待付款") actions = `<button type="button" data-consumer-order="cancel" data-id="${order.id}">取消订单</button><button type="button" class="primary-button" data-consumer-order="pay" data-id="${order.id}">去付款</button>`;
                if (order.status === "待发货") actions = `<button type="button" data-consumer-order="cancel" data-id="${order.id}">取消订单</button>`;
                if (order.status === "已发货") actions = `<button type="button" class="primary-button" data-consumer-order="receive" data-id="${order.id}">确认收货</button>`;
                if (order.status === "已完成") actions = `<button type="button" data-consumer-order="return" data-id="${order.id}">申请售后</button>`;
                return `<article class="consumer-order"><header><span>${shortDate(order.date)} · ${order.id}</span>${statusBadge(order.status)}</header><div><img src="${productImage(first ? first.id : "P003")}" alt=""><p><strong>${escapeHtml(first ? first.name : "商品")}${order.items.length > 1 ? " 等" + order.items.length + "种商品" : ""}</strong><span>共 ${order.items.reduce(function (sum, item) { return sum + item.quantity; }, 0)} 件</span></p><b>${money(order.total)}</b></div><footer><button type="button" data-consumer-order="timeline" data-id="${order.id}">查看进度</button>${actions}</footer></article>`;
            }).join("") : `<div class="empty-state"><strong>暂无${state.orderFilter === "全部" ? "" : state.orderFilter}订单</strong>其他订单可通过上方分类查看</div>`}</div>`,
            afterOpen: function () {
                modalBody.onclick = function (event) {
                    const tab = event.target.closest("[data-order-tab]");
                    if (tab) { state.orderFilter = tab.dataset.orderTab; openMyOrders(state.orderFilter); return; }
                    const button = event.target.closest("[data-consumer-order]");
                    if (!button) return;
                    if (button.dataset.consumerOrder === "timeline") { openOrderTimeline(button.dataset.id); return; }
                    try {
                        if (button.dataset.consumerOrder === "cancel") {
                            const cancelledOrder = dataService.cancelOrder(button.dataset.id);
                            restoreOrderCoupon(cancelledOrder);
                        }
                        if (button.dataset.consumerOrder === "pay") {
                            dataService.advanceOrder(button.dataset.id);
                        }
                        if (button.dataset.consumerOrder === "receive") dataService.advanceOrder(button.dataset.id);
                        if (button.dataset.consumerOrder === "return") dataService.requestReturn(button.dataset.id);
                        closeModal();
                        renderStorefront();
                        setTimeout(function () { openMyOrders(state.orderFilter); }, 30);
                    } catch (error) { showToast(error.message, true); }
                };
            },
            onSubmit: closeModal
        });
    }

    function productForm(product) {
        return `<div class="form-grid">
            <div class="field full-span"><label for="productName">商品名称</label><input id="productName" name="name" required maxlength="30" value="${escapeHtml(product ? product.name : "")}" placeholder="例如：静音无线鼠标"></div>
            <div class="field full-span"><label for="productSpec">商品规格</label><input id="productSpec" name="spec" required maxlength="40" value="${escapeHtml(product ? product.spec : "")}" placeholder="例如：曜石黑 / 标准版"></div>
            <div class="field"><label for="productCategory">商品类别</label><input id="productCategory" name="category" required value="${escapeHtml(product ? product.category : "")}" placeholder="例如：数码配件"></div>
            <div class="field"><label for="productPrice">商品售价</label><input id="productPrice" name="price" required type="number" min="0" step="0.01" value="${product ? product.price : ""}" placeholder="0.00"></div>
            <div class="field"><label for="productCost">采购成本</label><input id="productCost" name="cost" required type="number" min="0" step="0.01" value="${product ? product.cost : ""}" placeholder="0.00"></div>
            ${product ? "" : '<div class="field"><label for="productStock">期初库存</label><input id="productStock" name="stock" required type="number" min="0" step="1" value="0"></div>'}
            <div class="field"><label for="warningStock">预警数量</label><input id="warningStock" name="warningStock" required type="number" min="0" step="1" value="${product ? product.warningStock : 5}"></div>
            <div class="field"><label for="productStatus">销售状态</label><select id="productStatus" name="status"><option>正常销售</option><option>已停用</option></select></div>
            <div class="field full-span"><p class="form-help">编辑商品时不直接改库存，以免跳过库存变化记录。请到“库存管理”执行入库或出库。</p></div>
        </div>`;
    }

    function openProductModal(productId) {
        const data = dataService.snapshot();
        const product = productId ? data.products.find(function (item) { return item.id === productId; }) : null;
        openModal({
            eyebrow: product ? product.id : "自动生成商品编号",
            title: product ? "编辑商品" : "添加商品",
            body: productForm(product),
            submitText: product ? "保存修改" : "添加商品",
            afterOpen: function () { document.getElementById("productStatus").value = product ? product.status : "正常销售"; },
            onSubmit: function (formData) {
                const values = Object.fromEntries(formData.entries());
                if (product) dataService.updateProduct(product.id, values); else dataService.addProduct(values);
                closeModal(); renderPage("products"); showToast(product ? "商品修改成功" : "商品添加成功");
            }
        });
    }

    function customerForm(customer) {
        return `<div class="form-grid">
            <div class="field"><label for="customerName">客户姓名</label><input id="customerName" name="name" required value="${escapeHtml(customer ? customer.name : "")}" placeholder="请输入姓名"></div>
            <div class="field"><label for="customerPhone">联系电话</label><input id="customerPhone" name="phone" required inputmode="numeric" maxlength="11" value="${escapeHtml(customer ? customer.phone : "")}" placeholder="11 位手机号码"></div>
            <div class="field"><label for="customerRegion">所在地区</label><input id="customerRegion" name="region" required value="${escapeHtml(customer ? customer.region : "")}" placeholder="例如：广东深圳"></div>
            <div class="field"><label for="customerType">客户类型</label><select id="customerType" name="type"><option>新客户</option><option>老客户</option></select></div>
        </div>`;
    }

    function openCustomerModal(customerId) {
        const data = dataService.snapshot();
        const customer = customerId ? data.customers.find(function (item) { return item.id === customerId; }) : null;
        openModal({
            eyebrow: customer ? customer.id : "自动生成客户编号",
            title: customer ? "编辑客户" : "添加客户",
            body: customerForm(customer),
            submitText: customer ? "保存修改" : "添加客户",
            afterOpen: function () { document.getElementById("customerType").value = customer ? customer.type : "新客户"; },
            onSubmit: function (formData) {
                const values = Object.fromEntries(formData.entries());
                if (customer) dataService.updateCustomer(customer.id, values); else dataService.addCustomer(values);
                closeModal(); renderPage("customers"); showToast(customer ? "客户修改成功" : "客户添加成功");
            }
        });
    }

    function openProductDetail(productId) {
        const data = dataService.snapshot();
        const product = data.products.find(function (item) { return item.id === productId; });
        if (!product) { showToast("商品不存在", true); return; }
        const member = currentMember(data);
        if (member) { try { runMemberOperation("recordProductView", { productId: product.id }); } catch (error) {} }
        const profile = member ? profileSnapshot() : { features: { compare: [], alerts: [] } };
        const compared = (profile.features.compare || []).indexOf(product.id) >= 0;
        const alerted = (profile.features.alerts || []).some(function (item) { return item.productId === product.id; });
        const reviews = (data.reviews || []).filter(function (item) { return item.productId === product.id; });
        const questions = (data.questions || []).filter(function (item) { return item.productId === product.id; });
        const bundles = (data.bundles || []).filter(function (bundle) { return bundle.enabled !== false && bundle.items.some(function (item) { return item.productId === product.id; }); });
        const subscribable = ["食品生鲜", "美妆个护", "商超百货", "厨房用品"].indexOf(product.category) >= 0;
        openModal({
            eyebrow: product.category,
            title: product.name,
            submitText: "加入购物车",
            body: `<div class="product-detail">
                <div class="product-detail-visual"><img src="${productImage(product.id)}" alt="${escapeHtml(product.name)}"></div>
                <div class="product-detail-info"><div class="badge badge-success">${product.stock > 0 ? "现货速发" : "暂时售罄"}</div><p>${escapeHtml(product.spec)}</p><strong>${money(product.price)}</strong>
                <div class="product-detail-benefits"><span>正品保障</span><span>7天无理由</span><span>会员积分</span></div>
                <div class="detail-delivery"><p><b>配送</b> 预计 1—3 天送达</p><p><b>服务</b> 支持退换货与在线客服</p></div>
                <div class="detail-member-actions"><button type="button" data-detail-action="compare">${compared ? "✓ 已加入对比" : "＋ 加入对比"}</button><button type="button" data-detail-action="alert">${alerted ? "✓ 已设置提醒" : product.stock ? "降价提醒" : "到货提醒"}</button>${subscribable ? '<button type="button" data-detail-action="subscription">周期购</button>' : ""}</div>
                <div class="field"><label>购买数量</label><div class="detail-stepper"><button type="button" data-detail-step="minus">−</button><span id="detailQuantityText">1</span><button type="button" data-detail-step="plus">＋</button><input id="detailQuantity" name="quantity" type="hidden" value="1"></div></div></div>
            </div>
            ${bundles.length ? `<section class="detail-section"><header><h3>组合购</h3><span>一起购买自动立减</span></header>${bundles.map(function (bundle) { return `<article class="detail-bundle"><div><strong>${escapeHtml(bundle.name)}</strong><p>${bundle.items.map(function (item) { return escapeHtml(productName(data, item.productId)); }).join(" + ")}</p></div><b>立减 ${money(bundle.discount)}</b><button type="button" data-detail-bundle="${bundle.id}">整套加入</button></article>`; }).join("")}</section>` : ""}
            <section class="detail-section"><header><h3>商品评价</h3><span>${reviews.length} 条真实评价</span></header>${reviews.length ? reviews.slice(0, 6).map(function (review) { return `<article class="review-item"><strong>${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</strong><p>${escapeHtml(review.content)}</p><small>${escapeHtml(review.customerName)} · ${shortDate(review.date)}</small></article>`; }).join("") : "<p class=\"detail-empty\">暂时还没有评价，完成购买后可以分享体验。</p>"}<div class="detail-compose"><select id="reviewRating"><option value="5">5星</option><option value="4">4星</option><option value="3">3星</option><option value="2">2星</option><option value="1">1星</option></select><input id="reviewContent" placeholder="完成购买后，写下至少8个字的体验"><button type="button" data-detail-action="review">发表评价</button></div></section>
            <section class="detail-section"><header><h3>商品问答</h3><span>${questions.length} 个问题</span></header>${questions.length ? questions.slice(0, 6).map(function (question) { return `<article class="question-item"><p><b>问</b>${escapeHtml(question.content)}</p>${question.answer ? `<p><b>答</b>${escapeHtml(question.answer)}</p>` : "<small>等待商家回复</small>"}</article>`; }).join("") : "<p class=\"detail-empty\">有疑问可以直接提问，商家后台可集中回复。</p>"}<div class="detail-compose"><input id="questionContent" placeholder="关于规格、使用或配送，你想了解什么？"><button type="button" data-detail-action="question">我要提问</button></div></section>`,
            afterOpen: function () {
                if (!product.stock) submitModalBtn.disabled = true;
                modalBody.onclick = function (event) {
                    const bundleButton = event.target.closest("[data-detail-bundle]");
                    if (bundleButton) {
                        const bundle = bundles.find(function (item) { return item.id === bundleButton.dataset.detailBundle; });
                        try { addBundleToCart(bundle); closeModal(); renderStorefront(); showToast(bundle.name + "已加入购物车，结算将自动立减"); } catch (error) { showToast(error.message, true); }
                        return;
                    }
                    const actionButton = event.target.closest("[data-detail-action]");
                    if (actionButton) {
                        if (!currentMember(dataService.snapshot())) { closeModal(); setTimeout(function () { openUserLogin(function () { openProductDetail(product.id); }); }, 30); return; }
                        try {
                            if (actionButton.dataset.detailAction === "compare") { const result = runMemberOperation("toggleCompare", { productId: product.id }); showToast(result.added ? "已加入商品对比" : "已从对比中移除"); openProductDetail(product.id); }
                            if (actionButton.dataset.detailAction === "alert") { const result = runMemberOperation("toggleProductAlert", { productId: product.id }); showToast(result.added ? "提醒设置成功" : "已取消提醒"); openProductDetail(product.id); }
                            if (actionButton.dataset.detailAction === "review") { runMemberOperation("submitReview", { productId: product.id, rating: Number(document.getElementById("reviewRating").value), content: document.getElementById("reviewContent").value }); showToast("评价发表成功"); openProductDetail(product.id); }
                            if (actionButton.dataset.detailAction === "question") { runMemberOperation("submitQuestion", { productId: product.id, content: document.getElementById("questionContent").value }); showToast("问题已提交，等待商家回复"); openProductDetail(product.id); }
                            if (actionButton.dataset.detailAction === "subscription") { closeModal(); setTimeout(function () { openSubscriptionManager(product.id); }, 30); }
                        } catch (error) { showToast(error.message, true); }
                        return;
                    }
                    const button = event.target.closest("[data-detail-step]");
                    if (!button) return;
                    const input = document.getElementById("detailQuantity");
                    let quantity = Number(input.value);
                    if (button.dataset.detailStep === "plus" && quantity < product.stock) quantity += 1;
                    if (button.dataset.detailStep === "minus" && quantity > 1) quantity -= 1;
                    input.value = quantity;
                    document.getElementById("detailQuantityText").textContent = quantity;
                };
            },
            onSubmit: function (formData) {
                addToCart(product.id, Number(formData.get("quantity")));
                closeModal(); renderStorefront(); showToast(product.name + " 已加入购物车");
            }
        });
    }

    function cartMarkup() {
        const data = dataService.snapshot();
        const cart = loadCart();
        let total = 0;
        const rows = cart.map(function (item) {
            const product = data.products.find(function (productItem) { return productItem.id === item.productId; });
            if (!product) return "";
            total += product.price * item.quantity;
            return `<div class="cart-row">
                <div class="cart-thumb"><img src="${productImage(product.id)}" alt="${escapeHtml(product.name)}"></div>
                <div class="cart-info"><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.spec)} · ${money(product.price)}</span></div>
                <div class="cart-stepper"><button type="button" data-cart="minus" data-id="${product.id}">−</button><span>${item.quantity}</span><button type="button" data-cart="plus" data-id="${product.id}">＋</button></div>
                <strong>${money(product.price * item.quantity)}</strong><button type="button" class="cart-remove" data-cart="remove" data-id="${product.id}">移除</button>
            </div>`;
        }).join("");
        return `<div id="cartContent">${rows || '<div class="empty-state"><strong>购物车还是空的</strong>先去挑选一件喜欢的商品吧</div>'}<div class="cart-summary"><span>共 ${cartCount()} 件商品</span><strong>合计 ${money(total)}</strong></div></div>`;
    }

    function openCartModal() {
        openModal({
            eyebrow: "多商品合并结算",
            title: "我的购物车",
            submitText: "去结算",
            body: cartMarkup(),
            afterOpen: function () {
                modalBody.onclick = function (event) {
                    const button = event.target.closest("button[data-cart]");
                    if (!button) return;
                    const data = dataService.snapshot();
                    const cart = loadCart();
                    const item = cart.find(function (cartItem) { return cartItem.productId === button.dataset.id; });
                    if (!item) return;
                    const product = data.products.find(function (productItem) { return productItem.id === item.productId; });
                    if (button.dataset.cart === "plus") {
                        if (!product || item.quantity >= product.stock) { showToast("不能超过当前库存", true); return; }
                        item.quantity += 1;
                    }
                    if (button.dataset.cart === "minus") item.quantity -= 1;
                    if (button.dataset.cart === "remove" || item.quantity <= 0) cart.splice(cart.indexOf(item), 1);
                    saveCart(cart);
                    modalBody.innerHTML = cartMarkup();
                };
            },
            onSubmit: function () {
                if (!loadCart().length) throw new Error("购物车中还没有商品");
                closeModal();
                setTimeout(openCheckoutModal, 40);
            }
        });
    }

    function openCheckoutModal() {
        const data = dataService.snapshot();
        const cart = loadCart();
        if (!cart.length) { showToast("购物车中还没有商品", true); return; }
        const member = requireMember(openCheckoutModal);
        if (!member) return;
        const address = memberAddress(member);
        if (!address || !address.receiver || !address.phone || !address.region || !address.detail) {
            showToast("请先填写完整收货地址", true);
            setTimeout(function () { openAddressManager(true); }, 40);
            return;
        }
        const today = new Date().toISOString().slice(0, 10);
        const subtotal = cart.reduce(function (sum, item) {
            const product = data.products.find(function (productItem) { return productItem.id === item.productId; });
            return sum + (product ? product.price * item.quantity : 0);
        }, 0);
        const shippingFee = subtotal >= 99 ? 0 : 8;
        const activeBundleId = localStorage.getItem(ACTIVE_BUNDLE_KEY) || "";
        const activeBundle = (data.bundles || []).find(function (bundle) { return bundle.id === activeBundleId && bundle.enabled !== false && bundle.items.every(function (bundleItem) { const cartItem = cart.find(function (item) { return item.productId === bundleItem.productId; }); return cartItem && Number(cartItem.quantity) >= Number(bundleItem.quantity || 1); }); }) || null;
        const bundleSavings = activeBundle ? Number(activeBundle.discount || 0) : 0;
        const coupons = memberCoupons(member.id);
        const availableCoupons = coupons.filter(function (coupon) { return couponSavings(coupon, subtotal, shippingFee) > 0; });
        const initialCouponId = availableCoupons.length ? availableCoupons.sort(function (a, b) { return couponSavings(b, subtotal, shippingFee) - couponSavings(a, subtotal, shippingFee); })[0].id : "";
        function checkoutAmount(couponId) {
            const coupon = coupons.find(function (item) { return item.id === couponId; }) || null;
            const savings = couponSavings(coupon, subtotal, shippingFee);
            return { coupon: savings > 0 ? coupon : null, savings: savings, total: Number(Math.max(0, subtotal + shippingFee - savings - bundleSavings).toFixed(2)) };
        }
        const initialAmount = checkoutAmount(initialCouponId);
        openModal({
            eyebrow: "SECURE CHECKOUT",
            title: "确认订单",
            submitText: "立即支付 " + money(initialAmount.total),
            body: `<div class="form-grid">
                <section class="checkout-address full-span"><span>收货地址</span><div><strong>${escapeHtml(address.receiver)} · ${escapeHtml(address.phone)}</strong><p>${escapeHtml(address.region)} ${escapeHtml(address.detail)}</p></div><button type="button" data-edit-checkout-address>修改</button></section>
                <input type="hidden" name="customerId" value="${member.id}"><input type="hidden" name="date" value="${today}">
                <div class="field full-span"><div class="checkout-list">${cart.map(function (item) { const product = data.products.find(function (p) { return p.id === item.productId; }); return product ? `<div><span>${escapeHtml(product.name)} · ${escapeHtml(product.spec)} × ${item.quantity}</span><strong>${money(product.price * item.quantity)}</strong></div>` : ""; }).join("")}</div></div>
                <section class="delivery-choice full-span"><div><span>配送方式</span><strong>标准配送</strong></div><p>预计 1—3 天送达 · ${shippingFee ? money(shippingFee) : "免运费"}</p></section>${activeBundle ? `<section class="bundle-benefit full-span"><span>组合购优惠</span><strong>${escapeHtml(activeBundle.name)} · 立减 ${money(bundleSavings)}</strong></section>` : ""}
                <div class="field full-span"><label for="checkoutCoupon">优惠券</label><select id="checkoutCoupon" name="couponId"><option value="">不使用优惠券</option>${coupons.map(function (coupon) { const savings = couponSavings(coupon, subtotal, shippingFee); return `<option value="${escapeHtml(coupon.id)}" ${coupon.id === initialCouponId ? "selected" : ""} ${savings ? "" : "disabled"}>${escapeHtml(coupon.name)} · ${savings ? "减" + money(savings) : "暂不可用"}</option>`; }).join("")}</select></div>
                <fieldset class="payment-methods full-span"><legend>支付方式</legend><label><input type="radio" name="payment" value="微信支付" checked><span class="pay-icon wechat">微</span><strong>微信支付</strong></label><label><input type="radio" name="payment" value="支付宝"><span class="pay-icon alipay">支</span><strong>支付宝</strong></label><label><input type="radio" name="payment" value="银行卡"><span class="pay-icon bank">卡</span><strong>银行卡</strong></label></fieldset>
                <div class="checkout-total full-span"><span>应付金额</span><strong id="checkoutPayable">${money(initialAmount.total)}</strong><small id="checkoutBenefit">${bundleSavings ? "组合购已减 " + money(bundleSavings) + " · " : ""}${initialAmount.savings ? "优惠券已减 " + money(initialAmount.savings) + " · " : ""}支付成功后可获得 ${Math.floor(initialAmount.total)} 积分</small></div>
            </div>`,
            afterOpen: function () {
                modalBody.onclick = function (event) { if (event.target.closest("[data-edit-checkout-address]")) openAddressManager(true); };
                const couponSelect = document.getElementById("checkoutCoupon");
                couponSelect.addEventListener("change", function () {
                    const amount = checkoutAmount(couponSelect.value);
                    document.getElementById("checkoutPayable").textContent = money(amount.total);
                    document.getElementById("checkoutBenefit").textContent = (bundleSavings ? "组合购已减 " + money(bundleSavings) + " · " : "") + (amount.savings ? "优惠券已减 " + money(amount.savings) + " · " : "") + "支付成功后可获得 " + Math.floor(amount.total) + " 积分";
                    submitModalBtn.textContent = "立即支付 " + money(amount.total);
                });
            },
            onSubmit: function (formData) {
                const amount = checkoutAmount(String(formData.get("couponId") || ""));
                const order = dataService.createOrder({ customerId: formData.get("customerId"), date: formData.get("date"), items: cart, shippingFee: shippingFee, discount: amount.savings, appliedCoupon: amount.coupon, bundleId: activeBundle ? activeBundle.id : null });
                if (amount.coupon && (!window.serverApi || !window.serverApi.enabled) && !consumeMemberCoupon(member.id, amount.coupon.id)) throw new Error("优惠券状态已变化，请重新结算");
                dataService.advanceOrder(order.id);
                saveCart([]);
                localStorage.removeItem(ACTIVE_BUNDLE_KEY);
                closeModal();
                state.consumerPage = "home";
                renderPage("storefront");
                setTimeout(function () { openPaymentSuccess(order); }, 50);
            }
        });
    }

    function openPaymentSuccess(order) {
        openModal({
            eyebrow: "PAYMENT SUCCESSFUL",
            title: "支付成功",
            submitText: "查看订单",
            body: `<div class="payment-success"><span>✓</span><h3>${money(order.total)}</h3><p>订单已支付，商家正在为你准备商品。</p><div><span>订单编号</span><strong>${order.id}</strong></div><div><span>配送方式</span><strong>标准配送</strong></div></div>`,
            onSubmit: function () { closeModal(); setTimeout(openMyOrders, 30); }
        });
    }

    function openOrderModal(selectedCustomerId) {
        const data = dataService.snapshot();
        const sellableProducts = data.products.filter(function (product) { return product.status === "正常销售" && product.stock > 0; });
        if (!data.customers.length || !sellableProducts.length) {
            showToast("需要至少一位客户和一个有库存的在售商品", true);
            return;
        }
        const today = new Date().toISOString().slice(0, 10);
        openModal({
            eyebrow: "支持多种商品合并下单",
            title: "后台新建订单",
            submitText: "确认下单",
            body: `<div class="form-grid">
                <div class="field full-span"><label for="orderCustomer">选择客户</label><select id="orderCustomer" name="customerId" required>${data.customers.map(function (customer) { return `<option value="${customer.id}">${escapeHtml(customer.name)} · ${escapeHtml(customer.region)} · ${customer.id}</option>`; }).join("")}</select></div>
                <div class="field"><label for="orderDate">下单日期</label><input id="orderDate" name="date" type="date" value="${today}" required></div>
                <div class="field"><label>订单初始状态</label><input value="待付款" disabled></div>
                <div class="field full-span"><label>订单商品</label><div id="orderItems" class="order-items"></div><button type="button" class="secondary-button add-order-line" id="addOrderLine">＋ 继续添加商品</button></div>
                <div class="field full-span"><p class="form-help" id="orderHint"></p></div>
            </div>`,
            afterOpen: function () {
                if (selectedCustomerId && data.customers.some(function (customer) { return customer.id === selectedCustomerId; })) document.getElementById("orderCustomer").value = selectedCustomerId;
                const options = sellableProducts.map(function (product) { return `<option value="${product.id}">${escapeHtml(product.name)} · ${escapeHtml(product.spec)} · ${money(product.price)} · 库存 ${product.stock}</option>`; }).join("");
                const orderItems = document.getElementById("orderItems");
                function addLine() {
                    const row = document.createElement("div");
                    row.className = "order-item-row";
                    row.innerHTML = `<select class="order-product" required>${options}</select><input class="order-quantity" type="number" min="1" step="1" value="1" required><button type="button" class="order-item-remove" aria-label="移除商品">×</button>`;
                    orderItems.appendChild(row);
                    refreshHint();
                }
                function refreshHint() {
                    let total = 0;
                    let quantityTotal = 0;
                    orderItems.querySelectorAll(".order-item-row").forEach(function (row) {
                        const product = sellableProducts.find(function (item) { return item.id === row.querySelector(".order-product").value; });
                        const quantity = Number(row.querySelector(".order-quantity").value || 0);
                        if (product) total += product.price * quantity;
                        quantityTotal += quantity;
                    });
                    document.getElementById("orderHint").textContent = "共 " + quantityTotal + " 件商品，预计订单金额 " + money(total) + "。相同商品会自动合并数量。";
                }
                document.getElementById("addOrderLine").addEventListener("click", addLine);
                orderItems.addEventListener("input", refreshHint);
                orderItems.addEventListener("change", refreshHint);
                orderItems.addEventListener("click", function (event) {
                    const button = event.target.closest(".order-item-remove");
                    if (!button) return;
                    if (orderItems.children.length === 1) { showToast("订单至少保留一行商品", true); return; }
                    button.closest(".order-item-row").remove(); refreshHint();
                });
                addLine();
            },
            onSubmit: function (formData) {
                const values = Object.fromEntries(formData.entries());
                const items = Array.from(document.querySelectorAll("#orderItems .order-item-row")).map(function (row) { return { productId: row.querySelector(".order-product").value, quantity: Number(row.querySelector(".order-quantity").value) }; });
                const order = dataService.createOrder({ customerId: values.customerId, date: values.date, items: items });
                closeModal(); renderPage("orders"); showToast("订单 " + order.id + " 创建成功，当前状态为待付款");
            }
        });
    }

    function openStockModal(productId) {
        const data = dataService.snapshot();
        if (!data.products.length) { showToast("请先添加商品", true); return; }
        openModal({
            eyebrow: "INVENTORY",
            title: "调整库存",
            submitText: "保存",
            body: `<div class="form-grid">
                <div class="field full-span"><label for="stockProduct">选择商品</label><select id="stockProduct" name="productId">${data.products.map(function (product) { return `<option value="${product.id}">${escapeHtml(product.name)} · 当前 ${product.stock} 件</option>`; }).join("")}</select></div>
                <div class="field"><label for="stockMode">调整方式</label><select id="stockMode" name="mode"><option value="in">增加库存</option><option value="out">减少库存</option></select></div>
                <div class="field"><label for="stockQuantity">数量</label><div class="stock-stepper"><button type="button" data-stock-step="-1">−</button><input id="stockQuantity" name="quantity" type="number" min="1" step="1" value="1" required><button type="button" data-stock-step="1">＋</button></div></div>
            </div>`,
            afterOpen: function () {
                if (productId) document.getElementById("stockProduct").value = productId;
                modalBody.onclick = function (event) {
                    const button = event.target.closest("[data-stock-step]");
                    if (!button) return;
                    const input = document.getElementById("stockQuantity");
                    input.value = Math.max(1, Number(input.value || 1) + Number(button.dataset.stockStep));
                };
            },
            onSubmit: function (formData) {
                const values = Object.fromEntries(formData.entries());
                const quantity = Number(values.quantity) * (values.mode === "out" ? -1 : 1);
                dataService.adjustStock(values.productId, quantity, values.mode === "out" ? "减少库存" : "增加库存");
                closeModal(); renderPage("inventory"); showToast("库存已更新");
            }
        });
    }

    function downloadText(filename, content, type) {
        const blob = new Blob([content], { type: type || "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    function csvCell(value) {
        return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
    }

    function openExportModal() {
        openModal({
            eyebrow: "简单、可验证的导出",
            title: "导出与打印",
            submitText: "关闭",
            body: `<div class="export-choice-grid">
                <button type="button" class="export-choice" data-export="json"><strong>完整 JSON</strong><span>备份商品、客户、订单与库存数据</span></button>
                <button type="button" class="export-choice" data-export="csv"><strong>订单 CSV</strong><span>可使用 Excel 打开并继续整理</span></button>
                <button type="button" class="export-choice" data-export="print"><strong>打印经营分析</strong><span>可在浏览器中另存为 PDF</span></button>
            </div>`,
            afterOpen: function () {
                modalBody.onclick = function (event) {
                    const button = event.target.closest("[data-export]");
                    if (!button) return;
                    const data = dataService.snapshot();
                    if (button.dataset.export === "json") {
                        downloadText("悦选电商平台_完整数据.json", JSON.stringify(data, null, 2), "application/json;charset=utf-8");
                        showToast("完整数据已导出为 JSON");
                    }
                    if (button.dataset.export === "csv") {
                        const header = ["订单编号", "日期", "客户", "状态", "商品明细", "订单金额"];
                        const lines = data.orders.map(function (order) {
                            const detail = order.items.map(function (item) { return productName(data, item.productId) + "×" + item.quantity; }).join("；");
                            return [order.id, order.date, customerName(data, order.customerId), order.status, detail, order.total].map(csvCell).join(",");
                        });
                        downloadText("悦选电商平台_订单.csv", "\ufeff" + header.map(csvCell).join(",") + "\r\n" + lines.join("\r\n"), "text/csv;charset=utf-8");
                        showToast("订单已导出为 CSV");
                    }
                    if (button.dataset.export === "print") {
                        closeModal(); renderPage("analytics"); setTimeout(function () { window.print(); }, 120);
                    }
                };
            },
            onSubmit: closeModal
        });
    }

    function openSidebar() { sidebar.classList.add("open"); sidebarMask.classList.add("open"); }
    function closeSidebar() { sidebar.classList.remove("open"); sidebarMask.classList.remove("open"); }

    document.querySelectorAll(".nav-item").forEach(function (button) {
        button.addEventListener("click", function () { renderPage(button.dataset.page); });
    });

    pageContent.addEventListener("click", function (event) {
        const button = event.target.closest("button");
        if (!button) return;
        if (button.dataset.consumerPage) { state.consumerPage = button.dataset.consumerPage; state.storeView = "home"; renderStorefront(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
        if (button.dataset.categoryJump) { state.consumerPage = "catalog"; state.storeCategory = button.dataset.categoryJump; state.storeFilterBrand = "全部品牌"; state.storeFilterPrice = "全部价格"; state.storeFilterStock = "全部库存"; state.storeView = "home"; renderStorefront(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
        if (button.dataset.searchSuggestion) { state.storeSearch = button.dataset.searchSuggestion; state.storeVisible = 16; const member = currentMember(dataService.snapshot()); if (member) { try { runMemberOperation("recordSearch", { keyword: state.storeSearch }); } catch (error) {} } renderStorefront(); return; }
        if (button.dataset.storeAction === "browse") { state.consumerPage = "catalog"; renderStorefront(); return; }
        if (button.dataset.go) { renderPage(button.dataset.go); return; }
        const action = button.dataset.action;
        const id = button.dataset.id;
        if (action === "new-product") openProductModal();
        if (action === "edit-product") openProductModal(id);
        if (action === "toggle-product") {
            const updated = dataService.toggleProduct(id);
            renderPage("products");
            showToast(updated.status === "已停用" ? "商品已停用，历史数据仍保留" : "商品已恢复销售");
        }
        if (action === "new-customer") openCustomerModal();
        if (action === "edit-customer") openCustomerModal(id);
        if (action === "new-order") openOrderModal(button.dataset.customer || "");
        if (action === "product-detail") openProductDetail(id);
        if (action === "toggle-compare") {
            const toggle = function () { try { const result = runMemberOperation("toggleCompare", { productId: id }); renderStorefront(); showToast(result.added ? "已加入商品对比" : "已从对比中移除"); } catch (error) { showToast(error.message, true); } };
            if (!currentMember(dataService.snapshot())) openUserLogin(toggle); else toggle();
        }
        if (action === "add-bundle") {
            const bundle = (dataService.snapshot().bundles || []).find(function (item) { return item.id === id; });
            try { if (!bundle) throw new Error("组合活动不存在"); addBundleToCart(bundle); renderStorefront(); showToast(bundle.name + "已加入购物车"); } catch (error) { showToast(error.message, true); }
        }
        if (action === "add-cart") {
            try { addToCart(id, 1); renderStorefront(); showToast("商品已加入购物车"); } catch (error) { showToast(error.message, true); }
        }
        if (action === "toggle-favorite") { const added = toggleFavorite(id); renderStorefront(); showToast(added ? "已加入收藏夹" : "已取消收藏"); }
        if (action === "favorites") { state.consumerPage = "catalog"; openFavorites(); }
        if (action === "member-center") openMemberCenter();
        if (action === "points-mall") openPointsMall();
        if (action === "shopping-advisor") openShoppingAdvisor();
        if (action === "price-deals") openPriceDeals();
        if (action === "subscription-manager") openSubscriptionManager();
        if (action === "smart-filter") openSmartFilters();
        if (action === "reset-smart-filter") { state.storeFilterBrand = "全部品牌"; state.storeFilterPrice = "全部价格"; state.storeFilterStock = "全部库存"; state.storeVisible = 16; renderStorefront(); }
        if (action === "my-questions") openMyQuestions();
        if (action === "browsing-history") openBrowsingHistory();
        if (action === "product-compare") openProductCompare();
        if (action === "product-alerts") openProductAlerts();
        if (action === "invite-friends") openInviteFriends();
        if (action === "my-orders") openMyOrders(button.dataset.orderFilter || "全部");
        if (action === "user-login" || action === "merchant-login") openUserLogin();
        if (action === "user-register") openUserRegister();
        if (action === "account-settings") openAccountSettings();
        if (action === "address-manager") openAddressManager(false);
        if (action === "coupons") openCoupons();
        if (action === "promotions") openPromotions();
        if (action === "help-center") openHelpCenter();
        if (action === "customer-service") openCustomerService();
        if (action === "order-assistant") openMyOrders("全部");
        if (action === "load-more-products") { state.storeVisible += 16; renderStorefront(); }
        if (action === "clear-search-history") { try { runMemberOperation("clearSearchHistory", {}); renderStorefront(); showToast("搜索历史已清空"); } catch (error) { showToast(error.message, true); } }
        if (action === "read-all-messages") showToast("消息已全部标记为已读");
        if (action === "user-logout") { if (window.serverApi && window.serverApi.enabled) window.serverApi.logout().catch(function () {}); authenticatedRole = null; localStorage.removeItem(MEMBER_KEY); state.consumerPage = "account"; renderStorefront(); showToast("已退出登录，购物车商品已为你保留"); }
        if (action === "open-cart") { state.consumerPage = "cart"; renderStorefront(); }
        if (action === "checkout") openCheckoutModal();
        if (action === "clear-cart" && window.confirm("确定清空购物车中的全部商品吗？")) { saveCart([]); localStorage.removeItem(ACTIVE_BUNDLE_KEY); renderStorefront(); showToast("购物车已清空"); }
        if (button.dataset.cartPage) {
            const cart = loadCart();
            const item = cart.find(function (cartItem) { return cartItem.productId === id; });
            const product = dataService.snapshot().products.find(function (productItem) { return productItem.id === id; });
            if (!item) return;
            if (button.dataset.cartPage === "plus") {
                if (!product || item.quantity >= product.stock) { showToast("不能超过当前库存", true); return; }
                item.quantity += 1;
            }
            if (button.dataset.cartPage === "minus") item.quantity -= 1;
            if (button.dataset.cartPage === "remove" || item.quantity <= 0) cart.splice(cart.indexOf(item), 1);
            saveCart(cart); renderStorefront(); return;
        }
        if (action === "cancel-order" && window.confirm("确定取消订单 " + id + " 吗？取消后会恢复对应库存。")) {
            const cancelledOrder = dataService.cancelOrder(id); restoreOrderCoupon(cancelledOrder); renderPage("orders"); showToast("订单已取消，库存、积分和优惠券已经恢复");
        }
        if (action === "advance-order") {
            const order = dataService.advanceOrder(id); renderPage("orders"); showToast("订单已更新为“" + order.status + "”");
        }
        if (action === "request-return" && window.confirm("确定为订单 " + id + " 发起退货吗？确认收到退回商品后再执行退款。")) {
            dataService.requestReturn(id); renderPage("orders"); showToast("订单已进入退货处理流程");
        }
        if (action === "complete-refund" && window.confirm("确认已收到退回商品并完成退款吗？库存会在此时恢复。")) {
            const refundedOrder = dataService.completeRefund(id); restoreOrderCoupon(refundedOrder); renderPage("orders"); showToast("退款完成，库存、积分和优惠券已经恢复");
        }
        if (action === "adjust-stock") openStockModal(id || "");
        if (action === "toggle-promotion") { try { dataService.operate("togglePromotion", { promotionId: id }); renderPage("marketing"); showToast("活动状态已更新"); } catch (error) { showToast(error.message, true); } }
        if (action === "toggle-bundle") { try { dataService.operate("toggleBundle", { bundleId: id }); renderPage("marketing"); showToast("组合购状态已更新"); } catch (error) { showToast(error.message, true); } }
        if (action === "answer-question") openAnswerQuestion(id);
    });

    modalForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!modalSubmitHandler) return;
        submitModalBtn.disabled = true;
        try { await modalSubmitHandler(new FormData(modalForm)); }
        catch (error) { showToast(error.message || "操作失败", true); }
        finally { if (modalBackdrop.classList.contains("open")) submitModalBtn.disabled = false; }
    });

    document.getElementById("closeModalBtn").addEventListener("click", closeModal);
    document.getElementById("cancelModalBtn").addEventListener("click", closeModal);
    modalBackdrop.addEventListener("click", function (event) { if (event.target === modalBackdrop) closeModal(); });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") { closeModal(); closeSidebar(); } });
    document.getElementById("menuButton").addEventListener("click", openSidebar);
    sidebarMask.addEventListener("click", closeSidebar);
    document.getElementById("quickOrderBtn").addEventListener("click", function () { if (state.page === "storefront") { state.consumerPage = "cart"; renderStorefront(); } else openOrderModal(); });
    document.getElementById("adminLogoutBtn").addEventListener("click", function () { if (window.serverApi && window.serverApi.enabled) window.serverApi.logout().catch(function () {}); authenticatedRole = null; state.consumerPage = "home"; renderPage("storefront"); showToast("已退出商家中心"); });
    document.getElementById("exportBtn").addEventListener("click", openExportModal);

    const today = new Date();
    document.getElementById("todayText").textContent = today.getFullYear() + "年" + (today.getMonth() + 1) + "月" + today.getDate() + "日";
    renderPage("storefront");
    if (window.serverApi && window.serverApi.enabled) {
        window.serverApi.session().then(function (response) {
            authenticatedRole = response.authenticated && response.user ? response.user.role : null;
            if (response.user && response.user.role === "customer") localStorage.setItem(MEMBER_KEY, response.user.customerId);
            if (!response.authenticated) localStorage.removeItem(MEMBER_KEY);
            renderPage("storefront");
        }).catch(function () { showToast("商城服务器连接失败，请重新启动", true); });
    }
})();
