import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.0"

const POLICY = "2026-11-07.v1"
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function ids(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100
    || value.some(id => typeof id !== "string" || !uuid.test(id))
    || new Set(value).size !== value.length) throw new Error("Select 1–100 distinct reviews")
  return value
}

// Called only after admin-content-refresh has verified both JWT and admin membership.
export async function handleVideoCuration(service: SupabaseClient, actor: string, body: Record<string, unknown>) {
  if (body.action === "curation_list") {
    const offset = Number(body.offset ?? 0)
    if (!Number.isInteger(offset) || offset < 0) throw new Error("Invalid page")
    const { data, error } = await service.from("video_curation_reviews")
      .select("*, artists(name)").eq("requested_by", actor)
      .order("created_at", { ascending: false }).order("id").range(offset, offset + 49)
    if (error) throw error
    return { reviews: data }
  }
  if (body.action === "curation_candidates") {
    if (typeof body.artist_id !== "string" || !uuid.test(body.artist_id)) throw new Error("Select an artist")
    const [videos, decisions] = await Promise.all([
      service.from("artist_videos").select("*").eq("artist_id", body.artist_id).order("display_order"),
      service.from("video_curation_decisions").select("*, video_curation_reviews(before_videos,source_videos)").eq("artist_id", body.artist_id),
    ])
    if (videos.error || decisions.error) throw videos.error ?? decisions.error
    return { videos: videos.data, decisions: decisions.data }
  }
  if (body.action === "curation_preview") {
    if (typeof body.artist_id !== "string" || !uuid.test(body.artist_id)
      || typeof body.youtube_video_id !== "string" || !/^[\w-]{11}$/.test(body.youtube_video_id)
      || !["keep", "remove"].includes(String(body.decision))
      || (body.decision === "keep" && !["concert", "interview", "music_video"].includes(String(body.target_type)))
      || typeof body.reason !== "string" || !body.reason.trim() || body.reason.trim().length > 2000) {
      throw new Error("An artist, video, decision, section and reason are required")
    }
    const { data, error } = await service.rpc("preview_video_curation", {
      p_actor: actor, p_artist: body.artist_id, p_video: body.youtube_video_id,
      p_action: body.decision, p_target: body.decision === "remove" ? null : body.target_type,
      p_reason: body.reason.trim(), p_policy: POLICY,
    })
    if (error) throw error
    return { review: data }
  }
  if (body.action === "curation_dismiss") {
    const selected = ids(body.ids)
    const { data, error } = await service.from("video_curation_reviews")
      .update({ status: "dismissed" }).eq("requested_by", actor)
      .in("id", selected).in("status", ["preview", "approved"]).select("id")
    if (error) throw error
    return { dismissed: data.length }
  }
  if (body.action === "curation_approve") {
    const { error } = await service.rpc("approve_video_curation", { p_actor: actor, p_ids: ids(body.ids) })
    if (error) throw error
    return { status: "approved" }
  }
  if (body.action === "curation_apply") {
    const selected = ids(body.ids)
    const { data, error } = await service.from("video_curation_reviews").select("id,artist_id")
      .eq("requested_by", actor).in("id", selected)
    if (error) throw error
    if (data.length !== selected.length) throw new Error("Reviews not found")
    const groups = new Map<string, string[]>()
    for (const row of data) groups.set(row.artist_id, [...(groups.get(row.artist_id) ?? []), row.id])
    const results = []
    // Each artist is atomic; failures remain visible and retryable independently.
    for (const [artist_id, reviewIds] of groups) {
      const result = await service.rpc("apply_video_curation", { p_actor: actor, p_ids: reviewIds })
      results.push({ artist_id, ids: reviewIds, ...(result.error
        ? { status: "failed", error: result.error.message } : result.data) })
    }
    return { results }
  }
  throw new Error("Unknown curation action")
}
