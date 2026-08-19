# OpenGTA Web — Codex Model Routing

**Status:** Operational guidance  
**Last verified against official OpenAI model docs:** 2026-08-19

## Capability classes

Repository tasks use capability classes so model names can change without
rewriting every task.

### ECONOMY

Use for:

- deterministic doc synchronization;
- simple fixtures;
- boilerplate after a precise spec;
- narrow unit tests;
- repetitive edits.

Current preferred mapping when available:

```text
GPT-5.6 Luna
```

### STANDARD

Use for:

- normal implementation;
- integration;
- moderate debugging;
- compiler modules with explicit contracts;
- most V0 tasks.

Current preferred mapping:

```text
GPT-5.6 Terra
```

### FRONTIER

Use for:

- difficult cross-module debugging;
- ambiguous performance bottlenecks;
- architecture conflict;
- difficult renderer/physics failure;
- major corrective refactor.

Current preferred mapping:

```text
GPT-5.6 Sol
```

## Default

Use STANDARD.

The current OpenAI guidance describes Terra as the balance of intelligence and
cost, Luna as the cost-sensitive/high-volume option, and Sol as the frontier
option for complex professional/coding work.

## Reasoning effort

Starting point:

```text
ECONOMY  low
STANDARD medium
FRONTIER high
```

Raise reasoning only when the task needs it.

## Cost discipline

Do not spend a FRONTIER run on a task that is mechanically specified.

The biggest controllable savings are:

1. correct model class;
2. small context;
3. exact `READ` list;
4. exact acceptance criteria;
5. no repeated repository-wide analysis;
6. separate design from mechanical execution.

## Context metadata

Every non-trivial task should identify:

```text
MODEL CLASS
REASONING
READ
MAY MODIFY
DO NOT TOUCH
ACCEPTANCE
```

## Escalation

Escalate one class if:

- the same well-specified task fails twice;
- debugging becomes cross-module;
- repository evidence contradicts the spec;
- a performance/physics/rendering tradeoff becomes genuinely ambiguous.

Do not escalate for syntax/formatting errors.

## Official references

- https://developers.openai.com/api/docs/models
- https://developers.openai.com/api/docs/models/gpt-5.6-sol
- https://developers.openai.com/api/docs/models/gpt-5.6-terra
- https://developers.openai.com/api/docs/models/gpt-5.6-luna
- https://developers.openai.com/api/docs/guides/latest-model

Re-check this file if model availability changes.
