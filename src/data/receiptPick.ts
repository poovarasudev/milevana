// Neutral entry point for Node/Jest. Metro resolves receiptPick.native.ts or
// receiptPick.web.ts instead; the shared contract lives in receiptPickCore.ts so a
// platform file can import it without resolving back to itself.
export * from './receiptPickCore';
