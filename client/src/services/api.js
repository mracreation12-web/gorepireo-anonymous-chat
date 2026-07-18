const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
console.log("========== API DEBUG ==========");
console.log("VITE_API_URL =", import.meta.env.VITE_API_URL);
console.log("API_BASE_URL =", API_BASE_URL);
console.log("===============================");



/**
 * Service to manage HTTP communication with the REST backend.
 */
class ApiService {
  /**
   * Helper to perform standard JSON requests.
   */
  async #request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, { ...options, headers });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'An error occurred during request');
      }

      return data;
    } catch (error) {
      console.error(`[ApiService] Request to ${endpoint} failed:`, error);
      throw error;
    }
  }

  /**
   * Checks the health of the backend REST server.
   */
  async checkHealth() {
    return this.#request('/health');
  }

  /**
   * Fetches historical chat messages.
   * @param {string} room - Room filter.
   * @param {number} limit - Retrieval limit.
   */
  async getMessages(room = 'general', limit = 100) {
    const query = new URLSearchParams({ room, limit: limit.toString() }).toString();
    return this.#request(`/messages?${query}`);
  }

  /**
   * Submits a new message via REST (fallback/rest flow).
   */
  async createMessage(payload) {
    return this.#request('/messages', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export default new ApiService();
