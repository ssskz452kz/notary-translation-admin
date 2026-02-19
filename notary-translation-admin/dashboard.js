// 初始化 Supabase 客户端（使用 service_role key 以绕过 RLS）
let supabaseClient = null;
if (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.url && SUPABASE_CONFIG.serviceRoleKey) {
    try {
        supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.serviceRoleKey);
        console.log('Supabase 客户端初始化成功');
    } catch (e) {
        console.error('Supabase 客户端初始化失败:', e);
        alert('Supabase 配置错误，请检查 config.js');
    }
} else {
    console.error('Supabase 配置未找到！请检查 config.js 文件');
    alert('Supabase 配置未找到，请检查 config.js 文件');
}

// 订单数据（从 Supabase 加载）
let ordersData = [];
let currencySymbol = '₸'; // 坚戈，从系统设置读取

let currentPage = 1;
const itemsPerPage = 10;
let filteredOrders = [...ordersData];
let selectedOrderId = null;
let selectedOrderIsVisa = false;

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    showLoadingState();
    loadOrders().then(() => {
        displayOrders();
        updateStats();
    }).catch(() => {
        displayOrders();
        updateStats();
    });
    
    // 绑定筛选事件
    document.getElementById('statusFilter').addEventListener('change', filterOrders);
    document.getElementById('serviceFilter').addEventListener('change', filterOrders);
    document.getElementById('dateFrom').addEventListener('change', filterOrders);
    document.getElementById('dateTo').addEventListener('change', filterOrders);
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchOrders();
        }
    });
});

// 检查登录状态
function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('adminLoggedIn');
    if (!isLoggedIn) {
        window.location.href = 'index.html';
    }
}

// 显示加载中状态
function showLoadingState() {
    const ids = ['pendingCount', 'processingCount', 'completedCount', 'todayRevenue'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = id === 'todayRevenue' ? '…' : '…';
    });
    const tbody = document.getElementById('ordersTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 24px; color: #999;">加载中...</td></tr>';
    }
}

// 移除加载状态（由 displayOrders/updateStats 覆盖，仅失败时需显式恢复表格）
function hideLoadingState() {
    const tbody = document.getElementById('ordersTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 24px; color: #999;">加载失败</td></tr>';
    }
}

