export const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || 'https://chopsticks-erp-backend.onrender.com';

export type SOPaged = { rows: any[]; total: number };

export function getToken() {
  return localStorage.getItem('token');
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem('token', t);
  else localStorage.removeItem('token');
}

async function request(path: string, opts: RequestInit = {}) {
  const token = getToken();

  const headers = new Headers(opts.headers || {});
  // 确保使用 UTF-8 编码，避免中文乱码
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json; charset=utf-8');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers,
    credentials: 'include',
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    // 避免循環 redirect：如果你有 router nav 可以改用 navigate
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const text = await res.text();
    let errorDetail = text || `HTTP ${res.status}`;
    try {
      const json = JSON.parse(text);
      if (json.detail) {
        if (Array.isArray(json.detail)) {
          errorDetail = json.detail.map((e: any) => `${e.loc?.join('.')}: ${e.msg}`).join('; ');
        } else {
          errorDetail = json.detail;
        }
      }
    } catch {
      // 如果不是 JSON，使用原始文本
    }
    throw new Error(errorDetail);
  }

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  if (ct.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
    return res.blob();
  }
  if (ct.includes('application/pdf')) {
    return res.blob();
  }
  return res.text();
}

export const api = {
  bootstrapAdmin: () => request('/auth/bootstrap-admin', { method: 'POST' }),
  login: (username: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => request('/auth/me'),

  listOrders: () => request('/orders'),
  createOrder: (payload: any) =>
    request('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  orderToWorkOrder: (orderId: number) =>
    request(`/orders/${orderId}/to-work-order`, { method: 'POST' }),

  listWorkOrders: () => request('/work-orders'),
  getWorkOrder: (id: number) => request(`/work-orders/${id}`),
  startWorkOrder: (id: number) => request(`/work-orders/${id}/start`, { method: 'POST' }),
  completeWorkOrder: (id: number, payload: any) =>
    request(`/work-orders/${id}/complete`, { method: 'POST', body: JSON.stringify(payload) }),
  printWorkOrder: (id: number) => request(`/work-orders/${id}/print`),

  listProducts: (params: { q?: string; active?: string; limit?: number } = {}) => {
    const usp = new URLSearchParams();
    if (params.q) usp.set('q', params.q);
    if (params.active !== undefined) usp.set('active', params.active);
    if (params.limit !== undefined) usp.set('limit', String(params.limit));
    const qs = usp.toString() ? `?${usp.toString()}` : '';
    return request(`/products${qs}`);
  },
  createProduct: (payload: any) =>
    request('/products', { method: 'POST', body: JSON.stringify(payload) }),
  updateProduct: (id: number, payload: any) =>
    request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  listInventory: (params: { q?: string; site?: string; low_only?: boolean } = {}) => {
    const usp = new URLSearchParams();
    if (params.q) usp.set('q', params.q);
    if (params.site) usp.set('site', params.site);
    if (params.low_only) usp.set('low_only', 'true');
    const qs = usp.toString() ? `?${usp.toString()}` : '';
    return request(`/inventory${qs}`);
  },
  listInventoryMoves: (productId: number) => request(`/inventory/moves?product_id=${productId}`),

  createInventoryMove: (payload: any) =>
    request('/inventory/moves', { method: 'POST', body: JSON.stringify(payload) }),
  stockBatch: (payload: { product_ids: number[]; site?: string }) =>
    request('/inventory/stock/batch', { method: 'POST', body: JSON.stringify(payload) }),

  listPOs: () => request('/purchase-orders'),
  createPO: (payload: any) => request('/purchase-orders', { method: 'POST', body: JSON.stringify(payload) }),
  getPO: (id: number) => request(`/purchase-orders/${id}`),
  printPO: (id: number) => request(`/purchase-orders/${id}/print`),

  listSOs: (params: any) =>
    request(`/sales-orders?${new URLSearchParams(params as any).toString()}`),
  exportSOsXlsx: (params: any) =>
    request(`/sales-orders/export.xlsx?${new URLSearchParams(params as any).toString()}`),
  createSO: (payload: any) => request('/sales-orders', { method: 'POST', body: JSON.stringify(payload) }),
  updateSO: (id: number, payload: any) => request(`/sales-orders/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  getSO: (id: number) => request(`/sales-orders/${id}`),
  printSO: (id: number) => request(`/sales-orders/${id}/print`),
  pickSO: (id: number) => request(`/sales-orders/${id}/pick`, { method: 'POST' }),
  shipSO: (id: number, payload?: { ship_note?: string; logistics_no?: string }) => {
    const opts: RequestInit = { method: 'POST' };
    if (payload) {
      opts.body = JSON.stringify(payload);
    }
    return request(`/sales-orders/${id}/ship`, opts);
  },
  confirmPayment: (id: number, discountAmount: number = 0) => {
    const params = new URLSearchParams();
    if (discountAmount > 0) {
      params.set('discount_amount', String(discountAmount));
    }
    const queryString = params.toString();
    return request(`/sales-orders/${id}/confirm-payment${queryString ? '?' + queryString : ''}`, { method: 'POST' });
  },
  printPicklistPdf: (id: number) => request(`/sales-orders/${id}/picklist.pdf`),
  printShippingPdf: (id: number) => request(`/sales-orders/${id}/shipping.pdf`),
  getMergedUnpaidSOs: (params: {
    customer_name: string;
    shipped_at_from?: string;
    shipped_at_to?: string;
  }) => {
    const usp = new URLSearchParams();
    usp.set('customer_name', params.customer_name);
    if (params.shipped_at_from) usp.set('shipped_at_from', params.shipped_at_from);
    if (params.shipped_at_to) usp.set('shipped_at_to', params.shipped_at_to);
    return request(`/sales-orders/merged-unpaid?${usp.toString()}`);
  },
  printMergedUnpaidSOs: (params: {
    customer_name: string;
    shipped_at_from?: string;
    shipped_at_to?: string;
  }) => {
    const usp = new URLSearchParams();
    usp.set('customer_name', params.customer_name);
    if (params.shipped_at_from) usp.set('shipped_at_from', params.shipped_at_from);
    if (params.shipped_at_to) usp.set('shipped_at_to', params.shipped_at_to);
    return request(`/sales-orders/merged-unpaid/print.pdf?${usp.toString()}`);
  },
  lastSO: (customer_name: string) =>
    request(`/sales-orders/last?customer_name=${encodeURIComponent(customer_name)}`),
  commonSOItems: (customer_name: string, limit = 50) =>
    request(`/sales-orders/common-items?customer_name=${encodeURIComponent(customer_name)}&limit=${limit}`),

  // sales reports
  productCustomers: (params: any) =>
    request(`/sales-reports/product-customers?${new URLSearchParams(params as any).toString()}`),
  exportProductCustomersXlsx: (params: any) =>
    request(`/sales-reports/product-customers/export.xlsx?${new URLSearchParams(params as any).toString()}`),
  customerHistory: (params: {
    customer_name: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    page_size?: number;
  }) => {
    const usp = new URLSearchParams();
    usp.set('customer_name', params.customer_name);
    if (params.date_from) usp.set('date_from', params.date_from);
    if (params.date_to) usp.set('date_to', params.date_to);
    if (params.page) usp.set('page', String(params.page));
    if (params.page_size) usp.set('page_size', String(params.page_size));
    return request(`/sales-reports/customer-history?${usp.toString()}`);
  },
  productsRank: (params: any) =>
    request(`/sales-reports/products-rank?${new URLSearchParams(params as any).toString()}`),
  exportProductsRankXlsx: (params: any) =>
    request(`/sales-reports/products-rank/export.xlsx?${new URLSearchParams(params as any).toString()}`),

  // customers
  listCustomers: (params: { q?: string } = {}) => {
    const usp = new URLSearchParams();
    if (params.q) usp.set('q', params.q);
    const qs = usp.toString() ? `?${usp.toString()}` : '';
    return request(`/customers${qs}`);
  },
  createCustomer: (payload: any) => request('/customers', { method: 'POST', body: JSON.stringify(payload) }),
  updateCustomer: (id: number, payload: any) => request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  // production reports
  listPRs: (params: { mine?: boolean; status?: string } = {}) => {
    const usp = new URLSearchParams();
    if (params.mine) usp.set('mine', 'true');
    if (params.status) usp.set('status', params.status);
    const qs = usp.toString() ? `?${usp.toString()}` : '';
    return request(`/production-reports${qs}`);
  },
  createPR: (payload: any) =>
    request('/production-reports', { method: 'POST', body: JSON.stringify(payload) }),
  getPR: (id: number) => request(`/production-reports/${id}`),
  lastPR: (params: { mine?: boolean; before?: string } = {}) => {
    const usp = new URLSearchParams();
    if (params.mine !== undefined) usp.set('mine', String(params.mine));
    if (params.before) usp.set('before', params.before);
    const qs = usp.toString() ? `?${usp.toString()}` : '';
    return request(`/production-reports/last${qs}`);
  },
  clonePR: (id: number, payload: any) =>
    request(`/production-reports/${id}/clone`, { method: 'POST', body: JSON.stringify(payload) }),
  approvePR: (id: number) => request(`/production-reports/${id}/approve`, { method: 'POST' }),
  // 後端 reject 需要 POST body 中的 reason 字段
  rejectPR: (id: number, reason?: string) => {
    return request(`/production-reports/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || '' }),
    });
  },
  summaryByEmployee: (params: any) => {
    const usp = new URLSearchParams(params);
    return request(`/production-reports/summary/by-employee?${usp.toString()}`);
  },
  summaryByProduct: (params: any) => {
    const usp = new URLSearchParams(params);
    return request(`/production-reports/summary/by-product?${usp.toString()}`);
  },
  summaryByProductSpec: (params: any) => {
    const usp = new URLSearchParams(params);
    return request(`/production-reports/summary/by-product-spec?${usp.toString()}`);
  },
  exportPRXlsx: (params: any) => {
    const usp = new URLSearchParams(params);
    return request(`/production-reports/export.xlsx?${usp.toString()}`);
  },
  productionKPI: (params: { from_date: string; to_date: string; top_n?: number }) => {
    const usp = new URLSearchParams(params as any);
    return request(`/production-kpi?${usp.toString()}`);
  },
  exportKPIXlsx: (params: { from_date: string; to_date: string; top_n?: number }) => {
    const usp = new URLSearchParams(params as any);
    return request(`/production-kpi/export.xlsx?${usp.toString()}`);
  },

  // users
  listUsers: (params: { q?: string } = {}) => {
    const usp = new URLSearchParams();
    if (params.q) usp.set('q', params.q);
    const qs = usp.toString() ? `?${usp.toString()}` : '';
    return request(`/users${qs}`);
  },
  createUser: (payload: any) => request('/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateUser: (id: number, payload: any) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  userIdMap: (() => {
    let _idmapCache: { at: number; data: any } | null = null;
    return async () => {
      const now = Date.now();
      if (_idmapCache && now - _idmapCache.at < 60_000) return _idmapCache.data;
      const data = await request('/users/idmap');
      _idmapCache = { at: now, data };
      return data;
    };
  })(),

  // BOM
  getBOM: (fgProductId: number) => request(`/bom/${fgProductId}`),
  upsertBOM: (fgProductId: number, payload: { items: Array<{ raw_product_id: number; qty_per_fg_unit: number; note?: string }> }) =>
    request(`/bom/${fgProductId}`, { method: 'PUT', body: JSON.stringify(payload) }),

  // FG Kit
  createFGKit: (payload: any) => request('/fg-kit', { method: 'POST', body: JSON.stringify(payload) } as any),

  // Return Orders
  listReturnOrders: (params?: { customer_name?: string; status?: string }) => {
    const usp = new URLSearchParams();
    if (params?.customer_name) usp.set('customer_name', params.customer_name);
    if (params?.status) usp.set('status', params.status);
    const qs = usp.toString() ? `?${usp.toString()}` : '';
    return request(`/return-orders${qs}`);
  },
  getReturnOrder: (id: number) => request(`/return-orders/${id}`),
  createReturnOrder: (payload: any) =>
    request('/return-orders', { method: 'POST', body: JSON.stringify(payload) }),
  stockReturnOrder: (id: number) =>
    request(`/return-orders/${id}/stock`, { method: 'POST' }),

  // Print Jobs
  createPrintJob: (payload: { kind: string; text: string; encoding?: string; copies?: number }) =>
    request('/print-jobs', { method: 'POST', body: JSON.stringify(payload) }),
};

