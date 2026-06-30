import { LOGO_WORDMARK } from "../brand.js";
import { ASK_QUESTIONS_PROMPT } from "./agentQuestions.js";

export interface AgentPromptInput {
  name: string;
  system_prompt: string | null;
  skills: string[];
  rules: string[];
  constraints: string[];
}

export interface ProjectToolPromptInfo {
  toolName: string;
  status: string;
  capabilities: string[];
  description?: string | null;
  accountLabel?: string | null;
  connectionType?: string | null;
  workspaceStatus?: string | null;
  config?: Record<string, unknown>;
}

export function buildAgentSystemPrompt(
  agent: AgentPromptInput,
  knowledgeContext: string,
  availableTools: ProjectToolPromptInfo[] = [],
  options?: { skipOutputLocationGate?: boolean }
): string {
  const parts: string[] = [];

  if (!options?.skipOutputLocationGate) {
    parts.push(
      `=== CRITICAL WORKSPACE PROTOCOL ===\n` +
        `IMPORTANT: Before generating any work output, draft, copy, design suggestion, outline, code spec, strategy recommendation, report, or other artifact, you MUST ask the user: \n` +
        `- "Would you like me to write this output directly here in the chat?"\n` +
        `- "Or should I connect or select an app (like Google Docs, Google Sheets, Figma, Notion) to write/fetch/create the content directly in the app?"\n` +
        `You are strictly forbidden from outputting the final work or performing the main task until the user responds and confirms their preference.\n` +
        `==================================`
    );
  }

  if (agent.system_prompt?.trim()) {
    parts.push(agent.system_prompt.trim());
  } else {
    parts.push(
      `You are ${agent.name}, an AI assistant in the ${LOGO_WORDMARK} workspace. Help the user with their team-specific work clearly and professionally.`
    );
  }

  if (agent.skills.length > 0) {
    parts.push(`\nSkills:\n${agent.skills.map((s) => `- ${s}`).join("\n")}`);
  }
  if (agent.rules.length > 0) {
    parts.push(`\nRules:\n${agent.rules.map((r) => `- ${r}`).join("\n")}`);
  }
  if (agent.constraints.length > 0) {
    parts.push(`\nConstraints:\n${agent.constraints.map((c) => `- ${c}`).join("\n")}`);
  }

  if (availableTools.length > 0) {
    const connected = availableTools.filter((t) => t.status === "connected");
    const pending = availableTools.filter((t) => t.status !== "connected" && t.status !== "disabled");
    parts.push(
      `\nTools available to this agent on active projects:` +
        `\n${availableTools
          .map((t) => {
            const caps = t.capabilities.length ? ` (${t.capabilities.join(", ")})` : "";
            const account = t.accountLabel ? ` — account: ${t.accountLabel}` : "";
            const conn = t.connectionType ? ` via ${t.connectionType}` : "";
            const configStr = t.config && Object.keys(t.config).length > 0
              ? ` — config: ${JSON.stringify(t.config)}`
              : "";
            return `- ${t.toolName} [${t.status}]${conn}${account}${caps}${configStr}`;
          })
          .join("\n")}`
    );
    if (connected.length > 0) {
      parts.push(
        `\nUse connected tools when the user asks to create content, update trackers, design assets, or publish to social channels.`
      );
    } else if (pending.length > 0) {
      parts.push(
        `\nTools are planned or awaiting connection — describe what you would do once integrations are provisioned, and note any setup still needed.`
      );
    }
  }

  if (knowledgeContext.trim()) {
    parts.push(`\nRelevant knowledge from the agent knowledge base:\n${knowledgeContext.trim()}`);
  }

  if (!options?.skipOutputLocationGate) {
    parts.push(`
=== APP INTEGRATIONS & ACTIONS ===
You can connect to workspace apps (such as Google Sheets, Google Docs) and read/write data from them.
1. If the user asks you to connect to an app or read/write from it:
   - Check if that app is listed in your "Tools available to this agent" as [connected].
   - If it is NOT connected, or if you need details like the Spreadsheet ID or Doc ID, politely ask the user to provide the Spreadsheet ID or Google Doc ID/URL. Explain that you need this to establish the connection.
   - Once the user provides the ID/details, output a connection action command.
2. Action Command Syntax:
   You can trigger actions by outputting a JSON block anywhere in your response. The backend will parse it, perform the database or API operation, and feed the result back to you.
   - To connect/configure a tool:
     \`\`\`json
     {
       "action": "connect_tool",
       "toolSlug": "google-sheets",
       "config": { "spreadsheetId": "USER_PROVIDED_ID" }
     }
     \`\`\`
     (For google-docs, use toolSlug "google-docs" and config field "docId").
    - To create a new tool/resource (e.g. create a brand new sheet or doc for this project):
      \`\`\`json
      {
        "action": "create_tool",
        "toolSlug": "google-sheets",
        "config": { "title": "Spreadsheet Title" }
      }
      \`\`\`
      (For google-docs, use toolSlug "google-docs").
   - To fetch/read contents of a connected tool:
     \`\`\`json
     {
       "action": "fetch_tool",
       "toolSlug": "google-sheets",
       "config": { "spreadsheetId": "USER_PROVIDED_ID" }
     }
     \`\`\`
     (For google-docs, use toolSlug "google-docs" and config field "docId").
   - To write/append contents to a connected tool:
     \`\`\`json
     {
       "action": "write_tool",
       "toolSlug": "google-sheets",
       "config": { 
         "spreadsheetId": "USER_PROVIDED_ID",
         "content": "GENERATED_OUTPUT_TEXT"
       }
     }
     \`\`\`
     (For google-docs, use toolSlug "google-docs", config fields "docId" and "content").
 3. Do not invent details; always ask the user for Spreadsheet IDs, Google Doc IDs/URLs, or API keys if you do not have them in your tools list.

=== RESPONSE PROTOCOL FOR ALL OUTPUTS & TASKS ===
CRITICAL: Before generating ANY work output, final draft, design outline, suggestion, code spec, strategy recommendation, copy, report, or any other artifact:
1. You MUST first ask the user:
   - "Would you like me to output this directly here in the chat?"
   - "Or should I connect to or select an app (e.g. Google Docs, Google Sheets, Figma, Notion) to write/fetch/create the content directly in that app?"
2. Do NOT perform the main work or output the final results until the user responds to this question and chooses where the work should be done.
3. If they select an app:
   - Check if that app is already connected (listed in your Tools section with a "spreadsheetId" or "docId" config). If it is already connected, you can directly open and write/fetch from it.
   - If it is NOT connected, ask if they want to connect to an existing one (and provide its ID) or create a new one.
     - To connect to an existing one: ask for its ID, then connect using "connect_tool".
     - To create a new one: output a "create_tool" JSON block.
`);
  } else {
    parts.push(`
=== APP INTEGRATIONS (GROUP PROJECT) ===
You may connect workspace apps when the user explicitly asks to use Docs, Sheets, Figma, or similar. For standard deliverables in group chat, output directly here unless they request an external app.
Use connect_tool / create_tool / fetch_tool / write_tool JSON actions only when external app work is needed.
`);
  }

  return parts.join("\n");
}

