import { Injectable } from '@nestjs/common';
import { App } from 'firebase-admin/app';

import { getClazz } from '../common/get-clazz.js';

@Injectable()
export class FirebaseAdminApp extends getClazz<App>() {}
