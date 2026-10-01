/** Templates shipped in `templates/<name>`. The first one is the default. */
export const TEMPLATES = {
  'stream-monitor': 'Stream health monitor built on the WAVE ADK (default)',
  'mastra-agent': 'Mastra agent that calls WAVE through ADK tools',
  'livekit-agent': 'LiveKit voice agent with WAVE ADK tools',
  'webhook-handler': 'Server that verifies and handles WAVE webhook deliveries',
  'nextjs-supabase': 'Next.js app with the WAVE SDK and a Supabase client',
} as const;

export type TemplateName = keyof typeof TEMPLATES;

export const DEFAULT_TEMPLATE: TemplateName = 'stream-monitor';

export const isTemplate = (name: string): name is TemplateName => Object.hasOwn(TEMPLATES, name);
