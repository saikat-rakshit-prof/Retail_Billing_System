import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type {
  ChatCompletionTool,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions';
import { executeChatTool } from '@/lib/chat-tools';

// Today's date in Asia/Kolkata timezone, injected into every system prompt
function getKolkataToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
}

function buildSystemPrompt(): string {
  const today = getKolkataToday();
  return (
    `You are the AI assistant for Saikat Enterprise, a retail cold drink shop. ` +
    `Today's date is ${today} (Asia/Kolkata). ` +
    `When asked about shop data (sales, revenue, inventory, stock, customers, dues, bills, top products), you MUST call the appropriate tool. Never answer shop data from memory. ` +
    `Answer accurately based on tool results. ` +
    `For general greetings or chit-chat, reply politely and concisely. ` +
    `Always format currency in Indian Rupees (₹). Reply in the user's language (English/Hinglish/Bengali). ` +
    `You cannot modify data in the database.`
  );
}

const GROQ_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'getTodaySales',
      description:
        "Get today's total sales, number of bills, and payment-mode breakdown (in Asia/Kolkata timezone).",
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getSalesByDateRange',
      description:
        'Get sales, total revenue, discount, and payment mode breakdown for a date range. Omit both dates to get all-time totals.',
      parameters: {
        type: 'object',
        properties: {
          from: {
            type: 'string',
            description: 'Start date in YYYY-MM-DD format (Asia/Kolkata). Omit for all-time.',
          },
          to: {
            type: 'string',
            description: 'Optional end date in YYYY-MM-DD format.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getStockLevels',
      description:
        'Get current inventory stock levels per product size and SKU. If productName is omitted, returns all products (up to 30). Can search by brand or product name.',
      parameters: {
        type: 'object',
        properties: {
          productName: {
            type: 'string',
            description:
              'Optional product name, brand, or category to filter by. Leave empty to get all.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getLowStockItems',
      description:
        'Get all products and SKUs currently at or below their reorder threshold / low stock limit.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getCustomersWithDue',
      description:
        'Get all customers with pending/due balances, sorted from highest due amount to lowest.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getTopProducts',
      description:
        'Get top selling products ranked by revenue and quantity sold, optionally filtered by date range.',
      parameters: {
        type: 'object',
        properties: {
          from: {
            type: 'string',
            description: 'Optional start date in YYYY-MM-DD format',
          },
          to: {
            type: 'string',
            description: 'Optional end date in YYYY-MM-DD format',
          },
          limit: {
            type: 'integer',
            description: 'Number of top products to return (default is 5, max 20)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getCustomerDetails',
      description:
        'Get detailed info for a specific customer by name: phone, outstanding balance, credit limit, recent bills.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Customer name or partial name to search for.',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getRecentBills',
      description:
        'Get recent bills/invoices with invoice numbers, customer names, total amounts, and item summaries.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'integer',
            description: 'Number of recent bills to fetch (default is 5, max 20)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getBusinessSummary',
      description:
        'Get an all-time business overview: total revenue, bill count, customer count, product count, and total pending dues. Use this for general questions like "how is the business" or "give me a summary".',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

const GROQ_MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];

async function createGroqCompletion(
  groq: OpenAI,
  messages: ChatCompletionMessageParam[],
  includeTools: boolean = true
) {
  let lastError: unknown = null;
  for (const model of GROQ_MODELS) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages,
        ...(includeTools
          ? {
              tools: GROQ_TOOLS,
              tool_choice: 'auto' as const,
            }
          : {}),
      });
      return { completion, model };
    } catch (err) {
      lastError = err;
      console.warn(`[Groq fallback] Model ${model} failed, trying next model:`, err instanceof Error ? err.message : String(err));
    }
  }
  throw lastError;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validate GROQ_API_KEY
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_GROQ_API_KEY_HERE') {
      return NextResponse.json(
        {
          error:
            'GROQ_API_KEY is not configured in .env.local. Please provide your Groq API key.',
        },
        { status: 500 }
      );
    }

    // 2. Parse Request Body
    const body = await request.json();
    const { messages: incomingMessages } = body;

    if (!incomingMessages || !Array.isArray(incomingMessages) || incomingMessages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: messages array is required.' },
        { status: 400 }
      );
    }

    // 3. Initialize Groq client via OpenAI SDK
    const groq = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    // Build message history — system prompt includes today's date
    const conversationMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: buildSystemPrompt() },
    ];

    for (const msg of incomingMessages) {
      if (msg.role === 'user') {
        conversationMessages.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        conversationMessages.push({ role: 'assistant', content: msg.content });
      }
    }

    // Multi-turn tool calling loop (max 5 rounds)
    let finalReply = '';
    const MAX_ROUNDS = 5;
    let lastToolResultSummary = '';

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const { completion } = await createGroqCompletion(groq, conversationMessages, true);

      const choice = completion.choices[0];
      if (!choice || !choice.message) {
        break;
      }

      const assistantMessage = choice.message;
      conversationMessages.push(assistantMessage);

      // Check if the model decided to call tools
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.type !== 'function') continue;

          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown> = {};

          try {
            toolArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch {
            toolArgs = {};
          }

          let result: Record<string, unknown>;
          try {
            result = await executeChatTool(toolName, toolArgs);
          } catch (toolErr) {
            console.error(`Tool execution error for ${toolName}:`, toolErr);
            result = {
              error: `Tool failed: ${toolErr instanceof Error ? toolErr.message : String(toolErr)}`,
            };
          }

          console.log('TOOL', toolName, toolArgs, JSON.stringify(result).slice(0, 300));
          lastToolResultSummary = JSON.stringify(result).slice(0, 500);

          conversationMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
      } else {
        // Direct text answer received
        finalReply = assistantMessage.content || '';
        break;
      }
    }

    // If final reply is empty but we got a tool result, re-prompt to summarize
    if (!finalReply.trim() && lastToolResultSummary) {
      try {
        conversationMessages.push({
          role: 'user',
          content: `Please provide a clear, concise summary of the data above for the shop owner: ${lastToolResultSummary}`,
        });
        const { completion: summaryCompletion } = await createGroqCompletion(
          groq,
          conversationMessages,
          false
        );
        finalReply = summaryCompletion.choices[0]?.message?.content || '';
      } catch (err) {
        console.warn('Fallback summary failed:', err);
      }
    }

    // If still empty, return a fallback message
    if (!finalReply.trim()) {
      finalReply =
        'No data was returned for your request. Please check the date range or search terms and try again.';
    }

    // Return both content and reply keys for 100% frontend compatibility
    return NextResponse.json({
      content: finalReply,
      reply: finalReply,
    });
  } catch (error: unknown) {
    const errObj = error as { status?: number; code?: string; message?: string } | undefined;
    const rawErrorMessage =
      errObj?.message || (error instanceof Error ? error.message : String(error));

    console.error('CHAT ERROR:', {
      status: errObj?.status,
      code: errObj?.code,
      message: rawErrorMessage,
      error,
    });

    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json(
        { error: `DEV ERROR: ${rawErrorMessage}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error:
          'Sorry, I encountered an issue processing your request. Please try again.',
      },
      { status: 500 }
    );
  }
}
