chrome.runtime.onMessage.addListener(handleMessage)

function handleMessage(request, sender, sendResponse) {
    console.log('offscreen got message', request, sender, localStorage.length)
    const n = localStorage.length
    const cfg = []

    for (let i = 0; i < n; i++) {
        const key = localStorage.key(i)
        cfg.push(key)
    }
    sendResponse({ sweet: cfg })
    // XXX return true when sendResponse is called asynchronously
}
