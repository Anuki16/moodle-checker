

document.getElementById("getcourses").addEventListener("click", () => {
    chrome.runtime.sendMessage({type: "getcourses"});
})

document.getElementById("update").addEventListener("click", () => {
    chrome.runtime.sendMessage({type: "update"});
})

document.getElementById("ignore").addEventListener("click", () => {
    document.getElementById("notifs").innerHTML = "";
    chrome.runtime.sendMessage({type: "deleteall"});
})

function open_message(id) {
    chrome.tabs.create({url: `https://online.uom.lk/course/view.php?id=${id}`});
    chrome.runtime.sendMessage({type: "delete", id: id});
}

window.onload = () => {
    chrome.storage.local.get("changes", (result) => {
        if (!result.changes) return;
        for (let [id, [name, preview]] of Object.entries(result.changes)) {
            if (!preview) continue;
            console.log(id, name, preview);
            document.getElementById("notifs").insertAdjacentHTML("beforeend",
                `<div class="message" id="course-${id}">
    <p class="course">${name}</p>
    <p class="preview">${preview}</p>
</div>`
            );
            document.getElementById(`course-${id}`).addEventListener("click", () => {open_message(id)});
        }
    })
}