// 加载订单列表（并行请求 + 文件一次批量拉取，减少等待时间）
async function loadOrders() {
    if (!supabaseClient) {
        console.warn('Supabase 未配置，使用模拟数据');
        filterOrders();
        return;
    }
    
    try {
        // 并行：公证订单、签证订单、货币符号
        const notaryPromise = supabaseClient.from('notary_translation_orders').select('*').order('created_at', { ascending: false });
        const visaPromise = supabaseClient.from('visa_orders').select('*').order('created_at', { ascending: false });
        const currencyPromise = supabaseClient.from('notary_admin_settings').select('value').eq('key', 'currency_symbol').single();
        
        // 使用 Promise.allSettled 确保即使某个查询失败也能继续
        const results = await Promise.allSettled([notaryPromise, visaPromise, currencyPromise]);
        
        const notaryRes = results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason };
        const visaRes = results[1].status === 'fulfilled' ? results[1].value : { data: [], error: null };
        const currencyRes = results[2].status === 'fulfilled' ? results[2].value : { data: null };
        
        if (notaryRes.error) throw notaryRes.error;
        
        // 处理货币符号
        if (currencyRes && currencyRes.data && currencyRes.data.value !== undefined) {
            const v = currencyRes.data.value;
            currencySymbol = typeof v === 'string' ? v.replace(/^"|"$/g, '') : String(v) || '₸';
        }
        
        const notaryData = notaryRes.data || [];
        const notaryOrders = notaryData.map(order => ({
            id: order.id.substring(0, 8) + '...',
            fullId: order.id,
            customerName: order.customer_name,
            customerPhone: order.phone_or_whatsapp,
            serviceType: getServiceTypeName(order.service_type, order.custom_file_type),
            serviceDetail: order.custom_file_type || order.service_type,
            amount: order.estimated_price || 0,
            orderTime: formatDateTime(order.created_at),
            status: mapStatusToDisplay(order.status),
            urgency: order.urgent_option === 'URGENT' ? 'urgent' : 'normal',
            files: [],
            notes: order.notes || '',
            address: order.is_pickup_in_store ? '到店取件' : (order.pickup_address || ''),
            deliveryFormat: order.delivery_format,
            rawOrder: { ...order, isVisa: false },
            isVisa: false
        }));
        
        // 一次请求拉取所有公证订单的文件（避免 N+1）
        if (notaryOrders.length > 0) {
            const orderIds = notaryOrders.map(o => o.rawOrder.id);
            const { data: allFiles } = await supabaseClient
                .from('notary_translation_files')
                .select('order_id, file_name, file_url, file_type')
                .in('order_id', orderIds);
            const filesByOrderId = {};
            (allFiles || []).forEach(f => {
                if (!filesByOrderId[f.order_id]) filesByOrderId[f.order_id] = [];
                filesByOrderId[f.order_id].push({ file_name: f.file_name, file_url: f.file_url, file_type: f.file_type });
            });
            notaryOrders.forEach(o => {
                o.files = filesByOrderId[o.rawOrder.id] || [];
            });
        }
        
        let visaOrders = [];
        if (visaRes.data && visaRes.data.length) {
            visaOrders = visaRes.data.map(order => ({
                id: order.id.substring(0, 8) + '...',
                fullId: order.id,
                customerName: order.user_id || '签证用户',
                customerPhone: '',
                serviceType: '签证邀请函',
                serviceDetail: `签证服务 - ${order.visa_category_label || order.visa_category}`,
                amount: 0,
                orderTime: formatDateTime(order.created_at),
                status: mapStatusToDisplay(order.status),
                urgency: 'normal',
                files: [],
                notes: order.notes || '',
                address: '',
                deliveryFormat: 'DIGITAL',
                rawOrder: { ...order, isVisa: true },
                isVisa: true
            }));
        }
        
        ordersData = [...notaryOrders, ...visaOrders];
        filterOrders();
        console.log(`成功加载 ${ordersData.length} 个订单（公证 ${notaryOrders.length}，签证 ${visaOrders.length}）`);
    } catch (error) {
        console.error('加载订单失败:', error);
        alert('加载订单失败: ' + error.message + '\n\n请检查：\n1. Supabase 配置是否正确\n2. 网络连接是否正常\n3. 浏览器控制台是否有更多错误信息');
        ordersData = [];
        filterOrders();
    }
}

// 获取服务类型名称
function getServiceTypeName(serviceType, customFileType) {
    const typeMap = {
        'ID_CARD': '身份证/护照',
        'BIRTH_MARRIAGE': '出生证/结婚证',
        'EDUCATION': '成绩单/毕业证',
        'CRIMINAL_RECORD': '无犯罪证明',
        'OTHER': customFileType || '其他'
    };
    return typeMap[serviceType] || serviceType;
}

// 映射状态到显示状态
function mapStatusToDisplay(status) {
    const statusMap = {
        'PENDING': 'pending',
        'CONTACTED': 'processing',
        'CONFIRMED': 'processing',
        'IN_PROGRESS': 'processing',
        'COMPLETED': 'completed',
        'RECEIVED': 'completed',
        'CANCELLED': 'cancelled'
    };
    return statusMap[status] || status.toLowerCase();
}

// 格式化日期时间
function formatDateTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 显示订单列表
function displayOrders() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) {
        console.error('找不到订单表格元素');
        return;
    }
    
    tbody.innerHTML = '';
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageOrders = filteredOrders.slice(start, end);
    
    console.log(`显示订单: 第 ${currentPage} 页，共 ${filteredOrders.length} 个订单，本页显示 ${pageOrders.length} 个`);
    
    if (pageOrders.length === 0) {
        if (ordersData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #999;">暂无订单数据<br><small>请确保已从 Supabase 成功加载数据</small></td></tr>';
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #999;">没有符合条件的订单</td></tr>';
        }
        return;
    }
    
    pageOrders.forEach(order => {
        const row = createOrderRow(order);
        tbody.appendChild(row);
    });
    
    updatePagination();
}

