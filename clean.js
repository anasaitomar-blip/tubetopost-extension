// clean.js — Post-traitement du texte généré (ES module).
// Nettoie ce qu'un petit modèle (8B) laisse parfois traîner :
//  - marqueurs markdown gras/italique (**, __)
//  - titres markdown (#, ##...)
//  - sous-titres académiques/bateau ("Introduction", "Partie 1"...)
//  - numérotations robotiques de début de ligne -> puces tiret uniformes
//  - puces hétérogènes (*, •) -> tiret
//  - sauts de ligne multiples
// Objectif : rendu LinkedIn ultra-pro, fluide, scannable.

// Sous-titres/section-titres à supprimer (lignes courtes, heading-like).
const SUBTITLE_PATTERNS = [
  /^introduction$/i,
  /^conclusion$/i,
  /^pour conclure$/i,
  /^en r[ée]sum[ée]$/i,
  /^r[ée]sum[ée]$/i,
  /^contexte$/i,
  /^d[ée]veloppement$/i,
  /^accroche$/i,
  /^plan$/i,
  /^points? cl[ée]s?$/i,
  /^partie\s*\d+/i,
  /^section\s*\d+/i,
  /^[ée]tape\s*\d+\s*$/i,
  /^chapitre\s*\d+/i,
  /^comprenez ceci/i,
  /^familiarisez-?vous/i,
  /^testez vos connaissances/i
];

export function cleanPost(raw) {
  if (!raw) return '';
  let text = String(raw).replace(/\r\n/g, '\n');

  // Retire les éventuelles clôtures de bloc de code.
  text = text.replace(/```[a-z]*\n?/gi, '');

  const lines = text.split('\n');
  const out = [];

  for (let line of lines) {
    // 1) Retire marqueurs gras/italique markdown (** et __), n'importe où.
    line = line.replace(/\*\*/g, '').replace(/__/g, '');
    // 2) Retire les titres markdown en début de ligne (#, ##, ...).
    //    Exige un espace après les # pour NE PAS toucher aux hashtags (#IA).
    line = line.replace(/^\s*#{1,6}\s+/, '');
    // 3) Numérotation robotique en début de ligne (1. / 2) ) -> puce tiret.
    line = line.replace(/^\s*\d+[.)]\s+/, '- ');
    // 4) Puces hétérogènes (* ou •) -> tiret uniforme.
    line = line.replace(/^\s*[*•·]\s+/, '- ');
    // 5) Espaces de fin.
    line = line.replace(/[ \t]+$/, '');

    // 6) Supprime les lignes de sous-titre académique (courtes, sans phrase).
    const headingLike = line.trim().replace(/[:：]\s*$/, '');
    const words = headingLike ? headingLike.split(/\s+/).length : 0;
    const looksLikeHeading = words > 0 && words <= 6 && !/[.!?]$/.test(headingLike);
    if (looksLikeHeading && SUBTITLE_PATTERNS.some((re) => re.test(headingLike))) {
      continue; // ligne supprimée
    }

    out.push(line);
  }

  let result = out.join('\n');
  // Effondre 3+ sauts de ligne en un double saut (aération propre).
  result = result.replace(/\n{3,}/g, '\n\n');
  // Nettoie d'éventuelles puces vides résiduelles.
  result = result.replace(/^-\s*$/gm, '');
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}
