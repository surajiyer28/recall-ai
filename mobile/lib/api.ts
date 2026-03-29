import { Platform } from "react-native";
import { API_BASE_URL } from "./constants";
import type {
  CaptureSession,
  CaptureStatus,
  ChatResponse,
  MemoryDetail,
  MemoryStats,
  NotificationItem,
  PrivacyZone,
  QuietHoursSettings,
  RetentionPolicy,
  TimelineResponse,
  UploadResponse,
} from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function del(path: string): Promise<void> {
  return request(path, { method: "DELETE" });
}

async function toFormFile(
  uri: string,
  mimeType: string,
  fileName: string
): Promise<Blob> {
  if (Platform.OS === "web") {
    const res = await fetch(uri);
    const blob = await res.blob();
    return new File([blob], fileName, { type: mimeType });
  }
  // React Native: use the { uri, type, name } convention
  return { uri, type: mimeType, name: fileName } as unknown as Blob;
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

export const getCaptureStatus = () => request<CaptureStatus>("/capture/status");
export const pauseCapture = () => post<CaptureStatus>("/capture/pause");
export const resumeCapture = () => post<CaptureStatus>("/capture/resume");

export async function startRecording(ctx?: {
  place_name?: string;
  gps_lat?: number;
  gps_lng?: number;
}): Promise<{ session_id: string; status: string }> {
  const params = new URLSearchParams();
  if (ctx?.place_name) params.set("place_name", ctx.place_name);
  if (ctx?.gps_lat != null) params.set("gps_lat", String(ctx.gps_lat));
  if (ctx?.gps_lng != null) params.set("gps_lng", String(ctx.gps_lng));
  const qs = params.toString();
  return post(`/capture/record/start${qs ? `?${qs}` : ""}`);
}

export async function stopRecording(
  sessionId: string,
  fileUri: string
): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", await toFormFile(fileUri, "audio/wav", "recording.wav"));

  return request<UploadResponse>(`/capture/record/stop/${sessionId}`, {
    method: "POST",
    body: form,
  });
}

export async function uploadAudio(
  fileUri: string,
  ctx?: { place_name?: string; gps_lat?: number; gps_lng?: number }
): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", await toFormFile(fileUri, "audio/wav", "audio.wav"));
  if (ctx?.place_name) form.append("place_name", ctx.place_name);
  if (ctx?.gps_lat != null) form.append("gps_lat", String(ctx.gps_lat));
  if (ctx?.gps_lng != null) form.append("gps_lng", String(ctx.gps_lng));

  return request<UploadResponse>("/capture/upload/audio", {
    method: "POST",
    body: form,
  });
}

export async function uploadImage(
  fileUris: string[],
  ctx?: { place_name?: string; gps_lat?: number; gps_lng?: number }
): Promise<UploadResponse> {
  const form = new FormData();
  for (let i = 0; i < fileUris.length; i++) {
    form.append("files", await toFormFile(fileUris[i], "image/jpeg", `image_${i}.jpg`));
  }
  if (ctx?.place_name) form.append("place_name", ctx.place_name);
  if (ctx?.gps_lat != null) form.append("gps_lat", String(ctx.gps_lat));
  if (ctx?.gps_lng != null) form.append("gps_lng", String(ctx.gps_lng));

  return request<UploadResponse>("/capture/upload/image", {
    method: "POST",
    body: form,
  });
}

export async function uploadVideo(
  fileUri: string,
  ctx?: { place_name?: string; gps_lat?: number; gps_lng?: number }
): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", await toFormFile(fileUri, "video/mp4", "video.mp4"));
  if (ctx?.place_name) form.append("place_name", ctx.place_name);
  if (ctx?.gps_lat != null) form.append("gps_lat", String(ctx.gps_lat));
  if (ctx?.gps_lng != null) form.append("gps_lng", String(ctx.gps_lng));

  return request<UploadResponse>("/capture/upload/video", {
    method: "POST",
    body: form,
  });
}

export async function getSessions(
  limit = 20,
  offset = 0
): Promise<{ sessions: CaptureSession[]; total: number }> {
  return request(`/capture/sessions?limit=${limit}&offset=${offset}`);
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export function sendChat(
  message: string,
  conversationId?: string
): Promise<ChatResponse> {
  return post("/chat", { message, conversation_id: conversationId });
}

// ---------------------------------------------------------------------------
// Memories
// ---------------------------------------------------------------------------

export function getMemory(id: string): Promise<MemoryDetail> {
  return request(`/memories/${id}`);
}

export function deleteMemory(id: string): Promise<void> {
  return del(`/memories/${id}`);
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export function getTimeline(
  date?: string,
  page = 1,
  limit = 20
): Promise<TimelineResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (date) params.set("date", date);
  return request(`/timeline?${params}`);
}

export function getTimelineStats(): Promise<MemoryStats> {
  return request("/timeline/stats");
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export function getNotifications(): Promise<NotificationItem[]> {
  return request("/notifications");
}

export function dismissNotification(id: string): Promise<void> {
  return post(`/notifications/${id}/dismiss`);
}

// ---------------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------------

export const getPrivacyZones = () => request<PrivacyZone[]>("/privacy/zones");
export const createPrivacyZone = (zone: {
  name: string;
  gps_lat: number;
  gps_lng: number;
  radius_metres?: number;
}) => post<PrivacyZone>("/privacy/zones", zone);
export const deletePrivacyZone = (id: string) => del(`/privacy/zones/${id}`);

export const getQuietHours = () => request<QuietHoursSettings>("/privacy/quiet-hours");
export const setQuietHours = (s: QuietHoursSettings) =>
  post<QuietHoursSettings>("/privacy/quiet-hours", s);

export const getRetention = () => request<RetentionPolicy>("/privacy/retention");
export const setRetention = (p: RetentionPolicy) =>
  post<RetentionPolicy>("/privacy/retention", p);

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

export const seedDemo = () => post<{ status: string }>("/demo/seed");
