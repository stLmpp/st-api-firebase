import { Injectable } from '@nestjs/common';
import { Auth } from 'firebase-admin/auth';

import { getClazz } from '../common/get-clazz.js';

@Injectable()
export class FirebaseAdminAuth extends getClazz<Auth>() {}
