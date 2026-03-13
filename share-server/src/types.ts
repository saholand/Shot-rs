export interface UploadRecord {
  id: string
  storage_key: string
  file_name: string
  file_type: 'screenshot' | 'recording'
  mime_type: string
  size_bytes: number
  delete_token: string
  created_at: number
  expires_at: number
}

export interface UploadResponse {
  success: boolean
  id?: string
  url?: string
  deleteToken?: string
  expiresAt?: number
  error?: string
}
