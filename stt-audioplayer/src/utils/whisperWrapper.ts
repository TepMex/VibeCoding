import { pipeline, env } from '@xenova/transformers';

// Configure @xenova/transformers for browser usage
// Models are stored locally in /public/models/ directory
if (typeof window !== 'undefined') {
  // Browser environment
  // Configure to use local files from public directory (relative path)
  env.localModelPath = './models/';
  // Disable remote to force local loading only
  env.allowRemoteModels = false;
  // Use local files only
  env.useBrowserCache = true;
  
  console.log('[Whisper] Environment configured:', {
    localModelPath: env.localModelPath,
    allowRemoteModels: env.allowRemoteModels,
    origin: window.location.origin
  });
  
  // Test if local model files are accessible
  const testFiles = [
    './models/whisper-tiny/config.json',
    './models/whisper-tiny/tokenizer.json',
    './models/whisper-tiny/vocab.json'
  ];
  
  Promise.all(testFiles.map(file => 
    fetch(file)
      .then(async response => {
        const contentType = response.headers.get('content-type');
        const text = await response.text();
        return { 
          file, 
          ok: response.ok, 
          status: response.status, 
          contentType,
          isHTML: text.trim().startsWith('<!')
        };
      })
      .catch(error => ({ file, ok: false, error: error.message }))
  )).then(results => {
    const accessible = results.filter(r => r.ok && !('isHTML' in r && r.isHTML));
    const missing = results.filter(r => !r.ok || ('isHTML' in r && r.isHTML));
    if (accessible.length > 0) {
      console.log('[Whisper] Local model files accessible:', accessible.map(r => r.file));
    }
    if (missing.length > 0) {
      console.error('[Whisper] Missing or invalid local model files:', missing.map(r => ({
        file: r.file,
        status: 'status' in r ? r.status : 'error',
        isHTML: 'isHTML' in r ? r.isHTML : false,
        error: 'error' in r ? r.error : undefined
      })));
    }
  });
}

// Model identifier - use just the model name, library will prepend localModelPath
const MODEL_ID = 'whisper-tiny';

let transcriber: any = null;
let isLoading = false;
let loadPromise: Promise<any> | null = null;

/**
 * Initialize the Whisper model pipeline (singleton pattern)
 */
