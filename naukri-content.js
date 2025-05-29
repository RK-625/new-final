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
        
        // Extract company tags from the Naukri Code 360 page - always from all company containers
        let companyTags = [];
        console.log('Extracting company tags from Naukri Code 360...');

        // --- Simulate Full Mouse/Click Event Chain to Trigger Popup ---
        const askedCompaniesEl = Array.from(document.querySelectorAll('*')).find(
            el => el.textContent && el.textContent.trim().includes('Asked in companies')
        );
        if (askedCompaniesEl) {
            console.log('Found "Asked in companies" element, triggering popup...');
            
            // First try: Full mouse event chain
            ['mouseover', 'mouseenter', 'mousedown', 'mouseup', 'click'].forEach(type => {
                askedCompaniesEl.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
            });
            console.log('Dispatched mouse and click event chain to trigger company popup.');
            await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for popup to appear
            
            // Second try: Direct click (some sites need this)
            try {
                askedCompaniesEl.click();
                console.log('Applied direct click on "Asked in companies" element');
                await new Promise(resolve => setTimeout(resolve, 500)); // Additional wait
            } catch (e) {
                console.log('Direct click failed, continuing with other methods:', e);
            }
        } else {
            console.log('No "Asked in companies" element found for mouse/click simulation.');
        }

        // --- Robust Primary Extraction for c226 elements, with trigger & retry --- 
        const c226Selector = 'div[_ngcontent-serverapp-c226].company-images';
        let c226AttemptCount = 0;

        const performC226Extraction = () => {
            c226AttemptCount++;
            console.log(`C226 Extraction Attempt ${c226AttemptCount}: Querying for "${c226Selector}"`);
            const c226CompanyDivs = document.querySelectorAll(c226Selector);
            console.log(`C226 Extraction Attempt ${c226AttemptCount}: Found ${c226CompanyDivs.length} c226-like company divs.`);
            
            const newlyFoundTags = [];
            c226CompanyDivs.forEach(div => {
                let nameFromSpan = '';
                const nameSpan = div.querySelector('.company-name');
                if (nameSpan && nameSpan.textContent.trim()) {
                    nameFromSpan = nameSpan.textContent.trim();
                    if (nameFromSpan) newlyFoundTags.push(nameFromSpan);
                }
                
                let nameFromImg = '';
                const img = div.querySelector('img.company-img');
                if (img && img.alt && img.alt.trim()) {
                    nameFromImg = img.alt.trim();
                    if (nameFromImg) newlyFoundTags.push(nameFromImg);
                }
                if (nameFromSpan || nameFromImg) {
                    // console.log(`C226 Attempt ${c226AttemptCount}: Extracted: span='${nameFromSpan || 'N/A'}', img_alt='${nameFromImg || 'N/A'}'`);
                }
            });

            newlyFoundTags.forEach(tag => {
                if (!companyTags.includes(tag)) {
                    companyTags.push(tag);
                }
            });
            companyTags = [...new Set(companyTags)].filter(Boolean);
            console.log(`C226 Extraction Attempt ${c226AttemptCount}: Current unique companyTags:`, companyTags);
        };

        performC226Extraction(); // Initial attempt

        if (companyTags.length <= 3) {
            console.log(`Found ${companyTags.length} tags (<=3) after initial c226 attempt. Attempting to find and click a trigger...`);
            
            let triggerElement = null;
            // Try to find 'Asked in companies' or 'Companies asking this question' text elements
            const triggerTexts = ['Asked in companies', 'Companies asking this question'];
            for (const text of triggerTexts) {
                const elements = Array.from(document.querySelectorAll('*')).filter(el => 
                    el.textContent && el.textContent.trim().includes(text) && el.offsetParent !== null // Check if visible
                );
                if (elements.length > 0) {
                    triggerElement = elements[0]; // Take the first visible one
                    console.log(`Found potential trigger element with text: "${text}"`, triggerElement);
                    break;
                }
            }

            if (triggerElement) {
                console.log('Attempting to click trigger element:', triggerElement);
                try {
                    triggerElement.click();
                    console.log('Clicked trigger. Waiting 2 seconds for DOM update...');
                    await new Promise(resolve => setTimeout(resolve, 2000)); 
                    console.log('Performing C226 extraction again after trigger and wait.');
                    performC226Extraction(); // Second attempt after click and wait
                } catch (e) {
                    console.error('Error clicking trigger element or during second C226 extraction:', e);
                }
            } else {
                console.log('No suitable trigger element found to click.');
            }
        }
        console.log('Final companyTags after robust c226 extraction (and potential trigger/retry):', companyTags);
        // --- End of Robust Primary Extraction ---
        
        // Additional extraction methods as fallback (will add to companyTags if new ones are found)
        let companyPopup = null;
        let askedInCompaniesElement = null;
        
        // Look for the popup with "Companies asking this question" title
        document.querySelectorAll('*').forEach(el => {
            if (el.textContent && el.textContent.trim() === 'Companies asking this question') {
                // Found the title, now find the popup container (parent or ancestor)
                let current = el.parentElement;
                while (current && !companyPopup) {
                    if (current.offsetParent !== null && current.children.length > 3) {
                        companyPopup = current;
                        console.log('Found popup container from title');
                        break;
                    }
                    current = current.parentElement;
                    if (!current || current.tagName === 'BODY') break;
                }
            }
        });
        
        // If we didn't find the popup by title, look for visible popups
        if (!companyPopup) {
            const popupSelectors = [
                '.popup', '.popover', '.tooltip', '.dropdown-menu', '.modal',
                '[class*="popup"]', '[class*="popover"]', '[class*="tooltip"]',
                '[class*="company"]', '[class*="companies"]'
            ];
            
            for (const selector of popupSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const el of elements) {
                    if (el.offsetParent !== null) { // Element is visible
                        if (el.textContent.includes('Companies') || el.textContent.includes('company')) {
                            companyPopup = el;
                            console.log(`Found visible popup with selector: ${selector}`);
                            break;
                        }
                    }
                }
                if (companyPopup) break;
            }
        }
        
        // If we still didn't find the popup, look for "Asked in companies" section
        if (!companyPopup) {
            document.querySelectorAll('*').forEach(el => {
                if (el.textContent && (
                    el.textContent.trim() === 'Asked in companies' || 
                    el.textContent.includes('Asked in companies')
                )) {
                    askedInCompaniesElement = el;
                    console.log('Found "Asked in companies" element');
                    
                    // Try to trigger the popup
                    try {
                        // Try click and hover events
                        ['click', 'mouseenter', 'mouseover'].forEach(eventType => {
                            const event = new MouseEvent(eventType, {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            });
                            el.dispatchEvent(event);
                        });
                    } catch (e) {
                        console.log('Error triggering events:', e);
                    }
                }
            });
        }
        
        // STEP 2: Extract company names from the popup if found
        if (companyPopup) {
            console.log('Found company popup, extracting company names...');
            
            // Strategy 1: Look for company items in the popup
            // These are typically elements with both an icon and text
            const companyElements = [];
            
            // Get all elements inside the popup
            const allElements = companyPopup.querySelectorAll('*');
            console.log(`Examining ${allElements.length} elements in popup`);
            
            // First pass: identify elements that look like company items
            allElements.forEach(el => {
                // Skip very small elements or the popup itself
                if (el === companyPopup) return;
                
                // Skip elements with text that's clearly not a company name
                const text = el.textContent.trim();
                if (!text || text.length < 2) return;
                if (text === 'Companies asking this question') return;
                
                // More comprehensive list of generic phrases to exclude
                const genericPhrases = [
                    'Asked in companies', 'View all', 'companies', 'See all', 'and more',
                    'view', 'all', 'more', 'see more', 'show more'
                ];
                if (genericPhrases.some(t => text.toLowerCase() === t.toLowerCase())) return;
                
                // Check if it looks like a company item
                const hasImage = el.querySelector('img, svg') !== null;
                const isReasonableLength = text.length < 100; // Increased from 50 to capture longer company names
                const noCodeCharacters = !text.includes('{') && !text.includes('}') && 
                                         !text.includes('<') && !text.includes('>');
                
                // More lenient criteria to capture more potential companies
                if ((hasImage) || (isReasonableLength && noCodeCharacters)) {
                    companyElements.push(el);
                }
            });
            
            console.log(`Found ${companyElements.length} potential company elements`);
            
            // Second pass: extract company names from the identified elements
            companyElements.forEach(el => {
                const text = el.textContent.trim();
                
                // Clean up the text
                let companyName = text.replace(/\s+/g, ' ').trim();
                
                // Add the company name if it's not already in the list
                if (companyName && companyName.length > 1 && !companyTags.includes(companyName)) {
                    companyTags.push(companyName);
                    console.log(`Found company: ${companyName}`);
                }
                
                // Also check for company names in image attributes
                const img = el.querySelector('img, svg');
                if (img) {
                    const altText = img.getAttribute('alt');
                    const title = img.getAttribute('title');
                    const ariaLabel = img.getAttribute('aria-label');
                    const dataName = img.getAttribute('data-name');
                    const dataCompany = img.getAttribute('data-company');
                    
                    // Check all possible attributes where company name might be stored
                    const possibleNames = [altText, title, ariaLabel, dataName, dataCompany].filter(Boolean);
                    
                    for (const possibleName of possibleNames) {
                        if (possibleName && possibleName.length > 1 && !companyTags.includes(possibleName)) {
                            companyTags.push(possibleName);
                            console.log(`Found company from image attributes: ${possibleName}`);
                        }
                    }
                }
                
                // Look for company name in parent elements too (sometimes companies are in nested elements)
                let parent = el.parentElement;
                if (parent && parent !== companyPopup) {
                    const parentText = parent.textContent.trim();
                    // If parent has a reasonably sized text different from the current element
                    if (parentText && parentText.length > 1 && parentText.length < 100 && 
                        parentText !== text && !companyTags.includes(parentText)) {
                        companyTags.push(parentText);
                        console.log(`Found company from parent element: ${parentText}`);
                    }
                }
            });
            
            // Additional extraction: Look for elements with specific company-related classes or attributes
            const companySpecificSelectors = [
                '[class*="company"]', '[class*="brand"]', '[class*="logo"]',
                '[class*="org"]', '[class*="corporation"]', '[class*="enterprise"]',
                '[data-company]', '[data-organization]', '[data-brand]'
            ];
            
            companySpecificSelectors.forEach(selector => {
                try {
                    const elements = companyPopup.querySelectorAll(selector);
                    elements.forEach(el => {
                        const text = el.textContent.trim();
                        if (text && text.length > 1 && text.length < 100 && !companyTags.includes(text)) {
                            companyTags.push(text);
                            console.log(`Found company from specific selector ${selector}: ${text}`);
                        }
                    });
                } catch (e) {
                    console.log(`Error with selector ${selector}:`, e);
                }
            });
            
            // If we found very few companies, try a more aggressive approach
            if (companyTags.length < 3) {
                console.log('Found few companies, trying text node extraction...');
                
                // Extract text from all nodes in the popup
                const extractTextNodes = (node) => {
                    const texts = [];
                    
                    if (node.nodeType === Node.TEXT_NODE) {
                        const text = node.textContent.trim();
                        if (text && text.length > 1 && text.length < 50) {
                            texts.push(text);
                        }
                    } else if (node.nodeType === Node.ELEMENT_NODE) {
                        // Skip certain elements
                        if (['SCRIPT', 'STYLE', 'META', 'LINK'].includes(node.tagName)) return texts;
                        
                        // Process child nodes
                        for (const child of node.childNodes) {
                            texts.push(...extractTextNodes(child));
                        }
                    }
                    
                    return texts;
                };
                
                const textNodes = extractTextNodes(companyPopup);
                
                // Filter and add company names
                textNodes.forEach(text => {
                    if (text && text.length > 1 && 
                        !['Companies asking this question', 'Asked in companies', 'View all', 'companies', 'See all', 'and more'].some(t => text === t)) {
                        
                        if (!companyTags.includes(text)) {
                            companyTags.push(text);
                            console.log(`Found company from text node: ${text}`);
                        }
                    }
                });
            }
        } else if (askedInCompaniesElement) {
            // If we couldn't find the popup but found the "Asked in companies" section,
            // try to look for company indicators near it
            console.log('No popup found, looking for company indicators near "Asked in companies"');
            
            // Look for elements that might indicate companies
            const parent = askedInCompaniesElement.parentElement;
            const grandparent = parent ? parent.parentElement : null;
            
            if (parent || grandparent) {
                const container = parent || grandparent;
                
                // Look for company icons or badges
                const icons = container.querySelectorAll('img, svg, [class*="icon"], [class*="badge"], [class*="avatar"]');
                icons.forEach(icon => {
                    // Try to get company name from attributes
                    const altText = icon.getAttribute('alt');
                    const title = icon.getAttribute('title');
                    const ariaLabel = icon.getAttribute('aria-label');
                    
                    const possibleName = altText || title || ariaLabel;
                    if (possibleName && possibleName.length > 1 && !companyTags.includes(possibleName)) {
                        companyTags.push(possibleName);
                        console.log(`Found company from icon attributes: ${possibleName}`);
                    }
                });
            }
        }
        
        console.log(`Total companies found: ${companyTags.length}`);
        console.log('All extracted companyTags:', companyTags);
        
        // Clean and validate company tags to meet Notion API requirements
        let validCompanyTags = companyTags
            .filter(tag => {
                // Remove any extremely long tags (likely not real company names)
                if (tag.length > 2000) {
                    console.log(`Removing oversized company tag (${tag.length} chars)`);
                    return false;
                }
                // Remove tags that look like HTML or code
                if (tag.includes('<') && tag.includes('>')) {
                    console.log('Removing HTML-like company tag');
                    return false;
                }
                // Remove tags that are likely problem descriptions or code
                if (tag.length > 100) {
                    console.log('Removing suspiciously long tag (likely not a company name)');
                    return false;
                }
                // Keep valid tags
                return true;
            })
            // Clean up tag text to meet Notion requirements
            .map(tag => {
                // Replace commas with spaces (Notion doesn't allow commas in select options)
                let cleanTag = tag.replace(/,/g, ' ');
                
                // Remove other problematic characters
                cleanTag = cleanTag.replace(/[\[\]{}()\\|]/g, '');
                
                // Trim whitespace and limit length
                cleanTag = cleanTag.trim();
                if (cleanTag.length > 1900) {
                    cleanTag = cleanTag.substring(0, 1900) + '...';
                }
                
                return cleanTag;
            })
            // Remove any empty tags after cleaning
            .filter(tag => tag.length > 0);
        
        // Remove duplicate tags (after cleaning, we might have created duplicates)
        validCompanyTags = [...new Set(validCompanyTags)];
        
        console.log('Before advanced filtering, raw company tags:', validCompanyTags);
        
        // GENERAL APPROACH: Use structural and linguistic patterns to identify company names
        console.log('Using general structural pattern-based filtering for company tags');
        
        // STEP 1: Filter out generic phrases and headers
        validCompanyTags = validCompanyTags.filter(tag => {
            // Skip empty or whitespace-only tags
            if (!tag || !tag.trim()) return false;
            
            // Skip tags that are only punctuation
            if (/^[^\w]*$/.test(tag)) return false;
            
            // Skip common generic phrases and headers (expanded list)
            const lower = tag.toLowerCase().trim();
            const genericPhrases = [
                'asked in companies', 'companies asking this question', 'view all', 
                'see all', 'and more', '|asked in companies', 'companies', 'view', 'all',
                'asking', 'this', 'question', 'companies asking', 'asking this'
            ];
            
            // Reject tags containing generic phrases
            if (genericPhrases.some(phrase => lower.includes(phrase)) || lower.includes('|')) {
                console.log(`Removing generic phrase: "${tag}"`);
                return false;
            }
            
            return true;
        });
        
        // STEP 2: Sort tags by length (shorter tags are more likely to be individual company names)
        validCompanyTags.sort((a, b) => a.length - b.length);
        
        // STEP 3: Group tags by potential company name patterns
        const potentialCompanies = [];
        const rejectedTags = new Set();
        
        // First pass: Identify likely individual company names
        for (const tag of validCompanyTags) {
            // Skip if already rejected
            if (rejectedTags.has(tag)) continue;
            
            // Company name pattern checks
            const wordCount = tag.split(/\s+/).length;
            const hasSpecialChars = /[&()\[\]{}]/.test(tag);
            const isAllCaps = tag === tag.toUpperCase() && tag.length > 1;
            const startsWithCapital = /^[A-Z]/.test(tag);
            
            // Likely a company name if:
            // 1. Short (1-3 words) with no special chars (e.g., "Microsoft", "Tech Mahindra")
            // 2. Contains "&" (common in company names, e.g., "Ernst & Young")
            // 3. Has parentheses (often abbreviations, e.g., "Ernst & Young (EY)")
            const likelyCompany = 
                (wordCount <= 3 && !hasSpecialChars) || 
                tag.includes('&') || 
                /\([A-Z]+\)/.test(tag) || // Abbreviation pattern
                (startsWithCapital && wordCount <= 5);
            
            if (likelyCompany) {
                potentialCompanies.push(tag);
                console.log(`Identified likely company name: "${tag}"`);
            } else {
                rejectedTags.add(tag);
                console.log(`Rejected unlikely company name: "${tag}"`);
            }
        }
        
        // STEP 4: Detect and remove concatenated tags
        const finalCompanies = [];
        
        // Process potential companies from shortest to longest
        potentialCompanies.sort((a, b) => a.length - b.length);
        
        for (const company of potentialCompanies) {
            // Skip if already added
            if (finalCompanies.includes(company)) continue;
            
            // Check if this tag contains any other company names
            const containedCompanies = finalCompanies.filter(c => 
                company !== c && 
                company.toLowerCase().includes(c.toLowerCase())
            );
            
            // If it contains other companies and has many words, it's likely a concatenation
            if (containedCompanies.length > 0 && company.split(/\s+/).length > 3) {
                console.log(`Removing likely concatenated tag: "${company}" contains ${containedCompanies.join(', ')}`);
                continue;
            }
            
            // Check if this is just a concatenation of multiple shorter companies
            let isConcatenation = false;
            
            // Special check for concatenations: look for patterns like "Company1 Company2 Company3"
            if (company.split(/\s+/).length > 3) {
                // Check if this long string contains multiple companies separated by spaces
                const companyWords = company.split(/\s+/);
                let matchCount = 0;
                
                for (const otherCompany of potentialCompanies) {
                    if (otherCompany !== company && company.includes(otherCompany)) {
                        matchCount++;
                    }
                }
                
                // If this tag contains multiple other companies, it's likely a concatenation
                if (matchCount >= 2) {
                    console.log(`Removing concatenated company tag: "${company}" contains multiple other companies`);
                    isConcatenation = true;
                }
            }
            
            // If it passed all checks, add it to the final list
            if (!isConcatenation) {
                finalCompanies.push(company);
            }
        }
        
        // STEP 5: Final cleanup - remove any tags that are substrings of other tags
        // (e.g., if we have both "Ernst" and "Ernst & Young", keep only "Ernst & Young")
        validCompanyTags = finalCompanies.filter(company => {
            const isSubstring = finalCompanies.some(c => 
                c !== company && 
                c.toLowerCase().includes(company.toLowerCase()) &&
                // Only consider it a substring if it's a complete word match
                new RegExp(`\\b${company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(c)
            );
            
            if (isSubstring) {
                console.log(`Removing "${company}" as it's a substring of another company name`);
                return false;
            }
            
            return true;
        });
        
        console.log('After general pattern-based filtering, final company tags:', validCompanyTags);
        
        console.log('After advanced filtering, final company tags:', validCompanyTags);
        
        // Notion has a limit of 100 tags in a multi-select property
        // Limit to 95 to be safe
        if (validCompanyTags.length > 95) {
            console.log(`Limiting company tags from ${validCompanyTags.length} to 95 (Notion limit is 100)`);
            validCompanyTags = validCompanyTags.slice(0, 95);
        }
        
        // DEBUG: Log the tags right before sending to Notion
        console.log('Final validated company tags (to be sent to Notion):', validCompanyTags);
        // Extract solution code
        let solution = '';
        let language = 'cpp'; // Default
        
        // Try to get code from the ace editor
        try {
            const aceEditor = document.querySelector('.ace_editor');
            if (aceEditor && window.ace) {
                const editor = window.ace.edit(aceEditor);
                solution = editor.getValue();
                console.log('Got solution from ace editor');
            }
        } catch (e) {
            console.log('Error accessing ace editor:', e);
        }
        
        // Try to get code from any visible code elements
        if (!solution) {
            try {
                const codeElements = document.querySelectorAll('pre, code, .ace_content, [class*="editor"]');
                for (const el of codeElements) {
                    if (el.textContent && el.textContent.length > 100) {
                        solution = el.textContent;
                        console.log('Got code from element:', el);
                        break;
                    }
                }
            } catch (e) {
                console.log('Error getting code from elements:', e);
            }
        }
        
        return {
            title,
            platform: 'CODE360',
            difficulty,
            topics: ['Data Structures'],
            companyTags: validCompanyTags,
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

// Function to sync problem to Notion (matching GFG implementation)
async function syncProblem(button) {
    if (!button) return;
    
    const originalHTML = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '⏳'; // Show loading
    button.style.cursor = 'wait';
    
    // Extract and validate problem data
    let problemData;
    try {
        problemData = await extractProblemData();
        if (!problemData || !problemData.title || !problemData.url) {
            throw new Error('Could not extract all required problem data');
        }
    } catch (err) {
        button.innerHTML = '✕';
        button.style.background = '#f44336';
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.style.background = 'rgba(255, 255, 255, 0.1)';
            button.disabled = false;
            button.style.cursor = 'pointer';
        }, 1200);
        return;
    }
    
    try {
        // Await response from background
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
    } finally {
        button.style.cursor = 'pointer';
    }
}



