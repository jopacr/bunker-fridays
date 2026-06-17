// Workbook import/export (§7). Import upserts artists by name and replaces
// workbook-sourced calendar rows per date so re-import is idempotent,
// including double sets. Export mirrors the database back into the VBA
// macro's exact Artists + Bookings layout.

import express from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { requireAdmin } from "../auth/sessions.js";
import { parseWorkbook, applyWorkbook, buildExportWorkbook } from "../lib/workbook.js";
import { snapshot, upsertArtist, upsertNight, audit, tx, uid } from "../services/store.js";
import { todayISO, fridaysAhead } from "../lib/dates.js";
import { isLocal, entriesFor, writersNight } from "../lib/rules.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const workbookRoutes = express.Router();
workbookRoutes.use(requireAdmin);

workbookRoutes.post("/import", upload.single("file"), async (req, res) => {
  if (!req.file?.buffer) return res.status(400).json({ error: "Upload the .xlsm/.xlsx workbook." });
  let parsed;
  try {
    parsed = parseWorkbook(req.file.buffer);
  } catch (e) {
    return res.status(400).json({ error: "Couldn't read that file as an Excel workbook." });
  }
  const snap = await snapshot();
  const result = applyWorkbook(snap, parsed, todayISO());

  await tx(async (run) => {
    for (const a of Object.values(result.artists)) {
      await upsertArtist(a.id || uid(), a, run);
    }
    for (const [date, night] of Object.entries(result.nights)) {
      await upsertNight(date, night, run);
    }
  });

  await audit(req.adminEmail, "workbook.import", "workbook", "import", result.stats);
  res.json({ ok: true, ...result.stats });
});

workbookRoutes.get("/export", async (_req, res) => {
  try {
    const snap = await snapshot();
    const today = todayISO();
    const wb = buildExportWorkbook(snap, {
      isLocal: (city) => isLocal(city, snap.localCities),
      entriesFor: (dISO) => entriesFor(snap, dISO),
      writersNight: (dISO) => writersNight(snap, dISO),
      fridaysAhead,
    }, today);
    const buf = Buffer.isBuffer(wb) ? wb : XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", `attachment; filename="bunker-bookings-${today}.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buf);
  } catch (e) {
    console.error("workbook export", e);
    res.status(500).json({ error: "Could not build the workbook export." });
  }
});
