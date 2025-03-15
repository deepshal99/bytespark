
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Running every-5-minute scheduled tasks for ByteSize newsletter");
    
    // Parse request body for test mode and targetEmail
    let isTest = false;
    let targetEmail = null;
    try {
      const body = await req.json();
      isTest = body.test === true;
      targetEmail = body.targetEmail || null;
    } catch (e) {
      // If there's no body, or it's not valid JSON, just proceed normally
    }
    
    const testMode = isTest ? "?test=true" : "";
    
    // Skip the fetch-tweets and summarize-tweets steps for the 5-minute testing
    // and directly send newsletters using existing summaries
    
    console.log("Sending newsletters (5-minute test mode)...");
    const newsletterResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-newsletters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        test: isTest,
        email: targetEmail,
        forceResend: true
      })
    });
    
    if (!newsletterResponse.ok) {
      const errorText = await newsletterResponse.text();
      console.error("Error sending newsletters:", errorText);
      throw new Error(`Failed to send newsletters: ${errorText}`);
    }
    
    const newsletterData = await newsletterResponse.json();
    console.log("Send newsletters result:", newsletterData);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "5-minute newsletter test completed successfully",
        results: {
          newsletter: newsletterData
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
    
  } catch (error) {
    console.error("Error in cron-scheduler function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
