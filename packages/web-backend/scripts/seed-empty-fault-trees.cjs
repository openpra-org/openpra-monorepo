#!/usr/bin/env node
/*
  One-off migration script: seed default Fault Tree graphs for docs with empty nodes/edges.
  Usage:
    MONGO_URL="mongodb://127.0.0.1:27017/openpra" node packages/web-backend/scripts/seed-empty-fault-trees.cjs
*/
const mongoose = require('mongoose');

const FaultTreeGraphSchema = new mongoose.Schema({
  faultTreeId: { type: String, unique: true, required: true },
  nodes: { type: Array, default: [] },
  edges: { type: Array, default: [] },
}, { versionKey: false, collection: 'faulttreegraphs' });

function defaultFaultTree() {
  return {
    nodes: [
      { id: '1', data: { label: 'OR Gate' }, position: { x: 0, y: 0 }, type: 'orGate' },
      { id: '2', data: { label: 'Basic Event' }, position: { x: 0, y: 150 }, type: 'basicEvent' },
      { id: '3', data: { label: 'Basic Event' }, position: { x: 0, y: 150 }, type: 'basicEvent' },
    ],
    edges: [
      { id: '1=>2', source: '1', target: '2', type: 'workflow', animated: false, data: {} },
      { id: '1=>3', source: '1', target: '3', type: 'workflow', animated: false, data: {} },
    ],
  };
}

(async () => {
  const uri = process.env.MONGO_URL;
  if (!uri) {
    console.error('MONGO_URL env var is required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const FaultTreeGraph = mongoose.model('FaultTreeGraph', FaultTreeGraphSchema);

  // Find empties: nodes missing/empty AND edges missing/empty
  const empties = await FaultTreeGraph.find({
    $and: [
      { $or: [{ nodes: { $exists: false } }, { nodes: { $size: 0 } }] },
      { $or: [{ edges: { $exists: false } }, { edges: { $size: 0 } }] },
    ],
  }).select({ faultTreeId: 1 }).lean();

  if (empties.length === 0) {
    console.log('No empty Fault Tree graphs found.');
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`Seeding ${empties.length} Fault Tree graphs with defaults...`);
  const { nodes, edges } = defaultFaultTree();

  const bulk = FaultTreeGraph.collection.initializeUnorderedBulkOp();
  empties.forEach((doc) => {
    bulk.find({ faultTreeId: doc.faultTreeId }).updateOne({
      $set: { nodes, edges },
    });
  });
  const res = await bulk.execute();
  console.log('Bulk update result:', res);

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
