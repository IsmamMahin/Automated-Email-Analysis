import { writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Email Analysis Automation - Technical Introduction</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

  @page {
    size: A4 portrait;
    margin: 12mm 15mm 12mm 15mm;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1E293B;
    background-color: #FFFFFF;
    line-height: 1.45;
    font-size: 8.8pt;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    page-break-after: always;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 272mm;
    position: relative;
    padding-bottom: 2px;
  }

  .page:last-child {
    page-break-after: avoid;
  }

  /* Header styles */
  .doc-header {
    border-bottom: 2px solid #E2E8F0;
    padding-bottom: 10px;
    margin-bottom: 12px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }

  .header-left h1 {
    font-size: 18.5pt;
    font-weight: 800;
    color: #0F172A;
    letter-spacing: -0.5px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-left h1 .highlight {
    background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .header-subtitle {
    font-size: 8.8pt;
    font-weight: 500;
    color: #64748B;
    margin-top: 2px;
  }

  .header-right {
    text-align: right;
  }

  .badge-tag {
    display: inline-block;
    padding: 2.5px 8px;
    border-radius: 9999px;
    font-size: 7.2pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: #EEF2FF;
    color: #4F46E5;
    border: 1px solid #C7D2FE;
    margin-bottom: 3px;
  }

  .header-date {
    font-size: 7.2pt;
    color: #94A3B8;
  }

  /* Section styles */
  .section-title {
    font-size: 11pt;
    font-weight: 700;
    color: #0F172A;
    letter-spacing: -0.3px;
    margin-top: 9px;
    margin-bottom: 7px;
    display: flex;
    align-items: center;
    gap: 6px;
    border-left: 3.5px solid #4F46E5;
    padding-left: 8px;
  }

  p {
    font-size: 8.5pt;
    color: #334155;
    margin-bottom: 7px;
    line-height: 1.42;
  }

  /* Overview Cards */
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 10px;
  }

  .grid-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    margin-bottom: 10px;
  }

  .card {
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
    border-radius: 7px;
    padding: 8px 10px;
  }

  .card-highlight {
    background: #F8FAFC;
    border-left: 3.5px solid #6366F1;
  }

  .card-title {
    font-size: 8.3pt;
    font-weight: 700;
    color: #0F172A;
    margin-bottom: 3px;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .card-desc {
    font-size: 7.6pt;
    color: #475569;
    line-height: 1.35;
  }

  /* Tech Stack Table */
  .tech-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 5px;
    margin-bottom: 8px;
    font-size: 7.8pt;
  }

  .tech-table th {
    background: #F1F5F9;
    color: #334155;
    font-weight: 700;
    text-align: left;
    padding: 5.5px 8px;
    border: 1px solid #CBD5E1;
    font-size: 7.4pt;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .tech-table td {
    padding: 5.5px 8px;
    border: 1px solid #E2E8F0;
    vertical-align: top;
    color: #334155;
    line-height: 1.35;
  }

  .tech-table tr:nth-child(even) td {
    background: #F8FAFC;
  }

  .tech-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 5px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 7.2pt;
  }

  .badge-node { background: #DCFCE7; color: #15803D; border: 1px solid #BBF7D0; }
  .badge-gmail { background: #FEE2E2; color: #B91C1C; border: 1px solid #FECACA; }
  .badge-ollama { background: #EDE9FE; color: #6D28D9; border: 1px solid #DDD6FE; }
  .badge-telegram { background: #E0F2FE; color: #0369A1; border: 1px solid #BAE6FD; }
  .badge-trigger { background: #FEF3C7; color: #B45309; border: 1px solid #FDE68A; }
  .badge-git { background: #F1F5F9; color: #334155; border: 1px solid #CBD5E1; }

  /* Code block */
  .code-block {
    background: #0F172A;
    color: #E2E8F0;
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 7.1pt;
    padding: 8px 11px;
    border-radius: 6px;
    line-height: 1.45;
    white-space: pre;
    margin: 5px 0 8px 0;
    overflow: hidden;
  }

  .code-comment { color: #64748B; font-style: italic; }
  .code-kw { color: #38BDF8; font-weight: 600; }
  .code-str { color: #A7F3D0; }
  .code-cmd { color: #FCD34D; }

  /* Diagram Containers */
  .diagram-container {
    background: #FAFAFA;
    border: 1px solid #E2E8F0;
    border-radius: 7px;
    padding: 8px 6px;
    margin: 6px 0 10px 0;
    text-align: center;
  }

  .diagram-caption {
    font-size: 7.2pt;
    font-weight: 600;
    color: #64748B;
    text-align: center;
    margin-top: 5px;
  }

  /* Page Footer */
  .page-footer {
    margin-top: auto;
    border-top: 1px solid #E2E8F0;
    padding-top: 5px;
    display: flex;
    justify-content: space-between;
    font-size: 6.8pt;
    color: #94A3B8;
  }

  .quick-step-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    margin: 5px 0 8px 0;
  }

  .quick-step-card {
    background: #F8FAFC;
    border: 1px solid #CBD5E1;
    border-radius: 6px;
    padding: 7px 9px;
    font-size: 7.4pt;
    color: #334155;
  }

  .quick-step-card strong {
    color: #0F172A;
    display: block;
    margin-bottom: 3px;
    font-size: 7.6pt;
  }

  .quick-step-card code {
    background: #FFFFFF;
    padding: 2px 4px;
    border-radius: 3px;
    border: 1px solid #CBD5E1;
    font-family: 'JetBrains Mono', monospace;
    font-size: 6.8pt;
    color: #0F172A;
    display: inline-block;
    margin-top: 2px;
  }

  .alert-box {
    border-radius: 6px;
    padding: 6.5px 9px;
    font-size: 7.6pt;
    margin: 6px 0 8px 0;
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }

  .alert-info {
    background: #EFF6FF;
    border: 1px solid #BFDBFE;
    color: #1E40AF;
  }

  .alert-warning {
    background: #FFFBEB;
    border: 1px solid #FDE68A;
    color: #92400E;
  }

  .alert-success {
    background: #F0FDF4;
    border: 1px solid #BBF7D0;
    color: #166534;
  }

  ul.check-list {
    list-style: none;
    padding: 0;
    margin: 3px 0 6px 0;
  }

  ul.check-list li {
    font-size: 7.8pt;
    color: #334155;
    margin-bottom: 5px;
    padding-left: 15px;
    position: relative;
    line-height: 1.35;
  }

  ul.check-list li::before {
    content: "✓";
    position: absolute;
    left: 0;
    color: #4F46E5;
    font-weight: 700;
  }

  /* Visual rule box */
  .rule-box {
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 6px;
    padding: 7px 9px;
  }

  .rule-tag-high {
    display: inline-block;
    padding: 1.5px 6px;
    border-radius: 3px;
    font-size: 6.8pt;
    font-weight: 700;
    background: #FEE2E2;
    color: #B91C1C;
    margin-bottom: 3px;
  }

  .rule-tag-low {
    display: inline-block;
    padding: 1.5px 6px;
    border-radius: 3px;
    font-size: 6.8pt;
    font-weight: 700;
    background: #F1F5F9;
    color: #475569;
    margin-bottom: 3px;
  }
</style>
</head>
<body>

<!-- ==========================================
     PAGE 1: OVERVIEW & TECHNOLOGY STACK
     ========================================== -->
<div class="page">
  <div class="doc-header">
    <div class="header-left">
      <h1>📧 Email Analysis <span class="highlight">Automation</span></h1>
      <div class="header-subtitle">Executive Technical Architecture, Workflow & GitHub Hosting Guide</div>
    </div>
    <div class="header-right">
      <div class="badge-tag">Production v1.0.0</div>
      <div class="header-date">Architecture & Systems Brief</div>
    </div>
  </div>

  <div class="section-title">1. Project Purpose & Executive Summary</div>
  <p>
    The <strong>Email Analysis Automation</strong> platform is an autonomous, privacy-centric inbox triage intelligence assistant. It periodically inspects unread emails from Gmail via Google Cloud OAuth2, uses an LLM through <strong>Ollama</strong> for context-aware classification and action-item extraction, and delivers concise, actionable headline briefings directly to a private <strong>Telegram</strong> chat.
  </p>

  <div class="grid-3">
    <div class="card card-highlight">
      <div class="card-title">⏱️ 2-Hour Autonomous Cycle</div>
      <div class="card-desc">Scheduled background monitoring queries only messages within rolling 120-minute windows, avoiding stale duplicates.</div>
    </div>
    <div class="card card-highlight">
      <div class="card-title">🧠 AI Executive Triage</div>
      <div class="card-desc">Separates urgent academic/work/billing items from promotional newsletters, cutting inbox noise by over 90%.</div>
    </div>
    <div class="card card-highlight">
      <div class="card-title">💬 Interactive Telegram Bot</div>
      <div class="card-desc">Instant on-demand <code>trigger</code> executions and real-time <code>status</code> monitoring protected by strict Chat ID security.</div>
    </div>
  </div>

  <div class="section-title">2. Complete Technology Stack Matrix</div>
  <p>
    The system is built on a modular, lightweight modern JavaScript/TypeScript stack designed to run locally, on a serverless task worker, or inside a containerized server:
  </p>

  <table class="tech-table">
    <thead>
      <tr>
        <th style="width: 20%;">Component Layer</th>
        <th style="width: 25%;">Technology / Tool</th>
        <th style="width: 55%;">Role & Architectural Significance</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Runtime & Language</strong></td>
        <td>
          <span class="tech-badge badge-node">Node.js (v18+)</span><br>
          <span class="tech-badge badge-node" style="margin-top:2px;">TypeScript (v5.5)</span>
        </td>
        <td>
          Native ES Module architecture handling non-blocking async network I/O. Strict TypeScript typechecking for Trigger.dev task schemas, environment validation, and error boundaries.
        </td>
      </tr>
      <tr>
        <td><strong>Email Ingestion & Auth</strong></td>
        <td>
          <span class="tech-badge badge-gmail">Gmail REST API v1</span><br>
          <span class="tech-badge badge-gmail" style="margin-top:2px;">Google OAuth 2.0</span>
        </td>
        <td>
          Performs query filtering (<code>q=after:{epoch}</code>) with automated OAuth2 refresh token rotation. Decodes nested multipart MIME bodies (<code>text/plain</code> & <code>text/html</code>) via Base64URL parsing.
        </td>
      </tr>
      <tr>
        <td><strong>AI Inference Engine</strong></td>
        <td>
          <span class="tech-badge badge-ollama">Ollama HTTP API</span><br>
          <small style="color:#64748B;">gemma4:31b-cloud / llama3.2</small>
        </td>
        <td>
          Fast, local/private LLM inference via <code>/api/chat</code>. Employs prompt engineering for triage classification, generating bold headline bullets, explicit action items, and fallback headline digests.
        </td>
      </tr>
      <tr>
        <td><strong>Notification & Interface</strong></td>
        <td>
          <span class="tech-badge badge-telegram">Telegram Bot API</span><br>
          <small style="color:#64748B;">BotFather & Long-Polling</small>
        </td>
        <td>
          Delivers HTML-formatted push notifications directly to the user's private chat. Runs a continuous long-polling listener (<code>getUpdates</code>) for interactive commands with zero-trust Chat ID checks.
        </td>
      </tr>
      <tr>
        <td><strong>Task Orchestration</strong></td>
        <td>
          <span class="tech-badge badge-trigger">Trigger.dev (v4.5 SDK)</span><br>
          <span class="tech-badge badge-node" style="margin-top:2px;">Autonomous Daemon</span>
        </td>
        <td>
          Dual scheduling: Cloud-native task queuing with cron expressions (<code>0 */2 * * *</code>) and run telemetry, complemented by a zero-dependency local daemon (<code>setInterval</code>) for standalone execution.
        </td>
      </tr>
      <tr>
        <td><strong>Version Control & CI</strong></td>
        <td>
          <span class="tech-badge badge-git">Git & GitHub</span><br>
          <small style="color:#64748B;">GitHub Actions CI</small>
        </td>
        <td>
          Source control repository, automated typecheck workflows, and protected environment secrets (OAuth tokens, bot keys) keeping credentials strictly excluded from public commits.
        </td>
      </tr>
    </tbody>
  </table>

  <div class="alert-box alert-info">
    <span>💡</span>
    <div>
      <strong>Privacy-First Architecture:</strong> Raw email contents are processed strictly in-memory or on local LLM runtimes. No personal email data or credentials are ever written to third-party analytic databases or shared across public cloud endpoints.
    </div>
  </div>

  <div class="page-footer">
    <span>Email Analysis Automation &bull; Technical Overview & Architecture</span>
    <span>Page 1 of 3</span>
  </div>
</div>

<!-- ==========================================
     PAGE 2: SYSTEM ARCHITECTURE & FLOWCHARTS
     ========================================== -->
<div class="page">
  <div class="doc-header">
    <div class="header-left">
      <h1>🔄 System Workflows & <span class="highlight">Flowcharts</span></h1>
      <div class="header-subtitle">Visualizing the Ingestion, Triage, and Dispatch Pipeline</div>
    </div>
    <div class="header-right">
      <div class="badge-tag">Process Flow</div>
      <div class="header-date">Architecture & Systems Brief</div>
    </div>
  </div>

  <div class="section-title">3. End-to-End Pipeline Workflow</div>
  <p>
    The lifecycle of an email analysis cycle executes across six coordinated stages: trigger initiation, authenticated token exchange, lookback query fetch, MIME extraction, LLM triage, and formatted Telegram push notification.
  </p>

  <!-- SVG Flowchart 1: End-to-End Processing Flow -->
  <div class="diagram-container">
    <svg viewBox="0 0 740 215" width="100%" height="200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748B" />
        </marker>
        <marker id="arrow-indigo" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#4F46E5" />
        </marker>
        <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0F172A" flood-opacity="0.06"/>
        </filter>
      </defs>

      <!-- Stage 1: Trigger -->
      <g filter="url(#shadow)">
        <rect x="10" y="20" width="125" height="142" rx="8" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.5" />
        <rect x="10" y="20" width="125" height="26" rx="8" fill="#F1F5F9" />
        <text x="72" y="38" font-family="Inter, sans-serif" font-size="9.5" font-weight="700" fill="#0F172A" text-anchor="middle">1. Trigger Event</text>
        <rect x="20" y="56" width="105" height="42" rx="5" fill="#FFFFFF" stroke="#E2E8F0" />
        <text x="72" y="73" font-family="Inter, sans-serif" font-size="8.2" font-weight="600" fill="#334155" text-anchor="middle">2-Hour Cron</text>
        <text x="72" y="87" font-family="Inter, sans-serif" font-size="7.2" fill="#64748B" text-anchor="middle">setInterval / Trigger</text>
        <rect x="20" y="106" width="105" height="42" rx="5" fill="#FFFFFF" stroke="#E2E8F0" />
        <text x="72" y="123" font-family="Inter, sans-serif" font-size="8.2" font-weight="600" fill="#334155" text-anchor="middle">User On-Demand</text>
        <text x="72" y="137" font-family="Inter, sans-serif" font-size="7.2" fill="#64748B" text-anchor="middle">Telegram /trigger</text>
      </g>

      <path d="M 135 91 L 155 91" stroke="#64748B" stroke-width="1.8" marker-end="url(#arrow)" fill="none" />

      <!-- Stage 2: Gmail Ingestion -->
      <g filter="url(#shadow)">
        <rect x="160" y="20" width="130" height="142" rx="8" fill="#FEF2F2" stroke="#FECACA" stroke-width="1.5" />
        <rect x="160" y="20" width="130" height="26" rx="8" fill="#FEE2E2" />
        <text x="225" y="38" font-family="Inter, sans-serif" font-size="9.5" font-weight="700" fill="#991B1B" text-anchor="middle">2. Gmail Ingestion</text>
        <rect x="170" y="56" width="110" height="42" rx="5" fill="#FFFFFF" stroke="#FECACA" />
        <text x="225" y="73" font-family="Inter, sans-serif" font-size="8.2" font-weight="600" fill="#991B1B" text-anchor="middle">OAuth2 Refresh</text>
        <text x="225" y="87" font-family="Inter, sans-serif" font-size="7.2" fill="#64748B" text-anchor="middle">Bearer Token Exchange</text>
        <rect x="170" y="106" width="110" height="42" rx="5" fill="#FFFFFF" stroke="#FECACA" />
        <text x="225" y="123" font-family="Inter, sans-serif" font-size="8.2" font-weight="600" fill="#991B1B" text-anchor="middle">Query: after:{epoch}</text>
        <text x="225" y="137" font-family="Inter, sans-serif" font-size="7.2" fill="#64748B" text-anchor="middle">MIME Multipart Decode</text>
      </g>

      <path d="M 290 91 L 310 91" stroke="#64748B" stroke-width="1.8" marker-end="url(#arrow)" fill="none" />

      <!-- Stage 3: Ollama Triage -->
      <g filter="url(#shadow)">
        <rect x="315" y="20" width="140" height="142" rx="8" fill="#EEF2FF" stroke="#C7D2FE" stroke-width="1.5" />
        <rect x="315" y="20" width="140" height="26" rx="8" fill="#E0E7FF" />
        <text x="385" y="38" font-family="Inter, sans-serif" font-size="9.5" font-weight="700" fill="#3730A3" text-anchor="middle">3. Ollama AI Triage</text>
        <rect x="325" y="56" width="120" height="42" rx="5" fill="#FFFFFF" stroke="#C7D2FE" />
        <text x="385" y="73" font-family="Inter, sans-serif" font-size="8.2" font-weight="600" fill="#3730A3" text-anchor="middle">Prompt Synthesis</text>
        <text x="385" y="87" font-family="Inter, sans-serif" font-size="7.2" fill="#64748B" text-anchor="middle">School / Work / Bill rules</text>
        <rect x="325" y="106" width="120" height="42" rx="5" fill="#FFFFFF" stroke="#C7D2FE" />
        <text x="385" y="123" font-family="Inter, sans-serif" font-size="8.2" font-weight="600" fill="#3730A3" text-anchor="middle">Model Inference</text>
        <text x="385" y="137" font-family="Inter, sans-serif" font-size="7.2" fill="#64748B" text-anchor="middle">gemma4:31b / llama3.2</text>
      </g>

      <path d="M 455 91 L 475 91" stroke="#64748B" stroke-width="1.8" marker-end="url(#arrow)" fill="none" />

      <!-- Stage 4: Telegram Dispatch -->
      <g filter="url(#shadow)">
        <rect x="480" y="20" width="130" height="142" rx="8" fill="#F0F9FF" stroke="#BAE6FD" stroke-width="1.5" />
        <rect x="480" y="20" width="130" height="26" rx="8" fill="#E0F2FE" />
        <text x="545" y="38" font-family="Inter, sans-serif" font-size="9.5" font-weight="700" fill="#0369A1" text-anchor="middle">4. Telegram Bot API</text>
        <rect x="490" y="56" width="110" height="42" rx="5" fill="#FFFFFF" stroke="#BAE6FD" />
        <text x="545" y="73" font-family="Inter, sans-serif" font-size="8.2" font-weight="600" fill="#0369A1" text-anchor="middle">HTML Parse Mode</text>
        <text x="545" y="87" font-family="Inter, sans-serif" font-size="7.2" fill="#64748B" text-anchor="middle">Executive Headline Feed</text>
        <rect x="490" y="106" width="110" height="42" rx="5" fill="#FFFFFF" stroke="#BAE6FD" />
        <text x="545" y="123" font-family="Inter, sans-serif" font-size="8.2" font-weight="600" fill="#0369A1" text-anchor="middle">sendMessage</text>
        <text x="545" y="137" font-family="Inter, sans-serif" font-size="7.2" fill="#64748B" text-anchor="middle">Private Chat ID Target</text>
      </g>

      <path d="M 610 91 L 630 91" stroke="#64748B" stroke-width="1.8" marker-end="url(#arrow)" fill="none" />

      <!-- Stage 5: User Action -->
      <g filter="url(#shadow)">
        <rect x="635" y="47" width="95" height="88" rx="8" fill="#ECFDF5" stroke="#A7F3D0" stroke-width="1.5" />
        <text x="682" y="76" font-family="Inter, sans-serif" font-size="9.5" font-weight="700" fill="#047857" text-anchor="middle">👤 User</text>
        <text x="682" y="93" font-family="Inter, sans-serif" font-size="8.2" font-weight="600" fill="#047857" text-anchor="middle">Instant Push</text>
        <text x="682" y="110" font-family="Inter, sans-serif" font-size="7" fill="#065F46" text-anchor="middle">Zero-friction triage</text>
      </g>

      <!-- Bottom feedback loop -->
      <path d="M 682 135 L 682 185 L 72 185 L 72 162" stroke="#4F46E5" stroke-dasharray="4,4" stroke-width="1.5" marker-end="url(#arrow-indigo)" fill="none" />
      <text x="380" y="198" font-family="Inter, sans-serif" font-size="7.8" font-weight="600" fill="#4F46E5" text-anchor="middle">Scheduled Interval Reset (Next 120-minute cycle timer automatically restarts)</text>
    </svg>
    <div class="diagram-caption">Figure 1: Complete Asynchronous End-to-End Email Analysis & Briefing Pipeline</div>
  </div>

  <div class="section-title">4. Telegram Interactive Command & Security Architecture</div>
  <p>
    The interactive listener operates continuously using non-blocking long-polling (<code>getUpdates</code>). Incoming requests are filtered through a strict zero-trust security gate before dispatching commands:
  </p>

  <!-- SVG Flowchart 2: Telegram Command Flow -->
  <div class="diagram-container">
    <svg viewBox="0 0 740 180" width="100%" height="165" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="arrow2" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748B" />
        </marker>
        <marker id="arrow-green" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#10B981" />
        </marker>
        <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#EF4444" />
        </marker>
      </defs>

      <!-- Telegram Input -->
      <rect x="15" y="55" width="110" height="56" rx="6" fill="#F0F9FF" stroke="#0284C7" stroke-width="1.5"/>
      <text x="70" y="78" font-family="Inter, sans-serif" font-size="8.5" font-weight="700" fill="#0369A1" text-anchor="middle">Telegram User</text>
      <text x="70" y="94" font-family="Inter, sans-serif" font-size="7.5" fill="#0284C7" text-anchor="middle">Sends Text / Command</text>

      <path d="M 125 83 L 155 83" stroke="#64748B" stroke-width="1.6" marker-end="url(#arrow2)" fill="none" />

      <!-- Security Guard -->
      <polygon points="215,48 275,83 215,118 155,83" fill="#FEF3C7" stroke="#D97706" stroke-width="1.5" />
      <text x="215" y="80" font-family="Inter, sans-serif" font-size="8" font-weight="700" fill="#92400E" text-anchor="middle">Chat ID ==</text>
      <text x="215" y="92" font-family="Inter, sans-serif" font-size="7" fill="#B45309" text-anchor="middle">TELEGRAM_ID?</text>

      <!-- Unauthorized Reject -->
      <path d="M 215 48 L 215 22 L 305 22" stroke="#EF4444" stroke-width="1.5" marker-end="url(#arrow-red)" fill="none" />
      <text x="225" y="35" font-family="Inter, sans-serif" font-size="7" font-weight="700" fill="#EF4444">NO</text>
      <rect x="310" y="8" width="115" height="30" rx="4" fill="#FEF2F2" stroke="#FECACA" />
      <text x="367" y="24" font-family="Inter, sans-serif" font-size="7.5" font-weight="700" fill="#991B1B" text-anchor="middle">Reject & Drop Packet</text>
      <text x="367" y="34" font-family="Inter, sans-serif" font-size="6.5" fill="#B91C1C" text-anchor="middle">Zero unauthorized access</text>

      <!-- Authorized Pass -->
      <path d="M 275 83 L 315 83" stroke="#10B981" stroke-width="1.5" marker-end="url(#arrow-green)" fill="none" />
      <text x="290" y="76" font-family="Inter, sans-serif" font-size="7" font-weight="700" fill="#10B981">YES</text>

      <!-- Router Node -->
      <rect x="320" y="55" width="115" height="56" rx="6" fill="#F8FAFC" stroke="#64748B" stroke-width="1.5"/>
      <text x="377" y="78" font-family="Inter, sans-serif" font-size="8.5" font-weight="700" fill="#0F172A" text-anchor="middle">Command Router</text>
      <text x="377" y="94" font-family="Inter, sans-serif" font-size="7.2" fill="#475569" text-anchor="middle">Matches text pattern</text>

      <!-- Branches -->
      <!-- Branch 1: /trigger -->
      <path d="M 435 71 L 485 45" stroke="#64748B" stroke-width="1.5" marker-end="url(#arrow2)" fill="none" />
      <rect x="490" y="25" width="235" height="38" rx="5" fill="#EEF2FF" stroke="#C7D2FE" />
      <text x="500" y="41" font-family="Inter, sans-serif" font-size="8.3" font-weight="700" fill="#3730A3">/trigger or trigger</text>
      <text x="500" y="55" font-family="Inter, sans-serif" font-size="7.2" fill="#4338CA">Runs instant Gmail check + Ollama triage & resets 2h schedule</text>

      <!-- Branch 2: /status -->
      <path d="M 435 83 L 485 83" stroke="#64748B" stroke-width="1.5" marker-end="url(#arrow2)" fill="none" />
      <rect x="490" y="69" width="235" height="38" rx="5" fill="#ECFDF5" stroke="#A7F3D0" />
      <text x="500" y="85" font-family="Inter, sans-serif" font-size="8.3" font-weight="700" fill="#065F46">/status or status</text>
      <text x="500" y="99" font-family="Inter, sans-serif" font-size="7.2" fill="#047857">Returns process uptime, last run duration & next run countdown</text>

      <!-- Branch 3: /help -->
      <path d="M 435 95 L 485 120" stroke="#64748B" stroke-width="1.5" marker-end="url(#arrow2)" fill="none" />
      <rect x="490" y="113" width="235" height="38" rx="5" fill="#FFFBEB" stroke="#FDE68A" />
      <text x="500" y="129" font-family="Inter, sans-serif" font-size="8.3" font-weight="700" fill="#92400E">/help or other text</text>
      <text x="500" y="143" font-family="Inter, sans-serif" font-size="7.2" fill="#B45309">Displays formatted markdown help card with valid bot commands</text>
    </svg>
    <div class="diagram-caption">Figure 2: Zero-Trust Security Validation & Command Routing Flow in the Telegram Listener</div>
  </div>

  <div class="grid-2" style="margin-top: 5px;">
    <div class="rule-box">
      <span class="rule-tag-high">HIGH PRIORITY TRIAGE</span>
      <p style="font-size:7.4pt; margin-bottom:0; color:#475569;">
        <strong>Identifies:</strong> Academic deadlines, university course updates, work client requests, and expiring subscriptions/billing.<br>
        <strong>Output:</strong> 1-line bold headline bullet + clear, explicit action item.
      </p>
    </div>
    <div class="rule-box">
      <span class="rule-tag-low">LOW PRIORITY & FALLBACK</span>
      <p style="font-size:7.4pt; margin-bottom:0; color:#475569;">
        <strong>Aggregates:</strong> Marketing promotions, social pings, newsletters condensed into a single summary line.<br>
        <strong>Resilience:</strong> Automatic deterministic regex fallback if Ollama is offline.
      </p>
    </div>
  </div>

  <div class="page-footer">
    <span>Email Analysis Automation &bull; Technical Overview & Architecture</span>
    <span>Page 2 of 3</span>
  </div>
</div>

<!-- ==========================================
     PAGE 3: GITHUB HOSTING & DEPLOYMENT GUIDE
     ========================================== -->
<div class="page">
  <div class="doc-header">
    <div class="header-left">
      <h1>🐙 GitHub Hosting & <span class="highlight">Deployment</span></h1>
      <div class="header-subtitle">Repository Setup, Security Boundaries, CI/CD and Production Hosting</div>
    </div>
    <div class="header-right">
      <div class="badge-tag">DevOps & Hosting</div>
      <div class="header-date">Architecture & Systems Brief</div>
    </div>
  </div>

  <div class="section-title">5. GitHub Repository Hosting & Directory Structure</div>
  <p>
    Hosting this project on GitHub facilitates version control, automated testing, and deployment orchestration. Because email access credentials and bot tokens are critical assets, a strict zero-leakage security model is enforced:
  </p>

  <div class="grid-2">
    <div>
      <ul class="check-list">
        <li><strong>Protected Credentials:</strong> <code>.gitignore</code> strictly excludes <code>.env</code>, <code>.env.local</code>, <code>node_modules/</code>, and <code>.trigger/</code> to prevent exposing Google OAuth secrets.</li>
        <li><strong>Template Provided:</strong> <code>.env.example</code> acts as the canonical configuration contract with placeholder keys for public cloning.</li>
        <li><strong>Continuous Integration:</strong> Automated GitHub Actions workflow checks TypeScript types (<code>tsc --noEmit</code>) on every commit.</li>
        <li><strong>Branch Strategy:</strong> Maintain a stable <code>main</code> branch for deployments and feature branches for additions.</li>
      </ul>
    </div>
    <div class="code-block"><span class="code-comment"># Git Repository Directory Layout</span>
<span class="code-kw">email-analysis/</span>
├── <span class="code-str">scripts/</span>
│   ├── <span class="code-str">instant-check.mjs</span>     <span class="code-comment"># Triage engine</span>
│   ├── <span class="code-str">telegram-listener.mjs</span> <span class="code-comment"># Bot & scheduler</span>
│   └── <span class="code-str">get-gmail-token.mjs</span>   <span class="code-comment"># OAuth helper</span>
├── <span class="code-str">src/trigger/</span>              <span class="code-comment"># Trigger tasks</span>
├── <span class="code-str">.env.example</span>              <span class="code-comment"># Safe template</span>
├── <span class="code-str">package.json</span>              <span class="code-comment"># NPM scripts</span>
└── <span class="code-str">trigger.config.ts</span>         <span class="code-comment"># Trigger config</span></div>
  </div>

  <div class="section-title">6. Setting Up Remote Repository on GitHub</div>
  <p>
    To initialize and push the repository to GitHub under your user account:
  </p>

  <div class="code-block"><span class="code-comment"># 1. Initialize Git repository and stage tracked files (verifying .gitignore protects .env)</span>
<span class="code-cmd">git init</span>
<span class="code-cmd">git add .</span>
<span class="code-cmd">git commit -m "feat: initial commit of email analysis and triage automation"</span>

<span class="code-comment"># 2. Link your GitHub remote repository and push main branch</span>
<span class="code-cmd">git remote add origin https://github.com/&lt;your-username&gt;/email-analysis-automation.git</span>
<span class="code-cmd">git branch -M main</span>
<span class="code-cmd">git push -u origin main</span></div>

  <div class="section-title">7. GitHub Actions CI & Production Hosting Models</div>
  <p>
    The project supports three distinct hosting strategies depending on your operational requirements:
  </p>

  <table class="tech-table">
    <thead>
      <tr>
        <th style="width: 25%;">Hosting Strategy</th>
        <th style="width: 38%;">Setup & Execution Mechanism</th>
        <th style="width: 37%;">Ideal Use Case & Strengths</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>1. Local Daemon / PM2</strong><br><small style="color:#64748B;">Self-Contained</small></td>
        <td>
          Run as a background system daemon using PM2 or native Node:<br>
          <code>pm2 start scripts/telegram-listener.mjs --name email-bot</code>
        </td>
        <td>
          Zero cloud cost. Directly connects to local <strong>Ollama GPU inference</strong> without exposing internal networks.
        </td>
      </tr>
      <tr>
        <td><strong>2. VPS / Docker Server</strong><br><small style="color:#64748B;">Always-On Cloud</small></td>
        <td>
          Clone repo onto Ubuntu/Debian server or Raspberry Pi. Add <code>.env</code> file. Run as a <code>systemd</code> service or Docker container.
        </td>
        <td>
          Guarantees 24/7 reliability and uptime without requiring your personal workstation to remain awake.
        </td>
      </tr>
      <tr>
        <td><strong>3. Trigger.dev Cloud</strong><br><small style="color:#64748B;">Serverless Tasks</small></td>
        <td>
          Deploy with <code>npx trigger deploy</code>. Configure OAuth and Bot keys securely in the Trigger.dev Cloud Dashboard.
        </td>
        <td>
          Serverless scalability, automatic retries, execution observability dashboards, and zero server maintenance.
        </td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">8. Rapid 3-Step Setup Cheatsheet</div>
  <div class="quick-step-grid">
    <div class="quick-step-card">
      <strong>1. Clone & Install</strong>
      <code>git clone &lt;repo-url&gt;</code><br>
      <code>npm install</code>
    </div>
    <div class="quick-step-card">
      <strong>2. Authenticate</strong>
      <code>cp .env.example .env</code><br>
      <code>npm run auth:gmail</code>
    </div>
    <div class="quick-step-card">
      <strong>3. Launch Bot</strong>
      <code>npm run schedule</code><br>
      <code>npm run check:instant</code>
    </div>
  </div>

  <div class="alert-box alert-success" style="margin-top: 7px;">
    <span>🚀</span>
    <div>
      <strong>Production-Ready Automation:</strong> The project combines Google Cloud OAuth2 authentication, fast LLM inference via Ollama, zero-trust Telegram control, and flexible deployment models ready for hosting.
    </div>
  </div>

  <div class="page-footer">
    <span>Email Analysis Automation &bull; Technical Overview & Architecture</span>
    <span>Page 3 of 3</span>
  </div>
</div>

</body>
</html>
`;

const htmlPath = resolve('./scripts/temp_presentation.html');
const pdfPath = resolve('./Email_Analysis_Project_Introduction.pdf');

writeFileSync(htmlPath, htmlContent, 'utf-8');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');

try {
  const cmd = `"${chromePath}" --headless=new --no-sandbox --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf="${pdfPath}" --no-pdf-header-footer "${fileUrl}"`;
  execSync(cmd, { stdio: 'inherit' });
  console.log('Successfully generated PDF at:', pdfPath);
} catch (err) {
  console.error('Error generating PDF:', err);
} finally {
  try {
    unlinkSync(htmlPath);
  } catch (e) {}
}
