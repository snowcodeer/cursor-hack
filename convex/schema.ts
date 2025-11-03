import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  stories: defineTable({
    title: v.string(),
    prompt: v.string(),
    fullHistory: v.array(v.string()),
    decisions: v.array(v.object({
      id: v.string(),
      text: v.string(),
      timestamp: v.number(),
      depth: v.number(),
    })),
    decisionTree: v.any(), // Store the full decision tree as JSON
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_created", ["createdAt"]),
});

