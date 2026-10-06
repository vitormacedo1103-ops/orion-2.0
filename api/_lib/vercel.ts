// Tipos mínimos estilo Vercel (sem dependência @vercel/node).
export interface VercelQuery { [key: string]: string | string[] | undefined }
export interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query: VercelQuery;
  body?: unknown;
}
export interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
}
export type Handler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>;
