import { sql } from '@vercel/postgres';

export interface User {
  id: string;
  email: string;
  password: string;
  name?: string | null;
  role: 'user' | 'admin';
  client_id?: number; // ID corto de 4 cifras
  created_at: Date;
  updated_at: Date;
}

export interface Transcription {
  id: string;
  user_id: string;
  filename: string;
  audio_url: string | null;
  txt_url: string | null;
  srt_url: string | null;
  summary_url: string | null;
  status: string;
  created_at: Date;
}

export interface TranscriptionJob {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'transcribed' | 'summarized' | 'completed' | 'failed';
  filename: string;
  language: string; // Add language field
  audio_url: string;
  audio_size_bytes: number | null;
  audio_duration_seconds: number | null;
  processing_progress: number | null; // Progress percentage (0-100)
  assemblyai_id: string | null;
  txt_url: string | null;
  srt_url: string | null;
  vtt_url: string | null;
  speakers_url: string | null;
  summary_url: string | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  updated_at: Date;
  metadata: any;
}

export const UserDB = {
  // Create new user
  create: async (email: string, hashedPassword: string, name?: string, role: 'user' | 'admin' = 'user'): Promise<User> => {
    const result = await sql<User>`
      INSERT INTO users (email, password, name, role)
      VALUES (${email.toLowerCase()}, ${hashedPassword}, ${name || null}, ${role})
      RETURNING id, email, password, name, role, client_id, created_at, updated_at
    `;
    return result.rows[0];
  },

  // Find user by email
  findByEmail: async (email: string): Promise<User | null> => {
    const result = await sql<User>`
      SELECT id, email, password, name, role, client_id, created_at, updated_at
      FROM users
      WHERE email = ${email.toLowerCase()}
      LIMIT 1
    `;
    return result.rows[0] || null;
  },

  // Find user by ID
  findById: async (id: string): Promise<User | null> => {
    const result = await sql<User>`
      SELECT id, email, password, name, role, client_id, created_at, updated_at
      FROM users
      WHERE id = ${id}
      LIMIT 1
    `;
    return result.rows[0] || null;
  },

  // Update user
  update: async (id: string, updates: Partial<Pick<User, 'email' | 'password' | 'name'>>): Promise<User | null> => {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.email !== undefined) {
      setClauses.push('email = $' + (values.length + 1));
      values.push(updates.email.toLowerCase());
    }
    if (updates.password !== undefined) {
      setClauses.push('password = $' + (values.length + 1));
      values.push(updates.password);
    }
    if (updates.name !== undefined) {
      setClauses.push('name = $' + (values.length + 1));
      values.push(updates.name);
    }

    if (setClauses.length === 0) return null;

    setClauses.push('updated_at = CURRENT_TIMESTAMP');

    const result = await sql<User>`
      UPDATE users
      SET email = COALESCE(${updates.email?.toLowerCase() || null}, email),
          password = COALESCE(${updates.password || null}, password),
          name = COALESCE(${updates.name !== undefined ? updates.name : null}, name),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING id, email, password, name, role, client_id, created_at, updated_at
    `;
    return result.rows[0] || null;
  },

  // Delete user
  delete: async (id: string): Promise<boolean> => {
    const result = await sql`
      DELETE FROM users
      WHERE id = ${id}
    `;
    return (result.rowCount ?? 0) > 0;
  },

  // Get all users (admin only - for debugging)
  getAll: async (): Promise<User[]> => {
    const result = await sql<User>`
      SELECT id, email, name, role, client_id, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `;
    return result.rows;
  },

  // Update user role
  updateRole: async (id: string, role: 'user' | 'admin'): Promise<User | null> => {
    const result = await sql<User>`
      UPDATE users
      SET role = ${role}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING id, email, password, name, role, client_id, created_at, updated_at
    `;
    return result.rows[0] || null;
  }
};

