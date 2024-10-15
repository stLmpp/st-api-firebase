import { Eventarc } from 'firebase-admin/eventarc';

import { getClazz } from '../common/get-clazz.js';
import { Injectable } from '@stlmpp/di';

@Injectable()
export class FirebaseAdminEventarc extends getClazz<Eventarc>() {}
