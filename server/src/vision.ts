import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

/**
 * Reading a receipt photograph into structured fields.
 *
 * Every field comes back as a STRING, exactly as printed. Normalising them
 * (decimal separators, date order, currency) is the phone's job, in
 * mobile/src/lib/parse.ts, which is pure and unit-tested — asking the model to
 * also normalise would move that logic somewhere untestable and
 * non-deterministic.
 *
 * Two providers are supported, chosen by VISION_PROVIDER:
 *   claude (default) — Anthropic, best accuracy on small thermal print
 *   openai-compatible — any /v1/chat/completions endpoint: OpenRouter, Groq,
 *     Together, Fireworks, a local Ollama, or anything else speaking that
 *     shape. This is how you run an open-weights model.
 *
 * Both return the same `Receipt`, so nothing downstream changes.
 */
const ReceiptSchema = z.object({
  vendor: z.string().describe('The shop or company name as printed. Empty string if not legible.'),
  date: z.string().describe('The transaction date exactly as printed, e.g. "06/10/2026" or "5 Oct 2026". Empty string if not legible.'),
  subtotal: z.string().describe('Amount before tax, digits and separators exactly as printed. Empty string if not shown.'),
  tax: z.string().describe('Tax or VAT amount exactly as printed. Empty string if not shown.'),
  total: z.string().describe('The final amount paid, exactly as printed.'),
  currency: z.string().describe('ISO code if printed (NGN, USD), otherwise the symbol shown. Empty string if absent.'),
});

export type Receipt = z.infer<typeof ReceiptSchema>;
export type MediaType = 'image/jpeg' | 'image/png' | 'image/webp';

const SYSTEM = `You read photographs of paper receipts and return the printed fields.

Rules:
- Transcribe what is printed. Never calculate, convert, correct or infer a value.
- Copy digits and separators exactly as they appear. Do not reformat "1.234,56" or "12,900.00".
- Copy the date exactly as printed. Do not reorder day and month.
- If a field is missing, unreadable, or you are unsure, return an empty string for it.
  An empty string is always better than a guess — the person will be asked to fill it in.
- The total is the final amount actually paid, after any discount.`;

const USER_PROMPT = 'Read this receipt and return its printed fields.';

/** Shared shape check, so a sloppy provider cannot inject undefined fields. */
function coerce(raw: unknown): Receipt {
  const parsed = ReceiptSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  // Fill what is present, blank what is not. The review screen flags blanks.
  const o = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    vendor: str(o.vendor), date: str(o.date), subtotal: str(o.subtotal),
    tax: str(o.tax), total: str(o.total), currency: str(o.currency),
  };
}

// ---------------------------------------------------------------- Claude

let anthropic: Anthropic | null = null;

async function readWithClaude(imageBase64: string, mediaType: MediaType): Promise<Receipt> {
  anthropic ??= new Anthropic();
  const response = await anthropic.messages.parse({
    model: process.env.VISION_MODEL ?? 'claude-opus-5',
    max_tokens: 2000,
    system: SYSTEM,
    // Extraction is a simple task: low effort keeps latency inside the 10s
    // target and cost down. Thinking is left adaptive (the default) rather
    // than disabled, which on Opus 5 can leak tool text into the response.
    output_config: { effort: 'low', format: zodOutputFormat(ReceiptSchema) },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: USER_PROMPT },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') throw new Error('The model declined to read that image.');
  if (!response.parsed_output) throw new Error('The model did not return usable fields.');
  return response.parsed_output;
}

// ------------------------------------------------- OpenAI-compatible host

/**
 * Works with any endpoint speaking /v1/chat/completions. Examples:
 *   OpenRouter  VISION_BASE_URL=https://openrouter.ai/api/v1
 *               VISION_MODEL=qwen/qwen2.5-vl-72b-instruct
 *   Groq        VISION_BASE_URL=https://api.groq.com/openai/v1
 *   Ollama      VISION_BASE_URL=http://localhost:11434/v1  (no key needed)
 */
async function readWithOpenAICompatible(imageBase64: string, mediaType: MediaType): Promise<Receipt> {
  const baseUrl = process.env.VISION_BASE_URL;
  const model = process.env.VISION_MODEL;
  if (!baseUrl || !model) {
    throw new Error('VISION_BASE_URL and VISION_MODEL must be set for the openai-compatible provider.');
  }

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(process.env.VISION_API_KEY ? { authorization: `Bearer ${process.env.VISION_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      // Ask for JSON explicitly: open-weights models often ignore a schema
      // but do honour json_object plus a described shape in the prompt.
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${SYSTEM}\n\nReturn ONLY a JSON object with exactly these string keys: vendor, date, subtotal, tax, total, currency.` },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
            { type: 'text', text: USER_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Vision provider returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('Vision provider returned no content.');

  // Some models wrap JSON in ``` fences despite being told not to.
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return coerce(JSON.parse(cleaned));
  } catch {
    throw new Error('Vision provider did not return valid JSON.');
  }
}

export async function readReceipt(imageBase64: string, mediaType: MediaType): Promise<Receipt> {
  const provider = process.env.VISION_PROVIDER ?? 'claude';
  switch (provider) {
    case 'claude':
      return readWithClaude(imageBase64, mediaType);
    case 'openai-compatible':
      return readWithOpenAICompatible(imageBase64, mediaType);
    default:
      throw new Error(`Unknown VISION_PROVIDER "${provider}". Use "claude" or "openai-compatible".`);
  }
}
