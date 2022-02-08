
function randint(min, max) {
    return Math.floor(Math.random()*(max - min + 1)) + min;
}

function tab_loaded(tab_id) {
    return new Promise((resolve, reject) => {
        const on_updated = (id, info) => {
            if (id == tab_id && info.status === "complete") resolve();
        }
        chrome.tabs.onUpdated.addListener(on_updated);
    });
}

async function get_course_list() {
     const got_courses = new Promise((resolve, reject) => {
        let block = document.querySelector("[data-block=myoverview]");

        function wait_for_load() {
            let elem_list = block.getElementsByClassName("coursename");

            if (elem_list.length == 0) {
                setTimeout(wait_for_load, 50);
            } else {
                let course_list = []
                console.log(elem_list.length);
                for (item of elem_list) {
                    course_list.push({
                        id: /id=(\d+)/.exec(item.getAttribute("href"))[1],
                        name: item.getElementsByClassName("multiline")[0].innerText.trim()
                    });
                }
                resolve(course_list);
            }
        }
        wait_for_load();
    });
    let results = await got_courses;
    return results;
}

async function update_course_list(tab) {

    if (!tab.url) await tab_loaded(tab.id);
    let results = await chrome.scripting.executeScript({
        target: {tabId: tab.id},
        function: get_course_list
    }); 
    course_list = results[0].result;
    console.log(course_list);
    chrome.storage.local.set({courses: course_list});
    chrome.tabs.remove(tab.id);
}

async function get_course_contents() {
    const got_contents = new Promise((resolve, reject) => {
        function wait_for_load() {
            let elem_list = document.getElementsByClassName("activity");

            if (elem_list.length == 0) {
                setTimeout(wait_for_load, 50);
            } else {
                let content_list = [];
                for (item of elem_list) {
                    content_list.push(item.innerText.trim());
                }
                resolve(content_list);
            }
        }
        wait_for_load();
    });
    let results = await got_contents;
    console.log(results);
    return results;
}

function compare_contents(prev, cur, course) {
    let change = "";
    if (prev[course.id]) {
        prev_contents = prev[course.id];
        for (let i = 0; i < cur.length; i++) {
            if (cur[i] != prev_contents[i]) {
                console.log(course.name, cur[i]);
                change = cur[i].split('\n')[0]
                break;
            }
        }
    }
    let drop = randint(0, cur.length);
    cur.splice(drop, 1);
    chrome.storage.local.set({[course.id]: cur});
    chrome.storage.local.get("changes", (result) => {
        if (result.changes) {
            result.changes[course.id] = [course.name, change];
        } else {
            result.changes = {[course.id]: [course.name, change]};
        }
        chrome.storage.local.set({changes: result.changes});
    });
    console.log("Saved contents");
}

async function check_course(tab, course, resolve) {
    
    if (tab.status != "complete") await tab_loaded(tab.id);
    let results = await chrome.scripting.executeScript({
        target: {tabId: tab.id},
        function: get_course_contents
    });
    
    contents = results[0].result;
    chrome.storage.local.get(course.id, (prev) => {
        compare_contents(prev, contents, course);
    });

    resolve();
}

async function check_for_updates(tab) {
    console.log(`I am at ${tab.id}`);

    chrome.storage.local.get("courses", async (result) => {
        for (course of result.courses.slice(0,5)){
            console.log(course.id, course.name);
            let wait_for_update = new Promise((resolve, reject) => {
                chrome.tabs.update(tab.id, {url: `https://online.uom.lk/course/view.php?id=${course.id}`},
                (tab) => {check_course(tab, course, resolve)});
            });
            await wait_for_update;
            console.log("done");
        }
    });
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!sender.tab) {
        if (message.type == "getcourses") {
            chrome.tabs.create({
                url: "https://online.uom.lk/my/",
                active: true
            }, update_course_list);

        } else if (message.type == "update") {
            chrome.tabs.create({}, check_for_updates);
        }
    } else {
        console.log("This is from tab");
    }
})