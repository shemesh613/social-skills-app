// Global app state
const State = {
    flow: 'hub',           // hub → category → questions → race → results
    categoryId: null,
    gameId: null,
    gamePath: null,
    bgPath: null,
    questions: [],
    questionIndex: 0,
    answers: [],            // { ok: boolean }
    score: 0,
    maxScore: 0,
    raceResult: null,       // { finalPosition, raceTime, dilemmaScore }

    reset() {
        this.questionIndex = 0;
        this.answers = [];
        this.score = 0;
        this.maxScore = 0;
        this.raceResult = null;
    },

    getBoost() {
        const pct = this.maxScore > 0 ? this.score / this.maxScore : 0;
        if (pct >= 0.9) return 1.5;
        if (pct >= 0.8) return 1.3;
        if (pct >= 0.6) return 1.2;
        if (pct >= 0.4) return 1.1;
        return 1.0;
    },

    getScorePct() {
        return this.maxScore > 0 ? Math.round(this.score / this.maxScore * 100) : 0;
    },

    // LocalStorage progress
    getProgress() {
        try { return JSON.parse(localStorage.getItem('social-skills-progress') || '{}'); }
        catch { return {}; }
    },

    saveResult() {
        const p = this.getProgress();
        const key = this.categoryId + ':' + this.gameId;
        if (!p[key]) p[key] = { best: 0, attempts: 0, stars: 0 };
        p[key].attempts++;

        const qS = this.getScorePct();
        const pS = this.raceResult ? Math.round(((5 - (this.raceResult.finalPosition || 3)) / 4) * 100) : 50;
        const total = Math.round(qS * 0.6 + pS * 0.4);

        if (total > p[key].best) p[key].best = total;
        p[key].stars = total >= 90 ? 3 : total >= 75 ? 2 : total >= 50 ? 1 : 0;
        localStorage.setItem('social-skills-progress', JSON.stringify(p));
        return { qS, pS, total, stars: p[key].stars };
    }
};

export default State;
