import fs from 'node:fs';
import path from 'node:path';

// --- PATHS & HEADERS ---
const INPUT_PATH = path.resolve(process.cwd(), 'data', 'teams.json');
const OUTPUT_PATH = path.resolve(process.cwd(), 'data', 'prime_stats.json');
const HEADERS = { 'User-Agent': 'UIC-Data-Warehouse/1.0' };

// --- HELPERS ---
// Helper to safely match Riot IDs between API and Local JSON
function isSamePlayer(apiSummonerName, localPlayer) {
    if (!apiSummonerName || !localPlayer || !localPlayer.gameName) return false;
    
    const apiClean = apiSummonerName.toLowerCase().trim();
    const localNameClean = localPlayer.gameName.toLowerCase().trim();
    
    // Fix: Safely construct tag combinations
    const hasTag = !!localPlayer.tagLine;
    const localCombined = hasTag 
        ? `${localPlayer.gameName}#${localPlayer.tagLine}`.toLowerCase().trim()
        : localNameClean;

    // 1. Exact match with full Riot ID (e.g. "uic speedy#euw" === "uic speedy#euw")
    if (apiClean === localCombined) return true;
    
    // 2. Exact match with just gameName (e.g. "uic speedy" === "uic speedy")
    if (apiClean === localNameClean) return true;

    // 3. API has tag, but we only check the prefix (e.g. "uic speedy#euw" matches "uic speedy")
    if (apiClean.split('#')[0].trim() === localNameClean) return true;

    return false;
}

async function buildGoldenJSON() {
    console.log("🚀 Starting Golden Prime League Sync...");
    const localTeamsData = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
    const goldenDatabase = {};

    for (const [teamKey, localTeamInfo] of Object.entries(localTeamsData)) {
        console.log(`📡 Fetching data for: ${localTeamInfo.teamDisplay || teamKey}...`);
        
        // Initialize the base structure inheriting your local data
        goldenDatabase[teamKey] = {
            ...localTeamInfo,
            api_meta: null,
            roster: [...localTeamInfo.roster], // Clone to safely mutate
            matches: []
        };

        const teamId = localTeamInfo.primeLeagueId;
        
        // Fix: Convert to string safely before using .trim()
        if (!teamId || String(teamId).trim() === "") {
            console.log(`⚠️ Skipping API fetch for ${teamKey} (No Prime League ID).`);
            continue;
        }

        try {
            const response = await fetch(`https://primebot.me/api/v1/teams/${teamId}/`, { headers: HEADERS });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const apiData = await response.json();

            // 1. INHERIT API META DATA
            goldenDatabase[teamKey].api_meta = {
                id: apiData.id,
                name: apiData.name,
                team_tag: apiData.team_tag,
                division: apiData.division,
                logo_url: apiData.logo_url,
                prime_league_link: apiData.prime_league_link,
                updated_at: apiData.updated_at
            };

            // 2. MERGE ROSTERS (Local Data + API Data) using the Riot ID Helper
            const apiPlayers = apiData.players || [];
            
            // Update local roster with API specifics
            goldenDatabase[teamKey].roster = goldenDatabase[teamKey].roster.map(localPlayer => {
                const apiMatch = apiPlayers.find(p => isSamePlayer(p.summoner_name, localPlayer));
                return {
                    ...localPlayer,
                    api_id: apiMatch ? apiMatch.id : null,
                    isCaptain: apiMatch ? apiMatch.is_leader : localPlayer.isCaptain,
                    api_name: apiMatch ? apiMatch.name : null, // The real name if provided to the API
                    in_api_roster: !!apiMatch
                };
            });

            // Append players found in API but missing in your local teams.json (Edge Case Safety)
            apiPlayers.forEach(apiPlayer => {
                const existsLocally = goldenDatabase[teamKey].roster.find(localPlayer => isSamePlayer(apiPlayer.summoner_name, localPlayer));
                if (!existsLocally) {
                    goldenDatabase[teamKey].roster.push({
                        playerId: "UNKNOWN_LOCAL",
                        gameName: apiPlayer.summoner_name,
                        role: "UNKNOWN",
                        rosterStatus: "api_only",
                        isCaptain: apiPlayer.is_leader,
                        api_id: apiPlayer.id,
                        in_api_roster: true,
                        missing_in_local: true
                    });
                }
            });

            // 3. INHERIT AND FORMAT ALL MATCHES
            if (apiData.matches) {
                const enrichedMatches = [];
                
                // Fix: Switch to async for...of loop to fetch missing 'match_begin_confirmed' flags
                for (const m of apiData.matches) {
                    let isConfirmed = false;

                    // If the match has a result, it happened in the past and is inherently confirmed
                    if (m.result) {
                        isConfirmed = true;
                    } 
                    // If it has NO result, it's upcoming. Fetch the match detail endpoint to get the confirmed flag.
                    else {
                        try {
                            const matchResponse = await fetch(`https://primebot.me/api/v1/matches/${m.id}/`, { headers: HEADERS });
                            if (matchResponse.ok) {
                                const matchDetail = await matchResponse.json();
                                isConfirmed = matchDetail.match_begin_confirmed === true;
                            }
                            // Respect API rate limits on these secondary calls
                            await new Promise(r => setTimeout(r, 200));
                        } catch (err) {
                            console.error(`⚠️ Could not fetch confirmation status for match ${m.id}`);
                        }
                    }

                    enrichedMatches.push({
                        id: m.id,
                        match_id: m.match_id,
                        match_type: m.match_type,
                        match_day: m.match_day,
                        begin: m.begin,
                        confirmed: isConfirmed, // Pulled correctly via the detail endpoint
                        result: m.result || null,
                        prime_league_link: m.prime_league_link,
                        updated_at: m.updated_at,
                        enemy_team: m.enemy_team ? {
                            id: m.enemy_team.id,
                            name: m.enemy_team.name,
                            team_tag: m.enemy_team.team_tag,
                            prime_league_link: m.enemy_team.prime_league_link,
                            logo_url: m.enemy_team.logo_url || null
                        } : null,
                        team_lineup: m.team_lineup || [],
                        enemy_lineup: m.enemy_lineup || []
                    });
                }
                
                goldenDatabase[teamKey].matches = enrichedMatches;
            }

        } catch (e) {
            console.error(`❌ Error fetching data for ${teamKey}:`, e.message);
        }

        // Respect API rate limits between team calls
        await new Promise(r => setTimeout(r, 250));
    }

    // Write the Golden JSON
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(goldenDatabase, null, 2));
    console.log(`✅ Golden Data successfully built: ${OUTPUT_PATH}`);
}

// Fix: Execute with error catching to prevent Unhandled Promise Rejections
buildGoldenJSON().catch(err => {
    console.error("💥 Fatal Error:", err);
    process.exit(1);
});
