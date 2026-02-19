// 服务类型管理 - 公证翻译管理后台

let supabaseClient = null;
let currencySymbol = '₸';

// 公证翻译服务类型
const NOTARY_SERVICE_TYPES = [
    { key: 'price_id_card', code: 'ID_CARD', name: '身份证/护照', hint: '身份证、护照等证件翻译公证' },
    { key: 'price_birth_marriage', code: 'BIRTH_MARRIAGE', name: '出生证/结婚证', hint: '出生证明、结婚证、离婚证等' },
    { key: 'price_education', code: 'EDUCATION', name: '成绩单/毕业证', hint: '学历证明、成绩单、毕业证等' },
    { key: 'price_criminal_record', code: 'CRIMINAL_RECORD', name: '无犯罪证明', hint: '无犯罪记录证明翻译公证' },
    { key: 'price_other_base', code: 'OTHER', name: '其他类型', hint: '自定义类型的基础价格' }
];

// 签证服务类型
const VISA_SERVICE_TYPES = [
    { key: 'price_visa_b2', code: 'B2', name: 'B2 商务签证', hint: '短期商务考察、会议洽谈，停留30–90天' },
    { key: 'price_visa_c3', code: 'C3', name: 'C3 劳务签证', hint: '在哈合法就业的外籍员工签证，配合劳动合同' },
    { key: 'price_visa_c5', code: 'C5', name: 'C5 投资签证', hint: '投资人及企业高管签证，有投资项目或注册公司' },
    { key: 'price_visa_c1', code: 'C1', name: 'C1 哈萨克居留', hint: '长期居留许可，可合法工作或经商' },
    { key: 'price_visa_b18', code: 'B18', name: 'B18 出境签', hint: '一次性出境签证，适用于需合法离境的外国人' },
    { key: 'price_visa_b12', code: 'B12', name: 'B12 旅游签', hint: '短期旅游观光，单次停留一般不超过30天' }
];

const EXTRA_FEES = [
    { key: 'urgent_fee', name: '加急费用' },
    { key: 'delivery_fee_physical', name: '纸质版配送费' }
];

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    initSupabase();
    loadServices();
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

async function loadServices() {
    if (!supabaseClient) {
        showError();
        return;
    }

    try {
        // 加载货币符号
        const { data: currencyData } = await supabaseClient
            .from('notary_admin_settings')
            .select('value')
            .eq('key', 'currency_symbol')
            .single();
        if (currencyData && currencyData.value) {
            const v = currencyData.value;
            currencySymbol = typeof v === 'string' ? v.replace(/^"|"$/g, '') : String(v) || '₸';
        }

        // 加载价格设置
        const { data: settingsData } = await supabaseClient
            .from('notary_admin_settings')
            .select('key, value');

        const settings = {};
        (settingsData || []).forEach(row => {
            let v = row.value;
            if (typeof v === 'number') settings[row.key] = v;
            else if (typeof v === 'string') settings[row.key] = v.replace(/^"|"$/g, '');
            else settings[row.key] = v;
        });

        // 加载公证翻译订单统计
        const { data: notaryOrdersData } = await supabaseClient
            .from('notary_translation_orders')
            .select('service_type, custom_file_type');

        const notaryOrderCountByType = {};
        const customTypeCount = {};
        (notaryOrdersData || []).forEach(o => {
            const type = o.service_type || 'OTHER';
            notaryOrderCountByType[type] = (notaryOrderCountByType[type] || 0) + 1;
            if (type === 'OTHER' && o.custom_file_type) {
                const label = o.custom_file_type.trim();
                if (label) customTypeCount[label] = (customTypeCount[label] || 0) + 1;
            }
        });

        // 加载签证订单统计
        let visaOrderCountByType = {};
        try {
            const { data: visaOrdersData } = await supabaseClient
                .from('visa_orders')
                .select('visa_category');
            (visaOrdersData || []).forEach(o => {
                const cat = o.visa_category || '';
                if (cat) visaOrderCountByType[cat] = (visaOrderCountByType[cat] || 0) + 1;
            });
        } catch (e) {
            console.warn('签证订单表可能不存在:', e);
        }

        renderServices(settings, notaryOrderCountByType, visaOrderCountByType, customTypeCount);
    } catch (e) {
        console.error('加载服务类型失败:', e);
        showError('加载失败: ' + (e.message || e));
    }
}

