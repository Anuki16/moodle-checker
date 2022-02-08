

document.getElementById("getcourses").addEventListener("click", () => {
    chrome.runtime.sendMessage({type: "getcourses"});
})

document.getElementById("update").addEventListener("click", () => {
    chrome.runtime.sendMessage({type: "update"});
})

window.onload = () => {
    chrome.storage.local.get("changes", (result) => {
        
    })
}