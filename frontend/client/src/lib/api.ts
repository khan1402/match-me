// REST API Client for Match-Me

const API_ORIGIN = import.meta.env.VITE_API_URL || "http://localhost:8080";
const API_BASE = `${API_ORIGIN}/api`;

class APIError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "APIError";
    this.status = status;
  }
}

// Try to parse JSON if possible, otherwise return text
async function readResponseBody(response: Response): Promise<any> {
  const contentType = response.headers.get("content-type") || "";

  // 204 / 205 => no content
  if (response.status === 204 || response.status === 205) return null;

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  // fallback: text (HTML, plain text, etc.)
  return response.text().catch(() => null);
}

async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "include",
  });

  const body = await readResponseBody(response);

  if (!response.ok) {
    // Try to extract a meaningful message
    const msg =
      (body && typeof body === "object" && (body.error || body.message)) ||
      (typeof body === "string" && body) ||
      "Request failed";

    throw new APIError(response.status, msg);
  }

  return body as T;
}

// ------------------------- AUTH -------------------------

export const auth = {
  register: (email: string, password: string, name?: string) =>
    fetchAPI("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),

  login: (email: string, password: string) =>
    fetchAPI("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    fetchAPI("/auth/logout", {
      method: "POST",
    }),

  me: () => fetchAPI("/me"),
};

// ------------------------- USERS -------------------------

export const users = {
  getUser: (id: number) => fetchAPI(`/users/${id}`),
  getProfile: (id: number) => fetchAPI(`/users/${id}/profile`),
  getBio: (id: number) => fetchAPI(`/users/${id}/bio`),
  getDiscoveryBio: (id: number) => fetchAPI(`/users/${id}/discovery`),
};

// ------------------------- PROFILE -------------------------