// 创建订单行
function createOrderRow(order) {
    const tr = document.createElement('tr');
    const statusClass = getStatusClass(order.status);
    const statusText = getStatusText(order.status);
    const urgencyBadge = order.urgency === 'urgent' ? '<span class="badge badge-urgent">加急</span>' : '';
    
    tr.innerHTML = `
        <td>
            <strong>${order.id}</strong>
            ${urgencyBadge}
        </td>
        <td>
            <div><strong>${order.customerName}</strong></div>
            <div class="text-muted">${order.customerPhone}</div>
        </td>
        <td>
            <div>${order.serviceType}</div>
            <div class="text-muted small">${order.serviceDetail}</div>
        </td>
        <td><strong class="text-primary">${order.amount ? currencySymbol + Number(order.amount).toLocaleString() : '待报价'}</strong></td>
        <td>${order.orderTime}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>
            <button class="btn btn-sm btn-primary" onclick="viewOrderDetail('${order.fullId || order.id}')">查看</button>
        </td>
    `;
    return tr;
}

// 获取状态样式类
function getStatusClass(status) {
    const classes = {
        'pending': 'status-pending',
        'processing': 'status-in-progress',
        'completed': 'status-completed',
        'cancelled': 'status-cancelled'
    };
    return classes[status] || 'status-pending';
}

// 获取状态文本
function getStatusText(status) {
    const texts = {
        'pending': '订单上传成功',
        'processing': '处理中',
        'completed': '已完成',
        'cancelled': '已取消'
    };
    return texts[status] || status;
}

// 服务类型对应的基准价格 key（notary_admin_settings）
function getBasePriceKeyForServiceType(serviceType) {
    const keyMap = {
        'ID_CARD': 'price_id_card',
        'BIRTH_MARRIAGE': 'price_birth_marriage',
        'EDUCATION': 'price_education',
        'CRIMINAL_RECORD': 'price_criminal_record',
        'OTHER': 'price_other_base'
    };
    return keyMap[serviceType || ''] || 'price_other_base';
}

// 获取某订单对应的基准价格（公证翻译订单）
async function fetchBasePriceForOrder(order) {
    if (!supabaseClient || !order?.rawOrder || order.isVisa) return null;
    const serviceType = order.rawOrder.service_type || 'OTHER';
    const key = getBasePriceKeyForServiceType(serviceType);
    try {
        const { data, error } = await supabaseClient
            .from('notary_admin_settings')
            .select('value')
            .eq('key', key)
            .single();
        if (error || data == null) return null;
        const v = data.value;
        const num = typeof v === 'number' ? v : parseFloat(v);
        return isNaN(num) ? null : num;
    } catch (e) {
        console.warn('获取基准价格失败:', e);
        return null;
    }
}

// 使用默认基准价格（填入输入框，用户可修改后保存）
function applyDefaultBasePrice(price) {
    const priceInput = document.getElementById('priceInput');
    if (!priceInput) return;
    priceInput.value = price;
    priceInput.focus();
}

// 获取数据库状态值
function getDbStatus(displayStatus) {
    const statusMap = {
        'pending': 'PENDING',
        'processing': 'IN_PROGRESS',
        'completed': 'COMPLETED',
        'cancelled': 'CANCELLED'
    };
    return statusMap[displayStatus] || displayStatus.toUpperCase();
}

// 筛选订单
function filterOrders() {
    const statusFilter = document.getElementById('statusFilter').value;
    const serviceFilter = document.getElementById('serviceFilter').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    
    filteredOrders = ordersData.filter(order => {
        // 状态筛选
        if (statusFilter !== 'all' && order.status !== statusFilter) {
            return false;
        }
        
        // 服务类型筛选（与订单实际 service_type / 签证订单一致）
        if (serviceFilter !== 'all') {
            if (serviceFilter === 'VISA') {
                if (!order.isVisa) return false;
            } else {
                const orderServiceType = order.rawOrder?.service_type || '';
                if (order.isVisa || orderServiceType !== serviceFilter) return false;
            }
        }
        
        // 日期筛选
        if (dateFrom) {
            const orderDate = order.orderTime.split(' ')[0];
            if (orderDate < dateFrom) {
                return false;
            }
        }
        if (dateTo) {
            const orderDate = order.orderTime.split(' ')[0];
            if (orderDate > dateTo) {
                return false;
            }
        }
        
        return true;
    });
    
    currentPage = 1;
    displayOrders();
    updateStats();
}

