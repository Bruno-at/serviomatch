// Geo helpers: reverse geocoding + Google Maps deep linking

const placeCache = new Map<string, string>();

export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  if (placeCache.has(key)) return placeCache.get(key)!;

  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    if (!res.ok) throw new Error("geocode failed");
    const data = await res.json();

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

    const name = parts.length ? parts.join(", ") : "Location unavailable";
    placeCache.set(key, name);
    return name;
  } catch {
    return "Location unavailable";
  }
};

/**
 * Build the canonical Google Maps URL for given coordinates.
 * Exposed for testing and reuse.
 */
export const buildGoogleMapsUrl = (lat: number, lng: number): string =>
  `https://maps.google.com/maps?q=${lat},${lng}`;

export const isMobileUA = (ua: string = navigator.userAgent): boolean =>
  /iPhone|iPad|iPod|Android/i.test(ua);

/**
 * Open Google Maps centered on the given coordinates in a NEW TAB.
 *
 * Inside sandboxed previews/iframes, navigating the current frame to
 * google.com is blocked by X-Frame-Options (ERR_BLOCKED_BY_RESPONSE).
 * The robust fix is to always open a real new top-level tab via an
 * anchor click with rel="noopener" — this escapes the iframe sandbox
 * and never tries to embed Google Maps.
 */
export const openInGoogleMaps = (lat: number, lng: number, _label?: string): void => {
  const url = buildGoogleMapsUrl(lat, lng);

  try {
    // Prefer a synthetic anchor click — works in sandboxed iframes where
    // window.open may be blocked, and avoids navigating the current frame.
    if (typeof document !== "undefined") {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
  } catch {
    // fall through
  }

  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    // last resort
  }
};
