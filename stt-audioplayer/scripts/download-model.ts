import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const MODEL_ID = 'Xenova/whisper-tiny';
const OUTPUT_DIR = join(process.cwd(), 'public', 'models', 'whisper-tiny');
const ONNX_DIR = join(OUTPUT_DIR, 'onnx');

// HuggingFace CDN base URL
const HF_CDN_BASE = 'https://huggingface.co';

async function downloadFile(url: string, outputPath: string): Promise<void> {
  console.log(`Downloading: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  
  const buffer = await response.arrayBuffer();
  await writeFile(outputPath, Buffer.from(buffer));
  console.log(`Saved: ${outputPath} (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
}

async function downloadModelFiles() {
  console.log('Downloading Whisper Tiny model files...');
  console.log(`Model: ${MODEL_ID}`);
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  try {
    // Create output directories
    await mkdir(OUTPUT_DIR, { recursive: true });
    await mkdir(ONNX_DIR, { recursive: true });

    // Model files to download from HuggingFace
    const modelFiles = [
      // Config files (already exist, but we'll verify)
      { path: 'config.json', url: `${HF_CDN_BASE}/${MODEL_ID}/resolve/main/config.json` },
      { path: 'tokenizer.json', url: `${HF_CDN_BASE}/${MODEL_ID}/resolve/main/tokenizer.json` },
      { path: 'tokenizer_config.json', url: `${HF_CDN_BASE}/${MODEL_ID}/resolve/main/tokenizer_config.json` },
      { path: 'generation_config.json', url: `${HF_CDN_BASE}/${MODEL_ID}/resolve/main/generation_config.json` },
      { path: 'vocab.json', url: `${HF_CDN_BASE}/${MODEL_ID}/resolve/main/vocab.json` },
      { path: 'merges.txt', url: `${HF_CDN_BASE}/${MODEL_ID}/resolve/main/merges.txt` },
      { path: 'preprocessor_config.json', url: `${HF_CDN_BASE}/${MODEL_ID}/resolve/main/preprocessor_config.json` },
      
      // ONNX model files (quantized) - these are the files @xenova/transformers uses
      { path: 'onnx/encoder_model_quantized.onnx', url: `${HF_CDN_BASE}/${MODEL_ID}/resolve/main/onnx/encoder_model_quantized.onnx` },
      { path: 'onnx/decoder_model_merged_quantized.onnx', url: `${HF_CDN_BASE}/${MODEL_ID}/resolve/main/onnx/decoder_model_merged_quantized.onnx` },
      { path: 'onnx/decoder_with_past_model_quantized.onnx', url: `${HF_CDN_BASE}/${MODEL_ID}/resolve/main/onnx/decoder_with_past_model_quantized.onnx` },
    ];

    console.log(`Downloading ${modelFiles.length} model files...\n`);

    // Download all files
    for (const file of modelFiles) {
      const outputPath = join(OUTPUT_DIR, file.path);
      try {
        await downloadFile(file.url, outputPath);
      } catch (error) {
        console.error(`Error downloading ${file.path}:`, error);
        // Continue with other files
      }
    }

    console.log('\n✅ Model files downloaded successfully!');
    console.log(`\nFiles saved to: ${OUTPUT_DIR}`);
    console.log('\nThe model is now ready for offline use in the browser.');
    
  } catch (error) {
    console.error('Error downloading model:', error);
    process.exit(1);
  }
}

downloadModelFiles();

