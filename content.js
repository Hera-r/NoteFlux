let savedHighlights = {}; 
const POPUP_ID = "note-popup-container";
const TEXTAREA_ID = "note-textarea";

chrome.storage.local.get(['highlightsData'], function(result) {
    savedHighlights = result.highlightsData || {};
    applyHighlights();
});

createPopupElement();

document.addEventListener('mouseup', function(event) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText.length > 0 && !event.target.closest(`#${POPUP_ID}`)) {

        if (!savedHighlights[selectedText.toLowerCase()]) {
            saveHighlight(selectedText.toLowerCase(), "");
            selection.removeAllRanges();
        }
    }
});

document.addEventListener('mousedown', function(event) {
    const popup = document.getElementById(POPUP_ID);

    if (popup.style.display === 'block' && 
        !popup.contains(event.target) && 
        !event.target.classList.contains('my-highlight')) {
        popup.style.display = 'none';
    }
});

function saveHighlight(key, note) {
    savedHighlights[key] = note;
    chrome.storage.local.set({ highlightsData: savedHighlights }, function() {
        applyHighlights();
    });
}

function applyHighlights() {
    const dataKeys = Object.keys(savedHighlights).sort((a, b) => b.length - a.length);

    if (dataKeys.length === 0) return;

    const bodyElements = document.body.getElementsByTagName("*");

    for (let element of bodyElements) {
        if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "IMG"].includes(element.tagName)) continue;
        if (element.id === POPUP_ID) continue;

        for (let node of element.childNodes) {
            if (node.nodeType === 3 && node.nodeValue.trim().length > 0) {
                let text = node.nodeValue;
                let parent = node.parentNode;

                if (parent.classList.contains("my-highlight")) continue;

                let replaced = false;

                for (const key of dataKeys) {
                    const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`\\b(${safeKey})\\b`, "gi");

                    if (regex.test(text)) {
                        const span = document.createElement("span");
                        span.className = "my-highlight";
                        span.innerText = text.substring(text.search(regex), text.search(regex) + key.length);
                        const newHtml = text.replace(regex, (match) => {
                            return `<span class="my-highlight" data-key="${key}">${match}</span>`;
                        });

                        if (newHtml !== text) {
                            const wrapper = document.createElement("span");
                            wrapper.innerHTML = newHtml;
                            element.replaceChild(wrapper, node);
                            replaced = true;
                            break;
                        }
                    }
                }
                if (replaced) break;
            }
        }
    }
    attachClickEvents();
}

function attachClickEvents() {
    const highlights = document.querySelectorAll('.my-highlight');
    const popup = document.getElementById(POPUP_ID);
    const textarea = document.getElementById(TEXTAREA_ID);
    const title = popup.querySelector('.popup-title');

    highlights.forEach(span => {
        if (span.getAttribute('data-has-click') === 'true') return;
        span.setAttribute('data-has-click', 'true');

        span.addEventListener('click', (e) => {
            e.stopPropagation();

            const key = span.getAttribute('data-key');
            const currentNote = savedHighlights[key] || "";
            const rect = span.getBoundingClientRect();

            popup.style.top = (window.scrollY + rect.bottom + 5) + 'px';
            popup.style.left = (window.scrollX + rect.left) + 'px';
            popup.style.display = 'block';
            title.innerText = `Note for: "${key}"`;
            textarea.value = currentNote;
            textarea.setAttribute('data-current-key', key);
            textarea.focus();
        });
    });
}

function createPopupElement() {
    if (document.getElementById(POPUP_ID)) return;

    const container = document.createElement("div");
    container.id = POPUP_ID;
    const title = document.createElement("div");
    title.className = "popup-title";
    container.appendChild(title);
    const textarea = document.createElement("textarea");
    textarea.id = TEXTAREA_ID;
    textarea.placeholder = "Type your note here...";
    container.appendChild(textarea);
    document.body.appendChild(container);

    textarea.addEventListener('input', function() {
        const key = this.getAttribute('data-current-key');
        const text = this.value;

        if (key) {
            savedHighlights[key] = text;
            chrome.storage.local.set({ highlightsData: savedHighlights });
        }
    });
}

