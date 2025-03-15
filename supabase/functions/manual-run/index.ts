
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[MANUAL] Starting manual-run function");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[MANUAL] Missing Supabase credentials");
      throw new Error("Missing Supabase credentials");
    }
    
    // Parse request body
    let action = "";
    let email = null;
    let mode = "full";
    
    try {
      const body = await req.json();
      console.log("[MANUAL] Request body:", body);
      action = body.action || "";
      email = body.email || null;
      mode = body.mode || "full";
    } catch (e) {
      console.error("[MANUAL] Error parsing request body:", e);
      throw new Error("Missing required parameter: action");
    }
    
    if (!action) {
      console.error("[MANUAL] Missing action parameter");
      throw new Error("Missing required parameter: action");
    }
    
    let endpoint;
    let requestBody = { 
      manual: true,
      email,
      test: action === "test",
      targetEmail: email
    };
    
    switch (action) {
      case "fetch":
        endpoint = "fetch-tweets";
        break;
      case "summarize":
        endpoint = "summarize-tweets";
        break;
      case "send":
        endpoint = "send-newsletters";
        requestBody.forceResend = true;
        break;
      case "all":
        endpoint = "cron-scheduler";
        break;
      case "test":
        endpoint = "test-newsletter-system";
        requestBody.mode = mode;
        break;
      default:
        console.error(`[MANUAL] Unknown action: ${action}`);
        throw new Error(`Unknown action: ${action}`);
    }
    
    console.log(`[MANUAL] Running manual ${action} action with endpoint ${endpoint}`);
    console.log(`[MANUAL] Request body:`, requestBody);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MANUAL] Error running ${action}:`, errorText);
      throw new Error(`Failed to run ${action}: ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`[MANUAL] ${action} result:`, data);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Manual ${action} completed successfully`,
        results: data
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
    
  } catch (error) {
    console.error("[MANUAL] Error in manual-run function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
