import { query } from "../db.js";
import type { CreativeRow } from "./creativePublish.js";
import { publishToSocialPlatform } from "./socialPublisher.js";
import { publishSocialPostById } from "./socialPosts.js";

export async function processDueScheduledPosts(): Promise<number> {
  let processed = 0;

  const posts = await query<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM social_posts
     WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= NOW()
     ORDER BY scheduled_at ASC
     LIMIT 20`
  );

  for (const post of posts.rows) {
    await publishSocialPostById(post.user_id, post.id);
    processed += 1;
  }

  const creatives = await query<CreativeRow>(
    `SELECT * FROM agent_creatives
     WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= NOW()
     ORDER BY scheduled_at ASC
     LIMIT 20`
  );

  for (const creative of creatives.rows) {
    if (!creative.publish_platform || !creative.user_id) continue;

    const result = await publishToSocialPlatform({
      userId: creative.user_id,
      platform: creative.publish_platform,
      content: creative.prompt,
      creativeFileName: creative.file_name,
      creativeId: creative.id,
    });

    if (result.success) {
      await query(
        `UPDATE agent_creatives SET
           status = 'published',
           published_at = NOW(),
           metadata = metadata || $2::jsonb,
           updated_at = NOW()
         WHERE id = $1`,
        [creative.id, JSON.stringify({ externalPostId: result.externalPostId, live: result.live })]
      );
      processed += 1;
    } else {
      await query(
        `UPDATE agent_creatives SET status = 'failed', publish_notes = $2, updated_at = NOW() WHERE id = $1`,
        [creative.id, result.message]
      );
    }
  }

  return processed;
}

export function startSocialScheduler(intervalMs = 60_000): () => void {
  const tick = () => {
    processDueScheduledPosts().catch((err) => {
      console.error("Social scheduler error:", err);
    });
  };
  tick();
  const handle = setInterval(tick, intervalMs);
  return () => clearInterval(handle);
}
