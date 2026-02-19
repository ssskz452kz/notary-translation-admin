# GitHub 部署指南

## 📦 上传到 GitHub

### 1. 创建 GitHub 仓库

1. 登录 GitHub：https://github.com
2. 点击右上角 **"+"** → **"New repository"**
3. 填写信息：
   - **Repository name**：`notary-translation-admin`（或你喜欢的名字）
   - **Description**：公证翻译管理后台
   - **Visibility**：Private（推荐，因为包含敏感配置）或 Public
   - ✅ 不要勾选 "Initialize this repository with a README"（因为已有文件）
4. 点击 **"Create repository"**

### 2. 上传文件

**方式 A：使用 GitHub Desktop（最简单）**

1. 下载 GitHub Desktop：https://desktop.github.com
2. 安装后登录你的 GitHub 账号
3. File → Clone Repository → 选择刚创建的仓库
4. 把 `notary-translation-admin` 文件夹里的所有文件复制到克隆的文件夹
5. 在 GitHub Desktop 中：
   - 填写 Commit message（如："Initial commit: 公证翻译管理后台"）
   - 点击 **"Commit to main"**
   - 点击 **"Push origin"**

**方式 B：使用 Git 命令行**

```bash
# 1. 进入项目文件夹
cd notary-translation-admin

# 2. 初始化 Git
git init

# 3. 添加所有文件
git add .

# 4. 提交
git commit -m "Initial commit: 公证翻译管理后台"

# 5. 添加远程仓库（替换 YOUR_USERNAME 和 YOUR_REPO_NAME）
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 6. 推送到 GitHub
git branch -M main
git push -u origin main
```

**方式 C：直接在网页上传**

1. 在 GitHub 仓库页面，点击 **"uploading an existing file"**
2. 拖拽整个 `notary-translation-admin` 文件夹里的所有文件
3. 填写 Commit message
4. 点击 **"Commit changes"**

---

## ⚠️ 重要：关于 config.js

**`config.js` 包含敏感信息（serviceRoleKey），上传到 GitHub 后会暴露。**

### 选项 1：上传真实配置（简单但不安全）

- 直接上传 `config.js`（包含真实 key）
- ⚠️ 如果仓库是 Public，任何人都能看到
- ✅ 如果仓库是 Private，只有你有权限访问

### 选项 2：使用模板（更安全）

1. 上传 `config.example.js`（模板文件）
2. **不要**上传 `config.js`（添加到 .gitignore）
3. 在 README 中说明：部署时需要复制 `config.example.js` 为 `config.js` 并填写真实配置

**如果选择选项 2，需要修改 .gitignore：**

在 `.gitignore` 中添加：
```
config.js
```

---

## 🚀 从 GitHub 部署到 Vercel

### 1. 连接 GitHub 仓库

1. 登录 Vercel：https://vercel.com
2. 点击 **"Add New Project"**
3. 选择 **"Import Git Repository"**
4. 选择你刚创建的 GitHub 仓库
5. 点击 **"Import"**

### 2. 配置项目

- **Framework Preset**：选择 **"Other"** 或 **"Static"**
- **Root Directory**：`./`（如果文件在根目录）
- **Build Command**：留空（纯静态文件，无需构建）
- **Output Directory**：`./`（当前目录）

### 3. 环境变量（如果使用选项 2）

如果 `config.js` 在 .gitignore 中，需要在 Vercel 设置环境变量：

1. 项目设置 → **Settings** → **Environment Variables**
2. 添加变量（但前端无法直接读取环境变量，所以不适用）

**实际上，对于纯前端项目，config.js 必须提交到仓库才能使用。**

### 4. 部署

点击 **"Deploy"**，Vercel 会自动：
- 从 GitHub 拉取代码
- 部署到 `your-project.vercel.app`
- 每次你 push 代码到 GitHub，Vercel 会自动重新部署

### 5. 添加域名

1. 项目设置 → **Settings** → **Domains**
2. 添加 `admin.qazaq.fyi`（或你想要的子域名）
3. 按照提示配置 DNS

---

## 📝 推荐流程

1. ✅ 创建 GitHub 仓库（设为 **Private**）
2. ✅ 上传所有文件（包括 `config.js`）
3. ✅ 在 Vercel 连接 GitHub 仓库并部署
4. ✅ 添加子域名 `admin.qazaq.fyi`
5. ✅ 配置 DNS
6. ✅ 完成！

**注意**：如果仓库是 Private，只有你能看到代码和 `serviceRoleKey`，相对安全。如果必须设为 Public，建议定期更换 `serviceRoleKey`。
