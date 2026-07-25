/**
 * 材料文字列の構造化（数量を不明時に0にしない）
 */

export type ParsedIngredientLine = {
  rawText: string;
  name: string;
  quantity: number | null;
  quantityText: string | null;
  unit: string | null;
  note: string | null;
  alias: string | null;
};

const FRACTIONS: Record<string, number> = {
  "1/2": 0.5,
  "１/２": 0.5,
  "1/3": 1 / 3,
  "1/4": 0.25,
  "2/3": 2 / 3,
  "3/4": 0.75,
  "1/8": 0.125,
};

const QUALITATIVE = ["少々", "適量", "ひとつまみ", "お好み", "適当", "少し"];

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function parseMixedNumber(token: string): { value: number; text: string } | null {
  const mixed = token.match(/^(\d+)\s*[と]\s*(1\/[2348]|2\/3|3\/4)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const frac = FRACTIONS[mixed[2]] ?? 0;
    return { value: whole + frac, text: token };
  }
  const andHalf = token.match(/^(\d+)\s*と\s*1\/2$/);
  if (andHalf) {
    return { value: Number(andHalf[1]) + 0.5, text: token };
  }
  if (token === "半分" || token === "半") {
    return { value: 0.5, text: token };
  }
  if (FRACTIONS[token] != null) {
    return { value: FRACTIONS[token], text: token };
  }
  if (/^\d+(\.\d+)?$/.test(token)) {
    return { value: Number(token), text: token };
  }
  return null;
}

function extractAlias(namePart: string): { name: string; alias: string | null; rest: string } {
  const match = namePart.match(
    /^(.+?)[（(]\s*(?:または|或いは|もしくは|or)\s*[、,．.\s]*(.+?)\s*[）)]\s*(.*)$/i,
  );
  if (!match) {
    return { name: namePart.trim(), alias: null, rest: "" };
  }
  return {
    name: match[1].trim(),
    alias: match[2].trim() || null,
    rest: match[3].trim(),
  };
}

function parseQuantityAndUnit(rest: string): {
  quantity: number | null;
  quantityText: string | null;
  unit: string | null;
  note: string | null;
} {
  const normalized = normalizeSpaces(rest);
  if (!normalized) {
    return { quantity: null, quantityText: null, unit: null, note: null };
  }

  for (const word of QUALITATIVE) {
    if (normalized === word) {
      return { quantity: null, quantityText: word, unit: null, note: null };
    }
  }

  const spaced = normalized.match(
    /^((?:\d+\s*と\s*)?(?:1\/[2348]|2\/3|3\/4|半分|半|\d+(?:\.\d+)?))[\s　]*(.*)$/,
  );
  if (spaced) {
    const parsed = parseMixedNumber(spaced[1].replace(/\s+/g, ""));
    if (parsed) {
      const unitMatch = spaced[2].match(/^([^\s（(]+)(.*)$/);
      return {
        quantity: parsed.value,
        quantityText: parsed.text,
        unit: unitMatch?.[1] || null,
        note: unitMatch?.[2]?.replace(/^[（(]|[）)]$/g, "").trim() || null,
      };
    }
  }

  const compact = normalized.match(/^(\d+(?:\.\d+)?)([a-zA-Zぁ-んァ-ン一-龥]+)$/);
  if (compact && !QUALITATIVE.includes(compact[2])) {
    return {
      quantity: Number(compact[1]),
      quantityText: compact[1],
      unit: compact[2],
      note: null,
    };
  }

  return { quantity: null, quantityText: null, unit: null, note: normalized };
}

/**
 * 「豚こま切れ肉 300g」「玉ねぎ 1/2個」「塩 少々」
 * 「サニーレタス（または、サンチュ）20枚」などを解析する。
 */
export function parseIngredientLine(raw: string): ParsedIngredientLine {
  const rawText = normalizeSpaces(raw);
  if (rawText === "") {
    return {
      rawText: "",
      name: "",
      quantity: null,
      quantityText: null,
      unit: null,
      note: null,
      alias: null,
    };
  }

  // 別名 + 数量が密着しているケースを先に処理
  const aliasFirst = extractAlias(rawText);
  if (aliasFirst.alias) {
    const qtySource = aliasFirst.rest || "";
    // 「サニーレタス（または、サンチュ）20枚」で rest が数量のとき
    const fromRest = parseQuantityAndUnit(qtySource);
    if (fromRest.quantity != null || fromRest.quantityText) {
      return {
        rawText,
        name: aliasFirst.name,
        alias: aliasFirst.alias,
        quantity: fromRest.quantity,
        quantityText: fromRest.quantityText,
        unit: fromRest.unit,
        note: fromRest.note,
      };
    }
    // 別名の後にスペース区切り数量が続く場合は下の共通処理へ
  }

  for (const word of QUALITATIVE) {
    const q = rawText.match(new RegExp(`^(.+?)[\\s　]*${word}$`));
    if (q) {
      const named = extractAlias(q[1].trim());
      return {
        rawText,
        name: named.name,
        alias: named.alias,
        quantity: null,
        quantityText: word,
        unit: null,
        note: null,
      };
    }
  }

  // 末尾の「名前 数量単位」パターン
  const match = rawText.match(
    /^(.+?)[\s　]+((?:\d+\s*と\s*)?(?:1\/[2348]|2\/3|3\/4|半分|半|\d+(?:\.\d+)?))[\s　]*(.*)$/,
  );
  if (match) {
    const named = extractAlias(match[1].trim());
    const qtyToken = match[2].replace(/\s+/g, "");
    const rest = `${named.rest} ${match[3]}`.trim();
    const parsed = parseMixedNumber(qtyToken);
    if (parsed) {
      const unitMatch = rest.match(/^([^\s（(]*)(.*)$/);
      const unit = unitMatch?.[1] || null;
      const note = unitMatch?.[2]?.replace(/^[（(]|[）)]$/g, "").trim() || null;
      return {
        rawText,
        name: named.name,
        alias: named.alias,
        quantity: parsed.value,
        quantityText: parsed.text,
        unit: unit || null,
        note: note || null,
      };
    }
  }

  // 「豚ばら肉500g」「サニーレタス（または、サンチュ）20枚」
  const compact = rawText.match(/^(.+?)(\d+(?:\.\d+)?)([a-zA-Zぁ-んァ-ン一-龥]+)$/);
  if (compact && !QUALITATIVE.includes(compact[3])) {
    const named = extractAlias(compact[1].trim());
    return {
      rawText,
      name: named.name,
      alias: named.alias,
      quantity: Number(compact[2]),
      quantityText: compact[2],
      unit: compact[3],
      note: named.rest || null,
    };
  }

  const namedOnly = extractAlias(rawText);
  return {
    rawText,
    name: namedOnly.name,
    alias: namedOnly.alias,
    quantity: null,
    quantityText: null,
    unit: null,
    note: namedOnly.rest || null,
  };
}

export function parseIngredientLines(lines: string[]): ParsedIngredientLine[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map(parseIngredientLine);
}
