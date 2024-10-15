import { Firestore } from 'firebase-admin/firestore';

import { getClazz } from '../common/get-clazz.js';
import { Injectable } from '@stlmpp/di';

@Injectable()
export class FirebaseAdminFirestore extends getClazz<Firestore>() {}
