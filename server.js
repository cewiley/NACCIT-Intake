require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const IT_NOTIFY_EMAIL = process.env.IT_NOTIFY_EMAIL || "";
const EMAIL_SUBJECT_PREFIX = process.env.EMAIL_SUBJECT_PREFIX || "[IT Intake]";
const LOGIN_TICKET_URL = process.env.LOGIN_TICKET_URL || "";
const LOGIN_TICKET_LABEL = process.env.LOGIN_TICKET_LABEL || "Open access ticket";

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "https://jira.livenation.com";
const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";
const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY || "FXCCIT";
const JIRA_ISSUE_TYPE = process.env.JIRA_ISSUE_TYPE || "Bug";

const sessions = new Map();

app.use(express.json({ limit: "1mb" }));

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const tree = {
  start: {
    text: "Thanks! Pick the issue type so I can guide you through quick checks.",
    options: [
      { id: "login", label: "Login / Password" , next: "login" },
      { id: "network", label: "Network / Internet" , next: "network" },
      { id: "software", label: "Software install / update" , next: "software" },
      { id: "hardware", label: "Hardware / device" , next: "hardware" },
      { id: "other", label: "Other" , next: "other" }
    ]
  },
  login: {
    text: "Try these steps:\n1) Confirm your username is correct and not auto-filled.\n2) Try your last known password carefully (check Caps Lock).\n3) Use the password reset link if available.\n4) Try a private/incognito browser window.\n5) If MFA is required, confirm your device/time are correct.\n\nDid that help?",
    options: [
      { id: "login_resolved", label: "Yes, I can log in now", next: "resolved" },
      { id: "login_still", label: "No, still locked out", next: "login_more" }
    ]
  },
  login_more: {
    text: "Next checks:\n1) Try resetting your password and wait 5 minutes for propagation.\n2) If you have multiple accounts, use the correct domain.\n3) Try a different device or network.\n\nStill stuck?",
    options: [
      { id: "login_more_resolved", label: "Resolved", next: "resolved" },
      { id: "login_more_still", label: "Still broken", next: "escalate" }
    ]
  },
  network: {
    text: "Try these steps:\n1) Check Wi-Fi/Ethernet is connected.\n2) Toggle airplane mode or restart your network adapter.\n3) Try a different network (hotspot).\n4) Restart the device.\n5) Check if coworkers are impacted.\n\nDid that help?",
    options: [
      { id: "net_resolved", label: "Yes, network is back", next: "resolved" },
      { id: "net_still", label: "Still having issues", next: "network_more" }
    ]
  },
  network_more: {
    text: "Next checks:\n1) Run a speed test and note the results.\n2) If using VPN, disconnect/reconnect.\n3) Check if only one site/app is affected.\n\nStill stuck?",
    options: [
      { id: "net_more_resolved", label: "Resolved", next: "resolved" },
      { id: "net_more_still", label: "Still broken", next: "escalate" }
    ]
  },
  software: {
    text: "Try these steps:\n1) Reboot the computer.\n2) Close the app fully (Task Manager) and reopen.\n3) Check for updates.\n4) If install failed, check available disk space.\n5) Try reinstalling.\n\nDid that help?",
    options: [
      { id: "sw_resolved", label: "Yes, it works now", next: "resolved" },
      { id: "sw_still", label: "Still broken", next: "software_more" }
    ]
  },
  software_more: {
    text: "Next checks:\n1) Capture the exact error message or screenshot.\n2) Note the app version and OS version.\n3) Try running as administrator.\n\nStill stuck?",
    options: [
      { id: "sw_more_resolved", label: "Resolved", next: "resolved" },
      { id: "sw_more_still", label: "Still broken", next: "escalate" }
    ]
  },
  hardware: {
    text: "Try these steps:\n1) Check all cables/power connections.\n2) Restart the device.\n3) If it’s a peripheral, try a different port.\n4) Test on another device if possible.\n\nPick the hardware type:",
    options: [
      { id: "hw_monitor", label: "Monitor / Display", next: "hardware_monitor" },
      { id: "hw_battery", label: "Battery / Power", next: "hardware_battery" },
      { id: "hw_dock", label: "Docking station", next: "hardware_dock" },
      { id: "hw_other", label: "Other hardware", next: "hardware_monitor_more" }
    ]
  },
  hardware_monitor: {
    text: "Monitor checks:\n1) Confirm the monitor is powered on and the input source is correct.\n2) Reseat the power cable to the dock.\n3) Try a different port on the monitor/dock.\n4) Test the monitor on another device if possible.\n5) Reseat the video cable (HDMI/DP/USB‑C) and try another cable if available.\n\nDid that help?",
    options: [
      { id: "hw_mon_resolved", label: "Resolved", next: "resolved" },
      { id: "hw_mon_still", label: "Still broken", next: "hardware_monitor_more" }
    ]
  },
  hardware_battery: {
    text: "Battery / power checks:\n1) Try reinserting the power cable from the wall to the docking station.\n2) Try a different wall outlet and cable if possible.\n3) Check for any charging indicator lights.\n4) If using USB‑C, try a different port.\n5) Reboot and confirm battery level changes.\n\nDid that help?",
    options: [
      { id: "hw_bat_resolved", label: "Resolved", next: "resolved" },
      { id: "hw_bat_still", label: "Still broken", next: "hardware_more" }
    ]
  },
  hardware_dock: {
    text: "Docking station checks:\n1) Power cycle the dock (unplug power and USB‑C, wait 10 seconds, reconnect).\n2) Verify the dock power adapter is connected.\n3) Try a different USB‑C/TB port on the laptop.\n4) Test a single peripheral at a time (monitor, keyboard, etc.).\n5) If the dock has firmware, confirm it’s up to date.\n\nDid that help?",
    options: [
      { id: "hw_dock_resolved", label: "Resolved", next: "resolved" },
      { id: "hw_dock_still", label: "Still broken", next: "hardware_more" }
    ]
  },
  
  hardware_more: {
    text: "Next checks:\n1) Note any indicator lights or error codes.\n2) Check if the device is detected in OS settings.\n3) Provide model/serial if available.\n\nStill stuck?",
    options: [
      { id: "hw_more_resolved", label: "Resolved", next: "resolved" },
      { id: "hw_more_still", label: "Still broken", next: "escalate" }
    ]
  },
    hardware_monitor_more: {
    text: "Next checks:\n1) Note any indicator lights or error codes.\n2) Check if the device is detected in OS settings (Settings > System > Display).\n3) .\n\nStill stuck?",
    options: [
      { id: "hw_mon_more_resolved", label: "Resolved", next: "resolved" },
      { id: "hw_mon_more_still", label: "Still broken", next: "escalate" }
    ]
  },
  other: {
    text: "Please briefly describe the issue. I'll suggest a few generic checks.",
    allowFreeform: true,
    options: [
      { id: "other_continue", label: "Continue", next: "generic" }
    ]
  },
  generic: {
    text: "Generic checks:\n1) Restart the app and device.\n2) Check for updates.\n3) Try from another browser or device.\n4) Note any exact error message.\n\nDid that help?",
    options: [
      { id: "gen_resolved", label: "Resolved", next: "resolved" },
      { id: "gen_still", label: "Still broken", next: "escalate" }
    ]
  },
  resolved: {
    text: "Great! glad it's working now. If the issue returns, you can come back and escalate.",
    options: []
  },
  escalate: {
    text: "Thanks. Click 'Notify IT team' below and I'll send your details to the team.",
    options: []
  }
};

