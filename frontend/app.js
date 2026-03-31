const chat = document.getElementById("chat");
const input = document.getElementById("input");
const btn = document.getElementById("send-btn");
const chatList = document.getElementById("chat-list");

var chatHistory = [];
var activeChat = null;

function generateId() {
    return "chat_" + Date.now();
}

function getChats() {
    return JSON.parse(localStorage.getItem("chats") || "[]");
}

function saveChats(chats) {
    localStorage.setItem("chats", JSON.stringify(chats));
}

function getChatMessages(id) {
    var data = localStorage.getItem("msgs_" + id);
    if (!data) return [];
    try {
        var parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch(e) {
        return [];
    }
}

function saveChatMessages(id, messages) {
    localStorage.setItem("msgs_" + id, JSON.stringify(messages));
}

function deleteChatData(id) {
    localStorage.removeItem("msgs_" + id);
}

function renderChatList() {
    chatList.innerHTML = "";
    var chats = getChats();
    chats.forEach(function(c) {
        var item = document.createElement("div");
        item.className = "chat-item" + (c.id === activeChat ? " active" : "");
        item.innerHTML =
            "<span class='chat-item-title'>" + c.title + "</span>" +
            "<span class='chat-item-date'>" + c.date + "</span>" +
            "<button class='delete-chat-btn' title='Delete'>&#x2715;</button>";

        item.querySelector(".chat-item-title").addEventListener("click", function() {
            loadChat(c.id);
        });

        item.querySelector(".chat-item-date").addEventListener("click", function() {
            loadChat(c.id);
        });

        item.querySelector(".delete-chat-btn").addEventListener("click", function(e) {
            e.stopPropagation();
            deleteChat(c.id);
        });

        chatList.appendChild(item);
    });
}

function newChat() {
    var id = generateId();
    var chats = getChats();
    chats.unshift({ id: id, title: "New chat", date: new Date().toLocaleDateString() });
    saveChats(chats);
    saveChatMessages(id, []);
    loadChat(id);
}

function loadChat(id) {
    activeChat = id;
    chatHistory = getChatMessages(id);
    chat.innerHTML = "";
    if (chatHistory.length === 0) {
        renderWelcome();
    } else {
        chatHistory.forEach(function(msg) {
            if (msg.role === "user") {
                addMessage("user", msg.text);
            } else {
                var bubble = addMessage("assistant", "");
                bubble.innerHTML = formatMarkdown(msg.text);
            }
        });
    }
    renderChatList();
    localStorage.setItem("activeChat", id);
}

function deleteChat(id) {
    var chats = getChats().filter(function(c) { return c.id !== id; });
    saveChats(chats);
    deleteChatData(id);
    if (activeChat === id) {
        if (chats.length > 0) {
            loadChat(chats[0].id);
        } else {
            newChat();
        }
    } else {
        renderChatList();
    }
}

function updateChatTitle(id, title) {
    var chats = getChats();
    chats = chats.map(function(c) {
        if (c.id === id) c.title = title.length > 40 ? title.substring(0, 40) + "..." : title;
        return c;
    });
    saveChats(chats);
    renderChatList();
}

function renderWelcome() {
    var div = document.createElement("div");
    div.className = "message assistant";
    div.innerHTML = "<div class='avatar'>\uD83E\uDD16</div><div class='bubble'>Hello! I am your assistant for the <strong>Computing Infrastructure</strong> subject at the University of Oviedo. What questions do you have about the course today?</div>";
    chat.appendChild(div);
}

input.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
    }
});

input.addEventListener("input", function() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 160) + "px";
    input.style.overflowY = input.scrollHeight > 100 ? "auto" : "hidden";
});

function addMessage(role, content, isLoading) {
    isLoading = isLoading || false;
    var div = document.createElement("div");
    div.className = "message " + role;
    var avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = role === "user" ? "You" : "\uD83E\uDD16";
    var bubble = document.createElement("div");
    bubble.className = "bubble" + (isLoading ? " loading" : "");
    if (isLoading) {
        var dots = document.createElement("div");
        dots.className = "typing-dots";
        dots.innerHTML = "<span></span><span></span><span></span>";
        bubble.appendChild(dots);
    } else {
        bubble.textContent = content;
    }
    div.appendChild(avatar);
    div.appendChild(bubble);
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    return bubble;
}

