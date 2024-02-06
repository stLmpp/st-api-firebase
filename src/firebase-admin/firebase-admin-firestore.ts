import { Injectable } from '@nestjs/common';
import { Firestore } from 'firebase-admin/firestore';

import { getClazz } from '../common/get-clazz.js';

@Injectable()
export class FirebaseAdminFirestore extends getClazz<Firestore>() {}
