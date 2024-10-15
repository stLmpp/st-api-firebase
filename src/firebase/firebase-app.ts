import { FirebaseApp as FirebaseAppInterface } from 'firebase/app';

import { getClazz } from '../common/get-clazz.js';
import { Injectable } from '@stlmpp/di';

@Injectable()
export class FirebaseApp extends getClazz<FirebaseAppInterface>() {}
