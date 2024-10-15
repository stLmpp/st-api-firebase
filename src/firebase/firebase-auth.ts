import { Auth } from 'firebase/auth';

import { getClazz } from '../common/get-clazz.js';
import { Injectable } from '@stlmpp/di';

@Injectable()
export class FirebaseAuth extends getClazz<Auth>() {}
