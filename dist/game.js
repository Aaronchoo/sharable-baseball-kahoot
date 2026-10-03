'use strict';
let questions=[], currentSeed='', hasStarted=false;
const QUESTION_MS=30000, MAX_POINTS=1000;
let index=0, choices=[], points=[], remainingMs=QUESTION_MS, paused=false, deadline=0, activeSince=0, clock=null, questionReady=false;
const game=document.getElementById('game');
const shapes=['triangle','diamond','circle','square'];
const score=()=>points.reduce((total,value)=>total+value,0);
const correctCount=()=>choices.reduce((n,a,i)=>n+(a===questions[i].correct?1:0),0);
const answered=()=>choices.length>index;
function timeLeft(at=performance.now()){
 return !questionReady||paused||answered()||index>=questions.length?remainingMs:Math.max(0,Math.min(QUESTION_MS,deadline-at));
}
function pointsForTime(millisecondsLeft){
 return Math.round(MAX_POINTS*Math.max(0,Math.min(QUESTION_MS,millisecondsLeft))/QUESTION_MS);
}
// Show whole seconds only; scoring uses the unrounded milliseconds.
function formatTime(millisecondsLeft){return String(Math.ceil(millisecondsLeft/1000));}
function stopClock(){if(clock!==null)clearInterval(clock);clock=null;}
function expire(){
 if(index>=questions.length||answered())return;
 stopClock();remainingMs=0;choices.push(null);points.push(0);render(true);
}
function startClock(){
 stopClock();
 if(!questionReady||paused||index>=questions.length||answered())return;
 activeSince=performance.now();deadline=activeSince+remainingMs;
 clock=setInterval(()=>{
  const left=timeLeft(performance.now());
  const badge=document.getElementById('timer');
  if(badge){badge.textContent=formatTime(left);badge.classList.toggle('urgent',left<=5000);badge.setAttribute('aria-label',formatTime(left)+' seconds remaining');}
  if(left===0)expire();
 },50);
}
// Use the browser's input timestamp when it shares the performance clock's origin.
// This prevents a queued click from losing points merely due to dispatch delay.
function inputTime(event){
 const now=performance.now();
 let at=event.timeStamp;
 if(at>now&&Number.isFinite(performance.timeOrigin))at-=performance.timeOrigin;
 return Number.isFinite(at)&&at>=activeSince&&at<=now?at:now;
}
function toggleTimer(){
 if(!questionReady||index>=questions.length||answered())return;
 const now=performance.now();
 if(!paused){remainingMs=timeLeft(now);if(remainingMs===0){expire();return;}}
 paused=!paused;render();startClock();
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function newSeed(){return Array.from(crypto.getRandomValues(new Uint32Array(2)), value=>value.toString(36)).join('-');}
function seedFromUrl(){
 try{return BaseballQuestions.normalizeSeed(new URL(window.location.href).searchParams.get('seed')||'');}catch{return '';}
}
function shareMessage(){
 const url=new URL(window.location.href);
 url.search='';url.hash='';url.searchParams.set('seed',currentSeed);
 return `I scored ${score().toLocaleString('en-US')}/${(questions.length*MAX_POINTS).toLocaleString('en-US')} points (${correctCount()}/${questions.length} correct) on this MLB quiz—can you beat my score?\n\n${url.href}`;
}
function copyWithSelection(text){
 const field=document.createElement('textarea');
 field.value=text;field.setAttribute('readonly','');
 field.style.position='fixed';field.style.opacity='0';
 document.body.appendChild(field);field.select();
 try{return document.execCommand('copy');}catch{return false;}finally{field.remove();}
}
async function shareScore(){
 if(!hasStarted||index!==questions.length)throw Error('Finish the quiz before sharing your score.');
 const message=shareMessage(),button=document.getElementById('share-score'),status=document.getElementById('share-status');
 button.disabled=true;
 let copied=false;
 try{
  if(typeof navigator!=='undefined'&&navigator.clipboard?.writeText){
   try{await navigator.clipboard.writeText(message);copied=true;}catch{}
  }
  if(!copied)copied=copyWithSelection(message);
  if(copied){status.textContent='Score and link copied!';document.getElementById('share-message').hidden=true;button.focus({preventScroll:true});}
  else{
   const field=document.getElementById('share-message');field.value=message;field.hidden=false;field.focus();field.select();
   status.textContent='Select and copy the message below to share your score.';
  }
 }finally{button.disabled=false;}
}
function renderStart(seed=currentSeed){
 stopClock();questionReady=false;hasStarted=false;
 game.innerHTML=`<section class="start-screen"><div class="wordmark">Baseball!</div><h1 id="question">MLB team quiz</h1><p>${BaseballQuestions.ROUND_LENGTH} questions · All four question types</p><form id="start-form"><label for="seed-input">Quiz seed <span>(optional)</span></label><input id="seed-input" name="seed" type="text" maxlength="80" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="seed-help"><p id="seed-help">Same seed, same questions. Leave blank for a new quiz.</p><button class="primary" type="submit">Play</button><p id="start-error" role="alert"></p></form></section>`;
 document.getElementById('seed-input').value=seed;
 document.getElementById('start-form').addEventListener('submit',event=>{
  event.preventDefault();
  try{startQuiz(document.getElementById('seed-input').value);}catch(error){document.getElementById('start-error').textContent=error.message;}
 });
}
function startQuiz(seed=''){
 if(typeof seed!=='string')throw Error('The seed must be text.');
 const value=BaseballQuestions.normalizeSeed(seed.trim()?seed:newSeed());
 const round=BaseballQuestions.generateSeededRound(MLB_TEAMS,value);
 stopClock();currentSeed=value;questions=round;hasStarted=true;index=0;choices=[];points=[];paused=false;remainingMs=QUESTION_MS;
 prepareQuestion(true);return state();
}
function bottomBar(){return `<div class="progress" aria-hidden="true"><span style="width:${choices.length/questions.length*100}%"></span></div><footer class="bottom-bar"><span>${Math.min(index+1,questions.length)} / ${questions.length}</span><span class="seed-status">Seed: <span>${escapeHtml(currentSeed)}</span></span><div class="player-info"><span>You</span><span class="bottom-score" aria-label="${score()} points">${score()}</span></div></footer>`;}
function hydrateQuestion(q){
 if(q.type===4||q.category==='CITY IN THE DIVISION'){
  const teams=q.a.map(location=>MLB_TEAMS.find(team=>team.location===location&&team.divisionLabel===q.divisionLabel)||MLB_TEAMS.find(team=>team.location===location));
  if(teams.every(Boolean))q.teamOptions=teams.map((team,i)=>({id:team.id,name:q.a[i],alt:`${team.nickname} logo representing ${q.a[i]}`,logo:team.logo_data}));
 }
 if(q.type===3||q.category==='ODD TEAM OUT'){
  const teams=q.a.map(name=>MLB_TEAMS.find(team=>team.team===name||team.nickname===name));
  if(teams.every(Boolean))q.teamOptions=teams.map(team=>({id:team.id,name:team.nickname,logo:team.logo_data}));
 }
 return q;
}
function questionMedia(q){
 return `<div class="question-media">${q.teamOptions?`<div class="team-grid" aria-label="Team choices in answer order">${q.teamOptions.map((team,i)=>`<figure class="team-grid-item option-${i}"><span class="shape ${shapes[i]}" aria-hidden="true"></span><img id="question-logo-${i}" src="${team.logo}" alt="${team.alt||team.name+' logo'}" width="110" height="80"><figcaption>${team.name}</figcaption></figure>`).join('')}</div>`:q.logo?`<div class="logo-panel"><img id="team-logo" src="${q.logo}" alt="${q.caption||q.teamName} logo" width="200" height="160"></div><p class="team-caption">${q.caption||q.teamName}</p>`:'<div class="wordmark">Baseball!</div>'}<p class="stage-subtitle">${q.category} · Up to 1,000 points</p></div>`;
}
function render(focus=false){
 if(index===questions.length){renderFinish(focus);return;}
 const q=hydrateQuestion(questions[index]),done=answered(),selected=choices[index],correct=done&&selected===q.correct;
 game.innerHTML=`<header class="question-header"><h1 id="question" tabindex="-1">${q.q}</h1></header>
 <section class="stage" aria-label="Question ${index+1}">
 <div class="timer-group"><div class="timer ${!paused&&remainingMs<=5000?'urgent':''}" id="timer" role="timer" aria-label="${paused?'Timer paused':formatTime(remainingMs)+' seconds remaining'}">${paused?'∞':formatTime(remainingMs)}</div>${done?'':`<button class="timer-control" id="pause" aria-pressed="${paused}">${paused?'Resume timer':'Pause timer'}</button>`}</div>
 <div class="stage-center ${done&&q.teamOptions?'result-with-grid':''}">${done?`<div class="feedback" role="status"><span class="verdict ${correct?'':'incorrect'}" aria-hidden="true">${correct?'✓':'×'}</span><strong>${correct?'Correct!':selected===null?'Time’s up!':'Incorrect'}</strong><div class="score-summary"><span>Your score</span><span class="score-value" id="feedback-score">${score()} <small>points</small></span><span class="score-gain">+${points[index]} points</span></div><p>${q.why}</p><button class="primary" id="next">${index===questions.length-1?'See results':'Next'}</button></div>`:''}${!done||q.teamOptions?questionMedia(q):''}</div>
 <div class="answer-count"><strong>${done&&selected!==null?'1':'0'}</strong><span>${done&&selected!==null?'Answer':'Answers'}</span></div></section>
 <div class="answers" aria-label="Answer choices">${q.a.map((a,i)=>`<button class="answer ${done?(i===q.correct?'correct':i===selected?'wrong':'dim'):''}" data-answer="${i}" ${done||!questionReady?'disabled':''}><span class="shape ${shapes[i]}" aria-hidden="true"></span><span class="answer-text">${a}</span>${done&&i===q.correct?'<span class="answer-result" aria-hidden="true">✓</span><span class="sr-only">Correct answer</span>':done&&i===selected?'<span class="answer-result" aria-hidden="true">×</span><span class="sr-only">Your incorrect answer</span>':''}</button>`).join('')}</div>${bottomBar()}`;
 game.querySelectorAll('[data-answer]').forEach(b=>b.addEventListener('click',event=>answer(Number(b.dataset.answer),inputTime(event))));
 document.getElementById('next')?.addEventListener('click',next);
 document.getElementById('pause')?.addEventListener('click',toggleTimer);
 if(focus)document.getElementById(done?'next':'question').focus({preventScroll:true});
}
function answer(option,answeredAt=performance.now()){
 if(!questionReady)throw Error('This question is still loading.');
 if(index>=questions.length||answered())throw Error('This question is not accepting answers.');
 if(!Number.isInteger(option)||option<0||option>3)throw Error('Choose an answer from 0 to 3.');
 // Capture time once for both deadline enforcement and points calculation.
 const left=timeLeft(answeredAt);
 if(left===0){expire();throw Error('Time has expired for this question.');}
 remainingMs=left;
 const earned=option===questions[index].correct?pointsForTime(left):0;
 stopClock();choices.push(option);points.push(earned);render(true);return state();
}
function next(){if(choices.length<=index||index>=questions.length)throw Error('Answer the current question before advancing.');index++;remainingMs=QUESTION_MS;prepareQuestion(true);return state();}
function restart(){return startQuiz(currentSeed);}
function state(){return{seed:currentSeed||null,started:hasStarted,inning:hasStarted&&hasStarted&&index<questions.length?index+1:null,finished:hasStarted&&index===questions.length,score:score(),correctAnswers:correctCount(),lastQuestionPoints:points.length?points[points.length-1]:null,answered:choices.length,question:hasStarted&&index<questions.length?questions[index].q:null,options:hasStarted&&index<questions.length?questions[index].a:null,awaitingAnswer:questionReady&&index<questions.length&&!answered(),questionType:hasStarted&&index<questions.length?questions[index].type:null,teamName:hasStarted&&index<questions.length?questions[index].teamName||null:null,logo:hasStarted&&index<questions.length?questions[index].logo||null:null,optionLogos:hasStarted&&index<questions.length?questions[index].teamOptions||null:null,timerPaused:paused,secondsRemaining:timeLeft()/1000};}
function renderFinish(focus){
 stopClock();const hits=correctCount();
 game.innerHTML=`<section class="finish"><div class="wordmark">Baseball!</div><h1 id="question" tabindex="-1">${hits===questions.length?'Perfect game!':hits>=questions.length*2/3?'Well played!':'Keep practicing!'}</h1><p>You answered ${hits} of ${questions.length} questions correctly.</p><div class="podium"><div class="podium-place">1</div><div class="podium-name">You</div><div class="podium-score">${score()} points</div></div><p class="round-seed">Seed: <code>${escapeHtml(currentSeed)}</code></p><div class="replay-actions"><button class="secondary" id="share-score">Share score</button><button class="primary" id="replay">Play again</button><button class="secondary" id="change-seed">Change seed</button></div><p id="share-status" role="status" aria-live="polite"></p><textarea id="share-message" readonly hidden rows="4" aria-label="Score and quiz link to copy"></textarea><details class="review"><summary>Review answers</summary>${questions.map((q,i)=>`<div class="review-row"><strong><span class="review-tag ${choices[i]===q.correct?'':'out'}">${choices[i]===q.correct?'✓':'×'}</span>${i+1}. ${q.q}</strong><p>${choices[i]===q.correct?'Correct: '+q.a[q.correct]:'Your answer: '+(choices[i]===null?'Timed out':q.a[choices[i]])+' · Correct: '+q.a[q.correct]}</p><p>${q.why}</p><p>+${points[i]} points</p></div>`).join('')}</details></section>${bottomBar()}`;
 document.getElementById('replay').addEventListener('click',restart);
 document.getElementById('share-score').addEventListener('click',shareScore);
 document.getElementById('change-seed').addEventListener('click',()=>{renderStart();document.getElementById('seed-input').focus();});
 if(focus)document.getElementById('question').focus({preventScroll:true});
}
function prepareQuestion(focus=false){
 stopClock();questionReady=false;render(focus);
 if(index>=questions.length)return;
 const q=questions[index];
 const images=q.teamOptions?q.teamOptions.map((_,i)=>document.getElementById('question-logo-'+i)):
  q.logo?[document.getElementById('team-logo')]:[];
 const pending=new Set(images.filter(image=>!image.complete));
 const begin=()=>{
  if(pending.size||questions[index]!==q||answered()||questionReady)return;
  images.forEach(image=>{if(image.naturalWidth===0)image.hidden=true;});
  questionReady=true;
  game.querySelectorAll('[data-answer]').forEach(button=>button.disabled=false);
  startClock();
 };
 // All visible team logos must settle before the scoring clock starts.
 for(const image of pending){
  const settled=()=>{pending.delete(image);begin();};
  image.addEventListener('load',settled,{once:true});
  image.addEventListener('error',settled,{once:true});
 }
 begin();
}
renderStart(seedFromUrl());
if(document.modelContext?.registerTool){
 const defs=[{name:'start_baseball_quiz',description:'Start a 20-question quiz using a text seed, or generate a new seed if blank. The same seed reproduces the same questions and choices.',inputSchema:{type:'object',properties:{seed:{type:'string',maxLength:80}},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>startQuiz(input?.seed??'')},
 {name:'get_baseball_quiz_state',description:'Read the current question, answer options, score and timer.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>state()},
 {name:'answer_baseball_question',description:'Submit one answer for the current question. answerIndex is zero-based.',inputSchema:{type:'object',properties:{answerIndex:{type:'integer',minimum:0,maximum:3}},required:['answerIndex'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>answer(input?.answerIndex)},
 {name:'advance_baseball_inning',description:'Advance after an answered or timed-out question, or show results after the final question.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:()=>next()},
 {name:'restart_baseball_quiz',description:'Replay the current seed with the same questions and zero points.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:()=>restart()}];
 for(const def of defs){try{Promise.resolve(document.modelContext.registerTool(def)).catch(()=>{});}catch{}}
}
