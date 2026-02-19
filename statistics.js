// 数据统计 - 公证翻译管理后台

let supabaseClient = null;
let currencySymbol = '₸';

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    initSupabase();
    setDefaultDateRange();
    loadStatistics();
});

function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('adminLoggedIn');
    if (!isLoggedIn) {
        window.location.href = 'index.html';
    }
}

function initSupabase() {
    if (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.url && SUPABASE_CONFIG.serviceRoleKey) {
        try {
            supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.serviceRoleKey);
        } catch (e) {
            console.error('Supabase 初始化失败:', e);
        }
    }
}

function setDefaultDateRange() {
    const today = new Date();
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    document.getElementById('dateFrom').value = formatDateInput(monthAgo);
    document.getElementById('dateTo').value = formatDateInput(today);
}

function formatDateInput(d) {
    return d.toISOString().split('T')[0];
}

async function loadStatistics() {
    if (!supabaseClient) {
        showError('Supabase 未配置');
        return;
    }

    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;

    try {
        // 加载货币符号
        const { data: settingsData } = await supabaseClient
            .from('notary_admin_settings')
            .select('value')
            .eq('key', 'currency_symbol')
            .single();
        if (settingsData && settingsData.value) {
            currencySymbol = typeof settingsData.value === 'string' 
                ? settingsData.value.replace(/^"|"$/g, '') 
                : String(settingsData.value);
        }

        // 加载公证翻译订单
        let query = supabaseClient
            .from('notary_translation_orders')
            .select('id, service_type, custom_file_type, status, estimated_price, created_at');

        if (dateFrom) {
            query = query.gte('created_at', dateFrom + 'T00:00:00.000Z');
        }
        if (dateTo) {
            query = query.lte('created_at', dateTo + 'T23:59:59.999Z');
        }

        const { data: notaryOrders, error: notaryError } = await query;

        if (notaryError) throw notaryError;

        let visaOrders = [];
        try {
            let visaQuery = supabaseClient
                .from('visa_orders')
                .select('id, status, visa_category_label, created_at');
            if (dateFrom) {
                visaQuery = visaQuery.gte('created_at', dateFrom + 'T00:00:00.000Z');
            }
            if (dateTo) {
                visaQuery = visaQuery.lte('created_at', dateTo + 'T23:59:59.999Z');
            }
            const { data: visaData } = await visaQuery;
            visaOrders = visaData || [];
        } catch (e) {
            console.warn('签证订单表可能不存在:', e);
        }

        const orders = (notaryOrders || []).map(o => ({
            ...o,
            isVisa: false,
            amount: o.estimated_price || 0
        })).concat(visaOrders.map(o => ({
            ...o,
            isVisa: true,
            service_type: 'VISA',
            custom_file_type: o.visa_category_label || '签证邀请函',
            amount: 0
        })));

        renderStatistics(orders);
    } catch (e) {
        console.error('加载统计失败:', e);
        showError('加载失败: ' + (e.message || e));
    }
}

