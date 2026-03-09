function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value: string): string {
  return value.replace(/\s+/g, "");
}

function matchesOrderedTokenPrefix(query: string, target: string): boolean {
  const queryTokens = normalizeText(query).split(" ").filter(Boolean);
  const targetTokens = normalizeText(target).split(" ").filter(Boolean);

  if (queryTokens.length === 0) {
    return true;
  }

  let searchFromIndex = 0;

  for (const queryToken of queryTokens) {
    let found = false;

    for (let index = searchFromIndex; index < targetTokens.length; index += 1) {
      if (targetTokens[index].startsWith(queryToken)) {
        found = true;
        searchFromIndex = index + 1;
        break;
      }
    }

    if (!found) {
      return false;
    }
  }

  return true;
}

export function smartIncludes(
  query: string,
  ...fields: Array<string | null | undefined>
): boolean {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return true;
  }

  const joinedField = normalizeText(fields.filter(Boolean).join(" "));
  if (!joinedField) {
    return false;
  }

  if (joinedField.includes(normalizedQuery)) {
    return true;
  }

  const compactQuery = compactText(normalizedQuery);
  const compactField = compactText(joinedField);

  if (compactField.includes(compactQuery)) {
    return true;
  }

  const initials = joinedField
    .split(" ")
    .filter(Boolean)
    .map((token) => token[0])
    .join("");

  if (initials.includes(compactQuery)) {
    return true;
  }

  return matchesOrderedTokenPrefix(normalizedQuery, joinedField);
}
