
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
    console.log("[CRON] Running cron-scheduler function for ByteSize newsletter");
    
    // Parse request body for test mode and targetEmail
    let isTest = false;
    let targetEmail = null;
    let fetchTweets = true;
    let summarizeTweets = true;
    let sendNewsletters = true;
    
    try {
      const body = await req.json();
      console.log("[CRON] Request body:", body);
      isTest = body.test === true;
      targetEmail = body.targetEmail || null;
      
      // Allow configuring which steps to run
      if (body.fetchTweets === false) fetchTweets = false;
      if (body.summarizeTweets === false) summarizeTweets = false;
      if (body.sendNewsletters === false) sendNewsletters = false;
      
    } catch (e) {
      // If there's no body, or it's not valid JSON, just proceed normally
      console.log("[CRON] No valid JSON in request body, using default settings");
    }
    
    console.log(`[CRON] Mode: ${isTest ? 'Test' : 'Production'}, Target email: ${targetEmail || 'All'}`);
    console.log(`[CRON] Steps to run - Fetch: ${fetchTweets}, Summarize: ${summarizeTweets}, Send: ${sendNewsletters}`);
    
    const results = { success: true };
    
    // Step 1: Fetch new tweets
    if (fetchTweets) {
      console.log("[CRON] Running fetch-tweets step");
      const fetchResponse = await fetch(`${SUPABASE_URL}/functions/v1/fetch-tweets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          test: isTest,
          targetEmail
        })
      });
      
      if (!fetchResponse.ok) {
        const errorText = await fetchResponse.text();
        console.error("[CRON] Error fetching tweets:", errorText);
        throw new Error(`Failed to fetch tweets: ${errorText}`);
      }
      
      const fetchData = await fetchResponse.json();
      results.fetch = fetchData;
      console.log("[CRON] Fetch tweets result:", fetchData);
    }
    
    // Step 2: Summarize tweets
    if (summarizeTweets) {
      console.log("[CRON] Running summarize-tweets step");
      const summarizeResponse = await fetch(`${SUPABASE_URL}/functions/v1/summarize-tweets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          test: isTest
        })
      });
      
      if (!summarizeResponse.ok) {
        const errorText = await summarizeResponse.text();
        console.error("[CRON] Error summarizing tweets:", errorText);
        throw new Error(`Failed to summarize tweets: ${errorText}`);
      }
      
      const summarizeData = await summarizeResponse.json();
      results.summarize = summarizeData;
      console.log("[CRON] Summarize tweets result:", summarizeData);
    }
    
    // Step 3: Send newsletters
    if (sendNewsletters) {
      console.log("[CRON] Running send-newsletters step");
      const newsletterResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-newsletters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          test: isTest,
          email: targetEmail,
          forceResend: isTest  // Force resend in test mode
        })
      });
      
      if (!newsletterResponse.ok) {
        const errorText = await newsletterResponse.text();
        console.error("[CRON] Error sending newsletters:", errorText);
        throw new Error(`Failed to send newsletters: ${errorText}`);
      }
      
      const newsletterData = await newsletterResponse.json();
      results.newsletter = newsletterData;
      console.log("[CRON] Send newsletters result:", newsletterData);
    }
    
    console.log("[CRON] Completed all steps successfully");
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Newsletter tasks completed (${isTest ? 'test mode' : 'production mode'})`,
        results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
    
  } catch (error) {
    console.error("[CRON] Error in cron-scheduler function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
