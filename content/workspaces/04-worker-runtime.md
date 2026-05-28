# Worker Runtime

The **worker runtime** is the execution driver that runs inside a workspace. It is the component that receives prompts, invokes LLMs, executes tool calls, and writes the results back to the workspace. The Xema platform supports pluggable worker runtime drivers.

---

## The WorkerRuntime driver interface

Every worker runtime implements a single interface:

```ts
interface WorkerRuntime {
  start(workspaceRoot: string, sessionContext: SessionContext): Promise<void>;
  sendMessage(message: AgentMessage): Promise<TurnResult>;
  stop(): Promise<void>;
}
```

This interface is what `workload-runtime-api` uses to dispatch work. The platform does not care which specific runtime is behind the interface — it only cares about the contract.

---

## Built-in drivers

### Xema Agent Runtime (v1)

The default driver. Implements the full Xema agent protocol:

- Skill mounting and slash-command dispatch.
- Tool invocation via the MCP catalog and the capability gateway.
- Structured output parsing for deliverable specs.
- Turn-level attribution for multi-user sessions.

This driver is the reference implementation of the WorkerRuntime interface.

### Kubernetes scheduler

When a session is allocated on Kubernetes, the worker runtime driver spawns a pod with the session's workspace mounted as a volume. The pod runs the Xema Agent Runtime and communicates back to `workload-runtime-api` over an authenticated gRPC channel.

### Docker scheduler

For local development and test-suite environments, the Docker scheduler starts the worker as a Docker container with the workspace volume bind-mounted. Behavior is identical to the Kubernetes scheduler from the session's perspective.

---

## Cold-start workers

Workers are pre-warmed where possible. The platform maintains a pool of idle worker pods so that session allocation is fast. If the pool is exhausted, the platform cold-starts a new worker pod.

Cold-start time depends on the image variant (see [Image Variants](./05-image-variants.md)). Base images cold-start in under 10 seconds. Custom org images with large dependency pre-installs may take longer.

---

## Connector-gated availability

Some worker runtime capabilities require connector grants. For example, running git commands inside a workspace requires a SCM connector grant scoped to the session. The runtime checks grants on startup and surfaces any missing grants before the first user message.

To inspect the runtime's active grants:

```bash
xema workspace runtime status --session <sessionId>
```

---

**Previous**: [← Multi-User Sessions](./03-multi-user.md)

**Next**: [Image Variants →](./05-image-variants.md)
