let savedHighlights = {};
const POPUP_ID = "note-popup-container";
const TEXTAREA_ID = "note-textarea";

const BLOCKED_DOMAINS = [
    "google.", "bing.com", "yahoo.com", "duckduckgo",
    "facebook.com", "twitter.com", "x.com", "instagram.com", "linkedin.com", "tiktok.com",
    "chatgpt.com", "openai.com", "gemini.google", "claude.ai", "localhost"
];

const currentHostname = window.location.hostname;
const isBlocked = BLOCKED_DOMAINS.some(domain => currentHostname.includes(domain));

if (isBlocked) {
    console.log("NoteFlux: Disabled on this domain.");
} else {
    startExtension();
}


function startExtension() {
    chrome.storage.local.get(['highlightsData'], function(result) {
        savedHighlights = result.highlightsData || {};
        applyHighlights();
    });
    createPopupElement();
    attachSelectionListener();
    attachPopupCloseListener();
}


function attachSelectionListener() {
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
}

function attachPopupCloseListener() {
    document.addEventListener('mousedown', function(event) {
        const popup = document.getElementById(POPUP_ID);
        if (popup && popup.style.display === 'block' && 
            !popup.contains(event.target) && 
            !event.target.classList.contains('my-highlight')) {
            popup.style.display = 'none';
        }
    });
}


function saveHighlight(key, note) {
    savedHighlights[key] = note;
    chrome.storage.local.set({ highlightsData: savedHighlights }, function() {
        applyHighlights();
    });
}

function deleteHighlight(key) {
    delete savedHighlights[key];

    chrome.storage.local.set({ highlightsData: savedHighlights }, function() {
        document.getElementById(POPUP_ID).style.display = 'none';
        location.reload(); 
    });
}

function applyHighlights() {
    const dataKeys = Object.keys(savedHighlights).sort((a, b) => b.length - a.length);
    if (dataKeys.length === 0) return;

    const bodyElements = document.body.getElementsByTagName("*");

    for (let element of bodyElements) {
        if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "IMG", "VIDEO", "BUTTON"].includes(element.tagName)) continue;
        if (element.isContentEditable) continue;
        if (element.id === POPUP_ID || element.closest(`#${POPUP_ID}`)) continue;

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

            title.innerText = key; 
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

    const header = document.createElement("div");
    header.className = "popup-header";

    const title = document.createElement("div");
    title.className = "popup-title";
    header.appendChild(title);

    const deleteBtn = document.createElement("button");

    deleteBtn.className = "delete-btn";
    deleteBtn.innerText = "🗑️";
    deleteBtn.title = "Supprimer ce surlignage";

    deleteBtn.addEventListener('click', () => {
        const textarea = document.getElementById(TEXTAREA_ID);
        const keyToDelete = textarea.getAttribute('data-current-key');
        
        if (confirm(`Supprimer le surlignage pour "${keyToDelete}" ?`)) {
            deleteHighlight(keyToDelete);
        }
    });
    
    header.appendChild(deleteBtn);
    container.appendChild(header);

    const textarea = document.createElement("textarea");
    textarea.id = TEXTAREA_ID;
    textarea.placeholder = "Ajouter une note...";
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