export const TranscriptionDB = {
  // Create new transcription record
  create: async (
    userId: string,
    filename: string,
    audioUrl: string | null = null,
    txtUrl: string | null = null,
    srtUrl: string | null = null,
    summaryUrl: string | null = null
  ): Promise<Transcription> => {
    const result = await sql<Transcription>`
      INSERT INTO transcriptions (user_id, filename, audio_url, txt_url, srt_url, summary_url)
      VALUES (${userId}, ${filename}, ${audioUrl}, ${txtUrl}, ${srtUrl}, ${summaryUrl})
      RETURNING *
    `;
    return result.rows[0];
  },

  // Get user's transcriptions
  findByUserId: async (userId: string): Promise<Transcription[]> => {
    const result = await sql<Transcription>`
      SELECT *
      FROM transcriptions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
    return result.rows;
  },

  // Get single transcription
  findById: async (id: string): Promise<Transcription | null> => {
    const result = await sql<Transcription>`
      SELECT *
      FROM transcriptions
      WHERE id = ${id}
      LIMIT 1
    `;
    return result.rows[0] || null;
  },

  // Delete transcription
  delete: async (id: string, userId: string): Promise<boolean> => {
    const result = await sql`
      DELETE FROM transcriptions
      WHERE id = ${id} AND user_id = ${userId}
    `;
    return (result.rowCount ?? 0) > 0;
  },

  // Update transcription status
  updateStatus: async (id: string, status: string): Promise<boolean> => {
    const result = await sql`
      UPDATE transcriptions
      SET status = ${status}
      WHERE id = ${id}
    `;
    return (result.rowCount ?? 0) > 0;
  }
};

export const TranscriptionJobDB = {
  // Create new job
  create: async (
    userId: string,
    filename: string,
    audioUrl: string,
    language: string = 'auto', // Default to auto-detection
    audioSizeBytes?: number,
    fileType: 'audio' | 'document' = 'audio' // Default to audio
  ): Promise<TranscriptionJob> => {
    const result = await sql<TranscriptionJob>`
      INSERT INTO transcription_jobs (user_id, filename, audio_url, language, audio_size_bytes, file_type, status)
      VALUES (${userId}, ${filename}, ${audioUrl}, ${language}, ${audioSizeBytes || null}, ${fileType}, 'pending')
      RETURNING *
    `;
    return result.rows[0];
  },

  // Find job by ID
  findById: async (id: string): Promise<TranscriptionJob | null> => {
    const result = await sql<TranscriptionJob>`
      SELECT *
      FROM transcription_jobs
      WHERE id = ${id}
      LIMIT 1
    `;
    return result.rows[0] || null;
  },

  // Find jobs by user ID
  findByUserId: async (userId: string, limit = 50): Promise<TranscriptionJob[]> => {
    const result = await sql<TranscriptionJob>`
      SELECT *
      FROM transcription_jobs
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return result.rows;
  },

  // Find pending jobs (for processing queue)
  findPending: async (limit = 10): Promise<TranscriptionJob[]> => {
    const result = await sql<TranscriptionJob>`
      SELECT *
      FROM transcription_jobs
      WHERE status = 'pending'
      AND retry_count < max_retries
      ORDER BY created_at ASC
      LIMIT ${limit}
    `;
    return result.rows;
  },

  // Update job status
  updateStatus: async (
    id: string,
    status: 'pending' | 'processing' | 'transcribed' | 'summarized' | 'completed' | 'failed',
    errorMessage?: string
  ): Promise<boolean> => {
    let result;

    if (status === 'processing') {
      result = await sql`
        UPDATE transcription_jobs
        SET status = ${status}, started_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
      `;
    } else if ((status === 'completed' || status === 'failed') && errorMessage) {
      result = await sql`
        UPDATE transcription_jobs
        SET status = ${status}, completed_at = CURRENT_TIMESTAMP, error_message = ${errorMessage}
        WHERE id = ${id}
      `;
    } else if (status === 'completed' || status === 'failed') {
      result = await sql`
        UPDATE transcription_jobs
        SET status = ${status}, completed_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
      `;
    } else {
      result = await sql`
        UPDATE transcription_jobs
        SET status = ${status}
        WHERE id = ${id}
      `;
    }

    return (result.rowCount ?? 0) > 0;
  },

  // Update job with results
  updateResults: async (
    id: string,
    results: {
      assemblyaiId?: string;
      txtUrl?: string;
      srtUrl?: string;
      vttUrl?: string;
      speakersUrl?: string;
      summaryUrl?: string;
      audioDuration?: number;
      metadata?: any;
    }
  ): Promise<boolean> => {
    // 🔥 FIX: Convertir audioDuration a integer (columna es INTEGER en BD)
    const durationInteger = results.audioDuration ? Math.floor(results.audioDuration) : null;

    // 🔥 FIX: Si se proporciona metadata, hacer merge con el metadata existente
    // en lugar de reemplazarlo completamente para preservar actions, summaryType, etc.
    let metadataUpdate = null;
    if (results.metadata) {
      // Obtener job actual para hacer merge de metadata
      const currentJob = await TranscriptionJobDB.findById(id);
      const currentMetadata = currentJob?.metadata || {};
      // Merge: las nuevas propiedades sobrescriben, pero se preservan las existentes
      metadataUpdate = JSON.stringify({ ...currentMetadata, ...results.metadata });
    }

    const result = await sql`
      UPDATE transcription_jobs
      SET
        assemblyai_id = COALESCE(${results.assemblyaiId || null}, assemblyai_id),
        txt_url = COALESCE(${results.txtUrl || null}, txt_url),
        srt_url = COALESCE(${results.srtUrl || null}, srt_url),
        vtt_url = COALESCE(${results.vttUrl || null}, vtt_url),
        speakers_url = COALESCE(${results.speakersUrl || null}, speakers_url),
        summary_url = COALESCE(${results.summaryUrl || null}, summary_url),
        audio_duration_seconds = COALESCE(${durationInteger}, audio_duration_seconds),
        metadata = COALESCE(${metadataUpdate}, metadata)
      WHERE id = ${id}
    `;
    return (result.rowCount ?? 0) > 0;
  },

  // Increment retry count
  incrementRetry: async (id: string): Promise<boolean> => {
    const result = await sql`
      UPDATE transcription_jobs
      SET retry_count = retry_count + 1
      WHERE id = ${id}
    `;
    return (result.rowCount ?? 0) > 0;
  },

  // Delete a specific transcription job by ID and userId
  delete: async (id: string, userId: string): Promise<boolean> => {
    const result = await sql`
      DELETE FROM transcription_jobs
      WHERE id = ${id} AND user_id = ${userId}
    `;
    return (result.rowCount ?? 0) > 0;
  },

  // Delete old completed jobs (cleanup)
  deleteOld: async (daysOld = 30): Promise<number> => {
    const result = await sql`
      DELETE FROM transcription_jobs
      WHERE status IN ('completed', 'failed')
      AND completed_at < NOW() - INTERVAL '${daysOld} days'
    `;
    return result.rowCount ?? 0;
  }
};
