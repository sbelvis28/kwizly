// --- DATA PERSISTENCE ---
let decks = JSON.parse(localStorage.getItem('kwizly_decks')) || [];
let streak = parseInt(localStorage.getItem('kwizly_streak')) || 0;
let lastStudyDate = localStorage.getItem('kwizly_last_date') || null;

// Global State
let currentDeckIndex = null;
let currentCardIndex = 0;
let quizQuestions = [];
let quizIndex = 0;
let score = 0;
let mistakes = [];

// --- INITIALIZE ---
document.getElementById('streak-count').innerText = streak;
renderDecks();

// --- ROUTING ---
function showSection(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    window.scrollTo(0, 0);
    if (id === 'deck-page') renderDecks();
}

// --- DECK MANAGEMENT ---
function renderDecks() {
    const grid = document.getElementById('deck-grid');
    grid.innerHTML = '';

    if (decks.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; opacity: 0.6;">No decks yet. Create your first one!</p>';
    }

    decks.forEach((deck, i) => {
        const div = document.createElement('div');
        div.className = 'deck-card';
        div.innerHTML = `
            <h3>${deck.title}</h3>
            <p>${deck.cards.length} Cards</p>
            <div class="deck-actions">
                <button class="btn-quiz" onclick="startFlashcards(${i})">Study</button>
                <button class="btn-icon-action" onclick="openQuizSettings(${i})" title="Quiz"><i class="fas fa-tasks"></i></button>
                <button class="btn-icon-action delete" onclick="deleteDeck(${i})" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        `;
        grid.appendChild(div);
    });
}

function prepareNewDeck() {
    document.getElementById('deck-title-input').value = '';
    document.getElementById('card-inputs').innerHTML = '';
    addCardInput();
    showSection('create-deck');
}

function addCardInput(q = '', a = '') {
    const container = document.getElementById('card-inputs');
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.gap = '10px';
    div.style.marginBottom = '10px';
    div.className = 'manual-card-row';
    div.innerHTML = `
        <input type="text" placeholder="Question" class="q-input" value="${q}" style="flex:1; padding:12px; border-radius:10px; border:1px solid #ddd;">
        <input type="text" placeholder="Answer" class="a-input" value="${a}" style="flex:1; padding:12px; border-radius:10px; border:1px solid #ddd;">
    `;
    container.appendChild(div);
}

function saveDeck() {
    const title = document.getElementById('deck-title-input').value;
    const rows = document.querySelectorAll('.manual-card-row');
    let cards = [];

    rows.forEach(row => {
        const q = row.querySelector('.q-input').value;
        const a = row.querySelector('.a-input').value;
        if (q && a) cards.push({ q, a, interval: 1, nextReview: Date.now() });
    });

    if (!title) return showToast("Please add a title!");
    if (cards.length === 0) return showToast("Add at least one card!");

    decks.push({ title, cards });
    localStorage.setItem('kwizly_decks', JSON.stringify(decks));
    showToast("Deck Saved! 🎉");
    showSection('deck-page');
}

function deleteDeck(i) {
    if (confirm("Delete this deck?")) {
        decks.splice(i, 1);
        localStorage.setItem('kwizly_decks', JSON.stringify(decks));
        renderDecks();
    }
}

// --- FILE UPLOAD (MOCK AI) ---
document.getElementById('drop-zone').onclick = () => document.getElementById('file-upload').click();
document.getElementById('file-upload').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('ai-loading').classList.remove('hidden');
    
    // Simulate File Parsing Logic
    setTimeout(() => {
        addCardInput(`Concept from ${file.name}`, "Extracted definition");
        addCardInput(`Key detail from ${file.name}`, "Explanation of concept");
        document.getElementById('ai-loading').classList.add('hidden');
        showToast("AI Generated cards from file!");
    }, 1500);
};

// --- FLASHCARD ENGINE ---
function startFlashcards(i) {
    currentDeckIndex = i;
    currentCardIndex = 0;
    // Spaced Repetition Sort (Due cards first)
    decks[i].cards.sort((a,b) => a.nextReview - b.nextReview);
    showSection('flashcard-mode');
    updateFlashcardUI();
}

function updateFlashcardUI() {
    const card = decks[currentDeckIndex].cards[currentCardIndex];
    document.getElementById('flashcard').classList.remove('flipped');
    document.getElementById('card-front-text').innerText = card.q;
    document.getElementById('card-back-text').innerText = card.a;
    document.getElementById('study-progress-text').innerText = `${currentCardIndex + 1} / ${decks[currentDeckIndex].cards.length}`;
    document.getElementById('flashcard-rating').classList.add('hidden');
}

function flipCard() {
    document.getElementById('flashcard').classList.toggle('flipped');
    document.getElementById('flashcard-rating').classList.remove('hidden');
}

function nextCard() {
    if (currentCardIndex < decks[currentDeckIndex].cards.length - 1) {
        currentCardIndex++;
        updateFlashcardUI();
    }
}

function prevCard() {
    if (currentCardIndex > 0) {
        currentCardIndex--;
        updateFlashcardUI();
    }
}

function rateFlashcard(difficulty) {
    let card = decks[currentDeckIndex].cards[currentCardIndex];
    handleSpacedRep(card, difficulty);
    nextCard();
    updateStreak();
}

// --- QUIZ ENGINE ---
function openQuizSettings(i) {
    currentDeckIndex = i;
    showSection('quiz-settings');
}

function startQuizEngine(type) {
    const deck = decks[currentDeckIndex];
    if (deck.cards.length < 2) return showToast("Need at least 2 cards for a quiz!");

    quizIndex = 0; score = 0; mistakes = [];
    quizQuestions = deck.cards.map(card => generateQuestion(card, deck.cards, type)).sort(() => 0.5 - Math.random()).slice(0, 50);

    showSection('quiz-mode');
    renderQuizQuestion();
}