// 搜索订单
function searchOrders() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    if (!searchTerm) {
        filterOrders();
        return;
    }
    
    filteredOrders = ordersData.filter(order => {
        return order.id.toLowerCase().includes(searchTerm) ||
               order.customerName.toLowerCase().includes(searchTerm) ||
               order.customerPhone.includes(searchTerm) ||
               order.serviceType.toLowerCase().includes(searchTerm);
    });
    
    currentPage = 1;
    displayOrders();
}

// 查看订单详情
async function viewOrderDetail(orderId) {
    // 通过完整ID或显示ID查找订单
    const order = ordersData.find(o => o.id === orderId || o.fullId === orderId);
    if (!order) {
        alert('订单不存在');
        return;
    }
    
    selectedOrderId = order.fullId || order.id; // 使用完整ID
    selectedOrderIsVisa = !!order.isVisa || (order.rawOrder && order.rawOrder.isVisa);
    
    // 公证翻译订单且未报价时，拉取该服务类型的基准价格
    let basePriceForOrder = null;
    if (!selectedOrderIsVisa && (!order.amount || order.amount === 0)) {
        basePriceForOrder = await fetchBasePriceForOrder(order);
    }
    
    // 加载订单文件
    let files = order.files || [];
    if (supabaseClient && order.rawOrder) {
        try {
            const { data: filesData, error } = await supabaseClient
                .from('notary_translation_files')
                .select('*')
                .eq('order_id', order.rawOrder.id);
            
            if (!error && filesData) {
                files = filesData;
            }
        } catch (e) {
            console.error('加载文件失败:', e);
        }
    }
    
    const modal = document.getElementById('orderDetailModal');
    const content = document.getElementById('orderDetailContent');
    
    // 格式化电话号码用于 WhatsApp
    const phoneForWhatsApp = order.customerPhone.replace(/[^0-9]/g, '');
    const whatsAppLink = `https://wa.me/${phoneForWhatsApp}`;
    
    const currentStatus = order.rawOrder?.status || 'PENDING';
    
    content.innerHTML = `
        <div class="order-detail-grid">
            <div class="detail-section">
                <h4>订单信息</h4>
                <div class="detail-item">
                    <span class="detail-label">订单号：</span>
                    <span class="detail-value">${order.fullId || order.id}</span>
                    ${order.urgency === 'urgent' ? '<span class="badge badge-urgent">加急</span>' : ''}
                </div>
                <div class="detail-item">
                    <span class="detail-label">订单状态：</span>
                    <select id="statusSelect" class="form-control" style="display: inline-block; width: auto;">
                        ${selectedOrderIsVisa
                            ? `
                        <option value="PENDING" ${currentStatus === 'PENDING' ? 'selected' : ''}>待处理</option>
                        <option value="IN_PROGRESS" ${currentStatus === 'IN_PROGRESS' ? 'selected' : ''}>办理中</option>
                        <option value="COMPLETED" ${currentStatus === 'COMPLETED' ? 'selected' : ''}>已完成</option>
                        <option value="CANCELLED" ${currentStatus === 'CANCELLED' ? 'selected' : ''}>已取消</option>
                        `
                            : `
                        <option value="PENDING" ${currentStatus === 'PENDING' ? 'selected' : ''}>订单上传成功</option>
                        <option value="CONTACTED" ${currentStatus === 'CONTACTED' ? 'selected' : ''}>等待报价及公证处联系</option>
                        <option value="CONFIRMED" ${currentStatus === 'CONFIRMED' ? 'selected' : ''}>已确认订单</option>
                        <option value="IN_PROGRESS" ${currentStatus === 'IN_PROGRESS' ? 'selected' : ''}>正在做</option>
                        <option value="COMPLETED" ${currentStatus === 'COMPLETED' ? 'selected' : ''}>已做完</option>
                        <option value="RECEIVED" ${currentStatus === 'RECEIVED' ? 'selected' : ''}>已收货</option>
                        <option value="CANCELLED" ${currentStatus === 'CANCELLED' ? 'selected' : ''}>已取消</option>
                        `}
                    </select>
                    <button class="btn btn-sm btn-primary" onclick="updateOrderStatus()" style="margin-left: 10px;">更新状态</button>
                </div>
                ${selectedOrderIsVisa
                    ? `
                <div class="detail-item">
                    <span class="detail-label">订单金额：</span>
                    <span class="detail-value">签证订单费用请线下确认（系统中不维护报价）。</span>
                </div>
                `
                    : `
                <div class="detail-item">
                    <span class="detail-label">订单金额：</span>
                    <span class="detail-value text-primary">
                        <input id="priceInput" type="number" step="0.01" min="0" class="form-control" style="width: 120px; display: inline-block;" value="${order.amount || ''}" placeholder="待报价" />
                        <button class="btn btn-sm btn-primary" onclick="saveOrderPrice()" style="margin-left: 10px;">保存价格</button>
                        <span style="margin-left: 8px;"><strong>${order.amount ? currencySymbol + Number(order.amount).toLocaleString() : '待报价'}</strong></span>
                    </span>
                </div>
                ${(basePriceForOrder != null && basePriceForOrder > 0) ? `
                <div class="detail-item">
                    <span class="detail-label">基准价格：</span>
                    <span class="detail-value">
                        ${currencySymbol}${Number(basePriceForOrder).toLocaleString()}
                        <button type="button" class="btn btn-sm btn-outline" onclick="applyDefaultBasePrice(${basePriceForOrder})" style="margin-left: 10px;">使用默认基准价格</button>
                    </span>
                </div>
                ` : ''}
                `}
                <div class="detail-item">
                    <span class="detail-label">下单时间：</span>
                    <span class="detail-value">${order.orderTime}</span>
                </div>
                ${order.rawOrder?.completed_at && !selectedOrderIsVisa ? `
                <div class="detail-item">
                    <span class="detail-label">完成时间：</span>
                    <span class="detail-value">${formatDateTime(order.rawOrder.completed_at)}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="detail-section">
                <h4>客户信息</h4>
                <div class="detail-item">
                    <span class="detail-label">姓名：</span>
                    <span class="detail-value">${order.customerName}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">电话：</span>
                    <span class="detail-value">
                        ${order.customerPhone || '—'}
                        ${selectedOrderIsVisa ? '' : `
                        <a href="${whatsAppLink}" target="_blank" class="btn btn-sm btn-success" style="margin-left: 10px;">
                            📱 WhatsApp联系
                        </a>`}
                    </span>
                </div>
                ${order.address ? `
                <div class="detail-item">
                    <span class="detail-label">地址：</span>
                    <span class="detail-value">${order.address}</span>
                </div>
                ` : ''}
                <div class="detail-item">
                    <span class="detail-label">交付形式：</span>
                    <span class="detail-value">${selectedOrderIsVisa ? '—' : (order.deliveryFormat === 'DIGITAL' ? '电子版' : '纸质原件')}</span>
                </div>
            </div>
            
            <div class="detail-section">
                <h4>服务信息</h4>
                <div class="detail-item">
                    <span class="detail-label">服务类型：</span>
                    <span class="detail-value">${order.serviceType}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">服务详情：</span>
                    <span class="detail-value">${order.serviceDetail}</span>
                </div>
            </div>
            
            <div class="detail-section">
                <h4>订单文件</h4>
                <div class="files-list">
                    ${selectedOrderIsVisa
                        ? '<p>签证订单当前不支持文件上传。</p>'
                        : (files.length > 0 ? files.map((file, index) => {
                        const fileName = typeof file === 'string' ? file : (file.file_name || '未知文件');
                        const fileUrl = typeof file === 'object' && file.file_url ? file.file_url : '#';
                        return `<div class="file-item">
                            <span class="file-icon">📄</span> 
                            <a href="${fileUrl}" target="_blank" rel="noopener noreferrer" style="flex: 1; margin-right: 10px;">${fileName}</a>
                            <button class="btn btn-sm btn-primary" onclick="downloadFile('${fileUrl}', '${fileName.replace(/'/g, "\\'")}')" title="下载文件">
                                ⬇️ 下载
                            </button>
                        </div>`;
                    }).join('') : '<p>暂无文件</p>')}
                </div>
            </div>
            
            <div class="detail-section full-width">
                <h4>备注信息</h4>
                <textarea id="orderNotes" class="form-control" rows="4" placeholder="添加备注...">${order.notes || ''}</textarea>
                <button class="btn btn-sm btn-primary" onclick="saveOrderNotes()" style="margin-top: 10px;">保存备注</button>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
}

