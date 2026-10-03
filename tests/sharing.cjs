const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(href, clipboard, legacyCopy = false) {
  const elements = new Map();
  let now = 1000, fallbackText = '', temporaryFields = 0;
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      innerHTML: '', textContent: '', value: '', hidden: true, disabled: false,
      complete: true, naturalWidth: 200, style: {}, handlers: {},
      focus() {}, select() { this.selected = true; }, setAttribute() {},
      addEventListener(type, handler) { this.handlers[type] = handler; },
      querySelectorAll() { return []; }, classList: { toggle() {} }
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    URL, window: { location: { href } }, navigator: { clipboard },
    performance: { now: () => now }, setInterval: () => 1, clearInterval() {},
    document: {
      getElementById: element,
      createElement() { const field = element('temporary-field'); field.remove = () => temporaryFields--; return field; },
      body: { appendChild(field) { fallbackText = field.value; temporaryFields++; } },
      execCommand(command) { assert.equal(command, 'copy'); return legacyCopy; }
    }
  });
  for (const file of ['teams.js', 'questions.js', 'game.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist', file), 'utf8'), context);
  return {
    run: code => vm.runInContext(code, context), element,
    complete() {
      this.run("startQuiz('friends 42 & café')");
      for (let i = 0; i < 20; i++) { now += 15000; this.run(`answer(questions[${i}].correct);next()`); }
    },
    fallbackText: () => fallbackText, temporaryFields: () => temporaryFields
  };
}

(async () => {
  let copied = '';
  const t = setup('https://example.github.io/baseball-quiz/?v=old#results', { async writeText(text) { copied = text; } });
  await assert.rejects(t.run('shareScore()'), /Finish the quiz/);
  t.complete();
  assert.match(t.element('game').innerHTML, /id="share-score"/);
  await t.element('share-score').handlers.click();
  assert.match(copied, /^I scored 10,000\/20,000 points \(20\/20 correct\) on this MLB quiz—can you beat my score\?/);
  const link = new URL(copied.split('\n\n')[1]);
  assert.equal(link.origin, 'https://example.github.io');
  assert.equal(link.pathname, '/baseball-quiz/');
  assert.equal(link.searchParams.get('seed'), 'friends 42 & café');
  assert.equal(link.searchParams.has('v'), false);
  assert.equal(link.hash, '');
  assert.equal(t.element('share-status').textContent, 'Score and link copied!');
  assert.equal(t.element('share-score').disabled, false);

  const friend = setup(link.href);
  assert.equal(friend.element('seed-input').value, 'friends 42 & café');
  friend.run("startQuiz(document.getElementById('seed-input').value)");
  assert.equal(friend.run('JSON.stringify(questions)'), t.run('JSON.stringify(questions)'));

  const legacy = setup('http://localhost:8000/index.html', undefined, true);
  legacy.complete();await legacy.run('shareScore()');
  assert.match(legacy.fallbackText(), /http:\/\/localhost:8000\/index.html\?seed=/);
  assert.equal(legacy.temporaryFields(), 0);
  assert.equal(legacy.element('share-status').textContent, 'Score and link copied!');

  const denied = setup('https://example.com/quiz/', { async writeText() { throw Error('Denied'); } });
  denied.complete();await denied.run('shareScore()');
  assert.equal(denied.element('share-message').hidden, false);
  assert.equal(denied.element('share-message').selected, true);
  assert.equal(denied.element('share-message').value, denied.run('shareMessage()'));
  assert.equal(denied.element('share-score').disabled, false);
  assert.equal(denied.temporaryFields(), 0);
  assert.equal(setup('https://example.com/?seed=' + 'x'.repeat(81)).element('seed-input').value, '');
  console.log('Passed: final score sharing, clipboard success and failure, inferred hosted/local URLs, encoded seed, and identical friend quiz.');
})().catch(error => { console.error(error); process.exitCode = 1; });