// Add sync button to the page (EXACT Xerox of GFG)
function addSyncButton({ id, onClick }) {
    if (document.getElementById(id)) return;

    const button = document.createElement('button');
    button.id = id;
    button.innerHTML = '🚀';
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(5px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        cursor: move;
        z-index: 10000;
        font-size: 28px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    // Add Font Awesome if not already present
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
        document.head.appendChild(link);
    }

    // Make the button draggable
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;
    let dragStartX = 0;
    let dragStartY = 0;
    let wasDragged = false;

    button.addEventListener('mousedown', (e) => {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        wasDragged = false;
        if (e.target === button) {
            isDragging = true;
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            xOffset = currentX;
            yOffset = currentY;
            button.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            button.style.transition = 'none';
            if (Math.abs(e.clientX - dragStartX) > 5 || Math.abs(e.clientY - dragStartY) > 5) {
                wasDragged = true;
            }
        }
    });

    document.addEventListener('mouseup', () => {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
        button.style.transition = 'all 0.3s ease';
    });

    // Add hover effect
    button.addEventListener('mouseover', () => {
        button.style.background = 'rgba(255, 255, 255, 0.2)';
        button.style.transform = `translate(${currentX}px, ${currentY}px) scale(1.1)`;
        button.style.cursor = isDragging ? 'move' : 'pointer';
    });

    button.addEventListener('mouseout', () => {
        button.style.background = 'rgba(255, 255, 255, 0.1)';
        button.style.transform = `translate(${currentX}px, ${currentY}px) scale(1)`;
        button.style.cursor = isDragging ? 'move' : 'pointer';
    });

    // Add click handler (only trigger sync if not a drag)
    button.addEventListener('click', async (e) => {
        if (!wasDragged) {
            try {
                // Pass the button to the onClick handler
                await onClick(button);
            } catch (error) {
                console.error('Error in button click handler:', error);
            }
        }
    });

    document.body.appendChild(button);
}

