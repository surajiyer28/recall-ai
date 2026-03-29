// -- Capture --
export interface CaptureStatus {
  capture_status: "active" | "paused" | "privacy_zone" | "quiet_hours" | "offline";
  active_session_id: string | null;
}

export interface CaptureSession {
  id: string;
  started_at: string;
  ended_at: string | null;
  trigger: string;
  status: string;
  place_name: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  speaker_count: number;
}

export interface UploadResponse {
  session_id: string;
  status: string;
  message: string;
  jobs_queued: string[];
}

// -- Chat --
export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface SourceMemory {
  id: string;
  created_at?: string;
  place_name?: string;
  summary?: string;
  confidence?: string;
}

export interface ChatResponse {
  answer: string;
  confidence: string;
  sources: SourceMemory[];
  follow_ups: string[];
  conversation_id: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: SourceMemory[];
  follow_ups?: string[];
  confidence?: string;
}

// -- Memories --
export interface EntityBrief {
  id: string;
  type: string;
  value: string;
}

export interface MemoryDetail {
  id: string;
  session_id: string;
  created_at: string;
  summary?: string;
  transcript?: string;
  image_refs?: Record<string, unknown>;
  confidence?: number;
  duration_sec?: number;
  noise_level?: string;
  source_device?: string;
  capture_trigger?: string;
  entities: EntityBrief[];
}

// -- Timeline --
export interface TimelineEntry {
  id: string;
  created_at: string;
  summary?: string;
  place_name?: string;
  duration_sec?: number;
  capture_trigger?: string;
  entity_tags: string[];
  memory_type: string;
  action_item_count: number;
  has_images: boolean;
}

export interface TimelineResponse {
  date: string;
  entries: TimelineEntry[];
  total: number;
}

export interface MemoryStats {
  today_count: number;
  total_count: number;
  by_type: Record<string, number>;
  by_entity_type: Record<string, number>;
}

// -- Notifications --
export interface NotificationItem {
  id: string;
  memory_id?: string;
  trigger_type: string;
  message: string;
  delivered: boolean;
  created_at: string;
}

// -- Privacy --
export interface PrivacyZone {
  id: string;
  name: string;
  gps_lat: number;
  gps_lng: number;
  radius_metres: number;
}

export interface QuietHoursSettings {
  start_hour: number;
  start_minute: number;
  end_hour: number;
  end_minute: number;
  enabled: boolean;
}

export interface RetentionPolicy {
  casual_days: number;
  important_indefinite: boolean;
}
