let questions = [];
let currentSlideIndex = 0;

// Elementos DOM
const slidesList = document.getElementById('slides-list');
const inputQuestion = document.getElementById('input-question');
const selectTime = document.getElementById('select-time');
const selectPoints = document.getElementById('select-points');
// const inputEmoji removido daqui, pois agora temos elementos específicos
const btnAddSlide = document.getElementById('btn-add-slide');
const btnSave = document.getElementById('btn-save');
const btnDelete = document.getElementById('btn-delete');
const btnDuplicate = document.getElementById('btn-duplicate');

// Inputs de Resposta
const answersInputs = [
    document.getElementById('ans-0'),
    document.getElementById('ans-1'),
    document.getElementById('ans-2'),
    document.getElementById('ans-3')
];
const answerCards = [
    document.getElementById('card-0'),
    document.getElementById('card-1'),
    document.getElementById('card-2'),
    document.getElementById('card-3')
];
const correctRadios = [
    document.getElementById('radio-0'),
    document.getElementById('radio-1'),
    document.getElementById('radio-2'),
    document.getElementById('radio-3')
];
const btnAddAnswer = document.getElementById('btn-add-answer');
const selectType = document.getElementById('select-type');

// --- INIT ---
async function init() {
    try {
        const res = await fetch(API_URL + '/api/questions');
        questions = await res.json();
        if (questions.length === 0) addNewSlide();
        renderSidebar();
        loadSlide(0);
    } catch (e) {
        console.error('Erro ao carregar', e);
        addNewSlide();
    }
}

// --- CORE FUNCTIONS ---
// ... (createEmptySlide e addNewSlide mantidos iguais/implícitos se não alterados) ...

function createEmptySlide() {
    return {
        id: Date.now(),
        type: 'quiz',
        question: "",
        time: 20,
        image: "", // Empty by default
        options: [
            { text: "", color: "red", shape: "triangle" },
            { text: "", color: "blue", shape: "diamond" },
            { text: "", color: "yellow", shape: "circle" },
            { text: "", color: "green", shape: "square" }
        ],
        correct: 0
    };
}

function addNewSlide() {
    const newSlide = createEmptySlide();
    questions.push(newSlide);
    currentSlideIndex = questions.length - 1;
    renderSidebar();
    loadSlide(currentSlideIndex);
}

function loadSlide(index) {
    if (index < 0 || index >= questions.length) return;
    currentSlideIndex = index;
    const q = questions[index];

    // Atualizar Sidebar Active
    document.querySelectorAll('.slide-thumb').forEach((el, idx) => {
        el.classList.toggle('active', idx === index);
    });

    // Inputs Gerais
    inputQuestion.value = q.question || "";
    selectTime.value = q.time || 20;
    selectType.value = q.type || 'quiz';

    // Media
    updateMediaPreview(q.image);

    // Update Layout based on Type
    updateAnswerLayout(q);

    // Load Values
    q.options.forEach((opt, idx) => {
        if (q.type === 'quiz') {
            answersInputs[idx].value = opt.text || "";
        }
    });

    // Correct Answer
    if (correctRadios[q.correct]) {
        correctRadios[q.correct].checked = true;
    }
}


