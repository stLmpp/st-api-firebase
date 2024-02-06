import { Injectable } from '@nestjs/common';
import { FirebaseApp as FirebaseAppInterface } from 'firebase/app';

import { getClazz } from '../common/get-clazz.js';

@Injectable()
export class FirebaseApp extends getClazz<FirebaseAppInterface>() {}
