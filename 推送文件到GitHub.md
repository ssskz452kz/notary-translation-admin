# 推送 vercel.json 到 GitHub

## 重要提示
GitHub 从 2021 年 8 月起不再支持密码认证，需要使用 **Personal Access Token**。

## 快速步骤

### 1. 生成 Personal Access Token

1. 访问：https://github.com/settings/tokens
2. 点击 **"Generate new token"** → **"Generate new token (classic)"**
3. 填写信息：
   - **Note**: `notary-translation-admin-push`
   - **Expiration**: 选择合适的时间（建议 90 天或 No expiration）
   - **勾选权限**: 至少勾选 `repo` 下的所有权限
4. 点击 **"Generate token"**
5. **重要**：立即复制生成的 token（类似 `ghp_xxxxxxxxxxxxxxxxxxxx`），关闭页面后就看不到了！

### 2. 使用 Token 推送

**方法 A：命令行推送（推荐）**

在 PowerShell 中运行：
```powershell
cd e:\Qadam
git push -u origin main
```

当提示输入密码时：
- **Username**: `s2774292026@gmail.com` 或 `ssskz452kz`
- **Password**: 粘贴刚才复制的 **Personal Access Token**（不是密码！）

**方法 B：配置凭据存储**

如果你想保存凭据，运行：
```powershell
git config --global credential.helper wincred
git push -u origin main
```

然后输入用户名和 Token，Windows 会保存凭据。

---

## 如果遇到问题

### 问题：仍然提示密码错误
- 确保使用的是 **Token** 而不是密码
- 确保 Token 有 `repo` 权限
- 检查 Token 是否过期

### 问题：权限被拒绝
- 确认 Token 有正确的权限
- 确认仓库属于 `ssskz452kz` 账号

---

## 推送成功后

推送成功后，Vercel 会自动检测到新的提交并重新部署。等待 1-2 分钟，然后访问：
- https://admin.qazaq.fyi
- https://notary-translation-admin.vercel.app

应该能看到登录页面，而不是 404 错误。
