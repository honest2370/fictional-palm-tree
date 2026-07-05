// supabase/functions/ashtech-countries/index.ts
// Public passthrough for GET /v1/countries and GET /v1/fees so the API key
// never touches the browser. Cached for 1 hour at the edge.
import { corsHeaders, json, fetchCountries, fetchFees } from "../_shared/ashtech.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey = Deno.env.get("ASHTECH_API_KEY");
  if (!apiKey) return json({ error: "server_misconfigured" }, 500);

  const url = new URL(req.url);
  const includeFees = url.searchParams.get("fees") === "1";

  const countries = await fetchCountries(apiKey);
  if (!includeFees) {
    return new Response(JSON.stringify(countries), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
    });
  }

  const fees = await fetchFees(apiKey);
  return new Response(JSON.stringify({ countries, fees }), {
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
  });
});