function updateAnswerLayout(q) {
    const type = q.type || 'quiz';
    const isBool = type === 'boolean';

    // Show/Hide Add Button
    btnAddAnswer.style.display = isBool ? 'none' : 'flex';

    if (isBool) {
        // Mode True/False
        // Card 0 (Red) -> False
        // Card 1 (Blue) -> True
        // Hide others

        // Setup Card 0
        answerCards[0].style.display = 'flex';
        answersInputs[0].value = 'False';
        answersInputs[0].readOnly = true;

        // Setup Card 1
        answerCards[1].style.display = 'flex';
        answersInputs[1].value = 'True';
        answersInputs[1].readOnly = true;

        // Hide 2 & 3
        answerCards[2].style.display = 'none';
        answerCards[3].style.display = 'none';

        // Hide Delete Buttons
        document.querySelectorAll('.btn-del-ans').forEach(btn => btn.style.display = 'none');

    } else {
        // Mode Quiz
        // Restore visibility logic based on content
        document.querySelectorAll('.btn-del-ans').forEach(btn => btn.style.display = 'inline-block');

        // Sempre mostra pelo menos 2 cards
        // Lógica: Mostrar card se tiver texto OU se for um dos 2 primeiros
        // Mas se o usuário deletou o card 1?
        // Vamos usar a visibilidade salva?
        // Simplificação: Se tiver texto, mostra. Se não, esconde.
        // Mas e se for novo? Mostra 4?

        // Vamos contar quantos têm texto.
        let activeCount = 0;
        q.options.forEach((opt, idx) => {
            // Reset readonly
            answersInputs[idx].readOnly = false;

            // Lógica de exibição:
            // Se tiver texto -> mostra
            // Se não tiver texto, mas o index < 2 -> mostra (obrigatório ter 2)
            // Se não tiver texto e index >= 2 -> esconde (a menos que seja novo slide, ai mostra todos ou padrão)

            // Melhor abordagem:
            // Salvar uma prop 'active' no objeto options? Não, muito complexo modificar server.
            // Vamos confiar no texto. Se text != "", está ativo.
            // Para criar slide novo, eles vêm vazios. Então createEmptySlide deve vir vazio.
            // Mas UX padrão: Mostrar 4 vazios.
            // Então: Ao carregar, se (text="" e index >= 2), esconde?
            // Se o usuário "Deletar", eu limpo o texto.

            // Decisão:
            // Ao carregar slide:
            // Se (tem texto) => Mostra.
            // Se (index 0 ou 1) => Mostra sempre.
            // Se (sem texto e index >= 2) => Esconde.

            // Exception: Novo slide (todos vazios). 
            // Para facilitar, vamos mostrar o Card 2 e 3 APENAS se tiverem texto.
            // Mas o usuário quer "adicionar".

            const hasText = opt.text && opt.text.trim() !== "";
            const forceShow = idx < 2; // Sempre mostra 0 e 1

            if (hasText || forceShow) {
                answerCards[idx].style.display = 'flex';
                activeCount++;
            } else {
                answerCards[idx].style.display = 'none';
                answersInputs[idx].value = ""; // Garantir limpo
            }
        });

        // Atualizar estado do botão Add
        updateAddButtonState();
    }
}

function updateAddButtonState() {
    // Conta quantos cards estão visíveis
    const visibleCount = answerCards.filter(c => c.style.display !== 'none').length;

    // Se 4 visíveis, esconde botão add
    // Se < 4, mostra
    // Mas só no modo Quiz
    if (selectType.value === 'boolean') {
        btnAddAnswer.style.display = 'none';
        return;
    }

    if (visibleCount >= 4) {
        btnAddAnswer.style.display = 'none';
    } else {
        btnAddAnswer.style.display = 'flex';
    }
}

function saveCurrentState() {
    const q = questions[currentSlideIndex];
    if (!q) return;

    q.question = inputQuestion.value;
    q.time = parseInt(selectTime.value);
    q.type = selectType.value; // Save type
    // q.image é atualizado via updateQuestionMedia, não lido diretamente do input de emoji
    // q.image = inputEmoji.value; // REMOVIDO

    const isBool = q.type === 'boolean';

    q.options.forEach((opt, idx) => {
        if (isBool) {
            // Force values
            if (idx === 0) opt.text = "False";
            else if (idx === 1) opt.text = "True";
            else opt.text = "";
        } else {
            // Quiz
            // Se o card estiver oculto, salva vazio
            if (answerCards[idx].style.display === 'none') {
                opt.text = "";
            } else {
                opt.text = answersInputs[idx].value;
            }
        }
    });

    // Find checked radio
    const checked = document.querySelector('input[name="correct-ans"]:checked');
    if (checked) {
        q.correct = parseInt(checked.value);
    }

    updateMediaPreview(q.image);
    // Update Sidebar
    const thumb = document.querySelectorAll('.slide-thumb')[currentSlideIndex];
    if (thumb) {
        const typeIcon = isBool ? '☯ ' : '';
        thumb.querySelector('.thumb-content').textContent = typeIcon + (q.question.substring(0, 20) || "Question");
    }
}

