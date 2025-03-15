
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
    // Parse request body
    const { action, email } = await req.json();
    
    if (!action) {
      throw new Error("Missing required parameter: action");
    }
    
    let endpoint;
    switch (action) {
      case "fetch":
        endpoint = "fetch-tweets";
        break;
      case "summarize":
        endpoint = "summarize-tweets";
        break;
      case "send":
        endpoint = "send-newsletters";
        break;
      case "all":
        endpoint = "cron-scheduler";
        break;
      case "test":
        endpoint = "test-newsletter-system";
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    console.log(`Running manual ${action} action`);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ 
        manual: true,
        email,
        test: action === "test",
        targetEmail: email
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error running ${action}:`, errorText);
      throw new Error(`Failed to run ${action}: ${errorText}`);
    }
    
    const data = await response.json();
    
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
    console.error("Error in manual-run function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
