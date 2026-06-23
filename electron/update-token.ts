// Token GitHub di SOLA LETTURA per l'auto-update da repo privato.
//
// Il placeholder qui sotto viene sostituito in CI (step "Inject update token")
// con il secret UPDATE_TOKEN, e finisce compilato dentro l'app. In locale resta
// il placeholder → trattato come vuoto (nessun token, auto-update senza auth).
//
// NB: il token incorporato è di sola lettura (permesso "Contents" sul solo repo
// dieffe-preventivi), così l'app può scaricare le release private.
const RAW = "__UPDATE_TOKEN__";

export const UPDATE_TOKEN = RAW.startsWith("__") ? "" : RAW;
