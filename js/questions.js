// Question engine — loads questions, manages flow
import State from './state.js';

export async function loadQuestions(filePath) {
    const res = await fetch(filePath);
    const data = await res.json();
    // Flatten all questions from all categories in the file
    const allQ = [];
    for (const cat of data.categories) {
        for (const q of cat.questions) {
            allQ.push(q);
        }
    }
    State.questions = allQ;
    State.maxScore = allQ.length * 5;
    State.questionIndex = 0;
    State.answers = [];
    State.score = 0;
}

export function getCurrentQuestion() {
    if (State.questionIndex >= State.questions.length) return null;
    return State.questions[State.questionIndex];
}

export function answerQuestion(isCorrect) {
    State.score += isCorrect ? 5 : 1;
    State.answers.push({ ok: isCorrect });
    State.questionIndex++;
    return State.questionIndex >= State.questions.length; // true = done
}
