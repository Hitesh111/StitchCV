const API_BASE = '/api';

async function request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    };

    const response = await fetch(url, config);

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(error.detail || `API error: ${response.status}`);
    }

    return response.json();
}

export const api = {
    // Health
    health: () => request('/health'),

    // Jobs
    getJobs: (params = {}) => {
        const query = new URLSearchParams();
        if (params.status) query.set('status', params.status);
        if (params.search) query.set('search', params.search);
        if (params.min_score) query.set('min_score', params.min_score);
        if (params.limit) query.set('limit', params.limit);
        const qs = query.toString();
        return request(`/jobs${qs ? `?${qs}` : ''}`);
    },

    getJob: (id) => request(`/jobs/${id}`),

    // Actions
    discover: (data) =>
        request('/discover', { method: 'POST', body: JSON.stringify(data) }),

    analyze: (data = { limit: 10 }) =>
        request('/analyze', { method: 'POST', body: JSON.stringify(data) }),

    prepare: (data = { min_score: 0.5, limit: 5 }) =>
        request('/prepare', { method: 'POST', body: JSON.stringify(data) }),

    apply: (applicationId, skipReview = false) =>
        request('/apply', {
            method: 'POST',
            body: JSON.stringify({ application_id: applicationId, skip_review: skipReview }),
        }),

    approve: (applicationId) =>
        request(`/approve/${applicationId}`, { method: 'POST' }),

    // Applications
    getApplications: (params = {}) => {
        const query = new URLSearchParams();
        if (params.status) query.set('status', params.status);
        if (params.limit) query.set('limit', params.limit);
        const qs = query.toString();
        return request(`/applications${qs ? `?${qs}` : ''}`);
    },

    getPending: () => request('/pending'),

    // Stats
    getStats: () => request('/stats'),
};

export default api;