async function initializeModel(): Promise<any> {
  if (transcriber) {
    console.log('[Whisper] Model already loaded, reusing');
    return transcriber;
  }

  if (isLoading && loadPromise) {
    console.log('[Whisper] Model is already loading, waiting...');
    return loadPromise;
  }

  console.log('[Whisper] Initializing model:', {
    modelId: MODEL_ID,
    localModelPath: env.localModelPath,
    allowRemoteModels: env.allowRemoteModels
  });

  isLoading = true;
  const startTime = performance.now();
  
  try {
    // The library will construct paths as: localModelPath + modelId + '/filename'
    // e.g., ./models/ + whisper-tiny + /config.json = ./models/whisper-tiny/config.json
    console.log('[Whisper] Attempting to load model from local files:', {
      modelId: MODEL_ID,
      localModelPath: env.localModelPath,
      expectedPath: `${env.localModelPath}${MODEL_ID}/`,
      allowRemote: env.allowRemoteModels
    });
    
    // Intercept fetch to rewrite model file URLs to local paths
    const originalFetch = window.fetch;
    const requestedUrls: string[] = [];
    window.fetch = function(...args: Parameters<typeof fetch>) {
      let url: string;
      let requestInit: RequestInit | undefined;
      
      if (typeof args[0] === 'string') {
        url = args[0];
        requestInit = args[1];
      } else if (args[0] instanceof Request) {
        url = args[0].url;
        requestInit = args[1];
      } else if (args[0] instanceof URL) {
        url = args[0].href;
        requestInit = args[1];
      } else {
        url = String(args[0]);
        requestInit = args[1];
      }
      
      // Rewrite URLs that are trying to load model files to use local paths
      let rewrittenUrl = url;
      if (typeof url === 'string') {
        // Check if this is a model file request (whisper-tiny or transformers model files)
        const isModelFile = url.includes('whisper-tiny') || 
                          url.includes('transformers') ||
                          url.includes('huggingface') ||
                          (url.includes('config.json') && !url.includes('./models/') && !url.startsWith('./models/')) ||
                          (url.includes('tokenizer.json') && !url.includes('./models/') && !url.startsWith('./models/')) ||
                          (url.includes('vocab.json') && !url.includes('./models/') && !url.startsWith('./models/')) ||
                          (url.includes('merges.txt') && !url.includes('./models/') && !url.startsWith('./models/')) ||
                          (url.includes('preprocessor_config.json') && !url.includes('./models/') && !url.startsWith('./models/')) ||
                          (url.includes('.onnx') && !url.includes('./models/') && !url.startsWith('./models/'));
        
        if (isModelFile && !url.includes('./models/') && !url.startsWith('./models/')) {
          // Extract filename from URL
          const filename = url.split('/').pop() || url.split('\\').pop() || '';
          const pathParts = url.split('/');
          
          // Try to determine the correct local path
          if (filename && (filename.endsWith('.json') || filename.endsWith('.txt') || filename.endsWith('.onnx'))) {
            // Check if it's in a subdirectory (like onnx/)
            let localPath = `./models/whisper-tiny/${filename}`;
            
            // Handle onnx files in subdirectory
            if (url.includes('/onnx/') || url.includes('onnx/')) {
              localPath = `./models/whisper-tiny/onnx/${filename}`;
            }
            // Handle other potential subdirectories
            else if (pathParts.length > 1) {
              const subdirIndex = pathParts.findIndex(p => p === 'whisper-tiny' || p === 'onnx');
              if (subdirIndex >= 0 && subdirIndex < pathParts.length - 1) {
                const subdir = pathParts[subdirIndex + 1];
                if (subdir && subdir !== filename) {
                  localPath = `./models/whisper-tiny/${subdir}/${filename}`;
                }
              }
            }
            
            rewrittenUrl = localPath;
            console.log(`[Whisper] Rewriting URL: ${url} -> ${rewrittenUrl}`);
            requestedUrls.push(`${url} -> ${rewrittenUrl}`);
          } else {
            // For paths that include whisper-tiny, try to extract and rewrite
            const whisperIndex = url.indexOf('whisper-tiny');
            if (whisperIndex >= 0) {
              const afterWhisper = url.substring(whisperIndex + 'whisper-tiny'.length);
              rewrittenUrl = `./models/whisper-tiny${afterWhisper}`;
              console.log(`[Whisper] Rewriting URL: ${url} -> ${rewrittenUrl}`);
              requestedUrls.push(`${url} -> ${rewrittenUrl}`);
            }
          }
        } else if (isModelFile) {
          requestedUrls.push(url);
          console.log('[Whisper] Fetch request (already local):', url);
        }
      }
      
      // Create new request with rewritten URL if needed
      let finalRequest: RequestInfo;
      if (rewrittenUrl !== url) {
        if (args[0] instanceof Request) {
          finalRequest = new Request(rewrittenUrl, {
            method: args[0].method,
            headers: args[0].headers,
            body: args[0].body,
            mode: args[0].mode,
            credentials: args[0].credentials,
            cache: args[0].cache,
            redirect: args[0].redirect,
            referrer: args[0].referrer,
            integrity: args[0].integrity
          });
        } else {
          // Convert to string for RequestInfo (URL or string both work)
          finalRequest = rewrittenUrl;
        }
      } else {
        // Keep original, but ensure it's RequestInfo compatible
        if (args[0] instanceof URL) {
          finalRequest = args[0].href;
        } else {
          finalRequest = args[0] as RequestInfo;
        }
      }
      
      const fetchPromise = originalFetch.call(this, finalRequest, requestInit);
      
      // Log response status for model files
      fetchPromise.then(response => {
        if (typeof rewrittenUrl === 'string' && (rewrittenUrl.includes('whisper-tiny') || rewrittenUrl.includes('models'))) {
          if (!response.ok) {
            console.error(`[Whisper] ✗ Fetch failed for ${rewrittenUrl}:`, response.status, response.statusText);
          } else {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              console.log(`[Whisper] ✓ Successfully fetched JSON: ${rewrittenUrl}`);
            } else if (contentType && contentType.includes('text/html')) {
              console.error(`[Whisper] ✗ Got HTML instead of expected file for ${rewrittenUrl}`);
            } else {
              console.log(`[Whisper] ✓ Successfully fetched: ${rewrittenUrl} (${contentType || 'unknown type'})`);
            }
          }
        }
      }).catch(error => {
        if (typeof rewrittenUrl === 'string' && (rewrittenUrl.includes('whisper-tiny') || rewrittenUrl.includes('models'))) {
          console.error(`[Whisper] ✗ Fetch error for ${rewrittenUrl}:`, error);
        }
      });
      
      return fetchPromise;
    };
    
    loadPromise = pipeline('automatic-speech-recognition', MODEL_ID, {
      quantized: true,
    });

    transcriber = await loadPromise;
    
    // Restore original fetch
    window.fetch = originalFetch;
    console.log('[Whisper] Model loaded successfully. Requested URLs:', requestedUrls);
    const loadTime = performance.now() - startTime;
    console.log('[Whisper] Model loaded successfully:', {
      loadTime: `${loadTime.toFixed(2)}ms`,
      timestamp: new Date().toISOString()
    });
    
    isLoading = false;
    return transcriber;
  } catch (error) {
    isLoading = false;
    loadPromise = null;
    const loadTime = performance.now() - startTime;
    console.error('[Whisper] Model initialization failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      loadTime: `${loadTime.toFixed(2)}ms`,
      modelId: MODEL_ID,
      localModelPath: env.localModelPath,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Convert AudioBuffer to 16kHz mono PCM format required by Whisper
 */
function convertAudioToWhisperFormat(audioBuffer: AudioBuffer): Float32Array {
  const targetSampleRate = 16000;
  const numberOfChannels = 1;

  // If already at target sample rate and mono, return as-is
  if (audioBuffer.sampleRate === targetSampleRate && audioBuffer.numberOfChannels === numberOfChannels) {
    return audioBuffer.getChannelData(0);
  }

  // Convert to mono first (average all channels)
  const inputLength = audioBuffer.length;
  const numChannels = audioBuffer.numberOfChannels;
  const monoData = new Float32Array(inputLength);

  if (numChannels === 1) {
    monoData.set(audioBuffer.getChannelData(0));
  } else {
    // Average all channels to mono
    for (let i = 0; i < numberOfChannels; i++) {
      const channelData = audioBuffer.getChannelData(i);
      for (let j = 0; j < inputLength; j++) {
        monoData[j] += channelData[j] / numberOfChannels;
      }
    }
  }

  // Resample to 16kHz if needed
  if (audioBuffer.sampleRate === targetSampleRate) {
    return monoData;
  }

  const ratio = audioBuffer.sampleRate / targetSampleRate;
  const length = Math.round(inputLength / ratio);
  const result = new Float32Array(length);
  let inputIndex = 0;

  for (let i = 0; i < length; i++) {
    const index = Math.floor(inputIndex);
    const fraction = inputIndex - index;
    
    if (index + 1 < monoData.length) {
      result[i] = monoData[index] * (1 - fraction) + monoData[index + 1] * fraction;
    } else {
      result[i] = monoData[index];
    }
    
    inputIndex += ratio;
  }

  return result;
}

/**
 * Convert ArrayBuffer (MP3) to AudioBuffer
 */
async function arrayBufferToAudioBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    return audioBuffer;
  } catch (error) {
    throw new Error(`Failed to decode audio: ${error}`);
  }
}

