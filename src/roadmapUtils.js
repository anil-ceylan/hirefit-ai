export function cleanRoadmapTitle(line) {
  return line.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim();
}

export function parseLearningRoadmapToSteps(text, lang) {
  if (!text?.trim()) return [];
  const headerRe = /^(week\s*\d+|hafta\s*\d+|phase\s*\d+|stage\s*\d+|day\s*\d+|\d+[\.)]\s+)/i;
  const blocks = text.trim().split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  const fromBlocks = () =>
    blocks.map((block) => {
      const lines = block.split(/\n/);
      const title = cleanRoadmapTitle(lines[0] || "");
      const description = lines.slice(1).join("\n").trim();
      return {
        title,
        description: description || (lines.length === 1 ? "" : lines.slice(1).join(" ").trim()),
      };
    });

  let steps = [];
  if (blocks.length >= 2) {
    steps = fromBlocks();
  } else {
    const lines = text.trim().split(/\n/);
    let cur = null;
    for (const line of lines) {
      const lt = line.trim();
      if (headerRe.test(lt) || (lt.startsWith("#") && lt.length < 120)) {
        if (cur) steps.push(cur);
        cur = { title: cleanRoadmapTitle(lt), description: "" };
      } else if (cur) {
        cur.description += (cur.description ? "\n" : "") + line;
      } else if (lt) {
        if (!cur) cur = { title: lang === "TR" ? "Yol haritası" : "Learning path", description: line };
        else cur.description += "\n" + line;
      }
    }
    if (cur) steps.push(cur);
    if (steps.length === 0) {
      steps = [{ title: lang === "TR" ? "Plan" : "Plan", description: text.trim() }];
    }
  }

  steps = steps
    .map((s) => ({
      title: s.title,
      description: (s.description || "").trim(),
    }))
    .filter((s) => s.title || s.description);

  if (steps.length === 0) {
    return [{ title: lang === "TR" ? "Plan" : "Plan", description: text.trim() }];
  }

  return steps;
}

export function extractBulletText(line) {
  const m =
    line.match(/^[-*•]\s+(.+)$/) ||
    line.match(/^[-–—]\s+(.+)$/) ||
    line.match(/^\d+[\.)]\s+(.+)$/);
  return m ? m[1].trim() : "";
}

/** Parses step description into RESOURCE / TIME / DESCRIPTION / TASKS (tasks = bullets only). */
export function parseRoadmapStepDescription(raw) {
  const cleaned = (raw || "").replace(/\*\*/g, "").replace(/\r\n/g, "\n").trimEnd();
  if (!cleaned) return { resource: "", hours: "", description: "", tasks: [] };

  const lines = cleaned
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length);

  let resource = "";
  let hours = "";
  const descriptionLines = [];
  const tasks = [];

  const resourceRe = /^(?:resource|kaynak|kurs|course|material|reading|okuma)\s*[:：]\s*(.+)$/i;
  const timeRe = /^(?:estimated\s*time|time\s*estimate|duration|süre|tahmini\s*süre)\s*[:：]\s*(.+)$/i;
  const descHeaderRe = /^(?:description|özet|summary|overview|açıklama|genel\s*bakış)\s*[:：]\s*(.*)$/i;
  const tasksHeaderRe = /^(?:tasks?|to[\s-]?dos?|görevler|adımlar|yapılacaklar|aksiyonlar)\s*[:：]?\s*(.*)$/i;

  for (const line of lines) {
    const lh = line.replace(/^#+\s*/, "");
    const mRes = lh.match(resourceRe);
    if (mRes) {
      resource = mRes[1].trim();
      continue;
    }
    const mTime = lh.match(timeRe);
    if (mTime) {
      hours = mTime[1].trim();
      continue;
    }
    if (/^time\s*[:：]\s*(.+)$/i.test(lh)) {
      hours = lh.replace(/^time\s*[:：]\s*/i, "").trim();
      continue;
    }

    const mDesc = lh.match(descHeaderRe);
    if (mDesc) {
      const rest = (mDesc[1] || "").trim();
      if (rest) descriptionLines.push(rest);
      continue;
    }

    const tasksHeader = tasksHeaderRe.exec(lh);
    if (tasksHeader) {
      const rest = (tasksHeader[1] || "").trim();
      const bt = rest ? extractBulletText(rest) : "";
      if (bt) tasks.push(bt);
      else if (rest) descriptionLines.push(rest);
      continue;
    }

    const bt = extractBulletText(lh);
    if (bt) {
      tasks.push(bt);
      continue;
    }

    if (/^(?:~)?\d+[\s~–-]*(hours?|hrs?|h\b|saat|dakika|min\.?|weeks?|hafta)/i.test(lh) && !hours) {
      hours = lh;
      continue;
    }

    descriptionLines.push(lh);
  }

  const description = descriptionLines.join("\n").trim();
  return { resource, hours, description, tasks };
}
