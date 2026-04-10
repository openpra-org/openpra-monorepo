const fs = require('fs');
const path = require('path');
const assert = require('assert');

function resolveAndPrepareAddon() {
  const root = path.resolve(__dirname, '..', '..');
  const copyPairs = [
    [path.join(root, 'target', 'debug', 'praxis.dll'), path.join(root, 'target', 'debug', 'praxis.node')],
    [path.join(root, 'target', 'debug', 'libpraxis.so'), path.join(root, 'target', 'debug', 'libpraxis.node')],
    [path.join(root, 'target', 'debug', 'libpraxis.dylib'), path.join(root, 'target', 'debug', 'libpraxis.node')],
    [path.join(root, 'target', 'release', 'praxis.dll'), path.join(root, 'target', 'release', 'praxis.node')],
    [path.join(root, 'target', 'release', 'libpraxis.so'), path.join(root, 'target', 'release', 'libpraxis.node')],
    [path.join(root, 'target', 'release', 'libpraxis.dylib'), path.join(root, 'target', 'release', 'libpraxis.node')],
  ];

  for (const [src, dst] of copyPairs) {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      return dst;
    }
  }

  const candidates = [
    path.join(root, 'target', 'debug', 'praxis.node'),
    path.join(root, 'target', 'debug', 'libpraxis.node'),
    path.join(root, 'target', 'release', 'praxis.node'),
    path.join(root, 'target', 'release', 'libpraxis.node'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('Node addon binary not found. Build with: cargo build --features napi-rs');
}

function selectFn(addon, names) {
  for (const name of names) {
    if (typeof addon[name] === 'function') {
      return addon[name];
    }
  }
  throw new Error(`None of expected exports found: ${names.join(', ')}. Actual exports: ${Object.keys(addon).join(', ')}`);
}

function validPayload() {
  return JSON.stringify({
    id: 'MODEL-JS-1',
    technicalElements: {
      'data-analysis': {
        id: 'DA-1',
        dataParameters: [{ id: 'DP-1', probability: 0.01 }],
      },
      'systems-analysis': {
        id: 'SA-1',
        systemDefinitions: [{ id: 'SYS-1', faultTreeId: 'FT-1' }],
        systemLogicModels: [{ id: 'FT-1', modelType: 'or', basicEventRefs: ['DP-1'] }],
      },
      'initiating-event-analysis': {
        id: 'IEA-1',
        initiators: [{ id: 'IE-1', probability: 1.0 }],
      },
      'event-sequence-analysis': {
        id: 'ESA-1',
        eventSequences: [
          {
            id: 'SEQ-1',
            initiatingEventId: 'IE-1',
            functionalEventBindings: [{ id: 'FEB-1', functionalEventId: 'FE-1', faultTreeId: 'FT-1' }],
          },
          {
            id: 'SEQ-2',
            initiatingEventId: 'IE-1',
            functionalEventBindings: [{ id: 'FEB-2', functionalEventId: 'FE-1', faultTreeId: 'FT-1' }],
          },
        ],
      },
      'event-sequence-quantification': {
        id: 'ESQ-1',
        quantificationResults: [],
      },
      'risk-integration': {
        id: 'RI-1',
        eventSequenceToReleaseCategoryMappings: [],
      },
    },
  });
}

function assertSuccessAndFailureContracts(addon) {
  const validate = selectFn(addon, ['validate_openpra_json', 'validateOpenpraJson']);
  const quantify = selectFn(addon, ['quantify_openpra_json', 'quantifyOpenpraJson']);
  const convertXml = selectFn(addon, ['convert_openpsa_xml_to_openpra_json', 'convertOpenpsaXmlToOpenpraJson']);

  const invalidValidation = JSON.parse(validate('{not-json}'));
  assert.strictEqual(invalidValidation.ok, false);
  assert.ok(Array.isArray(invalidValidation.diagnostics));
  assert.ok(invalidValidation.diagnostics.some((d) => d.code === 'SCHEMA_INVALID_JSON'));

  const validValidation = JSON.parse(validate(validPayload()));
  assert.strictEqual(validValidation.ok, true);
  assert.ok(validValidation.limits);
  assert.ok(validValidation.limits.maxInputBytes > 0);

  const quantified = JSON.parse(quantify(validPayload(), false));
  assert.ok(quantified.technicalElements);
  const results = quantified.technicalElements['event-sequence-quantification'].quantificationResults;
  assert.ok(Array.isArray(results));

  const strictFailurePayload = JSON.stringify({
    id: 'MODEL-JS-STRICT',
    technicalElements: {
      'data-analysis': { id: 'DA', dataParameters: [{ id: 'DP', probability: 0.1 }] },
      'systems-analysis': { id: 'SA', systemDefinitions: [], systemLogicModels: [] },
      'initiating-event-analysis': { id: 'IEA', initiators: [{ id: 'IE', probability: 1.0 }] },
      'event-sequence-analysis': {
        id: 'ESA',
        eventSequences: [
          {
            id: 'SEQ',
            initiatingEventId: 'IE',
            functionalEventBindings: [{ id: 'FEB', functionalEventId: 'FE', faultTreeId: 'FT-MISSING' }],
          },
        ],
      },
      'event-sequence-quantification': { id: 'ESQ', quantificationResults: [] },
      'risk-integration': { id: 'RI', eventSequenceToReleaseCategoryMappings: [] },
    },
  });

  const strictQuantified = JSON.parse(quantify(strictFailurePayload, true));
  assert.ok(Array.isArray(strictQuantified.diagnostics));
  assert.ok(strictQuantified.diagnostics.some((d) => d.code === 'REF_MISSING_REQUIRED'));

  const conversion = JSON.parse(convertXml('<opsa-mef />'));
  assert.strictEqual(conversion.ok, false);
  assert.ok(Array.isArray(conversion.diagnostics));
  assert.ok(conversion.diagnostics.some((d) => d.code === 'CONV_UNSUPPORTED'));

  const tooLarge = 'x'.repeat((validValidation.limits.maxInputBytes || 0) + 1);
  assert.throws(() => validate(tooLarge), /NAPI_INPUT_TOO_LARGE/);
}

function main() {
  const addonPath = resolveAndPrepareAddon();
  const addon = require(addonPath);
  assertSuccessAndFailureContracts(addon);
  console.log('NAPI integration tests passed');
}

main();
