/**
 * Romanization alias expansion for Latin-script queries.
 *
 * The bundled dataset indexes only the official RTGS transliteration of each
 * name (`name_en`), so common but non-RTGS spellings a user actually types
 * ("lardprao", "krungthep", "sukumvit") miss the index entirely. This module
 * rewrites such a query into its RTGS form before trigram extraction.
 *
 * Contract:
 * - Input is an ALREADY-NORMALIZED query (lowercased, prefixes and tone marks
 *   stripped) as produced by `normalizeThaiAddressText`.
 * - Output is a normalized query too — safe to hand straight to
 *   `extractTrigramsNormalized`.
 * - Thai-script input must be returned unchanged.
 * - Must be a pure function; it runs on every keystroke.
 *
 * Design (two layers, cheapest/most-reliable first):
 *
 * 1. A curated dictionary of non-RTGS spelling -> exact RTGS string, as it
 *    literally appears in a `name_en` field of the bundled dataset. Targets
 *    were read off the real generated index (see the romanize benchmark
 *    harness used to build this list), not guessed — a couple of entries
 *    intentionally map onto data typos already baked into the dataset
 *    (`loburi`, `buogkan`) because that is what is actually indexed.
 *
 * 2. A tiny, conservative cleanup pass used only when the dictionary misses:
 *    collapse runs of whitespace, and strip a few English administrative
 *    words (`district`, `province`, ...) that never occur inside a real
 *    `name_en` value. Both were verified against the full dataset before
 *    being added — see the "rejected rules" note below for transformations
 *    that were tried and thrown out because they collide with real names.
 *
 * Rejected systematic rules (measured against the real dataset, not
 * hypothetical): a blanket `klong` -> `khlong` rewrite would break the real
 * tambons "Mae Klong" and "Ho Klong"; `muang` -> `mueang` would break ~122
 * real tambons that legitimately contain "Muang" as a name component (e.g.
 * "Bang Muang", "Khok Muang"); `huay` -> `huai` would break the real tambon
 * "Huay Lueg"; a blanket hyphen -> space rewrite would break the ~70 real
 * names that use a hyphen on purpose (e.g. "Bang Pa-in", the Ayutthaya
 * palace town). None of the classic AUA-vs-RTGS letter swaps (`oo` -> `u`,
 * trailing `-rd` -> `-t`, `dt` -> `t`, `bp` -> `p`, doubled consonants) had
 * any real occurrence in the traffic-prioritized query set used to validate
 * this module, so none were added — see the harness report for the
 * before/after numbers this file was tuned against.
 */

