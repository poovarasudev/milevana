// Neutral entry point for Node/Jest. Metro resolves notifications.native.ts or
// notifications.web.ts instead; both re-export the same core contract and install
// their client. The contract lives in notificationsCore.ts so a platform file can
// import it without resolving back to itself.
export * from './notificationsCore';
