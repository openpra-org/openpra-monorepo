const brotli = require('brotli');
const fs = require('fs');
const path = require('path');

// Run with: node quantify.js <input-filename>
const SERVER_URL = 'http://localhost:8000/api/quantify/scram-node';
const INPUT_DIR = './input';
const OUTPUT_DIR = './output';

function ensureDirectories() {
  if (!fs.existsSync(INPUT_DIR)) {
    fs.mkdirSync(INPUT_DIR, { recursive: true });
    console.log(`📁 Created input directory: ${INPUT_DIR}`);
  }
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
  }
}

function readInputFile(filename) {
  const inputPath = path.join(INPUT_DIR, filename);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }
  
  try {
    const fileContent = fs.readFileSync(inputPath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    throw new Error(`Failed to parse JSON from ${inputPath}: ${error.message}`);
  }
}

function saveOutput(data, inputFilename) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseFilename = path.parse(inputFilename).name;
  const outputFilename = `${baseFilename}_${timestamp}.json`;
  const outputPath = path.join(OUTPUT_DIR, outputFilename);
  
  fs.writeFileSync(outputPath, JSON.stringify(data, null));
}

async function testBrotliCompression(inputFilename) {
  try {
    const testRequest = readInputFile(inputFilename);
    const requestJson = JSON.stringify(testRequest);
    const requestBuffer = Buffer.from(requestJson, 'utf8');
    const compressedRequest = brotli.compress(requestBuffer);
    const compressedBuffer = Buffer.from(compressedRequest);
    
    console.log(`Original size: ${requestBuffer.length} bytes`);
    console.log(`Compressed size: ${compressedBuffer.length} bytes`);

    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': compressedBuffer.length.toString(),
        'Accept': 'application/octet-stream'
      },
      body: compressedBuffer
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }

    console.log('Response headers:');
    for (const [key, value] of response.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }

    const isCompressed = response.headers.get('x-compression') === 'brotli';
    console.log(`Response is compressed: ${isCompressed}`);

    const compressedResponse = await response.arrayBuffer();
    const responseBuffer = new Uint8Array(compressedResponse);
    
    console.log(`Compressed response size: ${responseBuffer.length} bytes`);
    
    // Decompress the response
    const decompressedArray = brotli.decompress(responseBuffer);
    console.log(`Decompressed response size: ${decompressedArray.length} bytes`);
    
    if (decompressedArray.length === 0) {
      throw new Error('Decompression returned empty result');
    }
    
    // Convert the array of char codes to actual string
    const responseJson = String.fromCharCode(...decompressedArray);
    console.log(`Response JSON length: ${responseJson.length} characters`);
    console.log(`First 100 chars: ${responseJson.substring(0, 100)}`);
    
    // Parse the JSON
    const result = JSON.parse(responseJson);
    
    saveOutput(result, inputFilename, 'compressed-response');
    console.log('✅ Successfully decompressed and parsed response');
    
    return result;

  } catch (error) {
    console.error('Compressed test failed:', error.message);
    throw error;
  }
}

// Main execution
async function main() {
  ensureDirectories();

  const args = process.argv.slice(2);
  let inputFilename = args[0];
  
  try {
    await testBrotliCompression(inputFilename);
  } catch (error) {
    console.error('Test suite failed:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);