function addNaukriSyncButton() {
    addSyncButton({
        id: 'naukri-notion-sync-btn',
        onClick: async (button) => {
            console.log('[SYNC] Step 1: Triggering extraction to open popup (no sync)');
            await extractProblemData();
            console.log('[SYNC] Step 1 complete. Waiting for popup to fully render...');
            await new Promise(resolve => setTimeout(resolve, 1800)); // Wait for popup
            console.log('[SYNC] Step 2: Extracting again and syncing to Notion');
            await syncProblem(button);
            console.log('[SYNC] Step 2 complete. Sync attempted.');
        }
    });
}


// Initialize the content script
function initialize() {
    console.log('Initializing Naukri Code 360 to Notion Sync on:', window.location.href);
    
    // Check if this is a problem page
    const isProblemPage = window.location.href.includes('/problems/') || 
                        document.querySelector('.problem') || 
                        document.querySelector('.ace_editor');
    
    if (!isProblemPage) {
        return;
    }
    
    // Add sync button with a delay to ensure DOM is loaded
    setTimeout(() => {
        addNaukriSyncButton();
    }, 1000);
}

// Wait for page to be fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Listen for syncProblem message from popup
chrome.runtime.onMessage && chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.action === 'syncProblem') {
        syncProblem().then(() => {
            sendResponse({ success: true });
        }).catch((error) => {
            sendResponse({ success: false, error: error?.message || 'Sync failed' });
        });
        // Indicate async response
        return true;
    }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'syncProblem' && request.platform === 'naukri') {
        syncProblem()
            .then(() => sendResponse({success: true}))
            .catch(error => sendResponse({success: false, error: error.message}));
        return true;
    }
});