function renderServices(settings, notaryOrderCountByType, visaOrderCountByType, customTypeCount) {
    // 公证翻译服务
    const notaryBody = document.getElementById('notaryServicesBody');
    notaryBody.innerHTML = NOTARY_SERVICE_TYPES.map(st => {
        const price = settings[st.key] ?? '';
        const count = notaryOrderCountByType[st.code] || 0;
        return `
            <tr>
                <td>
                    <div><strong>${st.name}</strong></div>
                    <div class="text-muted small">${st.hint}</div>
                </td>
                <td><code>${st.code}</code></td>
                <td>
                    <input type="number" class="form-control price-input" data-key="${st.key}" 
                           value="${price}" min="0" step="100" placeholder="待设置">
                </td>
                <td>${count}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="savePrice('${st.key}')">保存</button>
                </td>
            </tr>
        `;
    }).join('');

    // 签证服务
    const visaBody = document.getElementById('visaServicesBody');
    visaBody.innerHTML = VISA_SERVICE_TYPES.map(st => {
        const price = settings[st.key] ?? '';
        const count = visaOrderCountByType[st.code] || 0;
        return `
            <tr>
                <td>
                    <div><strong>${st.name}</strong></div>
                    <div class="text-muted small">${st.hint}</div>
                </td>
                <td><code>${st.code}</code></td>
                <td>
                    <input type="number" class="form-control price-input" data-key="${st.key}" 
                           value="${price}" min="0" step="100" placeholder="线下确认">
                </td>
                <td>${count}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="savePrice('${st.key}')">保存</button>
                </td>
            </tr>
        `;
    }).join('');

    const extraBody = document.getElementById('extraFeesBody');
    extraBody.innerHTML = EXTRA_FEES.map(ef => {
        const price = settings[ef.key] ?? '';
        return `
            <tr>
                <td>${ef.name}</td>
                <td>
                    <input type="number" class="form-control price-input" data-key="${ef.key}" 
                           value="${price}" min="0" step="100" placeholder="待设置">
                </td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="savePrice('${ef.key}')">保存</button>
                </td>
            </tr>
        `;
    }).join('');

    const customBody = document.getElementById('customTypesBody');
    const customEntries = Object.entries(customTypeCount).sort((a, b) => b[1] - a[1]);
    customBody.innerHTML = customEntries.length > 0
        ? customEntries.map(([name, count]) => `
            <tr>
                <td>${name}</td>
                <td>${count}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="2" class="text-center">暂无自定义类型</td></tr>';
}

async function savePrice(key) {
    if (!supabaseClient) return;

    const input = document.querySelector(`input[data-key="${key}"]`);
    if (!input) return;

    const value = Number(input.value);
    if (isNaN(value) || value < 0) {
        alert('请输入有效的价格（≥0）');
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('notary_admin_settings')
            .upsert({
                key: key,
                value: value,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

        if (error) throw error;
        alert('保存成功');
    } catch (e) {
        console.error('保存失败:', e);
        alert('保存失败: ' + (e.message || e));
    }
}

function showError(msg) {
    const errRow = `<tr><td colspan="5" class="text-center text-error">${msg || 'Supabase 未配置或加载失败'}</td></tr>`;
    document.getElementById('notaryServicesBody').innerHTML = errRow;
    document.getElementById('visaServicesBody').innerHTML = errRow;
    document.getElementById('extraFeesBody').innerHTML =
        `<tr><td colspan="3" class="text-center text-error">${msg || 'Supabase 未配置或加载失败'}</td></tr>`;
    document.getElementById('customTypesBody').innerHTML =
        `<tr><td colspan="2" class="text-center text-error">${msg || 'Supabase 未配置或加载失败'}</td></tr>`;
}
