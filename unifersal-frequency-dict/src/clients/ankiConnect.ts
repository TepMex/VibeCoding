const ANKICONNECT_URL = 'http://localhost:8765';

interface AnkiConnectRequest {
  action: string;
  version: number;
  params?: Record<string, unknown>;
}

interface AnkiConnectResponse<T = unknown> {
  result: T | null;
  error: string | null;
}

async function request<T = unknown>(
  action: string,
  params?: Record<string, unknown>
): Promise<T> {
  const requestBody: AnkiConnectRequest = {
    action,
    version: 6,
    params: params || {},
  };

  try {
    const response = await fetch(ANKICONNECT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`AnkiConnect request failed: ${response.statusText}`);
    }

    const data: AnkiConnectResponse<T> = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    if (data.result === null) {
      throw new Error('AnkiConnect returned null result');
    }

    return data.result;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to connect to AnkiConnect. Make sure Anki is running and AnkiConnect addon is installed.');
  }
}

export async function checkConnection(): Promise<boolean> {
  try {
    await request('version');
    return true;
  } catch {
    return false;
  }
}

export async function getDeckNames(): Promise<string[]> {
  const result = await request<string[]>('deckNames');
  return result || [];
}

export async function getModelNames(): Promise<string[]> {
  const result = await request<string[]>('modelNames');
  return result || [];
}

interface CreateCardParams {
  Key: string;
  Simplified: string;
  Pinyin: string;
  Meaning: string;
  SentenceSimplified: string;
  SentencePinyin: string;
  SentenceMeaning: string;
  deckName: string;
  modelName: string;
}

export async function createCard(params: CreateCardParams): Promise<number> {
  try {
    const response = await fetch('http://localhost:3000/createCard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Failed to create card: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to create card');
  }
}