/**
 * Transcribe audio data to text
 * @param audioData - ArrayBuffer (MP3) or AudioBuffer
 * @param language - Optional language code (e.g., 'en', 'es', 'fr'). If not provided, model will auto-detect.
 * @returns Promise<string> - Transcribed text
 */
export async function transcribe(
  audioData: ArrayBuffer | AudioBuffer,
  language?: string
): Promise<string> {
  const startTime = performance.now();
  
  // Log request
  const audioSize = audioData instanceof ArrayBuffer 
    ? audioData.byteLength 
    : audioData.length * audioData.numberOfChannels * 4; // Approximate size
  const audioDuration = audioData instanceof AudioBuffer
    ? audioData.duration
    : null;
  
  console.log('[Whisper] Transcribe request:', {
    audioSize: `${(audioSize / 1024).toFixed(2)} KB`,
    audioDuration: audioDuration ? `${audioDuration.toFixed(2)}s` : 'unknown',
    language: language || 'auto-detect',
    timestamp: new Date().toISOString()
  });

  try {
    // Initialize model if not already loaded
    const model = await initializeModel();

    // Convert ArrayBuffer to AudioBuffer if needed
    let audioBuffer: AudioBuffer;
    if (audioData instanceof ArrayBuffer) {
      audioBuffer = await arrayBufferToAudioBuffer(audioData);
    } else {
      audioBuffer = audioData;
    }

    // Convert to Whisper format (16kHz mono)
    const audioDataFloat32 = convertAudioToWhisperFormat(audioBuffer);
    
    console.log('[Whisper] Audio converted:', {
      originalSampleRate: audioBuffer.sampleRate,
      originalChannels: audioBuffer.numberOfChannels,
      convertedLength: audioDataFloat32.length,
      convertedSampleRate: 16000,
      convertedChannels: 1
    });

    // Prepare options
    const options: any = {
      chunk_length_s: 30,
      return_timestamps: false,
    };

    if (language) {
      options.language = language;
    }

    console.log('[Whisper] Starting transcription with options:', options);

    // Transcribe
    const result = await model(audioDataFloat32, options);
    
    const transcriptionTime = performance.now() - startTime;

    // Extract text from result
    let transcribedText: string;
    if (typeof result === 'string') {
      transcribedText = result;
    } else if (result && result.text) {
      transcribedText = result.text;
    } else if (result && typeof result === 'object' && 'chunks' in result) {
      // Handle chunked results
      const chunks = (result as any).chunks || [];
      transcribedText = chunks.map((chunk: any) => chunk.text || '').join(' ').trim();
    } else {
      throw new Error('Unexpected transcription result format');
    }

    // Log response
    console.log('[Whisper] Transcribe response:', {
      text: transcribedText,
      textLength: transcribedText.length,
      processingTime: `${transcriptionTime.toFixed(2)}ms`,
      timestamp: new Date().toISOString()
    });

    return transcribedText;
  } catch (error) {
    const errorTime = performance.now() - startTime;
    console.error('[Whisper] Transcribe error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      processingTime: `${errorTime.toFixed(2)}ms`,
      timestamp: new Date().toISOString()
    });
    throw new Error(`Transcription failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if the model is loaded
 */
export function isModelLoaded(): boolean {
  return transcriber !== null;
}

/**
 * Get model loading state
 */
export function isLoadingModel(): boolean {
  return isLoading;
}


/**
 * Warm-up helper that starts model initialization ahead of the first request.
 */
export async function preloadModel(): Promise<void> {
  await initializeModel();
}
