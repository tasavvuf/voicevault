export const colors = {
  background: '#F5F7FB',
  surface: '#FFFFFF',
  primary: '#2563EB',
  primaryDark: '#172554',
  primarySoft: '#DBEAFE',
  text: '#172554',
  muted: '#64748B',
  border: '#E2E8F0',
  success: '#10B981',
  successSoft: '#D1FAE5',
  lavender: '#8B5CF6',
  lavenderSoft: '#EDE9FE',
  orange: '#F59E0B',
  orangeSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
} as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 40 } as const;
export const radius = { sm: 12, md: 18, lg: 24, pill: 999 } as const;

export const shadow = {
  shadowColor: '#172554',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.05,
  shadowRadius: 12,
  elevation: 2,
} as const;