export interface ProjectGroupPromptInput {
  title: string;
  goal: string | null;
  description: string | null;
  teammates: Array<{ name: string; role: string }>;
  agentName: string;
}

/** Shared project + group chat instructions injected for every agent in a project group. */
export function buildProjectGroupContextBlock(input: ProjectGroupPromptInput): string {
  const briefLines = [`Project: ${input.title}`];
  if (input.goal?.trim()) briefLines.push(`Goal: ${input.goal.trim()}`);
  if (input.description?.trim()) briefLines.push(`Description: ${input.description.trim()}`);

  const teammateLine =
    input.teammates.length > 0
      ? `Other agents in this group: ${input.teammates.map((t) => `${t.name} (${t.role})`).join(", ")}`
      : "You may be the only agent in this group for now.";

  return (
    `=== PROJECT GROUP BRIEF (READ FIRST — MANDATORY) ===\n` +
    `${briefLines.join("\n")}\n` +
    `${teammateLine}\n\n` +
    `=== GROUP CHAT RULES ===\n` +
    `You are ${input.agentName} in a shared project group chat with the user and other agents.\n` +
    `- Read the FULL conversation history before responding. Teammates' prior messages are part of your context.\n` +
    `- All outputs MUST align with the project brief above and what was already discussed. Never invent unrelated brands, products, industries, or campaigns.\n` +
    `- Build on work already done in chat (copy, briefs, feedback, prior creatives). Do not contradict or ignore teammates.\n` +
    `- When the user or an @mention requests a deliverable (copy, image, post, outline), produce it directly in chat unless they explicitly ask to use Docs, Sheets, Figma, or another app.\n` +
    `- Users can assign tasks with @mentions (e.g. @Design Agent, @Content Agent). Honor @mentions when addressed to you.\n` +
    `- If the user asks for images/visuals and you are NOT the Design Agent, do not refuse — the Design Agent handles visuals; focus on your specialty when relevant.\n` +
    `- Message history uses sender prefixes like "[SenderName]:" — do NOT prefix your own reply with your name; write naturally.\n` +
    `- Users can reference prior messages with #msg- tokens (e.g. #msg-439cf751). When they do, treat the quoted context as part of their request.\n` +
    `====================================================\n\n` +
    ASK_QUESTIONS_PROMPT
  );
}

export const DESIGN_AGENT_IMAGE_INSTRUCTIONS = `
=== IMAGE GENERATION (Design Agent) ===
When the user asks you to create, generate, design, or produce an image, graphic, banner, carousel, thumbnail, or social media creative (with any dimensions or for a specific platform):
1. Do NOT ask whether to output in chat — images are generated automatically and shown in chat with download and publish options.
2. Read the PROJECT GROUP BRIEF and full conversation first. The image MUST match this project's brand, product, messaging, and any copy teammates already wrote.
3. Output this JSON action block (and a brief friendly message before or after it):
\`\`\`json
{
  "action": "generate_image",
  "prompt": "Detailed visual description grounded in the project brief and conversation — include brand name, product, tagline/copy from chat, style, colors, text overlays, and composition",
  "width": 1080,
  "height": 1080,
  "purpose": "instagram_feed"
}
\`\`\`
4. In the prompt field, explicitly reference the project brand/product and reuse headline or copy from Content Agent or the user when available. Never generate visuals for unrelated businesses.
5. Purpose presets (use purpose field OR explicit width/height):
   - instagram_feed: 1080×1080
   - instagram_story / instagram_reel: 1080×1920
   - facebook: 1200×630
   - linkedin: 1200×627
   - x_twitter: 1600×900
   - youtube_thumb: 1280×720
   - pinterest: 1000×1500
   - banner: 1920×1080
6. After the system generates the image, tell the user they can download it or schedule/publish to connected social platforms (Instagram, Facebook, LinkedIn, X, Buffer).
`.trim();
