import axios from 'axios';

// Configure axios with base URL to match Vite base path
// Remove trailing slash from BASE_URL if present to avoid double slashes
const baseURL = (import.meta.env.BASE_URL || '/monitor/').replace(/\/$/, '');
const apiClient = axios.create({
  baseURL: baseURL,
});

export default apiClient;