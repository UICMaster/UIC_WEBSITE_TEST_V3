// src/utils/uicData.ts
import rawRosters from '../../data/data.json';
import rawTeams from '../../data/teams.json';
import rawPrimeStats from '../../data/prime_stats.json';

const rosters = (rawRosters || {}) as Record<string, any[]>;
const teams = (rawTeams || {}) as Record<string, any>;
const primeStats = (rawPrimeStats || {}) as Record<string, any>;

export const totalTeams = Object.keys(rosters).length;

export const totalAthletes = Object.values(rosters).reduce((acc: number, r: any) => {
  return acc + (Array.isArray(r) ? r.length : 0);
}, 0);

export const primeTier = teams.prime?.tier || "Division 4";
export const primeTierShort = primeTier.toUpperCase().replace("DIVISION", "DIV").trim();

export const communityCount = "500+";
export const discordInviteUrl = "https://discord.gg/VjggbjA6Q4";

export interface NextMatchStarter {
  name: string;
  role: string;
}

export interface NextMatchInfo {
  teamKey: string;
  team: string;
  teamTier: string;
  teamTierShort: string;
  teamLink: string | null;
  matchDay: number | null;
  matchLink: string | null;
  enemy: string;
  enemyTag: string;
  enemyLogo: string | null;
  enemyLink: string | null;
  dateFormatted: string;
  timeFormatted: string;
  dateFull: string;
  confirmed: boolean;
  confirmedLabel: "Bestätigt" | "Unbestätigt";
  starters: NextMatchStarter[];
  isScheduled: boolean;
}

const now = new Date();
const ROLE_ORDER: Record<string, number> = { TOP: 1, JGL: 2, MID: 3, BOT: 4, SUP: 5 };

// Map every match URL / ID to its confirmation status for cross-referencing in Events.astro
export const matchLookupByUrl: Record<string, { confirmed: boolean; begin?: string; team?: string }> = {};

const allUpcomingMatches: (NextMatchInfo & { timestamp: number })[] = [];

for (const [teamKey, teamObj] of Object.entries(primeStats)) {
  if (!teamObj || teamKey === 'community') continue;
  const matches = Array.isArray(teamObj.matches) ? teamObj.matches : [];
  const teamDisplay = teamObj.teamDisplay || `UIC ${teamKey.toUpperCase()}`;
  const teamTier = teamObj.tier || teamObj.api_meta?.division || "Prime League";
  const teamTierShort = String(teamTier).toUpperCase().replace("DIVISION", "DIV").trim();
  const teamLink = teamObj.api_meta?.prime_league_link || null;

  const teamRoster = [...(rosters[teamKey] || [])].sort(
    (a, b) => (ROLE_ORDER[a.role] || 99) - (ROLE_ORDER[b.role] || 99)
  );
  const starters: NextMatchStarter[] = teamRoster.slice(0, 5).map((p) => ({
    name: p.name || "Spieler",
    role: p.role || "SUB"
  }));

  for (const m of matches) {
    if (m.prime_league_link) {
      matchLookupByUrl[m.prime_league_link] = {
        confirmed: m.confirmed === true,
        begin: m.begin,
        team: teamDisplay
      };
    }

    if (!m.result && m.begin) {
      const mDate = new Date(m.begin);
      const ts = mDate.getTime();
      if (!isNaN(ts) && mDate > now) {
        const isConfirmed = m.confirmed === true;
        allUpcomingMatches.push({
          timestamp: ts,
          teamKey,
          team: teamDisplay,
          teamTier,
          teamTierShort,
          teamLink,
          matchDay: m.match_day ?? null,
          matchLink: m.prime_league_link || null,
          enemy: m.enemy_team?.name || m.enemy_team?.team_tag || "Gegner",
          enemyTag: m.enemy_team?.team_tag || "OPP",
          enemyLogo: m.enemy_team?.logo_url || null,
          enemyLink: m.enemy_team?.prime_league_link || null,
          dateFormatted: mDate.toLocaleDateString('de-DE', {
            timeZone: 'Europe/Berlin',
            weekday: 'short',
            day: '2-digit',
            month: 'short'
          }),
          timeFormatted: mDate.toLocaleTimeString('de-DE', {
            timeZone: 'Europe/Berlin',
            hour: '2-digit',
            minute: '2-digit'
          }),
          dateFull: mDate.toLocaleString('de-DE', {
            timeZone: 'Europe/Berlin',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          }),
          confirmed: isConfirmed,
          confirmedLabel: isConfirmed ? "Bestätigt" : "Unbestätigt",
          starters,
          isScheduled: true
        });
      }
    }
  }
}

// Sort strictly chronologically across all UIC teams (earliest upcoming match first)
allUpcomingMatches.sort((a, b) => a.timestamp - b.timestamp);

const fallbackStarters: NextMatchStarter[] = (rosters.prime || []).slice(0, 5).map((p) => ({
  name: p.name || "Spieler",
  role: p.role || "SUB"
}));

export const nextMatch: NextMatchInfo = allUpcomingMatches[0] || {
  teamKey: "prime",
  team: "UIC Prime",
  teamTier: primeTier,
  teamTierShort,
  teamLink: primeStats.prime?.api_meta?.prime_league_link || null,
  matchDay: null,
  matchLink: null,
  enemy: "Gegner offen",
  enemyTag: "OPP",
  enemyLogo: null,
  enemyLink: null,
  dateFormatted: "DEMNÄCHST",
  timeFormatted: "--:--",
  dateFull: "Prime League Spieltag",
  confirmed: false,
  confirmedLabel: "Unbestätigt",
  starters: fallbackStarters,
  isScheduled: false
};
