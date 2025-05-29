// Popup script for GFG to Notion Sync
document.addEventListener('DOMContentLoaded', async () => {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const syncBtn = document.getElementById('syncBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const syncCount = document.getElementById('syncCount');
    const lastSync = document.getElementById('lastSync');
    // Reduce container margin/padding to remove extra empty space
    const container = document.querySelector('.container');
    if (container) {
        container.style.paddingBottom = '8px';
        container.style.marginBottom = '0px';
    }

    // Check configuration status
    async function checkConfiguration() {
        try {
            // Get API key and DB ID from DEFAULT_CONFIG if needed
            const DEFAULT_CONFIG = {
                notionApiKey: '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',
                databaseId: '1be5d6016008802998b9ef6a0aeaedbb'
            };
            
            const settings = await chrome.storage.sync.get(['notionApiKey', 'databaseId', 'syncCount', 'lastSyncTime']);
            
            // Use default values if not set in storage
            const apiKey = settings.notionApiKey || DEFAULT_CONFIG.notionApiKey;
            const dbId = settings.databaseId || DEFAULT_CONFIG.databaseId;
            
            // Force check if valid configuration exists
            if (apiKey && dbId) {
                if (statusIndicator) {
                    statusIndicator.className = 'status-indicator connected';
                    statusIndicator.innerHTML = '<i class="fas fa-check-circle"></i>';
                    statusIndicator.style.background = 'rgba(76, 175, 80, 0.18)';
                }
                
                if (statusText) {
                    statusText.innerHTML = '<span style="color:#7fffa5;font-weight:600;"><i class="fas fa-check-circle"></i> Ready to sync</span>';
                }
                
                if (syncBtn) syncBtn.disabled = false;
                
                // Save default configuration to ensure consistency
                if (!settings.notionApiKey || !settings.databaseId) {
                    await chrome.storage.sync.set({
                        notionApiKey: apiKey,
                        databaseId: dbId
                    });
                }
            } else {
                if (statusIndicator) {
                    statusIndicator.className = 'status-indicator error';
                    statusIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
                    statusIndicator.style.background = 'rgba(244, 67, 54, 0.20)';
                }
                
                if (statusText) {
                    statusText.innerHTML = '<span style="color:#ffb8b8;font-weight:600;"><i class="fas fa-exclamation-triangle"></i> Configuration needed</span>';
                }
                
                if (syncBtn) syncBtn.disabled = true;
            }

            // Update stats with null checks
            if (syncCount) syncCount.textContent = settings.syncCount || 0;
            if (lastSync && settings.lastSyncTime) {
                const lastSyncDate = new Date(settings.lastSyncTime);
                lastSync.textContent = lastSyncDate.toLocaleDateString();
            }

        } catch (error) {
            console.error('Error checking configuration:', error);
            if (statusIndicator) {
                statusIndicator.className = 'status-indicator error';
                statusIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
                statusIndicator.style.background = 'rgba(244, 67, 54, 0.20)';
            }
            if (statusText) {
                statusText.innerHTML = '<span style="color:#ffb8b8;font-weight:600;"><i class="fas fa-exclamation-triangle"></i> Configuration error</span>';
            }
            if (syncBtn) syncBtn.disabled = true;
        }
    }

    // Check if current tab is a supported problem page (GFG or Naukri Code 360)
    async function checkCurrentPage() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Check for GeeksforGeeks
            const isGFG = tab.url.includes('geeksforgeeks.org/problems/');
            
            // Check for Naukri Code 360
            const isNaukri = tab.url.includes('naukri.com/code360/') || 
                          tab.url.includes('/problems/') && 
                          (tab.url.includes('naukri') || tab.url.includes('code360'));
            
            if (!isGFG && !isNaukri) {
                syncBtn.textContent = '🚀';
                syncBtn.disabled = true;
                return false;
            }
            
            // Just show rocket emoji
            syncBtn.textContent = '🚀';
            
            return true;
        } catch (error) {
            console.error('Error checking current page:', error);
            return false;
        }
    }

    // Sync current problem
    async function syncCurrentProblem() {
        const originalText = syncBtn.innerHTML;
        syncBtn.disabled = true;
        syncBtn.innerHTML = '<div class="loading"></div> Syncing...';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Determine which platform we're on
            const isGFG = tab.url.includes('geeksforgeeks.org/problems/');
            const isNaukri = tab.url.includes('naukri.com/code360/') || 
                         (tab.url.includes('/problems/') && 
                         (tab.url.includes('naukri') || tab.url.includes('code360')));
        
            // Send message to the appropriate content script
            const response = await chrome.tabs.sendMessage(tab.id, { 
                action: 'syncProblem',
                platform: isNaukri ? 'naukri' : 'gfg'
            });
        
            if (response && response.success) {
                // Update sync count
                const currentCount = await chrome.storage.sync.get(['syncCount']);
                const newCount = (currentCount.syncCount || 0) + 1;
                await chrome.storage.sync.set({
                    syncCount: newCount,
                    lastSyncTime: new Date().getTime()
                });
            
                // Update UI
                syncCount.textContent = newCount;
                lastSync.textContent = new Date().toLocaleDateString();

                // Success message
                syncBtn.innerHTML = '✅';
                setTimeout(() => {
                    // Just show rocket emoji
                    syncBtn.innerHTML = '🚀';
                    syncBtn.disabled = false;
                }, 2000);
            } else {
                throw new Error(response?.error || 'Sync failed');
            }

        } catch (error) {
            console.error('Error syncing problem:', error);
            syncBtn.innerHTML = '❌ Sync Failed';
            setTimeout(async () => {
                // Reset button text
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                const isNaukri = tab.url.includes('naukri.com/code360/') || 
                             (tab.url.includes('/problems/') && 
                             (tab.url.includes('naukri') || tab.url.includes('code360')));
                             
                syncBtn.innerHTML = '🚀';
                syncBtn.disabled = false;
            }, 2000);
        }
    }

    // Open settings page
    function openSettings() {
        chrome.runtime.openOptionsPage();
        // Do NOT close window, so popup can update dynamically
    }

    // Listen for changes in storage and update status dynamically
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && (changes.notionApiKey || changes.databaseId)) {
            checkConfiguration();
        }
    });

    // Event listeners
    syncBtn.addEventListener('click', syncCurrentProblem);
    settingsBtn.addEventListener('click', openSettings);

    // Initialize
    await checkConfiguration();
    await checkCurrentPage();

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync') {
            checkConfiguration();
        }
    });
});
