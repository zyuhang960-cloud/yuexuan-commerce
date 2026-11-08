# 简历要加的内容（照抄）

## 1. 名字下面那行空白（老师圈出来的位置）

```
GitHub: github.com/yuhang-cs    |    Portfolio: Yuexuan Commerce (see Projects)
```

如果只能放一行，就写：

```
github.com/yuhang-cs
```

## 2. 项目段落（加在 PROFESSIONAL EXPERIENCE & PROJECTS 最前面）

```
Yuexuan Commerce — Full-Stack E-Commerce Platform | Personal Project | 2026
github.com/yuhang-cs/yuexuan-commerce
- Built a complete e-commerce system from scratch with Node.js and SQLite, without any framework: 228-product catalogue, accounts, cart, checkout, orders, and a merchant back office.
- Designed the database state model and a single transactional API layer; implemented session-based authentication and role checks so shopper and merchant permissions never overlap.
- Wrote 11 API-level tests with node:test covering stock deduction, coupon and points rollback, refunds and access control; all passing.
- Shipped as a one-click local app with a bundled Node runtime, installable as a PWA, with images optimised from 50 MB to 3.9 MB for fast first load.
```

## 3. 面试一句话（口头）

"这个项目是我实习之后自己做的：实习让我看到库存、订单、账目必须对得上，所以我用一个 Node 服务加一个 SQLite 数据库，把从下单到发货的整条链路自己写了一遍，并且用 11 个测试保证退款和优惠券不会算错。"
