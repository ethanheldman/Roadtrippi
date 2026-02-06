const API = ""; // same origin via Vite proxy

/** Resolve avatar URL for img src so uploads are requested via the API (same-origin /api/uploads/). */
export function getAvatarSrc(avatarUrl: string | null | undefined): string {
  if (!avatarUrl) return "";
  if (avatarUrl.startsWith("http")) return avatarUrl;
  return "/api" + (avatarUrl.startsWith("/") ? avatarUrl : "/" + avatarUrl);
}

function getToken(): string | null {
  return localStorage.getItem("token");
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "X-Request-Path": path,
    ...(options.headers as Record<string, string>),
  };
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers, cache: "no-store" });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string; detail?: string };
    // Prefer detail (serverless debug) / message (Fastify) over generic error
    const msg = err.detail ?? err.message ?? err.error ?? res.statusText;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export type Attraction = {
  id: string;
  name: string;
  description?: string;
  city?: string;
  state: string;
  latitude?: string;
  longitude?: string;
  imageUrl?: string;
  sourceUrl?: string;
  visitCount?: number;
  avgRating?: number | null;
  ratingCount?: number;
  categories?: { id: string; name: string; slug: string; icon?: string }[];
  /** Miles from user location when lat/lng provided */
  distanceMiles?: number | null;
};

export type AttractionDetail = Attraction & {
  address?: string;
  recentCheckIns?: RecentCheckIn[];
  popularCheckIns?: RecentCheckIn[];
  photoCount?: number;
};

export type Paginated<T> = { items: T[]; total: number; page: number; limit: number };

export const auth = {
  login: (username: string, password: string) =>
    api<{ user: unknown; token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  register: (username: string, email: string, password: string) =>
    api<{ user: unknown; token: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    }),
  me: () =>
    api<{
      id: string;
      username: string;
      email: string;
      avatarUrl?: string | null;
      bio?: string | null;
      location?: string | null;
      checkInCount?: number;
      createdAt?: string;
    }>("/api/auth/me"),
};

export type Category = { id: string; name: string; slug: string; icon?: string | null };

export type MapAttraction = {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  latitude: number;
  longitude: number;
  imageUrl?: string;
  sourceUrl?: string;
};

export const attractions = {
  mapMarkers: () =>
    api<{ items: MapAttraction[] }>("/api/attractions/map"),
  list: (params?: {
    page?: number;
    limit?: number;
    state?: string;
    city?: string;
    search?: string;
    category?: string;
    sortBy?: "name" | "state" | "city" | "createdAt" | "visitCount" | "rating" | "distance";
    sortOrder?: "asc" | "desc";
    lat?: number;
    lng?: number;
  }) => {
    const q = new URLSearchParams();
    q.set("page", String(params?.page ?? 1));
    q.set("limit", String(params?.limit ?? 24));
    if (params?.state) q.set("state", params.state);
    if (params?.city) q.set("city", params.city);
    if (params?.search) q.set("search", params.search);
    if (params?.category) q.set("category", params.category);
    if (params?.sortBy) q.set("sortBy", params.sortBy);
    if (params?.sortOrder) q.set("sortOrder", params.sortOrder);
    if (params?.lat != null) q.set("lat", String(params.lat));
    if (params?.lng != null) q.set("lng", String(params.lng));
    return api<Paginated<Attraction>>(`/api/attractions?${q}`);
  },
  categories: () => api<{ items: Category[] }>("/api/attractions/categories"),
  get: (id: string) => api<AttractionDetail>(`/api/attractions/${id}`),
  nearby: (lat: number, lng: number, radiusMiles?: number) => {
    const q = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (radiusMiles) q.set("radiusMiles", String(radiusMiles));
    return api<{ items: Attraction[] }>(`/api/attractions/nearby/explore?${q}`);
  },
};

