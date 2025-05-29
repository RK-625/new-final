// Background script for GFG to Notion Sync
chrome.runtime.onInstalled.addListener(() => {
    console.log('GFG to Notion Sync extension installed');
});

chrome.runtime.onStartup.addListener(() => {
    console.log('GFG to Notion Sync extension started');
});

// Default configuration
const DEFAULT_CONFIG = {
    notionApiKey: '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',
    databaseId: '1be5d6016008802998b9ef6a0aeaedbb',
    autoSync: true,
    includeCode: true
};

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'syncToNotion') {
        (async () => {
            try {
                // Use defaults if not provided
                let data = request.data || {};
                if (!data.notionApiKey) data.notionApiKey = DEFAULT_CONFIG.notionApiKey;
                if (!data.databaseId) data.databaseId = DEFAULT_CONFIG.databaseId;

                // Validate required fields
                if (!data.title || !data.url) {
                    sendResponse({ success: false, error: 'Missing required problem data fields' });
                    return;
                }

                // Sync to Notion
                const result = await syncProblemToNotion(data);
                sendResponse({ success: true, result });
            } catch (error) {
                console.error('Error in syncToNotion:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
});

// Function to map language codes to Notion-supported languages
function mapLanguageToNotion(language) {
    const languageMap = {
        'cpp': 'c++',
        'c++': 'c++',
        'java': 'java',
        'python': 'python',
        'javascript': 'javascript',
        'js': 'javascript',
        'c': 'c',
        'csharp': 'c#',
        'c#': 'c#',
        'go': 'go',
        'rust': 'rust',
        'php': 'php',
        'ruby': 'ruby',
        'swift': 'swift',
        'kotlin': 'kotlin',
        'scala': 'scala',
        'perl': 'perl',
        'r': 'r',
        'matlab': 'matlab',
        'sql': 'sql',
        'html': 'html',
        'css': 'css',
        'json': 'json',
        'xml': 'xml',
        'yaml': 'yaml',
        'markdown': 'markdown',
        'bash': 'bash',
        'shell': 'bash',
        'powershell': 'powershell'
    };

    const normalizedLang = (language || 'javascript').toLowerCase();
    return languageMap[normalizedLang] || 'plain text';
}

// Function to get settings with defaults
async function getSettings() {
    const settings = await chrome.storage.sync.get([
        'notionApiKey',
        'databaseId',
        'defaultSheet',
        'autoSync',
        'includeCode'
    ]);

    return {
        notionApiKey: settings.notionApiKey || DEFAULT_CONFIG.notionApiKey,
        databaseId: settings.databaseId || DEFAULT_CONFIG.databaseId,
        defaultSheet: settings.defaultSheet || '',
        autoSync: settings.autoSync ?? DEFAULT_CONFIG.autoSync,
        includeCode: settings.includeCode ?? DEFAULT_CONFIG.includeCode
    };
}

// Function to sync problem data to Notion
async function syncProblemToNotion(problemData) {
    try {
        // Get stored settings
        const settings = await getSettings();
        
        if (!settings.notionApiKey || !settings.databaseId) {
            throw new Error('Please configure Notion API key and Database ID in extension options');
        }

        // Map the language to a Notion-supported language
        const notionLanguage = mapLanguageToNotion(problemData.language);

        // Create Notion page
        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.notionApiKey}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                parent: {
                    database_id: settings.databaseId
                },
                properties: {
                    'Question Name': {
                        title: [
                            {
                                text: {
                                    content: problemData.title
                                }
                            }
                        ]
                    },
                    'Platform': {
                        select: {
                            name: problemData.platform
                        }
                    },
                    'Difficulty': {
                        select: {
                            name: problemData.difficulty
                        }
                    },
                    'Topic': {
                        multi_select: problemData.topics.map(topic => ({ name: topic }))
                    },
                    'Companies': {
                        multi_select: (problemData.companyTags || []).map(company => ({ name: company }))
                    },
                    'Interview': {
                        multi_select: (problemData.interviewTags || []).map(tag => ({ name: tag }))
                    },
                    'Question URL': {
                        url: problemData.url
                    },
                    'Created time': {
                        date: {
                            start: new Date().toISOString()
                        }
                    }
                },
                children: [
                    {
                        object: 'block',
                        type: 'code',
                        code: {
                            rich_text: [
                                {
                                    type: 'text',
                                    text: {
                                        content: problemData.solution || 'No solution code captured'
                                    }
                                }
                            ],
                            language: notionLanguage
                        }
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Notion API error: ${errorData.message || response.statusText}`);
        }

        const result = await response.json();
        console.log('Successfully synced to Notion:', result);
        return result;

    } catch (error) {
        console.error('Error syncing to Notion:', error);
        throw error;
    }
}

// Function to show notification
function showNotification(title, message, type = 'basic') {
    chrome.notifications.create({
        type: type,
        iconUrl: 'images/icon48.png',
        title: title,
        message: message
    });
}

async function handleSync(problemData, sendResponse) {
    try {
        const settings = await getSettings();

        // Get the problem data from the request
        const { title, url, difficulty, topics, solution, language } = problemData;

        // Validate required fields
        if (!title || !url || !difficulty || !topics || !language) {
            throw new Error('Missing required problem data fields');
        }

        // If autoSync is disabled, show a notification and return
        if (!settings.autoSync) {
            showNotification('Auto Sync Disabled', 'Please enable auto-sync in the extension settings', 'basic');
            sendResponse({ success: false, message: 'Auto sync is disabled' });
            return;
        }

        // Sync the problem to Notion
        const result = await syncProblemToNotion(problemData);

        // Show success notification
        showNotification('Sync Successful', `Problem "${title}" synced to Notion`, 'basic');
        sendResponse({ success: true, result });
    } catch (error) {
        console.error('Error in handleSync:', error);
        showNotification('Sync Error', error.message, 'basic');
        sendResponse({ success: false, error: error.message });
    }
}
