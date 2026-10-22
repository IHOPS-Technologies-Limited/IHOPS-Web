// SMS "pages" (a.k.a. segments / parts). Carriers and SMS aggregators bill per
// page, not per message, so a single IHOPS message can cost several pages:
//
//   GSM-7 text   : 160 chars in one page, 153 per page once it needs 2+
//   Unicode text : 70 chars in one page,   67 per page once it needs 2+
//
// A message is Unicode as soon as it contains ANY character outside the GSM-7
// alphabet. Common culprits in our content: the naira sign (₦), curly quotes
// (’ “ ”), en/em dashes (– —), ellipsis (…), emojis, and most accented capitals.
// Unicode length is counted in UTF-16 code units, so one emoji = 2.
//
// This mirrors the standard GSM 03.38 rules. A provider may count slightly
// differently (e.g. transliterating characters), so the SmsSendLog records the
// real cost alongside this estimate to let us compare.

const GSM_BASIC = new Set(
  Array.from(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
  ),
);
// Extension table: each of these costs 2 characters (escape + char).
const GSM_EXT = new Set(Array.from("^{}\\[~]|€\f"));

export type SmsSegmentInfo = {
  encoding: "gsm" | "unicode";
  characters: number; // length in the encoding's own units
  pages: number;
};

export function smsSegments(body: string): SmsSegmentInfo {
  let gsmLength = 0;
  let isGsm = true;
  for (const ch of Array.from(body)) {
    if (GSM_BASIC.has(ch)) gsmLength += 1;
    else if (GSM_EXT.has(ch)) gsmLength += 2;
    else {
      isGsm = false;
      break;
    }
  }
  if (isGsm) {
    const pages = gsmLength <= 160 ? 1 : Math.ceil(gsmLength / 153);
    return { encoding: "gsm", characters: gsmLength, pages: Math.max(1, pages) };
  }
  const units = body.length; // UTF-16 code units
  const pages = units <= 70 ? 1 : Math.ceil(units / 67);
  return { encoding: "unicode", characters: units, pages: Math.max(1, pages) };
}
