import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createMedia, deleteMedia, signOut, updateMedia } from "../actions";

const styleName: Record<string, string> = { observational: "Observational", absurdist: "Absurdist", wholesome: "Wholesome", campus_lore: "Campus lore" };
const pageSize = 25;
type Search = { profilesPage?: string; mediaPage?: string; votesPage?: string; profileSearch?: string; mediaSearch?: string; vote?: string };
const pageNumber = (value?: string) => Math.max(1, Number.parseInt(value ?? "1", 10) || 1);

function Pager({ page, total, param, searchKey, searchValue, filterKey, filterValue, anchor }: { page: number; total: number; param: string; searchKey?: string; searchValue?: string; filterKey?: string; filterValue?: string; anchor: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (next: number) => {
    const query = new URLSearchParams({ [param]: String(next) });
    if (searchKey && searchValue) query.set(searchKey, searchValue);
    if (filterKey && filterValue) query.set(filterKey, filterValue);
    return `?${query.toString()}#${anchor}`;
  };
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return <div className="pager"><span>{first}–{last} of {total}</span><div>
    <a aria-disabled={page <= 1} className={page <= 1 ? "disabled" : ""} href={href(Math.max(1, page - 1))}>← Previous</a>
    <span>Page {page} / {pages}</span>
    <a aria-disabled={page >= pages} className={page >= pages ? "disabled" : ""} href={href(Math.min(pages, page + 1))}>Next →</a>
  </div></div>;
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const pPage = pageNumber(params.profilesPage);
  const mPage = pageNumber(params.mediaPage);
  const vPage = pageNumber(params.votesPage);
  const pSearch = params.profileSearch?.trim().slice(0, 100) ?? "";
  const mSearch = params.mediaSearch?.trim().slice(0, 100) ?? "";
  const voteFilter = params.vote === "up" || params.vote === "down" ? params.vote : "all";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("is_superadmin,first_name,last_name").eq("id", user.id).maybeSingle();
  if (profileError || !profile?.is_superadmin) redirect("/?access=denied");

  let profileQuery = supabase.from("profiles").select("id,email,first_name,last_name,avatar_url,created_at", { count: "exact" }).order("created_at", { ascending: false }).range((pPage - 1) * pageSize, pPage * pageSize - 1);
  if (pSearch) profileQuery = profileQuery.ilike("email", `%${pSearch}%`);
  let mediaQuery = supabase.from("caption_generations").select("id,image_path,humor_style,caption_text,upvotes,downvotes,created_at", { count: "exact" }).order("created_at", { ascending: false }).range((mPage - 1) * pageSize, mPage * pageSize - 1);
  if (mSearch) mediaQuery = mediaQuery.ilike("caption_text", `%${mSearch}%`);
  let votesQuery = supabase.from("caption_votes").select("id,generation_id,user_id,vote,created_at", { count: "exact" }).order("created_at", { ascending: false }).range((vPage - 1) * pageSize, vPage * pageSize - 1);
  if (voteFilter === "up") votesQuery = votesQuery.eq("vote", 1);
  if (voteFilter === "down") votesQuery = votesQuery.eq("vote", -1);

  const [profilesResult, mediaResult, votesResult, upResult, downResult] = await Promise.all([
    profileQuery,
    mediaQuery,
    votesQuery,
    supabase.from("caption_votes").select("id", { count: "exact", head: true }).eq("vote", 1),
    supabase.from("caption_votes").select("id", { count: "exact", head: true }).eq("vote", -1),
  ]);
  const profiles = profilesResult.data ?? [];
  const media = mediaResult.data ?? [];
  const votes = votesResult.data ?? [];
  const profileTotal = profilesResult.count ?? 0;
  const mediaTotal = mediaResult.count ?? 0;
  const voteTotal = (upResult.count ?? 0) + (downResult.count ?? 0);
  const upTotal = upResult.count ?? 0;
  const downTotal = downResult.count ?? 0;
  const ratio = voteTotal ? Math.round(upTotal / voteTotal * 100) : 0;
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || user.email || "Admin";
  const failures = [profilesResult.error?.message, mediaResult.error?.message, votesResult.error?.message, upResult.error?.message, downResult.error?.message].filter(Boolean);

  const mediaIds = media.map(item => item.id);
  const detailsResult = mediaIds.length
    ? await supabase.from("caption_generation_details").select("generation_id,source_text,prompt_text").in("generation_id", mediaIds)
    : { data: [], error: null };
  if (detailsResult.error) failures.push(detailsResult.error.message);
  const detailsById = new Map((detailsResult.data ?? []).map(row => [row.generation_id, row]));
  const mediaWithUrls = media.map(item => ({ ...item, imageUrl: item.image_path?.startsWith("http") ? item.image_path : item.image_path ? supabase.storage.from("meme-images").getPublicUrl(item.image_path).data.publicUrl : null }));

  const voterIds = [...new Set(votes.map(voteRow => voteRow.user_id))];
  const votersResult = voterIds.length ? await supabase.from("profiles").select("id,email,first_name,last_name").in("id", voterIds) : { data: [], error: null };
  const voterById = new Map((votersResult.data ?? []).map(voter => [voter.id, voter]));

  return <main className="admin-shell">
    <aside className="sidebar">
      <a className="brand" href="/dashboard"><span className="brand-mark small">H<span>·</span></span><span>humor project<small>ADMIN STUDIO</small></span></a>
      <div className="side-label">WORKSPACE</div>
      <a className="side-link active" href="#overview"><span>◫</span> Overview</a>
      <a className="side-link" href="#media"><span>▧</span> AI media <b>{mediaTotal}</b></a>
      <a className="side-link" href="#people"><span>♙</span> Profiles <b>{profileTotal}</b></a>
      <a className="side-link" href="#ratings"><span>↗</span> Ratings <b>{voteTotal}</b></a>
      <div className="sidebar-bottom"><div className="avatar">{name.slice(0,1).toUpperCase()}</div><div className="person">{name}<small>Superadmin</small></div><form action={signOut}><button className="logout" aria-label="Sign out" title="Sign out">↗</button></form></div>
    </aside>
    <section className="main-area">
      <header className="topbar"><div><span className="crumb">Workspace</span><span className="slash">/</span><span>Overview</span></div><div className="live"><i/> DATABASE LIVE</div></header>
      <div className="content" id="overview">
        <div className="title-row"><div><p className="eyebrow">YOUR DATABASE, AT A GLANCE</p><h1>Good morning, {name.split(" ")[0]}.</h1><p className="subhead">Live counts across your humor studio.</p></div><a className="outline-button" href="#media">＋ Add media</a></div>
        {failures.length > 0 && <div className="error-box"><strong>Some data could not load.</strong><br/>{failures.join(" · ")}<br/>Confirm you ran the latest <code>supabase/admin-panel.sql</code> migration.</div>}
        <div className="stats-grid">
          <article className="stat-card peach"><div className="stat-top"><span>GENERATED MEDIA</span><span className="stat-icon">▧</span></div><strong>{mediaTotal}</strong><p>All media records</p><div className="stat-bar"><i style={{ width: `${Math.min(100, mediaTotal)}%` }}/></div></article>
          <article className="stat-card lilac"><div className="stat-top"><span>COMMUNITY VOTES</span><span className="stat-icon">↗</span></div><strong>{voteTotal}</strong><p>{upTotal} upvotes <span>·</span> {downTotal} downvotes</p><div className="stat-bar"><i style={{ width: `${ratio}%` }}/></div></article>
          <article className="stat-card mint"><div className="stat-top"><span>APPROVAL RATIO</span><span className="stat-icon">％</span></div><strong>{ratio}<small>%</small></strong><p>Upvotes among all recorded votes</p><div className="stat-bar"><i style={{ width: `${ratio}%` }}/></div></article>
          <article className="stat-card butter"><div className="stat-top"><span>USER PROFILES</span><span className="stat-icon">♙</span></div><strong>{profileTotal}</strong><p>All registered profiles</p><div className="stat-bar"><i style={{ width: `${Math.min(100, profileTotal)}%` }}/></div></article>
        </div>
        <section className="panel" id="media">
          <div className="panel-heading"><div><p className="eyebrow">LIBRARY MANAGEMENT</p><h2>AI generated media <span className="count">{mediaTotal}</span></h2></div><span className="muted">Page {mPage} · {pageSize} per page</span></div>
          <form action={createMedia} className="create-form">
            <div className="field"><label>CAPTION</label><input name="caption_text" maxLength={500} placeholder="Write a caption…" required/></div>
            <div className="field"><label>HUMOR STYLE</label><select name="humor_style" defaultValue="observational"><option value="observational">Observational</option><option value="absurdist">Absurdist</option><option value="wholesome">Wholesome</option><option value="campus_lore">Campus lore</option></select></div>
            <div className="field"><label>IMAGE FILE <small>OPTIONAL · JPEG/PNG/WEBP · 5 MB MAX</small></label><input name="image" type="file" accept="image/jpeg,image/png,image/webp"/></div>
            <div className="field"><label>CONTEXT / SOURCE <small>OPTIONAL</small></label><input name="source_text" maxLength={500} placeholder="Prompt context or topic"/></div>
            <div className="field wide"><label>GENERATION PROMPT <small>OPTIONAL</small></label><input name="prompt_text" maxLength={4000} placeholder="Prompt used to create this media"/></div>
            <button className="solid-button" type="submit">Create media <span>＋</span></button>
          </form>
          <form className="search-form" action="/dashboard#media"><input type="search" name="mediaSearch" defaultValue={mSearch} placeholder="Search captions…"/><button className="small-button">Search media</button></form>
          <div className="table-wrap"><table><thead><tr><th>MEDIA</th><th>STYLE</th><th>RATING</th><th>CREATED</th><th>ACTIONS</th></tr></thead><tbody>
            {mediaWithUrls.map(item => { const detail = detailsById.get(item.id); return <tr key={item.id}>
              <td className="caption-cell">{item.imageUrl ? <Image className="media-image" src={item.imageUrl} alt="" width={44} height={44} unoptimized/> : <span className="thumb">✳</span>}<div><strong>{item.caption_text}</strong><small>{item.id.slice(0,8)}…</small></div></td>
              <td><span className="tag">{styleName[item.humor_style] ?? item.humor_style}</span></td>
              <td><span className="up-count">↑ {item.upvotes}</span><span className="down-count"> ↓ {item.downvotes}</span></td>
              <td>{new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
              <td><details className="actions"><summary aria-label="Edit or delete">•••</summary><div className="action-pop">
                <form action={updateMedia}><input type="hidden" name="id" value={item.id}/><label>Caption<input name="caption_text" defaultValue={item.caption_text} required maxLength={500}/></label><label>Style<select name="humor_style" defaultValue={item.humor_style}><option value="observational">Observational</option><option value="absurdist">Absurdist</option><option value="wholesome">Wholesome</option><option value="campus_lore">Campus lore</option></select></label><label>Replace image<input name="image" type="file" accept="image/jpeg,image/png,image/webp"/></label><label>Context / source<input name="source_text" defaultValue={detail?.source_text ?? ""} maxLength={500}/></label><label>Prompt<input name="prompt_text" defaultValue={detail?.prompt_text ?? ""} maxLength={4000}/></label><button type="submit" className="mini-save">Save changes</button></form>
                <form action={deleteMedia}><input type="hidden" name="id" value={item.id}/><button className="delete-button" type="submit">Delete media and image</button></form>
              </div></details></td>
            </tr>; })}
            {media.length === 0 && <tr><td colSpan={5} className="empty">No media matches this page or search.</td></tr>}
          </tbody></table></div>
          <Pager page={mPage} total={mSearch ? mediaResult.count ?? 0 : mediaTotal} param="mediaPage" searchKey="mediaSearch" searchValue={mSearch} anchor="media"/>
        </section>
        <div className="lower-grid">
          <section className="panel compact" id="people"><div className="panel-heading"><div><p className="eyebrow">COMMUNITY</p><h2>User profiles <span className="count">{profileTotal}</span></h2></div><span className="muted">Page {pPage} · {pageSize} per page</span></div>
            <form className="search-form" action="/dashboard#people"><input type="search" name="profileSearch" defaultValue={pSearch} placeholder="Search by email…"/><button className="small-button">Search profiles</button></form>
            <div className="list">{profiles.map(p=><div className="profile-row" key={p.id}><div className="avatar profile-avatar">{(p.first_name?.[0] ?? p.email?.[0] ?? "U").toUpperCase()}</div><div className="profile-name">{[p.first_name,p.last_name].filter(Boolean).join(" ") || "Unnamed member"}<small>{p.email || "No email on profile"}</small><small className="mono">ID {p.id}</small></div><time>{new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time></div>)}
              {profiles.length === 0 && <div className="empty">No profiles match this page or search.</div>}
            </div><Pager page={pPage} total={pSearch ? profilesResult.count ?? 0 : profileTotal} param="profilesPage" searchKey="profileSearch" searchValue={pSearch} anchor="people"/>
          </section>
          <section className="panel compact" id="ratings"><div className="panel-heading"><div><p className="eyebrow">AUDIENCE SIGNAL</p><h2>Ratings <span className="count">{voteTotal}</span></h2></div><span className="muted">Page {vPage} · {pageSize} per page</span></div>
            <form className="search-form" action="/dashboard#ratings"><select name="vote" defaultValue={voteFilter}><option value="all">All ratings</option><option value="up">Upvotes</option><option value="down">Downvotes</option></select><button className="small-button">Filter ratings</button></form>
            <div className="list">{votes.map(v=><div className="vote-row" key={v.id}><span className={v.vote===1?"vote-up":"vote-down"}>{v.vote===1?"↑":"↓"}</span><div className="profile-name">{v.vote===1?"Upvote":"Downvote"}<small>Media {v.generation_id.slice(0,8)}… · {voterById.get(v.user_id)?.email ?? `member ${v.user_id.slice(0,8)}…`}</small></div><time>{new Date(v.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time></div>)}
              {votes.length === 0 && <div className="empty">No ratings match this page or filter.</div>}
            </div><Pager page={vPage} total={votesResult.count ?? 0} param="votesPage" filterKey="vote" filterValue={voteFilter === "all" ? "" : voteFilter} anchor="ratings"/>
          </section>
        </div>
        <footer>HUMOR PROJECT ADMIN <span>•</span> PRIVATE DATABASE CONSOLE</footer>
      </div>
    </section>
  </main>;
}
