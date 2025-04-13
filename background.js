"use strict";

let HEIGHT = 800;
let WIDTH = 600;
let LEFT = 800;

function randint(min, max) {
    return Math.floor(Math.random()*(max - min + 1)) + min;
}

function tab_loaded(tab_id, avoid = "chrome") {
    return new Promise((resolve, reject) => {
        const on_updated = (id, info) => {
            if (id == tab_id && info.status === "complete") {
                chrome.tabs.get(id, (tab) => {
                    if (!tab.url.includes("login") && !tab.url.includes(avoid)) {
                        chrome.tabs.onUpdated.removeListener(on_updated);
                        console.log("tab loaded");
                        resolve();
                    } else if (tab.url.includes("login")) {
                        chrome.windows.update(tab.windowId, {drawAttention: true});
                    }
                });
            }
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
                for (let item of elem_list) {
                    course_list.push({
                        id: /id=(\d+)/.exec(item.getAttribute("href"))[1],
                        name: item.innerText.trim().split('\n').pop().trim()
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

async function update_course_list(window) {

    let tab = window.tabs[0];
    if (!tab.url) await tab_loaded(tab.id);
    let results = await chrome.scripting.executeScript({
        target: {tabId: tab.id},
        function: get_course_list
    }); 
    let course_list = results[0].result;
    console.log(course_list);
    chrome.storage.local.set({courses: course_list});
    chrome.tabs.remove(tab.id);

    chrome.windows.create({
        url: "course_list.html",
        type: "popup",
        height: 600,
        width: 400
    });
}

async function get_course_contents() {
    
    const got_contents = new Promise((resolve, reject) => {
        function wait_for_load() {
            let elem_list = document.getElementsByClassName("activity");

            if (elem_list.length == 0 && document.readyState != "complete") {
                setTimeout(wait_for_load, 50);
            } else {
                let content_list = [];
                for (let item of elem_list) {
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

let false_positives = ["Play Video", /[0-9]+ (days|day|hours|hour) ago/g, "Mark as done", "Done"];

function compressed_string(string) {
    let comp_string = string;
    for (let item of false_positives) {
        comp_string = comp_string.replaceAll(item, "");
    }
    return comp_string.replaceAll(/[\n\t\s]+/g, "");
}

function compare_contents(prev, cur, course) {
    let change = "";
    let comp_strings = cur.map(compressed_string);

    if (prev[course.id]) {
        let prev_contents = prev[course.id];
        console.log(`${course.id} : prev ${prev_contents.length} cur ${cur.length}`)

        for (let i = 0; i < cur.length; i++) {
            if (!prev_contents.includes(comp_strings[i])) {
                console.log(course.name, comp_strings[i]);
                change = cur[i].split('\n')[0]
                break;
            }
        }
    }
    let drop = randint(0, comp_strings.length);
    //comp_strings.splice(drop, Math.round(Math.random()));
    chrome.storage.local.set({[course.id]: comp_strings});

    if (!change) return;
    chrome.storage.local.get("changes", (result) => {
        if (result.changes) {
            if (!result.changes[course.id] || !result.changes[course.id][1]) {
                notifs += 1
                update_badge(); 
            }
            result.changes[course.id] = [course.name, change];
        } else {
            result.changes = {[course.id]: [course.name, change]};
        }
        chrome.storage.local.set({changes: result.changes});
    });
}

async function check_course(tab, course, resolve) {
    
    if (tab.status != "complete") await tab_loaded(tab.id);
    let results = await chrome.scripting.executeScript({
        target: {tabId: tab.id},
        function: get_course_contents
    });
    
    let contents = results[0].result;
    console.log(`${contents.length} items found`);
    
    chrome.storage.local.get(course.id, (prev) => {
        compare_contents(prev, contents, course);
    });

    resolve();
}

async function check_for_updates(window) {

    let tab = window.tabs[0];
    console.log(`I am at ${tab.id}`);
    if (tab.status != "complete") await tab_loaded(tab.id, null);
    
    chrome.storage.local.get("courses", async (result) => {
        for (let course of result.courses){
            console.log(course.id, course.name);
            let wait_for_update = new Promise((resolve, reject) => {
                chrome.tabs.update(tab.id, {url: `https://online.uom.lk/course/view.php?id=${course.id}`},
                (tab) => {check_course(tab, course, resolve)});
            });
            await wait_for_update;
            console.log("done");
        }
        chrome.tabs.remove(tab.id);
    });
}

function delete_course_change(id) {
    chrome.storage.local.get("changes", (result) => {
        result.changes[id][1] = "";
        chrome.storage.local.set({changes: result.changes});
    });
    notifs -= 1;
    update_badge();
}

function delete_all_changes() {
    chrome.storage.local.get("changes", (result) => {
        for (let id of Object.keys(result.changes)) {
            result.changes[id][1] = "";
        }
        chrome.storage.local.set({changes: result.changes});
    });
    notifs = 0;
    update_badge();
}

function update_badge() {
    if (notifs == 0) {
        chrome.action.setBadgeText({text: ""});
        chrome.action.setBadgeBackgroundColor({color: "#ffffff"});
    } else {
        chrome.action.setBadgeText({text: notifs.toString()});
        chrome.action.setBadgeBackgroundColor({color: "#ff0000"});
    }
}

chrome.runtime.onInstalled.addListener(() => {
    console.log("Installed");
    chrome.storage.local.get("courses", (result) => {
        if (result.courses) return;
        chrome.windows.create({
            url: "https://online.uom.lk/my/courses.php",
            height: HEIGHT,
            width: WIDTH
        }, update_course_list);
    });
})

let notifs = 0;
chrome.storage.local.get("changes", (result) => {
    if (!result.changes) return;
    for (let [id, [name, preview]] of Object.entries(result.changes)) {
        if (preview) notifs += 1;
    }
    update_badge();
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    
    if (message.type == "getcourses") {
        console.log("Updating course list");
        chrome.windows.create({
            url: "https://online.uom.lk/my/courses.php",
            height: HEIGHT,
            width: WIDTH
        }, update_course_list);

    } else if (message.type == "update") {
        console.log("Checking for updates");
        chrome.windows.create({
            height: HEIGHT,
            width: WIDTH
        }, check_for_updates);

    } else if (message.type == "delete") {
        console.log("Got delete message");
        delete_course_change(message.id);

    } else if (message.type == "deleteall") {
        delete_all_changes();
    }

});