// 关闭订单详情
function closeOrderDetail() {
    document.getElementById('orderDetailModal').style.display = 'none';
    selectedOrderId = null;
}

// 更新订单状态
async function updateOrderStatus() {
    if (!selectedOrderId) {
        alert('请先选择订单');
        return;
    }
    
    const statusSelect = document.getElementById('statusSelect');
    let newStatus = statusSelect.value;

    // 签证订单只允许有限的状态
    if (selectedOrderIsVisa) {
        if (newStatus === 'CONTACTED' || newStatus === 'CONFIRMED' || newStatus === 'RECEIVED') {
            newStatus = 'IN_PROGRESS';
        }
        const allowed = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
        if (!allowed.includes(newStatus)) {
            alert('签证订单仅支持：待处理 / 办理中 / 已完成 / 已取消');
            return;
        }
    }
    
    if (!supabaseClient) {
        alert('Supabase 未配置');
        return;
    }
    
    try {
        const updateData = {
            status: newStatus,
            updated_at: new Date().toISOString()
        };
        
        // 如果状态是已完成或已收货，设置完成时间
        if (newStatus === 'COMPLETED' || newStatus === 'RECEIVED') {
            updateData.completed_at = new Date().toISOString();
        }
        
        const tableName = selectedOrderIsVisa ? 'visa_orders' : 'notary_translation_orders';
        const { error } = await supabaseClient
            .from(tableName)
            .update(updateData)
            .eq('id', selectedOrderId);
        
        if (error) throw error;
        
        alert('订单状态已更新！');
        closeOrderDetail();
        await loadOrders();
        displayOrders();
        updateStats();
    } catch (error) {
        console.error('更新状态失败:', error);
        alert('更新状态失败: ' + error.message);
    }
}

