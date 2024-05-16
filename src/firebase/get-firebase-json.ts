import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { formatZodErrorString, safe } from '@st-api/core';
import { z } from 'zod';

let _cache: FirebaseJson | undefined;

export function getFirebaseJson(): FirebaseJson {
  if (_cache) {
    return _cache;
  }
  const filePath = path.join(process.cwd(), 'firebase.json');
  if (!existsSync(filePath)) {
    throw new Error(`Could not find firebase.json at "${filePath}"`);
  }
  const [error, json] = safe(() => JSON.parse(readFileSync(filePath, 'utf8')));
  if (error) {
    throw new Error(`Could not parse firebase.json at "${filePath}"`, {
      cause: error,
    });
  }
  const result = FirebaseSchema.safeParse(json);
  if (!result.success) {
    throw new Error(
      `Could not parse firebase.json at "${filePath}". Errors: ${formatZodErrorString(result.error)}`,
    );
  }
  return (_cache = result.data);
}

const FirebaseEmulatorSchema = z.object({
  host: z.string().optional(),
  port: z.coerce.number().optional(),
});

const FirebaseSchema = z.object({
  emulators: z
    .object({
      auth: FirebaseEmulatorSchema.optional(),
      database: FirebaseEmulatorSchema.optional(),
      dataconnect: FirebaseEmulatorSchema.optional(),
      eventarc: FirebaseEmulatorSchema.optional(),
      firestore: FirebaseEmulatorSchema.extend({
        websocketPort: z.number().optional(),
      }).optional(),
      functions: FirebaseEmulatorSchema.optional(),
      hosting: FirebaseEmulatorSchema.optional(),
      hub: FirebaseEmulatorSchema.optional(),
      logging: FirebaseEmulatorSchema.optional(),
      pubsub: FirebaseEmulatorSchema.optional(),
      storage: FirebaseEmulatorSchema.optional(),
      ui: FirebaseEmulatorSchema.extend({
        enabled: z.boolean().optional(),
      }).optional(),
      extensions: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

export type FirebaseJson = z.infer<typeof FirebaseSchema>;
