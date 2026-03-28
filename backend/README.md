# 运势网站后端部署指南

## 📁 文件结构

```
fortune/
├── index.html          # 前端页面（已更新支持后端API）
└── backend/
    ├── server.js       # Express API 服务器
    ├── package.json    # 依赖配置
    ├── .env.example    # 环境变量示例
    └── render.yaml     # Render 部署配置
```

## 🚀 一键部署

### 方式一：一键部署到 Render（推荐）

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/CaroNiu/fortune)

点击上面的按钮，登录 Render 账号即可自动部署。

MongoDB 已配置完成，无需额外设置。

### 方式二：手动部署

1. 访问 https://render.com
2. 登录后点击 **New +** → **Web Service**
3. 选择 GitHub 仓库 `CaroNiu/fortune`
4. 配置会自动读取 `render.yaml`，直接点击 **Create Web Service**
5. 等待 2-3 分钟部署完成

### 获取后端地址

部署完成后，Render 会给你分配一个域名：
```
https://fortune-backend-xxx.onrender.com
```

复制这个地址，下一步更新到前端。

### 更新前端 API 地址

编辑 `index.html` 第 251 行，把：
```javascript
const API_BASE = 'https://fortune-backend.onrender.com/api';
```

换成你的实际域名。

### 部署前端

把 `index.html` 部署到 Vercel / Netlify / GitHub Pages，或者直接本地打开也能用。

---

## 📡 API 接口文档

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/auth` | POST | 注册/登录 |
| `/api/fortune/:userId` | GET | 获取今日运势 |
| `/api/checkin` | POST | 打卡 |
| `/api/checkins/:userId` | GET | 获取打卡历史 |
| `/api/user/:userId` | DELETE | 删除用户数据 |

---

## 🔒 安全说明

- 生产环境建议添加 JWT 鉴权
- MongoDB 连接字符串不要提交到 Git
- 考虑添加请求频率限制 (rate limit)
- 敏感操作加验证码

---

## 💰 费用预估

| 服务 | 免费额度 | 超出费用 |
|------|---------|---------|
| MongoDB Atlas | 512MB 存储 | $0.25/GB/月 |
| Render Web Service | 750小时/月 | $7/月 |
| 前端托管 (Vercel) | 100GB 流量 | $0.4/GB |

**结论：月活1万以内完全免费**

---

## 🛠 本地开发

```bash
cd backend
npm install

# 创建 .env 文件
cp .env.example .env
# 编辑 .env 填入 MONGODB_URI

npm run dev
```

前端直接打开 `index.html` 即可。