// --- EVENT LISTENERS NEW ---

selectType.addEventListener('change', () => {
    saveCurrentState(); // Salva estado anterior (para não perder texto se mudar de volta? Hum, se mudar pra Quiz -> Bool -> Quiz, perde texto. Aceitável.)
    loadSlide(currentSlideIndex); // Recarrega layout
});

// Delete Answer Btn
document.querySelectorAll('.btn-del-ans').forEach(btn => {
    btn.addEventListener('click', (e) => {
        saveCurrentState();
        const idx = parseInt(btn.dataset.idx);

        // Não pode deletar se for um dos 2 últimos sobrando
        const visibleCount = answerCards.filter(c => c.style.display !== 'none').length;
        if (visibleCount <= 2) {
            alert("Minimo 2 respostas necessárias!");
            return;
        }

        // Limpar e esconder
        answersInputs[idx].value = "";
        answerCards[idx].style.display = 'none';

        // Se este era o correto, muda o correto para 0
        if (questions[currentSlideIndex].correct === idx) {
            correctRadios[0].checked = true;
        }

        saveCurrentState();
        updateAddButtonState();
    });
});

// Add Answer Btn
btnAddAnswer.addEventListener('click', () => {
    // Encontrar primeiro card oculto - CORRIGIDO (0 a 4)
    for (let i = 0; i < 4; i++) {
        if (answerCards[i].style.display === 'none') {
            answerCards[i].style.display = 'flex';
            answersInputs[i].value = "";
            answersInputs[i].focus();
            break;
        }
    }
    saveCurrentState();
    updateAddButtonState();
});

// --- RENDER ---
function renderSidebar() {
    slidesList.innerHTML = '';
    questions.forEach((q, idx) => {
        const el = document.createElement('div');
        el.className = `slide-thumb ${idx === currentSlideIndex ? 'active' : ''}`;
        el.onclick = () => { saveCurrentState(); loadSlide(idx); };

        const isUrl = q.image && (q.image.includes('/') || q.image.includes('.'));
        const mediaHtml = isUrl
            ? `<img src="${q.image}" style="width:60px;height:40px;object-fit:cover;border-radius:4px;margin-top:5px;">`
            : `<div style="font-size:20px;margin-top:5px;">${q.image || '❓'}</div>`;

        el.innerHTML = `
            <span class="slide-num">${idx + 1}</span>
            <div class="thumb-content" style="font-size:10px;text-align:center;">${q.question ? q.question.substring(0, 15) + '...' : 'Question'}</div>
            ${mediaHtml}
        `;
        slidesList.appendChild(el);
    });
}

// --- EVENT LISTENERS ---

// (Old listeners removed)

// --- MEDIA HANDLERS ---
const btnTriggerUpload = document.getElementById('btn-trigger-upload');
const btnTriggerEmoji = document.getElementById('btn-trigger-emoji');
const emojiInputContainer = document.getElementById('emoji-input-container');
const inputEmojiText = document.getElementById('input-emoji');
const btnSetEmoji = document.getElementById('btn-set-emoji');
const btnRemoveMedia = document.getElementById('btn-remove-media');
const mediaPreview = document.getElementById('media-preview');
const mediaPlaceholder = document.getElementById('media-placeholder');
const mediaContent = document.getElementById('media-content');

// 1. Upload Image
btnTriggerUpload.addEventListener('click', () => {
    document.getElementById('file-upload').click();
});

document.getElementById('file-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show loading state if needed
    btnTriggerUpload.textContent = "⏳ Uploading...";

    const formData = new FormData();
    formData.append('image', file);

    try {
        const res = await fetch(API_URL + '/api/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.url) {
            updateQuestionMedia(data.url);
        } else {
            alert('Upload failed');
        }
    } catch (err) {
        console.error(err);
        alert('Error uploading image');
    } finally {
        btnTriggerUpload.textContent = "🖼️ Image";
        e.target.value = ''; // Reset input
    }
});

