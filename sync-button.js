// Shared sync button logic for GFG and Naukri
// Usage: addSyncButton({ id, onClick })

export function addSyncButton({ id, onClick }) {
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
        cursor: pointer;
        z-index: 2147483647;
        font-size: 28px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    button.addEventListener('click', async () => {
        button.style.cursor = 'wait';
        try {
            await onClick(button);
            button.innerHTML = '✅';
            setTimeout(() => {
                button.innerHTML = '🚀';
            }, 1000);
        } catch (error) {
            button.innerHTML = '❌';
            setTimeout(() => {
                button.innerHTML = '🚀';
            }, 1000);
        } finally {
            button.style.cursor = 'pointer';
        }
    });
    document.body.appendChild(button);
}
