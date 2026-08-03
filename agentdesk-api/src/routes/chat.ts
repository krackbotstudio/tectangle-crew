import { Router, type Request, type Response } from "express";
import { query } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { config } from "../config.js";
import { retrieveKnowledgeContext } from "../services/knowledgeIndexer.js";
import { listConfiguredProviders, loadAiConfig } from "../services/aiSettings.js";
import {
  formatUserFacingLlmError,
  generateDirectAgentReply,
} from "../services/llmClient.js";
import { buildAgentSystemPrompt, buildProjectGroupContextBlock, DESIGN_AGENT_IMAGE_INSTRUCTIONS } from "../services/promptBuilder.js";
import { listEffectiveToolsForAgent, listEffectiveToolsForAgentOnProject } from "../services/projectTools.js";
import { loadProjectGroupContext, formatProjectBrief } from "../services/projectGroupContext.js";
import { upsertWorkspaceIntegration } from "../services/workspaceIntegrations.js";
import {
  executeIntegrationTool,
  verifyIntegration,
  hasLiveIntegration,
} from "../services/integrations/index.js";
import {
  generateAgentImage,
  isDesignAgent,
  isImageGenerationRequest,
  isImageGenerationRequestWithContext,
  extractImagePromptFromMessage,
  buildImagePromptFromContext,
  parseDimensionsFromMessage,
  resolveGroupResponders,
} from "../services/imageGeneration.js";
import { mapCreative } from "../services/creativePublish.js";
import { parseAskQuestionsFromReply } from "../services/agentQuestions.js";
import { expandMessageReferences } from "../services/messageRefs.js";
import { createSocialPost } from "../services/socialPosts.js";
import { SOCIAL_MEDIA_MANAGER_PROMPT } from "../services/socialMediaPrompts.js";
import {
  buildSocialWorkspaceContext,
  isSocialMediaAgent,
} from "../services/socialAgentContext.js";
import { routeParam } from "../utils/routeParam.js";

const router = Router();

router.get("/:slug/messages", authRequired, async (req, res) => {
  const slug = routeParam(req.params.slug);
  const projectId = req.query.projectId as string | undefined;

  if (projectId) {
    const result = await query<{
      id: string;
      role: "user" | "assistant";
      content: string;
      created_at: string;
      agent_id: string;
      agent_name: string | null;
      agent_avatar_color: string | null;
      metadata: Record<string, unknown>;
    }>(
      `SELECT cm.id, cm.role, cm.content, cm.created_at, cm.agent_id,
              a.name AS agent_name, a.avatar_color AS agent_avatar_color,
              COALESCE(cm.metadata, '{}'::jsonb) AS metadata
       FROM chat_messages cm
       LEFT JOIN agents a ON a.id = cm.agent_id
       WHERE cm.project_id = $1
       ORDER BY cm.created_at ASC
       LIMIT 200`,
      [projectId]
    );

    res.json({
      messages: result.rows.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
        agentId: m.agent_id,
        agentName: m.agent_name,
        avatarColor: m.agent_avatar_color,
        metadata: m.metadata,
        creatives: (m.metadata?.creatives as unknown[]) ?? [],
        questions: (m.metadata?.questions as unknown[]) ?? [],
      })),
    });
    return;
  }

  const agentResult = await query<{ id: string }>("SELECT id FROM agents WHERE slug = $1", [slug]);
  const agent = agentResult.rows[0];
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const result = await query<{
    id: string;
    role: "user" | "assistant";
    content: string;
    created_at: string;
    metadata: Record<string, unknown>;
  }>(
    `SELECT id, role, content, created_at, COALESCE(metadata, '{}'::jsonb) AS metadata FROM chat_messages
     WHERE agent_id = $1 AND project_id IS NULL AND (user_id = $2 OR user_id IS NULL)
     ORDER BY created_at ASC
     LIMIT 200`,
    [agent.id, req.user!.id]
  );

  res.json({
    messages: result.rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
      metadata: m.metadata,
      creatives: (m.metadata?.creatives as unknown[]) ?? [],
      questions: (m.metadata?.questions as unknown[]) ?? [],
    })),
  });
});

router.post("/:slug/send", authRequired, async (req, res) => {
  try {
    await processChatSend(req, res);
  } catch (error) {
    const pgCode = (error as { code?: string }).code;
    if (pgCode === "23503") {
      res.status(401).json({ error: "Session expired. Please sign out and sign in again." });
      return;
    }
    throw error;
  }
});

interface AgentRow {
  id: string;
  slug: string;
  name: string;
  webhook_url: string | null;
  chat_webhook_path: string | null;
  system_prompt: string | null;
  is_active: boolean;
  chat_mode: "direct" | "n8n";
  llm_provider: string | null;
  llm_model: string | null;
  llm_temperature: number;
  skills: string[];
  rules: string[];
  constraints: string[];
  parent_agent_id: string | null;
}

