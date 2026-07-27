// Markdown input rules: typing one of these trigger strings as the *entire*
// text content of an (otherwise empty) paragraph block converts it in
// place. Matching against the full block text rather than just the cursor
// position is what gives us "only fires at position 0 of an otherwise
// empty block, never mid-text" for free — if anything else is in the
// block, the exact-match regex simply won't match.
export type MarkdownRuleMatch =
  | { type: "heading"; level: 1 | 2 | 3 }
  | { type: "bulleted_list_item" }
  | { type: "numbered_list_item" }
  | { type: "to_do"; checked: boolean }
  | { type: "quote" }
  | { type: "code" }
  | { type: "divider" };

const RULES: { pattern: RegExp; match: MarkdownRuleMatch }[] = [
  { pattern: /^### $/, match: { type: "heading", level: 3 } },
  { pattern: /^## $/, match: { type: "heading", level: 2 } },
  { pattern: /^# $/, match: { type: "heading", level: 1 } },
  { pattern: /^[-*] $/, match: { type: "bulleted_list_item" } },
  { pattern: /^1\. $/, match: { type: "numbered_list_item" } },
  { pattern: /^\[x\] $/, match: { type: "to_do", checked: true } },
  { pattern: /^\[\] $/, match: { type: "to_do", checked: false } },
  { pattern: /^> $/, match: { type: "quote" } },
  { pattern: /^```$/, match: { type: "code" } },
  { pattern: /^---$/, match: { type: "divider" } },
];

export function matchMarkdownRule(text: string): MarkdownRuleMatch | null {
  for (const { pattern, match } of RULES) {
    if (pattern.test(text)) return match;
  }
  return null;
}
