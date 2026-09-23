import { router } from "expo-router";
import Constants from "expo-constants";
import { useAuthStore } from "@/store/authStore";
import type {
  WorkerProfile,
  Job,
  JobApplication,
  Review,
  Conversation,
  Message,
  PaginatedResponse,
  ApiResponse,
  ListResponse,
  WorkerFilters,
  JobFilters,
  CreateWorkerProfile,
  CreateJob,
  AuthResponse,
  ClientProfile,
  ApprovalStatus,
} from "@/types";

function getBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  // In Expo Go / dev builds, derive the host from the dev server so Android
  // physical devices and emulators both resolve correctly without touching .env
  const expoHost = Constants.expoConfig?.hostUri?.split(":")[0];
  if (expoHost) return `http://${expoHost}:5001/api`;
  return "http://${expoHost}:5001/api";
}

export const BASE_URL = getBaseUrl();

// ─── Errors ───────────────────────────────────────────────────────────────────

/** Carries the backend's machine-readable `code` alongside the message. */
export class ApiError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Session expiry handler ───────────────────────────────────────────────────

function handleUnauthorized() {
  // Only log out if the app actually had a token that was rejected.
  // Without this guard, requests that fire before AsyncStorage loads
  // (token is null) would incorrectly trigger a logout.
  if (!useAuthStore.getState().token) return;
  useAuthStore.getState().clearUser();
  router.replace("/auth");
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options?: RequestInit & { auth?: boolean },
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  // Attach stored JWT automatically when auth: true
  if (options?.auth !== false) {
    const token = useAuthStore.getState().token;
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Session expired. Please log in again.");
  }

  const text = await res.text();
  if (!text) throw new Error(`Empty response from ${path} (${res.status})`);

  let json: ApiResponse<T>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Server returned non-JSON response (${res.status}): ${text.slice(0, 100)}`);
  }

  if (!json.success) {
    throw new ApiError(json.message ?? "Request failed", json.code);
  }

  return json.data as T;
}

// Converts the new backend list response to the PaginatedResponse shape
// used by the existing screens (hasMore, data, etc.)
async function listRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<PaginatedResponse<T>> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Session expired. Please log in again.");
  }

  const text = await res.text();
  if (!text) throw new Error(`Empty response from ${path} (${res.status})`);

  let json: ListResponse<T>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Server returned non-JSON (${res.status}): ${text.slice(0, 100)}`);
  }

  if (!json.success) throw new Error("Request failed");

  const { data, pagination } = json;
  return {
    data,
    total: pagination.total,
    page: pagination.page,
    limit: pagination.limit,
    hasMore: pagination.page < pagination.totalPages,
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  sendOtp: (phone: string) =>
    request<{ message: string; isNewUser: boolean }>("/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ phone }),
      auth: false,
    }),

  verifyOtp: (phone: string, code: string, role?: "worker" | "client") =>
    request<AuthResponse>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone, code, role }),
      auth: false,
    }),

  /**
   * Exchanges a Google ID token for a Mazduuri session.
   *
   * `role` is only read when the Google account has no user yet; without it
   * the backend rejects the call with VALIDATION_ERROR so the caller can
   * collect one and retry.
   */
  google: (idToken: string, role?: "worker" | "client", name?: string) =>
    request<AuthResponse>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken, role, name }),
      auth: false,
    }),

  register: (payload: {
    email: string;
    password: string;
    name: string;
    role: "worker" | "client";
  }) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
      auth: false,
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      auth: false,
    }),

  me: () =>
    request<{
      id: string;
      phone: string | null;
      email?: string | null;
      name?: string | null;
      role: string;
      isVerified: boolean;
      approvalStatus: ApprovalStatus;
      approvalNote?: string | null;
      workerProfile: WorkerProfile | null;
      clientProfile: ClientProfile | null;
    }>("/auth/me"),

  switchRole: (newRole: "worker" | "client") =>
    request<AuthResponse>("/auth/switch-role", {
      method: "POST",
      body: JSON.stringify({ newRole }),
    }),

  logout: () =>
    request<{ message: string }>("/auth/logout", { method: "POST" }),
};

// ─── Workers ──────────────────────────────────────────────────────────────────

