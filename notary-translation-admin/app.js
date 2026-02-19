// 永久密码：独立于后台设置，不可在系统设置中修改，始终有效
const ADMIN_PERMANENT_PASSWORD = '20040404';

// 登录逻辑
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const passwordInput = document.getElementById('password');
            const password = passwordInput.value;
            
            // 永久密码优先，输入即通过
            if (password === ADMIN_PERMANENT_PASSWORD) {
                sessionStorage.setItem('adminLoggedIn', 'true');
                window.location.href = 'dashboard.html';
                return;
            }
            
            // 否则校验可修改的密码：优先数据库 admin_password，否则 config.js 的 ADMIN_PASSWORD
            let validPassword = typeof ADMIN_PASSWORD !== 'undefined' ? ADMIN_PASSWORD : '';
            
            if (typeof supabase !== 'undefined' && typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.url && SUPABASE_CONFIG.serviceRoleKey) {
                try {
                    const client = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.serviceRoleKey);
                    const { data } = await client.from('notary_admin_settings').select('value').eq('key', 'admin_password').single();
                    if (data && data.value !== undefined && data.value !== null) {
                        const stored = typeof data.value === 'string' ? data.value.replace(/^"|"$/g, '') : String(data.value);
                        if (stored) validPassword = stored;
                    }
                } catch (err) {
                    console.warn('从数据库读取密码失败，使用默认配置:', err);
                }
            }
            
            if (password === validPassword) {
                sessionStorage.setItem('adminLoggedIn', 'true');
                window.location.href = 'dashboard.html';
            } else {
                alert('密码错误，请重试');
                passwordInput.value = '';
                passwordInput.focus();
            }
        });
    }
    
    // 检查是否已登录（所有管理后台页面：dashboard, settings, services, statistics）
    const adminPages = ['dashboard.html', 'settings.html', 'services.html', 'statistics.html'];
    const isAdminPage = adminPages.some(p => window.location.pathname.endsWith(p) || window.location.href.includes(p));
    if (isAdminPage) {
        const isLoggedIn = sessionStorage.getItem('adminLoggedIn');
        if (!isLoggedIn) {
            window.location.href = 'index.html';
        }
    }
});

// 退出登录
function logout() {
    sessionStorage.removeItem('adminLoggedIn');
    sessionStorage.removeItem('adminUsername');
    window.location.href = 'index.html';
}
