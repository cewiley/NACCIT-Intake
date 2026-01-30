const intakeForm = document.getElementById("intake-form");
const chatSection = document.getElementById("chat-section");
const intakeSection = document.getElementById("intake-section");
const chatLog = document.getElementById("chat-log");
const chatForm = document.getElementById("chat-form");
const chatInput = chatForm.elements.message;
const optionsEl = document.getElementById("options");
const statusEl = document.getElementById("status");
const resetButton = document.getElementById("reset-button");
const escalateButton = document.getElementById("escalate-button");
const emailTemplateEl = document.getElementById("email-template");
const emailBodyEl = document.getElementById("email-body");
const additionalNotesEl = document.getElementById("additional-notes");
const copyEmailButton = document.getElementById("copy-email");
const mailtoLink = document.getElementById("mailto-link");
const ticketLinkEl = document.getElementById("ticket-link");
const ticketLinkUrl = document.getElementById("ticket-link-url");
const loginContactEl = document.getElementById("login-contact");
const generalContactEl = document.getElementById("general-contact");
const generalMailto = document.getElementById("general-mailto");

const GENERAL_SUPPORT_EMAIL = "NACCITSupport@livenation.com";

let sessionId = null;
let currentNode = null;
let baseEmailTo = "";
let baseEmailSubject = "";
let baseEmailBody = "";

function buildEmailBodyWithNotes(body, notes) {
  if (!notes) return body;
  return `${body}\n\nAdditional notes:\n${notes}`;
}

function syncEmailTemplate() {
  const notes = (additionalNotesEl.value || "").trim();
  const body = buildEmailBodyWithNotes(baseEmailBody, notes);
  emailBodyEl.value = `To: ${baseEmailTo}\nSubject: ${baseEmailSubject}\n\n${body}`;

  const templateMailto = `mailto:${encodeURIComponent(baseEmailTo)}?subject=${encodeURIComponent(baseEmailSubject)}&body=${encodeURIComponent(body)}`;
  mailtoLink.href = templateMailto;

  if (!generalContactEl.classList.contains("hidden")) {
    const generalMailtoHref = `mailto:${encodeURIComponent(GENERAL_SUPPORT_EMAIL)}?subject=${encodeURIComponent(baseEmailSubject)}&body=${encodeURIComponent(body)}`;
    generalMailto.href = generalMailtoHref;
  }
}

function addMessage(role, text) {
  const row = document.createElement("div");
  row.className = `chat-row ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  row.appendChild(bubble);
  chatLog.appendChild(row);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function setStatus(text, type = "") {
  statusEl.textContent = text;
  statusEl.className = `status ${type}`.trim();
}

function toggleChat(active) {
  chatSection.classList.toggle("hidden", !active);
  intakeSection.classList.toggle("hidden", active);
}

function renderOptions(node) {
  optionsEl.innerHTML = "";
  if (!node || !node.options || node.options.length === 0) {
    optionsEl.classList.add("hidden");
    return;
  }

  optionsEl.classList.remove("hidden");
  node.options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option";
    btn.textContent = opt.label;
    btn.addEventListener("click", () => handleOption(opt.id));
    optionsEl.appendChild(btn);
  });
}

function renderNode(node) {
  currentNode = node;
  addMessage("assistant", node.text);
  renderOptions(node);

  if (node.allowFreeform) {
    chatForm.classList.remove("hidden");
    chatInput.placeholder = "Describe the issue briefly...";
  } else {
    chatForm.classList.add("hidden");
  }
}

async function handleOption(choiceId) {
  if (!sessionId) return;
  setStatus("");

  try {
    const response = await fetch("/api/next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, choiceId })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Step error");
    }

    renderNode(data.node);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

intakeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");
  const formData = new FormData(intakeForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch("/api/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to start" );
    }

    sessionId = data.sessionId;
    chatLog.innerHTML = "";
    renderNode(data.node);
    toggleChat(true);
  } catch (error) {
    setStatus(error.message, "error");
  }
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!sessionId || !currentNode || !currentNode.allowFreeform) return;

  const message = chatInput.value.trim();
  if (!message) return;

  addMessage("user", message);
  chatInput.value = "";

  const nextChoice = (currentNode.options || []).find((opt) => opt.id === "other_continue");
  try {
    const response = await fetch("/api/next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message, choiceId: nextChoice ? nextChoice.id : undefined })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Step error");
    }

    renderNode(data.node);
  } catch (error) {
    setStatus(error.message, "error");
  }
});

resetButton.addEventListener("click", () => {
  sessionId = null;
  currentNode = null;
  intakeForm.reset();
  chatLog.innerHTML = "";
  optionsEl.innerHTML = "";
  setStatus("");
  emailTemplateEl.classList.add("hidden");
  emailBodyEl.value = "";
  additionalNotesEl.value = "";
  mailtoLink.href = "#";
  ticketLinkEl.classList.add("hidden");
  ticketLinkUrl.href = "#";
  loginContactEl.classList.add("hidden");
  generalContactEl.classList.add("hidden");
  generalMailto.href = "#";
  baseEmailTo = "";
  baseEmailSubject = "";
  baseEmailBody = "";
  toggleChat(false);
});

escalateButton.addEventListener("click", async () => {
  if (!sessionId) return;
  setStatus("Notifying IT...", "info");

  try {
    const response = await fetch("/api/escalate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Escalation failed");
    }

    let note = "Escalation prepared.";
    if (data.email && data.email.skipped) {
      note += ` Email skipped: ${data.email.reason}.`;
    }
    if (data.jira && data.jira.skipped) {
      note += ` Jira skipped: ${data.jira.reason}.`;
    }
    if (data.jira && data.jira.key) {
      note += ` Jira: ${data.jira.key}`;
    }
    if (data.jira && data.jira.error) {
      note += ` Jira error: ${data.jira.error}`;
    }

    if (data.emailTemplate) {
      baseEmailSubject = data.emailTemplate.subject || "IT Escalation";
      baseEmailBody = data.emailTemplate.body || "";
      baseEmailTo = data.emailTemplate.to || "";
      syncEmailTemplate();
    }

    if (data.ticketLink && data.ticketLink.url) {
      ticketLinkUrl.href = data.ticketLink.url;
      ticketLinkUrl.textContent = data.ticketLink.label || "Open access ticket";
      ticketLinkEl.classList.remove("hidden");
    } else {
      ticketLinkEl.classList.add("hidden");
    }

    const isLogin = data.issueType === "login";
    if (isLogin) {
      emailTemplateEl.classList.remove("hidden");
      generalContactEl.classList.add("hidden");
      loginContactEl.classList.remove("hidden");
    } else {
      emailTemplateEl.classList.add("hidden");
      loginContactEl.classList.add("hidden");
      generalContactEl.classList.remove("hidden");
      baseEmailSubject = data.emailTemplate ? data.emailTemplate.subject || "IT Escalation" : "IT Escalation";
      baseEmailBody = data.emailTemplate ? data.emailTemplate.body || "" : "";
      baseEmailTo = data.emailTemplate ? data.emailTemplate.to || "" : "";
      syncEmailTemplate();
    }

    setStatus(note, "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

copyEmailButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(emailBodyEl.value);
    setStatus("Email template copied.", "success");
  } catch (error) {
    setStatus("Failed to copy email template.", "error");
  }
});

additionalNotesEl.addEventListener("input", () => {
  if (!baseEmailBody) return;
  syncEmailTemplate();
});
