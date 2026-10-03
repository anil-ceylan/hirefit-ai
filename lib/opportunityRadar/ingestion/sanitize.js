import { parseDocument } from "htmlparser2";

const excluded = new Set(["script", "style", "iframe", "object", "template", "noscript", "svg", "math", "head"]);
const blocks = new Set(["p", "div", "section", "article", "header", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "br", "hr", "tr", "blockquote"]);
const encodedMarkup = /<\/?(?:script|style|iframe|object|template|p|div|span|ul|ol|li|br|strong|em|b|a|h[1-6])(?:\s|>|\/)/i;

// Walk parsed nodes, never raw tag regexes. Attributes/comments are never emitted.
function render(value, depth = 0) {
  const stack = [...parseDocument(value, { decodeEntities: true }).children].reverse();
  const chunks = [];
  while (stack.length) {
    const node = stack.pop();
    if (typeof node === "string") { chunks.push(node); continue; }
    if (node.type === "text") {
      const decoded = node.data;
      // Greenhouse may wrap a description in one or more layers of HTML entities.
      if (encodedMarkup.test(decoded) || /&(?:amp;)*(?:lt|#0*60|#x0*3c);/i.test(decoded)) {
        if (depth >= 3) throw new Error("HTML_ENCODING_REQUIRES_REVIEW");
        chunks.push(render(decoded, depth + 1));
      } else chunks.push(decoded);
      continue;
    }
    if (!node.name || excluded.has(node.name)) continue;
    if (blocks.has(node.name)) chunks.push("\n");
    if (node.name === "li") chunks.push("- ");
    if (["td", "th"].includes(node.name)) chunks.push(" ");
    if (blocks.has(node.name)) stack.push("\n");
    if (node.children) stack.push(...[...node.children].reverse());
  }
  return chunks.join("");
}

export function sanitizeDescription(value) {
  if (typeof value !== "string" || value.length > 200000) throw new Error("INVALID_DESCRIPTION");
  const full = render(value).replace(/\r\n?/g, "\n");
  const clean = [...full].map(char => (char.charCodeAt(0) < 32 && char !== "\n") || char.charCodeAt(0) === 127 ? " " : char).join("")
    .split("\n").map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
  const chars = [...clean];
  return { text: chars.slice(0, 12000).join(""), rawCharacters: value.length,
    sanitizedCharacters: chars.length, rawLarge: value.length > 12000, truncated: chars.length > 12000 };
}
export const plainText = value => sanitizeDescription(value).text;
