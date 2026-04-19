// Main app orchestrator
import State from './state.js';
import { loadQuestions, getCurrentQuestion, answerQuestion } from './questions.js';
import * as Bridge from './bridge.js';

let categories = null;

// ===== INIT =====
async function init() {
    const res = await fetch('data/categories.json');
    categories = (await res.json()).categories;

    Bridge.init(document.getElementById('bg'), onRaceComplete);
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('category');
    if (cat && categories.find(c => c.id === cat)) openCategory(cat);
    else showHub();
}

// ===== SCREENS =====
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
    const el = document.getElementById(id);
    if (el) el.classList.add('on');
    updateNav();
}

function updateNav() {
    const home = document.getElementById('navHome');
    const back = document.getElementById('navBack');
    const f = State.flow;
    // Hub: no buttons. Race: no buttons (game takes over)
    const showNav = f !== 'hub';
    home.classList.toggle('on', showNav);
    back.classList.toggle('on', showNav && f !== 'results');
}

function goBack() {
    const f = State.flow;
    // Clean up
    document.getElementById('bg').classList.remove('dimmed');
    document.getElementById('boost').style.display = 'none';
    document.body.classList.remove('racing');
    Bridge.loadBackground('about:blank');

    if (f === 'category') showHub();
    else if (f === 'questions') openCategory(State.categoryId);
    else if (f === 'results') showHub();
    else showHub();
}

// ===== HUB =====
function showHub() {
    State.flow = 'hub';
    document.getElementById('bg').classList.remove('dimmed');
    document.getElementById('boost').style.display = 'none';
    document.getElementById('rb').style.display = 'none';
    document.body.classList.remove('racing');
    Bridge.loadBackground('about:blank');

    const progress = State.getProgress();
    const grid = document.getElementById('hubGrid');
    grid.innerHTML = categories.map(cat => {
        const hasGames = cat.games.length > 0;
        const cls = hasGames ? 'hub-card' : 'hub-card locked';
        return `<div class="${cls}" ${hasGames ? `onclick="app.openCategory('${cat.id}')"` : ''}>
            <div class="hub-emoji">${cat.emoji}</div>
            <div class="hub-name">${cat.name}</div>
            <div class="hub-desc">${cat.description}</div>
            ${!hasGames ? '<div class="hub-soon">בקרוב!</div>' : ''}
        </div>`;
    }).join('');

    showScreen('hub');
    document.getElementById('boost').style.display = 'none';
    document.body.classList.remove('racing');
}

// ===== CATEGORY (game list) =====
function openCategory(catId) {
    const cat = categories.find(c => c.id === catId);
    if (!cat || cat.games.length === 0) return;

    // Show game selection
    State.flow = 'category';
    State.categoryId = catId;

    const list = document.getElementById('gameList');
    list.innerHTML = `<div class="games-title">${cat.emoji} ${cat.name}</div>` +
        cat.games.map(g => `
            <div class="game-card" onclick="app.startGame('${catId}', '${g.id}')">
                <span class="game-emoji">${g.emoji}</span>
                <div>
                    <div class="game-name">${g.name}</div>
                    <div class="game-desc">${g.description}</div>
                </div>
            </div>`).join('') +
        `<div class="back-btn" onclick="app.showHub()">→ חזרה</div>`;

    showScreen('category');
}

// ===== START GAME =====
async function startGame(catId, gameId) {
    const cat = categories.find(c => c.id === catId);
    const game = cat.games.find(g => g.id === gameId);
    if (!game) return;

    State.reset();
    State.categoryId = catId;
    State.gameId = game.id;
    State.gamePath = game.gamePath;

    if (game.type === 'direct-game') {
        State.flow = 'race';
        document.getElementById('bg').classList.remove('dimmed');
        showScreen('');
        document.body.classList.add('racing');
        Bridge.startRace(game.gamePath);
        return;
    }

    // questions-then-race
    State.bgPath = game.bgPath;
    State.flow = 'questions';

    Bridge.loadBackground(game.bgPath);
    await loadQuestions('data/' + game.questionsFile);

    document.getElementById('bg').classList.add('dimmed');
    showScreen('questions');
    document.getElementById('boost').style.display = 'flex';
    renderQuestion();
}

