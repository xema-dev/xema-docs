---
slug: delegated-session
title: Delegated Session
summary: A short-lived authenticated session minted on behalf of an external subject so an outside caller can invoke Xema capabilities within a bounded scope. Delegated sessions are how apps act for their users without sharing long-lived credentials.
relatedCommands: []
relatedCapabilities: []
relatedZones: ["org", "sandbox"]
stability: experimental
---

A delegated session represents one external subject authenticated into
Xema for a bounded period. An [app](./app.md) registers an `app-client`,
then mints a delegated session for an end user via `app-platform-api`'s
public ingress; that session carries the user's [audience](./audience.md),
the requesting client, and a narrow set of [capabilities](./capability.md).
The token is signed by a rotating key ring — `ES256` or `RS256`, never a
symmetric algorithm, which the enum and a database CHECK make
unrepresentable rather than merely discouraged — and carries
`{ appId, sub, act, org, project, session, environment, capabilities, exp,
jti, tokenClass }`. Public keys are served at
`/public/.well-known/delegated-session-jwks.json`. Every
capability call inside the session is audited under the delegated
subject — not the issuing app. Xema handles authentication transparently;
biome and app authors never reach the underlying identity provider.
This is the mechanism that lets first- and third-party apps call into
Xema without re-implementing identity. See the
[Apps page](../apps.md#delegated-session-jwt) for the JWT shape and
the public ingress endpoint surface.
