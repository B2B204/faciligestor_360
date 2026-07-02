import React, { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser } from 'lucide-react';

function getPoint(canvas, evt) {
  const rect = canvas.getBoundingClientRect();
  const touch = evt.touches?.[0];
  const clientX = touch ? touch.clientX : evt.clientX;
  const clientY = touch ? touch.clientY : evt.clientY;
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
}

/**
 * Área de assinatura digital baseada em <canvas>, sem dependências externas.
 * Use a ref para chamar getBlob() e obter o PNG assinado, ou isEmpty()/clear().
 */
const SignaturePad = forwardRef(function SignaturePad({ onChange, height = 180 }, ref) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [empty, setEmpty] = useState(true);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';
  }, [height]);

  useEffect(() => {
    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    return () => window.removeEventListener('resize', setupCanvas);
  }, [setupCanvas]);

  const start = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const p = getPoint(canvas, e);
    const ratio = window.devicePixelRatio || 1;
    ctx.beginPath();
    ctx.moveTo(p.x / ratio, p.y / ratio);
    drawingRef.current = true;
  };

  const move = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const p = getPoint(canvas, e);
    const ratio = window.devicePixelRatio || 1;
    ctx.lineTo(p.x / ratio, p.y / ratio);
    ctx.stroke();
    if (empty) { setEmpty(false); onChange?.(true); }
  };

  const end = () => { drawingRef.current = false; };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange?.(false);
  };

  useImperativeHandle(ref, () => ({
    isEmpty: () => empty,
    clear,
    getBlob: () => new Promise((resolve) => {
      canvasRef.current.toBlob((blob) => resolve(blob), 'image/png');
    }),
  }), [empty]);

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-dashed border-border bg-white overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: `${height}px`, display: 'block', cursor: 'crosshair' }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Peça para o cliente assinar com o dedo ou mouse acima.</p>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 border-border" onClick={clear}>
          <Eraser className="w-3.5 h-3.5" /> Limpar
        </Button>
      </div>
    </div>
  );
});

export default SignaturePad;
