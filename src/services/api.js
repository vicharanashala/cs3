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

export async function suggestCommunityAnswer(data) {
  try {
    const response = await api.post('/community/suggest', data);
    return response.data;
  } catch (error) {
    console.error('API Error [suggestCommunityAnswer]:', error);
    throw error;
  }
}

export async function getCommunityContributions() {
  try {
    const response = await api.get('/community/contributions');
    return response.data;
  } catch (error) {
    console.error('API Error [getCommunityContributions]:', error);
    throw error;
  }
}

export async function getCommunityStats() {
  try {
    const response = await api.get('/community/stats');
    return response.data;
  } catch (error) {
    console.error('API Error [getCommunityStats]:', error);
    throw error;
  }
}

export async function getCommunityLeaderboard() {
  try {
    const response = await api.get('/community/leaderboard');
    return response.data;
  } catch (error) {
    console.error('API Error [getCommunityLeaderboard]:', error);
    throw error;
  }
}

export async function getAdminQueue(hash) {
  try {
    const params = hash ? { hash } : {};
    const response = await api.get('/admin/queue', { params });
    return response.data;
  } catch (error) {
    console.error('API Error [getAdminQueue]:', error);
    throw error;
  }
}

export async function adminReviewQueueItem(id, action) {
  try {
    const response = await api.put(`/admin/queue/${id}`, { action });
    return response.data;
  } catch (error) {
    console.error('API Error [adminReviewQueueItem]:', error);
    throw error;
  }
}

export async function adminDeleteCommunityHash(hash) {
  try {
    const response = await api.delete(`/admin/community/${hash}`);
    return response.data;
  } catch (error) {
    console.error('API Error [adminDeleteCommunityHash]:', error);
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
  suggestCommunityAnswer,
  getCommunityContributions,
  getCommunityStats,
  getCommunityLeaderboard,
  getAdminQueue,
  adminReviewQueueItem,
  adminDeleteCommunityHash,
};
