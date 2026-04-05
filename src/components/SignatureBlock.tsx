import SignatureCanvas from 'react-signature-canvas';
import { useRef } from 'react';
import Button from '@/components/ui/bouton';
import { Check, Trash2 } from 'lucide-react';

export default function SignatureBlock({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const ref = useRef<SignatureCanvas | null>(null);

  const clear = () => {
    ref.current?.clear();
    onChange(null);
  };

  const save = () => {
    if (!ref.current || ref.current.isEmpty()) return;
    const url = ref.current.getCanvas().toDataURL('image/png');
    onChange(url);
  };

  return (
    <div
      className="flex flex-col gap-3 w-full rounded-xl p-5"
      style={{
        border: '1px solid var(--border)',
        backgroundColor: 'var(--surface)',
      }}
    >
      <label className="font-medium text-sm" style={{ color: 'var(--fg-muted)' }}>
        {label}
      </label>

      <div
        style={{
          border: '1px solid var(--border-strong)',
          borderRadius: '0.5rem',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          display: 'inline-block',
        }}
      >
        <SignatureCanvas
          ref={(el: SignatureCanvas | null) => { ref.current = el; }}
          penColor="#1e293b"
          canvasProps={{
            width: 320,
            height: 110,
            className: 'signature-canvas',
            style: {
              display: 'block',
              touchAction: 'none',
            },
          }}
        />
      </div>

      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={save} icon={<Check size={14} />}>
          Valider
        </Button>
        <Button variant="ghost" size="sm" onClick={clear} icon={<Trash2 size={14} />}>
          Effacer
        </Button>
      </div>

      {value && (
        <div>
          <p className="text-xs mb-1.5 font-medium" style={{ color: 'var(--fg-subtle)' }}>
            Signature enregistrée
          </p>
          <img
            src={value}
            alt="Signature"
            style={{
              maxHeight: '80px',
              borderRadius: '0.5rem',
              border: '1px solid var(--border)',
              backgroundColor: '#fff',
              padding: '4px',
            }}
          />
        </div>
      )}
    </div>
  );
}
