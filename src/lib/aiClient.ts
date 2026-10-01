export interface AICompletionOptions {
  prompt: string;
  systemInstruction?: string;
  jsonSchema?: boolean;
  preferredTier?: 'standard' | 'heavy';
}

export interface AIResponsePayload {
  text: string;
  provider: string;
  model: string;
  trace: Array<{
    provider: string;
    model: string;
    latencyMs: number;
    status: 'SUCCESS' | 'FAILED';
    error?: string;
  }>;
}

export async function askAI(options: AICompletionOptions): Promise<AIResponsePayload> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      text: `[Offline Mode]\nYou are currently studying offline. AI generation requires connectivity. Please refer to your saved textbooks, past questions, and mistakes bank.`,
      provider: 'Local Offline Engine',
      model: 'offline-cache',
      trace: [
        {
          provider: 'Offline Engine',
          model: 'offline-cache',
          latencyMs: 0,
          status: 'SUCCESS',
        },
      ],
    };
  }

  try {
    const res = await fetch('/api/ai/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    console.warn('AI request failed, using client fallback:', err);
    return {
      text: `Error connecting to AI service: ${err.message}. Please check your internet or retry shortly.`,
      provider: 'Client Fallback',
      model: 'error-handler',
      trace: [
        {
          provider: 'Server Proxy',
          model: 'unknown',
          latencyMs: 0,
          status: 'FAILED',
          error: err.message,
        },
      ],
    };
  }
}
