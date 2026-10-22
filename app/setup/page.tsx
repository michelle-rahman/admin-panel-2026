export default function SetupPage() {
  return <main className="login-shell"><section className="login-card">
    <div className="brand-mark">H<span>·</span></div>
    <p className="eyebrow">ADMIN STUDIO / FIRST DEPLOY</p>
    <h1>One quick<br/><em>setup step.</em></h1>
    <p className="intro">This deployment needs its public Supabase connection settings before sign-in can start.</p>
    <ol className="setup-list"><li>In Vercel, open this project’s <strong>Settings → Environment Variables</strong>.</li><li>Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> from the existing media app.</li><li>Add <code>NEXT_PUBLIC_SITE_URL</code> with this app’s Vercel URL, then redeploy.</li></ol>
    <p className="login-foot">NO SERVICE ROLE KEY IS NEEDED</p>
  </section></main>;
}
