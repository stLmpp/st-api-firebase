import { Storage } from 'firebase-admin/storage';

import { getClazz } from '../common/get-clazz.js';
import { Injectable } from '@stlmpp/di';

@Injectable()
export class FirebaseAdminStorage extends getClazz<Storage>() {}
