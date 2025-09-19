const brotli = require('brotli');
const fs = require('fs');
const path = require('path');

// Run using this command: node quantify.js <input-filename>
const SERVER_URL = 'http://localhost:8000/api/quantify/scram-node';
const GET_INPUT_URL = 'http://localhost:8000/api/quantify/get-input-data';
const GET_OUTPUT_URL = 'http://localhost:8000/api/quantify/get-output-data';
const INPUT_DIR = './input';
const OUTPUT_DIR = './output';

function ensureDirectories() {
  if (!fs.existsSync(INPUT_DIR)) {
    fs.mkdirSync(INPUT_DIR, { recursive: true });
    console.log(`Created input directory: ${INPUT_DIR}`);
  }
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}`);
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

function saveOutput(data, filename, suffix = '') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseFilename = path.parse(filename).name;
  const outputFilename = `${baseFilename}_${suffix}_${timestamp}.json`;
  const outputPath = path.join(OUTPUT_DIR, outputFilename);
  
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`Saved to: ${outputPath}`);
  return outputPath;
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
    console.log(`Compression ratio: ${((1 - compressedBuffer.length / requestBuffer.length) * 100).toFixed(2)}%`);
  } catch (error) {
    console.error('Compression test failed:', error.message);
  }
}

async function makeQuantifyRequest(inputFilename) {
  try {
    const testRequest = readInputFile(inputFilename);
    const requestJson = JSON.stringify(testRequest);
    const requestBuffer = Buffer.from(requestJson, 'utf8');
    const compressedRequest = brotli.compress(requestBuffer);
    const compressedBuffer = Buffer.from(compressedRequest);
    
    console.log('\n=== Making quantify request ===');
    console.log(`Sending compressed data: ${compressedBuffer.length} bytes`);
    
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: compressedBuffer,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const minioResponse = await response.json();
    console.log('MinIO Response:', minioResponse);
    
    // Save the MinIO response
    saveOutput(minioResponse, inputFilename, 'minio_response');
    
    return minioResponse;
  } catch (error) {
    console.error('Quantify request failed:', error.message);
    throw error;
  }
}

async function getInputData(inputId, inputFilename) {
  try {
    console.log('\n=== Retrieving input data ===');
    console.log(`Input ID: ${inputId}`);
    
    const response = await fetch(`${GET_INPUT_URL}/${inputId}`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const compressedData = await response.arrayBuffer();
    const compressedBuffer = Buffer.from(compressedData);
    
    console.log(`Received compressed input data: ${compressedBuffer.length} bytes`);
    
    // Decompress the data
    const decompressedData = brotli.decompress(compressedBuffer);
    const jsonString = Buffer.from(decompressedData).toString('utf8');
    const inputData = JSON.parse(jsonString);
    
    console.log(`Decompressed input data: ${jsonString.length} bytes`);
    
    // Save the retrieved input data
    saveOutput(inputData, inputFilename, 'retrieved_input');
    
    return inputData;
  } catch (error) {
    console.error('Get input data failed:', error.message);
    throw error;
  }
}

async function getOutputData(outputId, inputFilename) {
  try {
    console.log('\n=== Retrieving output data ===');
    console.log(`Output ID: ${outputId}`);
    
    const response = await fetch(`${GET_OUTPUT_URL}/${outputId}`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const compressedData = await response.arrayBuffer();
    const compressedBuffer = Buffer.from(compressedData);
    
    console.log(`Received compressed output data: ${compressedBuffer.length} bytes`);
    
    // Decompress the data
    const decompressedData = brotli.decompress(compressedBuffer);
    const jsonString = Buffer.from(decompressedData).toString('utf8');
    const outputData = JSON.parse(jsonString);
    
    console.log(`Decompressed output data: ${jsonString.length} bytes`);
    
    // Save the retrieved output data
    saveOutput(outputData, inputFilename, 'retrieved_output');
    
    return outputData;
  } catch (error) {
    console.error('Get output data failed:', error.message);
    throw error;
  }
}

async function main() {
  ensureDirectories();

  const args = process.argv.slice(2);
  let inputFilename = args[0];
  
  if (!inputFilename) {
    console.log('Usage: node quantify.js <input-filename>');
    console.log('Available input files:');
    try {
      const files = fs.readdirSync(INPUT_DIR).filter(file => file.endsWith('.json'));
      files.forEach(file => console.log(`  - ${file}`));
    } catch (error) {
      console.log('  No input directory found or no JSON files available');
    }
    return;
  }

  try {
    console.log(`Processing input file: ${inputFilename}`);
    
    // Test compression first
    await testBrotliCompression(inputFilename);
    
    // Make the quantify request
    const minioResponse = await makeQuantifyRequest(inputFilename);
    
    if (minioResponse.status === 'error') {
      console.error('Quantification failed:', minioResponse.error);
      return;
    }
    
    // Retrieve the input data from MinIO
    const retrievedInput = await getInputData(minioResponse.inputId, inputFilename);
    
    // Retrieve the output data from MinIO
    const retrievedOutput = await getOutputData(minioResponse.outputId, inputFilename);
    
    console.log('\n=== Summary ===');
    console.log(`Input ID: ${minioResponse.inputId}`);
    console.log(`Output ID: ${minioResponse.outputId}`);
    console.log(`Timestamp: ${minioResponse.timestamp}`);
    console.log('All data successfully retrieved and saved to output directory');
    
    // Verify the retrieved input matches the original
    const originalInput = readInputFile(inputFilename);
    const inputMatches = JSON.stringify(originalInput) === JSON.stringify(retrievedInput);
    console.log(`Input data integrity check: ${inputMatches ? 'PASSED' : 'FAILED'}`);
    
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);