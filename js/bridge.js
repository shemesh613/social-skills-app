// Communication bridge with game iframe
import State from './state.js';

let iframe = null;
let onRaceComplete = null;

export function init(iframeEl, callback) {
    iframe = iframeEl;
    onRaceComplete = callback;

    window.addEventListener('message', (e) => {
        if (e.data?.type === 'raceComplete') {
            State.raceResult = e.data;
            if (onRaceComplete) onRaceComplete(e.data);
        }
    });
}

export function loadBackground(bgPath) {
    iframe.style.pointerEvents = 'none';
    iframe.src = bgPath;
}

export function startRace(gamePath) {
    iframe.src = gamePath;
    iframe.style.pointerEvents = 'auto';
    iframe.onload = () => {
        setTimeout(() => {
            iframe.contentWindow.postMessage({
                type: 'startRace',
                speedBoost: State.getBoost(),
                categoryId: State.categoryId
            }, '*');
            // Give focus to iframe so keyboard works
            iframe.focus();
            iframe.contentWindow.focus();
        }, 800);
    };
}
