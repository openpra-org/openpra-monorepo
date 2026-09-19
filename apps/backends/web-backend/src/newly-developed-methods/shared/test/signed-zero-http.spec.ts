import express from "express";
import request from "supertest";
import { jsonResponses } from "interfaces-shared-types/json";
import { PraetorAnalysisClient } from "../praetor-analysis.client";

it("preserves zero signs and JSON content headers on HTTP responses", async () => {
  const app = express();
  app.use(express.json()); app.use(jsonResponses);
  app.set("json escape", true); app.set("json spaces", 2);
  app.post("/echo", (req, res) => res.status(201).json({ value: req.body.value, other: 0, text: "<0>" }));
  const response = await request(app).post("/echo").set("Content-Type", "application/json").send('{"value":-0.0}');
  expect(response.status).toBe(201);
  expect(response.headers["content-type"]).toMatch(/application\/json/);
  expect(Object.is(response.body.value, -0)).toBe(true);
  expect(Object.is(response.body.other, 0)).toBe(true);
  expect(response.text).toContain("\\u003c0\\u003e");
  expect(Number(response.headers["content-length"])).toBe(Buffer.byteLength(response.text));
});

it("preserves signed zero across the backend-to-Praetor HTTP boundary", async () => {
  const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response('{"schemaVersion":"1.0.0","result":{"value":-0.0}}', { status: 200 }),
  );
  try {
    const response = await new PraetorAnalysisClient().execute({ values: [-0, 0] });
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(Object.is(body.values[0], -0)).toBe(true);
    expect(Object.is(body.values[1], 0)).toBe(true);
    expect(Object.is(response.result!.value, -0)).toBe(true);
  } finally { fetchMock.mockRestore(); }
});
