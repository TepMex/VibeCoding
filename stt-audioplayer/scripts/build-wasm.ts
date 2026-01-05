import { $ } from 'bun';

/**
 * Build WASM module from Rust source
 */
async function buildWasm() {
  console.log('Building WASM module...');
  
  try {
    // Check if wasm-pack is installed
    try {
      await $`wasm-pack --version`.quiet();
    } catch {
      console.error('wasm-pack is not installed. Installing...');
      console.log('Please install wasm-pack: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh');
      console.log('Or: cargo install wasm-pack');
      process.exit(1);
    }
    
    // Build WASM module
    console.log('Compiling Rust to WASM...');
    await $`cd wasm-fuzzy && wasm-pack build --target web --out-dir pkg`.quiet();
    
    // Copy WASM files to public directory for Vite to serve
    console.log('Copying WASM files to public directory...');
    await $`mkdir -p public/wasm-fuzzy/pkg`.quiet();
    await $`cp -r wasm-fuzzy/pkg/* public/wasm-fuzzy/pkg/`.quiet();
    
    console.log('WASM module built successfully!');
    console.log('Output: wasm-fuzzy/pkg/');
    console.log('Copied to: public/wasm-fuzzy/pkg/');
  } catch (error) {
    console.error('Failed to build WASM module:', error);
    process.exit(1);
  }
}

buildWasm();

