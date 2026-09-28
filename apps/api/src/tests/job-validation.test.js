import test from "node:test";
import assert from "node:assert/strict";
import { createJobSchema } from "../validators/job.js";

const validJob = {
  title: "Build dashboard",
  description: "Create a production dashboard",
  budgetMin: 100,
  budgetMax: 500,
  categoryId: "web",
  skills: ["javascript"]
};

test("job validation rejects whitespace-only text fields", () => {
  for (const invalid of [
    { ...validJob, title: "    " },
    { ...validJob, description: "          " },
    { ...validJob, categoryId: "   " },
    { ...validJob, skills: ["   "] }
  ]) {
    assert.equal(createJobSchema.safeParse(invalid).success, false);
  }
});

test("job validation trims accepted text fields", () => {
  const parsed = createJobSchema.parse({
    ...validJob,
    title: "  Build dashboard  ",
    description: "  Create a production dashboard  ",
    categoryId: "  web  ",
    skills: ["  javascript  "]
  });

  assert.equal(parsed.title, "Build dashboard");
  assert.equal(parsed.description, "Create a production dashboard");
  assert.equal(parsed.categoryId, "web");
  assert.deepEqual(parsed.skills, ["javascript"]);
});