// 2. Insert Emoji
btnTriggerEmoji.addEventListener('click', () => {
    emojiInputContainer.style.display = 'flex';
    inputEmojiText.focus();
});

btnSetEmoji.addEventListener('click', () => {
    const text = inputEmojiText.value.trim();
    if (text) {
        updateQuestionMedia(text);
        inputEmojiText.value = '';
        emojiInputContainer.style.display = 'none';
    }
});

// 3. Remove Media
btnRemoveMedia.addEventListener('click', (e) => {
    e.stopPropagation();
    updateQuestionMedia(""); // Clear
});

function updateQuestionMedia(value) {
    const q = questions[currentSlideIndex];
    q.image = value; // Update model
    saveCurrentState(); // Persist
    updateMediaPreview(q.image); // Update View
}

function updateMediaPreview(imageVal) {
    // Reset Views
    mediaPlaceholder.style.display = 'none';
    mediaPreview.style.display = 'none';
    emojiInputContainer.style.display = 'none';

    if (!imageVal) {
        // Show Placeholder
        mediaPlaceholder.style.display = 'block';
        return;
    }

    // Show Preview
    mediaPreview.style.display = 'flex';
    mediaContent.innerHTML = '';

    const isUrl = imageVal.includes('/') || imageVal.includes('.');

    if (isUrl) {
        const img = document.createElement('img');
        img.src = imageVal;
        mediaContent.appendChild(img);
    } else {
        // Emoji/Text
        const span = document.createElement('span');
        span.className = 'emoji-display';
        span.textContent = imageVal;
        mediaContent.appendChild(span);
    }
}

correctRadios.forEach(radio => {
    radio.addEventListener('change', saveCurrentState);
});

btnAddSlide.addEventListener('click', () => {
    saveCurrentState();
    addNewSlide();
    document.querySelector('.editor-area').scrollTop = 0;
});

btnDelete.addEventListener('click', () => {
    if (questions.length <= 1) {
        alert('Você precisa de pelo menos 1 pergunta!');
        return;
    }
    if (confirm('Excluir esta pergunta?')) {
        questions.splice(currentSlideIndex, 1);
        currentSlideIndex = Math.max(0, currentSlideIndex - 1);
        renderSidebar();
        loadSlide(currentSlideIndex);
    }
});

btnDuplicate.addEventListener('click', () => {
    saveCurrentState();
    const currentQ = questions[currentSlideIndex];
    const newQ = JSON.parse(JSON.stringify(currentQ));
    newQ.id = Date.now();
    questions.splice(currentSlideIndex + 1, 0, newQ);
    currentSlideIndex++;
    renderSidebar();
    loadSlide(currentSlideIndex);
});

btnSave.addEventListener('click', async () => {
    saveCurrentState();
    btnSave.textContent = "Saving...";
    try {
        const res = await fetch(API_URL + '/api/questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(questions)
        });
        if (res.ok) {
            btnSave.textContent = "Saved!";
            setTimeout(() => btnSave.textContent = "Save", 2000);
            // alert("Quiz salvo com sucesso! 💾"); // Removed alert for smoother XP
        } else {
            alert("Erro ao salvar.");
            btnSave.textContent = "Save";
        }
    } catch (e) {
        alert("Erro de conexão.");
        btnSave.textContent = "Save";
    }
});

// --- PREVIEW & EXIT ---
const modalPreview = document.getElementById('preview-modal');
const btnPreview = document.getElementById('btn-preview');
const btnClosePreview = document.getElementById('btn-close-preview');
const btnExit = document.getElementById('btn-exit');

// New Preview Elements
const previewQuestion = document.getElementById('preview-question');
const previewMediaModal = document.getElementById('preview-media-modal');
const btnPlayAll = document.getElementById('btn-play-all');
const btnPrevSlide = document.getElementById('prev-slide');
const btnNextSlide = document.getElementById('next-slide');
const previewIndexSpan = document.getElementById('preview-index');
const previewTotalSpan = document.getElementById('preview-total');

