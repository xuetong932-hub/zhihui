// Credential-free registry. Only the server constructs upstream endpoints.
// free: 知回's free allowance; the server supplies the key, so the user enters none (offered only when configured).
export const providers = Object.freeze({
  'zhipu-free': { name: '知回免费额度 · 智谱 GLM-4-Flash', model: 'glm-4-flash-250414', search: false, free: true, docs: 'https://docs.bigmodel.cn/cn/guide/models/free/glm-4-flash-250414' },
  'qwen-cn': { name: '千问 · 中国 / Qwen China', model: 'qwen-plus', search: true, region: 'cn-beijing', workspaceRequired: false, docs: 'https://help.aliyun.com/zh/model-studio/get-api-key' },
  'qwen-intl': { name: 'Qwen · Singapore', model: 'qwen-plus', search: true, region: 'ap-southeast-1', workspaceRequired: true, docs: 'https://help.aliyun.com/en/model-studio/get-api-key' },
  deepseek: { name: 'DeepSeek', model: 'deepseek-flash', search: false, docs: 'https://api-docs.deepseek.com/' },
});
export function defaultConfig() {
  return { version: 1, provider: 'qwen-cn', model: providers['qwen-cn'].model, workspace: '', search: true };
}
export function validConfig(config) {
  const provider = typeof config?.provider === 'string' && Object.hasOwn(providers, config.provider) ? providers[config.provider] : null;
  return Boolean(provider && config.version === 1
    && typeof config.model === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,99}$/.test(config.model)
    && typeof config.workspace === 'string' && /^(?:[a-zA-Z0-9][a-zA-Z0-9-]{0,62})?$/.test(config.workspace)
    && (!provider.workspaceRequired || config.workspace)
    && typeof config.search === 'boolean' && (!config.search || provider.search));
}
export function safeSourceUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
