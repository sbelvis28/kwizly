// --- STATE MANAGEMENT ---
let decks = JSON.parse(localStorage.getItem('kwizly_decks')) || [];
let currentDeck = null;
let currentCardIndex = 0;
let streak = parseInt(localStorage.getItem('kwizly_streak')) || 0;
let lastStudyDate = localStorage.getItem('kwizly_last_date') || null;

// --- NAVIGATION ---
function showSection(sectionId) {
    document.querySelectorAll('.view').forEach(view => view.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
    
    if(sectionId === 'deck-page') renderDecks();
    window.scrollTo(0,0);
}

// --- DECK LOGIC ---
function renderDecks() {
    const grid = document.getElementById('deck-grid');
    grid.innerHTML = '';
    
    decks.forEach((deck, index) => {
        const card = document.createElement('div');
        card.className = 'deck-card';
        card.innerHTML = `
            <h3>${deck.title}</h3>
            <p>${deck.cards.length} Cards</p>
            <div class="deck-actions" style="margin-top:15px; display:flex; gap:10px; flex-wrap:wrap">
                <button class="btn-primary" onclick="startStudy(${index})">Study</button>
                <button class="btn-secondary" onclick="startQuiz(${index})">Quiz</button>
                <button class="btn-nav" onclick="exportDeck(${index})"><i class="fas fa-file-export"></i></button>
                <button class="btn-nav" style="color:red" onclick="deleteDeck(${index})"><i class="fas fa-trash"></i></button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// --- EDITOR & AI MOCK ---
let tempCards = [];
function addCardInput() {
    const container = document.getElementById('card-inputs');
    const div = document.createElement('div');
    div.className = 'input-group card-row';
    div.innerHTML = `
        <input type="text" placeholder="Question" class="q-input">
        <input type="text" placeholder="Answer" class="a-input">
    `;
    container.appendChild(div);
}

// File Upload Simulation
document.getElementById('drop-zone').onclick = () => document.getElementById('file-upload').click();
document.getElementById('file-upload').onchange = function(e) {
    const file = e.target.files[0];
    if(!file) return;

    document.getElementById('ai-loading').classList.remove('hidden');
    
    // Simulating AI Processing delay
    setTimeout(() => {
        const mockCards = [
            { q: `Concept from ${file.name} 1`, a: "Automated Answer A" },
            { q: `Concept from ${file.name} 2`, a: "Automated Answer B" },
            { q: `Concept from ${file.name} 3`, a: "Automated Answer C" },
        ];
        
        mockCards.forEach(c => {
            const container = document.getElementById('card-inputs');
            const div = document.createElement('div');
            div.className = 'input-group card-row';
            div.innerHTML = `<input type="text" value="${c.q}" class="q-input"><input type="text" value="${c.a}" class="a-input">`;
            container.appendChild(div);
        });

        document.getElementById('ai-loading').classList.add('hidden');
        alert("AI successfully extracted cards from file!");
    }, 2000);
};

function saveDeck() {
    const title = document.getElementById('deck-title-input').value;
    const cardRows = document.querySelectorAll('.card-row');
    let cards = [];

    cardRows.forEach(row => {
        const q = row.querySelector('.q-input').value;
        const a = row.querySelector('.a-input').value;
        if(q && a) cards.push({ q, a, interval: 1, ease: 2.5, nextReview: Date.now() });
    });

    if(!title || cards.length === 0) return alert("Please add a title and at least one card");

    decks.push({ title, cards });
    localStorage.setItem('kwizly_decks', JSON.stringify(decks));
    showSection('deck-page');
    updateStreak();
}

// --- STUDY MODE (Spaced Repetition) ---
function startStudy(index) {
    currentDeck = decks[index];
    currentCardIndex = 0;
    // Sort cards by review date (Spaced Repetition Logic)
    currentDeck.cards.sort((a, b) => (a.nextReview || 0) - (b.nextReview || 0));
    showSection('flashcard-mode');
    updateFlashcard();
}

function flipCard() {
    document.getElementById('flashcard').classList.toggle('flipped');
    document.getElementById('rating-controls').classList.remove('hidden');
}

function updateFlashcard() {
    const card = currentDeck.cards[currentCardIndex];
    document.getElementById('flashcard').classList.remove('flipped');
    document.getElementById('card-front-text').innerText = card.q;
    document.getElementById('card-back-text').innerText = card.a;
    document.getElementById('study-progress-text').innerText = `${currentCardIndex + 1} / ${currentDeck.cards.length}`;
    document.getElementById('rating-controls').classList.add('hidden');
}

function nextCard() {
    if(currentCardIndex < currentDeck.cards.length - 1) {
        currentCardIndex++;
        updateFlashcard();
    }
}

function prevCard() {
    if(currentCardIndex > 0) {
        currentCardIndex--;
        updateFlashcard();
    }
}

function rateCard(rating) {
    // Simple Spaced Repetition logic (SM-2 Lite)
    let card = currentDeck.cards[currentCardIndex];
    if(rating === 'hard') card.nextReview = Date.now() + (1000 * 60); // 1 min
    if(rating === 'good') card.nextReview = Date.now() + (1000 * 60 * 60 * 24); // 1 day
    if(rating === 'easy') card.nextReview = Date.now() + (1000 * 60 * 60 * 24 * 4); // 4 days
    
    localStorage.setItem('kwizly_decks', JSON.stringify(decks));
    nextCard();
}

// --- QUIZ MODE ---
let quizQuestions = [];
let quizIndex = 0;
let score = 0;

function startQuiz(index) {
    const deck = decks[index];
    if(deck.cards.length < 2) return alert("Need at least 2 cards for a quiz");
    
    quizQuestions = deck.cards.map(card => {
        // Generate random distractors from the same deck
        let distractors = deck.cards
            .filter(c => c.a !== card.a)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3)
            .map(c => c.a);
        
        return {
            q: card.q,
            correct: card.a,
            options: [...distractors, card.a].sort(() => 0.5 - Math.random())
        };
    });

    quizIndex = 0;
    score = 0;
    showSection('quiz-mode');
    renderQuizQuestion();
}

function renderQuizQuestion() {
    const q = quizQuestions[quizIndex];
    document.getElementById('quiz-question-text').innerText = q.q;
    const optionsDiv = document.getElementById('quiz-options');
    optionsDiv.innerHTML = '';
    
    document.getElementById('quiz-progress-bar').style.width = `${((quizIndex) / quizQuestions.length) * 100}%`;

    q.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.onclick = () => checkAnswer(btn, opt, q.correct);
        optionsDiv.appendChild(btn);
    });
    
    document.getElementById('quiz-next-btn').classList.add('hidden');
}

function checkAnswer(btn, selected, correct) {
    const btns = document.querySelectorAll('.option-btn');
    btns.forEach(b => b.disabled = true);

    if(selected === correct) {
        btn.classList.add('correct');
        score++;
    } else {
        btn.classList.add('wrong');
        // highlight correct
        btns.forEach(b => { if(b.innerText === correct) b.classList.add('correct'); });
    }
    document.getElementById('quiz-next-btn').classList.remove('hidden');
}

function nextQuizQuestion() {
    quizIndex++;
    if(quizIndex < quizQuestions.length) {
        renderQuizQuestion();
    } else {
        showResults();
    }
}

function showResults() {
    showSection('results-mode');
    const percent = Math.round((score / quizQuestions.length) * 100);
    document.getElementById('score-display').innerText = `${percent}%`;
    if(percent > 70) confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
}

// --- UTILITIES ---
function updateStreak() {
    const today = new Date().toDateString();
    if (lastStudyDate !== today) {
        streak++;
        localStorage.setItem('kwizly_streak', streak);
        localStorage.setItem('kwizly_last_date', today);
        document.getElementById('streak-count').innerText = streak;
    }
}

function deleteDeck(index) {
    if(confirm("Delete this deck?")) {
        decks.splice(index, 1);
        localStorage.setItem('kwizly_decks', JSON.stringify(decks));
        renderDecks();
    }
}

function exportDeck(index) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(decks[index]));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", decks[index].title + ".kwizly");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// Initial Load
document.getElementById('streak-count').innerText = streak;
addCardInput(); // start with one input
