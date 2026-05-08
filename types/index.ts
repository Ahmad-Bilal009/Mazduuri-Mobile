// ─── User & Auth ────────────────────────────────────────────────────────────

export type UserRole = "worker" | "client" | "admin";

export interface User {
  id: string;
  phone: string;
  role: UserRole;
  isVerified: boolean;
  isBlocked?: boolean;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  isNewUser?: boolean;
}

// ─── Worker Profile ──────────────────────────────────────────────────────────

export type Skill =
  | "construction"
  | "plumbing"
  | "electrical"
  | "painting"
  | "carpentry"
  | "welding"
  | "driving"
  | "cleaning"
  | "cooking"
  | "agriculture"
  | "security"
  | "other";

export interface WorkerProfile {
  id: string;
  userId: string;
  name: string;
  skills: Skill[];
  experience: number;
  dailyWage: number;
  city: string;
  latitude?: number;
  longitude?: number;
  bio?: string;
  profilePicture?: string;
  availability: boolean;
  rating: number;
  totalJobs: number;
  createdAt: string;
  updatedAt: string;
  // Included by GET /workers/:id
  user?: { id: string; phone: string; createdAt: string };
}

export interface CreateWorkerProfile {
  name: string;
  skills: Skill[];
  experience: number;
  dailyWage: number;
  city: string;
  latitude?: number;
  longitude?: number;
  bio?: string;
  profilePicture?: string;
  availability?: boolean;
}

// ─── Client Profile ───────────────────────────────────────────────────────────

export interface ClientProfile {
  id: string;
  userId: string;
  name: string;
  companyName?: string;
  city: string;
  profilePicture?: string;
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export type JobStatus = "open" | "in_progress" | "completed" | "cancelled";
export type JobDuration = "one_day" | "few_days" | "one_week" | "one_month" | "ongoing";
export type ApplicationStatus = "pending" | "accepted" | "rejected";

export interface Job {
  id: string;
  clientId: string;
  title: string;
  description: string;
  skills: Skill[];
  city: string;
  latitude?: number;
  longitude?: number;
  budget: number;
  duration: JobDuration;
  status: JobStatus;
  image?: string;
  createdAt: string;
  updatedAt: string;
  // Included in list/detail responses
  client?: {
    id: string;
    clientProfile?: { name: string; companyName?: string; city?: string } | null;
  };
  _count?: { applications: number };
  applications?: JobApplication[];
}

export interface JobApplication {
  id: string;
  jobId: string;
  workerId: string;
  message?: string;
  status: ApplicationStatus;
  createdAt: string;
  job?: Job;
  worker?: {
    id: string;
    workerProfile?: { name: string; rating: number; skills: Skill[] } | null;
  };
}

export interface CreateJob {
  title: string;
  description: string;
  skills: Skill[];
  city: string;
  latitude?: number;
  longitude?: number;
  budget: number;
  duration: JobDuration;
  image?: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Shape returned by list endpoints on the new backend
export interface ListResponse<T> {
  success: boolean;
  data: T[];
  pagination: Pagination;
}

// Convenience wrapper kept for screen compatibility
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface WorkerFilters {
  skills?: Skill[];
  city?: string;
  available?: boolean;
  minWage?: number;
  maxWage?: number;
  page?: number;
  limit?: number;
}

export interface JobFilters {
  skills?: Skill[];
  city?: string;
  status?: JobStatus;
  minBudget?: number;
  maxBudget?: number;
  page?: number;
  limit?: number;
}