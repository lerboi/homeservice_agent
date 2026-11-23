---
name: feedback-decisive-recommendation
description: "User wants ONE committed recommendation, not an option menu — he's not the domain expert, Claude is acting as one"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c854a81c-fbc1-44b1-9f87-67d609595cf6
---

When a design/product decision comes up, the user does not want a multi-question option dialog. He rejected a 4-question AskUserQuestion set and said: "I'm not a home service business owner so I need you to step into the shoes of one and tell me what option would give the best UI UX... give me a recommendation."

**Why:** He's building for a persona he isn't; he delegates domain judgment to Claude and wants conviction, not menus.

**How to apply:** Make the call, justify it from the persona's perspective vividly (day-in-the-life), fold sub-decisions into the recommendation as already-decided details, and end with at most ONE confirm question ("good to build this?"). He does still want to approve changes before they're made — see [[feedback_deep_verify_before_fix]].
