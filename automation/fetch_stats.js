/**
 * js/fetch_stats.js
 * Receiver Build: API fetching has been migrated to UIC_ANALYSES.
 * This script now serves as a local sync validator for the incoming data.json.
 */

import fs from 'node:fs';
import path from 'node:path';

// Target path to ensure data.json is correctly positioned for your frontend
const DATA_JSON_PATH = path.resolve(process.cwd(), 'data', 'data.json');

function validateSync() {
    console.log("🔄 Verifying incoming data.json synchronization...");

    if (!fs.existsSync(DATA_JSON_PATH)) {
        console.error("❌ CRITICAL ERROR: data.json was not found in the data/ folder!");
        console.error("👉 Ensure your upstream GitHub Action or sync process has correctly pushed data.json to this repository.");
        process.exit(1);
    }

    try {
        const rawContent = fs.readFileSync(DATA_JSON_PATH, 'utf-8');
        const parsedData = JSON.parse(rawContent);
        
        console.log("✅ data.json is present and verified as valid JSON.");
        console.log("\n📊 --- SYNCHRONIZED ROSTERS ---");
        
        // Print a clean summary of what was received from UIC_ANALYSES
        for (const [teamKey, roster] of Object.entries(parsedData)) {
            if (Array.isArray(roster)) {
                console.log(`🔹 [${teamKey.toUpperCase()}] received with ${roster.length} profile tracks.`);
            }
        }
        
        console.log("\n🎉 Deployment assets validated successfully!");
    } catch (error) {
        console.error("❌ CRITICAL ERROR: data.json exists but contains corrupt or invalid data!");
        console.error(`👉 Details: ${error.message}`);
        process.exit(1);
    }
}

validateSync();
