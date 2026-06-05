/**
 * Quick helper: write a generated demo snapshot into data/emaktab-export.json
 * keyed to the real Vasliddin profile that we successfully extracted earlier.
 * Lets the local /parent page render the demo path immediately, no API call
 * needed. Throwaway; the deployed app uses /api/emaktab/connect.
 */
import { writeFileSync } from "node:fs";
import { generateDemoData } from "../lib/emaktab/demo";

const profile = {
  name: "Vasliddin Shahobiddinov",
  className: "7-a",
  school: "64-sonli umumiy o'rta ta'lim maktabi",
  grade: 7,
  academicYear: "2026/2027",
  emaktab: {
    schoolId: "1000004672539",
    personId: "1000005506825",
    groupId: "2497114782286984193",
  },
};

const demo = generateDemoData(profile);
writeFileSync("data/emaktab-export.json", JSON.stringify(demo, null, 2));
const total = demo.grades.reduce(
  (n, p) => n + p.subjects.reduce((m, s) => m + s.marks.length, 0),
  0,
);
console.log(
  `wrote data/emaktab-export.json · ${total} marks · ${demo.diary.length} diary days · ${demo.homework.length} homework items`,
);
console.log("meta.source:", demo.meta.source);
