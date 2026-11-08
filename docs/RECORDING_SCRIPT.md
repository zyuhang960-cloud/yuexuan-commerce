# 2-Minute Demo Recording Script

Record the screen (OBS Studio or Windows Game Bar `Win + G`), 1920×1080, no audio needed if you add captions. If you do narrate, speak slowly and keep each line to one sentence.

| # | 时间 | 画面（点什么） | 口播 / 字幕（英文） |
|---|---|---|---|
| 1 | 0:00–0:15 | 首页，慢慢往下滚一次 | "This is Yuexuan Commerce, a full-stack e-commerce demo I built with Node.js and SQLite, no frameworks." |
| 2 | 0:15–0:35 | 点分类、搜索“咖啡”、筛选价格 | "Shoppers can browse 228 products by category, search, filter and compare." |
| 3 | 0:35–1:00 | 注册或登录 → 加购两件 → 结算 → 下单成功 | "Registration enforces password strength. Cart and checkout write a real order and deduct stock in the database." |
| 4 | 1:00–1:20 | 我的 → 订单 → 看进度；积分/优惠券 | "Orders keep a delivery timeline; coupons and points roll back correctly when an order is cancelled." |
| 5 | 1:20–1:45 | 退出 → 商家账号登录 → 商品管理改价 → 订单发货 → 看板 | "The same login window routes merchants to a back office: products, stock, orders and a dashboard." |
| 6 | 1:45–2:00 | 命令行 `npm test` 跑完 11 个测试 | "Eleven API tests cover the business rules; everything runs locally with one double-click." |

## Recording checklist

1. 录之前先双击 `停止悦选商城.bat`，再双击 `启动悦选商城.bat`，这样数据库是干净的最新状态。
2. 浏览器按 `F11` 全屏，缩放 `Ctrl + 0` 归位，关掉其他标签页和微信弹窗。
3. 鼠标移动慢一点，每一步停 1 秒再点，别甩。
4. 录完用剪映或 Clipchamp 剪掉开头结尾的空镜，导 1080p MP4。
5. 上传 YouTube：可见性选 **Unlisted（不公开列出）**，把链接复制进 README 的第一行。

## 如果不想露声音

只做录屏 + 在上面表格的“口播/字幕”里挑英文句子做成字幕，一样能用。招生官看的是页面能不能跑，不是口音。
