import React, { useEffect, useRef, useState } from 'react';
import { ServiceOrder } from '@/entities/ServiceOrder';
import { User } from '@/entities/User';
import { UploadFile } from '@/integrations/Core';
import { getCurrentPosition, mapsLink } from '@/lib/geolocation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import SignaturePad from './SignaturePad';
import {
  MapPin, LogIn, LogOut, PenTool, Camera, ExternalLink, CheckCircle2, Loader2
} from 'lucide-react';

const fmtDateTime = (iso) => {
  if (!iso) return null;
  try { return new Date(iso).toLocaleString('pt-BR'); } catch { return iso; }
};

function GpsStamp({ label, at, lat, lng, by, accuracy, icon: Icon, colorClass }) {
  if (!at) return null;
  return (
    <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
      <div className={`flex items-center gap-1.5 font-medium ${colorClass}`}>
        <Icon className="w-4 h-4" /> {label}
      </div>
      <p className="text-muted-foreground text-xs">{fmtDateTime(at)} {by ? `· ${by}` : ''}</p>
      {lat != null && lng != null && (
        <a
          href={mapsLink(lat, lng)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <MapPin className="w-3 h-3" /> {Number(lat).toFixed(6)}, {Number(lng).toFixed(6)}
          {accuracy != null && ` (±${Math.round(accuracy)}m)`}
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

export default function ExecutionPanel({ os, onChanged }) {
  const [order, setOrder] = useState(os);
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [signedByName, setSignedByName] = useState('');
  const [hasSignature, setHasSignature] = useState(false);
  const [closeOnCheckout, setCloseOnCheckout] = useState(true);
  const [photos, setPhotos] = useState(os?.closing_photos || []);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const sigRef = useRef(null);

  useEffect(() => { setOrder(os); setPhotos(os?.closing_photos || []); }, [os]);
  useEffect(() => { User.me().then(setUser); }, []);

  const reload = async (patch) => {
    const updated = { ...order, ...patch };
    setOrder(updated);
    onChanged?.(updated);
  };

  const handleCheckIn = async () => {
    setBusy(true);
    try {
      const pos = await getCurrentPosition();
      const patch = {
        check_in_at: new Date().toISOString(),
        check_in_lat: pos.lat,
        check_in_lng: pos.lng,
        check_in_accuracy: pos.accuracy,
        check_in_by: user?.email,
        ...(order.status === 'Aberta' ? { status: 'Em Andamento' } : {}),
      };
      await ServiceOrder.update(order.id, patch);
      await reload(patch);
    } catch (e) {
      alert(e.message || 'Não foi possível registrar o check-in.');
    } finally {
      setBusy(false);
    }
  };

  const handleCheckOut = async () => {
    setBusy(true);
    try {
      const pos = await getCurrentPosition();
      const nowIso = new Date().toISOString();
      const patch = {
        check_out_at: nowIso,
        check_out_lat: pos.lat,
        check_out_lng: pos.lng,
        check_out_accuracy: pos.accuracy,
        check_out_by: user?.email,
        ...(closeOnCheckout ? { status: 'Concluída', closed_at: nowIso, close_date: nowIso.slice(0, 10) } : {}),
      };
      await ServiceOrder.update(order.id, patch);
      await reload(patch);
    } catch (e) {
      alert(e.message || 'Não foi possível registrar o check-out.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSignature = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      alert('Peça para o cliente assinar antes de salvar.');
      return;
    }
    if (!signedByName.trim()) {
      alert('Informe o nome de quem está assinando.');
      return;
    }
    setBusy(true);
    try {
      const blob = await sigRef.current.getBlob();
      const file = new File([blob], `assinatura_${order.id}_${Date.now()}.png`, { type: 'image/png' });
      const { file_url } = await UploadFile({ file });
      const patch = {
        customer_signature_url: file_url,
        signed_by_name: signedByName.trim(),
        signed_at: new Date().toISOString(),
      };
      await ServiceOrder.update(order.id, patch);
      await reload(patch);
      sigRef.current.clear();
      setHasSignature(false);
    } catch (e) {
      alert(e.message || 'Não foi possível salvar a assinatura.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await UploadFile({ file });
      const next = [...photos, file_url];
      setPhotos(next);
      await ServiceOrder.update(order.id, { closing_photos: next });
      await reload({ closing_photos: next });
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-5">
      {/* Check-in / Check-out */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          {order.check_in_at ? (
            <GpsStamp label="Check-in realizado" at={order.check_in_at} lat={order.check_in_lat} lng={order.check_in_lng} by={order.check_in_by} accuracy={order.check_in_accuracy} icon={LogIn} colorClass="text-green-600 dark:text-green-400" />
          ) : (
            <Button onClick={handleCheckIn} disabled={busy} className="w-full gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />} Fazer Check-in (GPS)
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {order.check_out_at ? (
            <GpsStamp label="Check-out realizado" at={order.check_out_at} lat={order.check_out_lat} lng={order.check_out_lng} by={order.check_out_by} accuracy={order.check_out_accuracy} icon={LogOut} colorClass="text-blue-600 dark:text-blue-400" />
          ) : (
            <div className="space-y-2">
              <Button onClick={handleCheckOut} disabled={busy || !order.check_in_at} className="w-full gap-2" variant="outline">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />} Fazer Check-out (GPS)
              </Button>
              {!order.check_in_at && <p className="text-xs text-muted-foreground text-center">Faça o check-in primeiro.</p>}
              {order.check_in_at && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                  <Checkbox checked={closeOnCheckout} onCheckedChange={setCloseOnCheckout} />
                  Marcar OS como Concluída ao sair
                </label>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fotos de encerramento */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5" /> Fotos do serviço concluído
        </Label>
        <Input type="file" accept="image/*" capture="environment" onChange={handleAddPhoto} disabled={uploadingPhoto} />
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {photos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt={`Foto ${i + 1}`} className="w-16 h-16 object-cover rounded-md border border-border" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Assinatura do cliente */}
      <div className="space-y-2 border-t border-border pt-4">
        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
          <PenTool className="w-3.5 h-3.5" /> Assinatura do Cliente
        </Label>
        {order.customer_signature_url ? (
          <div className="rounded-lg bg-muted/50 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4" /> Assinado por {order.signed_by_name}
            </div>
            <p className="text-xs text-muted-foreground">{fmtDateTime(order.signed_at)}</p>
            <img src={order.customer_signature_url} alt="Assinatura do cliente" className="max-h-24 bg-white rounded border border-border" />
          </div>
        ) : (
          <div className="space-y-2">
            <Input placeholder="Nome de quem está assinando" value={signedByName} onChange={(e) => setSignedByName(e.target.value)} />
            <SignaturePad ref={sigRef} onChange={setHasSignature} />
            <Button onClick={handleSaveSignature} disabled={busy || !hasSignature} className="w-full gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenTool className="w-4 h-4" />} Salvar Assinatura
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
