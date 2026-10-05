// jspdf's package exports lack a worker/edge condition, so the SSR build must
// deep-import the ESM bundle directly. That subpath ships no type declarations.
declare module "jspdf/dist/jspdf.es.min.js";
