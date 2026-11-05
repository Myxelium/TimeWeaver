export interface WorkItemKind {
  label: string;
  color: string;
  border: string;
  wash: string;
}

const KIND_COLORS: Record<string, string> = {
  bug: '#E11D48',
  'user story': '#0284C7',
  'product backlog item': '#0284C7',
  feature: '#7C3AED',
  epic: '#EA580C',
  task: '#B45309',
  issue: '#C026D3',
  'test case': '#0F766E'
};
const FALLBACK_COLOR = '#71717A';

export function workItemKind(type: string): WorkItemKind | null {
  const label = type.trim();

  if (!label)
    return null;

  const color = KIND_COLORS[label.toLowerCase()] ?? FALLBACK_COLOR;

  return {
    label,
    color,
    border: `color-mix(in srgb, ${color} 45%, transparent)`,
    wash: `color-mix(in srgb, ${color} 14%, transparent)`
  };
}
