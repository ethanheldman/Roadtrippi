export type SortField = "name" | "state" | "city" | "createdAt" | "visitCount" | "rating" | "distance";

export const SORT_OPTIONS: { value: SortField; label: string; order: "asc" | "desc" }[] = [
  { value: "distance", label: "Closest to me", order: "asc" },
  { value: "rating", label: "Highest rated", order: "desc" },
  { value: "rating", label: "Lowest rated", order: "asc" },
  { value: "visitCount", label: "Most popular", order: "desc" },
  { value: "visitCount", label: "Least popular", order: "asc" },
  { value: "name", label: "Name A–Z", order: "asc" },
  { value: "name", label: "Name Z–A", order: "desc" },
  { value: "state", label: "State A–Z", order: "asc" },
  { value: "state", label: "State Z–A", order: "desc" },
  { value: "city", label: "City A–Z", order: "asc" },
  { value: "city", label: "City Z–A", order: "desc" },
  { value: "createdAt", label: "Newest first", order: "desc" },
  { value: "createdAt", label: "Oldest first", order: "asc" },
];