// 保存订单备注
async function saveOrderNotes() {
    if (!selectedOrderId) {
        alert('请先选择订单');
        return;
    }
    
    const notesTextarea = document.getElementById('orderNotes');
    const notes = notesTextarea.value;
    
    if (!supabaseClient) {
        alert('Supabase 未配置');
        return;
    }
    
    try {
        const tableName = selectedOrderIsVisa ? 'visa_orders' : 'notary_translation_orders';
        const updateData = {
            notes: notes,
            updated_at: new Date().toISOString()
        };
        const { error } = await supabaseClient
            .from(tableName)
            .update(updateData)
            .eq('id', selectedOrderId);
        
        if (error) throw error;
        
        alert('备注已保存！');
        
        // 更新本地数据
        const order = ordersData.find(o => (o.fullId || o.id) === selectedOrderId);
        if (order && order.rawOrder) {
            order.rawOrder.notes = notes;
            order.notes = notes;
        }
    } catch (error) {
        console.error('保存备注失败:', error);
        alert('保存备注失败: ' + error.message);
    }
}

// 保存订单价格（报价）
async function saveOrderPrice() {
    if (!selectedOrderId) {
        alert('请先选择订单');
        return;
    }

    if (selectedOrderIsVisa) {
        alert('签证订单暂不支持在系统内设置价格，请线下确认费用。');
        return;
    }
    
    const priceInput = document.getElementById('priceInput');
    if (!priceInput) {
        alert('找不到价格输入框');
        return;
    }
    
    const priceValue = priceInput.value.trim();
    if (!priceValue) {
        if (!confirm('确定清空价格吗？')) {
            return;
        }
    }
    
    const parsedPrice = priceValue ? parseFloat(priceValue) : null;
    if (priceValue && (isNaN(parsedPrice) || parsedPrice < 0)) {
        alert('请输入有效的价格（非负数字）');
        priceInput.focus();
        return;
    }
    
    if (!supabaseClient) {
        alert('Supabase 未配置');
        return;
    }
    
    try {
        const updateData = {
            estimated_price: parsedPrice,
            updated_at: new Date().toISOString()
        };
        
        const { error } = await supabaseClient
            .from('notary_translation_orders')
            .update(updateData)
            .eq('id', selectedOrderId);
        
        if (error) throw error;
        
        // 更新本地数据
        const order = ordersData.find(o => (o.fullId || o.id) === selectedOrderId);
        if (order) {
            order.amount = parsedPrice || 0;
            if (order.rawOrder) {
                order.rawOrder.estimated_price = parsedPrice;
            }
        }
        
        alert('价格已保存！');
        await loadOrders();
        displayOrders();
        updateStats();
    } catch (error) {
        console.error('保存价格失败:', error);
        alert('保存价格失败: ' + error.message);
    }
}

