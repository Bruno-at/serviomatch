// Geo helpers: reverse geocoding + Google Maps deep linking

const placeCache = new Map<string, string>();

export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  // ~1km accuracy cache key
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  if (placeCache.has(key)) return placeCache.get(key)!;

  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    const data = await res.json();

    // Build a richer place string: locality, city, region, country
    const parts: string[] = [];
    const seen = new Set<string>();
    const push = (v?: string) => {
      const t = (v || "").trim();
      if (t && !seen.has(t.toLowerCase())) {
        parts.push(t);
        seen.add(t.toLowerCase());
      }
    };
    push(data.locality);
    push(data.city);
    push(data.principalSubdivision);
    push(data.countryName);

    const name = parts.length ? parts.join(", ") : "Unknown location";
    placeCache.set(key, name);
    return name;
  } catch {
    return "Unknown location";
  }
};

/**
 * Open Google Maps centered on the given coordinates.
 * On mobile: uses the geo: scheme so the native app opens (with web fallback).
 * On desktop: opens maps.google.com in a new tab.
 */
export const openInGoogleMaps = (lat: number, lng: number, label?: string) => {
  const name = encodeURIComponent(label || "Location");
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const webUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  if (isMobile) {
    // geo: scheme works on Android; iOS handles maps.google.com gracefully
    const geoUrl = `geo:${lat},${lng}?q=${lat},${lng}(${name})`;
    // Try native first, fall back to web after a beat
    const start = Date.now();
    window.location.href = geoUrl;
    setTimeout(() => {
      if (Date.now() - start < 1500) window.open(webUrl, "_blank");
    }, 800);
    return;
  }

  window.open(webUrl, "_blank", "noopener,noreferrer");
};
