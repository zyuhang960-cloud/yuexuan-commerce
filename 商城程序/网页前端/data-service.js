/*
 * 当前版本的数据层：浏览器 localStorage。
 * 页面只通过 dataService 调用数据，未来接入 Python / MySQL / Pandas 时，
 * 可以替换本文件中的实现，页面结构和业务按钮不需要全部重写。
 */
(function () {
    "use strict";

    const STORAGE_KEY = "yuexuan_ecommerce_demo_v02";

    const DEMO_DATA = {
        products: [
            { id: "P001", name: "静音无线鼠标", spec: "曜石黑 / 标准版", category: "数码配件", price: 89, cost: 48.5, stock: 16, warningStock: 10, status: "正常销售" },
            { id: "P002", name: "轻量保温杯", spec: "奶杏色 / 500ml", category: "日用百货", price: 59, cost: 31, stock: 8, warningStock: 8, status: "正常销售" },
            { id: "P003", name: "护眼桌面台灯", spec: "暖白色 / 充电款", category: "家居用品", price: 129, cost: 72, stock: 22, warningStock: 6, status: "正常销售" },
            { id: "P004", name: "折叠收纳箱", spec: "焦糖棕 / 45L", category: "家居用品", price: 39.9, cost: 18.6, stock: 5, warningStock: 7, status: "正常销售" },
            { id: "P005", name: "快充数据线", spec: "深灰色 / Type-C 1m", category: "数码配件", price: 29.9, cost: 10.8, stock: 45, warningStock: 12, status: "正常销售" },
            { id: "P006", name: "香薰加湿器", spec: "陶土橙 / 300ml", category: "生活电器", price: 159, cost: 92, stock: 0, warningStock: 5, status: "正常销售" },
            { id: "P007", name: "便携榨汁杯", spec: "莓果紫 / 400ml", category: "生活电器", price: 119, cost: 64, stock: 12, warningStock: 5, status: "正常销售" },
            { id: "P008", name: "无线头戴耳机", spec: "曜石黑 / 长续航版", category: "影音娱乐", price: 269, cost: 148, stock: 24, warningStock: 6, status: "正常销售" },
            { id: "P009", name: "城市通勤双肩包", spec: "深岩灰 / 15.6英寸", category: "箱包出行", price: 199, cost: 106, stock: 18, warningStock: 5, status: "正常销售" },
            { id: "P010", name: "极简石英腕表", spec: "银灰色 / 40mm", category: "服饰配件", price: 329, cost: 178, stock: 14, warningStock: 4, status: "正常销售" },
            { id: "P011", name: "温和净澈洁面乳", spec: "清爽型 / 80ml", category: "个护美妆", price: 79, cost: 36, stock: 32, warningStock: 8, status: "正常销售" },
            { id: "P012", name: "家用滴滤咖啡机", spec: "暖白色 / 600ml", category: "生活电器", price: 299, cost: 166, stock: 11, warningStock: 4, status: "正常销售" },
            { id: "P013", name: "轻弹休闲运动鞋", spec: "珊瑚红 / 36-44码", category: "运动户外", price: 239, cost: 128, stock: 27, warningStock: 7, status: "正常销售" },
            { id: "P014", name: "北欧绿植盆栽", spec: "龟背竹 / 含陶瓷盆", category: "家居用品", price: 69, cost: 28, stock: 20, warningStock: 5, status: "正常销售" },
            { id: "P015", name: "机械键盘", spec: "米白色 / 87键", category: "数码配件", price: 359, cost: 205, stock: 15, warningStock: 5, status: "正常销售" },
            { id: "P016", name: "绒面休闲单椅", spec: "姜黄色 / 单人款", category: "家居用品", price: 699, cost: 398, stock: 7, warningStock: 3, status: "正常销售" }
        ],
        customers: [
            { id: "C001", name: "张宁", phone: "13800001231", region: "广东深圳", type: "老客户", points: 1260 },
            { id: "C002", name: "李晴", phone: "13900004562", region: "浙江杭州", type: "新客户", points: 680 },
            { id: "C003", name: "王磊", phone: "13600007893", region: "江苏南京", type: "老客户", points: 2350 },
            { id: "C004", name: "陈曦", phone: "13700002218", region: "四川成都", type: "新客户", points: 420 },
            { id: "C005", name: "周然", phone: "13500006740", region: "湖北武汉", type: "老客户", points: 980 }
        ],
        orders: [
            { id: "O202604001", date: "2026-04-15", customerId: "C003", status: "已完成", total: 258, items: [{ productId: "P003", quantity: 2, unitPrice: 129, unitCost: 72 }] },
            { id: "O202605001", date: "2026-05-06", customerId: "C001", status: "已完成", total: 326.8, items: [{ productId: "P001", quantity: 3, unitPrice: 89, unitCost: 48.5 }, { productId: "P005", quantity: 2, unitPrice: 29.9, unitCost: 10.8 }] },
            { id: "O202606001", date: "2026-06-12", customerId: "C002", status: "已完成", total: 236, items: [{ productId: "P002", quantity: 4, unitPrice: 59, unitCost: 31 }] },
            { id: "O202607001", date: "2026-07-03", customerId: "C004", status: "已取消", total: 199.5, items: [{ productId: "P004", quantity: 5, unitPrice: 39.9, unitCost: 18.6 }] },
            { id: "O202607002", date: "2026-07-18", customerId: "C005", status: "已完成", total: 159, items: [{ productId: "P006", quantity: 1, unitPrice: 159, unitCost: 92 }] },
            { id: "O202608001", date: "2026-08-08", customerId: "C001", status: "已完成", total: 178, items: [{ productId: "P001", quantity: 2, unitPrice: 89, unitCost: 48.5 }] },
            { id: "O202608002", date: "2026-08-18", customerId: "C002", status: "已发货", total: 218.7, items: [{ productId: "P003", quantity: 1, unitPrice: 129, unitCost: 72 }, { productId: "P005", quantity: 3, unitPrice: 29.9, unitCost: 10.8 }] },
            { id: "O202608003", date: "2026-08-24", customerId: "C003", status: "待发货", total: 159.6, items: [{ productId: "P004", quantity: 4, unitPrice: 39.9, unitCost: 18.6 }] }
        ],
        stockRecords: [
            { id: "S001", productId: "P001", type: "采购入库", quantity: 30, date: "2026-08-01", relatedId: "IN20260801" },
            { id: "S002", productId: "P001", type: "订单出库", quantity: -2, date: "2026-08-08", relatedId: "O202608001" },
            { id: "S003", productId: "P003", type: "订单出库", quantity: -1, date: "2026-08-18", relatedId: "O202608002" },
            { id: "S004", productId: "P005", type: "订单出库", quantity: -3, date: "2026-08-18", relatedId: "O202608002" },
            { id: "S005", productId: "P004", type: "订单出库", quantity: -4, date: "2026-08-24", relatedId: "O202608003" }
        ],
        pointRecords: [
            { id: "PT001", customerId: "C001", points: 260, type: "购物奖励", date: "2026-08-08", relatedId: "O202608001" },
            { id: "PT002", customerId: "C001", points: 1000, type: "会员礼遇", date: "2026-08-01", relatedId: "MEMBER" }
        ]
    };

    const CATALOG_EXPANSION = {
        "数码配件": [
            ["真无线蓝牙耳机", "雾白色 / 蓝牙5.3", 229, "p017-earbuds.jpg"],
            ["智能运动手表", "深空灰 / 健康监测", 169, "p018-powerbank.jpg"],
            ["高清智能摄像头", "1080P / 自动对焦", 199, "p019-webcam.jpg"],
            ["铝合金笔记本支架", "银灰色 / 六档调节", 99, "p003-lamp.jpg"],
            ["便携蓝牙键盘", "奶油白 / 68键", 189, "p015-keyboard.jpg"],
            ["六口桌面充电站", "黑色 / 120W", 219, "p005-cable.jpg"],
            ["降噪游戏耳麦", "曜石黑 / 低延迟", 299, "p008-headphones.jpg"]
        ],
        "日用百货": [
            ["轻巧晴雨伞", "燕麦色 / 五折款", 69, "p023-umbrella.jpg"],
            ["双层保温饭盒", "奶油黄 / 1.2L", 89, "p024-lunchbox.jpg"],
            ["纯棉柔软浴巾", "浅卡其 / 70×140cm", 79, "p025-towel.jpg"],
            ["随行运动水杯", "透明灰 / 700ml", 49, "p002-bottle.jpg"],
            ["旅行洗漱套装", "便携装 / 七件套", 59, "p025-towel.jpg"],
            ["家用藤编收纳篮", "原木色 / 中号", 45, "p004-storage.jpg"],
            ["自动开合遮阳伞", "墨绿色 / 防晒款", 99, "p023-umbrella.jpg"],
            ["不锈钢餐具套装", "银色 / 四件套", 39, "p034-wallet.jpg"],
            ["咖啡随行杯", "琥珀色 / 480ml", 75, "p024-lunchbox.jpg"]
        ],
        "家居用品": [
            ["云感客厅沙发", "暖灰色 / 三人位", 2699, "p020-sofa.jpg"],
            ["几何织物抱枕", "彩色 / 45×45cm", 69, "p021-cushion.jpg"],
            ["奶油陶瓷花瓶", "象牙白 / 25cm", 89, "p022-vase.jpg"],
            ["实木床头柜", "胡桃色 / 双层", 499, "p020-sofa.jpg"],
            ["香氛玻璃烛台", "琥珀色 / 小号", 79, "p038-perfume.jpg"],
            ["柔光立式落地灯", "米白色 / 触控调光", 329, "p003-lamp.jpg"]
        ],
        "生活电器": [
            ["多功能早餐机", "奶油白 / 双区加热", 399, "p026-toaster.jpg"],
            ["空气循环扇", "曜石黑 / 三档风速", 259, "p027-fan.jpg"],
            ["多功能和面机", "暖黄色 / 5L", 229, "p028-kettle.jpg"],
            ["小型电烤箱", "象牙白 / 12L", 329, "p026-toaster.jpg"],
            ["无线除螨仪", "雾白色 / 强吸力", 499, "p006-humidifier.jpg"],
            ["复古台式搅拌机", "复古黄 / 5L", 899, "p028-kettle.jpg"],
            ["迷你桌面风扇", "深灰色 / 静音款", 109, "p027-fan.jpg"]
        ],
        "影音娱乐": [
            ["桌面蓝牙音箱", "曜石黑 / 立体声", 199, "p027-fan.jpg"],
            ["真无线音乐耳机", "纯白色 / 主动降噪", 399, "p030-earbuds.jpg"],
            ["家庭影院投影仪", "1080P / 自动梯形校正", 1599, "p031-projector.jpg"],
            ["黑胶唱片机", "胡桃木纹 / 蓝牙版", 799, "p029-speaker.jpg"],
            ["便携户外音箱", "军绿色 / 防水款", 329, "p029-speaker.jpg"],
            ["入耳式运动耳机", "雾白色 / 轻量版", 159, "p017-earbuds.jpg"],
            ["智能声控音箱", "深灰色 / 家庭版", 269, "p029-speaker.jpg"],
            ["高清家庭投影仪", "4K解码 / 高亮版", 2399, "p031-projector.jpg"],
            ["监听级头戴耳机", "雅黑色 / 有线版", 599, "p008-headphones.jpg"]
        ],
        "箱包出行": [
            ["复古通勤斜挎包", "焦糖棕 / 13英寸", 239, "p032-suitcase.jpg"],
            ["轻奢链条手提包", "米白印花 / 小号", 299, "p033-handbag.jpg"],
            ["真皮短款钱包", "深棕色 / 多卡位", 169, "p034-wallet.jpg"],
            ["大容量旅行箱", "石墨灰 / 24英寸", 499, "p009-backpack.jpg"],
            ["防泼水电脑包", "藏青色 / 15.6英寸", 189, "p009-backpack.jpg"],
            ["轻量旅行收纳袋", "米灰色 / 六件套", 129, "p033-handbag.jpg"],
            ["城市邮差包", "复古棕 / 可调肩带", 259, "p032-suitcase.jpg"],
            ["牛皮多卡位卡包", "棕色 / 八卡位", 99, "p034-wallet.jpg"],
            ["周末短途旅行包", "深绿色 / 40L", 329, "p009-backpack.jpg"]
        ],
        "服饰配件": [
            ["偏光太阳镜", "琥珀棕 / 方框", 159, "p035-sunglasses.jpg"],
            ["宽檐遮阳帽", "卡其色 / 可调节", 89, "p036-hat.jpg"],
            ["羊毛格纹围巾", "米咖色 / 180cm", 199, "p037-scarf.jpg"],
            ["简约真皮腰带", "深棕色 / 自动扣", 129, "p034-wallet.jpg"],
            ["珍珠耳饰", "银白色 / 一对装", 119, "p038-perfume.jpg"],
            ["钛钢锁骨项链", "银色 / 45cm", 139, "p010-watch.jpg"],
            ["针织渔夫帽", "燕麦色 / 均码", 79, "p036-hat.jpg"],
            ["真丝印花方巾", "暖橙色 / 55cm", 149, "p037-scarf.jpg"],
            ["复古光学眼镜", "玳瑁色 / 平光镜", 189, "p035-sunglasses.jpg"]
        ],
        "个护美妆": [
            ["自然花香女士香水", "淡香型 / 50ml", 299, "p038-perfume.jpg"],
            ["丝绒哑光口红", "枫叶红 / 3.5g", 139, "p039-lipstick.jpg"],
            ["纤长防水睫毛膏", "曜石黑 / 8g", 109, "p040-lotion.jpg"],
            ["舒缓保湿乳", "敏感肌适用 / 100ml", 129, "p011-skincare.jpg"],
            ["氨基酸洁面乳", "温和型 / 120ml", 99, "p011-skincare.jpg"],
            ["清透防晒乳", "SPF50+ / 50ml", 159, "p040-lotion.jpg"],
            ["玻尿酸精华液", "补水型 / 30ml", 179, "p038-perfume.jpg"],
            ["植物滋润护手霜", "清香型 / 60ml", 59, "p025-towel.jpg"],
            ["净澈卸妆油", "清爽型 / 150ml", 149, "p038-perfume.jpg"]
        ],
        "运动户外": [
            ["防滑瑜伽垫", "雾紫色 / 8mm", 129, "p041-yoga.jpg"],
            ["家用浸塑哑铃", "黑色 / 5kg×2", 199, "p042-dumbbell.jpg"],
            ["城市通勤自行车", "森林绿 / 24速", 1599, "p043-bicycle.jpg"],
            ["轻量运动水壶", "透明灰 / 800ml", 69, "p002-bottle.jpg"],
            ["弹力训练带", "三档阻力 / 三件套", 79, "p041-yoga.jpg"],
            ["户外速干帽", "卡其色 / 可调节", 99, "p036-hat.jpg"],
            ["运动健身包", "深灰色 / 35L", 169, "p009-backpack.jpg"],
            ["折叠露营椅", "姜黄色 / 高承重", 239, "p016-towel.jpg"],
            ["便携瑜伽砖", "豆绿色 / 两块装", 59, "p041-yoga.jpg"]
        ]
    };

    let catalogProductNumber = 17;
    Object.keys(CATALOG_EXPANSION).forEach(function (category) {
        CATALOG_EXPANSION[category].forEach(function (item, index) {
            const price = Number(item[2]);
            DEMO_DATA.products.push({
                id: "P" + String(catalogProductNumber).padStart(3, "0"),
                name: item[0],
                spec: item[1],
                category: category,
                price: price,
                cost: Number((price * 0.56).toFixed(2)),
                stock: 12 + (index * 7 + catalogProductNumber) % 31,
                warningStock: 5 + index % 4,
                status: "正常销售",
                imageAsset: item[3]
            });
            catalogProductNumber += 1;
        });
    });

    if (Array.isArray(window.YUEXUAN_CATALOG) && window.YUEXUAN_CATALOG.length) {
        DEMO_DATA.products = cloneCatalog(window.YUEXUAN_CATALOG);
    }

    function cloneCatalog(catalog) {
        return catalog.map(function (product) { return Object.assign({}, product); });
    }

    const FUTURE_PORTS = {
        currentAdapter: "localStorage",
        plannedAdapters: ["Python API", "MySQL", "Pandas analysis service"],
        endpoints: {
            products: "/api/v1/products",
            customers: "/api/v1/customers",
            orders: "/api/v1/orders",
            inventory: "/api/v1/inventory",
            dashboard: "/api/v1/analysis/dashboard",
            salesAnalysis: "/api/v1/analysis/sales",
            publicDataImport: "/api/v1/import/public-data",
            exports: "/api/v1/exports"
        }
    };

    const SALES_STATUSES = ["待发货", "已发货", "已完成", "退货处理中"];

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeData(data) {
        if (!Array.isArray(data.pointRecords)) data.pointRecords = [];
        DEMO_DATA.products.forEach(function (defaultProduct) {
            const existingProduct = data.products.find(function (product) { return product.id === defaultProduct.id; });
            if (!existingProduct) {
                data.products.push(clone(defaultProduct));
                return;
            }
            ["name", "spec", "category", "price", "cost", "warningStock", "imageAsset"].forEach(function (field) {
                existingProduct[field] = defaultProduct[field];
            });
        });
        data.products.forEach(function (product) {
            if (!product.spec) product.spec = "标准款";
            if (!Number.isFinite(Number(product.cost))) product.cost = Number((Number(product.price || 0) * 0.6).toFixed(2));
        });
        data.orders.forEach(function (order) {
            if (!Number.isFinite(Number(order.discount))) order.discount = 0;
            if (!Number.isFinite(Number(order.shippingFee))) order.shippingFee = 0;
            order.items.forEach(function (item) {
                if (!Number.isFinite(Number(item.unitCost))) {
                    const product = data.products.find(function (productItem) { return productItem.id === item.productId; });
                    item.unitCost = product ? Number(product.cost || 0) : 0;
                }
            });
        });
        data.customers.forEach(function (customer) {
            if (!Number.isFinite(Number(customer.points))) customer.points = 0;
            customer.points = Math.max(0, Math.floor(Number(customer.points)));
        });
        return data;
    }

    function load() {
        const text = localStorage.getItem(STORAGE_KEY);
        if (!text) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_DATA));
            return clone(DEMO_DATA);
        }
        try {
            const data = JSON.parse(text);
            if (!data.products || !data.customers || !data.orders || !data.stockRecords) {
                throw new Error("数据结构不完整");
            }
            const normalized = normalizeData(data);
            save(normalized);
            return normalized;
        } catch (error) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_DATA));
            return clone(DEMO_DATA);
        }
    }

    function save(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function nextId(prefix, items, digits) {
        let maxNumber = 0;
        items.forEach(function (item) {
            const number = parseInt(String(item.id).replace(/\D/g, ""), 10);
            if (!Number.isNaN(number) && number > maxNumber) {
                maxNumber = number;
            }
        });
        return prefix + String(maxNumber + 1).padStart(digits, "0");
    }

    function getToday() {
        const now = new Date();
        return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
    }

    function getProduct(data, productId) {
        return data.products.find(function (product) { return product.id === productId; });
    }

    function getCustomer(data, customerId) {
        return data.customers.find(function (customer) { return customer.id === customerId; });
    }

    function reset() {
        save(clone(DEMO_DATA));
        return clone(DEMO_DATA);
    }

    function snapshot() {
        return clone(load());
    }

    function addProduct(product) {
        const data = load();
        const name = String(product.name || "").trim();
        const spec = String(product.spec || "标准款").trim();
        const category = String(product.category || "").trim();
        const price = Number(product.price);
        const cost = Number(product.cost);
        const stock = Number(product.stock);
        const warningStock = Number(product.warningStock);

        if (!name || !spec || !category) throw new Error("商品名称、规格和类别不能为空");
        if (data.products.some(function (item) { return item.name === name && item.spec === spec; })) throw new Error("这个商品及规格已经存在");
        if (!Number.isFinite(price) || price < 0) throw new Error("商品价格不能小于 0");
        if (!Number.isFinite(cost) || cost < 0) throw new Error("采购成本不能小于 0");
        if (cost > price) throw new Error("采购成本不能高于销售价");
        if (!Number.isInteger(stock) || stock < 0) throw new Error("库存必须是大于或等于 0 的整数");
        if (!Number.isInteger(warningStock) || warningStock < 0) throw new Error("预警数量必须是大于或等于 0 的整数");

        const newProduct = {
            id: nextId("P", data.products, 3),
            name: name,
            spec: spec,
            category: category,
            price: price,
            cost: cost,
            stock: stock,
            warningStock: warningStock,
            status: product.status === "已停用" ? "已停用" : "正常销售"
        };
        data.products.push(newProduct);
        if (stock > 0) {
            data.stockRecords.unshift({
                id: nextId("S", data.stockRecords, 3),
                productId: newProduct.id,
                type: "期初库存",
                quantity: stock,
                date: getToday(),
                relatedId: "NEW-PRODUCT"
            });
        }
        save(data);
        return clone(newProduct);
    }

    function updateProduct(productId, changes) {
        const data = load();
        const product = getProduct(data, productId);
        if (!product) throw new Error("商品不存在");

        const name = String(changes.name || "").trim();
        const spec = String(changes.spec || "标准款").trim();
        const category = String(changes.category || "").trim();
        const price = Number(changes.price);
        const cost = Number(changes.cost);
        const warningStock = Number(changes.warningStock);
        if (!name || !spec || !category) throw new Error("商品名称、规格和类别不能为空");
        if (data.products.some(function (item) { return item.id !== productId && item.name === name && item.spec === spec; })) throw new Error("这个商品及规格已经存在");
        if (!Number.isFinite(price) || price < 0) throw new Error("商品价格不能小于 0");
        if (!Number.isFinite(cost) || cost < 0) throw new Error("采购成本不能小于 0");
        if (cost > price) throw new Error("采购成本不能高于销售价");
        if (!Number.isInteger(warningStock) || warningStock < 0) throw new Error("预警数量必须是大于或等于 0 的整数");

        product.name = name;
        product.spec = spec;
        product.category = category;
        product.price = price;
        product.cost = cost;
        product.warningStock = warningStock;
        product.status = changes.status === "已停用" ? "已停用" : "正常销售";
        save(data);
        return clone(product);
    }

    function toggleProduct(productId) {
        const data = load();
        const product = getProduct(data, productId);
        if (!product) throw new Error("商品不存在");
        product.status = product.status === "正常销售" ? "已停用" : "正常销售";
        save(data);
        return clone(product);
    }

    function addCustomer(customer) {
        const data = load();
        const name = String(customer.name || "").trim();
        const phone = String(customer.phone || "").trim();
        const region = String(customer.region || "").trim();
        if (!name || !phone || !region) throw new Error("姓名、电话和地区不能为空");
        if (!/^1\d{10}$/.test(phone)) throw new Error("请输入 11 位手机号码");
        if (data.customers.some(function (item) { return item.phone === phone; })) throw new Error("这个手机号码已经存在");

        const newCustomer = {
            id: nextId("C", data.customers, 3),
            name: name,
            phone: phone,
            region: region,
            type: customer.type === "老客户" ? "老客户" : "新客户",
            points: 0
        };
        data.customers.push(newCustomer);
        save(data);
        return clone(newCustomer);
    }

    function updateCustomer(customerId, changes) {
        const data = load();
        const customer = getCustomer(data, customerId);
        if (!customer) throw new Error("客户不存在");
        const name = String(changes.name || "").trim();
        const phone = String(changes.phone || "").trim();
        const region = String(changes.region || "").trim();
        if (!name || !phone || !region) throw new Error("姓名、电话和地区不能为空");
        if (!/^1\d{10}$/.test(phone)) throw new Error("请输入 11 位手机号码");
        if (data.customers.some(function (item) { return item.id !== customerId && item.phone === phone; })) throw new Error("这个手机号码已经存在");
        customer.name = name;
        customer.phone = phone;
        customer.region = region;
        customer.type = changes.type === "老客户" ? "老客户" : "新客户";
        save(data);
        return clone(customer);
    }

    function createOrder(orderInput) {
        const data = load();
        const customer = getCustomer(data, orderInput.customerId);
        if (!customer) throw new Error("请选择有效客户");
        if (!Array.isArray(orderInput.items) || orderInput.items.length === 0) throw new Error("订单至少需要一个商品");

        const quantityByProduct = {};
        orderInput.items.forEach(function (item) {
            const productId = String(item.productId || "");
            const quantity = Number(item.quantity);
            if (!productId) throw new Error("请选择商品");
            if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("购买数量必须是正整数");
            quantityByProduct[productId] = (quantityByProduct[productId] || 0) + quantity;
        });

        const normalizedItems = [];
        let total = 0;
        Object.keys(quantityByProduct).forEach(function (productId) {
            const product = getProduct(data, productId);
            const quantity = quantityByProduct[productId];
            if (!product) throw new Error("订单中的商品不存在");
            if (product.status !== "正常销售") throw new Error(product.name + " 已停用，不能下单");
            if (quantity > product.stock) throw new Error(product.name + " 库存不足，当前只有 " + product.stock + " 件");
            normalizedItems.push({ productId: product.id, quantity: quantity, unitPrice: product.price, unitCost: product.cost });
            total += product.price * quantity;
        });

        const date = orderInput.date || getToday();
        const monthPart = date.replace(/-/g, "").slice(0, 6);
        const sameMonthOrders = data.orders.filter(function (order) { return order.id.indexOf("O" + monthPart) === 0; });
        const orderId = "O" + monthPart + String(sameMonthOrders.length + 1).padStart(3, "0");
        if (data.orders.some(function (order) { return order.id === orderId; })) throw new Error("订单编号重复，请刷新后重试");

        normalizedItems.forEach(function (item) {
            const product = getProduct(data, item.productId);
            product.stock -= item.quantity;
            data.stockRecords.unshift({
                id: nextId("S", data.stockRecords, 3),
                productId: item.productId,
                type: "下单锁定",
                quantity: -item.quantity,
                date: date,
                relatedId: orderId
            });
        });

        const subtotal = Number(total.toFixed(2));
        const discount = Math.max(0, Math.min(subtotal, Number(orderInput.discount || 0)));
        const shippingFee = Math.max(0, Number(orderInput.shippingFee || 0));
        const order = {
            id: orderId,
            date: date,
            customerId: customer.id,
            status: "待付款",
            subtotal: subtotal,
            discount: Number(discount.toFixed(2)),
            shippingFee: Number(shippingFee.toFixed(2)),
            total: Number((subtotal + shippingFee - discount).toFixed(2)),
            appliedCoupon: orderInput.appliedCoupon ? clone(orderInput.appliedCoupon) : null,
            rewardPoints: 0,
            rewardReversed: false,
            items: normalizedItems
        };
        data.orders.unshift(order);
        save(data);
        return clone(order);
    }

    function cancelOrder(orderId) {
        const data = load();
        const order = data.orders.find(function (item) { return item.id === orderId; });
        if (!order) throw new Error("订单不存在");
        if (["待付款", "待发货"].indexOf(order.status) === -1) throw new Error("只有待付款或待发货订单可以取消");

        order.items.forEach(function (item) {
            const product = getProduct(data, item.productId);
            if (product) product.stock += item.quantity;
            data.stockRecords.unshift({
                id: nextId("S", data.stockRecords, 3),
                productId: item.productId,
                type: "取消订单恢复",
                quantity: item.quantity,
                date: getToday(),
                relatedId: order.id
            });
        });
        reverseOrderReward(data, order, "取消订单积分退回");
        order.status = "已取消";
        save(data);
        return clone(order);
    }

    function advanceOrder(orderId) {
        const data = load();
        const order = data.orders.find(function (item) { return item.id === orderId; });
        const nextStatus = { "待付款": "待发货", "待发货": "已发货", "已发货": "已完成" };
        if (!order) throw new Error("订单不存在");
        if (!nextStatus[order.status]) throw new Error("当前状态不能继续推进");
        const previousStatus = order.status;
        order.status = nextStatus[order.status];
        if (previousStatus === "待付款") {
            const customer = getCustomer(data, order.customerId);
            const alreadyGranted = data.pointRecords.filter(function (record) {
                return record.relatedId === order.id && record.type === "购物奖励";
            }).reduce(function (sum, record) { return sum + Number(record.points || 0); }, 0);
            if (customer && alreadyGranted <= 0) {
                const reward = Math.max(1, Math.floor(Number(order.total || 0)));
                customer.points = Number(customer.points || 0) + reward;
                order.rewardPoints = reward;
                data.pointRecords.unshift({
                    id: nextId("PT", data.pointRecords, 3),
                    customerId: customer.id,
                    points: reward,
                    type: "购物奖励",
                    date: getToday(),
                    relatedId: order.id
                });
            } else {
                order.rewardPoints = Math.max(0, alreadyGranted);
            }
        }
        save(data);
        return clone(order);
    }

    function requestReturn(orderId) {
        const data = load();
        const order = data.orders.find(function (item) { return item.id === orderId; });
        if (!order) throw new Error("订单不存在");
        if (["已发货", "已完成"].indexOf(order.status) === -1) throw new Error("只有已发货或已完成订单可以申请退货");
        order.status = "退货处理中";
        save(data);
        return clone(order);
    }

    function completeRefund(orderId) {
        const data = load();
        const order = data.orders.find(function (item) { return item.id === orderId; });
        if (!order) throw new Error("订单不存在");
        if (order.status !== "退货处理中") throw new Error("只有退货处理中的订单可以确认退款");
        order.items.forEach(function (item) {
            const product = getProduct(data, item.productId);
            if (product) product.stock += item.quantity;
            data.stockRecords.unshift({
                id: nextId("S", data.stockRecords, 3),
                productId: item.productId,
                type: "退货入库",
                quantity: item.quantity,
                date: getToday(),
                relatedId: order.id
            });
        });
        reverseOrderReward(data, order, "退款积分退回");
        order.status = "已退款";
        save(data);
        return clone(order);
    }

    function reverseOrderReward(data, order, reason) {
        if (order.rewardReversed) return;
        const granted = Number(order.rewardPoints || data.pointRecords.filter(function (record) {
            return record.relatedId === order.id && record.type === "购物奖励";
        }).reduce(function (sum, record) { return sum + Math.max(0, Number(record.points || 0)); }, 0));
        if (granted <= 0) {
            order.rewardReversed = true;
            return;
        }
        const customer = getCustomer(data, order.customerId);
        if (customer) customer.points = Number(customer.points || 0) - granted;
        data.pointRecords.unshift({
            id: nextId("PT", data.pointRecords, 3),
            customerId: order.customerId,
            points: -granted,
            type: reason,
            date: getToday(),
            relatedId: order.id
        });
        order.rewardPoints = granted;
        order.rewardReversed = true;
    }

    function adjustStock(productId, quantity, type) {
        const data = load();
        const product = getProduct(data, productId);
        const change = Number(quantity);
        if (!product) throw new Error("商品不存在");
        if (!Number.isInteger(change) || change === 0) throw new Error("库存变化数量必须是非 0 整数");
        if (product.stock + change < 0) throw new Error("出库数量不能超过当前库存");

        product.stock += change;
        data.stockRecords.unshift({
            id: nextId("S", data.stockRecords, 3),
            productId: product.id,
            type: type || (change > 0 ? "手工入库" : "手工出库"),
            quantity: change,
            date: getToday(),
            relatedId: "MANUAL"
        });
        save(data);
        return clone(product);
    }

    function changePoints(customerId, points, type, relatedId) {
        const data = load();
        const customer = getCustomer(data, customerId);
        const change = Math.trunc(Number(points));
        if (!customer) throw new Error("会员不存在");
        if (!Number.isFinite(change) || change === 0) throw new Error("积分变化必须是非 0 整数");
        if (Number(customer.points || 0) + change < 0) throw new Error("当前积分不足");
        customer.points = Number(customer.points || 0) + change;
        data.pointRecords.unshift({
            id: nextId("PT", data.pointRecords, 3),
            customerId: customer.id,
            points: change,
            type: String(type || (change > 0 ? "积分增加" : "积分兑换")),
            date: getToday(),
            relatedId: String(relatedId || "POINTS")
        });
        save(data);
        return clone(customer);
    }

    function getDashboard() {
        const data = load();
        const validOrders = data.orders.filter(function (order) { return SALES_STATUSES.indexOf(order.status) !== -1; });
        const sales = validOrders.reduce(function (sum, order) { return sum + order.total; }, 0);
        const grossProfit = validOrders.reduce(function (sum, order) {
            return sum + order.items.reduce(function (itemSum, item) {
                return itemSum + (item.unitPrice - item.unitCost) * item.quantity;
            }, 0);
        }, 0);
        const lowStock = data.products.filter(function (product) { return product.status === "正常销售" && product.stock <= product.warningStock; });
        return {
            totalSales: Number(sales.toFixed(2)),
            grossProfit: Number(grossProfit.toFixed(2)),
            grossMargin: sales ? Number((grossProfit / sales * 100).toFixed(1)) : 0,
            validOrderCount: validOrders.length,
            productCount: data.products.length,
            activeProductCount: data.products.filter(function (product) { return product.status === "正常销售"; }).length,
            customerCount: data.customers.length,
            lowStock: clone(lowStock),
            recentOrders: clone(data.orders.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 5))
        };
    }

    function getAnalysis() {
        const data = load();
        const validOrders = data.orders.filter(function (order) { return SALES_STATUSES.indexOf(order.status) !== -1; });
        const months = {};
        const categories = {};
        const products = {};
        const regions = {};

        validOrders.forEach(function (order) {
            const month = order.date.slice(0, 7);
            months[month] = (months[month] || 0) + order.total;
            const customer = getCustomer(data, order.customerId);
            const region = customer ? customer.region.slice(0, 2) : "未知";
            regions[region] = (regions[region] || 0) + order.total;

            order.items.forEach(function (item) {
                const product = getProduct(data, item.productId);
                if (!product) return;
                const amount = item.quantity * item.unitPrice;
                categories[product.category] = (categories[product.category] || 0) + amount;
                if (!products[product.id]) products[product.id] = { id: product.id, name: product.name, quantity: 0, amount: 0 };
                products[product.id].quantity += item.quantity;
                products[product.id].amount += amount;
            });
        });

        function objectToList(object, nameKey) {
            return Object.keys(object).map(function (key) {
                const item = {};
                item[nameKey] = key;
                item.amount = Number(object[key].toFixed(2));
                return item;
            }).sort(function (a, b) { return b.amount - a.amount; });
        }

        return {
            monthlySales: Object.keys(months).sort().map(function (month) { return { month: month, amount: Number(months[month].toFixed(2)) }; }),
            categorySales: objectToList(categories, "category"),
            regionSales: objectToList(regions, "region"),
            topProducts: Object.keys(products).map(function (key) { return products[key]; }).sort(function (a, b) { return b.quantity - a.quantity; }),
            averageOrderAmount: validOrders.length ? Number((validOrders.reduce(function (sum, order) { return sum + order.total; }, 0) / validOrders.length).toFixed(2)) : 0,
            grossProfit: Number(validOrders.reduce(function (sum, order) {
                return sum + order.items.reduce(function (itemSum, item) {
                    return itemSum + (item.unitPrice - item.unitCost) * item.quantity;
                }, 0);
            }, 0).toFixed(2)),
            refundedAmount: Number(data.orders.filter(function (order) { return order.status === "已退款"; }).reduce(function (sum, order) { return sum + order.total; }, 0).toFixed(2)),
            pendingPaymentAmount: Number(data.orders.filter(function (order) { return order.status === "待付款"; }).reduce(function (sum, order) { return sum + order.total; }, 0).toFixed(2)),
            cancelledCount: data.orders.filter(function (order) { return order.status === "已取消"; }).length
        };
    }

    window.dataService = {
        reset: reset,
        snapshot: snapshot,
        addProduct: addProduct,
        updateProduct: updateProduct,
        toggleProduct: toggleProduct,
        addCustomer: addCustomer,
        updateCustomer: updateCustomer,
        createOrder: createOrder,
        cancelOrder: cancelOrder,
        advanceOrder: advanceOrder,
        requestReturn: requestReturn,
        completeRefund: completeRefund,
        adjustStock: adjustStock,
        changePoints: changePoints,
        operate: function () { throw new Error("此功能需要通过本地启动按钮运行商城"); },
        getDashboard: getDashboard,
        getAnalysis: getAnalysis,
        futurePorts: FUTURE_PORTS
    };

    if (window.serverApi && window.serverApi.enabled) {
        const localService = window.dataService;
        function run(type, payload) { return window.serverApi.operation(type, payload).result; }
        window.dataService = {
            reset: function () { return run("reset"); },
            snapshot: function () { return clone(window.serverApi.getState(localService.snapshot())); },
            addProduct: function (product) { return run("addProduct", product); },
            updateProduct: function (productId, changes) { return run("updateProduct", { productId: productId, changes: changes }); },
            toggleProduct: function (productId) { return run("toggleProduct", { productId: productId }); },
            addCustomer: function (customer) { return run("addCustomer", customer); },
            updateCustomer: function (customerId, changes) { return run("updateCustomer", { customerId: customerId, changes: changes }); },
            createOrder: function (input) { return run("createOrder", input); },
            cancelOrder: function (orderId) { return run("cancelOrder", { orderId: orderId }); },
            advanceOrder: function (orderId) { return run("advanceOrder", { orderId: orderId }); },
            requestReturn: function (orderId) { return run("requestReturn", { orderId: orderId }); },
            completeRefund: function (orderId) { return run("completeRefund", { orderId: orderId }); },
            adjustStock: function (productId, quantity, type) { return run("adjustStock", { productId: productId, quantity: quantity, type: type }); },
            changePoints: function (customerId, points, type, relatedId) { return run("changePoints", { customerId: customerId, points: points, type: type, relatedId: relatedId }); },
            operate: function (type, payload) { return run(type, payload || {}); },
            getDashboard: function () { return getDashboardFromData(window.dataService.snapshot()); },
            getAnalysis: function () { return getAnalysisFromData(window.dataService.snapshot()); },
            futurePorts: Object.assign({}, FUTURE_PORTS, { currentAdapter: "Node.js 24 + SQLite" })
        };

        function withRemoteSnapshot(callback) {
            const original = localStorage.getItem(STORAGE_KEY);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(window.dataService.snapshot()));
            try { return callback(); }
            finally { if (original == null) localStorage.removeItem(STORAGE_KEY); else localStorage.setItem(STORAGE_KEY, original); }
        }
        function getDashboardFromData() { return withRemoteSnapshot(function () { return getDashboard(); }); }
        function getAnalysisFromData() { return withRemoteSnapshot(function () { return getAnalysis(); }); }
    }
})();
