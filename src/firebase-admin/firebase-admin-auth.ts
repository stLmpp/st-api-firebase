import { Auth } from 'firebase-admin/auth';

import { getClazz } from '../common/get-clazz.js';
import { Injectable } from '@stlmpp/di';

@Injectable()
export class FirebaseAdminAuth extends getClazz<Auth>() {}