async function executeAgentResponse(
  currentAgent: AgentRow,
  message: string,
  projectId: string | null,
  userId: string,
  userName: string
): Promise<{
  reply: string;
  source: string;
  taskId?: string;
  provider?: string;
  providerLabel?: string;
  model?: string;
}> {
  const expandedMessage = /#msg-[a-f0-9]{6,8}/i.test(message)
    ? await expandMessageReferences(message.trim(), projectId, userId)
    : message.trim();

  let historyResult: { rows: Array<{ role: string; content: string; name?: string }> };
  if (projectId) {
    historyResult = await query<{ role: string; content: string; name?: string }>(
      `SELECT cm.role, cm.content, a.name
       FROM chat_messages cm
       LEFT JOIN agents a ON a.id = cm.agent_id
       WHERE cm.project_id = $1
       ORDER BY cm.created_at DESC LIMIT 50`,
      [projectId]
    );
  } else {
    historyResult = await query<{ role: string; content: string; name?: string }>(
      `SELECT role, content FROM chat_messages
       WHERE agent_id = $1 AND project_id IS NULL AND user_id = $2
       ORDER BY created_at DESC LIMIT 10`,
      [currentAgent.id, userId]
    );
  }

  const rawHistory = historyResult.rows.reverse();
  const history = rawHistory
    .map((m, idx) => {
      if (m.role !== "user" && m.role !== "assistant") return null;
      const isLatestUser = idx === rawHistory.length - 1 && m.role === "user";
      if (projectId) {
        const prefix = m.role === "user" ? userName : m.name ?? "Agent";
        const cleanContent = (isLatestUser ? expandedMessage : m.content).trim();
        const prefixStr = `[${prefix}]:`;
        const content = cleanContent.startsWith(prefixStr)
          ? cleanContent
          : `${prefixStr} ${cleanContent}`;
        return {
          role: m.role as "user" | "assistant",
          content,
        };
      }
      return {
        role: m.role as "user" | "assistant",
        content: isLatestUser ? expandedMessage : m.content,
      };
    })
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } => m !== null
    );

  const projectContext = projectId
    ? await loadProjectGroupContext(projectId, currentAgent.id)
    : null;

  const agentForPrompt = projectContext
    ? { ...currentAgent, ...projectContext.agentConfig }
    : currentAgent;

  const knowledgeQuery = projectContext
    ? `${projectContext.title}. ${projectContext.goal ?? ""}. ${projectContext.description ?? ""}. ${expandedMessage}`
    : expandedMessage;

  // Prefer this agent's knowledge; also pull from parent template for project instances
  let knowledgeContext = await retrieveKnowledgeContext(currentAgent.id, knowledgeQuery);
  if (!knowledgeContext.trim() && currentAgent.parent_agent_id) {
    knowledgeContext = await retrieveKnowledgeContext(currentAgent.parent_agent_id, knowledgeQuery);
  }
  const effectiveTools = projectId
    ? await listEffectiveToolsForAgentOnProject(currentAgent.id, projectId)
    : await listEffectiveToolsForAgent(currentAgent.id);
  const toolPromptInfo = effectiveTools.map((t) => ({
    toolName: t.toolName,
    status: t.status,
    capabilities: t.capabilities,
    description: t.description,
    accountLabel: t.accountLabel,
    connectionType: t.connectionType,
    workspaceStatus: t.workspaceStatus,
    config: t.config,
  }));

  const socialAgent = isSocialMediaAgent({
    slug: currentAgent.slug,
    name: currentAgent.name,
    parent_agent_id: currentAgent.parent_agent_id,
    skills: Array.isArray(currentAgent.skills)
      ? currentAgent.skills.map(String)
      : [],
  });

  let systemPrompt = buildAgentSystemPrompt(agentForPrompt, knowledgeContext, toolPromptInfo, {
    skipOutputLocationGate: Boolean(projectContext) || socialAgent,
  });
  if (isDesignAgent(currentAgent)) {
    systemPrompt += `\n\n${DESIGN_AGENT_IMAGE_INSTRUCTIONS}`;
  }
  if (
    socialAgent ||
    effectiveTools.some((t) =>
      ["instagram", "facebook", "linkedin", "x-twitter", "tiktok", "buffer", "meta-business"].includes(
        t.toolSlug
      )
    )
  ) {
    systemPrompt += `\n\n${SOCIAL_MEDIA_MANAGER_PROMPT}`;
    const socialContext = await buildSocialWorkspaceContext({
      userId,
      projectId,
      projectTitle: projectContext?.title,
      projectGoal: projectContext?.goal,
      projectDescription: projectContext?.description,
    });
    systemPrompt += `\n\n${socialContext}`;
  }
  if (projectContext) {
    systemPrompt += `\n\n${buildProjectGroupContextBlock({
      title: projectContext.title,
      goal: projectContext.goal,
      description: projectContext.description,
      teammates: projectContext.teammates,
      agentName: currentAgent.name,
    })}`;
  }

  let taskId: string | undefined;
  try {
    const taskInsert = await query<{ id: string }>(
      `INSERT INTO tasks (agent_id, title, status, current_step)
       VALUES ($1, $2, 'running', 'Processing chat message')
       RETURNING id`,
      [currentAgent.id, `Chat: ${message.trim().slice(0, 80)}`]
    );
    taskId = taskInsert.rows[0].id;
  } catch {
    // non-fatal
  }

  const webhookUrl =
    currentAgent.webhook_url ||
    (currentAgent.chat_webhook_path
      ? `${config.n8nBaseUrl}/webhook/${currentAgent.chat_webhook_path}`
      : null);

  const useDirect = currentAgent.chat_mode === "direct" || !webhookUrl;

  if (useDirect) {
    try {
      const aiConfig = await loadAiConfig();

      if (listConfiguredProviders(aiConfig).length === 0) {
        const reply = `${currentAgent.name} is set to built-in AI chat, but no working provider is available. Add a provider under Workspace settings → AI models (Anthropic, OpenAI, Google, or any OpenAI-compatible API), paste your API key, and click Save.`;

        await query(
          "INSERT INTO chat_messages (agent_id, user_id, role, content, project_id) VALUES ($1, $2, 'assistant', $3, $4)",
          [currentAgent.id, userId, reply, projectId ?? null]
        );
        if (taskId) {
          await query(
            `UPDATE tasks SET status = 'failed', error_detail = $2, current_step = 'Missing AI provider key', updated_at = NOW() WHERE id = $1`,
            [taskId, "No AI provider API key configured"]
          );
        }
        return { reply, source: "fallback", taskId };
      }

      // Design agent: generate images directly when user asks (skip "ask where to output" flow)
      const recentTexts = history.map((h) => h.content);
      const imageTask = isImageGenerationRequestWithContext(message, recentTexts);

      if (isDesignAgent(currentAgent) && imageTask) {
        const dims = parseDimensionsFromMessage(
          [...recentTexts, message].join(" ")
        );
        const prompt = buildImagePromptFromContext(message, recentTexts, {
          projectBrief: projectContext ? formatProjectBrief(projectContext) : undefined,
        });
        const imageResult = await handleGenerateImageAction({
          action: {
            action: "generate_image",
            prompt,
            width: dims.width,
            height: dims.height,
            purpose: dims.purpose,
          },
          agent: currentAgent,
          userId,
          projectId,
          aiConfig,
          projectBrief: projectContext ? formatProjectBrief(projectContext) : undefined,
        });
        if (imageResult) {
          if (taskId) {
            await query(
              `UPDATE tasks SET status = 'done', current_step = 'Creative generated', updated_at = NOW() WHERE id = $1`,
              [taskId]
            );
          }
          return imageResult;
        }
      }

      const historyInput = history.length > 0 ? history.slice(0, -1) : [];
      const userMessageInput = history.length > 0 ? history[history.length - 1].content : message.trim();

      let result = await generateDirectAgentReply({
        aiConfig,
        agent: currentAgent,
        systemPrompt,
        history: historyInput,
        userMessage: userMessageInput,
      });

      let finalReply = result.reply;
      const askQuestions = parseAskQuestionsFromReply(result.reply);

      if (askQuestions) {
        const metadata = { questions: askQuestions.questions };
        await query(
          `INSERT INTO chat_messages (agent_id, user_id, role, content, project_id, metadata)
           VALUES ($1, $2, 'assistant', $3, $4, $5::jsonb)`,
          [
            currentAgent.id,
            userId,
            askQuestions.intro,
            projectId ?? null,
            JSON.stringify(metadata),
          ]
        );

        if (taskId) {
          await query(
            `UPDATE tasks SET status = 'done', current_step = 'Questions presented', updated_at = NOW() WHERE id = $1`,
            [taskId]
          );
        }

        return {
          reply: askQuestions.intro,
          source: "direct",
          taskId,
          provider: result.providerRef,
          providerLabel: result.providerLabel,
          model: result.model,
        };
      }

      const action = parseAgentAction(result.reply);
      const socialActions = parseSocialActions(result.reply);

      if (socialActions.length > 0) {
        const replies: string[] = [result.reply.trim()].filter(Boolean);
        for (const socialAction of socialActions) {
          const postResult = await handleSocialPostAction({
            action: socialAction,
            userId,
            projectId,
            agentId: currentAgent.id,
          });
          replies.push(postResult.reply);
        }
        const combined = replies.join("\n\n");
        await query(
          "INSERT INTO chat_messages (agent_id, user_id, role, content, project_id) VALUES ($1, $2, 'assistant', $3, $4)",
          [currentAgent.id, userId, combined, projectId ?? null]
        );
        if (taskId) {
          await query(
            `UPDATE tasks SET status = 'done', current_step = 'Social campaign processed', updated_at = NOW() WHERE id = $1`,
            [taskId]
          );
        }
        return { reply: combined, source: "direct", taskId };
      }

      if (action?.action === "schedule_post" || action?.action === "publish_post" || action?.action === "plan_campaign") {
        const postResult = await handleSocialPostAction({
          action,
          userId,
          projectId,
          agentId: currentAgent.id,
        });
        await query(
          "INSERT INTO chat_messages (agent_id, user_id, role, content, project_id) VALUES ($1, $2, 'assistant', $3, $4)",
          [currentAgent.id, userId, postResult.reply, projectId ?? null]
        );
        if (taskId) {
          await query(
            `UPDATE tasks SET status = 'done', current_step = 'Social post processed', updated_at = NOW() WHERE id = $1`,
            [taskId]
          );
        }
        return { reply: postResult.reply, source: "direct", taskId };
      }

      if (action?.action === "generate_image") {
        const imageResult = await handleGenerateImageAction({
          action,
          agent: currentAgent,
          userId,
          projectId,
          aiConfig,
          projectBrief: projectContext ? formatProjectBrief(projectContext) : undefined,
        });
        if (imageResult) {
          if (taskId) {
            await query(
              `UPDATE tasks SET status = 'done', current_step = 'Creative generated', updated_at = NOW() WHERE id = $1`,
              [taskId]
            );
          }
          return imageResult;
        }
      }

      if (action) {
        // Save the action command response first
        await query(
          "INSERT INTO chat_messages (agent_id, user_id, role, content, project_id) VALUES ($1, $2, 'assistant', $3, $4)",
          [currentAgent.id, userId, result.reply, projectId ?? null]
        );

        let actionFeedback = "";
        if (action.action === "connect_tool" && action.toolSlug) {
          const toolSlug = action.toolSlug;
          const configDetails = action.config || {};

          // Find a project this agent belongs to
          const prjResult = await query<{ project_id: string }>(
            "SELECT project_id FROM project_agents WHERE agent_id = $1 LIMIT 1",
            [currentAgent.id]
          );
          const pId = projectId || prjResult.rows[0]?.project_id;

          if (pId) {
            await query(
              `INSERT INTO project_tools (project_id, tool_slug, tool_name, status, config)
               VALUES ($1, $2, $3, 'connected', $4::jsonb)
               ON CONFLICT (project_id, tool_slug) DO UPDATE SET
                 status = 'connected',
                 config = EXCLUDED.config,
                 updated_at = NOW()`,
              [
                pId,
                toolSlug,
                toolSlug === "google-sheets" ? "Google Sheets" : toolSlug === "google-docs" ? "Google Docs" : toolSlug,
                JSON.stringify(configDetails),
              ]
            );
          }

          await upsertWorkspaceIntegration(toolSlug, {
            status: "configured",
            config: configDetails,
          });

          if (hasLiveIntegration(toolSlug)) {
            const verified = await verifyIntegration(toolSlug);
            if (verified.ok) {
              await upsertWorkspaceIntegration(toolSlug, {
                status: "connected",
                accountLabel: verified.accountLabel,
              });
              actionFeedback = `[System: Connected "${toolSlug}" — ${verified.message} Config: ${JSON.stringify(configDetails)}]`;
            } else {
              actionFeedback = `[System: Tool "${toolSlug}" config saved but verification failed: ${verified.message}. An admin must add valid credentials in App Store and verify.]`;
            }
          } else {
            await upsertWorkspaceIntegration(toolSlug, { status: "connected" });
            actionFeedback = `[System: Connected tool "${toolSlug}" with config: ${JSON.stringify(configDetails)}. Live API adapter not available yet for this app.]`;
          }
        } else if (action.action === "create_tool" && action.toolSlug) {
          const toolSlug = action.toolSlug;
          const configDetails = action.config || {};
          const title = configDetails.title || `Untitled ${toolSlug === "google-sheets" ? "Spreadsheet" : "Document"}`;

          const prjResult = await query<{ project_id: string }>(
            "SELECT project_id FROM project_agents WHERE agent_id = $1 LIMIT 1",
            [currentAgent.id]
          );
          const pId = projectId || prjResult.rows[0]?.project_id;

          let newConfig: Record<string, string> = { ...configDetails, title };
          let createMessage = "";

          if (hasLiveIntegration(toolSlug)) {
            const result = await executeIntegrationTool(toolSlug, {
              action: "create",
              config: newConfig,
            });
            if (!result.ok) {
              actionFeedback = `[System: Failed to create ${toolSlug}: ${result.message}]`;
            } else {
              createMessage = result.message;
              if (result.data) {
                try {
                  const parsed = JSON.parse(result.data) as Record<string, string>;
                  newConfig = { ...newConfig, ...parsed };
                } catch {
                  /* keep existing config */
                }
              }
            }
          } else {
            actionFeedback = `[System: Cannot create ${toolSlug} — no live API integration configured. Add credentials in App Store.]`;
          }

          if (!actionFeedback) {
            if (pId) {
              await query(
                `INSERT INTO project_tools (project_id, tool_slug, tool_name, status, config)
                 VALUES ($1, $2, $3, 'connected', $4::jsonb)
                 ON CONFLICT (project_id, tool_slug) DO UPDATE SET
                   status = 'connected',
                   config = EXCLUDED.config,
                   updated_at = NOW()`,
                [
                  pId,
                  toolSlug,
                  toolSlug === "google-sheets" ? "Google Sheets" : toolSlug === "google-docs" ? "Google Docs" : toolSlug,
                  JSON.stringify(newConfig),
                ]
              );
            }

            await upsertWorkspaceIntegration(toolSlug, {
              status: "connected",
              config: newConfig,
            });

            actionFeedback = `[System: ${createMessage} Config: ${JSON.stringify(newConfig)}]`;
          }
        } else if (action.action === "fetch_tool" && action.toolSlug) {
          const toolSlug = action.toolSlug;
          const configDetails = action.config || {};

          if (hasLiveIntegration(toolSlug)) {
            const result = await executeIntegrationTool(toolSlug, {
              action: "fetch",
              config: configDetails,
            });
            if (!result.ok) {
              actionFeedback = `[System: Failed to fetch from ${toolSlug}: ${result.message}]`;
            } else {
              actionFeedback = `[System: ${result.message}\n\n${result.data ?? "(empty)"}]`;
            }
          } else {
            actionFeedback = `[System: ${toolSlug} has no live API integration. Configure credentials in App Store first.]`;
          }
        } else if (action.action === "write_tool" && action.toolSlug) {
          const toolSlug = action.toolSlug;
          const configDetails = action.config || {};
          const content = configDetails.content || "";

          if (hasLiveIntegration(toolSlug)) {
            const result = await executeIntegrationTool(toolSlug, {
              action: "write",
              config: configDetails,
              content,
            });
            actionFeedback = result.ok
              ? `[System: ${result.message}]`
              : `[System: Failed to write to ${toolSlug}: ${result.message}]`;
          } else {
            actionFeedback = `[System: ${toolSlug} has no live API integration. Configure credentials in App Store first.]`;
          }
        }

        if (actionFeedback) {
          await query(
            "INSERT INTO chat_messages (agent_id, user_id, role, content, project_id) VALUES ($1, $2, 'user', $3, $4)",
            [currentAgent.id, userId, actionFeedback, projectId ?? null]
          );

          // Query the messages again to get the updated history
          let updatedHistoryResult;
          if (projectId) {
            updatedHistoryResult = await query<{ role: string; content: string; name?: string }>(
              `SELECT cm.role, cm.content, a.name
               FROM chat_messages cm
               LEFT JOIN agents a ON a.id = cm.agent_id
               WHERE cm.project_id = $1
               ORDER BY cm.created_at DESC LIMIT 15`,
              [projectId]
            );
          } else {
            updatedHistoryResult = await query<{ role: string; content: string }>(
              `SELECT role, content FROM chat_messages
               WHERE agent_id = $1 AND project_id IS NULL AND user_id = $2
               ORDER BY created_at DESC LIMIT 15`,
              [currentAgent.id, userId]
            );
          }

          const rawUpdatedHistory = updatedHistoryResult.rows.reverse();
          const updatedHistory = rawUpdatedHistory.filter(
            (m): m is { role: "user" | "assistant"; content: string; name?: string } =>
              m.role === "user" || m.role === "assistant"
          ).map((m) => {
            if (projectId) {
              const prefix = m.role === "user" ? userName : m.name ?? "Agent";
              const cleanContent = m.content.trim();
              const prefixStr = `[${prefix}]:`;
              const content = cleanContent.startsWith(prefixStr)
                ? cleanContent
                : `${prefixStr} ${cleanContent}`;
              return {
                role: m.role as "user" | "assistant",
                content,
              };
            } else {
              return {
                role: m.role as "user" | "assistant",
                content: m.content,
              };
            }
          });

          const recursiveResult = await generateDirectAgentReply({
            aiConfig,
            agent: currentAgent,
            systemPrompt,
            history: updatedHistory.length > 0 ? updatedHistory.slice(0, -1) : [],
            userMessage: updatedHistory.length > 0 ? updatedHistory[updatedHistory.length - 1].content : actionFeedback,
          });

          finalReply = recursiveResult.reply;
          result = recursiveResult;
        }
      } else {
        await query(
          "INSERT INTO chat_messages (agent_id, user_id, role, content, project_id) VALUES ($1, $2, 'assistant', $3, $4)",
          [currentAgent.id, userId, result.reply, projectId ?? null]
        );
      }

      if (action) {
        await query(
          "INSERT INTO chat_messages (agent_id, user_id, role, content, project_id) VALUES ($1, $2, 'assistant', $3, $4)",
          [currentAgent.id, userId, finalReply, projectId ?? null]
        );
      }

      if (taskId) {
        await query(
          `UPDATE tasks SET status = 'done', current_step = 'Chat response delivered', updated_at = NOW() WHERE id = $1`,
          [taskId]
        );
      }

      return {
        reply: finalReply,
        source: "direct",
        taskId,
        provider: result.providerRef,
        providerLabel: result.providerLabel,
        model: result.model,
      };
    } catch (error) {
      const errMsg = formatUserFacingLlmError(error);
      const reply = errMsg.startsWith("Google AI quota") || errMsg.startsWith("The Google AI")
        ? errMsg
        : `Could not generate a response. ${errMsg}`;

      await query(
        "INSERT INTO chat_messages (agent_id, user_id, role, content, project_id) VALUES ($1, $2, 'assistant', $3, $4)",
        [currentAgent.id, userId, reply, projectId ?? null]
      );

      if (taskId) {
        await query(
          `UPDATE tasks SET status = 'failed', error_detail = $2, current_step = 'LLM error', updated_at = NOW() WHERE id = $1`,
          [taskId, errMsg]
        );
      }

      return { reply, source: "error", taskId };
    }
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AgentDesk-Secret": config.webhookSecret,
      },
      body: JSON.stringify({
        message: message.trim(),
        userId,
        userName,
        agentSlug: currentAgent.slug,
        systemPrompt,
        knowledgeContext,
        history,
        taskId,
        availableTools: toolPromptInfo,
        projectId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }

    const data = (await response.json()) as { reply?: string; taskId?: string };
    const reply =
      data.reply ||
      "I received your message but did not get a valid response from the agent workflow.";

    await query(
      "INSERT INTO chat_messages (agent_id, user_id, role, content, project_id) VALUES ($1, $2, 'assistant', $3, $4)",
      [currentAgent.id, userId, reply, projectId ?? null]
    );

    if (taskId) {
      await query(
        `UPDATE tasks SET status = 'done', current_step = 'Chat response delivered', updated_at = NOW() WHERE id = $1`,
        [taskId]
      );
    }

    return { reply, source: "n8n", taskId: data.taskId || taskId };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    const reply = `Could not reach the ${currentAgent.name} workflow (${errMsg}). Check that n8n is running and the webhook is active, or switch to built-in AI in Settings.`;

    await query(
      "INSERT INTO chat_messages (agent_id, user_id, role, content, project_id) VALUES ($1, $2, 'assistant', $3, $4)",
      [currentAgent.id, userId, reply, projectId ?? null]
    );

    if (taskId) {
      await query(
        `UPDATE tasks SET status = 'failed', error_detail = $2, current_step = 'Webhook error', updated_at = NOW() WHERE id = $1`,
        [taskId, errMsg]
      );
    }

    return { reply, source: "error", taskId };
  }
}

