const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../dist');
const source = ['teams.js', 'questions.js', 'game.js'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n;\n');
fs.writeFileSync(path.join(root, 'quiz.js'), source);
console.log('Built quiz.js with matching team data, question generator, and game logic.');