export const profile = {
  getMyProfile: () => fetchAPI("/me/profile"),
  getMyBio: () => fetchAPI("/me/bio"),
  updateProfile: (data: any) =>
    fetchAPI("/me/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// ------------------------- PROMPTS -------------------------

export const prompts = {
  getAll: () => fetchAPI("/prompts"),
  getUserPrompts: () => fetchAPI("/me/prompts"),
  addPrompt: (promptId: number, answer: string, displayOrder?: number) =>
    fetchAPI("/me/prompts", {
      method: "POST",
      body: JSON.stringify({ promptId, answer, displayOrder }),
    }),
  removePrompt: (promptId: number) =>
    fetchAPI(`/me/prompts/${promptId}`, {
      method: "DELETE",
    }),
};

// ------------------------- INTERESTS -------------------------

export const interests = {
  getAll: () => fetchAPI("/interests"),
  getUserInterests: () => fetchAPI("/me/interests"),
  addInterest: (interestId: number) =>
    fetchAPI("/me/interests", {
      method: "POST",
      body: JSON.stringify({ interestId }),
    }),
  removeInterest: (interestId: number) =>
    fetchAPI(`/me/interests/${interestId}`, {
      method: "DELETE",
    }),
};

// ------------------------- DISCOVERY -------------------------

export const discovery = {
  /**
   * Fetch a list of recommended user identifiers. The backend may return a
   * plain array of numbers (e.g. `[1, 2, 3]`), an object containing a
   * `recommendations` property, or a `data` property with an array of
   * recommendation objects. This helper normalises the response into an array
   * of numeric IDs. If recommendation objects are returned, their `id` field
   * is extracted.
   */
  getRecommendations: async (): Promise<number[]> => {
    const res: any = await fetchAPI("/recommendations");
    let arr: any[] = [];
    if (Array.isArray(res)) {
      arr = res;
    } else if (res && Array.isArray(res.recommendations)) {
      arr = res.recommendations;
    } else if (res && Array.isArray(res.data)) {
      arr = res.data;
    }
    return arr.map((item) => (typeof item === "number" ? item : item?.id)).filter((id) => typeof id === "number");
  },

  /**
   * Interact with a recommended user. The API supports `like`, `pass` and
   * `dismiss` actions. Map the interaction type to the appropriate backend
   * endpoint. Unknown types will result in an error.
   */
  interact: (targetUserId: number, type: string, promptId?: number, comment?: string) => {
    let endpoint: string;
    switch (type) {
      case "like":
        endpoint = `/recommendations/${targetUserId}/like`;
        break;
      case "pass":
        endpoint = `/recommendations/${targetUserId}/pass`;
        break;
      case "dismiss":
        endpoint = `/recommendations/${targetUserId}/dismiss`;
        break;
      default:
        throw new Error(`Unknown interaction type: ${type}`);
    }
    return fetchAPI(endpoint, { method: "POST", body: JSON.stringify({ promptId, comment }) });
  },
};

// ------------------------- MATCHES / CONNECTIONS -------------------------

export const matches = {
  getMyMatches: () => fetchAPI("/matches"),
  getConnections: () => fetchAPI("/connections"),
  disconnect: (matchId: number) => fetchAPI(`/connections/${matchId}`, { method: "DELETE" }),
};

// ------------------------- LIKES -------------------------

export const likes = {
  getMyLikes: () => fetchAPI("/me/likes"),
};

// ------------------------- MESSAGES (CHAT) -------------------------

export const messages = {
  getMessages: (matchId: number) => fetchAPI(`/matches/${matchId}/messages`),

  sendMessage: (matchId: number, receiverId: number, content: string) =>
    fetchAPI(`/matches/${matchId}/messages`, {
      method: "POST",
      body: JSON.stringify({ receiverId, content }),
    }),

  markAsRead: (matchId: number) =>
    fetchAPI(`/matches/${matchId}/read`, {
      method: "POST",
    }),

  typing: (matchId: number, receiverId: number, isTyping: boolean) =>
    fetchAPI(`/matches/${matchId}/typing`, {
      method: "POST",
      body: JSON.stringify({ receiverId, isTyping }),
    }),

  getMessagesPaginated: (matchId: number, limit?: number, page?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append("limit", String(limit));
    if (page) params.append("page", String(page));
    const query = params.toString();
    return fetchAPI(`/matches/${matchId}/messages${query ? `?${query}` : ""}`);
  },
};

// ------------------------- NOTIFICATIONS -------------------------

export const notifications = {
  getMyNotifications: () => fetchAPI("/me/notifications"),
  markAsRead: (id: number) =>
    fetchAPI(`/me/notifications/${id}/read`, {
      method: "POST",
    }),
};

// ------------------------- CONNECTION REQUESTS -------------------------

export const connectionRequests = {
  getIncoming: () => fetchAPI("/connection-requests"),
  accept: (fromUserId: number) =>
    fetchAPI(`/connection-requests/${fromUserId}/accept`, { method: "POST" }),
  reject: (fromUserId: number) =>
    fetchAPI(`/connection-requests/${fromUserId}/reject`, { method: "POST" }),
};

// ------------------------- PHOTOS -------------------------

export const photos = {
  getMyPhotos: () => fetchAPI("/me/photos"),
  addPhoto: (url: string) =>
  fetchAPI("/me/photos", {
    method: "POST",
    body: JSON.stringify({ photoUrl: url }),
  }),
  deletePhoto: (photoId: number) =>
    fetchAPI(`/me/photos/${photoId}`, { method: "DELETE" }),
};

// ------------------------- SAFETY -------------------------

export const safety = {
  reportUser: (reportedUserId: number, reason: string) =>
    fetchAPI("/reports", {
      method: "POST",
      body: JSON.stringify({ reportedUserId, reason }),
    }),
  blockUser: (blockedUserId: number) =>
    fetchAPI("/blocks", {
      method: "POST",
      body: JSON.stringify({ blockedUserId }),
    }),
};

// ------------------------- DEFAULT EXPORT -------------------------

const api = {
  auth,
  users,
  profile,
  prompts,
  interests,
  discovery,
  matches,
  messages,
  photos,
  safety,
  likes,
  notifications,
  connectionRequests,
};

export default api;
export { APIError };
