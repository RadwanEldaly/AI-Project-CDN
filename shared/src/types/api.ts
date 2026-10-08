export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    cursor?: string | null;
    hasMore?: boolean;
    total?: number;
  };
}

export interface ApiErrorDetail {
  field?: string;
  issue: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}
