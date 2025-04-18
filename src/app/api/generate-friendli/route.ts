import { NextResponse } from 'next/server';

// --- Environment Variables ---
// These MUST be set in your deployment environment (e.g., Vercel dashboard)
// DO NOT hardcode the token here.
const FRIENDLI_API_TOKEN = process.env.FRIENDLI_API_TOKEN;
// Use the full endpoint URL from environment variable for flexibility
const FRIENDLI_API_ENDPOINT = process.env.FRIENDLI_API_ENDPOINT;

// Define the expected structure of the request body from the client component
interface ClientRequestBody {
    // model: string; // Not needed if endpoint ID is part of URL or fixed server-side
    prompt: string;
    negative_prompt?: string;
    num_inference_steps: number;
    guidance_scale: number;
    width: number;
    height: number;
    response_format: string;
    // Add other expected parameters (e.g., seed?)
}

// Define the structure expected by the Friendli.ai API
interface FriendliApiPayload {
    model: string; // Friendli requires model ID in the payload
    prompt: string;
    negative_prompt?: string;
    num_inference_steps: number;
    guidance_scale: number;
    width: number;
    height: number;
    response_format: string;
    // Add other Friendli parameters (e.g., seed?)
}


// POST handler for the API route
export async function POST(request: Request) {
    console.log("API Route /api/generate-friendli received request");

    // --- Security Checks ---
    if (!FRIENDLI_API_TOKEN) {
        console.error('SERVER ERROR: Friendli API token environment variable (FRIENDLI_API_TOKEN) is not configured.');
        return NextResponse.json({ error: 'Server configuration error: API token missing.' }, { status: 500 });
    }
    if (!FRIENDLI_API_ENDPOINT) {
         console.error('SERVER ERROR: Friendli API endpoint URL environment variable (FRIENDLI_API_ENDPOINT) is not configured.');
         return NextResponse.json({ error: 'Server configuration error: API endpoint missing.' }, { status: 500 });
     }
    // Extract the endpoint ID from the URL for the payload
    // This assumes the URL is like https://.../v1/images/generations and the ID is needed in payload
    const friendliModelId = process.env.FRIENDLI_ENDPOINT_ID; // You'll need this env var too!
     if (!friendliModelId) {
        console.error('SERVER ERROR: Friendli Endpoint ID environment variable (FRIENDLI_ENDPOINT_ID) is not configured.');
        return NextResponse.json({ error: 'Server configuration error: Endpoint ID missing.' }, { status: 500 });
    }


    try {
        // 1. Parse incoming request body from the client
        const clientPayload: ClientRequestBody = await request.json();

        // 2. Construct the payload required by the *actual* Friendli API
        const payloadForFriendli: FriendliApiPayload = {
            model: friendliModelId, // Get ID from env var
            prompt: clientPayload.prompt,
            negative_prompt: clientPayload.negative_prompt,
            num_inference_steps: clientPayload.num_inference_steps,
            guidance_scale: clientPayload.guidance_scale,
            width: clientPayload.width,
            height: clientPayload.height,
            response_format: clientPayload.response_format,
            // Add any other parameters required by Friendli API
        };

        // 3. Make the secure request to Friendli.ai from the server
        console.log("API Route: Calling Friendli.ai Endpoint:", FRIENDLI_API_ENDPOINT);
        // console.log("API Route: Payload for Friendli:", payloadForFriendli); // Avoid logging prompt in production if sensitive

        const friendliResponse = await fetch(FRIENDLI_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${FRIENDLI_API_TOKEN}`, // Securely use the token from environment
            },
            body: JSON.stringify(payloadForFriendli),
        });

        // 4. Handle the response from Friendli.ai
        if (!friendliResponse.ok) {
            // Attempt to parse error details from Friendli and forward them
            let errorDetails = `Friendli API responded with status ${friendliResponse.status}`;
            try {
                 const errorJson = await friendliResponse.json();
                 errorDetails = errorJson.detail || errorJson.error?.message || errorJson.error || JSON.stringify(errorJson);
            } catch(jsonError) {
                 try {
                     errorDetails = await friendliResponse.text();
                 } catch (textError) {
                     // Keep the original status text if reading body fails
                     errorDetails = friendliResponse.statusText;
                 }
            }
            console.error(`API Route: Friendli API Error (${friendliResponse.status}): ${errorDetails}`);
            // Return the specific error message from Friendli if available
            return NextResponse.json({ error: `Friendli API Error: ${errorDetails}` }, { status: friendliResponse.status });
        }

        // 5. Process and forward the successful response
        const contentType = friendliResponse.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
           const responseData = await friendliResponse.json();
            console.log("API Route: Forwarding successful JSON response from Friendli.");
            // Forward the successful JSON data (containing the image URL) back to the client
            return NextResponse.json(responseData, { status: 200 });
        } else {
            // Handle cases where the response might not be JSON (unexpected for this Friendli endpoint based on example)
            console.error("API Route: Received unexpected content type from Friendli:", contentType);
            const responseText = await friendliResponse.text(); // Read as text for debugging
            console.error("API Route: Non-JSON response text:", responseText)
            return NextResponse.json({ error: 'Received unexpected response format from Friendli API.' }, { status: 500 });
        }

    } catch (error: any) {
        // Catch internal errors in the API route itself (e.g., JSON parsing failure)
        console.error('API Route Internal Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error occurred in API route.' }, { status: 500 });
    }
}