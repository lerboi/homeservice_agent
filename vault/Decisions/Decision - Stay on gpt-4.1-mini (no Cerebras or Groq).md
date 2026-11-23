---
type: decision
date: 2026-09-01
status: superseded
description: "The voice LLM stays on OpenAI gpt-4.1-mini with prompt caching; Cerebras and Groq were evaluated and rejected."
tags: [voco/decision]
---

# Decision - Stay on gpt-4.1-mini (no Cerebras or Groq)

> **Superseded 2026-11-23 for the scheduling profile:** with a short prompt, Groq `qwen/qwen3.8-27b` measured about three times faster to first token and is now the default, with gpt-4.1-mini as fallback. See [[Voice Agent - Scheduling profile and fast LLM path (verified)]]. The reasoning below still holds for the long home-service prompt.

## Context
Faster inference providers were considered to cut response latency.

## Decision
Do not switch. Those providers serve open-weight models only, and the reasoning models' time to first token was worse for this workload. Latency was addressed with OpenAI prompt caching (per-tenant cache key, cache-aware prompt layout) instead.

## Sources
Full reasoning and measurements: [[2026-09-01 LLM provider decision and prompt caching]].
