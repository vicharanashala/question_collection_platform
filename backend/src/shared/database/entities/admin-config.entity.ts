
export interface AdminConfig {
  id: string;

  key: string;

  value: unknown;

  description: string | null;

  updatedBy: string | null;

  updatedAt: Date;
}