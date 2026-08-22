let pdfjsLoaderPromise = null;

async function loadPdfjs() {
  if (!pdfjsLoaderPromise) {
    pdfjsLoaderPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker?url"),
    ]).then(([pdfjsLib, worker]) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjsLib;
    });
  }
  return pdfjsLoaderPromise;
}

async function extractPdfText(arrayBuffer) {
  const pdfjsLib = await loadPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item, idx) => {
        const nextItem = content.items[idx + 1];
        const hasLineBreak =
          nextItem && Math.abs(nextItem.transform[5] - item.transform[5]) > 5;
        return item.str + (hasLineBreak ? "\n" : " ");
      })
      .join("");
    fullText += `\n${pageText}`;
  }
  return fullText.trim();
}

/** Best-effort DOCX text without extra deps (reads embedded XML). */
function extractDocxText(arrayBuffer) {
  const raw = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(arrayBuffer));
  const parts = [];
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m;
  while ((m = re.exec(raw))) {
    if (m[1]) parts.push(m[1]);
  }
  return parts.join(" ").trim();
}

/**
 * Extract plain text from PDF or DOCX for first career analysis.
 * @returns {Promise<{ text: string, error?: string }>}
 */
export async function extractCvTextFromFile(file) {
  if (!file) return { text: "", error: "no_file" };

  const isPdf =
    file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
  const isDocx =
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.docx$/i.test(file.name || "");

  try {
    const buffer = await file.arrayBuffer();
    if (isPdf) {
      const text = await extractPdfText(buffer);
      return { text };
    }
    if (isDocx) {
      const text = extractDocxText(buffer);
      if (text.length < 40) {
        return {
          text: "",
          error: "docx_extract_failed",
        };
      }
      return { text };
    }
    return { text: "", error: "unsupported_type" };
  } catch {
    return { text: "", error: "read_failed" };
  }
}

