const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function engine() {
  const context = vm.createContext({});
  for (const file of ['teams.js', 'questions.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist', file), 'utf8'), context);
  return {
    round(seed) { return context.BaseballQuestions.generateSeededRound(context.MLB_TEAMS, seed); },
    random(seed) { return context.BaseballQuestions.createSeededRandom(seed); }
  };
}
const first = engine(), second = engine();
const signatures = new Set();
for (const seed of ['0', '12345', 'World Series', 'world series', '⚾', 'é', '<script>']) {
  const a = JSON.stringify(first.round(seed));
  assert.equal(a, JSON.stringify(first.round(seed)));
  assert.equal(a, JSON.stringify(second.round(seed))); // Independent page/environment.
  signatures.add(a);
  const randomA = first.random(seed), randomB = second.random(seed);
  for (let i = 0; i < 1000; i++) {
    const value = randomA();
    assert.equal(value, randomB());
    assert.ok(value >= 0 && value < 1);
  }
}
assert.equal(signatures.size, 7);
assert.equal(JSON.stringify(first.round('  hello  ')), JSON.stringify(first.round('hello')));
assert.equal(JSON.stringify(first.round('e\u0301')), JSON.stringify(first.round('é')));
assert.throws(() => first.round(''), /between 1 and 80/);
assert.throws(() => first.round('x'.repeat(81)), /between 1 and 80/);
assert.throws(() => first.round(123), /must be text/);
for (let i = 0; i < 200; i++) {
  const questions = first.round('seed-' + i);
  assert.equal(questions.length, 20);
  for (const type of [1, 2, 3, 4]) assert.ok(questions.some(q => q.type === type));
}
console.log('Passed: seeded rounds match across independent environments, exact ordering and distractors, seed normalization, validation, and all four question types.');
