import https from 'node:https';
import fs from 'node:fs';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

const options = {
    hostname: 'discord.com',
    path: `/api/v10/guilds/${GUILD_ID}/scheduled-events`,
    headers: { Authorization: `Bot ${DISCORD_TOKEN}` }
};

https.get(options, (res) => {
    if (res.statusCode !== 200) {
        console.error(`API Fehler: HTTP ${res.statusCode}`);
        process.exit(1);
    }

    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const events = JSON.parse(data);
            
            if (!fs.existsSync('./data')) fs.mkdirSync('./data');

            const cleanedEvents = events.map(e => {
                const loc = e.entity_metadata?.location || "https://discord.gg/ultrainstinctcrew";
                const rawDesc = e.description || "Keine Beschreibung verfügbar.";
                
                // 1. Kategorisierung & Team-Extraktion
                let eventType = "TOURNAMENT";
                let isHighlight = false;
                let teams = [];
                
                if (loc.includes('primeleague.gg')) {
                    eventType = "ESPORTS MATCH";
                    if (e.name.toLowerCase().includes('vs')) {
                        teams = e.name.split(/vs\.?/i).map(teamName => teamName.trim());
                    }
                } else if (e.name.toLowerCase().includes('versammlung')) {
                    eventType = "ORGANIZATION";
                    isHighlight = true;
                }

                // 2. Twitch Stream URL Logik (SEO)
                let streamUrl = null;
                const twitchMatch = rawDesc.match(/https?:\/\/(www\.)?twitch\.tv\/[a-zA-Z0-9_]+/i);
                if (twitchMatch) {
                    streamUrl = twitchMatch[0]; // Caster Link aus der Beschreibung
                } else if (eventType === "ESPORTS MATCH") {
                    streamUrl = "https://www.twitch.tv/ultrainstinctcrew"; // Standard Crew-Kanal
                }

                // 3. Endzeit Fallback
                let endTime = e.scheduled_end_time;
                if (!endTime) {
                    const startObj = new Date(e.scheduled_start_time);
                    endTime = new Date(startObj.getTime() + 2 * 60 * 60 * 1000).toISOString();
                }

                // 4. Cover-Bild
                let imageUrl = null;
                if (e.image) {
                    imageUrl = `https://cdn.discordapp.com/guild-events/${e.id}/${e.image}.png?size=1024`;
                }

                return {
                    id: e.id,
                    name: e.name,
                    description: rawDesc,
                    type: eventType,
                    highlight: isHighlight,
                    start: e.scheduled_start_time,
                    end: endTime,
                    location: loc,
                    image: imageUrl,
                    competitors: teams,
                    streamUrl: streamUrl
                };
            });

            // Chronologisch sortieren (früheste zuerst)
            cleanedEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

            fs.writeFileSync('./data/events.json', JSON.stringify(cleanedEvents, null, 2));
            console.log(`Erfolgreich ${cleanedEvents.length} Events synchronisiert und formatiert.`);
            
        } catch (err) {
            console.error("Fehler beim Verarbeiten der Discord-Daten:", err);
            process.exit(1);
        }
    });
}).on('error', (err) => {
    console.error("HTTP Netzwerkfehler:", err);
    process.exit(1);
});
