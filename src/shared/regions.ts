export const SUPPORTED_REGIONS = [
  { id: 'eu', label: 'Europe' },
  { id: 'us-east', label: 'US East' },
  { id: 'us-central', label: 'US Central' },
] as const

export type SupportedRegionId = typeof SUPPORTED_REGIONS[number]['id']

export const isSupportedRegionId = (value: unknown): value is SupportedRegionId =>
  typeof value === 'string' && SUPPORTED_REGIONS.some(region => region.id === value)

export const regionLabel = (value: unknown) =>
  SUPPORTED_REGIONS.find(region => region.id === value)?.label || String(value ?? '')
