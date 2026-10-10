// Neutral entry point for Node/Jest. Metro resolves client.native.ts or client.web.ts
// instead; the shared contract lives in clientCore.ts so a platform file can import
// it without resolving back to itself.
export * from './clientCore';