let previewCurrentIdx = 0;

btnExit.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja sair? Alterações não salvas podem ser perdidas.')) {
        window.location.href = '/painel';
    }
});

// Logo Click -> Exit
document.querySelector('.logo').addEventListener('click', () => {
    if (confirm('Tem certeza que deseja sair para o painel?')) {
        window.location.href = '/painel';
    }
});

// Open Preview for Current Slide
btnPreview.addEventListener('click', () => {
    saveCurrentState();
    openPreview(currentSlideIndex);
});

// Open Preview for All Slides (Play All)
btnPlayAll.addEventListener('click', () => {
    saveCurrentState();
    if (questions.length === 0) return;
    openPreview(0);
});

function openPreview(index) {
    previewCurrentIdx = index;
    updatePreviewUI();
    modalPreview.style.display = 'flex';
}

function updatePreviewUI() {
    const q = questions[previewCurrentIdx];
    if (!q) return;

    // Update Text info
    previewQuestion.textContent = q.question || "Digite sua pergunta...";
    previewIndexSpan.textContent = previewCurrentIdx + 1;
    previewTotalSpan.textContent = questions.length;

    // Update Media
    previewMediaModal.innerHTML = '';
    if (q.image) {
        if (q.image.startsWith('http') || q.image.startsWith('/uploads')) {
            const img = document.createElement('img');
            img.src = q.image;
            previewMediaModal.appendChild(img);
        } else {
            previewMediaModal.textContent = q.image;
        }
    } else {
        previewMediaModal.textContent = "❓";
    }

    // Update Options
    // Note: We need to use specific IDs for Preview Cards if they are different from Editor Cards
    // In creator.html modal, I used p-card-0, p-opt-0 etc.
    const pCards = [
        document.getElementById('p-card-0'),
        document.getElementById('p-card-1'),
        document.getElementById('p-card-2'),
        document.getElementById('p-card-3')
    ];
    const pTexts = [
        document.getElementById('p-opt-0'),
        document.getElementById('p-opt-1'),
        document.getElementById('p-opt-2'),
        document.getElementById('p-opt-3')
    ];

    pCards.forEach((card, i) => {
        const opt = q.options[i];
        const text = pTexts[i];

        // Logic to show/hide based on content and type
        let show = false;

        if (q.type === 'boolean') {
            // Show only first 2
            if (i < 2) show = true;
        } else {
            // Quiz mode: Show if has text OR if it's one of the first 2 (optional, but consistent with editor)
            // Actually, for preview, show only what has text to look like real game
            // But we need to handle "empty" optional answers
            if (opt && opt.text && opt.text.trim() !== "") {
                show = true;
            }
        }

        if (show) {
            card.style.display = 'block';
            text.textContent = opt ? opt.text : "";
        } else {
            card.style.display = 'none';
        }
    });

    // Update Nav Buttons State
    btnPrevSlide.disabled = previewCurrentIdx === 0;
    btnPrevSlide.style.opacity = previewCurrentIdx === 0 ? 0.3 : 1;

    btnNextSlide.disabled = previewCurrentIdx === questions.length - 1;
    btnNextSlide.style.opacity = previewCurrentIdx === questions.length - 1 ? 0.3 : 1;
}

// Nav Events
btnPrevSlide.addEventListener('click', () => {
    if (previewCurrentIdx > 0) {
        previewCurrentIdx--;
        updatePreviewUI();
    }
});

btnNextSlide.addEventListener('click', () => {
    if (previewCurrentIdx < questions.length - 1) {
        previewCurrentIdx++;
        updatePreviewUI();
    }
});

btnClosePreview.addEventListener('click', () => {
    modalPreview.style.display = 'none';
});

// Close on outside click
// Close on outside click
modalPreview.addEventListener('click', (e) => {
    if (e.target === modalPreview) modalPreview.style.display = 'none';
});


// Start
init();