// ===== QUESTIONS =====
function renderQuestion() {
    const q = getCurrentQuestion();
    if (!q) return;

    document.getElementById('qNum').textContent = `${State.questionIndex + 1} / ${State.questions.length}`;
    document.getElementById('qBar').style.width = (State.questionIndex / State.questions.length * 100) + '%';
    document.getElementById('qSit').textContent = q.situation;
    document.getElementById('qFb').className = 'qfb';

    const flip = Math.random() > 0.5;
    const opts = flip
        ? [{ t: 'g', ...q.green }, { t: 'r', ...q.red }]
        : [{ t: 'r', ...q.red }, { t: 'g', ...q.green }];

    document.getElementById('qOpts').innerHTML = opts.map((o, i) =>
        `<div class="qo" data-t="${o.t}" data-fb="${encodeURIComponent(o.feedback)}" onclick="app.pick(this)">
            <span class="letter">${['א', 'ב'][i]}</span>
            <span class="icon">${o.t === 'g' ? '📗' : '📕'}</span>
            <span>${o.text}</span>
        </div>`).join('');

    updateBoost();
}

function pick(el) {
    const ok = el.dataset.t === 'g';
    const done = answerQuestion(ok);

    // Reveal all
    document.querySelectorAll('.qo').forEach(o => {
        o.classList.add('off');
        o.classList.add(o.dataset.t === 'g' ? 'show-green' : 'show-red');
    });
    el.classList.add(ok ? 'chosen-right' : 'chosen-wrong');
    el.classList.remove('off');

    const fb = document.getElementById('qFb');
    fb.textContent = decodeURIComponent(el.dataset.fb);
    fb.className = 'qfb on ' + (ok ? 'ok' : 'bad');

    updateBoost();

    setTimeout(() => {
        if (done) {
            startRace();
        } else {
            renderQuestion();
        }
    }, 2000);
}

function updateBoost() {
    const pct = State.getScorePct();
    document.getElementById('bFill').style.width = pct + '%';
    document.getElementById('bPct').textContent = pct + '%';
}

// ===== RACE =====
function startRace() {
    State.flow = 'race';
    document.getElementById('boost').style.display = 'none';
    document.getElementById('bg').classList.remove('dimmed');
    showScreen('');
    document.body.classList.add('racing');
    document.getElementById('rb').style.display = 'block';
    document.getElementById('rbV').textContent = 'x' + State.getBoost().toFixed(1);
    Bridge.startRace(State.gamePath);
}

function onRaceComplete(data) {
    document.body.classList.remove('racing');
    document.getElementById('rb').style.display = 'none';
    showResults();
}

// ===== RESULTS =====
function showResults() {
    State.flow = 'results';
    const r = State.saveResult();
    Bridge.loadBackground(State.bgPath);

    document.getElementById('rE').textContent = r.total >= 90 ? '🏆' : r.total >= 70 ? '🎉' : r.total >= 50 ? '👏' : '💪';
    document.getElementById('rT').textContent = r.total >= 90 ? 'אלוף/ה!' : r.total >= 70 ? 'כל הכבוד!' : r.total >= 50 ? 'יפה מאוד!' : 'ממשיכים!';
    document.getElementById('rSt').textContent = '⭐'.repeat(r.stars) + '☆'.repeat(3 - r.stars);

    const gc = State.answers.filter(a => a.ok).length;
    document.getElementById('rR').innerHTML = `
        <div class="rr"><span>📗 ירוקות</span><span class="v">${gc}/${State.questions.length}</span></div>
        <div class="rr"><span>🏎️ מקום</span><span class="v">${State.raceResult?.finalPosition || '—'}/5</span></div>
        <div class="rr"><span>🎯 ציון</span><span class="v">${r.total}%</span></div>`;

    showScreen('results');
}

// ===== PUBLIC API =====
window.app = { showHub, openCategory, startGame, pick, startRace, goBack };

init();