export const checkIns = {
  my: () => api<{ items: unknown[] }>("/api/check-ins/me"),
  create: (data: { attractionId: string; rating?: number; review?: string; visitDate: string }) =>
    api<unknown>("/api/check-ins", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { rating?: number | null; review?: string; visitDate?: string }) =>
    api<unknown>(`/api/check-ins/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  like: (checkInId: string) =>
    api<{ liked: boolean; likeCount: number }>(`/api/check-ins/${checkInId}/like`, { method: "POST", body: "{}" }),
  unlike: (checkInId: string) =>
    api<{ liked: boolean; likeCount: number }>(`/api/check-ins/${checkInId}/like`, { method: "DELETE" }),
  getComments: (checkInId: string) =>
    api<{ items: CommentItem[] }>(`/api/check-ins/${checkInId}/comments`),
  addComment: (checkInId: string, text: string) =>
    api<CommentItem>(`/api/check-ins/${checkInId}/comments`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  deleteComment: (checkInId: string, commentId: string) =>
    api<void>(`/api/check-ins/${checkInId}/comments/${commentId}`, { method: "DELETE" }),
};

export type UserSummary = {
  id: string;
  username: string;
  avatarUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  createdAt: string;
  checkInCount?: number;
  followersCount?: number;
};

export type UserProfile = {
  id: string;
  username: string;
  avatarUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  createdAt: string;
  checkInCount?: number;
  listCount?: number;
  followersCount?: number;
  recentCheckIns?: unknown[];
};

export type RecentCheckIn = {
  id: string;
  rating: number | null;
  review: string | null;
  visitDate: string;
  createdAt: string;
  user: { id: string; username: string; avatarUrl: string | null };
  attraction?: { id: string; name: string; city: string | null; state: string };
  likeCount?: number;
  likedByMe?: boolean;
};

async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method: "POST", body: formData, headers });
  const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string; avatarUrl?: string };
  if (!res.ok) {
    const msg = body.error ?? body.message ?? res.statusText;
    throw new Error(msg);
  }
  return body as T;
}

export type InboxItem = {
  id: string;
  type: "like_review" | "like_list" | "comment_review" | "comment_list" | "follow";
  actor: { id: string; username: string; avatarUrl: string | null };
  createdAt: string;
  checkInId?: string;
  listId?: string;
  attractionId?: string;
  attractionName?: string;
  listTitle?: string;
  commentSnippet?: string;
  rating?: number | null;
};

export const users = {
  uploadAvatar: (file: File) => {
    const form = new FormData();
    // Ensure a filename so the server always sees this as a file part
    form.append("avatar", file, file.name || "image.jpg");
    return apiUpload<{ avatarUrl: string }>("/api/users/me/avatar", form);
  },
  updateMe: (data: { avatarUrl?: string | null; bio?: string | null; location?: string | null }) =>
    api<{ id: string; username: string; email: string; avatarUrl?: string | null; bio?: string | null; location?: string | null; createdAt: string }>(
      "/api/users/me",
      { method: "PATCH", body: JSON.stringify(data) }
    ),
  list: (params?: { page?: number; limit?: number; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.search) q.set("search", params.search);
    return api<Paginated<UserSummary>>(`/api/users?${q}`);
  },
  get: (id: string) =>
    api<UserProfile & { checkInCount: number; listCount: number; followersCount: number; followingCount: number; recentCheckIns: unknown[] }>(`/api/users/${id}`),
  /** Public: users that this user follows */
  getFollowingList: (id: string) => api<{ items: UserSummary[] }>(`/api/users/${id}/following/list`),
  /** Public: users who follow this user */
  getFollowersList: (id: string) => api<{ items: UserSummary[] }>(`/api/users/${id}/followers/list`),
  /** Public: this user's public lists */
  getLists: (id: string) => api<{ items: ListSummary[] }>(`/api/users/${id}/lists`),
  /** Likes and comments on my reviews and lists */
  inbox: (params?: { limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", String(params.limit));
    return api<{ items: InboxItem[] }>(`/api/users/me/inbox${q.toString() ? `?${q}` : ""}`);
  },
};

export type ListSummary = {
  id: string;
  title: string;
  description: string | null;
  public: boolean;
  createdAt: string;
  itemCount: number;
};

export type ListItemWithAttraction = {
  id: string;
  attractionId: string;
  position: number;
  notes: string | null;
  attraction: Attraction;
};

export type ListDetail = {
  id: string;
  title: string;
  description: string | null;
  public: boolean;
  createdAt: string;
  items: ListItemWithAttraction[];
  likeCount: number;
  likedByMe: boolean;
};

export const lists = {
  list: () => api<{ items: ListSummary[] }>("/api/lists"),
  create: (data: { title: string; description?: string; public?: boolean }) =>
    api<ListSummary & { description: string | null; public: boolean }>("/api/lists", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  get: (id: string) => api<ListDetail>("/api/lists/" + id),
  update: (id: string, data: { title?: string; description?: string; public?: boolean }) =>
    api<ListSummary>(`/api/lists/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) =>
    api<void>(`/api/lists/${id}`, { method: "DELETE" }),
  addItem: (listId: string, data: { attractionId: string; notes?: string; position?: number }) =>
    api<unknown>(`/api/lists/${listId}/items`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  removeItem: (listId: string, attractionId: string) =>
    api<void>(`/api/lists/${listId}/items/${attractionId}`, { method: "DELETE" }),
  like: (listId: string) =>
    api<{ liked: boolean; likeCount: number }>(`/api/lists/${listId}/like`, { method: "POST", body: "{}" }),
  unlike: (listId: string) =>
    api<{ liked: boolean; likeCount: number }>(`/api/lists/${listId}/like`, { method: "DELETE" }),
  getComments: (listId: string) =>
    api<{ items: CommentItem[] }>(`/api/lists/${listId}/comments`),
  addComment: (listId: string, text: string) =>
    api<CommentItem>(`/api/lists/${listId}/comments`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  deleteComment: (listId: string, commentId: string) =>
    api<void>(`/api/lists/${listId}/comments/${commentId}`, { method: "DELETE" }),
};


/** Feed item: a check-in from someone you follow */
export type FeedCheckIn = {
  id: string;
  rating: number | null;
  review: string | null;
  visitDate: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  user: { id: string; username: string; avatarUrl: string | null };
  attraction: { id: string; name: string; city: string | null; state: string; imageUrl?: string | null };
};

/** Comment on a review (check-in) or list */
export type CommentItem = {
  id: string;
  text: string;
  createdAt: string;
  user: { id: string; username: string; avatarUrl: string | null };
};

export const friends = {
  /** Counts for profile (followers, following, friends) */
  socialCounts: () =>
    api<{ followersCount: number; followingCount: number; friendsCount: number }>("/api/users/me/social"),
  /** People who follow you */
  followers: () => api<{ items: UserSummary[] }>("/api/users/me/followers"),
  /** People you follow */
  following: () => api<{ items: UserSummary[] }>("/api/users/me/following"),
  /** Mutual follows (friends) */
  list: () => api<{ items: UserSummary[] }>("/api/users/me/friends"),
  /** Recent check-ins from people you follow (home feed) */
  feed: (params?: { limit?: number }) => {
    const q = params?.limit != null ? `?limit=${params.limit}` : "";
    return api<{ items: FeedCheckIn[] }>(`/api/users/me/feed${q}`);
  },
  /** Follow a user */
  follow: (userId: string) =>
    api<{ ok: boolean; following: boolean }>(`/api/users/${userId}/follow`, { method: "POST", body: "{}" }),
  /** Unfollow a user */
  unfollow: (userId: string) =>
    api<{ ok: boolean; following: boolean }>(`/api/users/${userId}/follow`, { method: "DELETE" }),
  /** Check if you follow a user */
  isFollowing: (userId: string) =>
    api<{ following: boolean }>(`/api/users/${userId}/following`),
};