// --- Layer 1: curated alias dictionary -------------------------------------
//
// Keys are already-normalized (lowercase) non-RTGS spellings. Values are the
// exact RTGS substring as it appears in the dataset's `name_en` fields
// (verified against the real generated index, not guessed).
const ALIASES: ReadonlyMap<string, string> = new Map([
  // --- Bangkok khet (districts) — concatenated ("no space") forms ---------
  ['phranakhon', 'phra nakhon'],
  ['nongchok', 'nong chok'],
  ['bangrak', 'bang rak'],
  ['bangkhen', 'bang khen'],
  ['bangkapi', 'bang kapi'],
  ['pathumwan', 'pathum wan'],
  ['patumwan', 'pathum wan'],
  ['pomprap', 'pom prap sattru phai'],
  ['phrakhanong', 'phra khanong'],
  ['minburi', 'min buri'],
  ['latkrabang', 'lat krabang'],
  ['ladkrabang', 'lat krabang'],
  ['yannawa', 'yan nawa'],
  ['phayathai', 'phaya thai'],
  ['thonburi', 'thon buri'],
  ['bangkokyai', 'bangkok yai'],
  ['huaikhwang', 'huai khwang'],
  ['huaykhwang', 'huai khwang'],
  ['huaykwang', 'huai khwang'],
  ['khlongsan', 'khlong san'],
  ['klongsan', 'khlong san'],
  ['talingchan', 'taling chan'],
  ['bangkoknoi', 'bangkok noi'],
  ['bangkhunthian', 'bang khun thian'],
  ['phasicharoen', 'phasi charoen'],
  ['nongkhaem', 'nong khaem'],
  ['ratburana', 'rat burana'],
  ['bangphlat', 'bang phlat'],
  ['dindaeng', 'din daeng'],
  ['buengkum', 'bueng kum'],
  ['bangsue', 'bang sue'],
  ['bangkholaem', 'bang kho laem'],
  ['khlongtoei', 'khlong toei'],
  ['klongtoei', 'khlong toei'],
  ['klongtoey', 'khlong toei'],
  ['khlongtoey', 'khlong toei'],
  ['suanluang', 'suan luang'],
  ['chomthong', 'chom thong'],
  ['donmueang', 'don mueang'],
  ['donmuang', 'don mueang'],
  ['latphrao', 'lat phrao'],
  ['ladprao', 'lat phrao'],
  ['lardprao', 'lat phrao'],
  ['lat prao', 'lat phrao'],
  ['bangkhae', 'bang khae'],
  ['laksi', 'lak si'],
  ['saimai', 'sai mai'],
  ['khannayao', 'khan na yao'],
  ['saphansung', 'saphan sung'],
  ['wangthonglang', 'wang thonglang'],
  ['khlongsamwa', 'khlong sam wa'],
  ['klongsamwa', 'khlong sam wa'],
  ['bangna', 'bang na'],
  ['thawiwatthana', 'thawi watthana'],
  ['thungkhru', 'thung khru'],
  ['bangbon', 'bang bon'],

  // --- Bangkok area / street nicknames with a common misspelling ----------
  ['sathorn', 'sathon'],
  ['wattana', 'watthana'],
  ['silom', 'si lom'],

  // --- Provinces and other high-traffic areas ------------------------------
  ['krungthep', 'bangkok'],
  ['korat', 'nakhon ratchasima'],
  ['nakornratchasima', 'nakhon ratchasima'],
  ['chiangmai', 'chiang mai'],
  ['chiangrai', 'chiang rai'],
  ['pathumthani', 'pathum thani'],
  ['patumthani', 'pathum thani'],
  ['samutprakan', 'samut prakan'],
  ['samutsakhon', 'samut sakhon'],
  ['samutsongkhram', 'samut songkhram'],
  ['nakhonpathom', 'nakhon pathom'],
  ['nakhonsawan', 'nakhon sawan'],
  ['nakhonsithammarat', 'nakhon si thammarat'],
  ['prachuapkhirikhan', 'prachuap khiri khan'],
  ['huahin', 'hua hin'],
  ['hatyai', 'hat yai'],
  ['hadyai', 'hat yai'],
  ['had yai', 'hat yai'],
  ['lopburi', 'loburi'],
  ['lop buri', 'loburi'],
  ['buengkan', 'buogkan'],
  ['bungkan', 'buogkan'],
  ['bung kan', 'buogkan'],
  ['udonthani', 'udon thani'],
  ['khonkaen', 'khon kaen'],
  ['suphanburi', 'suphan buri'],
  ['nongkhai', 'nong khai'],
  ['buriram', 'buri ram'],
])

// --- Layer 2: safe systematic cleanup (dictionary-miss fallback only) -----
//
// English administrative words that NEVER occur inside a real `name_en`
// value (verified against the full dataset) — safe to strip unconditionally.
// Deliberately excludes "khet" and "tambon": both occur as genuine name
// components in the real data ("Khet Chatuchak" as a whole amphure name,
// but also tambons like "Sanam Chai Khet" and "Sam Tambon"), so stripping
// them would corrupt otherwise-correct queries.
const NOISE_WORDS_RE = /\b(?:sub[- ]?district|district|province|changwat|amphoe|amphur)\b/g
const WHITESPACE_RE = /\s+/g

function cleanup(text: string): string {
  const stripped = text.replace(NOISE_WORDS_RE, ' ').replace(WHITESPACE_RE, ' ').trim()
  return stripped.length > 0 ? stripped : text
}

export function applyRomanizationAliases(normalized: string): string {
  if (!normalized) return normalized

  const direct = ALIASES.get(normalized)
  if (direct !== undefined) return direct

  const cleaned = cleanup(normalized)
  if (cleaned === normalized) return normalized

  const aliasedCleaned = ALIASES.get(cleaned)
  return aliasedCleaned !== undefined ? aliasedCleaned : cleaned
}
