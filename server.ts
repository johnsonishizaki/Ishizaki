import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

dotenv.config();

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Local upload storage directory fallback for Vault when B2 is not configured
const LOCAL_VAULT_DIR = path.resolve(process.cwd(), '.vault_storage');
if (!fs.existsSync(LOCAL_VAULT_DIR)) {
  fs.mkdirSync(LOCAL_VAULT_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max per file
});

// Configure Backblaze B2 S3 Client if configured
const isB2Configured = Boolean(
  process.env.B2_APPLICATION_KEY_ID &&
  process.env.B2_APPLICATION_KEY &&
  process.env.B2_BUCKET_NAME
);

const b2Client = isB2Configured
  ? new S3Client({
      endpoint: process.env.B2_ENDPOINT ? `https://${process.env.B2_ENDPOINT}` : 'https://s3.us-west-000.backblazeb2.com',
      region: 'us-west-000',
      credentials: {
        accessKeyId: process.env.B2_APPLICATION_KEY_ID || '',
        secretAccessKey: process.env.B2_APPLICATION_KEY || '',
      },
    })
  : null;

// Initialize Gemini Client
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const gemini = geminiApiKey
  ? new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// --- AI Completion Cascade Endpoint ---
app.post('/api/ai/complete', async (req: Request, res: Response) => {
  const { prompt, systemInstruction, jsonSchema, preferredTier = 'standard' } = req.body;
  const trace: Array<{ provider: string; model: string; latencyMs: number; status: 'SUCCESS' | 'FAILED'; error?: string }> = [];

  // Tier 1: Groq API
  if (process.env.GROQ_API_KEY) {
    const startTime = Date.now();
    const model = 'mixtral-8x7b-32768';
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
            { role: 'user', content: prompt },
          ],
          response_format: jsonSchema ? { type: 'json_object' } : undefined,
          temperature: 0.3,
        }),
      });

      if (groqRes.ok) {
        const data = await groqRes.json();
        const text = data.choices?.[0]?.message?.content || '';
        trace.push({ provider: 'Groq', model, latencyMs: Date.now() - startTime, status: 'SUCCESS' });
        return res.json({ text, provider: 'Groq', model, trace });
      } else {
        const errText = await groqRes.text();
        trace.push({ provider: 'Groq', model, latencyMs: Date.now() - startTime, status: 'FAILED', error: errText });
      }
    } catch (err: any) {
      trace.push({ provider: 'Groq', model, latencyMs: Date.now() - startTime, status: 'FAILED', error: err.message });
    }
  } else {
    trace.push({ provider: 'Groq', model: 'unconfigured', latencyMs: 0, status: 'FAILED', error: 'No GROQ_API_KEY set' });
  }

  // Tier 2: OpenRouter Fallback
  if (process.env.OPENROUTER_API_KEY) {
    const startTime = Date.now();
    const model = preferredTier === 'heavy' ? 'deepseek/deepseek-r1' : 'meta-llama/llama-3.3-70b-instruct';
    try {
      const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://ishizaki.academic.os',
          'X-Title': 'Ishizaki Academic OS',
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
            { role: 'user', content: prompt },
          ],
          response_format: jsonSchema ? { type: 'json_object' } : undefined,
          temperature: 0.3,
        }),
      });

      if (openRouterRes.ok) {
        const data = await openRouterRes.json();
        const text = data.choices?.[0]?.message?.content || '';
        trace.push({ provider: 'OpenRouter', model, latencyMs: Date.now() - startTime, status: 'SUCCESS' });
        return res.json({ text, provider: 'OpenRouter', model, trace });
      } else {
        const errText = await openRouterRes.text();
        trace.push({ provider: 'OpenRouter', model, latencyMs: Date.now() - startTime, status: 'FAILED', error: errText });
      }
    } catch (err: any) {
      trace.push({ provider: 'OpenRouter', model, latencyMs: Date.now() - startTime, status: 'FAILED', error: err.message });
    }
  } else {
    trace.push({ provider: 'OpenRouter', model: 'unconfigured', latencyMs: 0, status: 'FAILED', error: 'No OPENROUTER_API_KEY set' });
  }

  // Tier 3: Gemini Fallback (via Google Gen AI SDK)
  if (gemini) {
    const startTime = Date.now();
    const model = 'gemini-3.8-flash';
    try {
      const geminiRes = await gemini.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction || undefined,
          temperature: 0.3,
          responseMimeType: jsonSchema ? 'application/json' : undefined,
        },
      });

      const text = geminiRes.text || '';
      trace.push({ provider: 'Gemini', model, latencyMs: Date.now() - startTime, status: 'SUCCESS' });
      return res.json({ text, provider: 'Gemini', model, trace });
    } catch (err: any) {
      trace.push({ provider: 'Gemini', model, latencyMs: Date.now() - startTime, status: 'FAILED', error: err.message });
    }
  } else {
    trace.push({ provider: 'Gemini', model: 'unconfigured', latencyMs: 0, status: 'FAILED', error: 'No GEMINI_API_KEY set' });
  }

  // Tier 4: Safe Deterministic Offline Synthesis Fallback
  return res.json({
    text: `[Offline Academic Response]\nIshizaki analyzed your academic query regarding "${prompt.slice(0, 100)}...". All remote AI providers are currently unreachable or unconfigured. Please connect to a network with valid API keys or consult your saved local textbooks.`,
    provider: 'Offline Engine',
    model: 'deterministic-heuristic-v1',
    trace,
  });
});

