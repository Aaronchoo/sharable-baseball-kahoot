const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../dist/game.js'), 'utf8');
function setup(autoStart=true) {
  let now = 1000, nextId = 0;
  const timers = new Map(), elements = new Map(), buttons = [];
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      innerHTML: '', textContent: '', complete: true, naturalWidth: 200, handlers: {}, focus() {},
      addEventListener(type, handler) { this.handlers[type] = handler; },
      setAttribute() {}, classList: { toggle() {} },
      querySelectorAll() {
        if (buttons.length) return buttons;
        for (let i = 0; i < 4; i++) buttons.push({
          dataset: { answer: String(i) },
          addEventListener(type, handler) { this.click = handler; }
        });
        return buttons;
      }
    });
    return elements.get(id);
  }
  const context = vm.createContext({
    performance: { now: () => now, timeOrigin: 1700000000000 },
    crypto: { getRandomValues(array) { for(let i=0;i<array.length;i++)array[i]=++nextId;return array; } },
    // Wall-clock changes must never affect the quiz.
    Date: { now() { throw new Error('Wall clock used for scoring'); } },
    setInterval(fn) { timers.set(++nextId, fn); return nextId; },
    clearInterval(id) { timers.delete(id); },
    document: { getElementById: element }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/teams.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/questions.js'), 'utf8'), context);
  vm.runInContext(source, context);
  if(autoStart) vm.runInContext("startQuiz('timing-test')",context);
  return {
    run: code => vm.runInContext(code, context),
    advance(ms) { now += ms; },
    tick() { [...timers.values()].forEach(fn => fn()); },
    html: () => element('game').innerHTML,
    click(option, timestamp) { buttons[option].click({ timeStamp: timestamp }); },
    clockCount: () => timers.size,
    element
  };
}

let t = setup();
for (const [milliseconds, points] of [[30000,1000],[22500,750],[15000,500],[3000,100],[15,1],[14,0],[0,0],[-1,0],[31000,1000]]) {
  assert.equal(t.run(`pointsForTime(${milliseconds})`), points);
}
assert.equal(t.run('formatTime(30000)'), '30');
assert.equal(t.run('formatTime(29901)'), '30');
assert.equal(t.run('formatTime(1)'), '1');
assert.equal(t.run('formatTime(0)'), '0');

// No display callback is needed for precise, proportional scoring.
t.advance(15000);
assert.equal(t.run('state().secondsRemaining'), 15);
t.run('answer(questions[0].correct)');
assert.equal(t.run('score()'), 500);
assert.match(t.html(), /id="feedback-score">500 <small>points/);
assert.match(t.html(), /\+500 points/);
assert.throws(() => t.run('answer(1)'), /not accepting/);
assert.equal(t.run('score()'), 500);
t.run('next()');
t.advance(15123.456);
t.run('answer(questions[1].correct)');
assert.equal(t.run('points[1]'), Math.round(1000 * (30000 - 15123.456) / 30000));

// Tick jitter must not change the result for the same response time.
t = setup();
t.advance(14200); t.tick(); t.advance(800);
t.run('answer(questions[0].correct)');
assert.equal(t.run('score()'), 500);

// Preserve fractional milliseconds through pause/resume and ignore paused time.
t = setup();
t.advance(5250.25); t.run('toggleTimer()');
t.advance(60000); t.run('toggleTimer()');
t.advance(9749.75); t.run('answer(questions[0].correct)');
assert.equal(t.run('score()'), 500);

// The input event timestamp, rather than a later dispatch time, drives UI scoring.
t = setup(); t.advance(15500);
t.click(t.run('questions[0].correct'), 16000); // Created at 15s; dispatched at 15.5s.
assert.equal(t.run('score()'), 500);
t = setup(); t.advance(15500);
t.click(t.run('questions[0].correct'), 1700000016000); // Equivalent legacy epoch-based event timestamp.
assert.equal(t.run('score()'), 500);
t = setup(); t.advance(15000);
assert.equal(t.run('inputTime({timeStamp: Infinity})'), 16000);
assert.equal(t.run('inputTime({timeStamp: 900})'), 16000);

// Both sides of the exact deadline; the timer need not have fired yet.
t = setup(); t.advance(29999.5);
t.run('answer(questions[0].correct)');
assert.equal(t.run('correctCount()'), 1);
assert.equal(t.run('score()'), 0); // Fractional point rounds to zero.
t = setup(); t.advance(30000);
assert.throws(() => t.run('answer(1)'), /expired/);
assert.equal(t.run('choices[0]'), null);
assert.equal(t.run('score()'), 0);
assert.match(t.html(), /Time’s up!/);
t = setup(); t.advance(45000); t.tick(); t.tick();
assert.equal(t.run('choices.length'), 1);
assert.equal(t.run('points.length'), 1);
assert.equal(t.clockCount(), 0);
t = setup(); t.advance(30000); t.run('toggleTimer()');
assert.equal(t.run('choices[0]'), null);

// Incorrect answers, final totals, and replay are independent of timing precision.
t = setup(); t.advance(15000); t.run('answer((questions[0].correct+1)%4)');
assert.equal(t.run('score()'), 0);
t = setup();
for (let i = 0; i < 20; i++) {
  t.advance(15000); t.run(`answer(questions[${i}].correct)`); t.run('next()');
}
assert.equal(t.run('score()'), 10000);
assert.equal(t.run('correctCount()'), 20);
assert.match(t.html(), /10000 points/);
assert.match(t.html(), /20 of 20 questions/);
t.run('restart()');
assert.equal(t.run('score()'), 0);
assert.equal(t.run('choices.length'), 0);
assert.equal(t.run('state().secondsRemaining'), 30);
console.log('Passed: proportional scoring, fractional timing, input timestamps, pause/resume, timer jitter, exact deadline, timeout, total score, and replay.');

// Logos finish loading before any answer or scoring clock is enabled.
t = setup();
t.element('team-logo').complete = false;
t.run("questions[0]={...questions.find(q=>q.type===1),logo:'logos/147.svg'}; prepareQuestion()");
assert.equal(t.clockCount(), 0);
t.advance(10000);
assert.equal(t.run('state().secondsRemaining'), 30);
assert.equal(t.run('state().awaitingAnswer'), false);
assert.throws(() => t.run('answer(0)'), /still loading/);
t.element('team-logo').complete = true;
t.element('team-logo').handlers.load();
assert.equal(t.clockCount(), 1);
t.advance(15000);t.run('answer(questions[0].correct)');
assert.equal(t.run('score()'), 500);
console.log('Passed: logo loading does not consume response time.');

// A four-team grid waits for every logo, and its order matches the answers.
t = setup();
t.run('questions[0]=questions.find(q=>q.type===3)');
for(let i=0;i<4;i++)t.element('question-logo-'+i).complete=false;
t.run('prepareQuestion()');
assert.match(t.html(), /class="team-grid"/);
assert.equal((t.html().match(/id="question-logo-/g)||[]).length,4);
assert.doesNotMatch(t.html(), /class="wordmark"/);
for(let i=0;i<3;i++){t.element('question-logo-'+i).complete=true;t.element('question-logo-'+i).handlers.load();}
assert.equal(t.clockCount(),0);
t.advance(10000);assert.equal(t.run('state().secondsRemaining'),30);
t.element('question-logo-3').naturalWidth=0;
t.element('question-logo-3').handlers.error();
assert.equal(t.clockCount(),1);
t.advance(15000);t.run('answer(questions[0].correct)');
assert.equal(t.run('score()'),500);
assert.equal((t.html().match(/id="question-logo-/g)||[]).length,4);
console.log('Passed: 2x2 logo grid and timing waits for all four images, including failed loads.');

// Answer and timeout feedback must retain every team picture.
t = setup();
t.run('questions[0]=questions.find(q=>q.type===3); prepareQuestion()');
t.advance(30000);t.tick();
assert.match(t.html(), /Time’s up!/);
assert.equal((t.html().match(/id="question-logo-/g)||[]).length,4);
console.log('Passed: all four logos remain visible after an answer or timeout.');

// Legacy questions without image metadata still show the four answer-team logos.
t = setup();
t.run("questions[0]=questions.find(q=>q.type===3); delete questions[0].teamOptions; prepareQuestion()");
assert.equal((t.html().match(/id="question-logo-/g)||[]).length,4);
assert.doesNotMatch(t.html(), /class="wordmark"/);
assert.ok(t.run("questions[0].teamOptions.every(team=>team.logo.startsWith('data:image/svg+xml;base64,'))"));
console.log('Passed: four-logo grid is recovered directly from legacy answer choices.');

// Seeds are entered before the clock starts; replay reproduces the entire round.
t=setup(false);
assert.match(t.html(),/id="seed-input"/);
assert.equal(t.clockCount(),0);
assert.equal(t.run('state().started'),false);
assert.equal(t.run('state().finished'),false);
t.element('seed-input').value='  world-series  ';
t.element('start-form').handlers.submit({preventDefault(){}});
assert.equal(t.run('currentSeed'),'world-series');
assert.equal(t.run('questions.length'),20);
const original=t.run("JSON.stringify(questions.map(q=>[q.type,q.q,q.a,q.correct]))");
t.advance(15000);t.run('answer(questions[0].correct)');
t.run('restart()');
assert.equal(t.run("JSON.stringify(questions.map(q=>[q.type,q.q,q.a,q.correct]))"),original);
assert.equal(t.run('score()'),0);
assert.equal(t.run('choices.length'),0);
assert.equal(t.run('state().secondsRemaining'),30);
const before=t.run('currentSeed');
assert.throws(()=>t.run("startQuiz('x'.repeat(81))"),/80 characters/);
assert.equal(t.run('currentSeed'),before);
assert.equal(t.clockCount(),1);
t.run("startQuiz('')");
assert.ok(t.run('currentSeed.length>0'));
const randomRound=t.run("JSON.stringify(questions.map(q=>[q.type,q.q,q.a,q.correct]))");
t.run('restart()');
assert.equal(t.run("JSON.stringify(questions.map(q=>[q.type,q.q,q.a,q.correct]))"),randomRound);
console.log('Passed: start-page seed submission, idle timer, identical replay, generated seed, and invalid-seed handling.');

// City-in-division questions use a four-logo grid before and after timeout.
t=setup();
t.run('questions[0]=questions.find(q=>q.type===4); delete questions[0].teamOptions; prepareQuestion()');
assert.equal((t.html().match(/id="question-logo-/g)||[]).length,4);
assert.doesNotMatch(t.html(), /class="wordmark"/);
assert.ok(t.run('questions[0].teamOptions.every((option,i)=>option.name===questions[0].a[i])'));
t.advance(30000);t.tick();
assert.equal((t.html().match(/id="question-logo-/g)||[]).length,4);
console.log('Passed: city-in-division questions show all four representative logos, including after timeout.');