async function send() {
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    input.style.height = "auto";
    input.style.overflowY = "hidden";
    btn.disabled = true;
    var isFirstMessage = chatHistory.length === 0;
    addMessage("user", text);
    chatHistory.push({ role: "user", text: text });
    saveChatMessages(activeChat, chatHistory);
    if (isFirstMessage) {
        updateChatTitle(activeChat, text);
    }
    var loadingBubble = addMessage("assistant", "", true);
    try {
        var res = await fetch("/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text, history: chatHistory })
        });
        if (!res.ok) throw new Error("Server error");
        var data = await res.json();
        loadingBubble.classList.remove("loading");
        loadingBubble.innerHTML = "";
        loadingBubble.innerHTML = formatMarkdown(data.answer);
        chatHistory.push({ role: "assistant", text: data.answer });
        saveChatMessages(activeChat, chatHistory);
    } catch (err) {
        loadingBubble.classList.remove("loading");
        loadingBubble.innerHTML = "";
        loadingBubble.textContent = "Connection error. Is the backend running?";
    }
    btn.disabled = false;
    input.focus();
}

function formatMarkdown(text) {
    var lines = text.split("\n");
    var result = [];
    var inList = false;
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        line = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        line = line.replace(/\*(.*?)\*/g, "<em>$1</em>");
        if (line.match(/^###\s/)) {
            if (inList) { result.push("</ul>"); inList = false; }
            result.push("<h3>" + line.replace(/^###\s/, "") + "</h3>");
        } else if (line.match(/^##\s/)) {
            if (inList) { result.push("</ul>"); inList = false; }
            result.push("<h2>" + line.replace(/^##\s/, "") + "</h2>");
        } else if (line.match(/^#\s/)) {
            if (inList) { result.push("</ul>"); inList = false; }
            result.push("<h1>" + line.replace(/^#\s/, "") + "</h1>");
        } else if (line.match(/^\*\s/) || line.match(/^-\s/)) {
            if (!inList) { result.push("<ul>"); inList = true; }
            result.push("<li>" + line.replace(/^[\*\-]\s/, "") + "</li>");
        } else if (line.trim() === "") {
            if (inList) { result.push("</ul>"); inList = false; }
            result.push("<br>");
        } else {
            if (inList) { result.push("</ul>"); inList = false; }
            result.push("<p>" + line + "</p>");
        }
    }
    if (inList) result.push("</ul>");
    return result.join("");
}

btn.addEventListener("click", send);

var toggleBtn = document.getElementById("toggle-sidebar-btn");
var sidebar = document.getElementById("sidebar");

toggleBtn.addEventListener("click", function() {
    sidebar.classList.toggle("hidden");
});

var themeBtn = document.getElementById("theme-btn");
var dark = localStorage.getItem("theme") === "dark";

if (dark) {
    document.body.classList.add("dark");
    themeBtn.textContent = "Light mode";
}

themeBtn.addEventListener("click", function() {
    dark = !dark;
    document.body.classList.toggle("dark", dark);
    themeBtn.textContent = dark ? "Light mode" : "Dark mode";
    localStorage.setItem("theme", dark ? "dark" : "light");
});

var micBtn = document.getElementById("mic-btn");
var recognition = null;
var isRecording = false;

if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = "";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = function(e) {
        var transcript = e.results[0][0].transcript;
        var textarea = document.getElementById("input");
        textarea.value = transcript;
        textarea.style.height = "auto";
        textarea.style.height = Math.min(textarea.scrollHeight, 160) + "px";
        textarea.style.overflowY = textarea.scrollHeight > 100 ? "auto" : "hidden";
        textarea.focus();
        isRecording = false;
        micBtn.classList.remove("recording");
        micBtn.title = "Voice input";
    };

    recognition.onerror = function(e) {
        isRecording = false;
        micBtn.classList.remove("recording");
    };

    recognition.onend = function() {
        isRecording = false;
        micBtn.classList.remove("recording");
    };

    micBtn.addEventListener("click", function() {
        if (isRecording) {
            recognition.stop();
        } else {
            recognition.start();
            isRecording = true;
            micBtn.classList.add("recording");
            micBtn.title = "Recording... click to stop";
        }
    });
} else {
    micBtn.disabled = true;
    micBtn.title = "Voice input not supported in this browser";
    micBtn.style.opacity = "0.4";
}

document.getElementById("new-chat-btn").addEventListener("click", newChat);

var savedActive = localStorage.getItem("activeChat");
var chats = getChats();
if (savedActive && chats.find(function(c) { return c.id === savedActive; })) {
    loadChat(savedActive);
} else if (chats.length > 0) {
    loadChat(chats[0].id);
} else {
    newChat();
}