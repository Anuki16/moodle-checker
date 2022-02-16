
window.onload = () => {
    chrome.storage.local.get("courses", (result) => {
        console.log(result.courses);
    });
}