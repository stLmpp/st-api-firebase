export function isEmulator(): boolean {
  return process.env.FUNCTIONS_EMULATOR === 'true';
}
