import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { lookupCnpj } from '@/functions/lookupCnpj';

export function formatCnpj(v) {
  const d = (v || '').replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

// Drop-in replacement for <Input> on CNPJ fields: masks as you type and, once
// 14 digits are entered, automatically fetches company data from the Receita
// Federal (via BrasilAPI) and reports it through onFound.
export default function CnpjLookupInput({ id, name, value, onChange, onFound, className, disabled, ...props }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [found, setFound] = useState(false);
  const lastLookedUp = useRef('');
  const timerRef = useRef(null);

  const handleChange = (e) => {
    const formatted = formatCnpj(e.target.value);
    setError('');
    setFound(false);
    onChange?.({ target: { name, value: formatted } });
  };

  useEffect(() => {
    const digits = (value || '').replace(/\D/g, '');
    if (timerRef.current) clearTimeout(timerRef.current);
    if (digits.length !== 14 || digits === lastLookedUp.current) return;

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const data = await lookupCnpj(digits);
        lastLookedUp.current = digits;
        setFound(true);
        onFound?.(data);
      } catch (e) {
        setError('CNPJ não encontrado na Receita Federal.');
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timerRef.current);
  }, [value]);

  return (
    <div>
      <div className="relative">
        <Input
          id={id}
          name={name}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className={className ? `${className} pr-9` : 'pr-9'}
          {...props}
        />
        {loading && (
          <Loader2 className="w-4 h-4 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        )}
        {!loading && found && (
          <CheckCircle2 className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-green-600" />
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
