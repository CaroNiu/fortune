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

## 🚀 部署步骤

### 第一步：创建 MongoDB 数据库（免费）

1. 访问 https://www.mongodb.com/atlas
2. 注册/登录，选择 **免费版 (M0)**
3. 创建 Cluster，选择 AWS / Singapore 地区
4. 在 **Database Access** 创建用户（记住用户名密码）
5. 在 **Network Access** 添加 IP：`0.0.0.0/0`（允许所有IP）
6. 点击 **Connect** → Drivers → Node.js → 复制连接字符串

连接字符串格式：
```
mongodb+srv://username:password@cluster.xxx.mongodb.net/fortune?retryWrites=true&w=majority
```

### 第二步：部署后端到 Render（免费）

1. 把代码推送到 GitHub 仓库
2. 访问 https://render.com
3. 登录后点击 **New +** → **Web Service**
4. 选择你的 GitHub 仓库
5. 配置：
   - **Name**: fortune-backend
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
6. 添加环境变量：
   - `MONGODB_URI`: 你的 MongoDB 连接字符串
7. 点击 **Create Web Service**
8. 等待部署完成，复制生成的域名

### 第三步：更新前端 API 地址

编辑 `index.html`，找到这行：

```javascript
const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : 'https://fortune-backend.onrender.com/api';
```

把 `https://fortune-backend.onrender.com/api` 换成你的 Render 域名。

### 第四步：部署前端

把 `index.html` 部署到任何静态托管：
- Vercel
- Netlify
- GitHub Pages
- 腾讯云静态托管

或者直接双击在本地打开也能用（连接线上后端）。

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
