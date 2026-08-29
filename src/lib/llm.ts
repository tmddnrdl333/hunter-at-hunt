import { PERK_VALUES, type Perk } from './types';

/** 503(혼잡)/429(한도) 시 순서대로 폴백 */
const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];

const apiUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

export interface EnrichInput {
  title: string;
  description: string;
}

export interface EnrichResult {
  summary: string;
  perks: Perk[];
}

const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      index: { type: 'INTEGER' },
      summary: { type: 'STRING' },
      perks: {
        type: 'ARRAY',
        items: { type: 'STRING', enum: [...PERK_VALUES] },
      },
    },
    required: ['index', 'summary', 'perks'],
  },
};

const PROMPT = `You are processing campus event listings for an NCSU student event tracker.
For EACH event below, produce:
- summary: ONE concise sentence (max 25 words) describing what the event is. Plain English, no marketing fluff.
- perks: tags for free things attendees actually RECEIVE at the event.
  * free_food: meals/snacks/pizza/ice cream provided free
  * drinks: coffee/boba/drinks provided free
  * tshirt: free t-shirts
  * swag: free merch/goodies/giveaway items (other than shirts)
  * prize: prizes/raffles you can win
  * free_stuff: other free items that fit no category above
IMPORTANT: only tag a perk if the text says it is PROVIDED/given to attendees.
An event merely ABOUT food/coffee/shirts (e.g. a lecture titled "The Boba Breakdown") gets NO perk.
Free admission alone is NOT a perk.
Return a JSON array with one object per event, keeping the given index.

Events:
`;

/**
 * 이벤트 배치를 Gemini로 정제. 키가 없거나 호출 실패 시 null 반환 → 호출부가 키워드 폴백.
 */
export async function enrichWithLlm(
  batch: EnrichInput[],
): Promise<EnrichResult[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const eventsText = batch
    .map(
      (e, i) =>
        `[${i}] ${e.title}\n${e.description.slice(0, 1500) || '(no description)'}`,
    )
    .join('\n\n');

  const text = await callWithRetry(apiKey, PROMPT + eventsText);
  if (!text) return null;

  try {

    const parsed = JSON.parse(text) as {
      index: number;
      summary: string;
      perks: string[];
    }[];
    const results: EnrichResult[] = batch.map(() => ({ summary: '', perks: [] }));
    for (const p of parsed) {
      if (p.index >= 0 && p.index < results.length) {
        results[p.index] = {
          summary: p.summary,
          perks: p.perks.filter((x): x is Perk =>
            (PERK_VALUES as readonly string[]).includes(x),
          ),
        };
      }
    }
    return results;
  } catch (err) {
    console.warn(`  [llm] 응답 파싱 실패: ${err}`);
    return null;
  }
}

/**
 * 모델 폴백 × 재시도. 503(혼잡)/429(rate limit)/타임아웃이면
 * 백오프 후 재시도하고, 그래도 안 되면 다음 모델로 넘어간다.
 */
async function callWithRetry(apiKey: string, prompt: string): Promise<string | null> {
  const RETRIES_PER_MODEL = 3;
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= RETRIES_PER_MODEL; attempt++) {
      try {
        const res = await fetch(apiUrl(model), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: RESPONSE_SCHEMA,
              temperature: 0.1,
              // 2.5 Flash는 기본 thinking이 켜져 있어 단순 추출에 과하게 느림 → 비활성화
              // (flash-lite는 thinkingConfig를 받지 않아 400이 나므로 flash에만 적용)
              ...(model.includes('lite')
                ? {}
                : { thinkingConfig: { thinkingBudget: 0 } }),
            },
          }),
          signal: AbortSignal.timeout(120_000),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return text;
          console.warn(`  [llm] ${model}: 빈 응답`);
          return null;
        }
        const bodyText = (await res.text()).slice(0, 150);
        if (res.status === 503 || res.status === 429) {
          console.warn(`  [llm] ${model} ${res.status} (시도 ${attempt}/${RETRIES_PER_MODEL})`);
          if (attempt < RETRIES_PER_MODEL) {
            await new Promise((r) => setTimeout(r, attempt * 5000));
            continue;
          }
          break; // 다음 모델로
        }
        console.warn(`  [llm] ${model} HTTP ${res.status}: ${bodyText}`);
        break; // 4xx 등은 재시도 무의미 → 다음 모델
      } catch (err) {
        console.warn(`  [llm] ${model} 네트워크/타임아웃 (시도 ${attempt}/${RETRIES_PER_MODEL}): ${(err as Error).name}`);
        if (attempt < RETRIES_PER_MODEL) {
          await new Promise((r) => setTimeout(r, attempt * 5000));
        }
      }
    }
  }
  return null;
}
