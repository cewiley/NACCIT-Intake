# Jira Decision-Tree Intake

A local web app where users submit an issue, follow a guided decision-tree troubleshooting flow, and escalate to IT by email if still blocked. Jira issue creation is optional on escalation.

## Requirements
- Node.js 18+
- No SMTP needed; the app provides an email template on escalation
- Jira Cloud credentials (optional)

## Setup
1) `npm install`
2) Copy `.env.example` to `.env` and fill in values.
3) `npm start`
4) Open `http://localhost:3000`

## Flow
- User submits name, email, Slack username, and issue summary.
- App guides them through decision-tree troubleshooting steps.
- If unresolved, user clicks ?Notify IT team?.
- App generates an email template for IT and (optionally) creates a Jira issue.
- Login/password escalations can also surface a direct access-ticket link (via env vars).

## Notes
- Sessions are stored in memory for local use only.
- Add or customize troubleshooting steps in `server.js`.
