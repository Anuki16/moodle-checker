
window.onload = () => {
    chrome.storage.local.get("courses", (result) => {
        for (let course of result.courses) {
            let id = course.id;
            let name = course.name;
            document.getElementById("checklist").insertAdjacentHTML("beforeend", 
            `<label for="c${id}"><input type="checkbox" name="course" value="${id}" id="c${id}">${name}</label><br/>`);
        }
    });
}

document.getElementById("close").addEventListener("click", () => {
    chrome.windows.getCurrent((window) => {chrome.windows.remove(window.id)});
});

document.getElementById("remove").addEventListener("click", () => {
    let remove_courses = [];
    for (let course of document.querySelectorAll("input[name='course']:checked")) {
        remove_courses.push(course.value);
        course.parentNode.remove();
    }
    chrome.storage.local.get("courses", (result) => {
        let courses = result.courses.filter(course => !remove_courses.includes(course.id))
        chrome.storage.local.set({courses: courses});
    })
})