function newSessionId() {
  return crypto.randomBytes(16).toString("hex");
}

function getDayStamp() {
  return new Date().toISOString();
}

function buildTranscript(messages) {
  return messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");
}

function buildEmailTemplate(session, transcript) {
  const subject = `${EMAIL_SUBJECT_PREFIX} ${session.summary}`;
  const body = `A user requested escalation after decision-tree troubleshooting.\n\nName: ${session.name}\nEmail: ${session.email}\nSlack: ${session.slack}\nSummary: ${session.summary}\nReason: ${session.escalationReason}\n\nTranscript:\n${transcript}`;
  return { subject, body };
}

function hasJiraConfig() {
  return JIRA_BASE_URL && JIRA_EMAIL && JIRA_API_TOKEN && JIRA_PROJECT_KEY;
}

async function createJiraIssue({ summary, description }) {
  if (!hasJiraConfig()) {
    return { skipped: true, reason: "Jira config incomplete" };
  }

  const payload = {
    fields: {
      project: { key: JIRA_PROJECT_KEY },
      summary,
      issuetype: { name: JIRA_ISSUE_TYPE },
      description: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: description
            }
          ]
        }
      ]
    }
  };

  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
  const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Jira error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return { skipped: false, key: data.key, url: `${JIRA_BASE_URL}/browse/${data.key}` };
}

