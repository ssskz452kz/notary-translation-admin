// Supabase 配置
// 注意：管理后台需要使用 service_role key 以访问所有订单（绕过RLS）
const SUPABASE_CONFIG = {
    url: 'https://lxfkdmtfzzyxkgzgcgse.supabase.co', // 例如: https://xxxxx.supabase.co
    serviceRoleKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmtkbXRmenp5eGtnemdjZ3NlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTUyNjEyNywiZXhwIjoyMDc3MTAyMTI3fQ.022GnMg-fgB11jpY0zDQQUo4sWBi83fhaURsR9nnN6k' // 从 Supabase Dashboard -> Settings -> API 获取
};

// 简单的身份验证密码（可选，也可以使用 Supabase Auth）
const ADMIN_PASSWORD = '2026';
