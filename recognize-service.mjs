// Photo questions: read the text in a photo (a question, a book page, notes) so the user can edit it and ask it.
// Only the text comes back; the image is not stored by the app. Free allowance: 智谱 GLM-4V-Flash (free vision model);
// own key: Qwen's OCR model through DashScope's OpenAI-compatible endpoint. DeepSeek has no vision model.
import { validConfig } from './providers.js';
import { ServiceError } from './model-service.mjs';
export const RECOGNIZE_LIMITS = Object.freeze({ image: 3_000_000, text: 8000 });
export const VISION_MODELS = Object.freeze({ 'zhipu-free': 'glm-4v-flash', 'qwen-cn': 'qwen-vl-ocr', 'qwen-intl': 'qwen-vl-ocr' });
const IMAGE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+=*)$/;
const NO_TEXT = 'NO_TEXT';
const prompt = locale => locale === 'zh'
  ? `只提取图片中的文字，按原有顺序和分行输出；公式用文字或常见符号表示。不要解答、不要翻译、不要补充说明。图片中没有可读文字时只回复：${NO_TEXT}`
  : `Extract only the text in the image, in its original order and lines; write formulas with plain symbols. Do not answer, translate or add comments. If there is no readable text, reply only: ${NO_TEXT}`;

export function validateRecognize(value) {
  if (!value || !validConfig(value.config)) throw new ServiceError('config');
  if (!Object.hasOwn(VISION_MODELS, value.config.provider)) throw new ServiceError('vision-unsupported');
  if (typeof value.apiKey !== 'string' || !/^[\x21-\x7e]{8,512}$/.test(value.apiKey)) throw new ServiceError('key');
  if (value.consent !== true) throw new ServiceError('consent');
  if (!['zh', 'en'].includes(value.locale) || typeof value.image !== 'string' || value.image.length > RECOGNIZE_LIMITS.image || !IMAGE.test(value.image)) throw new ServiceError('request');
  return value;
}
export function buildRecognize(value) {
  const { config, apiKey, image, locale } = value, headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
  // 智谱 takes the bare Base64 data; DashScope takes the data URL.
  const picture = config.provider === 'zhipu-free' ? IMAGE.exec(image)[2] : image;
  const messages = [{ role: 'user', content: [{ type: 'image_url', image_url: { url: picture } }, { type: 'text', text: prompt(locale) }] }];
  const url = config.provider === 'zhipu-free' ? 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
    : config.provider === 'qwen-intl' ? 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions' : 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
  return { url, headers, body: { model: VISION_MODELS[config.provider], messages, stream: false, max_tokens: 2048 } };
}
export function extractRecognized(data) {
  const choice = data?.choices?.[0], content = choice?.message?.content;
  if (['content_filter', 'sensitive'].includes(choice?.finish_reason)) throw new ServiceError('filtered', 422);
  if (typeof content !== 'string') throw new ServiceError('empty', 502);
  const text = content.replace(/^```[a-z]*\n?|\n?```$/g, '').trim();
  if (!text || text === NO_TEXT) throw new ServiceError('no-text', 422);
  return { text: text.slice(0, RECOGNIZE_LIMITS.text) };
}
export async function recognizeImage(input, { fetchImpl = fetch, signal } = {}) {
  const request = buildRecognize(validateRecognize(input));
  try {
    const response = await fetchImpl(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(request.body), redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000) });
    // Upstream error bodies are not relayed: they may echo credentials or content.
    if (!response.ok) { await response.body?.cancel(); throw new ServiceError(response.status === 401 ? 'unauthorized' : response.status === 429 ? 'rate' : response.status === 402 ? 'balance' : 'upstream', response.status === 401 ? 401 : response.status === 429 ? 429 : 502); }
    const data = await response.json().catch(() => { throw new ServiceError('upstream', 502); });
    return extractRecognized(data);
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    if (signal?.aborted) throw new ServiceError('cancelled', 499);
    if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new ServiceError('timeout', 504);
    throw new ServiceError('network', 502);
  }
}
