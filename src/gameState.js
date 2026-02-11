const fs = require('fs');
const path = require('path');
const { log } = require('./utils');

const questionsPath = path.join(__dirname, '../data/questions.json');

const state = {
    questions: [],
    game: {
        pin: generatePin(),
        phase: 'waiting', // waiting | question | results | podium
        currentQuestion: -1,
        players: new Map(),
        answers: new Map(),
        timerInterval: null,
        timeLeft: 0,
        hostSocket: null
    }
};

function loadQuestions() {
    try {
        if (fs.existsSync(questionsPath)) {
            state.questions = JSON.parse(fs.readFileSync(questionsPath, 'utf-8'));
            log.info(`Perguntas carregadas: ${state.questions.length}`);
        } else {
            state.questions = [];
            log.warn('Arquivo standard de perguntas não encontrado.');
        }
    } catch (e) {
        log.error('Erro ao carregar perguntas:', e);
        state.questions = [];
    }
    return state.questions;
}

// Initial load
loadQuestions();

function generatePin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getPlayerList() {
    const list = [];
    state.game.players.forEach((p, id) => {
        list.push({ id, name: p.name, score: p.score, streak: p.streak, avatar: p.avatar });
    });
    return list;
}

function getRanking() {
    return getPlayerList().sort((a, b) => b.score - a.score);
}

module.exports = {
    state,
    loadQuestions,
    generatePin,
    getPlayerList,
    getRanking,
    questionsPath
};
