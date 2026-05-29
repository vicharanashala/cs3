import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach x-admin-key if present in localStorage
api.interceptors.request.use(
  (config) => {
    const adminKey = localStorage.getItem('adminKey');
    if (adminKey) {
      config.headers['x-admin-key'] = adminKey;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle unauthorized responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('adminKey');
      // If we are not already on the admin page, redirect
      if (window.location.pathname !== '/admin') {
        window.location.href = '/admin';
      }
    }
    return Promise.reject(error);
  }
);

export async function getFAQs() {
  try {
    const response = await api.get('/faq');
    return response.data;
  } catch (error) {
    console.error('API Error [getFAQs]:', error);
    throw error;
  }
}

export async function getOnboardingFAQs() {
  try {
    const response = await api.get('/faq/onboarding');
    return response.data;
  } catch (error) {
    console.error('API Error [getOnboardingFAQs]:', error);
    throw error;
  }
}

export async function getFAQById(id) {
  try {
    const response = await api.get(`/faq/${id}`);
    return response.data;
  } catch (error) {
    console.error(`API Error [getFAQById ${id}]:`, error);
    throw error;
  }
}

export async function getFAQHistory(id) {
  try {
    const response = await api.get(`/faq/${id}/history`);
    return response.data;
  } catch (error) {
    console.error(`API Error [getFAQHistory ${id}]:`, error);
    throw error;
  }
}

export async function createFAQ(data) {
  try {
    const response = await api.post('/faq', data);
    return response.data;
  } catch (error) {
    console.error('API Error [createFAQ]:', error);
    throw error;
  }
}

export async function updateFAQ(id, data) {
  try {
    const response = await api.put(`/faq/${id}`, data);
    return response.data;
  } catch (error) {
    console.error(`API Error [updateFAQ ${id}]:`, error);
    throw error;
  }
}

export async function voteFAQ(id, data) {
  try {
    const response = await api.post(`/faq/${id}/vote`, data);
    return response.data;
  } catch (error) {
    console.error(`API Error [voteFAQ ${id}]:`, error);
    throw error;
  }
}

export async function askAI(query) {
  try {
    const response = await api.post('/ai/ask', { query });
    return response.data;
  } catch (error) {
    console.error('API Error [askAI]:', error);
    throw error;
  }
}

export async function submitQuery(data) {
  try {
    const response = await api.post('/query', data);
    return response.data;
  } catch (error) {
    console.error('API Error [submitQuery]:', error);
    throw error;
  }
}

export async function getQueryById(id) {
  try {
    const response = await api.get(`/query/${id}`);
    return response.data;
  } catch (error) {
    console.error(`API Error [getQueryById ${id}]:`, error);
    throw error;
  }
}

export async function updateQueryStatus(id, status) {
  try {
    const response = await api.patch(`/query/${id}`, { status });
    return response.data;
  } catch (error) {
    console.error(`API Error [updateQueryStatus ${id}]:`, error);
    throw error;
  }
}

export async function getAdminGaps() {
  try {
    const response = await api.get('/admin/gaps');
    return response.data;
  } catch (error) {
    console.error('API Error [getAdminGaps]:', error);
    throw error;
  }
}

export async function getAdminHeatmap() {
  try {
    const response = await api.get('/admin/heatmap');
    return response.data;
  } catch (error) {
    console.error('API Error [getAdminHeatmap]:', error);
    throw error;
  }
}

export async function getAdminRageSessions() {
  try {
    const response = await api.get('/admin/rage-sessions');
    return response.data;
  } catch (error) {
    console.error('API Error [getAdminRageSessions]:', error);
    throw error;
  }
}

export async function getAdminPopular() {
  try {
    const response = await api.get('/admin/popular');
    return response.data;
  } catch (error) {
    console.error('API Error [getAdminPopular]:', error);
    throw error;
  }
}

// ─────────────────────────────────────────────
// COMMUNITY API
// ─────────────────────────────────────────────

export async function submitCommunityAnswer({ faq_id, answer_text, visitor_id, display_name, comment }) {
  try {
    const response = await api.post('/community/answers', { faq_id, answer_text, visitor_id, display_name, comment });
    return response.data;
  } catch (error) {
    console.error('API Error [submitCommunityAnswer]:', error);
    throw error;
  }
}

export async function getCommunityAnswers(faqId) {
  try {
    const response = await api.get(`/community/faq/${faqId}/answers`);
    return response.data;
  } catch (error) {
    console.error(`API Error [getCommunityAnswers ${faqId}]:`, error);
    throw error;
  }
}

export async function disagreeCommunityAnswer(answerId, { reason, visitor_id }) {
  try {
    const response = await api.post(`/community/answers/${answerId}/disagree`, { reason, visitor_id });
    return response.data;
  } catch (error) {
    console.error(`API Error [disagreeCommunityAnswer ${answerId}]:`, error);
    throw error;
  }
}

export async function createIssue({ faq_id, reason, visitor_id, suggested_question }) {
  try {
    const response = await api.post('/community/issues', { faq_id, reason, visitor_id, suggested_question });
    return response.data;
  } catch (error) {
    console.error('API Error [createIssue]:', error);
    throw error;
  }
}

// ─────────────────────────────────────────────
// ADMIN QUEUE API
// ─────────────────────────────────────────────

export async function getAdminQueue(tab) {
  try {
    const response = await api.get('/admin/queue', { params: { tab } });
    return response.data;
  } catch (error) {
    console.error('API Error [getAdminQueue]:', error);
    throw error;
  }
}

export async function adminReviewAnswer(answerId, action) {
  try {
    const response = await api.put(`/admin/answers/${answerId}`, { action });
    return response.data;
  } catch (error) {
    console.error(`API Error [adminReviewAnswer ${answerId}]:`, error);
    throw error;
  }
}

export async function getAdminIssues() {
  try {
    const response = await api.get('/admin/issues');
    return response.data;
  } catch (error) {
    console.error('API Error [getAdminIssues]:', error);
    throw error;
  }
}

export async function adminResolveIssue(issueId, status) {
  try {
    const response = await api.put(`/admin/issues/${issueId}`, { status });
    return response.data;
  } catch (error) {
    console.error(`API Error [adminResolveIssue ${issueId}]:`, error);
    throw error;
  }
}

export default {
  getFAQs,
  getOnboardingFAQs,
  getFAQById,
  getFAQHistory,
  createFAQ,
  updateFAQ,
  voteFAQ,
  askAI,
  submitQuery,
  getQueryById,
  updateQueryStatus,
  getAdminGaps,
  getAdminHeatmap,
  getAdminRageSessions,
  getAdminPopular,
  submitCommunityAnswer,
  getCommunityAnswers,
  disagreeCommunityAnswer,
  createIssue,
  getAdminQueue,
  adminReviewAnswer,
  getAdminIssues,
  adminResolveIssue,
};
