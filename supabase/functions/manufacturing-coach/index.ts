import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, projectId, currentSection } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Initialize Supabase client with user's JWT for RLS enforcement
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Extract user JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch project context if projectId is provided
    let contextInfo = '';
    if (projectId) {
      const { data: concept } = await supabase
        .from('concepts')
        .select('*')
        .eq('id', projectId)
        .single();

      const { data: ingredients } = await supabase
        .from('ingredients')
        .select('*')
        .eq('user_id', concept?.user_id);

      const { data: formulas } = await supabase
        .from('formulas')
        .select('*')
        .eq('concept_id', projectId);

      const { data: shelfLife } = await supabase
        .from('shelf_life')
        .select('*')
        .eq('concept_id', projectId);

      const { data: costing } = await supabase
        .from('costing')
        .select('*')
        .eq('concept_id', projectId);

      const { data: packaging } = await supabase
        .from('packaging')
        .select('*')
        .eq('concept_id', projectId);

      contextInfo = `
Current Project Context:
- Product Name: ${concept?.product_name || 'Not specified'}
- Product Type: ${concept?.product_type || 'Not specified'}
- Target Market: ${concept?.target_market || 'Not specified'}
- Core Problem Solved: ${concept?.core_problem_solved || 'Not specified'}
- Current Section: ${currentSection || 'General'}
- Number of Ingredients: ${ingredients?.length || 0}
- Number of Formula Entries: ${formulas?.length || 0}
- Shelf Life Data: ${shelfLife?.length ? 'Available' : 'Not yet added'}
- Costing Data: ${costing?.length ? 'Available' : 'Not yet added'}
- Packaging Data: ${packaging?.length ? 'Available' : 'Not yet added'}
`;
    }

    // Section-specific guidance
    const sectionGuidance: Record<string, string> = {
      'Concept': `You're in the Product Concept section. Focus on:
- Product positioning and target market definition
- Unique value proposition and differentiation
- Core problem the product solves for consumers
- Desired claims and regulatory implications
Guide users to be specific and manufacturer-focused in their concept documentation.`,
      
      'Ingredients': `You're in the Ingredients & Specs section. Focus on:
- Simple vs. combined ingredients (manufacturers need to know processing steps)
- Allergen declarations and cross-contamination risks
- Supplier specifications and sourcing requirements
- Cost per unit and MOQ considerations
Help users create clear ingredient specifications that manufacturers can work with.`,
      
      'Formulation': `You're in the Formulation section. Focus on:
- Baker's percentages and scaling calculations
- Yield management and batch sizing
- Process steps and critical control points
- Temperature, timing, and mixing specifications
Guide users to document formulas in a way that can be replicated at scale.`,
      
      'Shelf-Life': `You're in the Shelf-Life & Process Factors section. Focus on:
- Water activity (Aw) testing and control (critical for mold prevention)
- pH levels and their impact on shelf stability
- Moisture content and preservation strategies
- Barrier packaging requirements
- Functional ingredients that extend shelf life
Help users understand the science behind shelf-life and how to test/document it.`,
      
      'Costing': `You're in the Costing & MOQ section. Focus on:
- Ingredient + packaging costs (target <40% of retail price)
- Labor and overhead allocation
- MOQ impacts on unit economics
- Margin calculations and price positioning
- Break-even analysis for manufacturing runs
Guide users to build realistic cost models that work for both them and manufacturers.`,
      
      'Packaging': `You're in the Packaging section. Focus on:
- Material selection (barrier properties, sustainability)
- Labeling compliance (FDA, allergens, nutrition facts)
- Dimensions and structural requirements
- Cost per unit and MOQ from packaging suppliers
Help users choose packaging that protects the product and meets regulatory requirements.`,
      
      'Readiness': `You're in the Market Readiness section. Focus on:
- Documentation completeness checklist
- Manufacturing preparedness assessment
- Compliance and regulatory requirements
- Scalability and production readiness
Guide users through final verification that they're ready to approach manufacturers.`
    };

    const currentSectionGuidance = sectionGuidance[currentSection || 'Concept'] || sectionGuidance['Concept'];

    const systemPrompt = `You are the AI Manufacturing Coach inside the Kitchen-to-Factory Coach app.
Guide food entrepreneurs as they turn kitchen recipes into professionally documented, factory-ready products.
Your responses must adapt to the current section and be section-specific.
Be warm, factual, and practical — never generic or motivational. Cite reasoning for every recommendation.

${contextInfo}

${currentSectionGuidance}

Core Knowledge Base:
- Product Specification Sheets (PSS): Critical for communicating product requirements to manufacturers
- Batch Sheets: Detailed production instructions with weights, temperatures, and timing
- Ingredient Specifications: Simple vs. combined ingredients, processing requirements
- Shelf Life Factors: Water activity (Aw), pH levels, moisture content, preservation strategies
- Packaging: Barrier types, labeling compliance, material selection
- Costing: Ingredient costs, labor, overhead, MOQ considerations (target <40% of retail price)
- Market Readiness: Documentation, compliance, scalability assessment

Communication Style:
- Professional, supportive, and instructional
- Like a manufacturing mentor with practical industry experience
- Provide specific, actionable guidance based on the current section
- Keep responses concise and focused (2-4 paragraphs max)

Safety Guardrails:
- Do NOT provide specific pricing recommendations or legal advice
- Do NOT make health claims or medical advice
- Do NOT discuss topics outside of food product manufacturing and scaling
- Focus on documentation, specifications, and manufacturing readiness

If asked about non-manufacturing topics, politely redirect: "I'm here to help with manufacturing readiness and product specifications. Let's focus on getting your product ready for production!"`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_completion_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Coach response generated successfully');

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in manufacturing-coach function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
