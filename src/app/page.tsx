'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Download,
    Copy,
    Loader2,
    Sparkles,
    AlertCircle,
    Wand2,
    History,
    Check,
    Share2,
    Palette,
    Lightbulb,
    Server // Icon for dedicated deployment
    // Lock icon removed as warning is removed
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

// ==============================================================================
// Configuration
// ==============================================================================

// Model info for display purposes (Endpoint ID is used in API route via env var)
const DISPLAY_MODEL_INFO = {
    name: 'FLUX Model (Friendli.ai)',
    description: `Dedicated Friendli Endpoint`, // Simplified description
};

// Configuration for image resolutions
const RESOLUTIONS = [
    { value: '512x512', label: '512 × 512', description: 'Standard quality' },
    { value: '768x768', label: '768 × 768', description: 'Better quality' },
    { value: '1024x1024', label: '1024 × 1024', description: 'Best quality' }
];
const DEFAULT_RESOLUTION = '1024x1024';
const DEFAULT_STEPS = 30;
const DEFAULT_GUIDANCE_SCALE = 7.0; // Classifier-Free Guidance

// Example prompts for user inspiration
const EXAMPLE_PROMPTS = [
    "Astronaut riding a horse on the moon, detailed, high resolution",
    "A hyperrealistic oil painting of a mechanical owl perched on a stack of ancient books, steampunk style",
    "Surreal landscape with floating islands and waterfalls flowing upwards, vibrant colors, digital art",
    "Macro photograph of a dewdrop on a spider web, reflecting a tiny forest scene",
    "A cozy cabin in a snowy forest at night, warm light glowing from the windows, aurora borealis in the sky"
];

