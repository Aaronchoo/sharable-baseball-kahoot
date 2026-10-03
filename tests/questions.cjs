const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { generateRound } = require('../dist/questions.js');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/teams.js'), 'utf8'), context);
const teams = Array.from(context.MLB_TEAMS);
const byId = new Map(teams.map(t => [t.id, t]));
const byName = new Map(teams.map(t => [t.nickname, t]));
const seen = new Set(), variants = new Set(), mixes = new Set(), positions = new Set();
assert.equal(teams.length, 30);
assert.equal(byId.size, 30);
for (const team of teams) {
  assert.ok(fs.existsSync(path.join(__dirname, '../dist', team.logo_file)));
  assert.ok(team.logo_data.startsWith('data:image/svg+xml;base64,'));
  assert.deepEqual(Buffer.from(team.logo_data.split(',')[1], 'base64'), fs.readFileSync(path.join(__dirname, '../dist', team.logo_file)));
}

for (let seed = 1; seed <= 500; seed++) {
  let state = seed;
  const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  const questions = generateRound(teams, random);
  assert.equal(questions.length, 20);
  variants.add(JSON.stringify(questions));
  const counts = [1, 2, 3, 4].map(type => questions.filter(q => q.type === type).length);
  assert.ok(counts.every(count => count >= 1));
  mixes.add(counts.join(','));
  const identification = questions.filter(q => q.type === 1);
  if (identification.length > 1) {
    assert.ok(identification.some(q => q.promptMode === 'logo'));
    assert.ok(identification.some(q => q.promptMode === 'name'));
  }
  const featured = questions.filter(q => q.type < 3).map(q => q.teamId);
  assert.equal(new Set(featured).size, featured.length);
  for (const q of questions) {
    assert.equal(q.a.length, 4);
    assert.equal(new Set(q.a).size, 4);
    assert.ok(Number.isInteger(q.correct) && q.correct >= 0 && q.correct < 4);
    const team = byId.get(q.teamId);
    seen.add(team.id); positions.add(q.correct);
    if (q.type === 1) {
      assert.equal(q.a[q.correct], team.divisionLabel);
      assert.ok(q.a.every(d => teams.some(t => t.divisionLabel === d)));
      assert.equal(q.logo, team.logo_data);
    } else if (q.type === 2) {
      assert.ok(team.location);
      assert.notEqual(team.id, 133); // Athletics have no named city/region.
      assert.equal(q.a[q.correct], team.location);
      assert.ok(q.q.includes(team.nickname));
      assert.equal(q.logo, team.logo_data);
      assert.equal(q.caption, team.nickname);
      assert.ok(q.a.every(l => teams.some(t => t.location === l)));
    } else if (q.type === 3) {
      assert.ok(!q.logo); // Showing the outsider's logo would reveal the answer.
      assert.equal(q.teamOptions.length, 4);
      q.teamOptions.forEach((option, i) => {
        assert.equal(option.name, q.a[i]);
        assert.equal(option.logo, byName.get(q.a[i]).logo_data);
        assert.equal(option.id, byName.get(q.a[i]).id);
      });
      const choices = q.a.map(name => byName.get(name));
      assert.ok(choices.every(Boolean));
      assert.equal(choices.filter(t => t.divisionLabel !== q.divisionLabel).length, 1);
      assert.notEqual(choices[q.correct].divisionLabel, q.divisionLabel);
      assert.equal(choices.filter(t => t.divisionLabel === q.divisionLabel).length, 3);
    } else {
      assert.equal(q.teamOptions.length, 4);
      q.teamOptions.forEach((option, i) => {
        const representative = byId.get(option.id);
        assert.equal(representative.location, q.a[i]);
        assert.equal(option.name, q.a[i]);
        assert.equal(option.logo, representative.logo_data);
        if(i === q.correct) assert.equal(representative.divisionLabel, q.divisionLabel);
        else assert.notEqual(representative.divisionLabel, q.divisionLabel);
      });
      const locations = new Set(teams.filter(t => t.divisionLabel === q.divisionLabel).map(t => t.location).filter(Boolean));
      assert.equal(q.a.filter(location => locations.has(location)).length, 1);
      assert.ok(locations.has(q.a[q.correct]));
      assert.ok(q.a.every(location => teams.some(t => t.location === location)));
    }
  }
}
assert.equal(seen.size, 30);
assert.equal(positions.size, 4);
assert.equal(variants.size, 500);
assert.ok(mixes.size > 20);
for (const value of [0, .25, .5, .75, .999999]) {
  const round = generateRound(teams, () => value);
  assert.equal(round.length, 20);
  for (const type of [1, 2, 3, 4]) assert.ok(round.some(q => q.type === type));
}
console.log('Passed: 500 generated rounds, random mixes with all four types guaranteed, unambiguous choices, all 30 teams, local logos, and shuffled answer positions.');
