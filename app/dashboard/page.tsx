import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createMedia, deleteMedia, signOut, updateMedia } from "../actions";

const styleName: Record<string, string> = { observational: "Observational", absurdist: "Absurdist", wholesome: "Wholesome", campus_lore: "Campus lore" };

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("is_superadmin,first_name,last_name").eq("id", user.id).maybeSingle();
  if (profileError || !profile?.is_superadmin) redirect("/?access=denied");

  const [{ data: media, error: mediaError }, { data: votes, error: votesError }, { data: profileRows, error: profilesError }] = await Promise.all([
    supabase.from("caption_generations").select("id,image_path,humor_style,caption_text,upvotes,downvotes,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("caption_votes").select("id,generation_id,user_id,vote,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("profiles").select("id,first_name,last_name,avatar_url,created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  const profiles = profileRows ?? [];
  const voteRows = votes ?? [];
  const up = voteRows.filter(v => v.vote === 1).length;
  const down = voteRows.length - up;
  const ratio = voteRows.length ? Math.round(up / voteRows.length * 100) : 0;
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || user.email || "Admin";
  const errors = [mediaError?.message, votesError?.message, profilesError?.message].filter(Boolean);

  return <main className="admin-shell">
    <aside className="sidebar">
      <a className="brand" href="/dashboard"><span className="brand-mark small">H<span>·</span></span><span>humor project<small>ADMIN STUDIO</small></span></a>
      <div className="side-label">WORKSPACE</div>
      <a className="side-link active" href="#overview"><span>◫</span> Overview</a>
      <a className="side-link" href="#media"><span>▧</span> AI media <b>{media?.length ?? 0}</b></a>
      <a className="side-link" href="#people"><span>♙</span> Profiles <b>{profiles.length}</b></a>
      <a className="side-link" href="#ratings"><span>↗</span> Ratings <b>{voteRows.length}</b></a>
      <div className="sidebar-bottom"><div className="avatar">{name.slice(0,1).toUpperCase()}</div><div className="person">{name}<small>Superadmin</small></div><form action={signOut}><button className="logout" aria-label="Sign out" title="Sign out">↗</button></form></div>
    </aside>
    <section className="main-area">
      <header className="topbar"><div><span className="crumb">Workspace</span><span className="slash">/</span><span>Overview</span></div><div className="live"><i/> DATABASE LIVE</div></header>
      <div className="content" id="overview">
        <div className="title-row"><div><p className="eyebrow">YOUR DATABASE, AT A GLANCE</p><h1>Good morning, {name.split(" ")[0]}.</h1><p className="subhead">Here’s what’s happening across your humor studio.</p></div><a className="outline-button" href="#media">＋ Add media</a></div>
        {errors.length > 0 && <div className="error-box"><strong>Some data could not load.</strong><br/>{errors.join(" · ")}<br/>Confirm you ran <code>supabase/admin-panel.sql</code> in your Supabase SQL Editor.</div>}
        <div className="stats-grid">
          <article className="stat-card peach"><div className="stat-top"><span>MEDIA · LATEST 100</span><span className="stat-icon">▧</span></div><strong>{media?.length ?? "—"}</strong><p>Generated caption media</p><div className="stat-bar"><i style={{ width: `${media?.length ?? 0}%` }}/></div></article>
          <article className="stat-card lilac"><div className="stat-top"><span>VOTES · LATEST 100</span><span className="stat-icon">↗</span></div><strong>{voteRows.length}</strong><p>{up} upvotes <span>·</span> {down} downvotes</p><div className="stat-bar"><i style={{ width: `${ratio}%` }}/></div></article>
          <article className="stat-card mint"><div className="stat-top"><span>APPROVAL RATIO</span><span className="stat-icon">％</span></div><strong>{ratio}<small>%</small></strong><p>Upvotes among latest votes</p><div className="stat-bar"><i style={{ width: `${ratio}%` }}/></div></article>
          <article className="stat-card butter"><div className="stat-top"><span>PROFILES · LATEST 100</span><span className="stat-icon">♙</span></div><strong>{profiles.length}</strong><p>Registered user profiles</p><div className="stat-bar"><i style={{ width: `${Math.min(100, profiles.length)}%` }}/></div></article>
        </div>
        <section className="panel" id="media">
          <div className="panel-heading"><div><p className="eyebrow">LIBRARY MANAGEMENT</p><h2>AI generated media <span className="count">{media?.length ?? 0}</span></h2></div><span className="muted">Showing latest 100</span></div>
          <form action={createMedia} className="create-form">
            <div className="field"><label>CAPTION</label><input name="caption_text" maxLength={500} placeholder="Write a caption…" required/></div>
            <div className="field"><label>HUMOR STYLE</label><select name="humor_style" defaultValue="observational"><option value="observational">Observational</option><option value="absurdist">Absurdist</option><option value="wholesome">Wholesome</option><option value="campus_lore">Campus lore</option></select></div>
            <div className="field"><label>IMAGE PATH <small>OPTIONAL</small></label><input name="image_path" placeholder="Storage path (optional)"/></div>
            <button className="solid-button" type="submit">Create media <span>＋</span></button>
          </form>
          <div className="table-wrap"><table><thead><tr><th>CAPTION</th><th>STYLE</th><th>RATING</th><th>CREATED</th><th>ACTIONS</th></tr></thead><tbody>
            {(media ?? []).map(item => <tr key={item.id}>
              <td className="caption-cell"><span className="thumb">{item.image_path ? "▧" : "✳"}</span><div><strong>{item.caption_text}</strong><small>{item.id.slice(0,8)}…</small></div></td>
              <td><span className="tag">{styleName[item.humor_style] ?? item.humor_style}</span></td>
              <td><span className="up-count">↑ {item.upvotes}</span><span className="down-count"> ↓ {item.downvotes}</span></td>
              <td>{new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
              <td><details className="actions"><summary aria-label="Edit or delete">•••</summary><div className="action-pop">
                <form action={updateMedia}><input type="hidden" name="id" value={item.id}/><label>Caption<input name="caption_text" defaultValue={item.caption_text} required maxLength={500}/></label><label>Style<select name="humor_style" defaultValue={item.humor_style}><option value="observational">Observational</option><option value="absurdist">Absurdist</option><option value="wholesome">Wholesome</option><option value="campus_lore">Campus lore</option></select></label><label>Image path<input name="image_path" defaultValue={item.image_path ?? ""}/></label><button type="submit" className="mini-save">Save changes</button></form>
                <form action={deleteMedia}><input type="hidden" name="id" value={item.id}/><button className="delete-button" type="submit">Delete media</button></form>
              </div></details></td>
            </tr>)}
            {(!media || media.length === 0) && <tr><td colSpan={5} className="empty">Nothing in the library yet. Create your first item above.</td></tr>}
          </tbody></table></div>
        </section>
        <div className="lower-grid">
          <section className="panel compact" id="people"><div className="panel-heading"><div><p className="eyebrow">COMMUNITY</p><h2>Profiles <span className="count">{profiles.length}</span></h2></div><span className="muted">Latest 100</span></div><div className="list">
            {profiles.slice(0,8).map(p => <div className="profile-row" key={p.id}><div className="avatar profile-avatar">{(p.first_name?.[0] ?? "U").toUpperCase()}</div><div className="profile-name">{[p.first_name,p.last_name].filter(Boolean).join(" ") || "Unnamed member"}<small className="mono">{p.id.slice(0,13)}…</small></div><time>{new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</time></div>)}
            {profiles.length === 0 && <div className="empty">No profiles to show.</div>}
          </div></section>
          <section className="panel compact" id="ratings"><div className="panel-heading"><div><p className="eyebrow">AUDIENCE SIGNAL</p><h2>Recent ratings <span className="count">{voteRows.length}</span></h2></div><span className="muted">Latest 100</span></div><div className="list">
            {voteRows.slice(0,8).map(v => <div className="vote-row" key={v.id}><span className={v.vote === 1 ? "vote-up" : "vote-down"}>{v.vote === 1 ? "↑" : "↓"}</span><div className="profile-name">{v.vote === 1 ? "Upvote" : "Downvote"}<small>Media {v.generation_id.slice(0,8)}… · member {v.user_id.slice(0,8)}…</small></div><time>{new Date(v.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</time></div>)}
            {voteRows.length === 0 && <div className="empty">No ratings recorded yet.</div>}
          </div></section>
        </div>
        <footer>HUMOR PROJECT ADMIN <span>•</span> PRIVATE DATABASE CONSOLE</footer>
      </div>
    </section>
  </main>;
}
