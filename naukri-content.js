// Content script for Naukri Code 360 problem pages
console.log('Naukri Code 360 to Notion Sync content script loaded');

let isListening = false;

// Function to extract problem data from the page
async function extractProblemData() {
    try {
        // 1. Extract problem title and URL
        let title = '';
        const pageUrl = window.location.href;
        
        // First try: Problem header title
        const problemHeaderTitle = document.querySelector('.problem h1, .problem-statement h1, .problem-title');
        if (problemHeaderTitle && problemHeaderTitle.textContent.trim()) {
            title = problemHeaderTitle.textContent.trim();
        }
        
        // Extract difficulty level
        let difficulty = 'Medium'; // Default
        const difficultyElement = document.querySelector('[class*="difficulty"], [class*="level"]');
        if (difficultyElement) {
            const diffText = difficultyElement.textContent.toLowerCase();
            if (diffText.includes('easy')) {
                difficulty = 'Easy';
            } else if (diffText.includes('hard') || diffText.includes('ninja')) {
                difficulty = 'Hard';
            }
        }

        // Extract company tags
        let companyTags = [];
        console.log('Extracting company tags from Naukri Code 360...');

        // Trigger company popup if needed
        const askedCompaniesEl = Array.from(document.querySelectorAll('*')).find(
            el => el.textContent && el.textContent.trim().includes('Asked in companies')
        );
        if (askedCompaniesEl) {
            console.log('Found "Asked in companies" element, triggering popup...');
            
            // Trigger mouse events to open popup
            ['mouseover', 'mouseenter', 'mousedown', 'mouseup', 'click'].forEach(type => {
                askedCompaniesEl.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
            });
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            try {
                askedCompaniesEl.click();
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (e) {
                console.log('Direct click failed:', e);
            }
        }

        // Extract companies using multiple strategies
        const extractCompanies = () => {
            const companies = new Set();
            
            // Strategy 1: Extract from company divs
            document.querySelectorAll('div[_ngcontent-serverapp-c226].company-images, .company-item, [class*="company-"]').forEach(div => {
                // Get company name from span
                const nameSpan = div.querySelector('.company-name, .company-title');
                if (nameSpan) {
                    const name = nameSpan.textContent.trim();
                    if (name && !name.toLowerCase().includes('companies')) {
                        companies.add(name);
                    }
                }
                
                // Get company name from image
                const img = div.querySelector('img');
                if (img && img.alt) {
                    const name = img.alt.trim();
                    if (name && !name.toLowerCase().includes('companies')) {
                        companies.add(name);
                    }
                }
            });

            // Strategy 2: Extract from popup content
            const popup = document.querySelector('.companies-popup, .company-list, [class*="company-container"]');
            if (popup) {
                const text = popup.textContent;
                const companySection = text.split('Asked in companies').pop();
                if (companySection) {
                    companySection.split(/[,|&]/)
                        .map(s => s.trim())
                        .filter(s => s && s.length > 1 && s.length < 50 && 
                                !s.toLowerCase().includes('companies') &&
                                !s.toLowerCase().includes('asking'))
                        .forEach(company => companies.add(company));
                }
            }

            // Strategy 3: Look for company logos and labels
            document.querySelectorAll('[class*="company-logo"], [class*="company-label"]').forEach(el => {
                const name = el.getAttribute('title') || el.getAttribute('alt') || el.textContent;
                if (name && name.trim()) {
                    companies.add(name.trim());
                }
            });

            return Array.from(companies);
        };

        // First extraction attempt
        companyTags = extractCompanies();
        
        // If few companies found, wait and try again
        if (companyTags.length <= 3) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const secondAttempt = extractCompanies();
            
            // Merge results, removing duplicates
            companyTags = Array.from(new Set([...companyTags, ...secondAttempt]));
        }

        // Clean up company tags
        companyTags = companyTags
            .map(tag => tag.trim())
            .filter(tag => {
                return tag && 
                       tag.length > 1 && 
                       tag.length < 50 &&
                       !tag.toLowerCase().includes('companies') &&
                       !tag.toLowerCase().includes('asking') &&
                       !tag.toLowerCase().includes('question');
            });

        // Extract solution code
        let solution = '';
        let language = 'cpp'; // Default
        
        try {
            const aceEditor = document.querySelector('.ace_editor');
            if (aceEditor && window.ace) {
                const editor = window.ace.edit(aceEditor);
                solution = editor.getValue();
            }
        } catch (e) {
            console.log('Error accessing ace editor:', e);
        }
        
        if (!solution) {
            const codeElements = document.querySelectorAll('pre, code, .ace_content, [class*="editor"]');
            for (const el of codeElements) {
                if (el.textContent && el.textContent.length > 100) {
                    solution = el.textContent;
                    break;
                }
            }
        }
        
        return {
            title,
            platform: 'CODE360',
            difficulty,
            topics: ['Data Structures'],
            companyTags,
            interviewTags: [],
            url: pageUrl,
            solution,
            language,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error extracting problem data:', error);
        return null;
    }
}

// Function to sync problem to Notion
async function syncProblem(button) {
    if (!button) return;
    
    const originalHTML = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '⏳';
    button.style.cursor = 'wait';
    
    try {
        const problemData = await extractProblemData();
        if (!problemData || !problemData.title || !problemData.url) {
            throw new Error('Could not extract all required problem data');
        }

        const response = await chrome.runtime.sendMessage({
            action: 'syncToNotion',
            data: problemData
        });
        
        if (response && response.success) {
            button.innerHTML = '✓';
            button.style.background = '#4CAF50';
        } else {
            button.innerHTML = '✕';
            button.style.background = '#f44336';
        }
        
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.style.background = 'rgba(255, 255, 255, 0.1)';
            button.disabled = false;
            button.style.cursor = 'pointer';
        }, 1200);
    } catch (error) {
        button.innerHTML = '✕';
        button.style.background = '#f44336';
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.style.background = 'rgba(255, 255, 255, 0.1)';
            button.disabled = false;
            button.style.cursor = 'pointer';
        }, 1200);
    }
}

// Add sync button to the page
function addNaukriSyncButton() {
    addSyncButton({
        id: 'naukri-notion-sync-btn',
        onClick: async (button) => {
            console.log('[SYNC] Step 1: Triggering extraction to open popup (no sync)');
            await extractProblemData();
            console.log('[SYNC] Step 1 complete. Waiting for popup to fully render...');
            await new Promise(resolve => setTimeout(resolve, 1800));
            console.log('[SYNC] Step 2: Extracting again and syncing to Notion');
            await syncProblem(button);
            console.log('[SYNC] Step 2 complete. Sync attempted.');
        }
    });
}

// Initialize the content script
function initialize() {
    console.log('Initializing Naukri Code 360 to Notion Sync on:', window.location.href);
    
    const isProblemPage = window.location.href.includes('/problems/') || 
                         document.querySelector('.problem') || 
                         document.querySelector('.ace_editor');
    
    if (!isProblemPage) {
        return;
    }
    
    setTimeout(() => {
        addNaukriSyncButton();
    }, 1000);
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'syncProblem' && request.platform === 'naukri') {
        syncProblem()
            .then(() => sendResponse({success: true}))
            .catch(error => sendResponse({success: false, error: error.message}));
        return true;
    }
});