function renderStatistics(orders) {
    const completedStatuses = ['COMPLETED', 'RECEIVED'];
    const processingStatuses = ['CONTACTED', 'CONFIRMED', 'IN_PROGRESS'];

    const now = new Date();
    const todayStr = formatDateInput(now);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = formatDateInput(weekStart);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = formatDateInput(monthStart);

    const isCompleted = o => completedStatuses.includes(o.status);
    const getDateStr = o => new Date(o.created_at).toISOString().split('T')[0];

    const todayOrders = orders.filter(o => isCompleted(o) && getDateStr(o) === todayStr);
    const weekOrders = orders.filter(o => isCompleted(o) && getDateStr(o) >= weekStartStr);
    const monthOrders = orders.filter(o => isCompleted(o) && getDateStr(o) >= monthStartStr);

    const todayRevenue = todayOrders.reduce((s, o) => s + (o.amount || 0), 0);
    const weekRevenue = weekOrders.reduce((s, o) => s + (o.amount || 0), 0);
    const monthRevenue = monthOrders.reduce((s, o) => s + (o.amount || 0), 0);
    const totalRevenue = orders.filter(isCompleted).reduce((s, o) => s + (o.amount || 0), 0);

    const mapStatus = s => {
        if (s === 'PENDING') return 'pending';
        if (processingStatuses.includes(s)) return 'processing';
        if (completedStatuses.includes(s)) return 'completed';
        if (s === 'CANCELLED') return 'cancelled';
        return s?.toLowerCase();
    };

    const pending = orders.filter(o => mapStatus(o.status) === 'pending').length;
    const processing = orders.filter(o => mapStatus(o.status) === 'processing').length;
    const completed = orders.filter(o => mapStatus(o.status) === 'completed').length;
    const cancelled = orders.filter(o => mapStatus(o.status) === 'cancelled').length;

    // 概览
    document.getElementById('totalOrders').textContent = orders.length;
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('processingCount').textContent = processing;
    document.getElementById('completedCount').textContent = completed;
    document.getElementById('cancelledCount').textContent = cancelled;

    // 收入
    document.getElementById('todayRevenue').textContent = formatMoney(todayRevenue);
    document.getElementById('weekRevenue').textContent = formatMoney(weekRevenue);
    document.getElementById('monthRevenue').textContent = formatMoney(monthRevenue);
    document.getElementById('totalRevenue').textContent = formatMoney(totalRevenue);

    // 按服务类型
    const serviceTypeMap = {
        'ID_CARD': '身份证/护照',
        'BIRTH_MARRIAGE': '出生证/结婚证',
        'EDUCATION': '成绩单/毕业证',
        'CRIMINAL_RECORD': '无犯罪证明',
        'OTHER': '其他',
        'VISA': '签证邀请函'
    };

    const byService = {};
    orders.forEach(o => {
        const type = o.service_type || 'OTHER';
        const label = o.custom_file_type || serviceTypeMap[type] || type;
        if (!byService[label]) byService[label] = { count: 0, revenue: 0 };
        byService[label].count++;
        if (isCompleted(o)) byService[label].revenue += o.amount || 0;
    });

    const serviceTypeBody = document.getElementById('serviceTypeBody');
    serviceTypeBody.innerHTML = Object.entries(byService)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([label, data]) => `
            <tr>
                <td>${label}</td>
                <td>${data.count}</td>
                <td><strong>${formatMoney(data.revenue)}</strong></td>
            </tr>
        `).join('') || '<tr><td colspan="3" class="text-center">暂无数据</td></tr>';

    // 按状态
    const statusLabels = {
        'PENDING': '订单上传成功',
        'CONTACTED': '等待联系',
        'CONFIRMED': '已确认',
        'IN_PROGRESS': '正在处理',
        'COMPLETED': '已做完',
        'RECEIVED': '已收货',
        'CANCELLED': '已取消'
    };

    const byStatus = {};
    orders.forEach(o => {
        const s = o.status || 'PENDING';
        byStatus[s] = (byStatus[s] || 0) + 1;
    });

    const statusBody = document.getElementById('statusBody');
    statusBody.innerHTML = Object.entries(byStatus)
        .map(([status, count]) => `
            <tr>
                <td>${statusLabels[status] || status}</td>
                <td>${count}</td>
            </tr>
        `).join('') || '<tr><td colspan="2" class="text-center">暂无数据</td></tr>';

    // 近7日趋势
    const dailyData = {};
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const ds = formatDateInput(d);
        dailyData[ds] = { count: 0, revenue: 0 };
    }

    orders.forEach(o => {
        const ds = getDateStr(o);
        if (dailyData[ds]) {
            dailyData[ds].count++;
            if (isCompleted(o)) dailyData[ds].revenue += o.amount || 0;
        }
    });

    const dailyTrendBody = document.getElementById('dailyTrendBody');
    dailyTrendBody.innerHTML = Object.entries(dailyData)
        .map(([date, data]) => `
            <tr>
                <td>${formatDisplayDate(date)}</td>
                <td>${data.count}</td>
                <td><strong>${formatMoney(data.revenue)}</strong></td>
            </tr>
        `).join('');
}

function formatMoney(n) {
    return (currencySymbol || '₸') + Number(n || 0).toLocaleString();
}

function formatDisplayDate(s) {
    const d = new Date(s + 'T12:00:00');
    return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', weekday: 'short' });
}

function showError(msg) {
    ['totalOrders', 'pendingCount', 'processingCount', 'completedCount', 'cancelledCount',
     'todayRevenue', 'weekRevenue', 'monthRevenue', 'totalRevenue'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '-';
    });
    document.getElementById('serviceTypeBody').innerHTML = `<tr><td colspan="3" class="text-center text-error">${msg}</td></tr>`;
    document.getElementById('statusBody').innerHTML = `<tr><td colspan="2" class="text-center text-error">${msg}</td></tr>`;
    document.getElementById('dailyTrendBody').innerHTML = `<tr><td colspan="3" class="text-center text-error">${msg}</td></tr>`;
}
