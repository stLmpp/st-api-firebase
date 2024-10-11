import { App } from 'firebase-admin/app';

import { getClazz } from '../common/get-clazz.js';
import { Injectable } from '@stlmpp/di';

@Injectable()
export class FirebaseAdminApp extends getClazz<App>() {}
