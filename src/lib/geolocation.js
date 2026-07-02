/**
 * Captura a posição GPS atual do dispositivo como uma Promise.
 * Resolve com { lat, lng, accuracy } ou rejeita com um Error legível.
 */
export function getCurrentPosition({ timeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não é suportada neste dispositivo/navegador.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        const messages = {
          1: 'Permissão de localização negada. Habilite o acesso ao GPS nas configurações do navegador.',
          2: 'Não foi possível obter a localização atual.',
          3: 'Tempo esgotado ao tentar obter a localização.',
        };
        reject(new Error(messages[err.code] || 'Erro ao obter localização.'));
      },
      { enableHighAccuracy: true, timeout, maximumAge: 0 }
    );
  });
}

export function mapsLink(lat, lng) {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
