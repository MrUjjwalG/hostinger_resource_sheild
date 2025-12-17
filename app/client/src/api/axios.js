import axios from 'axios';

// Configure axios with base URL to match Vite base path
// Remove trailing slash from BASE_URL if present to avoid double slashes
const baseURL = (import.meta.env.BASE_URL || '/monitor/').replace(/\/$/, '');
const apiClient = axios.create({
  baseURL: baseURL,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Check if 401 and NOT from login endpoint
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    if (error.response && error.response.status === 401 && !isLoginRequest) {
      localStorage.removeItem('token');
      window.location.href = `${baseURL}/login`;
    }
    return Promise.reject(error);
  }
);

export default apiClient;