async function processChatSend(req: Request, res: Response) {
  const slug = routeParam(req.params.slug);
  const { message, projectId } = req.body as { message?: string; projectId?: string };
  if (!message?.trim()) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  const userId = req.user!.id;
  const userName = req.user!.name;

  const agentResult = await query<AgentRow>(
    "SELECT * FROM agents WHERE slug = $1",
    [slug]
  );

  const agent = agentResult.rows[0];
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  // Insert the user message once into the group/private chat feed
  await query(
    "INSERT INTO chat_messages (agent_id, user_id, role, content, project_id) VALUES ($1, $2, 'user', $3, $4)",
    [agent.id, userId, message.trim(), projectId ?? null]
  );

  let agentsToRespond: AgentRow[] = [agent];

  if (projectId) {
    const groupAgentsResult = await query<AgentRow>(
      `SELECT a.* FROM project_agents pa
       JOIN agents a ON a.id = pa.agent_id
       WHERE pa.project_id = $1 AND a.is_active = true
       ORDER BY pa.added_at`,
      [projectId]
    );

    const allGroupAgents = groupAgentsResult.rows;

    const recentResult = await query<{ content: string }>(
      `SELECT content FROM chat_messages
       WHERE project_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [projectId]
    );
    const recentMessages = recentResult.rows.map((r) => r.content).reverse();

    const resolved = resolveGroupResponders({
      message: message.trim(),
      activeAgent: agent,
      groupAgents: allGroupAgents,
      recentMessages,
    });

    agentsToRespond = allGroupAgents.filter((a) => resolved.some((r) => r.id === a.id));
  }

  let finalResult: any = null;

  for (const currentAgent of agentsToRespond) {
    if (!currentAgent.is_active) {
      if (currentAgent.id === agent.id) {
        const fallback = `The ${currentAgent.name} agent is not active yet. An admin can activate it in Settings.`;
        await query(
          "INSERT INTO chat_messages (agent_id, user_id, role, content, project_id) VALUES ($1, $2, 'assistant', $3, $4)",
          [currentAgent.id, userId, fallback, projectId ?? null]
        );
        finalResult = { reply: fallback, source: "fallback" };
      }
      continue;
    }

    finalResult = await executeAgentResponse(currentAgent, message, projectId ?? null, userId, userName);
  }

  if (!finalResult) {
    finalResult = { reply: "No active agents responded.", source: "fallback" };
  }

  res.json(finalResult);
}

interface AgentAction {
  action:
    | "connect_tool"
    | "fetch_tool"
    | "write_tool"
    | "create_tool"
    | "generate_image"
    | "schedule_post"
    | "publish_post"
    | "plan_campaign";
  toolSlug?: string;
  config?: Record<string, string>;
  prompt?: string;
  width?: number;
  height?: number;
  purpose?: string;
  platform?: string;
  content?: string;
  handle?: string;
  scheduledAt?: string;
  creativeId?: string;
  theme?: string;
  posts?: Array<{
    platform: string;
    content: string;
    handle?: string;
    scheduledAt?: string;
    creativeId?: string;
    publishNow?: boolean;
  }>;
}

async function handleSocialPostAction(input: {
  action: AgentAction;
  userId: string;
  projectId: string | null;
  agentId: string;
}): Promise<{ reply: string }> {
  if (input.action.action === "plan_campaign") {
    const posts = input.action.posts ?? [];
    if (!posts.length) {
      return { reply: "plan_campaign needs a posts array with platform, content, and scheduledAt." };
    }
    const lines: string[] = [];
    if (input.action.theme) lines.push(`Campaign: ${input.action.theme}`);
    let ok = 0;
    for (const item of posts) {
      if (!item.platform?.trim() || !item.content?.trim()) continue;
      const result = await createSocialPost(input.userId, {
        platform: item.platform.trim(),
        content: item.content.trim(),
        projectId: input.projectId ?? undefined,
        agentId: input.agentId,
        handle: item.handle,
        creativeId: item.creativeId,
        scheduledAt: item.publishNow ? undefined : item.scheduledAt,
        publishNow: Boolean(item.publishNow),
      });
      ok += 1;
      lines.push(`• ${item.platform}: ${result.message}`);
    }
    if (!ok) return { reply: "No valid posts found in the campaign plan." };
    lines.push(`\nScheduled/created ${ok} post(s). Review them in Social → Calendar / Posts.`);
    return { reply: lines.join("\n") };
  }

  const platform = input.action.platform?.trim();
  const content = input.action.content?.trim();
  if (!platform || !content) {
    return { reply: "I need both platform and content to schedule or publish a post." };
  }

  if (input.action.action === "publish_post") {
    const published = await createSocialPost(input.userId, {
      platform,
      content,
      projectId: input.projectId ?? undefined,
      agentId: input.agentId,
      handle: input.action.handle,
      creativeId: input.action.creativeId,
      publishNow: true,
    });
    return { reply: published?.message ?? "Post publish failed." };
  }

  const result = await createSocialPost(input.userId, {
    platform,
    content,
    projectId: input.projectId ?? undefined,
    agentId: input.agentId,
    handle: input.action.handle,
    creativeId: input.action.creativeId,
    scheduledAt: input.action.scheduledAt,
    publishNow: false,
  });

  return { reply: result.message };
}

async function handleGenerateImageAction(input: {
  action: AgentAction;
  agent: AgentRow;
  userId: string;
  projectId: string | null;
  aiConfig: Awaited<ReturnType<typeof loadAiConfig>>;
  projectBrief?: string;
}): Promise<{
  reply: string;
  source: string;
  taskId?: string;
  provider?: string;
  providerLabel?: string;
  model?: string;
  creative?: ReturnType<typeof mapCreative>;
} | null> {
  const rawPrompt = input.action.prompt?.trim();
  if (!rawPrompt) return null;

  let prompt =
    input.projectBrief && !rawPrompt.includes(input.projectBrief.slice(0, 40))
      ? `PROJECT:\n${input.projectBrief}\n\nVISUAL:\n${rawPrompt}`
      : rawPrompt;

  let brand: Awaited<ReturnType<typeof import("../services/brandGuidelines.js").getBrandGuidelines>> | null =
    null;
  try {
    const brandMod = await import("../services/brandGuidelines.js");
    brand = await brandMod.getBrandGuidelines();
    const brandBlock = brandMod.formatBrandImageConstraints(brand);
    if (brandBlock && !prompt.includes("MANDATORY BRAND GUIDELINES")) {
      prompt = `${brandBlock}\n\n${prompt}`;
    }
  } catch {
    /* brand optional */
  }

  try {
    const generated = await generateAgentImage(input.aiConfig, {
      prompt,
      width: input.action.width,
      height: input.action.height,
      purpose: input.action.purpose,
    });

    let fileName = generated.fileName;
    let mimeType = generated.mimeType;
    if (brand) {
      try {
        const { applyBrandLogoOverlay } = await import("../services/brandLogoOverlay.js");
        const overlaid = await applyBrandLogoOverlay(fileName, brand);
        if (overlaid.applied) {
          fileName = overlaid.fileName;
          mimeType = "image/png";
        }
      } catch {
        /* keep original */
      }
    }

    const creativeInsert = await query<{
      id: string;
      project_id: string | null;
      agent_id: string;
      user_id: string | null;
      message_id: string | null;
      prompt: string;
      purpose: string | null;
      width: number | null;
      height: number | null;
      file_name: string;
      mime_type: string;
      provider: string | null;
      status: string;
      publish_platform: string | null;
      scheduled_at: string | null;
      published_at: string | null;
      publish_notes: string | null;
      metadata: Record<string, unknown>;
      created_at: string;
      updated_at: string;
    }>(
      `INSERT INTO agent_creatives
         (project_id, agent_id, user_id, prompt, purpose, width, height, file_name, mime_type, provider, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'generated')
       RETURNING *`,
      [
        input.projectId,
        input.agent.id,
        input.userId,
        prompt,
        generated.purposeLabel,
        generated.width,
        generated.height,
        fileName,
        mimeType,
        generated.provider,
      ]
    );

    const creativeRow = creativeInsert.rows[0];
    const creative = mapCreative(creativeRow);

    const replyText =
      `Here's your ${generated.purposeLabel} creative (${generated.width}×${generated.height}px), generated with ${generated.provider}.\n\n` +
      `You can **download** it below, or **schedule / publish** to connected social platforms from the action buttons.`;

    const metadata = { creatives: [creative] };

    const msgInsert = await query<{ id: string }>(
      `INSERT INTO chat_messages (agent_id, user_id, role, content, project_id, metadata)
       VALUES ($1, $2, 'assistant', $3, $4, $5::jsonb) RETURNING id`,
      [input.agent.id, input.userId, replyText, input.projectId, JSON.stringify(metadata)]
    );

    await query(`UPDATE agent_creatives SET message_id = $2 WHERE id = $1`, [
      creative.id,
      msgInsert.rows[0].id,
    ]);

    return {
      reply: replyText,
      source: "direct",
      provider: generated.provider,
      providerLabel: generated.provider,
      model: "image",
      creative,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Image generation failed";
    const reply = `I couldn't generate the image: ${errMsg}`;
    await query(
      "INSERT INTO chat_messages (agent_id, user_id, role, content, project_id) VALUES ($1, $2, 'assistant', $3, $4)",
      [input.agent.id, input.userId, reply, input.projectId]
    );
    return { reply, source: "error" };
  }
}

function parseAgentAction(text: string): AgentAction | null {
  const actions = parseAllAgentActions(text);
  return actions[0] ?? null;
}

function parseSocialActions(text: string): AgentAction[] {
  return parseAllAgentActions(text).filter(
    (a) =>
      a.action === "schedule_post" ||
      a.action === "publish_post" ||
      a.action === "plan_campaign"
  );
}

function parseAllAgentActions(text: string): AgentAction[] {
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/g;
  const actions: AgentAction[] = [];
  let match: RegExpExecArray | null;
  while ((match = jsonRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (!parsed?.action || parsed.action === "ask_questions") continue;
      if (parsed.action === "generate_image" && parsed.prompt) {
        actions.push(parsed as AgentAction);
        continue;
      }
      if (
        parsed.action === "schedule_post" ||
        parsed.action === "publish_post" ||
        parsed.action === "plan_campaign" ||
        parsed.action === "connect_tool" ||
        parsed.action === "fetch_tool" ||
        parsed.action === "write_tool" ||
        parsed.action === "create_tool"
      ) {
        actions.push(parsed as AgentAction);
      }
    } catch {
      // ignore invalid blocks
    }
  }
  return actions;
}

export default router;
