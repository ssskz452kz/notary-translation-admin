// 系统设置 - 公证翻译管理后台

let supabaseClient = null;

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    initSupabase();
    loadSettings();
    bindFormSubmit();
});

// 检查登录状态
function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('adminLoggedIn');
    if (!isLoggedIn) {
        window.location.href = 'index.html';
    }
}

// 初始化 Supabase
function initSupabase() {
    if (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.url && SUPABASE_CONFIG.serviceRoleKey) {
        try {
            supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.serviceRoleKey);
        } catch (e) {
            console.error('Supabase 初始化失败:', e);
        }
    }
}

// 从数据库加载设置（仅重置密码输入框）
async function loadSettings() {
    document.getElementById('adminPassword').value = '';
    document.getElementById('adminPasswordConfirm').value = '';
}

// 绑定表单提交
function bindFormSubmit() {
    document.getElementById('settingsForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveSettings();
    });
}

// 保存设置
async function saveSettings() {
    const newPassword = document.getElementById('adminPassword').value;
    const confirmPassword = document.getElementById('adminPasswordConfirm').value;

    if (!newPassword && !confirmPassword) {
        return; // 留空表示不修改
    }
    if (newPassword !== confirmPassword) {
        showMessage('两次输入的密码不一致', 'error');
        return;
    }
    if (newPassword.length < 4) {
        showMessage('密码长度至少 4 位', 'error');
        return;
    }

    const saveBtn = document.getElementById('saveBtn');
    const btnText = saveBtn.querySelector('.btn-text');
    const btnLoading = saveBtn.querySelector('.btn-loading');
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
    saveBtn.disabled = true;

    try {
        if (!supabaseClient) {
            throw new Error('Supabase 未配置');
        }

        const { error } = await supabaseClient
            .from('notary_admin_settings')
            .upsert({
                key: 'admin_password',
                value: newPassword,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

        if (error) throw error;

        showMessage('密码已更新，下次登录请使用新密码', 'success');
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminPasswordConfirm').value = '';
    } catch (e) {
        console.error('保存失败:', e);
        showMessage('保存失败: ' + (e.message || e), 'error');
    } finally {
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
        saveBtn.disabled = false;
    }
}

// 显示提示消息
function showMessage(text, type) {
    const el = document.getElementById('saveMessage');
    el.textContent = text;
    el.className = 'save-message ' + (type === 'success' ? 'success' : 'error');
    el.style.display = 'block';

    setTimeout(() => {
        el.style.display = 'none';
    }, 4000);
}
