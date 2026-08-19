# Client-Side AI Feasibility Snapshot — 2026-08

## Conclusion

Client-side inference is architecturally plausible, but it must remain a
progressive enhancement.

The first practical AI target should be **compact visual descriptors or
classification**, not browser image generation.

## Why

Current browser ML runtimes support broad CPU/WASM execution and more limited
GPU acceleration.

ONNX Runtime Web currently documents:

- WebAssembly support across major desktop/mobile browsers;
- WebGPU support mainly on Chromium-class browsers in its support matrix;
- WebGPU import as an experimental path.

Transformers.js can run models directly in a browser and uses ONNX Runtime
under the hood. It supports WebGPU acceleration and quantized model variants,
but its documentation also treats WebGPU availability as a compatibility
consideration.

## Recommended staged path

### AI-0 — none

Deterministic style resolver only.

Required for every client.

### AI-1 — descriptor inference

Input:

```text
normalized tags
regional context
building category
```

Output:

```text
palette/style family/roof family/detail class
```

This can use a small model or even no ML at all.

### AI-2 — lightweight local model

Only if descriptor quality justifies ML.

Prefer quantized models and lazy loading.

### AI-3 — texture/image generation

Research only after:

- model size;
- cold-start;
- memory;
- thermal;
- browser coverage;
- generation latency;

have been measured.

Do not make Open World Runtime depend on AI-3.

## Capability behavior

```text
No AI runtime
→ deterministic style

WASM-capable AI
→ optional compact inference

WebGPU-capable AI
→ optional accelerated inference

high-end proven device
→ future texture generation experiment
```

## Architectural implication

World compilation and first-playable time must complete without downloading an
AI model.

AI model download/inference is lower-priority work and cancellable.

## Candidate runtime classes

Future research candidates:

- ONNX Runtime Web;
- Transformers.js where its pipeline/model ecosystem is useful.

No runtime/model is accepted yet.

## Sources checked

- https://onnxruntime.ai/docs/get-started/with-javascript/web.html
- https://huggingface.co/docs/transformers.js/en/index
- https://huggingface.co/docs/transformers.js/en/guides/webgpu
