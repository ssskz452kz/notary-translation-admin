// Supabase 配置模板
// 复制此文件为 config.js 并填入你的真实配置

// 注意：管理后台需要使用 service_role key 以访问所有订单（绕过RLS）
const SUPABASE_CONFIG = {
    url: 'YOUR_SUPABASE_URL', // 例如: https://xxxxx.supabase.co
    serviceRoleKey: 'YOUR_SERVICE_ROLE_KEY' // 从 Supabase Dashboard -> Settings -> API 获取
};

// 简单的身份验证密码（可选，也可以使用 Supabase Auth）
const ADMIN_PASSWORD = '2026';
