// ─── User & Auth ────────────────────────────────────────────────────────────

export type UserRole = "worker" | "client" | "admin";

export type ApprovalStatus =
  | "pending"
  | "approved"
  // Admin reviewed and wants something fixed — the account stays usable and
  // the reason is in `approvalNote`.
  | "changes_required"
  | "rejected";

export interface User {
  id: string;
  // Null for accounts created through Google, which carry an email instead.
  phone: string | null;
  email?: string | null;
  // Captured at signup, before any role profile exists.
  name?: string | null;
  role: UserRole;
  isVerified: boolean;
  isBlocked?: boolean;
  approvalStatus?: ApprovalStatus;
  approvalNote?: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  isNewUser?: boolean;
}

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

// ─── Worker Profile ──────────────────────────────────────────────────────────

export interface WorkerProfile {
  id: string;
  userId: string;
  name: string;
  categoryIds: string[];
  subcategoryIds: string[];
  skills: Skill[];
  experience: number;
  dailyWage: number;
  city?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  bio?: string;
  profilePicture?: string;
  selfieUrl?: string;
  nationalIdCardUrl?: string;
  nationalIdBackUrl?: string;
  availability: boolean;
  rating: number;
  totalJobs: number;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; phone: string | null; createdAt: string };
}

export interface CreateWorkerProfile {
  name: string;
  /** Stored on the user account, not the profile. */
  phone?: string;
  categoryIds: string[];
  subcategoryIds: string[];
  skills?: Skill[];
  experience: number;
  dailyWage: number;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  bio?: string;
  profilePicture?: string;
  selfieUrl?: string;
  nationalIdCardUrl?: string;
  nationalIdBackUrl?: string;
  availability?: boolean;
}

// ─── Client Profile ───────────────────────────────────────────────────────────

export interface ClientProfile {
  id: string;
  userId: string;
  name: string;
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
  categoryId: string;
  subcategoryId: string;
  city?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  budget: number;
  duration: JobDuration;
  status: JobStatus;
  image?: string;
  createdAt: string;
  updatedAt: string;
  client?: {
    id: string;
    phone?: string;
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
  offerAmount?: number;
  status: ApplicationStatus;
  createdAt: string;
  job?: Job;
  worker?: {
    id: string;
    workerProfile?: {
      name: string;
      rating: number;
      skills: string[];
      dailyWage: number;
      city?: string;
      profilePicture?: string;
      experience: number;
    } | null;
  };
}

export type MessageType = "text" | "image" | "location" | "voice";

export interface Message {
  id: string;
  conversationId?: string;
  senderId: string;
  type: MessageType;
  content: string;
  mediaUrl?: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
  readAt?: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  createdAt: string;
  lastMessageAt?: string;
  worker: {
    id: string;
    phone?: string;
    workerProfile?: { name: string; profilePicture?: string } | null;
  };
  client: {
    id: string;
    phone?: string;
    clientProfile?: { name: string; profilePicture?: string } | null;
  };
  messages?: Pick<Message, "content" | "senderId" | "createdAt">[];
}

export interface Review {
  id: string;
  applicationId: string;
  rating: number;
  comment?: string;
  createdAt: string;
  client?: {
    clientProfile?: { name: string; profilePicture?: string } | null;
  };
}

export interface CreateJob {
  title: string;
  description: string;
  categoryId: string;
  subcategoryId: string;
  skills?: Skill[];
  city?: string;
  address?: string;
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

export interface ListResponse<T> {
  success: boolean;
  data: T[];
  pagination: Pagination;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface WorkerFilters {
  categoryIds?: string[];
  subcategoryIds?: string[];
  city?: string;
  available?: boolean;
  minWage?: number;
  maxWage?: number;
  page?: number;
  limit?: number;
}

export interface JobFilters {
  categoryId?: string;
  subcategoryId?: string;
  city?: string;
  status?: JobStatus;
  minBudget?: number;
  maxBudget?: number;
  page?: number;
  limit?: number;
}
