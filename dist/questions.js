(function (root) {
  'use strict';
  const ROUND_LENGTH = 20;
  const divisions = ['AL East', 'AL Central', 'AL West', 'NL East', 'NL Central', 'NL West'];
  function shuffle(items, random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function question(details, correct, distractors, random) {
    const a = shuffle([correct, ...distractors], random);
    return { ...details, a, correct: a.indexOf(correct) };
  }
  function normalizeSeed(seed) {
    if (typeof seed !== 'string') throw new Error('The seed must be text.');
    const value = seed.trim().normalize('NFC');
    if (!value || value.length > 80) throw new Error('Use a seed between 1 and 80 characters.');
    return value;
  }
  function createSeededRandom(seed) {
    const value = normalizeSeed(seed);
    let state = 2166136261;
    for (let i = 0; i < value.length; i++) {
      state = Math.imul(state ^ value.charCodeAt(i), 16777619) >>> 0;
    }
    // Fixed 32-bit arithmetic makes the stream reproducible across browsers.
    return function () {
      state = (state + 0x6D2B79F5) >>> 0;
      let next = Math.imul(state ^ (state >>> 15), 1 | state);
      next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
      return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
    };
  }
  function generateSeededRound(teams, seed) {
    return generateRound(teams, createSeededRandom(seed));
  }
  function generateRound(teams, random = Math.random) {
    const result = [], featured = new Set();
    const counts = [1, 1, 1, 1];
    for (let i = 0; i < ROUND_LENGTH - counts.length; i++) counts[Math.floor(random() * 4)]++;
    const firstMode = random() < .5 ? 'logo' : 'name';
    const modes = shuffle(Array.from({length: counts[0]}, (_, i) => i % 2 ? (firstMode === 'logo' ? 'name' : 'logo') : firstMode), random);
    const divisionPicks = count => {
      const picks = [];
      while (picks.length < count) picks.push(...shuffle(divisions, random).slice(0, count - picks.length));
      return picks;
    };
    shuffle(teams, random).slice(0, counts[0]).forEach((team, i) => {
      featured.add(team.id);
      result.push(question({
        type: 1, category: 'LEAGUE & DIVISION', teamId: team.id,
        teamName: team.team, logo: team.logo_data, promptMode: modes[i],
        q: modes[i] === 'logo' ? 'Which league and division does this team belong to?' : `Which league and division do the ${team.team} belong to?`,
        why: `The ${team.team} play in the ${team.divisionLabel} (${team.league} ${team.division}).`
      }, team.divisionLabel, shuffle(divisions.filter(d => d !== team.divisionLabel), random).slice(0, 3), random));
    });
    const locations = [...new Set(teams.map(t => t.location).filter(Boolean))];
    shuffle(teams.filter(t => t.location && !featured.has(t.id)), random).slice(0, counts[1]).forEach(team => {
      result.push(question({
        type: 2, category: 'CITY OR REGION', teamId: team.id, teamName: team.team,
        logo: team.logo_data, caption: team.nickname,
        q: `Which city or region do the ${team.nickname} represent?`,
        why: `The ${team.nickname} represent ${team.location}: their full team name is ${team.team}.`
      }, team.location, shuffle(locations.filter(l => l !== team.location), random).slice(0, 3), random));
    });
    divisionPicks(counts[2]).forEach(division => {
      const members = shuffle(teams.filter(t => t.divisionLabel === division), random).slice(0, 3);
      const outsider = shuffle(teams.filter(t => t.divisionLabel !== division), random)[0];
      const oddTeamQuestion = question({
        type: 3, category: 'ODD TEAM OUT', divisionLabel: division, teamId: outsider.id,
        q: `Which team is NOT in the ${division}?`,
        why: `The ${outsider.nickname} play in the ${outsider.divisionLabel}. The other three teams all play in the ${division}.`
      }, outsider.nickname, members.map(t => t.nickname), random);
      oddTeamQuestion.teamOptions = oddTeamQuestion.a.map(name => {
        const team = teams.find(t => t.nickname === name);
        return { id: team.id, name: team.nickname, logo: team.logo_data };
      });
      result.push(oddTeamQuestion);
    });
    divisionPicks(counts[3]).forEach(division => {
      const members = teams.filter(t => t.divisionLabel === division && t.location);
      const memberLocations = new Set(members.map(t => t.location));
      const selected = shuffle(members, random)[0];
      const distractors = shuffle(locations.filter(location => !memberLocations.has(location)), random).slice(0, 3);
      const representedBy = members.filter(t => t.location === selected.location).map(t => t.nickname).join(' and ');
      const cityQuestion = question({
        type: 4, category: 'CITY IN THE DIVISION', divisionLabel: division, teamId: selected.id,
        q: `Which city or region is represented in the ${division}?`,
        why: `${selected.location} is represented in the ${division} by the ${representedBy}. The other three choices are not represented in this division.`
      }, selected.location, distractors, random);
      cityQuestion.teamOptions = cityQuestion.a.map(location => {
        const team = teams.find(t => t.location === location && t.divisionLabel === division) || teams.find(t => t.location === location);
        return { id: team.id, name: location, alt: `${team.nickname} logo representing ${location}`, logo: team.logo_data };
      });
      result.push(cityQuestion);
    });
    return shuffle(result, random);
  }
  root.BaseballQuestions = { ROUND_LENGTH, generateRound, generateSeededRound, createSeededRandom, normalizeSeed };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.BaseballQuestions;
})(globalThis);
