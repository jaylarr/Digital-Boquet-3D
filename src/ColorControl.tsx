import { Palette } from 'lucide-react';
export function ColorControl({ value, label, onChange }: { value: string; label: string; onChange: (value: string) => void }) {
  return <label className="color-control" style={{ '--swatch': value } as React.CSSProperties} title={`Change ${label.toLowerCase()}`}><input aria-label={label} type="color" value={value} onChange={e => onChange(e.target.value)} /><span className="color-dot" /><Palette size={13} aria-hidden="true" /><span>Color</span></label>;
}
