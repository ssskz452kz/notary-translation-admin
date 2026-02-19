# 公证翻译管理后台设置说明

## 配置步骤

### 1. 配置 Supabase 连接

编辑 `config.js` 文件，填入你的 Supabase 配置：

```javascript
const SUPABASE_CONFIG = {
    url: 'YOUR_SUPABASE_URL', // 例如: https://xxxxx.supabase.co
    serviceRoleKey: 'YOUR_SERVICE_ROLE_KEY' // 从 Supabase Dashboard -> Settings -> API 获取
};
```

**重要：** 必须使用 `service_role` key（而不是 `anon` key），这样才能绕过 RLS 策略访问所有订单。

### 2. 创建系统设置表（可选，用于系统设置功能）

在 Supabase SQL Editor 中执行 `../database/notary_admin_settings.sql`，创建系统设置表并插入默认配置。

### 3. 身份验证

- **永久密码**：`20040404`，写死在代码中，不可在后台修改，随时可用。
- **可修改密码**：默认 `2026`，可在「系统设置」中修改并保存到数据库；若未建设置表则使用 `config.js` 中的 `ADMIN_PASSWORD`。  
  登录时输入永久密码或当前可修改密码均可进入后台。

### 4. 运行管理后台

直接在浏览器中打开 `index.html` 或使用本地服务器：

```bash
# 使用 Python
python -m http.server 8000

# 或使用 Node.js
npx http-server
```

然后访问 `http://localhost:8000/index.html`

## 功能说明

### 系统设置
- **安全设置**：修改管理员登录密码

### 服务类型
- **预设服务类型**：身份证/护照、出生证/结婚证、成绩单/毕业证、无犯罪证明、其他类型
- **价格管理**：各类型基准价格可单独修改并保存
- **附加费用**：加急费、纸质版配送费
- **历史自定义类型**：用户选择「其他」时填写的类型及订单数

### 数据统计
- **概览**：总订单数、待处理、处理中、已完成、已取消
- **收入统计**：今日、本周、本月、总收入
- **按服务类型**：各类型订单数与收入
- **按订单状态**：各状态订单数
- **近7日趋势**：每日订单数与收入
- 支持日期范围筛选

### 订单管理
- 查看所有订单列表
- 按状态、服务类型、日期筛选
- 搜索订单（按订单号、客户姓名、电话）

### 订单详情
- 查看完整订单信息
- 查看订单文件（可下载）
- 更新订单状态
- 添加/编辑备注
- WhatsApp 联系客户（点击按钮直接打开 WhatsApp）

### 订单状态
- **PENDING** (订单上传成功) - 用户刚提交订单
- **CONTACTED** (等待公证处联系) - 翻译公司已通过WhatsApp联系用户
- **CONFIRMED** (已确认订单) - 用户确认价格和资料真实性
- **IN_PROGRESS** (正在做) - 翻译公司正在处理订单
- **COMPLETED** (已做完) - 翻译和公证已完成
- **RECEIVED** (已收货) - 用户已收到文件
- **CANCELLED** (已取消) - 订单被取消

## 注意事项

1. 管理后台使用 service_role key，具有完全访问权限，请妥善保管
2. WhatsApp 链接会自动格式化电话号码（去掉+号和空格）
3. 文件下载链接需要确保 Supabase Storage bucket 是公开的，或者配置适当的权限
4. 建议在生产环境中添加更严格的身份验证（如 Supabase Auth）