function generateQuestion(card, allCards, type) {
    let qType = type === 'mixed' ? ['mcq', 'tf', 'id', 'cloze'][Math.floor(Math.random() * 4)] : type;
    let qObj = { origin: card, type: qType, q: card.q, correct: card.a };

    if (qType === 'mcq') {
        let distractors = allCards.filter(c => c.a !== card.a).sort(() => 0.5 - Math.random()).slice(0, 3).map(c => c.a);
        qObj.options = [...distractors, card.a].sort(() => 0.5 - Math.random());
    } else if (qType === 'tf') {
        let isTrue = Math.random() > 0.5;
        let displayVal = isTrue ? card.a : allCards[Math.floor(Math.random()*allCards.length)].a;
        qObj.q = `Is "${card.q}" related to "${displayVal}"?`;
        qObj.correct = (displayVal === card.a) ? "True" : "False";
        qObj.options = ["True", "False"];
    }
    return qObj;
}

function renderQuizQuestion() {
    const q = quizQuestions[quizIndex];
    const opts = document.getElementById('quiz-options');
    const inputArea = document.getElementById('quiz-input-container');
    
    document.getElementById('quiz-question-text').innerText = q.q;
    document.getElementById('quiz-progress-text').innerText = `Question ${quizIndex+1}/${quizQuestions.length}`;
    document.getElementById('quiz-progress-bar').style.width = `${((quizIndex+1)/quizQuestions.length)*100}%`;
    
    opts.innerHTML = ''; 
    opts.classList.add('hidden');
    inputArea.classList.add('hidden');
    document.getElementById('quiz-feedback').classList.add('hidden');
    document.getElementById('quiz-next-btn').classList.add('hidden');

    if (q.type === 'mcq' || q.type === 'tf') {
        opts.classList.remove('hidden');
        q.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerText = opt;
            btn.style.width = '100%';
            btn.style.padding = '15px';
            btn.style.marginBottom = '10px';
            btn.style.borderRadius = '12px';
            btn.style.border = '1.5px solid #ddd';
            btn.style.backgroundColor = 'white';
            btn.style.fontFamily = 'Lexend';
            btn.onclick = () => checkQuizAnswer(opt, btn);
            opts.appendChild(btn);
        });
    } else {
        inputArea.classList.remove('hidden');
        document.getElementById('quiz-text-answer').value = '';
        document.getElementById('quiz-text-answer').focus();
    }
}

function checkQuizAnswer(val, btnEl = null) {
    const q = quizQuestions[quizIndex];
    const isCorrect = val.toLowerCase().trim() === q.correct.toLowerCase().trim();
    const feedback = document.getElementById('quiz-feedback');

    if (isCorrect) {
        score++;
        feedback.innerText = "Correct! ✨";
        feedback.className = "feedback-box correct";
        if (btnEl) btnEl.style.borderColor = "#10b981";
    } else {
        mistakes.push(q.origin);
        feedback.innerText = `Wrong! Correct answer: ${q.correct}`;
        feedback.className = "feedback-box wrong";
        if (btnEl) btnEl.style.borderColor = "#ef4444";
    }

    feedback.classList.remove('hidden');
    document.getElementById('quiz-next-btn').classList.remove('hidden');
    document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
}

function checkTextAnswer() {
    const val = document.getElementById('quiz-text-answer').value;
    if (!val) return;
    checkQuizAnswer(val);
}

function nextQuizQuestion() {
    quizIndex++;
    if (quizIndex < quizQuestions.length) renderQuizQuestion();
    else finishQuiz();
}

function finishQuiz() {
    showSection('results-mode');
    const pct = Math.round((score/quizQuestions.length)*100);
    document.getElementById('score-display').innerText = `${pct}%`;
    document.getElementById('score-details').innerText = `You got ${score}/${quizQuestions.length} correct.`;
    
    if (pct >= 80) confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });

    const btnArea = document.querySelector('.result-btns');
    btnArea.innerHTML = `
        <button class="btn-primary" onclick="showSection('deck-page')">Back Home</button>
        ${mistakes.length > 0 ? `<button class="btn-primary" style="background:#f59e0b" onclick="startReview()">Review Mistakes</button>` : ''}
    `;
    updateStreak();
}

// --- REVIEW MODE (Mistakes only) ---
let reviewIdx = 0;
function startReview() {
    reviewIdx = 0;
    showSection('review-mode');
    renderReviewCard();
}

function renderReviewCard() {
    const card = mistakes[reviewIdx];
    document.getElementById('rev-q').innerText = card.q;
    document.getElementById('rev-a').innerText = card.a;
}

function handleRate(diff) {
    handleSpacedRep(mistakes[reviewIdx], diff);
    reviewIdx++;
    if (reviewIdx < mistakes.length) renderReviewCard();
    else {
        showToast("Review Complete!");
        showSection('deck-page');
    }
}

// --- CORE UTILS ---
function handleSpacedRep(card, diff) {
    if (!card.interval) card.interval = 1;
    if (diff === 'hard') card.interval = 1;
    else if (diff === 'good') card.interval *= 2;
    else card.interval *= 4;
    card.nextReview = Date.now() + (card.interval * 86400000);
    localStorage.setItem('kwizly_decks', JSON.stringify(decks));
}

function updateStreak() {
    const today = new Date().toDateString();
    if (lastStudyDate !== today) {
        streak++;
        lastStudyDate = today;
        localStorage.setItem('kwizly_streak', streak);
        localStorage.setItem('kwizly_last_date', today);
        document.getElementById('streak-count').innerText = streak;
    }
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 3000);
}
