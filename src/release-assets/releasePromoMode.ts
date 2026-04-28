export function isReleasePromoMode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("releasePromo") === "0.5.0") return true;
  return window.location.hash.startsWith("#/release-promo/0.5.0/");
}