export const workersApi = {
  list: (filters?: WorkerFilters) => {
    const params = new URLSearchParams();
    if (filters?.categoryIds?.length)
      params.set("categoryIds", filters.categoryIds.join(","));
    if (filters?.subcategoryIds?.length)
      params.set("subcategoryIds", filters.subcategoryIds.join(","));
    if (filters?.city) params.set("city", filters.city);
    if (filters?.available !== undefined)
      params.set("available", String(filters.available));
    if (filters?.minWage) params.set("minWage", String(filters.minWage));
    if (filters?.maxWage) params.set("maxWage", String(filters.maxWage));
    if (filters?.page) params.set("page", String(filters.page));
    if (filters?.limit) params.set("limit", String(filters.limit));
    const qs = params.toString();
    return listRequest<WorkerProfile>(`/workers${qs ? `?${qs}` : ""}`);
  },

  get: (id: string) => request<WorkerProfile>(`/workers/${id}`),

  getReviews: (workerId: string) =>
    request<Review[]>(`/workers/${workerId}/reviews`, { auth: false }),

  submitReview: (
    workerId: string,
    payload: { applicationId: string; rating: number; comment?: string },
  ) =>
    request<Review>(`/workers/${workerId}/reviews`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  save: (id: string) =>
    request<{ workerId: string; saved: boolean }>(`/workers/${id}/save`, {
      method: "POST",
    }),

  unsave: (id: string) =>
    request<{ workerId: string; saved: boolean }>(`/workers/${id}/save`, {
      method: "DELETE",
    }),

  listSaved: () => listRequest<WorkerProfile>("/workers/saved"),

  /** Just the ids — enough to render every heart without fetching profiles. */
  savedIds: () => request<string[]>("/workers/saved/ids"),

  upsertProfile: (data: CreateWorkerProfile) =>
    request<WorkerProfile>("/workers/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export const jobsApi = {
  list: (filters?: JobFilters) => {
    const params = new URLSearchParams();
    if (filters?.categoryId) params.set("categoryId", filters.categoryId);
    if (filters?.subcategoryId) params.set("subcategoryId", filters.subcategoryId);
    if (filters?.city) params.set("city", filters.city);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.minBudget) params.set("minBudget", String(filters.minBudget));
    if (filters?.maxBudget) params.set("maxBudget", String(filters.maxBudget));
    if (filters?.page) params.set("page", String(filters.page));
    const qs = params.toString();
    return listRequest<Job>(`/jobs${qs ? `?${qs}` : ""}`);
  },

  get: (id: string) => request<Job>(`/jobs/${id}`),

  create: (data: CreateJob) =>
    request<Job>("/jobs", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  apply: (id: string, payload: { message?: string; offerAmount?: number }) =>
    request<JobApplication>(`/jobs/${id}/apply`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (id: string, data: Partial<CreateJob>) =>
    request<Job>(`/jobs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  updateStatus: (id: string, status: "open" | "in_progress" | "completed" | "cancelled") =>
    request<{ id: string; status: string }>(`/jobs/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  delete: (id: string) =>
    request<null>(`/jobs/${id}`, { method: "DELETE" }),

  getMy: () => request<Job[] | JobApplication[]>("/jobs/my"),

  updateApplication: (
    jobId: string,
    applicationId: string,
    status: "accepted" | "rejected",
  ) =>
    request<{ id: string; status: string }>(`/jobs/${jobId}/applications/${applicationId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};

// ─── Chat ─────────────────────────────────────────────────────────────────────

export const chatApi = {
  start: (workerId: string) =>
    request<Conversation>("/conversations", {
      method: "POST",
      body: JSON.stringify({ workerId }),
    }),

  list: () => request<Conversation[]>("/conversations"),

  getMessages: (conversationId: string, cursor?: string) => {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return request<Message[]>(`/conversations/${conversationId}/messages${qs}`);
  },

  send: (
    conversationId: string,
    payload:
      | { type?: "text"; content: string }
      | { type: "image"; mediaUrl: string; content?: string }
      | { type: "location"; latitude: number; longitude: number; locationLabel?: string; content?: string }
      | { type: "voice"; mediaUrl: string },
  ) =>
    request<Message>(`/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  markRead: (conversationId: string) =>
    request<null>(`/conversations/${conversationId}/read`, { method: "POST" }),
};

// ─── Profile ──────────────────────────────────────────────────────────────────

export const profileApi = {
  get: () =>
    request<WorkerProfile | ClientProfile | null>("/profile"),

  upsertClient: (data: {
    name: string;
    /** Stored on the user account, not the profile. */
    phone?: string;
    companyName?: string;
    categoryIds: string[];
    subcategoryIds: string[];
    address?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    profilePicture?: string;
    selfieUrl?: string;
    nationalIdCardUrl?: string;
    nationalIdBackUrl?: string;
  }) =>
    request<ClientProfile>("/profile/client", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// ─── Notifications ────────────────────────────────────────────────────────────

export interface NotificationPreferences {
  pushChat: boolean;
  pushApplications: boolean;
  pushReview: boolean;
  pushNewJobs: boolean;
}

export const notificationsApi = {
  registerToken: (token: string, platform: "android" | "ios") =>
    request<{ registered: boolean; pushEnabled: boolean }>("/notifications/token", {
      method: "POST",
      body: JSON.stringify({ token, platform }),
    }),

  unregisterToken: (token: string) =>
    request<{ unregistered: boolean }>("/notifications/token", {
      method: "DELETE",
      body: JSON.stringify({ token }),
    }),

  getPreferences: () =>
    request<NotificationPreferences & { pushEnabled: boolean }>(
      "/notifications/preferences",
    ),

  updatePreferences: (prefs: Partial<NotificationPreferences>) =>
    request<NotificationPreferences>("/notifications/preferences", {
      method: "PATCH",
      body: JSON.stringify(prefs),
    }),
};

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadAudio(uri: string): Promise<string> {
  const token = useAuthStore.getState().token;

  const formData = new FormData();
  formData.append("audio", {
    uri,
    type: "audio/m4a",
    name: "voice.m4a",
  } as unknown as Blob);

  const res = await fetch(`${BASE_URL}/upload/audio`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
  });

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Session expired. Please log in again.");
  }

  const text = await res.text();
  if (!text) throw new Error(`Audio upload failed (${res.status})`);
  const json = JSON.parse(text);
  if (!json.success) throw new Error(json.message ?? "Audio upload failed");
  return json.data.url as string;
}

export async function uploadImage(
  uri: string,
  folder: "profiles" | "jobs" | "documents",
): Promise<string> {
  const token = useAuthStore.getState().token;

  const formData = new FormData();
  formData.append("image", {
    uri,
    type: "image/jpeg",
    name: "upload.jpg",
  } as unknown as Blob);
  formData.append("folder", folder);

  const res = await fetch(`${BASE_URL}/upload`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Session expired. Please log in again.");
  }

  const text = await res.text();
  if (!text) throw new Error(`Upload failed (${res.status})`);

  const json = JSON.parse(text);
  if (!json.success) throw new Error(json.message ?? "Upload failed");

  return json.data.url as string;
}