// Main Page Component Definition
export default function ImageGeneratorPage() {
    // --- State Variables ---
    const [prompt, setPrompt] = useState<string>('');
    const [negativePrompt, setNegativePrompt] = useState<string>('');
    const [resolution, setResolution] = useState<string>(DEFAULT_RESOLUTION);
    const [steps, setSteps] = useState<number[]>([DEFAULT_STEPS]);
    const [guidanceScale, setGuidanceScale] = useState<number[]>([DEFAULT_GUIDANCE_SCALE]);
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null); // Stores direct URL from API
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [lastGeneratedPrompt, setLastGeneratedPrompt] = useState<string | null>(null);
    const [currentBlobUrl, setCurrentBlobUrl] = useState<string | null>(null); // Used for temporary download URL
    const [generationHistory, setGenerationHistory] = useState<Array<{
        imageUrl: string,
        prompt: string,
        timestamp: Date
    }>>([]);
    const [showHistory, setShowHistory] = useState<boolean>(false);
    const [isCopied, setIsCopied] = useState<boolean>(false);
    const [stylePreset, setStylePreset] = useState<string>('none');
    const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

    // --- Refs ---
    const detailsRef = useRef<HTMLDivElement>(null); // For scrolling to error messages

    // --- Helper Functions ---
    const getResolutionDimensions = (resolutionString: string): { width: number, height: number } => {
        const [width, height] = resolutionString.split('x').map(Number);
        return { width, height };
    };

    // --- Effects ---
    // Cleanup temporary Blob URL used for downloads
    useEffect(() => {
        return () => {
            if (currentBlobUrl) {
                URL.revokeObjectURL(currentBlobUrl);
                console.log("Revoked temporary download Blob URL:", currentBlobUrl);
            }
        };
    }, [currentBlobUrl]);

    // Scroll to error message when it appears
    useEffect(() => {
        if (error && detailsRef.current) {
            detailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [error]);

    // --- Core Generation Logic (Calls Internal API Route) ---
    const handleGenerateClick = useCallback(async () => {
        // Check if a prompt is entered
        if (!prompt.trim()) {
            setError("Please enter a prompt to generate an image.");
            return;
        }

        // Set loading state and clear previous results/errors
        setIsLoading(true);
        setError(null);
        setGeneratedImageUrl(null);
        setLastGeneratedPrompt(null);
        // Revoke previous temporary download URL if exists
        if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl);
            setCurrentBlobUrl(null);
        }

        try {
            const generationTimestamp = new Date();

            // Define the internal API endpoint to call
            const internalApiEndpoint = "/api/generate-friendli";

            // Get width and height from the selected resolution string
            const { width, height } = getResolutionDimensions(resolution);

            // Prepare the payload to send to *your* backend API route
            const payloadForApiRoute = {
                // No 'model' needed here unless your API route uses it; Endpoint ID is handled server-side
                prompt: prompt,
                negative_prompt: negativePrompt || undefined, // Send only if not empty
                num_inference_steps: steps[0], // Get value from slider state array
                guidance_scale: guidanceScale[0], // Get value from slider state array
                width: width,
                height: height,
                response_format: "url", // Friendli API needs this
                // Add any other parameters required by your *backend* API route if necessary
            };

            console.log("Calling Internal API Route:", internalApiEndpoint, "Payload:", payloadForApiRoute);

            // Make the API request to your internal backend route
            const internalApiResponse = await fetch(internalApiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // No Authorization header needed for internal route
                },
                body: JSON.stringify(payloadForApiRoute),
            });

            // Always expect JSON response from our internal API route
            const responseData = await internalApiResponse.json();

            // Check if the internal API request was successful
            if (!internalApiResponse.ok) {
                // Error came from our API route (might have forwarded Friendli's error message)
                console.error("Internal API Route Error:", responseData);
                // Use the error message provided by the API route, or a default
                throw new Error(responseData.error || `API request failed: ${internalApiResponse.statusText}`);
            }

            // --- Process successful response forwarded from the internal API ---
            console.log("Internal API Success Response (forwarded):", responseData);
            // Extract the image URL from the structure Friendli returns (forwarded by our backend)
            const imageUrlFromApi = responseData?.data?.[0]?.url;

            if (!imageUrlFromApi) {
                console.error("Could not find image URL in response from internal API:", responseData);
                throw new Error("API response structure unexpected or missing image URL.");
            }

            // Update state with the direct URL from the API
            setGeneratedImageUrl(imageUrlFromApi);
            setLastGeneratedPrompt(prompt);

            // Add to generation history
            setGenerationHistory(previousHistory => [
                { imageUrl: imageUrlFromApi, prompt: prompt, timestamp: generationTimestamp },
                ...previousHistory.slice(0, 9)
            ]);

        } catch (errorObject: any) {
            // Catch any errors during the fetch or processing
            console.error("Image Generation process failed:", errorObject);
            setError(errorObject.message || "An unexpected error occurred during image generation.");
            setGeneratedImageUrl(null); // Clear image on error
        } finally {
            // Always turn off loading indicator
            setIsLoading(false);
        }
    // Dependencies for the useCallback hook
    }, [prompt, negativePrompt, resolution, steps, guidanceScale, currentBlobUrl]); // currentBlobUrl needed for cleanup logic

    // --- UI Event Handlers ---
    const handleCopyPrompt = useCallback(() => {
        if (!lastGeneratedPrompt) return;
        navigator.clipboard.writeText(lastGeneratedPrompt)
            .then(() => { setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); })
            .catch(clipboardError => { console.error('Failed to copy prompt: ', clipboardError); setError("Could not copy prompt."); });
    }, [lastGeneratedPrompt]);

    // Download handler fetches the image from the API URL and triggers download
    const handleDownloadImage = useCallback(async () => {
        if (!generatedImageUrl) return; // Need the URL to download from

        // Revoke previous temporary download URL if it exists
        if (currentBlobUrl) {
             URL.revokeObjectURL(currentBlobUrl);
             setCurrentBlobUrl(null);
        }

        setIsLoading(true); // Show loading state during fetch/download process
        setError(null);
        try {
            console.log("Fetching image for download from URL:", generatedImageUrl);
            // Fetch the actual image data using the URL provided by the API
            const imageFetchResponse = await fetch(generatedImageUrl);
            if (!imageFetchResponse.ok) {
                throw new Error(`Failed to fetch image (${imageFetchResponse.status} ${imageFetchResponse.statusText})`);
            }
            const imageBlob = await imageFetchResponse.blob(); // Get the image data as a Blob

            // Create a temporary blob URL *specifically for the download link*
            const blobUrlForDownload = URL.createObjectURL(imageBlob);
            setCurrentBlobUrl(blobUrlForDownload); // Store this temporary URL for potential cleanup via useEffect

            // Create a temporary anchor element to trigger the download
            const linkElement = document.createElement('a');
            linkElement.href = blobUrlForDownload;

            // Generate a filename
            const safePromptPart = lastGeneratedPrompt?.substring(0, 50).replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'generated';
            // Determine file extension from the fetched blob's type
            const fileExtension = imageBlob.type.split('/')[1] || 'png';
            linkElement.download = `${safePromptPart}_${Date.now()}.${fileExtension}`;

            // Trigger the download
            document.body.appendChild(linkElement);
            linkElement.click();
            document.body.removeChild(linkElement);

            // Temporary blob URL will be revoked later by the useEffect cleanup

        } catch (downloadError: any) {
            console.error("Image download failed:", downloadError);
            setError(`Download failed: ${downloadError.message}`);
        } finally {
             setIsLoading(false); // Hide loading indicator
        }
    }, [generatedImageUrl, lastGeneratedPrompt, currentBlobUrl]); // Include dependencies

    // Applies an example prompt to the main input
    const applyExamplePrompt = (examplePromptText: string) => {
        setPrompt(examplePromptText);
        setShowSuggestions(false);
        setError(null);
    };

    // Applies style keywords based on preset selection
    const applyStylePreset = (preset: string) => {
        let stylePromptSuffix = "";
        let styleNegativePrefix = "";
         switch(preset) {
             case 'photo': stylePromptSuffix = ", high resolution photograph, photorealistic, detailed, sharp focus, 8k"; styleNegativePrefix = "drawing, painting, illustration, sketch, cartoon, anime, manga, render, CGI, 3d, watermark, text, signature"; break;
             case 'anime': stylePromptSuffix = ", anime style, key visual, detailed anime illustration, masterpiece"; styleNegativePrefix = "photorealistic, photograph, real life, 3d render, text, signature"; break;
             case 'painting': stylePromptSuffix = ", detailed oil painting, artistic brush strokes, impressionist style, canvas texture"; styleNegativePrefix = "photograph, photo, realistic, 3d render, CGI, text, signature, watermark"; break;
             case 'pixel': stylePromptSuffix = ", pixel art style, 16-bit videogame sprite, detailed pixel art, limited palette"; styleNegativePrefix = "high resolution, detailed photograph, realistic, smooth, photo, 3d render"; break;
             case 'scifi': stylePromptSuffix = ", science fiction art, futuristic technology, cyberpunk city, highly detailed, cinematic lighting"; styleNegativePrefix = "fantasy, historical, medieval, drawing, sketch, simple"; break;
             case 'cartoon': stylePromptSuffix = ", cartoon style, vibrant colors, bold outlines, simplified shapes, playful illustration"; styleNegativePrefix = "photorealistic, realistic, photograph, detailed texture, complex background, 3d render"; break;
             case 'watercolor': stylePromptSuffix = ", watercolor painting, soft edges, blended colors, wet-on-wet technique, paper texture"; styleNegativePrefix = "photorealistic, photograph, sharp focus, 3d render, CGI, solid outlines"; break;
             case 'concept': stylePromptSuffix = ", concept art, rough sketches, character design sheet, environmental design, atmospheric lighting, digital painting"; styleNegativePrefix = "photorealistic, photograph, finished artwork, 3d model render"; break;
             case 'comic': stylePromptSuffix = ", comic book style, graphic novel art, bold ink outlines, dynamic composition, halftone dots, panel layout"; styleNegativePrefix = "photorealistic, photograph, painting, 3d render, realistic texture"; break;
             case 'none': default: stylePromptSuffix = ""; styleNegativePrefix = "";
         }
        if (preset !== 'none') {
            setPrompt(currentPrompt => {
                const cleanedPrompt = currentPrompt.trim().replace(/,\s*$/, '');
                return cleanedPrompt.includes(stylePromptSuffix) ? cleanedPrompt : cleanedPrompt + stylePromptSuffix;
            });
            setNegativePrompt(currentNegative => {
                 if (currentNegative.trim() === '') return styleNegativePrefix;
                 if (currentNegative.startsWith(styleNegativePrefix) && styleNegativePrefix) return currentNegative;
                 return styleNegativePrefix + (styleNegativePrefix && currentNegative ? ", " : "") + currentNegative;
             });
        }
        setStylePreset(preset);
        setError(null);
    };

    // Loads image and prompt from history
    const loadFromHistory = (historyItem: {imageUrl: string, prompt: string}) => {
        setPrompt(historyItem.prompt);
        setGeneratedImageUrl(historyItem.imageUrl); // Set the direct URL
        setLastGeneratedPrompt(historyItem.prompt);
        setError(null);
        setShowHistory(false);
    };

    // --- Render Component JSX ---
    return (
        <TooltipProvider>
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="container mx-auto min-h-screen p-4 sm:p-6 md:p-8 flex flex-col font-sans" // Ensure font-sans is applied
                >
                    {/* Page Header */}
                    <header className="mb-8 md:mb-10 text-center">
                         <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, type: "spring", stiffness: 100 }}>
                             <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2 flex items-center justify-center gap-2">
                                 <Wand2 className="h-8 w-8 text-primary" />
                                 AI Image Generator
                             </h1>
                             <p className="text-base sm:text-lg text-muted-foreground">
                                 Using dedicated FLUX deployment on Friendli.ai
                             </p>
                             {/* UI Security Warning Removed */}
                         </motion.div>
                     </header>

                    {/* Main Content Area (Two Columns) */}
                    <div className="flex flex-col lg:flex-row gap-8 flex-grow">

                        {/* --- Left Column: Controls --- */}
                        <div className="w-full lg:w-2/5 flex flex-col gap-6">
                            {/* Card 1: Prompt Input */}
                            <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.4, delay: 0 }}>
                                <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 flex-shrink-0 border-t-4 border-primary/50">
                                    <CardHeader className="bg-gradient-to-r from-background to-muted/30"><CardTitle className="text-xl font-semibold flex items-center"><span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2 font-bold">1</span>Describe Your Image</CardTitle></CardHeader>
                                    <CardContent className="pt-6">
                                        <div className="space-y-4">
                                            {/* Prompt Textarea Section */}
                                            <div>
                                                <div className="flex justify-between items-center mb-2"><Label htmlFor="prompt" className="font-medium text-sm">Your Prompt</Label><Button variant="ghost" size="sm" onClick={() => setShowSuggestions(!showSuggestions)} className="h-7 text-xs flex gap-1 items-center hover:bg-primary/10 text-primary" aria-expanded={showSuggestions}><Lightbulb className="h-3.5 w-3.5" />{showSuggestions ? 'Hide Ideas' : 'Get Ideas'}</Button></div>
                                                <Textarea id="prompt" placeholder="Example: Astronaut riding a horse..." value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} className="text-sm sm:text-base resize-y min-h-[90px] focus:ring-2 focus:ring-primary/30 transition-all shadow-inner" aria-required="true" aria-describedby="prompt-description"/>
                                                <p id="prompt-description" className="text-xs text-muted-foreground mt-1.5">Be descriptive! Include style, mood, details for the FLUX model.</p>
                                            </div>
                                            {/* Prompt Suggestions Panel */}
                                            <AnimatePresence>{showSuggestions && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="p-3 bg-muted/50 rounded-md border border-primary/10"><h4 className="text-sm font-medium mb-2 flex items-center gap-1 text-primary"><Lightbulb className="h-4 w-4" />Example Prompts</h4><div className="flex flex-wrap gap-2">{EXAMPLE_PROMPTS.map((examplePromptText, index) => (<Button key={index} variant="outline" size="sm" onClick={() => applyExamplePrompt(examplePromptText)} className="text-xs py-1 h-auto whitespace-normal text-left leading-snug border-dashed hover:border-primary hover:bg-primary/5">{examplePromptText.length > 50 ? `${examplePromptText.substring(0, 50)}...` : examplePromptText}</Button>))}</div><Button variant="ghost" size="sm" onClick={() => setShowSuggestions(false)} className="w-full mt-2 text-xs h-6 text-muted-foreground hover:text-primary">Close</Button></div></motion.div>)}</AnimatePresence>
                                            {/* Style Presets Section */}
                                            <div>
                                                <Label className="font-medium text-sm block mb-2">Quick Style Presets</Label>
                                                <div className="flex flex-wrap gap-2">
                                                    {/* Updated list of styles */}
                                                    {['none', 'photo', 'anime', 'painting', 'pixel', 'scifi', 'cartoon', 'watercolor', 'concept', 'comic'].map((styleName) => (
                                                        <Tooltip key={styleName}>
                                                            <TooltipTrigger asChild>
                                                                <Button variant={stylePreset === styleName ? "default" : "outline"} size="sm" onClick={() => applyStylePreset(styleName)} className="text-xs capitalize h-8 px-2.5">
                                                                    {styleName === 'none' ? 'No Style' : styleName}
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="bottom"><p className="text-xs">Apply '{styleName}' style keywords</p></TooltipContent>
                                                        </Tooltip>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>

                            {/* Card 2: Configuration Options */}
                             <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.4, delay: 0.1 }}>
                                 <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 flex-shrink-0 border-t-4 border-secondary/50">
                                     <CardHeader className="bg-gradient-to-r from-background to-muted/30">
                                         <CardTitle className="text-xl font-semibold flex items-center"><span className="bg-secondary text-secondary-foreground w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2 font-bold">2</span>Configure Options</CardTitle>
                                         <CardDescription className="text-sm">Set resolution and advanced generation parameters</CardDescription>
                                     </CardHeader>
                                     <CardContent className="space-y-5 pt-6">
                                         {/* Model Display (Static) */}
                                         <div className="space-y-2.5">
                                             <Label className="font-medium text-sm">Generation Model</Label>
                                             <div className="flex items-center justify-between w-full p-3 border rounded-md bg-muted/30">
                                                 <div className='text-sm'>
                                                     <div className="font-semibold">{DISPLAY_MODEL_INFO.name}</div>
                                                     <div className="text-xs text-muted-foreground">{DISPLAY_MODEL_INFO.description}</div>
                                                 </div>
                                                 <Server className="h-5 w-5 text-muted-foreground" />
                                             </div>
                                         </div>
                                         {/* Resolution Selection Dropdown */}
                                         <div className="space-y-2.5">
                                             <Label htmlFor="resolution" className="font-medium text-sm">Image Resolution</Label>
                                             <Select value={resolution} onValueChange={setResolution}>
                                                 <SelectTrigger id="resolution" className="text-sm sm:text-base"><SelectValue placeholder="Select resolution" /></SelectTrigger>
                                                 <SelectContent>{RESOLUTIONS.map((resolutionOption) => (<SelectItem key={resolutionOption.value} value={resolutionOption.value} className="text-sm sm:text-base"><div><div className="font-medium">{resolutionOption.label}</div><div className="text-xs text-muted-foreground">{resolutionOption.description}</div></div></SelectItem>))}</SelectContent>
                                             </Select>
                                         </div>
                                         {/* Negative Prompt Textarea */}
                                         <div className="space-y-2.5">
                                             <Label htmlFor="negative-prompt" className="font-medium text-sm">Negative Prompt (Optional)</Label>
                                             <Textarea id="negative-prompt" placeholder="Things to avoid: text, watermark, blurry..." value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} rows={3} className="text-sm sm:text-base resize-y min-h-[60px] focus:ring-2 focus:ring-secondary/30 transition-all shadow-inner" aria-describedby="negative-prompt-description"/>
                                             <p id="negative-prompt-description" className="text-xs text-muted-foreground">Helps exclude unwanted elements.</p>
                                         </div>
                                         {/* Advanced Parameters Accordion */}
                                         <Accordion type="single" collapsible className="w-full -mx-6 -mb-6 border-t border-border/50">
                                             <AccordionItem value="advanced-settings" className="border-b-0">
                                                 <AccordionTrigger className="text-sm sm:text-base font-medium px-6 py-3 hover:bg-muted/50 transition-colors data-[state=open]:bg-muted/40 [&[data-state=open]>svg]:rotate-180">Advanced Parameters</AccordionTrigger>
                                                 <AccordionContent className="px-6 pb-6 pt-2 space-y-5 bg-muted/30 border-t border-border/50">
                                                     {/* Steps Slider Section */}
                                                     <div className="space-y-2.5"><div className="flex justify-between items-center"><Label htmlFor="steps" className="font-medium text-sm">Quality Steps</Label><Badge variant="outline" className="text-xs font-medium">{steps[0]}</Badge></div><Slider id="steps" min={10} max={50} step={1} value={steps} onValueChange={setSteps} aria-label="Image quality inference steps" className="py-2"/><p className="text-xs text-muted-foreground">More steps usually improve detail but increase generation time (20-40 often good).</p></div>
                                                     {/* Guidance Scale (CFG) Slider Section */}
                                                     <div className="space-y-2.5"><div className="flex justify-between items-center"><Label htmlFor="guidance" className="font-medium text-sm">Prompt Guidance (CFG)</Label><Badge variant="outline" className="text-xs font-medium">{guidanceScale[0]}</Badge></div><Slider id="guidance" min={1} max={15} step={0.5} value={guidanceScale} onValueChange={setGuidanceScale} aria-label="Guidance scale (Classifier-Free Guidance)" className="py-2"/><p className="text-xs text-muted-foreground">Controls how strongly the image adheres to the prompt (5-10 typical).</p></div>
                                                 </AccordionContent>
                                             </AccordionItem>
                                         </Accordion>
                                     </CardContent>
                                 </Card>
                             </motion.div>

                            {/* Generate Button Section */}
                             <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }}>
                                <Button
                                    size="lg"
                                    onClick={handleGenerateClick}
                                    disabled={isLoading || !prompt.trim()} // Token check is now handled internally/by deployment
                                    className="w-full mt-1 text-base sm:text-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 group h-14 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
                                    aria-live="polite"
                                    aria-busy={isLoading}
                                >
                                    {isLoading ? (
                                        <> <Loader2 className="h-5 w-5 animate-spin" /> Generating Image... </>
                                    ) : (
                                        <> <Sparkles className="h-5 w-5 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12" /> Generate Image </>
                                    )}
                                </Button>
                                {/* Token missing warning removed from UI */}
                            </motion.div>

                            {/* Error Display Section */}
                            {error && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} ref={detailsRef} role="alert">
                                    <Card className="border-destructive bg-destructive/10 shadow-none mt-1">
                                        <CardContent className="p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
                                            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive flex-shrink-0 mt-0.5" />
                                            <p className="text-xs sm:text-sm text-destructive font-medium flex-1 break-words">{error}</p>
                                            <Button variant="ghost" size="icon" onClick={() => setError(null)} className="ml-auto text-destructive hover:bg-destructive/20 h-7 w-7 flex-shrink-0" aria-label="Dismiss error">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            )}
                        </div> {/* End Left Column */}

                        {/* --- Right Column: Result Display --- */}
                         <div className="w-full lg:w-3/5 flex flex-col sticky top-6 self-start" >
                             <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.4, delay: 0.2 }} className="h-full">
                                 <Card className="flex-grow flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden min-h-[400px] sm:min-h-[500px] lg:min-h-[600px] border-t-4 border-primary/30">
                                     {/* Card Header for Result Area */}
                                     <CardHeader className="border-b py-3 px-4 sm:py-4 sm:px-6 bg-gradient-to-r from-background to-muted/30 flex flex-row items-center justify-between space-y-0 flex-shrink-0">
                                         <CardTitle className="text-lg sm:text-xl font-semibold flex items-center"><span className="bg-primary/90 text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2 font-bold">3</span>Result</CardTitle>
                                         <div className="flex items-center gap-2"><Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)} disabled={generationHistory.length === 0} className="h-8 flex items-center gap-1 text-xs disabled:opacity-50" aria-controls="history-panel" aria-expanded={showHistory}><History className="h-3.5 w-3.5" />History ({generationHistory.length})</Button></TooltipTrigger><TooltipContent><p>View recent generations ({generationHistory.length} items)</p></TooltipContent></Tooltip></div>
                                     </CardHeader>

                                     {/* History Panel (Animated) */}
                                     <AnimatePresence>
                                         {showHistory && generationHistory.length > 0 && (
                                             <motion.div id="history-panel" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b flex-shrink-0" transition={{ duration: 0.3 }}>
                                                 <div className="p-3 bg-muted/30">
                                                     <h4 className="text-sm font-medium mb-2 px-1">Recent Generations</h4>
                                                     <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                                                         {generationHistory.map((historyItem, historyIndex) => (
                                                             <Tooltip key={historyIndex}>
                                                                 <TooltipTrigger asChild>
                                                                     <div className="aspect-square rounded-md overflow-hidden border-2 border-transparent hover:border-primary transition-all duration-200 cursor-pointer relative group bg-muted/50" onClick={() => loadFromHistory(historyItem)} tabIndex={0} onKeyPress={(keyboardEvent) => keyboardEvent.key === 'Enter' && loadFromHistory(historyItem)} aria-label={`Load history item ${historyIndex + 1}`}>
                                                                         <img src={historyItem.imageUrl} alt={`History item ${historyIndex + 1}: ${historyItem.prompt.substring(0, 30)}...`} className="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy"/>
                                                                         <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-1"></div>
                                                                     </div>
                                                                 </TooltipTrigger>
                                                                 <TooltipContent side="bottom" className="max-w-[200px]"><p className="text-xs line-clamp-3">{historyItem.prompt}</p><p className="text-xs text-muted-foreground mt-1">{historyItem.timestamp.toLocaleString()}</p></TooltipContent>
                                                             </Tooltip>
                                                         ))}
                                                     </div>
                                                     <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)} className="w-full mt-2 text-xs h-7 text-muted-foreground hover:text-primary">Close History</Button>
                                                 </div>
                                             </motion.div>
                                         )}
                                     </AnimatePresence>

                                     {/* Image Display Area */}
                                     <CardContent className="flex-grow p-2 sm:p-4 flex items-center justify-center bg-gradient-to-br from-muted/10 via-background to-muted/20 relative">
                                         <div className="relative w-full h-full max-w-full max-h-full aspect-square bg-muted/40 rounded-md overflow-hidden flex items-center justify-center text-muted-foreground shadow-inner">
                                             {/* Loading Indicator Overlay */}
                                             {isLoading && ( <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm z-10 transition-opacity duration-300 p-4 text-center"><div className="relative mb-3 sm:mb-4"><Loader2 className="h-10 w-10 sm:h-12 sm:w-12 animate-spin text-primary" /><motion.div className="absolute inset-0" animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.9, 0.6] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}><Sparkles className="h-10 w-10 sm:h-12 sm:w-12 text-primary/40 opacity-80" /></motion.div></div><p className="text-sm sm:text-base font-medium text-foreground">Generating with Friendli.ai...</p><p className="text-xs text-muted-foreground mt-1">This might take a moment</p></motion.div>)}
                                             {/* Placeholder Text/Icon */}
                                             {!generatedImageUrl && !isLoading && (<div className="text-center p-6 sm:p-8 max-w-xs mx-auto"><motion.div animate={{ y: [0, -6, 0], opacity: [0.6, 0.9, 0.6] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }} className="mx-auto mb-4 sm:mb-5"><Palette className="h-16 w-16 sm:h-20 sm:w-20 text-primary/60 opacity-70" /></motion.div><p className="text-sm sm:text-base font-medium mb-2 text-foreground/90">Your AI artwork will appear here</p><p className="text-xs text-muted-foreground">Describe your vision, choose settings, and generate.</p></div>)}
                                             {/* The Generated Image */}
                                             {generatedImageUrl && (<motion.img key={generatedImageUrl} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: "easeOut" }} src={generatedImageUrl} alt={lastGeneratedPrompt ? `AI Generated: ${lastGeneratedPrompt.substring(0, 100)}...` : "Generated AI Image"} className="object-contain w-full h-full transition-opacity duration-500"/>)}
                                         </div>
                                     </CardContent>

                                     {/* Action Footer */}
                                     {generatedImageUrl && !isLoading && (
                                         <CardFooter className="flex flex-col sm:flex-row justify-between items-center flex-wrap gap-4 p-4 sm:p-5 border-t bg-muted/30 flex-shrink-0">
                                             <div className="flex-1 min-w-[150px] w-full sm:w-auto"><h4 className="text-xs font-medium mb-0.5 text-muted-foreground">Generated from prompt:</h4><Tooltip><TooltipTrigger asChild><p className="text-xs text-foreground line-clamp-2 cursor-help">{lastGeneratedPrompt || "Not available"}</p></TooltipTrigger><TooltipContent side="top" className="max-w-[300px]"><p className="text-xs">{lastGeneratedPrompt}</p></TooltipContent></Tooltip></div>
                                             <div className="flex gap-2 flex-wrap justify-end w-full sm:w-auto">
                                                 <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={handleCopyPrompt} disabled={!lastGeneratedPrompt} className="h-9 relative px-2.5" aria-label="Copy Prompt">{isCopied ? (<Check className="h-4 w-4 text-green-500" />) : (<Copy className="h-4 w-4" />)}<span className="ml-1.5 text-xs hidden sm:inline">Copy</span></Button></TooltipTrigger><TooltipContent><p>Copy prompt</p></TooltipContent></Tooltip>
                                                 <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={handleDownloadImage} disabled={!generatedImageUrl || isLoading} className="h-9 px-2.5" aria-label="Download Image">{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}<span className="ml-1.5 text-xs hidden sm:inline">Download</span></Button></TooltipTrigger><TooltipContent><p>Download image</p></TooltipContent></Tooltip>
                                                 <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" className="h-9 px-2.5" aria-label="Share Image (Feature coming soon)" disabled><Share2 className="h-4 w-4" /><span className="ml-1.5 text-xs hidden sm:inline">Share</span></Button></TooltipTrigger><TooltipContent><p>Share (coming soon)</p></TooltipContent></Tooltip>
                                             </div>
                                         </CardFooter>
                                     )}
                                 </Card>
                             </motion.div>
                         </div> {/* End Right Column */}

                    </div> {/* End Main Flex Container */}

                    {/* Page Footer */}
                     <motion.footer initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.4 }} className="mt-10 sm:mt-12 pt-6 border-t text-center text-xs sm:text-sm text-muted-foreground">
                        <p>Powered by dedicated FLUX deployment via Friendli.ai.</p>
                        {/* Warnings Removed */}
                        <p className="mt-2 text-xs">UI Built with Next.js, Tailwind CSS, shadcn/ui, Framer Motion.</p>
                     </motion.footer>
                </motion.div>
            </AnimatePresence>
        </TooltipProvider>
    );
}