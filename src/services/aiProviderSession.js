const providerConfigurations = new Map();

const copyConfiguration = configuration => configuration ? {
  apiKey: configuration.apiKey,
  model: configuration.model,
  models: [...configuration.models],
  verifiedAt: configuration.verifiedAt,
} : null;

export function getAIProviderConfiguration(provider) {
  return copyConfiguration(providerConfigurations.get(provider));
}

export function activateAIProvider(provider, configuration) {
  if (!['openai', 'anthropic'].includes(provider)) throw new Error('Only OpenAI and Anthropic use personal API keys.');
  const apiKey = String(configuration?.apiKey || '').trim();
  const models = Array.isArray(configuration?.models) ? configuration.models.filter(Boolean) : [];
  const model = String(configuration?.model || models[0]?.id || models[0] || '').trim();
  if (!apiKey || !model || models.length === 0) throw new Error('A verified key and model are required.');
  providerConfigurations.set(provider, { apiKey, model, models, verifiedAt: new Date().toISOString() });
  return getAIProviderConfiguration(provider);
}

export function selectAIProviderModel(provider, model) {
  const current = providerConfigurations.get(provider);
  if (!current || !current.models.some(item => (item.id || item) === model)) throw new Error('Test this provider before selecting a model.');
  providerConfigurations.set(provider, { ...current, model });
  return getAIProviderConfiguration(provider);
}

export function forgetAIProvider(provider) {
  providerConfigurations.delete(provider);
}

