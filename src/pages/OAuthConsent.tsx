import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Beta auth.oauth namespace — declare the minimal typed surface we use.
type OAuthClient = { name?: string; logo_uri?: string; client_uri?: string };
type OAuthAuthorizationDetails = {
  client?: OAuthClient;
  redirect_uri?: string;
  scope?: string;
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult<T> = { data: T | null; error: { message: string } | null };
type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult<OAuthAuthorizationDetails>>;
  approveAuthorization: (id: string) => Promise<OAuthResult<{ redirect_url?: string; redirect_to?: string }>>;
  denyAuthorization: (id: string) => Promise<OAuthResult<{ redirect_url?: string; redirect_to?: string }>>;
};
const authOAuth = (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;

const OAuthConsent = () => {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/?next=" + encodeURIComponent(next);
        return;
      }
      setUserEmail(sess.session.user.email ?? null);
      const { data, error } = await authOAuth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await authOAuth.approveAuthorization(authorizationId)
      : await authOAuth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-card">
          <h1 className="text-xl font-bold font-display text-foreground">Authorization error</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </main>
    );
  }

  const clientName = details.client?.name ?? "an app";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-card">
        <h1 className="text-xl font-bold font-display text-foreground">
          Connect {clientName} to Spark
        </h1>
        {userEmail && (
          <p className="mt-1 text-xs text-muted-foreground">Signed in as {userEmail}</p>
        )}
        <p className="mt-4 text-sm text-foreground">
          This lets <strong>{clientName}</strong> use Spark as you.
        </p>
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          <li>• Read and update your profile and matches</li>
          <li>• Read and send messages in your matches</li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          This does not bypass Spark's permissions or backend policies.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 rounded-xl border border-border bg-muted py-3 text-sm font-semibold text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 rounded-xl gradient-love py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Please wait…" : "Approve"}
          </button>
        </div>
      </div>
    </main>
  );
};

export default OAuthConsent;
