import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BatchProcessor } from '../src/services/batchProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const filePathArg = process.argv[2];
  const targetFile = filePathArg
    ? path.resolve(process.cwd(), filePathArg)
    : path.resolve(__dirname, '../data/sample_api_responses.json');

  console.log('-------------------------------------------------------------');
  console.log(`🔍 [Batch Pipeline] Reading API telemetry data from:`);
  console.log(`   ${targetFile}`);
  console.log('-------------------------------------------------------------');

  try {
    const startTime = Date.now();
    const result = await BatchProcessor.processBatch(targetFile, { sendEmail: false });
    const elapsed = Date.now() - startTime;

    console.log(`\n✅ [Batch Processing Complete] in ${elapsed}ms`);
    console.log(`📊 Summary:`);
    console.log(`   - Total API telemetry records evaluated: ${result.total_processed}`);
    console.log(`   - Anomalies flagged: ${result.anomalies_detected}`);
    console.log('-------------------------------------------------------------');

    for (const item of result.results) {
      const statusIcon = item.has_anomaly ? '⚠️ ' : '✅';
      console.log(`\n${statusIcon} ${item.api_name}:`);
      if (!item.has_anomaly) {
        console.log(`   Status: HEALTHY (No anomalies detected)`);
      } else {
        for (const anom of item.anomalies) {
          console.log(`   - [${anom.severity}] Type: ${anom.anomaly_type}`);
          console.log(`     Alert   : ${anom.ai_alert}`);
          console.log(`     Analysis: ${anom.ai_analysis}`);
          console.log(`     Action  : ${anom.suggested_action}`);
        }
      }
    }

    console.log('\n=============================================================');
    console.log(`✨ All metrics and alerts persisted to SQLite database.`);
    console.log(`   View live dashboard at: http://localhost:3000`);
    console.log('=============================================================\n');
  } catch (err) {
    console.error('❌ Batch processing failed:', err.message);
    process.exit(1);
  }
}

main();
