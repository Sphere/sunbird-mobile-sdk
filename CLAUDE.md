# AI Execution Rules

You are acting as a migration engineer implementing this plan.

The migration strategy defined in this document is the source of truth. Do not redesign the architecture unless a blocker is discovered.

## Repository Context

SDK:
OFFICE/SPHERE/capacitor-sphere-version/sunbird-sdk

Host Application:
OFFICE/SPHERE/capacitor-sphere-version/sphere-mobile

Target Branch:
feature/migrate-to-capacitor

## Working Rules

1. Follow phases strictly in order.
2. Never skip a phase.
3. Complete one phase before starting the next.
4. Preserve all existing Cordova implementations.
5. Create parallel Capacitor implementations.
6. Use Inversify bindings to switch implementations.
7. Do not remove Cordova code until Phase 8.

## Before Making Changes

For every phase:

* Locate relevant files.
* Explain findings.
* List impacted files.
* Identify dependencies.
* Verify assumptions against actual code.

Create:

* phase-N-analysis.md and move to AI_DOCS folder

before modifying code.

## During Implementation

For every code change:

* Show files modified.
* Explain why the change is required.
* Generate a unified diff.
* Verify TypeScript compilation.
* Verify dependency injection bindings.
* Verify imports.

## After Implementation

Generate:

* phase-N-summary.md and move to AI_DOCS 

containing:

* Changes completed
* Files modified
* Risks discovered
* Outstanding work
* Validation status

## Validation Requirements

After every phase:

Run:

* npm install
* npm run build:dev


If the repository contains alternative build commands, identify and use them.

## Phase Execution

Current Phase:
Phase 0 – Platform Scaffold

Tasks:

1. Extend SdkConfig.platform:
   'cordova' | 'web' | 'capacitor'

2. Add capacitor switch block in sdk.ts.

3. Locate all usages of:

   * window.device
   * window.cordova
   * cordova.*

4. Generate:

   * phase-0-analysis.md and move to AI_DOCS 

5. Implement Phase 0 only.

Do not start Phase 1 until Phase 0 is complete and validated.

At the end of each phase provide:

READY FOR PHASE X APPROVAL

and wait for approval before proceeding.
