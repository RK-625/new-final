// Default configuration
const DEFAULT_CONFIG = {
    notionApiKey: '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',
    databaseId: '1be5d6016008802998b9ef6a0aeaedbb',
    autoSync: true,
    includeCode: true
};

// Options page script for GFG to Notion Sync
document.addEventListener('DOMContentLoaded', async () => {
    // Get DOM elements with null checks
    const form = document.getElementById('settingsForm');
    const notionApiKey = document.getElementById('notionApiKey');
    const databaseId = document.getElementById('databaseId');
    const defaultSheet = document.getElementById('defaultSheet');
    const autoSync = document.getElementById('autoSync');
    const includeCode = document.getElementById('includeCode');
    const testConnectionBtn = document.getElementById('testConnection');
    const resetSettingsBtn = document.getElementById('resetSettings');
    const status = document.getElementById('status');
    const statusMessage = document.getElementById('statusMessage');
    const totalSynced = document.getElementById('totalSynced');
    const lastSyncTime = document.getElementById('lastSyncTime');

    // Validate required DOM elements
    if (!form || !notionApiKey || !databaseId || !status || !statusMessage) {
        if (status) {
            status.style.display = 'block';
            status.textContent = 'Required DOM elements not found. Please reload or contact support.';
            status.className = 'status-message error';
        } else {
            alert('Required DOM elements not found. Please reload or contact support.');
        }
        return;
    }

    // Load saved settings
    async function loadSettings() {
        try {
            const settings = await chrome.storage.sync.get([
                'notionApiKey',
                'databaseId',
                'defaultSheet',
                'autoSync',
                'includeCode',
                'syncCount',
                'lastSyncTime'
            ]);

            // Load values with defaults - with null checks for each element
            if (notionApiKey) {
                notionApiKey.value = settings.notionApiKey || DEFAULT_CONFIG.notionApiKey;
                notionApiKey.placeholder = DEFAULT_CONFIG.notionApiKey;
            }
            
            if (databaseId) {
                databaseId.value = settings.databaseId || DEFAULT_CONFIG.databaseId;
                databaseId.placeholder = DEFAULT_CONFIG.databaseId;
            }
            
            if (defaultSheet) {
                defaultSheet.value = settings.defaultSheet || '';
            }
            
            // Set checkboxes with null checks
            if (autoSync) {
                autoSync.checked = settings.autoSync !== false; // default to true
            }
            
            if (includeCode) {
                includeCode.checked = settings.includeCode !== false; // default to true
            }

            // Update stats
            if (totalSynced) totalSynced.textContent = settings.syncCount || 0;
            if (lastSyncTime && settings.lastSyncTime) {
                const date = new Date(settings.lastSyncTime);
                lastSyncTime.textContent = date.toLocaleString();
            }

        } catch (error) {
            console.error('Error loading settings:', error);
            showStatus('Error loading settings', 'error');
        }
    }

    // Save settings
    async function saveSettings(e) {
        e.preventDefault();
        
        const saveBtn = form.querySelector('button[type="submit"]');
        if (saveBtn.disabled) return; // Prevent multiple submissions
        
        const originalText = saveBtn.textContent;
        saveBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        saveBtn.disabled = true;

        try {
            const settings = {
                notionApiKey: notionApiKey.value.trim(),
                databaseId: databaseId.value.trim(),
                defaultSheet: defaultSheet.value.trim(),
                autoSync: autoSync.checked,
                includeCode: includeCode.checked
            };

            // Validate required fields
            if (!settings.notionApiKey || !settings.databaseId) {
                throw new Error('Please fill in both Notion API Key and Database ID');
            }

            // Updated validation to accept both ntn_ and secret_ prefixes
            if (!settings.notionApiKey.startsWith('ntn_') && !settings.notionApiKey.startsWith('secret_')) {
                throw new Error('Invalid API key format. It should start with "ntn_" or "secret_"');
            }

            // Validate Database ID format (UUID)
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const cleanDatabaseId = settings.databaseId.replace(/-/g, '');
            if (!uuidRegex.test(settings.databaseId) && cleanDatabaseId.length !== 32) {
                throw new Error('Invalid Database ID format. Please check the ID from your Notion database URL');
            }

            await chrome.storage.sync.set(settings);
            if (testResult.success) {
                status.textContent = 'Connected! Settings saved.';
                status.className = 'status-message success';
                // Immediately save settings so popup updates
                await chrome.storage.sync.set({
                    notionApiKey: apiKey,
                    databaseId: dbId
                });
                // Also update the connection status section visually if present
                if (connectionStatus) {
                    connectionStatus.innerHTML = '<div class="status-indicator connected"><i class="fas fa-check-circle"></i></div> Connected!';
                    connectionStatus.className = 'connection-status success';
                }
            } else {
                status.style.display = 'block';
                status.textContent = 'Settings saved successfully!';
                status.className = 'status-message success';
            }
            showStatus('Settings saved successfully!', 'success');
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;

        } catch (error) {
            console.error('Error saving settings:', error);
            showStatus(error.message, 'error');
        } finally {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    }

    // Test Notion connection
    async function testConnection() {
        if (!testConnectionBtn) return;
        
        const originalText = testConnectionBtn.textContent;
        testConnectionBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Testing...';
        testConnectionBtn.disabled = true;

        try {
            const settings = await chrome.storage.sync.get(['notionApiKey', 'databaseId']);
            
            if (!settings.notionApiKey || !settings.databaseId) {
                throw new Error('Please save your settings first');
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            // Test API connection by fetching database info
            const response = await fetch(`https://api.notion.com/v1/databases/${settings.databaseId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${settings.notionApiKey}`,
                    'Content-Type': 'application/json',
                    'Notion-Version': '2022-06-28'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Connection failed: ${errorData.message || response.statusText}`);
            }

            const databaseInfo = await response.json();
            const databaseName = databaseInfo.title[0]?.plain_text || 'Untitled';
            showStatus(`✅ Connection successful! Database: "${databaseName}"`, 'success');

        } catch (error) {
            console.error('Connection test failed:', error);
            showStatus(`❌ ${error.message}`, 'error');
        } finally {
            if (testConnectionBtn) {
                testConnectionBtn.innerHTML = originalText;
                testConnectionBtn.disabled = false;
            }
        }
    }

    // Reset all settings
    async function resetSettings() {
        if (!confirm('Are you sure you want to reset all settings? This action cannot be undone.')) {
            return;
        }

        try {
            await chrome.storage.sync.clear();
            
            // Clear form
            notionApiKey.value = '';
            databaseId.value = '';
            defaultSheet.value = '';
            autoSync.checked = true;
            includeCode.checked = true;
            
            // Reset stats
            totalSynced.textContent = '0';
            lastSyncTime.textContent = 'Never';

            showStatus('All settings have been reset', 'info');

        } catch (error) {
            console.error('Error resetting settings:', error);
            showStatus('Error resetting settings', 'error');
        }
    }

    // Show status message
    function showStatus(message, type) {
        if (!statusMessage || !status) return;
        
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        status.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (status) status.style.display = 'none';
        }, 5000);
    }

    // Copy database template
    function copyDatabaseTemplate() {
        const template = `Database Properties:
1. Question Name (Title)
2. Platform (Select) - Options: GFG, LeetCode, HackerRank
3. Difficulty (Select) - Options: Easy, Medium, Hard
4. Topic (Multi-select) - Options: Arrays, Strings, Trees, etc.
5. Companies (Multi-select) - For company tags
6. Interview (Multi-select) - For interview tags
7. Question URL (URL)
8. Created time (Created time)
9. Sheet (Select) - Optional category/sheet name`;

        navigator.clipboard.writeText(template).then(() => {
            showStatus('Database template copied to clipboard!', 'success');
        }).catch(() => {
            showStatus('Failed to copy template', 'error');
        });
    }

    // Function to test Notion connection
    async function testNotionConnection(apiKey, dbId) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            const response = await fetch('https://api.notion.com/v1/databases/' + dbId, {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + apiKey,
                    'Notion-Version': '2022-06-28'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(response.status === 401 ? 'Invalid API key' : 
                              response.status === 404 ? 'Database not found' : 
                              'Connection failed');
            }

            const data = await response.json();
            return { 
                success: true,
                title: data.title?.[0]?.plain_text || 'Untitled Database'
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                return { success: false, error: 'Connection timed out' };
            }
            return { success: false, error: error.message };
        }
    }

    // Show/hide configuration section with smooth animation
    const showConfigBtn = document.getElementById('showConfig');
    const configDetails = document.querySelector('.config-details');
    const connectionStatus = document.querySelector('.connection-status');

    let isConfigVisible = false;

    showConfigBtn.addEventListener('click', () => {
        isConfigVisible = !isConfigVisible;
        configDetails.style.display = 'block'; // Always set display first
        
        // Use requestAnimationFrame to ensure display: block has taken effect
        requestAnimationFrame(() => {
            configDetails.style.opacity = isConfigVisible ? '1' : '0';
            configDetails.style.transform = isConfigVisible ? 'translateY(0)' : 'translateY(-10px)';
            
            showConfigBtn.innerHTML = isConfigVisible ? 
                '<i class="fas fa-eye-slash"></i> Hide Configuration' : 
                '<i class="fas fa-cog"></i> Show Configuration';
                
            // Hide the element after animation completes
            if (!isConfigVisible) {
                setTimeout(() => {
                    if (!isConfigVisible) { // Double-check state hasn't changed
                        configDetails.style.display = 'none';
                    }
                }, 300); // Match this with the CSS transition duration
            }
        });
    });

    // Function to update connection status
    function updateConnectionStatus(message, isSuccess = false) {
        if (!connectionStatus) return;
        const statusIndicator = connectionStatus.querySelector('.status-indicator');
        if (!statusIndicator) return;
        statusIndicator.innerHTML = `<i class="fas fa-sync-alt"></i> ${message}`;
        statusIndicator.className = `status-indicator ${isSuccess ? 'connected' : 'error'}`;
    }

    // Test connection handler
    testConnectionBtn.addEventListener('click', async () => {
        const apiKey = notionApiKey.value.trim() || DEFAULT_CONFIG.notionApiKey;
        const dbId = databaseId.value.trim() || DEFAULT_CONFIG.databaseId;
        
        testConnectionBtn.disabled = true;
        const originalText = testConnectionBtn.innerHTML;
        testConnectionBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        
        try {
            const response = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Notion-Version': '2022-06-28'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Connection failed: ${errorData.message || response.statusText}`);
            }

            const databaseInfo = await response.json();
            const databaseName = databaseInfo.title[0]?.plain_text || 'Untitled';
            
            // CRITICAL FIX: Save API key and DB ID to chrome.storage.sync
            // This ensures the popup will recognize valid config immediately
            await chrome.storage.sync.set({
                notionApiKey: apiKey,
                databaseId: dbId
            });
            
            updateConnectionStatus(`Connected to "${databaseName}"`, true);
            showStatus(`✅ Connection successful! Database: "${databaseName}". Settings saved.`, 'success');
            
            // Update UI to show connected state
            if (connectionStatus) {
                connectionStatus.innerHTML = `<div class="status-indicator connected"><i class="fas fa-check-circle"></i></div> Connected to "${databaseName}"`;
            }
            
            // Ensure the Test Connection button is restored
            testConnectionBtn.innerHTML = originalText;
            testConnectionBtn.disabled = false;
        } catch (error) {
            console.error('Connection test failed:', error);
            updateConnectionStatus(error.message, false);
            showStatus(`❌ ${error.message}`, 'error');
        } finally {
            // Always restore the button state, regardless of success or failure
            if (testConnectionBtn) {
                testConnectionBtn.disabled = false;
                testConnectionBtn.innerHTML = originalText;
                testConnectionBtn.classList.remove('active');
                
                // Force browser to repaint button
                setTimeout(() => {
                    if (testConnectionBtn) {
                        testConnectionBtn.blur();
                    }
                }, 100);
            }
        }
    });

    // Function to test write permissions
    async function createTestPage(apiKey, dbId) {
        try {
            const response = await fetch('https://api.notion.com/v1/pages', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Notion-Version': '2022-06-28'
                },
                body: JSON.stringify({
                    parent: { database_id: dbId },
                    properties: {
                        'Question Name': {
                            title: [{
                                text: { content: 'Test Connection' }
                            }]
                        }
                    }
                })
            });

            if (!response.ok) {
                return { success: false, error: 'Write permission test failed' };
            }

            const result = await response.json();
            
            // Clean up the test page
            try {
                await fetch(`https://api.notion.com/v1/blocks/${result.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Notion-Version': '2022-06-28'
                    }
                });
            } catch (error) {
                console.warn('Could not cleanup test page:', error);
                // Don't fail the test just because cleanup failed
            }

            return { success: true, pageId: result.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Event listeners with null checks
    if (form) {
        form.addEventListener('submit', saveSettings);
    }
    
    if (testConnectionBtn) {
        testConnectionBtn.addEventListener('click', testConnection);
    }
    
    if (resetSettingsBtn) {
        resetSettingsBtn.addEventListener('click', resetSettings);
    }

    // Add copy template button
    const instructionsSection = document.querySelector('.instructions');
    if (instructionsSection) {
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'btn btn-secondary';
        copyBtn.style.marginTop = '15px';
        copyBtn.textContent = '📋 Copy Database Template';
        copyBtn.addEventListener('click', copyDatabaseTemplate);
        instructionsSection.appendChild(copyBtn);
    }

    // Load settings on page load
    try {
        await loadSettings();
    } catch (error) {
        console.error('Error during initialization:', error);
        showStatus('Error initializing settings', 'error');
    }

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync') {
            loadSettings().catch(error => {
                console.error('Error reloading settings:', error);
            });
        }
    });

    // Auto-save on input change (debounced)
    let saveTimeout;
    const inputElements = [notionApiKey, databaseId, defaultSheet].filter(Boolean);
    inputElements.forEach(input => {
        input.addEventListener('input', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                if (notionApiKey?.value && databaseId?.value) {
                    form.dispatchEvent(new Event('submit'));
                }
            }, 1000);
        });
    });

    const checkboxElements = [autoSync, includeCode].filter(Boolean);
    checkboxElements.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            form.dispatchEvent(new Event('submit'));
        });
    });
});
