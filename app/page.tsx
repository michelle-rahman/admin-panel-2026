import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signIn } from "./actions";

export default async function Home({ searchParams }: { searchParams: Promise<{ access?: string; auth?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data } = await supabase.from("profiles").select("is_superadmin").eq("id", user.id).maybeSingle();
    if (data?.is_superadmin) redirect("/dashboard");
  }
  const query = await searchParams;
  return <main className="login-shell"><div className="login-card">
    <div className="brand-mark">H<span>·</span></div>
    <p className="eyebrow">HUMOR PROJECT / CONTROL ROOM</p>
    <h1>Good ideas<br/><em>need a back office.</em></h1>
    <p className="intro">A private workspace for your media library, creators, and audience response.</p>
    <form action={signIn}><button className="google-button" type="submit"><span className="google-g">G</span> Continue with Google <span aria-hidden="true">↗</span></button></form>
    {query.access === "denied" && <p className="notice">This Google account does not have admin access yet. Grant the admin flag in Supabase, then sign in again.</p>}
    {query.auth === "error" && <p className="notice">Google sign-in did not complete. Check the Supabase OAuth redirect settings and try again.</p>}
    <p className="login-foot">AUTHENTICATED ACCESS ONLY <span>•</span> SUPERADMIN REQUIRED</p>
  </div></main>;
}
