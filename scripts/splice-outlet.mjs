import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, "..", "src", "App.jsx");
let s = fs.readFileSync(p, "utf8");
const markerStart = '      {false && "privacy" && (';
const endMarker = "\n\n</div>\n  );";
const i0 = s.indexOf(markerStart);
if (i0 < 0) {
  console.error("start not found");
  process.exit(1);
}
const i1 = s.indexOf(endMarker, i0);
if (i1 < 0) {
  console.error("end not found");
  process.exit(1);
}
const before = s.slice(0, i0);
const after = s.slice(i1);
const insert = "      <Outlet context={hireFitOutletContext} />\n";
fs.writeFileSync(p, before + insert + after);
console.log("ok");
