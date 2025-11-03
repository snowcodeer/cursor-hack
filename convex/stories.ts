import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Save a story
export const save = mutation({
  args: {
    title: v.string(),
    prompt: v.string(),
    fullHistory: v.array(v.string()),
    decisions: v.array(v.object({
      id: v.string(),
      text: v.string(),
      timestamp: v.number(),
      depth: v.number(),
    })),
    decisionTree: v.any(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const storyId = await ctx.db.insert("stories", {
      title: args.title,
      prompt: args.prompt,
      fullHistory: args.fullHistory,
      decisions: args.decisions,
      decisionTree: args.decisionTree,
      createdAt: now,
      updatedAt: now,
    });
    return storyId;
  },
});

// Update an existing story
export const update = mutation({
  args: {
    id: v.id("stories"),
    title: v.optional(v.string()),
    fullHistory: v.optional(v.array(v.string())),
    decisions: v.optional(v.array(v.object({
      id: v.string(),
      text: v.string(),
      timestamp: v.number(),
      depth: v.number(),
    }))),
    decisionTree: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return id;
  },
});

// Get all saved stories
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("stories")
      .withIndex("by_created")
      .order("desc")
      .collect();
  },
});

// Get a single story by ID
export const get = query({
  args: { id: v.id("stories") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Delete a story
export const remove = mutation({
  args: { id: v.id("stories") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