function getNode(nodeId) {
  return tree[nodeId] || tree.start;
}

app.post("/api/start", (req, res) => {
  const { name, email, slack, summary } = req.body || {};
  if (!name || !email || !slack || !summary) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const sessionId = newSessionId();
  const nodeId = "start";
  const messages = [
    { role: "system", content: "Decision tree troubleshooting session started." },
    { role: "user", content: `Name: ${name}\nEmail: ${email}\nSlack: ${slack}\nIssue: ${summary}` }
  ];

  sessions.set(sessionId, {
    createdAt: getDayStamp(),
    name,
    email,
    slack,
    summary,
    messages,
    status: "active",
    nodeId
  });

  return res.json({ sessionId, node: getNode(nodeId) });
});

app.post("/api/next", (req, res) => {
  const { sessionId, choiceId, message } = req.body || {};
  if (!sessionId) {
    return res.status(400).json({ error: "Missing sessionId." });
  }

  const session = sessions.get(sessionId);
  if (!session || session.status !== "active") {
    return res.status(404).json({ error: "Session not found." });
  }

  if (message) {
    session.messages.push({ role: "user", content: message });
  }

  const currentNode = getNode(session.nodeId);
  if (choiceId) {
    const option = (currentNode.options || []).find((o) => o.id === choiceId);
    if (!option) {
      return res.status(400).json({ error: "Invalid option." });
    }
    if (session.nodeId === "start" && !session.issueType) {
      session.issueType = option.id;
    }
    session.nodeId = option.next;
    session.messages.push({ role: "assistant", content: `Selected: ${option.label}` });
  }

  const nextNode = getNode(session.nodeId);
  if (session.nodeId === "resolved") {
    session.status = "resolved";
  }

  return res.json({ node: nextNode });
});

app.post("/api/escalate", async (req, res) => {
  try {
    const { sessionId, reason } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ error: "Missing sessionId." });
    }

    const session = sessions.get(sessionId);
    if (!session || session.status === "escalated") {
      return res.status(404).json({ error: "Session not found." });
    }

    session.status = "escalated";
    session.escalatedAt = getDayStamp();
    session.escalationReason = reason || "User indicated issue persists.";

    const transcript = buildTranscript(session.messages);
    const emailTemplate = buildEmailTemplate(session, transcript);
    const emailResult = { skipped: true, reason: "SMTP disabled; using template only." };

    let jiraResult = { skipped: true, reason: "Jira config incomplete" };
    try {
      // Jira Cloud requires reporter accountId; omit reporter by default.
      jiraResult = await createJiraIssue({
        summary: session.summary,
        description: emailTemplate.body
      });
    } catch (jiraError) {
      jiraResult = { skipped: false, error: jiraError.message };
    }

    const ticketLink =
      session.issueType === "login" && LOGIN_TICKET_URL
        ? { url: LOGIN_TICKET_URL, label: LOGIN_TICKET_LABEL }
        : null;

    return res.json({
      ok: true,
      email: emailResult,
      jira: jiraResult,
      ticketLink,
      issueType: session.issueType || "",
      emailTemplate: {
        to: IT_NOTIFY_EMAIL,
        subject: emailTemplate.subject,
        body: emailTemplate.body
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Decision-tree intake app running on http://localhost:${PORT}`);
});
