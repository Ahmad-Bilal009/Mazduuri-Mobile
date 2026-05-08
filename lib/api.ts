import { router } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import type {
  WorkerProfile,
  Job,
  JobApplication,
  PaginatedResponse,
  ApiResponse,
  ListResponse,
  WorkerFilters,
  JobFilters,
  CreateWorkerProfile,
  CreateJob,
  AuthResponse,
  ClientProfile,
} from "@/types";

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5001/api";

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
    throw new Error(json.message ?? "Request failed");
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

  me: () =>
    request<{ id: string; phone: string; role: string; workerProfile: WorkerProfile | null; clientProfile: ClientProfile | null }>("/auth/me"),

  logout: () =>
    request<{ message: string }>("/auth/logout", { method: "POST" }),
};

// ─── Workers ──────────────────────────────────────────────────────────────────

export const workersApi = {
  list: (filters?: WorkerFilters) => {
    const params = new URLSearchParams();
    if (filters?.skills?.length) params.set("skills", filters.skills.join(","));
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
    if (filters?.skills?.length) params.set("skills", filters.skills.join(","));
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

  apply: (id: string, message?: string) =>
    request<JobApplication>(`/jobs/${id}/apply`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  getMy: () => request<Job[] | JobApplication[]>("/jobs/my"),
};

// ─── Profile ──────────────────────────────────────────────────────────────────

export const profileApi = {
  get: () =>
    request<WorkerProfile | ClientProfile | null>("/profile"),

  upsertClient: (data: { name: string; companyName?: string; city: string; profilePicture?: string }) =>
    request<ClientProfile>("/profile/client", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadImage(
  uri: string,
  folder: "profiles" | "jobs",
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