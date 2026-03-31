const chat = document.getElementById("chat");
const input = document.getElementById("input");
const btn = document.getElementById("send-btn");
const history = [];

input.addEventListener("keydown", function(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

input.addEventListener("input", function() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 120) + "px";
});

function addMessage(role, content, isLoading) {
  isLoading = isLoading || false;
  var div = document.createElement("div");
  div.className = "message " + role;
  var avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "U" : "\uD83E\uDD16";
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
  btn.disabled = true;
  addMessage("user", text);
  history.push({ role: "user", text: text });
  var loadingBubble = addMessage("assistant", "", true);
  try {
    var res = await fetch("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history: history })
    });
    if (!res.ok) throw new Error("Server error");
    var data = await res.json();
    loadingBubble.classList.remove("loading");
    loadingBubble.innerHTML = "";
    loadingBubble.innerHTML = formatMarkdown(data.answer);
    history.push({ role: "assistant", text: data.answer });
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