// 更新统计
function updateStats() {
    // 使用真实数据计算统计
    const pending = ordersData.filter(o => o.status === 'pending').length;
    const processing = ordersData.filter(o => o.status === 'processing').length;
    const completed = ordersData.filter(o => o.status === 'completed').length;
    
    const today = new Date().toISOString().split('T')[0];
    const todayRevenue = ordersData
        .filter(o => {
            if (!o.rawOrder || !o.rawOrder.created_at) return false;
            const orderDate = new Date(o.rawOrder.created_at).toISOString().split('T')[0];
            return (o.status === 'completed' || o.rawOrder.status === 'COMPLETED' || o.rawOrder.status === 'RECEIVED') && orderDate === today;
        })
        .reduce((sum, o) => sum + (o.amount || 0), 0);
    
    // 更新统计显示
    const pendingEl = document.getElementById('pendingCount');
    const processingEl = document.getElementById('processingCount');
    const completedEl = document.getElementById('completedCount');
    const revenueEl = document.getElementById('todayRevenue');
    
    if (pendingEl) pendingEl.textContent = pending;
    if (processingEl) processingEl.textContent = processing;
    if (completedEl) completedEl.textContent = completed;
    if (revenueEl) {
        revenueEl.textContent = `${currencySymbol}${Number(todayRevenue).toLocaleString()}`;
    }
    
    console.log(`统计更新: 待处理=${pending}, 处理中=${processing}, 已完成=${completed}, 今日收入=${currencySymbol}${todayRevenue}`);
}

// 分页
function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        displayOrders();
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        displayOrders();
    }
}

function updatePagination() {
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = totalPages;
}

// 下载文件
async function downloadFile(fileUrl, fileName) {
    if (!fileUrl || fileUrl === '#') {
        alert('文件URL无效，无法下载');
        return;
    }
    
    try {
        console.log('开始下载文件:', fileName, fileUrl);
        
        // 使用 fetch 获取文件内容
        const response = await fetch(fileUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // 获取文件内容为 Blob
        const blob = await response.blob();
        
        // 创建 Blob URL
        const blobUrl = window.URL.createObjectURL(blob);
        
        // 创建一个临时的 <a> 元素来触发下载
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName || 'file';
        link.style.display = 'none';
        
        // 添加到DOM，点击，然后移除
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 释放 Blob URL
        window.URL.revokeObjectURL(blobUrl);
        
        console.log('文件下载成功:', fileName);
    } catch (error) {
        console.error('下载文件失败:', error);
        // 如果下载失败，尝试直接打开
        alert('下载失败: ' + error.message + '\n\n已在新窗口打开文件，请右键保存。');
        window.open(fileUrl, '_blank');
    }
}

// 点击模态框外部关闭
window.onclick = function(event) {
    const modal = document.getElementById('orderDetailModal');
    if (event.target === modal) {
        closeOrderDetail();
    }
}