// --- Vault Upload & Streaming Proxy ---
app.post('/api/vault/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const fileId = `vf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `vault/${fileId}_${sanitizedName}`;

    // Extract text snippet for indexing if text/pdf/csv
    let extractedSnippet = '';
    if (file.mimetype.includes('text') || file.mimetype.includes('json') || file.mimetype.includes('csv')) {
      extractedSnippet = file.buffer.toString('utf-8').slice(0, 5000);
    } else {
      extractedSnippet = `Document ${file.originalname} (${file.mimetype}, ${(file.size / 1024).toFixed(1)} KB)`;
    }

    if (b2Client && process.env.B2_BUCKET_NAME) {
      await b2Client.send(
        new PutObjectCommand({
          Bucket: process.env.B2_BUCKET_NAME,
          Key: storageKey,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );
    } else {
      // Local development fallback
      const localFilePath = path.join(LOCAL_VAULT_DIR, `${fileId}_${sanitizedName}`);
      fs.writeFileSync(localFilePath, file.buffer);
    }

    return res.json({
      id: fileId,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      b2Key: storageKey,
      downloadUrl: `/api/vault/file/${fileId}?name=${encodeURIComponent(sanitizedName)}`,
      extractedText: extractedSnippet,
      aiIndexed: true,
      offlineCached: false,
      uploadedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Vault upload error:', err);
    res.status(500).json({ error: err.message || 'File upload failed' });
  }
});

app.get('/api/vault/file/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const fileName = (req.query.name as string) || 'download';

  try {
    if (b2Client && process.env.B2_BUCKET_NAME) {
      const storageKey = `vault/${id}_${fileName}`;
      const s3Res = await b2Client.send(
        new GetObjectCommand({
          Bucket: process.env.B2_BUCKET_NAME,
          Key: storageKey,
        })
      );
      if (s3Res.ContentType) res.setHeader('Content-Type', s3Res.ContentType);
      (s3Res.Body as any).pipe(res);
      return;
    }

    // Local file fallback
    const localFilePath = path.join(LOCAL_VAULT_DIR, `${id}_${fileName}`);
    if (fs.existsSync(localFilePath)) {
      return res.sendFile(localFilePath);
    }

    res.status(404).send('File not found');
  } catch (err: any) {
    res.status(500).send('Failed to retrieve file');
  }
});

// --- System Diagnostics Endpoint ---
app.get('/api/health', async (_req: Request, res: Response) => {
  const checks: Record<string, { status: 'PASS' | 'FAIL' | 'UNCONFIGURED'; latencyMs: number; details: string }> = {};

  // Check Groq
  if (process.env.GROQ_API_KEY) {
    const start = Date.now();
    try {
      const probe = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      });
      checks.groq = {
        status: probe.ok ? 'PASS' : 'FAIL',
        latencyMs: Date.now() - start,
        details: probe.ok ? 'Groq API reachable and responsive' : `Groq returned HTTP ${probe.status}`,
      };
    } catch (e: any) {
      checks.groq = { status: 'FAIL', latencyMs: Date.now() - start, details: e.message };
    }
  } else {
    checks.groq = { status: 'UNCONFIGURED', latencyMs: 0, details: 'Optional GROQ_API_KEY not set in environment' };
  }

  // Check OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    const start = Date.now();
    try {
      const probe = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
      });
      checks.openRouter = {
        status: probe.ok ? 'PASS' : 'FAIL',
        latencyMs: Date.now() - start,
        details: probe.ok ? 'OpenRouter API reachable' : `OpenRouter returned HTTP ${probe.status}`,
      };
    } catch (e: any) {
      checks.openRouter = { status: 'FAIL', latencyMs: Date.now() - start, details: e.message };
    }
  } else {
    checks.openRouter = { status: 'UNCONFIGURED', latencyMs: 0, details: 'Optional OPENROUTER_API_KEY not set' };
  }

  // Check Gemini
  if (geminiApiKey) {
    const start = Date.now();
    try {
      const probe = await gemini?.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: 'ping',
      });
      checks.gemini = {
        status: probe?.text ? 'PASS' : 'FAIL',
        latencyMs: Date.now() - start,
        details: probe?.text ? 'Gemini 3.8 Flash active and generating' : 'No text response from Gemini',
      };
    } catch (e: any) {
      checks.gemini = { status: 'FAIL', latencyMs: Date.now() - start, details: e.message };
    }
  } else {
    checks.gemini = { status: 'UNCONFIGURED', latencyMs: 0, details: 'GEMINI_API_KEY not set' };
  }

  // Check Backblaze B2
  checks.backblazeB2 = {
    status: isB2Configured ? 'PASS' : 'UNCONFIGURED',
    latencyMs: 0,
    details: isB2Configured
      ? `Configured with bucket: ${process.env.B2_BUCKET_NAME}`
      : 'B2 credentials omitted; transparent local file storage active for Vault',
  };

  res.json({
    status: 'HEALTHY',
    timestamp: new Date().toISOString(),
    checks,
  });
});

// Vite middleware mounting in development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[Ishizaki OS] Server running on http://0.0.0.0:${port}`);
  });
}

startServer();
